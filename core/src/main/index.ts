import { app, BrowserWindow } from 'electron'
import { join } from 'node:path'
import { existsSync, realpathSync } from 'node:fs'
import { pathToFileURL } from 'node:url'
import { createDesktopWindow } from '../infrastructure/window/create-desktop-window'
import { registerDesktopIpc } from '../infrastructure/ipc/register-desktop-ipc'
import { registerTerminalIpc } from '../infrastructure/ipc/register-terminal-ipc'
import { validatePackagedArguments } from '../infrastructure/ipc/policy'
import { PreferenceRepository } from '../infrastructure/preferences/repository'
import { registerPreferencesIpc } from '../infrastructure/ipc/register-preferences-ipc'
import { registerUpdateIpc } from '../infrastructure/ipc/register-update-ipc'
import { UpdateService } from '../infrastructure/updates/service'
import { createWindowsUpdateBackend } from '../infrastructure/updates/windows-backend'

if (process.platform === 'win32')
  app.setAppUserModelId('com.github.dineshkorukonda.terminalone')

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
let updates: UpdateService
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
    iconPath: join(
      app.isPackaged ? process.resourcesPath : join(app.getAppPath(), 'assets'),
      'branding',
      process.platform === 'win32' ? 'terminal-one.ico' : 'terminal-one.png'
    ),
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
  const disposeUpdates = registerUpdateIpc(
    window,
    rendererUrl ? new URL(rendererUrl).href : pathToFileURL(rendererPath).href,
    updates
  )
  terminalDisposers.add(disposeTerminal)
  window.once('closed', () => {
    dispose()
    disposePreferences()
    disposeUpdates()
    void disposeTerminal().finally(() =>
      terminalDisposers.delete(disposeTerminal)
    )
  })
}

app.whenReady().then(async () => {
  await preferences.load()
  const supported =
    app.isPackaged &&
    process.platform === 'win32' &&
    process.arch === 'x64' &&
    existsSync(join(process.resourcesPath, 'app-update.yml'))
  updates = new UpdateService(
    supported ? createWindowsUpdateBackend() : null,
    app.getVersion(),
    async () => {
      await Promise.all([...terminalDisposers].map((dispose) => dispose()))
      await preferences.flush()
      quitting = true
    }
  )
  if (supported) {
    const firstCheck = setTimeout(() => {
      void updates.check()
    }, 15000)
    const repeatCheck = setInterval(
      () => {
        void updates.check()
      },
      6 * 60 * 60 * 1000
    )
    firstCheck.unref()
    repeatCheck.unref()
    app.once('quit', () => {
      clearTimeout(firstCheck)
      clearInterval(repeatCheck)
      updates.dispose()
    })
  }
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
