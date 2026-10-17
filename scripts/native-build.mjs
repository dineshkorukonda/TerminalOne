import { rebuild } from '@electron/rebuild'
import { readFile } from 'node:fs/promises'

if (process.platform !== 'win32')
  throw new Error('Native ConPTY verification requires Windows')
const { version } = JSON.parse(
  await readFile(
    new URL('../node_modules/electron/package.json', import.meta.url)
  )
)
await rebuild({
  buildPath: process.cwd(),
  electronVersion: version,
  force: true,
  onlyModules: ['node-pty']
})

const { spawnSync } = await import('node:child_process')
const { join } = await import('node:path')
const compiler = join(
  process.env['SystemRoot'] ?? 'C:\\Windows',
  'Microsoft.NET/Framework64/v4.0.30319/csc.exe'
)
const compiled = spawnSync(
  compiler,
  [
    '/nologo',
    '/target:exe',
    '/platform:x64',
    `/out:${join(process.cwd(), 'native', 'pty-job-host.exe')}`,
    join(process.cwd(), 'native', 'PtyJobHost.cs')
  ],
  { stdio: 'inherit' }
)
if (compiled.error) throw compiled.error
if (compiled.status !== 0)
  throw new Error('Windows process-owner compilation failed')
