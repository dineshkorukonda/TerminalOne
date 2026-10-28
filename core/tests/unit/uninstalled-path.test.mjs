import assert from 'node:assert/strict'
import { spawnSync } from 'node:child_process'
import { join, resolve } from 'node:path'
import test from 'node:test'

test(
  'uninstall probe retries denied queries without treating errors as absence',
  {
    skip: process.platform !== 'win32'
  },
  () => {
    const script = `
    $ErrorActionPreference = 'Stop'
    . $env:TERMINAL_UNINSTALL_PROBE
    if (Test-UninstalledPath $env:TERMINAL_UNINSTALL_PROBE) { throw 'Existing file reported absent' }
    $missing = Join-Path $env:TEMP ([Guid]::NewGuid().ToString() + '.exe')
    if (!(Test-UninstalledPath $missing)) { throw 'Missing file not recognized' }
    function Test-Path { throw [UnauthorizedAccessException]::new('Synthetic deletion in progress') }
    if (Test-UninstalledPath $missing) { throw 'Access denied reported as absence' }
    function Test-Path { return $false }
    if (!(Test-UninstalledPath $missing)) { throw 'Successful retry not recognized' }
    function Test-Path { throw [InvalidOperationException]::new('Synthetic unexpected failure') }
    $propagated = $false
    try { Test-UninstalledPath $missing } catch [InvalidOperationException] { $propagated = $true }
    if (!$propagated) { throw 'Unexpected error suppressed' }
  `
    const result = spawnSync(
      join(
        process.env.SystemRoot,
        'System32/WindowsPowerShell/v1.0/powershell.exe'
      ),
      [
        '-NoLogo',
        '-NoProfile',
        '-EncodedCommand',
        Buffer.from(script, 'utf16le').toString('base64')
      ],
      {
        env: {
          ...process.env,
          TERMINAL_UNINSTALL_PROBE: resolve(
            'tests/fixtures/uninstalled-path.ps1'
          )
        },
        encoding: 'utf8',
        timeout: 15000,
        windowsHide: true
      }
    )
    assert.ifError(result.error)
    assert.equal(result.status, 0, result.stdout + result.stderr)
  }
)
