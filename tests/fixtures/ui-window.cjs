/* eslint-disable @typescript-eslint/no-require-imports -- Electron fixture entry and sandbox preload are CommonJS. */
const { app, BrowserWindow } = require('electron')
const path = require('node:path')
app
  .whenReady()
  .then(async () => {
    const window = new BrowserWindow({
      width: 1000,
      height: 680,
      minWidth: 640,
      minHeight: 420,
      webPreferences: {
        sandbox: true,
        contextIsolation: true,
        nodeIntegration: false,
        preload: path.join(__dirname, 'ui-preload.cjs')
      }
    })
    if (process.env.UI_FIXTURE_RENDERER_URL)
      await window.loadURL(process.env.UI_FIXTURE_RENDERER_URL)
    else
      await window.loadFile(
        path.join(__dirname, '../../out/renderer/index.html')
      )
  })
  .catch((error) => {
    console.error('UI fixture navigation failed:', error.message)
    app.exit(1)
  })
app.on('window-all-closed', () => app.quit())
