/* eslint-disable @typescript-eslint/no-require-imports -- Shared CommonJS fixture also runs inside the packaged Electron diagnostic. */
const { spawn } = require('node:child_process')
const path = require('node:path')

// Retain actual process handles before the action, avoiding PID reuse and timing sleeps.
module.exports = async function watchProcesses(pids) {
  if (
    !pids.length ||
    pids.some((pid) => !Number.isSafeInteger(pid) || pid <= 0)
  )
    throw new Error('Invalid process evidence')
  const command = `$ErrorActionPreference='Stop'; $owned=@(${pids.map((pid) => `[Diagnostics.Process]::GetProcessById(${pid})`).join(',')}); foreach($p in $owned){$null=$p.Handle}; [Console]::WriteLine('WAIT_READY'); foreach($p in $owned){if(!$p.WaitForExit(15000)){exit 1}}; exit 0`
  const child = spawn(
    path.join(
      process.env.SystemRoot,
      'System32/WindowsPowerShell/v1.0/powershell.exe'
    ),
    [
      '-NoLogo',
      '-NoProfile',
      '-EncodedCommand',
      Buffer.from(command, 'utf16le').toString('base64')
    ],
    { windowsHide: true, stdio: ['ignore', 'pipe', 'pipe'] }
  )
  let readyResolve, readyReject, doneResolve, doneReject
  const ready = new Promise((resolve, reject) => {
    readyResolve = resolve
    readyReject = reject
  })
  const done = new Promise((resolve, reject) => {
    doneResolve = resolve
    doneReject = reject
  })
  // The action starts after READY, but process exit may race its await.
  done.catch(() => {})
  let output = ''
  child.stdout.on('data', (data) => {
    output += data.toString()
    if (output.includes('WAIT_READY')) readyResolve()
  })
  child.stderr.resume()
  const timer = setTimeout(() => {
    child.kill()
    readyReject(new Error('Process watcher timed out'))
    doneReject(new Error('Owned process survived cleanup'))
  }, 20000)
  child.once('error', (error) => {
    clearTimeout(timer)
    readyReject(error)
    doneReject(error)
  })
  child.once('exit', (code) => {
    clearTimeout(timer)
    if (code === 0) doneResolve()
    else {
      const error = new Error(
        'Owned process survived cleanup or could not be observed'
      )
      readyReject(error)
      doneReject(error)
    }
  })
  await ready
  return { done, cancel: () => child.kill() }
}
