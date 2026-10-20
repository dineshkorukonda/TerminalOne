import { BrowserWindow } from 'electron'
import { pathToFileURL } from 'node:url'

interface DesktopWindowOptions {
  preloadPath: string
  allowDevTools: boolean
  iconPath: string
  content: { url: string } | { filePath: string }
}

export function createDesktopWindow(
  options: DesktopWindowOptions
): BrowserWindow {
  const window = new BrowserWindow({
    width: 1000,
    height: 680,
    minWidth: 640,
    minHeight: 420,
    title: 'Terminal One',
    icon: options.iconPath,
    autoHideMenuBar: true,
    backgroundColor: '#0c0c0c',
    ...(process.platform === 'win32'
      ? {
          titleBarStyle: 'hidden' as const,
          titleBarOverlay: {
            color: '#202020',
            symbolColor: '#cccccc',
            height: 40
          }
        }
      : {}),
    show: false,
    webPreferences: {
      preload: options.preloadPath,
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true,
      webSecurity: true,
      webviewTag: false,
      devTools: options.allowDevTools
    }
  })

  // The terminal owns its shortcuts. A hidden default menu still registers
  // accelerators such as Ctrl+Shift+W and can close the whole window.
  if (process.platform !== 'darwin') window.setMenu(null)

  window.once('ready-to-show', () => window.show())
  window.webContents.setWindowOpenHandler(() => ({ action: 'deny' }))
  window.webContents.on('will-navigate', (event) => event.preventDefault())
  window.webContents.on('will-frame-navigate', (event) =>
    event.preventDefault()
  )
  window.webContents.on('will-redirect', (event) => event.preventDefault())
  window.webContents.on('will-attach-webview', (event) =>
    event.preventDefault()
  )
  window.webContents.session.setPermissionRequestHandler(
    (_webContents, _permission, callback) => callback(false)
  )
  window.webContents.session.setPermissionCheckHandler(() => false)

  if ('url' in options.content) {
    void window.loadURL(options.content.url)
  } else {
    // Use the same WHATWG file URL encoding as IPC authorization. loadFile's
    // legacy formatter can leave literal percent characters unescaped.
    void window.loadURL(pathToFileURL(options.content.filePath).href)
  }

  return window
}
