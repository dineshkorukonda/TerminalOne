import assert from 'node:assert/strict'
import { spawnSync } from 'node:child_process'
import { join, resolve } from 'node:path'
import test from 'node:test'

test(
  'installed-app prompt probe rejects old prompts and incomplete command lines',
  { skip: process.platform !== 'win32' },
  () => {
    const script = `
  $ErrorActionPreference='Stop'
  . $env:TERMINAL_PROMPT_PROBE
  if (Test-IdlePowerShellPrompt @()) { throw 'Empty viewport accepted' }
  if (Test-IdlePowerShellPrompt @('PS C:\\work>','BUSY_READY')) { throw 'Historical prompt accepted while command runs' }
  if (Test-IdlePowerShellPrompt @("PS C:\\work> Write-Output 'CTRL_OK'")) { throw 'Echoed command accepted as idle' }
  if (Test-IdlePowerShellPrompt @('PS C:\\work>','output with > arrow')) { throw 'Ordinary output accepted as idle' }
  if (!(Test-IdlePowerShellPrompt @('BUSY_READY','PS C:\\work>','   '))) { throw 'Fresh final prompt rejected' }
  if (!(Test-IdlePowerShellPrompt @('PS C:\\path with spaces> '))) { throw 'Prompt path with spaces rejected' }
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
          TERMINAL_PROMPT_PROBE: resolve('tests/fixtures/powershell-prompt.ps1')
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
