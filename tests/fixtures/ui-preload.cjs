/* eslint-disable @typescript-eslint/no-require-imports -- Controlled sandboxed renderer fixture; never bundled in production preload. */
const { contextBridge } = require('electron')
const preview = process.argv.includes('--terminal-ui-preview')
let sequence = 0,
  clipboard = ''
const listeners = new Set(),
  sessions = new Map()
const emit = (event) => {
  for (const listener of listeners) listener(event)
}
let settings = {
  version: 1,
  appearance: {
    theme: 'midnight',
    font: {
      family: 'Cascadia Mono',
      size: 14,
      lineHeight: 1.5,
      ligatures: false
    }
  },
  history: { enabled: false, limit: 200 },
  shortcuts: {
    palette: 'Ctrl+Shift+P',
    new: 'Ctrl+Shift+T',
    close: 'Ctrl+Shift+W',
    right: 'Ctrl+Shift+E',
    down: 'Ctrl+Shift+O',
    search: 'Ctrl+Shift+F',
    copy: 'Ctrl+Shift+C',
    paste: 'Ctrl+Shift+V'
  },
  projects: [],
  restoration: { enabled: false, tabs: [] },
  explanations: false
}
contextBridge.exposeInMainWorld('desktop', {
  getPreferences: async () => ({ settings, warning: '' }),
  savePreferences: async (value) => {
    settings = value
    return { settings, warning: '' }
  },
  resetPreferences: async () => ({ settings, warning: '' }),
  chooseProject: async (shellId) => {
    const project = {
      id: 'fixture-project',
      name: 'Fixture project',
      cwd: 'C:\\Fixture Spaces\\世界',
      shellId
    }
    settings = { ...settings, projects: [project] }
    return project
  },
  importPreferences: async () => null,
  exportPreferences: async () => false,
  searchHistory: async (query, shell) =>
    settings.history.enabled
      ? [
          {
            id: 'sample-1',
            shellId: 'powershell',
            command: "Get-ChildItem 'C:\\Fixture Spaces'",
            time: 1
          },
          {
            id: 'sample-2',
            shellId: 'powershell',
            command: 'Get-Location',
            time: 2
          }
        ].filter(
          (item) =>
            (shell === 'all' || shell === item.shellId) &&
            item.command.toLowerCase().includes(query.toLowerCase())
        )
      : [],
  clearHistory: async () => {},
  explainCommand: async () => {
    if (!settings.explanations) throw new Error('Disabled')
    return 'Synthetic local reference. Nothing executed.'
  },
  getAppInfo: async () => ({ name: 'Terminal One', version: '0.1.0' }),
  openExternal: async () => {},
  listShells: async () => [
    { id: 'powershell', name: preview ? 'PowerShell' : 'PowerShell fixture' },
    { id: 'cmd', name: preview ? 'Command Prompt' : 'CMD fixture' }
  ],
  createSession: async ({ shellId }) => {
    if (sessions.size >= 4) throw new Error('Fixture owner limit reached')
    const id = `fixture-${++sequence}`,
      session = { id, shellId, pid: sequence, state: 'running', exitCode: null }
    sessions.set(id, session)
    emit({ type: 'state', ...session })
    emit({
      type: 'data',
      id,
      sequence: 1,
      data: `\x1b[32mFixture ${id}\x1b[0m 世界\r\nsearch match one\r\nsearch match two\r\n`
    })
    return session
  },
  writeSession: async (id, data) => {
    if (sessions.has(id))
      emit({ type: 'data', id, data: data.replace(/\r/g, '\r\n'), sequence: 2 })
  },
  resizeSession: async () => {},
  acknowledgeSession: async () => {},
  closeSession: async (id) => {
    const session = sessions.get(id)
    if (session) {
      session.state = 'closed'
      emit({ type: 'state', ...session })
      sessions.delete(id)
    }
  },
  onSessionEvent: (listener) => {
    listeners.add(listener)
    return () => listeners.delete(listener)
  },
  readClipboard: async () => clipboard,
  writeClipboard: async (text) => {
    clipboard = text
  }
})
