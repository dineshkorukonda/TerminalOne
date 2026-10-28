import type {
  Grid,
  PtyEvent,
  PtyHandle,
  PtyPort,
  Shell
} from '../../domain/terminal/pty'

interface Host {
  port: PtyPort
  detach: () => void
  closing: Promise<void> | null
  started: boolean
  exited: boolean
}

// node-pty 1.1.0 can retain ConPTY worker/native resources until its host exits.
// Give each session an owned process lifetime instead of patching private APIs
// or calling the dependency's unsafe bare-PID kill fallback.
export class SessionPtyPort implements PtyPort {
  private hosts = new Map<string, Host>()
  private retiring = new Set<Promise<void>>()
  private failures = new Set<() => void>()
  private disposed = false
  private cleanupFailed = false
  private readonly createHost: () => PtyPort

  constructor(createHost: () => PtyPort) {
    this.createHost = createHost
  }

  onFailure(callback: () => void) {
    this.failures.add(callback)
    return () => {
      this.failures.delete(callback)
    }
  }

  private retire(id: string, host: Host): Promise<void> {
    if (host.closing) return host.closing
    host.detach()
    if (this.hosts.get(id) === host) this.hosts.delete(id)
    const operation = Promise.resolve().then(() => host.port.dispose())
    host.closing = operation
    this.retiring.add(operation)
    void operation.then(
      () => {
        this.retiring.delete(operation)
      },
      () => {
        this.retiring.delete(operation)
        this.cleanupFailed = true
        this.disposed = true
        this.failed()
      }
    )
    return operation
  }

  private failed() {
    const hosts = [...this.hosts]
    for (const [id, host] of hosts) void this.retire(id, host).catch(() => {})
    // Preserve the existing fail-closed port contract; a fresh session may
    // start after the failed hosts have been removed from allocation.
    for (const callback of this.failures) callback()
  }

  async start(
    id: string,
    shell: Shell,
    cwd: string,
    grid: Grid,
    emit: (event: PtyEvent) => void
  ): Promise<PtyHandle> {
    if (
      this.disposed ||
      this.hosts.has(id) ||
      this.hosts.size + this.retiring.size >= 16
    )
      throw new Error('Terminal session host is unavailable')
    const host: Host = {
      port: this.createHost(),
      detach: () => {},
      closing: null,
      started: false,
      exited: false
    }
    this.hosts.set(id, host)
    host.detach = host.port.onFailure(() => this.failed())
    try {
      const handle = await host.port.start(id, shell, cwd, grid, (event) => {
        if (host.closing) return
        if (event.type === 'exit') host.exited = true
        emit(event)
        if (host.exited && host.started)
          void this.retire(id, host).catch(() => {})
      })
      host.started = true
      if (this.disposed || host.closing) {
        await this.retire(id, host)
        throw new Error('Terminal session host closed during startup')
      }
      if (host.exited) void this.retire(id, host).catch(() => {})
      const live = () => {
        if (host.closing || host.exited || this.disposed)
          throw new Error('Terminal session host is closed')
      }
      return {
        pid: handle.pid,
        write: async (data) => {
          live()
          await handle.write(data)
        },
        resize: async (size) => {
          live()
          await handle.resize(size)
        },
        acknowledge: async (sequence) => {
          // A renderer ACK already queued when an exit is delivered is benign.
          if (!host.closing && !host.exited && !this.disposed)
            await handle.acknowledge(sequence)
        },
        close: () => this.retire(id, host)
      }
    } catch (error) {
      await this.retire(id, host)
      throw error
    }
  }

  async dispose(): Promise<void> {
    this.disposed = true
    for (const [id, host] of this.hosts)
      void this.retire(id, host).catch(() => {})
    const results = await Promise.allSettled([...this.retiring])
    this.failures.clear()
    if (
      this.cleanupFailed ||
      results.some((result) => result.status === 'rejected')
    )
      throw new Error('Terminal session host did not shut down')
  }
}
