import { spawnSync } from 'node:child_process'
import { fileURLToPath } from 'node:url'

const title = process.env['PR_TITLE']
if (!title || /[\r\n]/u.test(title))
  throw new Error('Provide a single-line PR_TITLE')
const root = fileURLToPath(new URL('../', import.meta.url))
const result = spawnSync(
  process.execPath,
  [
    fileURLToPath(
      new URL('../node_modules/@commitlint/cli/cli.js', import.meta.url)
    ),
    '--config',
    'commitlint.title.config.mjs'
  ],
  {
    cwd: root,
    input: title,
    stdio: ['pipe', 'inherit', 'inherit']
  }
)
if (result.error) throw result.error
process.exitCode = result.status ?? 1
