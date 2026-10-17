import type { ParentPort } from 'electron'
import { spawn } from 'node-pty'

const parent: ParentPort = process.parentPort
if (!parent) throw new Error('PTY host requires an Electron utility process')
if (process.platform !== 'win32') throw new Error('Windows ConPTY is required')

parent.on('message', ({ data }) => {
  if (data !== 'probe') return
  const executable = `${process.env['SystemRoot'] ?? 'C:\\Windows'}\\System32\\WindowsPowerShell\\v1.0\\powershell.exe`
  const terminal = spawn(executable, ['-NoLogo', '-NoProfile', '-NoExit'], {
    cols: 80,
    rows: 24,
    useConpty: true,
    env: process.env as Record<string, string>
  })
  let output = ''
  terminal.onData((chunk) => {
    output = (output + chunk).slice(-65536)
  })
  terminal.onExit(({ exitCode }) =>
    parent.postMessage({
      exitCode,
      output,
      electron: process.versions.electron,
      modules: process.versions.modules,
      node: process.versions.node
    })
  )
  terminal.write("Write-Output ('PTY_' + 'READY'); exit 0\r")
})
