import type {
  Grid,
  PtyEvent,
  PtyHandle,
  PtyPort,
  Shell
} from '../../domain/terminal/pty.ts'
import { validateGrid, validateInput } from '../../domain/terminal/pty.ts'

export type SessionState =
  'starting' | 'running' | 'exited' | 'failed' | 'closed'
export interface SessionInfo {
  id: string
  state: SessionState
  pid: number | null
  shellId: string
  exitCode: number | null
}
export type SessionEvent =
  ({ type: 'state' } & SessionInfo) | ({ id: string } & PtyEvent)
interface RecordEntry extends SessionInfo {
  owner: string
  ready: Promise<PtyHandle> | null
  handle: PtyHandle | null
  closing: Promise<void> | null
}

export class Sessions {
  private disposed = false
  private readonly records = new Map<string, RecordEntry>()
  private readonly detach: () => void
  private readonly port: PtyPort
  private readonly nextId: () => string
  private readonly emit: (owner: string, event: SessionEvent) => void
  constructor(
    port: PtyPort,
    nextId: () => string,
    emit: (owner: string, event: SessionEvent) => void
  ) {
    this.port = port
    this.nextId = nextId
    this.emit = emit
    this.detach = port.onFailure(() => {
      for (const session of this.records.values()) {
        if (session.state === 'running' || session.state === 'starting') {
          session.state = 'failed'
          this.emit(session.owner, {
            id: session.id,
            type: 'error',
            message: 'The terminal host stopped. Start a new session.'
          })
          this.state(session)
        }
      }
    })
  }
  private state(session: RecordEntry): SessionInfo {
    const info = {
      id: session.id,
      state: session.state,
      pid: session.pid,
      shellId: session.shellId,
      exitCode: session.exitCode
    }
    this.emit(session.owner, { type: 'state', ...info })
    return info
  }
  private owned(owner: string, id: string): RecordEntry {
    const record = this.records.get(id)
    if (!record || record.owner !== owner)
      throw new Error('Unknown or unowned terminal session')
    return record
  }
  async create(
    owner: string,
    shell: Shell,
    cwd: string,
    dimensions: Grid
  ): Promise<SessionInfo> {
    if (this.disposed) throw new Error('Terminal service is closed')
    const grid = validateGrid(dimensions)
    if (
      this.records.size >= 256 ||
      [...this.records.values()].filter(
        (record) => record.state === 'starting' || record.state === 'running'
      ).length >= 16 ||
      [...this.records.values()].filter(
        (record) =>
          record.owner === owner &&
          (record.state === 'starting' || record.state === 'running')
      ).length >= 4
    )
      throw new Error(
        'Terminal session limit reached. Close sessions or reopen the window.'
      )
    const id = this.nextId()
    const session: RecordEntry = {
      id,
      owner,
      state: 'starting',
      pid: null,
      shellId: shell.id,
      exitCode: null,
      handle: null,
      ready: null,
      closing: null
    }
    this.records.set(id, session)
    this.state(session)
    try {
      session.ready = this.port.start(id, shell, cwd, grid, (event) => {
        if (session.state === 'closed' || session.state === 'failed') return
        if (event.type === 'exit') {
          session.state = 'exited'
          session.exitCode = event.exitCode
        }
        if (event.type === 'error') session.state = 'failed'
        this.emit(owner, { id, ...event })
        if (event.type !== 'data') this.state(session)
      })
      session.handle = await session.ready
      session.pid = session.handle.pid
      if (session.state === 'closed') await session.closing
      else if (session.state === 'failed') await session.handle.close()
      else if (session.state === 'starting') session.state = 'running'
      return this.state(session)
    } catch {
      if (session.state !== 'closed') {
        session.state = 'failed'
        this.emit(owner, {
          id,
          type: 'error',
          message:
            'Could not start the terminal. Verify the shell is installed and the native Windows components were built.'
        })
        this.state(session)
      }
      throw new Error(
        'Could not start the terminal. Verify the shell and native Windows components.'
      )
    }
  }
  async write(owner: string, id: string, value: unknown): Promise<void> {
    const session = this.owned(owner, id)
    const data = validateInput(value)
    if (session.state !== 'running' || !session.handle)
      throw new Error('Terminal session is not running')
    await session.handle.write(data)
  }
  async resize(owner: string, id: string, dimensions: Grid): Promise<void> {
    const session = this.owned(owner, id)
    const grid = validateGrid(dimensions)
    if (session.state !== 'running' || !session.handle)
      throw new Error('Terminal session is not running')
    await session.handle.resize(grid)
  }
  async acknowledge(
    owner: string,
    id: string,
    sequence: number
  ): Promise<void> {
    const session = this.owned(owner, id)
    if (!Number.isSafeInteger(sequence) || sequence < 0)
      throw new Error('Invalid terminal acknowledgement')
    if (session.state === 'running' || session.state === 'starting')
      await session.handle?.acknowledge(sequence)
  }
  async close(owner: string, id: string): Promise<void> {
    const session = this.owned(owner, id)
    if (session.closing) return session.closing
    session.state = 'closed'
    this.state(session)
    session.closing = (async () => {
      const handle = session.handle ?? (await session.ready?.catch(() => null))
      await handle?.close()
    })()
    return session.closing
  }
  async closeOwner(owner: string): Promise<void> {
    const records = [...this.records.values()].filter(
      (session) => session.owner === owner
    )
    await Promise.allSettled(
      records.map((record) => this.close(owner, record.id))
    )
    for (const record of records) this.records.delete(record.id)
  }
  async dispose(): Promise<void> {
    this.disposed = true
    await Promise.allSettled(
      [...this.records.values()].map((record) =>
        this.close(record.owner, record.id)
      )
    )
    this.detach()
    await this.port.dispose()
    this.records.clear()
  }
}
