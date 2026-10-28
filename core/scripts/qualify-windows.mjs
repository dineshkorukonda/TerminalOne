import { spawnSync, execFileSync } from 'node:child_process'
import { readFile, writeFile, mkdir } from 'node:fs/promises'
import { join } from 'node:path'
import { release } from 'node:os'

if (process.platform !== 'win32' || process.arch !== 'x64')
  throw new Error('Client Windows x64 is required')
const powershell = join(
  process.env.SystemRoot,
  'System32/WindowsPowerShell/v1.0/powershell.exe'
)
const type = execFileSync(
  powershell,
  [
    '-NoProfile',
    '-Command',
    "Import-Module (Join-Path $PSHOME 'Modules\\CimCmdlets\\CimCmdlets.psd1') -ErrorAction Stop; (Get-CimInstance Win32_OperatingSystem).ProductType"
  ],
  { encoding: 'utf8' }
).trim()
if (type !== '1')
  throw new Error(
    'Windows Server is not Windows 10/11 client qualification evidence'
  )
const build = Number(release().split('.')[2])
if (build < 19045)
  throw new Error('Qualification targets Windows 10 22H2 or Windows 11 x64')
if (!process.argv.includes('--clean-vm'))
  throw new Error('Use a dedicated clean VM and --clean-vm')
const result = spawnSync(
  process.execPath,
  ['scripts/test-installed.mjs', '--clean-vm'],
  { stdio: 'inherit', timeout: 300000 }
)
if (result.error) throw result.error
if (result.status !== 0)
  throw new Error('Client Windows installed-app qualification failed')
const installed = JSON.parse(
  (await readFile('test-results/installer/installed.json', 'utf8')).replace(
    /^\uFEFF/,
    ''
  )
)
await mkdir('test-results/qualification', { recursive: true })
await writeFile(
  `test-results/qualification/windows-${build >= 22000 ? '11' : '10'}.json`,
  JSON.stringify(
    {
      os: release(),
      productType: Number(type),
      arch: process.arch,
      source: execFileSync('git', ['rev-parse', 'HEAD'], {
        encoding: 'utf8'
      }).trim(),
      installed,
      manualIme: 'not-run',
      manualNarrator: 'not-run'
    },
    null,
    2
  )
)
console.log(
  'Actual client Windows installer evidence recorded. Manual IME/Narrator remain separate checks.'
)
