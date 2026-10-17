/* eslint-disable @typescript-eslint/no-require-imports -- The packaged Electron diagnostic uses a synchronous CommonJS bootstrap. */
const { app, utilityProcess } = require('electron')
const path = require('node:path')
const fs = require('node:fs')
const root = app.isPackaged
  ? app.getAppPath()
  : path.resolve(__dirname, '../..')
const timer = setTimeout(() => {
  console.error('Native PTY probe timed out')
  app.exit(1)
}, 30000)
app.whenReady().then(() => {
  const host = utilityProcess.fork(
    path.join(root, 'out/main/pty-host.js'),
    [],
    { stdio: 'pipe' }
  )
  host.stderr.on('data', (data) => process.stderr.write(data))
  host.once('spawn', () => host.postMessage('probe'))
  host.once('message', (result) => {
    clearTimeout(timer)
    const valid =
      result.exitCode === 0 &&
      result.output.includes('PTY_READY') &&
      result.electron === '44.9.0'
    const evidence = {
      passed: valid,
      electron: result.electron,
      modules: result.modules,
      node: result.node,
      packaged: app.isPackaged
    }
    if (process.env.PTY_PROBE_RESULT)
      fs.writeFileSync(process.env.PTY_PROBE_RESULT, JSON.stringify(evidence))
    console.log(JSON.stringify(evidence))
    host.kill()
    app.exit(valid ? 0 : 1)
  })
  host.once('exit', (code) => {
    if (code !== 0) {
      console.error('PTY utility exited unexpectedly')
      app.exit(1)
    }
  })
})
