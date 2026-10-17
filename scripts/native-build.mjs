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
