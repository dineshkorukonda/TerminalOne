import { app, BrowserWindow } from 'electron'
import { join } from 'node:path'
import { pathToFileURL } from 'node:url'
import { createDesktopWindow } from '../infrastructure/window/create-desktop-window'
import { registerDesktopIpc } from '../infrastructure/ipc/register-desktop-ipc'
import { validatePackagedArguments } from '../infrastructure/ipc/policy'

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

function createWindow(): void {
  const rendererUrl = !app.isPackaged
    ? process.env['ELECTRON_RENDERER_URL']
    : undefined
  if (rendererUrl && new URL(rendererUrl).href !== 'http://127.0.0.1:5173/') {
    throw new Error('Unexpected development renderer URL')
  }
  const rendererPath = join(__dirname, '../renderer/index.html')
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
  window.once('closed', dispose)
}

app.whenReady().then(() => {
  createWindow()
  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow()
  })
})

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit()
})
