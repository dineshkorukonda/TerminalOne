import assert from 'node:assert/strict'
import { mkdtemp, mkdir, readFile, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { dirname, join } from 'node:path'
import test from 'node:test'
import { writeRuntime, verifyRuntime } from '../scripts/ci-runtime.mjs'

test('shared CI runtime rejects source, version, output and native-byte mismatches', async (t) => {
  const root = await mkdtemp(join(tmpdir(), 'terminal-ci-runtime-'))
  t.after(() => rm(root, { recursive: true, force: true }))
  const source = 'a'.repeat(40),
    version = '0.2.0-alpha.17'
  const files = [
    'out/main/index.js',
    'native/pty-job-host.exe',
    'node_modules/node-pty/build/Release/conpty.node',
    'shell/blesh/ble.sh'
  ]
  for (const file of files) {
    await mkdir(dirname(join(root, file)), { recursive: true })
    await writeFile(join(root, file), 'synthetic runtime bytes')
  }
  await writeRuntime(root, source, version)
  await verifyRuntime(root, source, version)
  await assert.rejects(
    verifyRuntime(root, 'b'.repeat(40), version),
    /does not match/
  )
  await assert.rejects(
    verifyRuntime(root, source, '0.2.0-alpha.18'),
    /does not match/
  )
  for (const file of files) {
    const original = await readFile(join(root, file))
    await writeFile(join(root, file), 'tampered bytes')
    await assert.rejects(verifyRuntime(root, source, version), /does not match/)
    await writeFile(join(root, file), original)
  }
  await writeFile(join(root, 'out/unexpected.js'), 'extra output')
  await assert.rejects(verifyRuntime(root, source, version), /does not match/)
  await assert.rejects(writeRuntime(root, '../outside', version), /Invalid/)
})

test('desktop workflows wire shared validation and preserve required quality check', async () => {
  const desktop = await readFile('.github/workflows/desktop.yml', 'utf8')
  assert(desktop.includes('name: Desktop quality (Windows)'))
  assert(desktop.includes('uses: ./.github/workflows/desktop-validation.yml'))
  assert(desktop.includes('test "$VALIDATION_RESULT" = success'))

  const alpha = await readFile('.github/workflows/alpha-release.yml', 'utf8')
  assert(alpha.includes('uses: ./.github/workflows/desktop-validation.yml'))
  assert(alpha.includes('alpha: true'))
  assert(
    alpha.includes('RELEASE_VERSION: ${{ needs.validation.outputs.version }}')
  )

  const validation = await readFile(
    '.github/workflows/desktop-validation.yml',
    'utf8'
  )
  assert(validation.includes('desktop-runtime'))
  assert(validation.includes('node scripts/ci-runtime.mjs --write'))
  assert(validation.includes('windows-runtime'))

  const action = await readFile(
    '.github/actions/windows-runtime/action.yml',
    'utf8'
  )
  assert(action.includes('node scripts/ci-runtime.mjs --verify'))
  assert(action.includes('actions/download-artifact'))
})
