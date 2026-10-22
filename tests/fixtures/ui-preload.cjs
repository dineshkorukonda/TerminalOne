/* eslint-disable @typescript-eslint/no-require-imports -- Controlled sandboxed renderer fixture; never bundled in production preload. */
const { contextBridge } = require('electron')
const preview = process.argv.includes('--terminal-ui-preview')
let sequence = 0,
  clipboard = '',
  cancelProject = false,
  historyDelay = 0,
  historyHolds = 0,
  holdClear = false,
  releaseClear = null,
  failClear = false,
  clearCount = 0
const heldHistory = []
let historyEntries = [
  {
    id: 'sample-1',
    shellId: 'powershell',
    command: "Get-ChildItem 'C:\\Fixture Spaces'",
    time: 1
  },
  { id: 'sample-2', shellId: 'powershell', command: 'Get-Location', time: 2 }
]
const historyRequests = [],
  historyCompletions = [],
  sessionLaunches = []
contextBridge.exposeInMainWorld('uiFixture', {
  cancelNextProject: () => {
    cancelProject = true
  },
  getSessionLaunches: () =>
    sessionLaunches.map(({ shellId, projectId }) => ({ shellId, projectId })),
  getSessionOptions: () => sessionLaunches,
  getHistoryRequests: () => historyRequests,
  getHistoryCompletions: () => historyCompletions,
  holdNextHistory: () => {
    historyHolds++
  },
  getPendingHistoryCount: () => heldHistory.length,
  releaseHistoryResponses: () => {
    for (const resolve of heldHistory.splice(0)) resolve()
  },
  holdNextClear: () => {
    holdClear = true
  },
  finishClear: () => {
    releaseClear?.()
    releaseClear = null
  },
  failNextClear: () => {
    failClear = true
  },
  getClearCount: () => clearCount,
  delayNextHistory: (milliseconds) => {
    historyDelay = milliseconds
  }
})
const listeners = new Set(),
  sessions = new Map()
const emit = (event) => {
  for (const listener of listeners) listener(event)
}
const updateListeners = new Set()
let updateStatus = {
  phase: 'idle',
  currentVersion: '0.2.0-alpha.1',
  version: null,
  progress: 0,
  message: 'Check for updates when you are ready.'
}
const update = (change) => {
  updateStatus = { ...updateStatus, ...change }
  for (const listener of updateListeners) listener({ ...updateStatus })
  return { ...updateStatus }
}
let settings = {
  version: 1,
  appearance: {
    theme: 'midnight',
    font: {
      family: 'Cascadia Mono',
      size: 16,
      lineHeight: 1.2,
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
  getUpdateStatus: async () => ({ ...updateStatus }),
  checkForUpdates: async () =>
    update({
      phase: 'available',
      version: '0.2.0-alpha.2',
      message: 'Version 0.2.0-alpha.2 is available.'
    }),
  downloadUpdate: async () => {
    update({
      phase: 'downloading',
      progress: 50,
      message: 'Downloading update…'
    })
    await new Promise((resolve) => setTimeout(resolve, 250))
    return update({
      phase: 'downloaded',
      progress: 100,
      message: 'Update ready. Restart when your terminal work is finished.'
    })
  },
  installUpdate: async () =>
    update({
      phase: 'installing',
      message: 'Closing terminal sessions and installing the update…'
    }),
  onUpdateStatus: (listener) => {
    updateListeners.add(listener)
    return () => updateListeners.delete(listener)
  },
  getPreferences: async () => ({ settings, warning: '' }),
  savePreferences: async (value) => {
    settings = value
    return { settings, warning: '' }
  },
  resetPreferences: async () => ({ settings, warning: '' }),
  chooseProject: async (shellId) => {
    if (cancelProject) {
      cancelProject = false
      return null
    }
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
  searchHistory: async (query, shell) => {
    historyRequests.push(query)
    // Capture the old result before delaying, reproducing an in-flight IPC reply.
    const result = settings.history.enabled
      ? historyEntries.filter(
          (item) =>
            (shell === 'all' || shell === item.shellId) &&
            item.command.toLowerCase().includes(query.toLowerCase())
        )
      : []
    const delay = historyDelay
    historyDelay = 0
    if (historyHolds) {
      historyHolds--
      await new Promise((resolve) => heldHistory.push(resolve))
    }
    if (delay) await new Promise((resolve) => setTimeout(resolve, delay))
    historyCompletions.push(query)
    return result
  },
  clearHistory: async () => {
    clearCount++
    const fail = failClear
    failClear = false
    if (holdClear) {
      holdClear = false
      await new Promise((resolve) => {
        releaseClear = resolve
      })
    }
    if (fail) throw new Error('Synthetic clear failure')
    historyEntries = []
  },
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
  createSession: async ({ shellId, projectId, private: privateSession }) => {
    if (sessions.size >= 4) throw new Error('Fixture owner limit reached')
    sessionLaunches.push({
      shellId,
      projectId: projectId ?? null,
      private: privateSession
    })
    const id = `fixture-${++sequence}`,
      session = { id, shellId, pid: sequence, state: 'running', exitCode: null }
    sessions.set(id, session)
    emit({ type: 'state', ...session })
    emit({
      type: 'data',
      id,
      sequence: 1,
      data: `\x1b[32mFixture ${id}\x1b[0m 世界\r\nProject: ${projectId ?? 'home'}\r\nsearch match one\r\nsearch match two\r\n`
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
