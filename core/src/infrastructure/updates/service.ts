import type { UpdateStatus } from '../../contracts/updates'

export interface UpdateBackend {
  check(): Promise<string | null>
  download(progress: (percent: number) => void): Promise<void>
  install(): void
  onError(listener: () => void): () => void
}

export class UpdateService {
  private state: UpdateStatus
  private operation: Promise<UpdateStatus> | null = null
  private listeners = new Set<(status: UpdateStatus) => void>()
  private detach: (() => void) | undefined
  private backend: UpdateBackend | null
  private prepareInstall: () => Promise<void>

  constructor(
    backend: UpdateBackend | null,
    version: string,
    prepareInstall: () => Promise<void>
  ) {
    this.backend = backend
    this.prepareInstall = prepareInstall
    this.state = {
      phase: backend ? 'idle' : 'unavailable',
      currentVersion: version,
      version: null,
      progress: 0,
      message: backend
        ? 'Updates are checked automatically. Installation always requires your confirmation.'
        : 'In-app updates are available in the installed Windows version.'
    }
    this.detach = backend?.onError(() =>
      this.set({
        phase: 'error',
        message:
          'The update could not be completed. Check your connection and try again.'
      })
    )
  }

  current(): UpdateStatus {
    return { ...this.state }
  }
  subscribe(listener: (status: UpdateStatus) => void) {
    this.listeners.add(listener)
    return () => {
      this.listeners.delete(listener)
    }
  }
  private set(change: Partial<UpdateStatus>) {
    this.state = { ...this.state, ...change }
    for (const listener of this.listeners) listener(this.current())
  }
  private run(action: () => Promise<void>): Promise<UpdateStatus> {
    if (this.operation) return this.operation
    this.operation = Promise.resolve()
      .then(action)
      .catch(() => {
        this.set({
          phase: 'error',
          message:
            'The update could not be completed. Check your connection and try again.'
        })
      })
      .then(() => this.current())
      .finally(() => {
        this.operation = null
      })
    return this.operation
  }
  check(): Promise<UpdateStatus> {
    if (
      !this.backend ||
      ['downloaded', 'installing'].includes(this.state.phase)
    )
      return Promise.resolve(this.current())
    return this.run(async () => {
      this.set({
        phase: 'checking',
        progress: 0,
        version: null,
        message: 'Checking for updates…'
      })
      const version = await this.backend!.check()
      if (
        version !== null &&
        !/^\d+\.\d+\.\d+(?:-[0-9A-Za-z.-]+)?$/.test(version.slice(0, 65))
      )
        throw new Error('Invalid update version')
      if (version && version.length > 64)
        throw new Error('Invalid update version')
      this.set({
        phase: version ? 'available' : 'current',
        version,
        message: version
          ? `Version ${version} is available.`
          : 'You are up to date.'
      })
    })
  }
  download(): Promise<UpdateStatus> {
    if (this.operation) return this.operation
    if (!this.backend || this.state.phase !== 'available')
      return Promise.reject(new Error('No update is available to download'))
    return this.run(async () => {
      this.set({
        phase: 'downloading',
        progress: 0,
        message: 'Downloading update…'
      })
      await this.backend!.download((percent) => {
        if (Number.isFinite(percent))
          this.set({
            progress: Math.round(Math.max(0, Math.min(100, percent)))
          })
      })
      this.set({
        phase: 'downloaded',
        progress: 100,
        message: 'Update ready. Restart when your terminal work is finished.'
      })
    })
  }
  install(confirm: () => Promise<boolean>): Promise<UpdateStatus> {
    if (this.operation) return this.operation
    if (!this.backend || this.state.phase !== 'downloaded')
      return Promise.reject(new Error('No verified update is ready to install'))
    return this.run(async () => {
      if (!(await confirm())) return
      this.set({
        phase: 'installing',
        message: 'Closing terminal sessions and installing the update…'
      })
      await this.prepareInstall()
      this.backend!.install()
    })
  }
  dispose() {
    this.detach?.()
    this.listeners.clear()
  }
}
