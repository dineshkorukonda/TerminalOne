/* eslint-disable @typescript-eslint/no-require-imports -- The packaged Electron diagnostic uses a synchronous CommonJS bootstrap. */
const { app } = require('electron')
const path = require('node:path')
const fs = require('node:fs')
const root = app.isPackaged
  ? app.getAppPath()
  : path.resolve(__dirname, '../..')
const timer = setTimeout(() => {
  console.error('Native PTY probe timed out')
  app.exit(1)
}, 30000)
app.whenReady().then(async () => {
  const { UtilityPtyPort } = require(path.join(root, 'out/main/pty-client.js'))
  const port = new UtilityPtyPort()
  let output = ''
  let handle
  const early = []
  let exitResolve
  let exitReject
  const exited = new Promise((resolve, reject) => {
    exitResolve = resolve
    exitReject = reject
  })
  port.onFailure(() => exitReject(new Error('PTY host failed')))
  try {
    handle = await port.start(
      'native-probe',
      {
        id: 'powershell',
        name: 'PowerShell',
        executable: path.join(
          process.env.SystemRoot,
          'System32/WindowsPowerShell/v1.0/powershell.exe'
        ),
        args: ['-NoLogo', '-NoProfile', '-NoExit']
      },
      process.cwd(),
      { cols: 80, rows: 24 },
      (event) => {
        if (event.type === 'data') {
          output = (output + event.data).slice(-65536)
          if (handle) void handle.acknowledge(event.sequence)
          else early.push(event.sequence)
        }
        if (event.type === 'exit') exitResolve(event.exitCode)
        if (event.type === 'error') exitReject(new Error(event.message))
      }
    )
    await Promise.all(early.map((sequence) => handle.acknowledge(sequence)))
    await handle.write("Write-Output ('PTY_' + 'READY'); exit 0\r")
    const code = await exited
    const passed = code === 0 && output.includes('PTY_READY')
    const evidence = {
      passed,
      electron: process.versions.electron,
      modules: process.versions.modules,
      node: process.versions.node,
      packaged: app.isPackaged,
      pid: handle.pid
    }
    if (process.env.PTY_PROBE_RESULT)
      fs.writeFileSync(process.env.PTY_PROBE_RESULT, JSON.stringify(evidence))
    console.log(JSON.stringify(evidence))
    await port.dispose()
    clearTimeout(timer)
    app.exit(passed ? 0 : 1)
  } catch (error) {
    console.error(error.message)
    await port.dispose().catch(() => {})
    app.exit(1)
  }
})
