import assert from 'node:assert/strict'
import test from 'node:test'
import { ShellStateTracker } from '../../src/application/shell-adapter/state.ts'
import { resolveExecution } from '../../src/application/shell-adapter/resolve.ts'
import { createAdapterRegistry } from '../../src/domain/shell-adapter/recognizers.ts'
const capabilities = [
  { id: 'powershell', family: 'powershell', available: true },
  { id: 'cmd', family: 'cmd', available: true },
  { id: 'git-bash', family: 'bash', available: false }
]
const registry = createAdapterRegistry(),
  context = { aliasesKnown: true, integration: 'ready' }
const analyze = (input) => registry.analyze(input, context)
function fixture() {
  const producer = {},
    tracker = new ShellStateTracker(producer)
  tracker.register('a', 'powershell')
  tracker.register('b', 'cmd')
  tracker.observe(producer, 'a', {
    sequence: 1,
    cwd: 'C:\\space path\\世界',
    environmentRevision: 'revision-1',
    exitCode: 7
  })
  return { tracker, producer }
}
test('state observations require the trusted producer and preserve session isolation without secrets', () => {
  const { tracker, producer } = fixture()
  assert.equal(tracker.get('a').cwd, 'C:\\space path\\世界')
  assert.equal(tracker.get('b').cwd, null)
  assert.throws(() => tracker.observe({}, 'a', { sequence: 2 }), /Untrusted/)
  for (const cwd of ['relative', 'C:relative', 'C:\\bad\npath', '\\\\server'])
    assert.throws(() =>
      tracker.observe(producer, 'a', {
        sequence: 2,
        cwd,
        environmentRevision: 'two',
        exitCode: 0
      })
    )
  tracker.observe(producer, 'a', {
    sequence: 2,
    cwd: '\\\\server\\share\\日本語',
    environmentRevision: 'two',
    exitCode: 0,
    environment: { TOKEN: 'secret' }
  })
  assert(!JSON.stringify(tracker.get('a')).includes('secret'))
  assert.throws(
    () => tracker.observe(producer, 'a', { sequence: 2 }),
    /Invalid/
  )
  const copy = tracker.get('a')
  copy.cwd = 'mutated'
  assert.notEqual(tracker.get('a').cwd, 'mutated')
  tracker.fail('a')
  assert.equal(tracker.get('a').cwd, null)
  assert.equal(tracker.get('a').integration, 'failed')
  tracker.close('a')
  assert.throws(() => tracker.get('a'))
})
test('resolution preserves bytes, keeps interactive input attached, and requires explicit shell selection', () => {
  const { tracker } = fixture(),
    state = tracker.get('a')
  for (const input of [
    'dir',
    'cd ..',
    'Get-ChildItem | sort',
    'echo "unfinished',
    'script\r\nnext'
  ]) {
    const result = resolveExecution(analyze(input), state, capabilities)
    assert.equal(result.type, 'active-shell')
    assert.equal(result.shellId, 'powershell')
    assert.equal(result.command, input)
  }
  assert.equal(
    resolveExecution(analyze('dir /b'), state, capabilities).type,
    'requires-selection'
  )
  assert.equal(
    resolveExecution(analyze('export NAME=value'), state, capabilities).reason,
    'target-unavailable'
  )
  assert.equal(
    resolveExecution(analyze('Write-Output "hello"'), state, capabilities)
      .reason,
    'active-default'
  )
  assert.equal(
    resolveExecution(
      analyze('dir /b'),
      { ...state, atPrompt: false },
      capabilities
    ).reason,
    'interactive-attached'
  )
  assert.equal(
    resolveExecution(
      analyze('dir /b'),
      { ...state, integration: 'failed' },
      capabilities
    ).reason,
    'integration-unavailable'
  )
  assert.equal(
    resolveExecution(analyze('dir /b'), state, capabilities, 'cmd').reason,
    'state-isolated'
  )
  assert.equal(
    resolveExecution(analyze('dir /b'), state, capabilities, 'missing').type,
    'unavailable'
  )
  assert.equal(
    resolveExecution(analyze('dir /b'), state, capabilities, 'powershell')
      .reason,
    'explicit-same-shell'
  )
})
