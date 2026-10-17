import packager from '@electron/packager'
import { copyFile, readFile, writeFile, mkdir } from 'node:fs/promises'
import { spawnSync } from 'node:child_process'
import { join } from 'node:path'

if (process.platform !== 'win32')
  throw new Error('Packaged ConPTY verification requires Windows')
const { version } = JSON.parse(
  await readFile('node_modules/electron/package.json', 'utf8')
)
const [directory] = await packager({
  dir: '.',
  out: 'artifacts/native-probe',
  name: 'TerminalNativeProbe',
  platform: 'win32',
  arch: 'x64',
  electronVersion: version,
  overwrite: true,
  prune: true,
  asar: { unpack: '**/node-pty/**' },
  ignore: [
    /^\/website(?:\/|$)/,
    /^\/artifacts(?:\/|$)/,
    /^\/test-results(?:\/|$)/,
    /^\/\.git(?:\/|$)/
  ],
  afterCopy: [
    async (buildPath) => {
      await copyFile(
        'tests/fixtures/native-probe.cjs',
        join(buildPath, 'native-probe.cjs')
      )
      const file = join(buildPath, 'package.json')
      const metadata = JSON.parse(await readFile(file, 'utf8'))
      metadata.main = 'native-probe.cjs'
      await writeFile(file, JSON.stringify(metadata))
    }
  ]
})
await mkdir('test-results/native', { recursive: true })
const result = spawnSync(join(directory, 'TerminalNativeProbe.exe'), [], {
  timeout: 45000,
  env: {
    ...process.env,
    PTY_PROBE_RESULT: join(process.cwd(), 'test-results/native/packaged.json')
  },
  encoding: 'utf8'
})
if (result.error) throw result.error
if (result.status !== 0) throw new Error(result.stdout + result.stderr)
console.log(await readFile('test-results/native/packaged.json', 'utf8'))
