import { app, BrowserWindow } from 'electron'
import { join } from 'node:path'
import { createDesktopWindow } from '../infrastructure/window/create-desktop-window'

function createWindow(): void {
  const rendererUrl = !app.isPackaged && process.env['ELECTRON_RENDERER_URL']
  createDesktopWindow({
    preloadPath: join(__dirname, '../preload/index.js'),
    content: rendererUrl
      ? { url: rendererUrl }
      : { filePath: join(__dirname, '../renderer/index.html') }
  })
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
