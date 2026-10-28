import assert from 'node:assert/strict'
import { spawnSync } from 'node:child_process'
import { randomUUID } from 'node:crypto'
import { mkdtemp, writeFile, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join, delimiter } from 'node:path'
import { fileURLToPath } from 'node:url'
import test from 'node:test'

const root = fileURLToPath(new URL('../../', import.meta.url))
const cli = join(root, 'node_modules/@commitlint/cli/cli.js')
const run = (command, args, options = {}) =>
  spawnSync(command, args, { cwd: root, encoding: 'utf8', ...options })

test('commit policy accepts conventional bodies and rejects invalid or empty messages', () => {
  const valid =
    'feat(desktop): add a named capability\n\nAuthorize each request before reading application data.\n\nRefs #5\n'
  assert.equal(run(process.execPath, [cli], { input: valid }).status, 0)
  for (const message of [
    'update things',
    'feat(desktop): add capability',
    valid.replace('Refs #5', ''),
    valid.replace(
      'Authorize each request before reading application data.',
      'tiny'
    )
  ]) {
    assert.notEqual(run(process.execPath, [cli], { input: message }).status, 0)
  }
  for (const [title, expected] of [
    ['chore(ci): add Windows checks', 0],
    ['update stuff', 1]
  ]) {
    const result = run(process.execPath, ['scripts/check-pr-title.mjs'], {
      env: { ...process.env, PR_TITLE: title }
    })
    assert.equal(result.status === 0 ? 0 : 1, expected)
  }
})

test('lint-staged checks a controlled alternate index and rejects a staged violation', async () => {
  const directory = await mkdtemp(join(tmpdir(), 'terminal-index-'))
  const fixture = join(root, `__staged_probe_${randomUUID()}.mjs`)
  const env = {
    ...process.env,
    GIT_INDEX_FILE: join(directory, 'index'),
    PATH: `${join(root, 'node_modules/.bin')}${delimiter}${process.env['PATH']}`
  }
  try {
    assert.equal(run('git', ['read-tree', 'HEAD'], { env }).status, 0)
    await writeFile(fixture, 'export const value = 1\n')
    assert.equal(run('git', ['add', '--', fixture], { env }).status, 0)
    const args = [
      'node_modules/lint-staged/bin/lint-staged.js',
      '--no-stash',
      '--config',
      'lint-staged.config.mjs'
    ]
    const valid = run(process.execPath, args, { env })
    assert.equal(valid.status, 0, valid.stdout + valid.stderr)
    await writeFile(fixture, 'const unused = 1\n')
    assert.equal(run('git', ['add', '--', fixture], { env }).status, 0)
    const invalid = run(process.execPath, args, { env })
    assert.notEqual(invalid.status, 0)
    assert.match(invalid.stdout + invalid.stderr, /no-unused-vars/)
  } finally {
    await rm(fixture, { force: true })
    await rm(directory, { recursive: true, force: true })
  }
})
