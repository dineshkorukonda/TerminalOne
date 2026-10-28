import { utilityProcess, type UtilityProcess } from 'electron'
import { join } from 'node:path'
import type {
  Grid,
  PtyEvent,
  PtyHandle,
  PtyPort,
  Shell
} from '../../domain/terminal/pty'

export class UtilityPtyPort implements PtyPort {
  private child: UtilityProcess | null = null
  private ready: Promise<void> | null = null
  private sequence = 0
  private pending = new Map<
    number,
    {
      resolve: (value: unknown) => void
      reject: (error: Error) => void
      timer: ReturnType<typeof setTimeout>
    }
  >()
  private events = new Map<string, (event: PtyEvent) => void>()
  private failures = new Set<() => void>()
  private stopping = false
  onFailure(callback: () => void) {
    this.failures.add(callback)
    return () => {
      this.failures.delete(callback)
    }
  }
  private launch(): Promise<void> {
    if (this.ready) return this.ready
    if (process.platform !== 'win32')
      return Promise.reject(new Error('Windows ConPTY is required'))
    this.stopping = false
    const child = utilityProcess.fork(join(__dirname, 'pty-host.js'), [], {
      stdio: 'pipe',
      env: {
        ...process.env,
        TERMINAL_MAIN_PID: String(process.pid),
        NODE_OPTIONS: '',
        ELECTRON_RUN_AS_NODE: ''
      },
      serviceName: 'Terminal PTY host'
    })
    this.child = child
    child.stdout?.resume()
    child.stderr?.resume()
    this.ready = new Promise((resolve, reject) => {
      const timer = setTimeout(() => {
        reject(new Error('Native terminal host startup timed out'))
        child.kill()
      }, 15000)
      child.on('message', (message: unknown) => {
        if (!message || typeof message !== 'object') return
        const data = message as Record<string, unknown>
        if (data['type'] === 'ready') {
          clearTimeout(timer)
          resolve()
          return
        }
        if (data['type'] === 'event' && typeof data['id'] === 'string') {
          const event = data['event'] as PtyEvent
          if (
            event?.type === 'data' &&
            (typeof event.data !== 'string' ||
              event.data.length > 8192 ||
              !Number.isSafeInteger(event.sequence))
          ) {
            child.kill()
            return
          }
          if (
            event?.type === 'integration' &&
            typeof event.ready !== 'boolean'
          ) {
            child.kill()
            return
          }
          if (
            event?.type === 'command' &&
            (typeof event.command !== 'string' || event.command.length > 4096)
          ) {
            child.kill()
            return
          }
          if (
            event &&
            ['data', 'exit', 'error', 'command', 'integration'].includes(
              event.type
            )
          )
            this.events.get(data['id'])?.(event)
          return
        }
        const request = this.pending.get(Number(data['request']))
        if (!request) return
        this.pending.delete(Number(data['request']))
        clearTimeout(request.timer)
        if (data['error'])
          request.reject(
            new Error(
              'Native terminal operation failed. Verify the installed shell and native components.'
            )
          )
        else request.resolve(data['value'])
      })
      child.once('exit', () => {
        clearTimeout(timer)
        reject(
          new Error(
            'Native terminal host stopped. Rebuild the Windows native components.'
          )
        )
        for (const request of this.pending.values()) {
          clearTimeout(request.timer)
          request.reject(new Error('Native terminal host stopped'))
        }
        this.pending.clear()
        this.events.clear()
        this.child = null
        this.ready = null
        if (!this.stopping) for (const callback of this.failures) callback()
      })
    })
    return this.ready
  }
  private async request(
    type: string,
    id = '',
    fields: object = {}
  ): Promise<unknown> {
    await this.launch()
    if (!this.child || this.pending.size >= 64)
      throw new Error('Native terminal is busy or unavailable')
    const request = ++this.sequence
    return new Promise((resolve, reject) => {
      const timer = setTimeout(() => {
        this.pending.delete(request)
        reject(new Error('Native terminal operation timed out'))
        this.child?.kill()
      }, 10000)
      this.pending.set(request, { resolve, reject, timer })
      this.child!.postMessage({ request, type, id, ...fields })
    })
  }
  async start(
    id: string,
    shell: Shell,
    cwd: string,
    grid: Grid,
    emit: (event: PtyEvent) => void
  ): Promise<PtyHandle> {
    await this.launch()
    this.events.set(id, emit)
    try {
      const result = (await this.request('start', id, {
        shell,
        cwd,
        grid
      })) as { pid: number }
      return {
        pid: result.pid,
        write: async (data) => {
          await this.request('write', id, { data })
        },
        resize: async (dimensions) => {
          await this.request('resize', id, { grid: dimensions })
        },
        acknowledge: async (sequence) => {
          await this.request('ack', id, { sequence })
        },
        close: async () => {
          try {
            if (this.child) await this.request('close', id)
          } finally {
            this.events.delete(id)
          }
        }
      }
    } catch (error) {
      this.events.delete(id)
      throw error
    }
  }
  async dispose(): Promise<void> {
    this.stopping = true
    const child = this.child
    if (!child) return
    const exited = new Promise<void>((resolve) => {
      child.once('exit', () => resolve())
    })
    // Install the exit observer before requesting shutdown; process ownership
    // is complete only after the retained UtilityProcess has actually exited.
    try {
      await this.request('shutdown')
    } finally {
      child.kill()
      let timer: ReturnType<typeof setTimeout> | undefined
      try {
        await Promise.race([
          exited,
          new Promise<never>((_resolve, reject) => {
            timer = setTimeout(
              () => reject(new Error('Native terminal host did not exit')),
              5000
            )
          })
        ])
      } finally {
        clearTimeout(timer)
      }
    }
  }
}
