import assert from 'node:assert/strict'
import test from 'node:test'
import { execFileSync } from 'node:child_process'
import { mkdtemp, mkdir, cp, readFile, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { shellResources } from '../scripts/shell-resources.mjs'

test('clean shell preparation includes the actual pinned editor and redistributed licenses', async (t) => {
  const root = await mkdtemp(join(tmpdir(), 'terminal-shell-resources-'))
  t.after(() => rm(root, { recursive: true, force: true }))
  for (const directory of ['scripts', 'vendor', 'shell'])
    await mkdir(join(root, directory))
  for (const file of [
    'scripts/prepare-shell.mjs',
    'scripts/shell-resources.mjs',
    'vendor/ble.tar.xz',
    'shell/bashrc',
    'shell/adapters.bash'
  ])
    await cp(file, join(root, file))
  execFileSync(process.execPath, ['scripts/prepare-shell.mjs'], { cwd: root })
  for (const file of shellResources)
    assert((await readFile(join(root, 'shell', file))).length > 0)
  const license = await readFile(
    join(root, 'shell/blesh/licenses/LICENSE.md'),
    'utf8'
  )
  assert(license.includes('Redistribution and use'))
})
