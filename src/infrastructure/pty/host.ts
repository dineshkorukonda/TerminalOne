import type { ParentPort } from 'electron'
import { spawn, type IPty } from 'node-pty'
import { release } from 'node:os'
import { createJobOwner } from './jobs'
import { validateGrid, validateInput } from '../../domain/terminal/pty'
import type { Grid, Shell } from '../../domain/terminal/pty'

const parent: ParentPort = process.parentPort
if (
  !parent ||
  process.platform !== 'win32' ||
  Number(release().split('.')[2]) < 18309
)
  throw new Error('A Windows ConPTY utility process is required')
async function run() {
  const jobs = await createJobOwner()
  interface Entry {
    terminal: IPty
    pending: string[]
    waiting: Map<number, number>
    sequence: number
    buffered: number
    paused: boolean
    closed: boolean
    exitCode: number | null
  }
  const sessions = new Map<string, Entry>()
  function event(id: string, payload: object) {
    parent.postMessage({ type: 'event', id, event: payload })
  }
  function drain(id: string, session: Entry) {
    while (
      !session.closed &&
      session.pending.length &&
      session.waiting.size < 8
    ) {
      const data = session.pending.shift()!
      const sequence = ++session.sequence
      session.waiting.set(sequence, data.length)
      event(id, { type: 'data', data, sequence })
    }
    if (
      session.buffered < 32768 &&
      session.paused &&
      !session.closed &&
      session.exitCode === null
    ) {
      session.terminal.resume()
      session.paused = false
    }
    if (
      session.exitCode !== null &&
      !session.closed &&
      !session.pending.length &&
      !session.waiting.size
    ) {
      session.closed = true
      sessions.delete(id)
      event(id, { type: 'exit', exitCode: session.exitCode })
    }
  }
  async function close(id: string) {
    const session = sessions.get(id)
    if (!session) return
    session.closed = true
    session.pending.length = 0
    session.waiting.clear()
    // Job termination owns the tree; avoid node-pty's bare-PID fallback sweep.
    await jobs.close(id)
    sessions.delete(id)
  }
  async function request(message: Record<string, unknown>) {
    const type = message['type']
    const id = String(message['id'])
    if (type === 'start') {
      if (
        sessions.has(id) ||
        sessions.size >= 16 ||
        !/^[a-zA-Z0-9-]{1,80}$/.test(id)
      )
        throw new Error('Invalid session')
      const shell = message['shell'] as Shell
      const grid = validateGrid(message['grid'])
      const env = Object.fromEntries(
        Object.entries(process.env).filter(
          ([key, value]) =>
            typeof value === 'string' &&
            ![
              'ELECTRON_RUN_AS_NODE',
              'NODE_OPTIONS',
              'TERMINAL_MAIN_PID'
            ].includes(key)
        )
      ) as Record<string, string>
      const terminal = spawn(shell.executable, shell.args, {
        ...grid,
        cwd: String(message['cwd']),
        env,
        useConpty: true,
        name: 'xterm-256color'
      })
      const session: Entry = {
        terminal,
        pending: [],
        waiting: new Map(),
        sequence: 0,
        buffered: 0,
        paused: false,
        closed: false,
        exitCode: null
      }
      sessions.set(id, session)
      terminal.onData((data) => {
        if (session.closed) return
        if (session.buffered + data.length > 262144) {
          void close(id)
          event(id, {
            type: 'error',
            message:
              'Terminal output exceeded the bounded stream buffer. Session closed.'
          })
          return
        }
        for (let offset = 0; offset < data.length;) {
          let end = Math.min(data.length, offset + 8192)
          if (
            end < data.length &&
            data.charCodeAt(end - 1) >= 0xd800 &&
            data.charCodeAt(end - 1) <= 0xdbff
          )
            end--
          session.pending.push(data.slice(offset, end))
          offset = end
        }
        session.buffered += data.length
        if (session.buffered >= 65536 && !session.paused) {
          terminal.pause()
          session.paused = true
        }
        drain(id, session)
      })
      terminal.onExit(({ exitCode }) => {
        session.exitCode = exitCode
        void jobs
          .close(id)
          .then(() => drain(id, session))
          .catch(() => process.exit(1))
      })
      try {
        await jobs.add(id, terminal.pid)
      } catch {
        process.exit(1)
      }
      return { pid: terminal.pid }
    }
    if (type === 'shutdown') {
      await Promise.all([...sessions.keys()].map(close))
      jobs.dispose()
      return null
    }
    if (type === 'close') {
      await close(id)
      return null
    }
    const session = sessions.get(id)
    if (!session || session.closed) return null
    if (type === 'write') session.terminal.write(validateInput(message['data']))
    else if (type === 'resize') {
      const grid: Grid = validateGrid(message['grid'])
      session.terminal.resize(grid.cols, grid.rows)
    } else if (type === 'ack') {
      const sequence = Number(message['sequence'])
      session.buffered -= session.waiting.get(sequence) ?? 0
      session.waiting.delete(sequence)
      drain(id, session)
    } else throw new Error('Invalid host request')
    return null
  }
  parent.on('message', ({ data }) => {
    if (
      !data ||
      typeof data !== 'object' ||
      !Number.isSafeInteger(data.request)
    )
      return
    void request(data).then(
      (value) => parent.postMessage({ request: data.request, value }),
      () =>
        parent.postMessage({
          request: data.request,
          error:
            'Native terminal operation failed. Check the installed shell and rebuilt native components.'
        })
    )
  })

  parent.postMessage({ type: 'ready' })
}
void run().catch(() => process.exit(1))
