import { app, BrowserWindow } from 'electron'
import { join } from 'node:path'
import { realpathSync } from 'node:fs'
import { pathToFileURL } from 'node:url'
import { createDesktopWindow } from '../infrastructure/window/create-desktop-window'
import { registerDesktopIpc } from '../infrastructure/ipc/register-desktop-ipc'
import { registerTerminalIpc } from '../infrastructure/ipc/register-terminal-ipc'
import { validatePackagedArguments } from '../infrastructure/ipc/policy'
import { PreferenceRepository } from '../infrastructure/preferences/repository'
import { registerPreferencesIpc } from '../infrastructure/ipc/register-preferences-ipc'

if (app.isPackaged) {
  try {
    validatePackagedArguments(process.argv)
    if (process.env['NODE_OPTIONS']) {
      throw new Error('NODE_OPTIONS is disabled in packaged builds')
    }
  } catch (error) {
    console.error(
      error instanceof Error ? error.message : 'Invalid packaged runtime'
    )
    app.exit(1)
  }
}

const terminalDisposers = new Set<() => Promise<void>>()
let quitting = false
const preferences = new PreferenceRepository(
  join(app.getPath('userData'), 'developer-data')
)

function createWindow(): void {
  const rendererUrl = !app.isPackaged
    ? process.env['ELECTRON_RENDERER_URL']
    : undefined
  if (rendererUrl && new URL(rendererUrl).href !== 'http://127.0.0.1:5173/') {
    throw new Error('Unexpected development renderer URL')
  }
  // Authorize the same canonical file that Chromium loads, including when
  // Windows supplies a DOS alias for a Unicode installation directory.
  const rendererFile = join(__dirname, '../renderer/index.html')
  const rendererPath = rendererUrl
    ? rendererFile
    : realpathSync.native(rendererFile)
  const window = createDesktopWindow({
    preloadPath: join(__dirname, '../preload/index.js'),
    allowDevTools: !app.isPackaged,
    content: rendererUrl ? { url: rendererUrl } : { filePath: rendererPath }
  })
  const dispose = registerDesktopIpc(
    window,
    rendererUrl ? new URL(rendererUrl).href : pathToFileURL(rendererPath).href,
    {
      name: 'Terminal One',
      version: app.getVersion()
    }
  )
  const disposeTerminal = registerTerminalIpc(
    window,
    rendererUrl ? new URL(rendererUrl).href : pathToFileURL(rendererPath).href,
    preferences,
    join(
      app.isPackaged ? process.resourcesPath : app.getAppPath(),
      'shell/bashrc'
    )
  )
  const disposePreferences = registerPreferencesIpc(
    window,
    rendererUrl ? new URL(rendererUrl).href : pathToFileURL(rendererPath).href,
    preferences
  )
  terminalDisposers.add(disposeTerminal)
  window.once('closed', () => {
    dispose()
    disposePreferences()
    void disposeTerminal().finally(() =>
      terminalDisposers.delete(disposeTerminal)
    )
  })
}

app.whenReady().then(async () => {
  await preferences.load()
  createWindow()
  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow()
  })
})

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit()
})

app.on('before-quit', (event) => {
  if (quitting) return
  event.preventDefault()
  quitting = true
  void Promise.allSettled([...terminalDisposers].map((dispose) => dispose()))
    .then(() => preferences.flush())
    .then(() => app.quit())
})
