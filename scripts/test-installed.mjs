import { spawnSync } from 'node:child_process'
import {
  mkdtemp,
  readdir,
  rm,
  mkdir,
  readFile,
  writeFile
} from 'node:fs/promises'
import { join, resolve } from 'node:path'
import { tmpdir } from 'node:os'

if (process.platform !== 'win32')
  throw new Error('Installed-app verification requires Windows')
if (process.env.CI !== 'true' && !process.argv.includes('--clean-vm'))
  throw new Error(
    'Run installed-app verification in CI or an explicitly selected clean VM (--clean-vm)'
  )
const output = resolve('artifacts/windows')
const installers = (await readdir(output)).filter((name) =>
  /^TerminalOne-.*-unsigned-x64\.exe$/.test(name)
)
if (installers.length !== 1)
  throw new Error('Build exactly one unsigned x64 installer first')
const root = await mkdtemp(join(tmpdir(), 'Terminal One installed 空间-'))
await mkdir('test-results/installer', { recursive: true })
try {
  const result = spawnSync(
    join(
      process.env.SystemRoot,
      'System32/WindowsPowerShell/v1.0/powershell.exe'
    ),
    [
      '-NoLogo',
      '-NoProfile',
      '-ExecutionPolicy',
      'Bypass',
      '-File',
      resolve('tests/fixtures/installed-smoke.ps1'),
      '-Installer',
      join(output, installers[0]),
      '-Root',
      root,
      '-ResultPath',
      resolve('test-results/installer/installed.json')
    ],
    { encoding: 'utf8', timeout: 240000 }
  )
  if (result.error) throw result.error
  if (result.status !== 0) throw new Error(result.stdout + result.stderr)
  const evidence = JSON.parse(
    (await readFile('test-results/installer/installed.json', 'utf8')).replace(
      /^\uFEFF/,
      ''
    )
  )
  await writeFile(
    'test-results/installer/installed.json',
    JSON.stringify(evidence, null, 2)
  )
  console.log(JSON.stringify(evidence))
} finally {
  await rm(root, {
    recursive: true,
    force: true,
    maxRetries: 10,
    retryDelay: 200
  })
}
