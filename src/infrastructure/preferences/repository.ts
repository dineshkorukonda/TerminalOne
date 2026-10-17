import { mkdir, readFile, rename, writeFile, stat } from 'node:fs/promises'
import { join } from 'node:path'
import { randomUUID } from 'node:crypto'
import {
  defaultPreferences,
  parsePreferences
} from '../../contracts/preferences.ts'
import type { HistoryEntry } from '../../contracts/preferences.ts'

export class PreferenceRepository {
  private settings = defaultPreferences()
  private history: HistoryEntry[] = []
  private blocked = false
  private queue = Promise.resolve()
  private historyWriting: Promise<void> | null = null
  private historyDirty = false
  warning = ''
  private readonly directory: string
  constructor(directory: string) {
    this.directory = directory
  }
  async load() {
    try {
      this.settings = parsePreferences(
        JSON.parse(await this.read('settings.json', 65536))
      )
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code !== 'ENOENT') {
        this.blocked = true
        this.warning =
          'Settings could not be read. The original file is preserved. Reset settings to save changes.'
      }
    }
    if (this.settings.history.enabled) {
      try {
        const values: unknown = JSON.parse(
          await this.read('history.json', 8388608)
        )
        if (!Array.isArray(values)) throw new Error('Invalid history')
        this.history = values
          .filter(
            (item): item is HistoryEntry =>
              !!item &&
              typeof item === 'object' &&
              Object.keys(item).sort().join(',') ===
                'command,id,shellId,time' &&
              typeof item.id === 'string' &&
              /^[a-zA-Z0-9-]{1,80}$/.test(item.id) &&
              ['pwsh', 'powershell'].includes(item.shellId) &&
              validCommand(item.command) &&
              Number.isSafeInteger(item.time)
          )
          .slice(-this.settings.history.limit)
      } catch {
        this.history = []
      }
    }
    return this.current()
  }
  private async read(file: string, max: number) {
    const path = join(this.directory, file)
    if ((await stat(path)).size > max) throw new Error('Data file too large')
    const data = await readFile(path, 'utf8')
    if (Buffer.byteLength(data) > max) throw new Error('Data file too large')
    return data
  }
  private persist(file: string, value: unknown) {
    const data = JSON.stringify(value)
    const operation = this.queue.then(async () => {
      await mkdir(this.directory, { recursive: true, mode: 0o700 })
      const temp = join(this.directory, `${file}.${randomUUID()}.tmp`)
      await writeFile(temp, data, { mode: 0o600 })
      await rename(temp, join(this.directory, file))
    })
    this.queue = operation.catch(() => {})
    return operation
  }
  current() {
    return { settings: parsePreferences(this.settings), warning: this.warning }
  }
  async save(value: unknown) {
    if (this.blocked) throw new Error(this.warning)
    const settings = parsePreferences(value)
    await this.persist('settings.json', settings)
    this.settings = settings
    this.history = settings.history.enabled
      ? this.history.slice(-settings.history.limit)
      : []
    await this.storeHistory()
    return this.current()
  }
  async reset() {
    await this.persist('settings.json', defaultPreferences())
    this.settings = defaultPreferences()
    this.history = []
    this.blocked = false
    this.warning = ''
    await this.storeHistory()
    return this.current()
  }
  search(query: unknown, shell: unknown): HistoryEntry[] {
    if (
      typeof query !== 'string' ||
      query.length > 256 ||
      typeof shell !== 'string'
    )
      throw new Error('Invalid history query')
    if (!this.settings.history.enabled) return []
    return this.history
      .filter(
        (item) =>
          (shell === 'all' || shell === item.shellId) &&
          item.command.toLowerCase().includes(query.toLowerCase())
      )
      .slice(-100)
      .reverse()
      .map((item) => ({ ...item }))
  }
  async record(shellId: string, command: unknown) {
    if (
      !this.settings.history.enabled ||
      !['pwsh', 'powershell'].includes(shellId) ||
      !validCommand(command)
    )
      return
    const previous = this.history.at(-1)
    if (previous?.command === command && previous.shellId === shellId) return
    this.history.push({ id: randomUUID(), shellId, command, time: Date.now() })
    this.history = this.history.slice(-this.settings.history.limit)
    let characters = this.history.reduce(
      (sum, item) => sum + item.command.length,
      0
    )
    while (characters > 262144) {
      characters -= this.history.shift()!.command.length
    }
    await this.storeHistory()
  }
  private storeHistory(): Promise<void> {
    this.historyDirty = true
    if (this.historyWriting) return this.historyWriting
    this.historyWriting = (async () => {
      while (this.historyDirty) {
        this.historyDirty = false
        await this.persist('history.json', this.history)
      }
    })().finally(() => {
      this.historyWriting = null
    })
    return this.historyWriting
  }
  async clearHistory() {
    this.history = []
    await this.storeHistory()
  }
  async flush() {
    await this.historyWriting
    await this.queue
  }
}
function validCommand(value: unknown): value is string {
  return (
    typeof value === 'string' &&
    value.trim().length > 0 &&
    value.length <= 4096 &&
    ![...value].some(
      (char) =>
        (char.charCodeAt(0) < 32 && !['\t', '\r', '\n'].includes(char)) ||
        char.charCodeAt(0) === 127
    ) &&
    !/^\s/.test(value) &&
    !/(?:password|passwd|secret|token|api[_-]?key|authorization|credential)/i.test(
      value
    )
  )
}
