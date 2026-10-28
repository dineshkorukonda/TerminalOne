import assert from 'node:assert/strict'
import test from 'node:test'
import {
  discoverShells,
  selectShell
} from '../../src/infrastructure/shells/discover.ts'

test('shell discovery handles Windows paths, optional shells, stable IDs and argument arrays', async () => {
  const files = new Set([
    'C:\\Windows\\System32\\cmd.exe',
    'C:\\Windows\\System32\\WindowsPowerShell\\v1.0\\powershell.exe',
    'D:\\用户 files\\pwsh.exe',
    'C:\\Program Files\\Git\\bin\\bash.exe'
  ])
  const shells = await discoverShells({
    platform: 'win32',
    env: {
      SystemRoot: 'C:\\Windows',
      Path: '"D:\\用户 files";relative;C:\\other',
      ProgramFiles: 'C:\\Program Files'
    },
    exists: async (path) => files.has(path)
  })
  assert.deepEqual(
    shells.map((shell) => shell.id),
    ['git-bash', 'pwsh', 'powershell', 'cmd']
  )
  assert.equal(shells[1].executable, 'D:\\用户 files\\pwsh.exe')
  assert(shells.every((shell) => Array.isArray(shell.args)))
  assert.deepEqual(shells.find((shell) => shell.id === 'cmd').args, ['/d'])
  assert.equal(selectShell(shells, 'auto').id, 'git-bash')
  assert.throws(() => selectShell(shells, 'missing'), /unavailable/)
})

test('missing optional shells are omitted and CMD is a native fallback', async () => {
  const shells = await discoverShells({
    platform: 'win32',
    env: {},
    exists: async (path) => path === 'C:\\Windows\\System32\\cmd.exe'
  })
  assert.deepEqual(
    shells.map((shell) => shell.id),
    ['cmd']
  )
  assert.equal(
    selectShell(shells, 'auto').executable,
    'C:\\Windows\\System32\\cmd.exe'
  )
  await assert.rejects(discoverShells({ platform: 'linux' }), /Windows ConPTY/)
})
