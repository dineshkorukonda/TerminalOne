import assert from 'node:assert/strict'
import { randomUUID } from 'node:crypto'
import { writeFile, rm } from 'node:fs/promises'
import { join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { spawnSync } from 'node:child_process'
import test from 'node:test'

const root = fileURLToPath(new URL('../../', import.meta.url))

test('configured lint and typecheck commands reject actual violations', async () => {
  const fixture = join(root, 'src/main', `__quality_probe_${randomUUID()}.ts`)
  const npm = process.env['npm_execpath']
  assert(npm, 'Run this check through npm run test:unit')
  try {
    await writeFile(fixture, 'export const unsafe: any = 1\n')
    const lint = spawnSync(process.execPath, [npm, 'run', 'lint'], {
      cwd: root,
      encoding: 'utf8'
    })
    assert.notEqual(lint.status, 0)
    assert.match(lint.stdout + lint.stderr, /no-explicit-any/)
    await writeFile(fixture, 'export const value: string = 1\n')
    const types = spawnSync(process.execPath, [npm, 'run', 'typecheck'], {
      cwd: root,
      encoding: 'utf8'
    })
    assert.notEqual(types.status, 0)
    assert.match(types.stdout + types.stderr, /TS2322/)
  } finally {
    await rm(fixture, { force: true })
  }
})
