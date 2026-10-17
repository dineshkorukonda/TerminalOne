import { app, BrowserWindow } from 'electron'
import { join } from 'node:path'

function createWindow(): void {
  const window = new BrowserWindow({
    width: 1000,
    height: 680,
    minWidth: 640,
    minHeight: 420,
    title: 'Terminal One',
    backgroundColor: '#111318',
    show: false,
    webPreferences: {
      preload: join(__dirname, '../preload/index.js'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true,
      webSecurity: true,
      webviewTag: false
    }
  })

  window.once('ready-to-show', () => window.show())
  window.webContents.setWindowOpenHandler(() => ({ action: 'deny' }))
  window.webContents.on('will-navigate', (event) => event.preventDefault())
  window.webContents.on('will-attach-webview', (event) =>
    event.preventDefault()
  )
  window.webContents.session.setPermissionRequestHandler(
    (_webContents, _permission, callback) => callback(false)
  )
  window.webContents.session.setPermissionCheckHandler(() => false)

  if (!app.isPackaged && process.env['ELECTRON_RENDERER_URL']) {
    void window.loadURL(process.env['ELECTRON_RENDERER_URL'])
  } else {
    void window.loadFile(join(__dirname, '../renderer/index.html'))
  }
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
