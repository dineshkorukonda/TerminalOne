/* eslint-disable @typescript-eslint/no-require-imports -- Controlled sandboxed renderer fixture; never bundled in production preload. */
const { contextBridge } = require('electron')
let sequence = 0,
  clipboard = ''
const listeners = new Set(),
  sessions = new Map()
const emit = (event) => {
  for (const listener of listeners) listener(event)
}
contextBridge.exposeInMainWorld('desktop', {
  getAppInfo: async () => ({ name: 'Terminal One', version: '0.1.0' }),
  openExternal: async () => {},
  listShells: async () => [
    { id: 'powershell', name: 'PowerShell fixture' },
    { id: 'cmd', name: 'CMD fixture' }
  ],
  createSession: async ({ shellId }) => {
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
