import assert from 'node:assert/strict'
import test from 'node:test'
import {
  createAdapter,
  createAdapterRegistry
} from '../src/domain/shell-adapter/recognizers.ts'
const context = { aliasesKnown: true, integration: 'ready' }
for (const [family, positive] of [
  [
    'powershell',
    [
      'Get-ChildItem "C:\\space path\\世界"',
      'Write-Output "hello"',
      '$env:TEST=value',
      'Set-Location C:\\Test'
    ]
  ],
  ['cmd', ['dir /b', 'set NAME=value', 'setlocal', 'echo %PATH%']],
  [
    'bash',
    [
      'export NAME=value',
      'source ./profile.sh',
      'NAME=value',
      'NAME=value command'
    ]
  ]
]) {
  test(`${family} recognizes only narrow positive forms without changing input`, () => {
    const adapter = createAdapter(family)
    for (const input of positive) {
      const result = adapter.analyze(input, context)
      assert.equal(result.kind, 'recognized', input)
      assert.equal(result.input, input)
      assert.equal(result.evidence[0].family, family)
      assert.equal(
        adapter.analyze(input, { ...context, aliasesKnown: false }).kind,
        'unknown'
      )
    }
    for (const input of [
      'dir',
      'cd ..',
      'echo hello',
      '"Get-ChildItem"',
      "'export NAME=value'",
      'Get-ChildItem | sort',
      'export A=1; command',
      'function test {}',
      'Get-Item "unfinished',
      'script.ps1\nother',
      'echo $(command)',
      ''
    ]) {
      assert.equal(adapter.analyze(input, context).kind, 'unknown', input)
    }
  })
}
test('registry reports conflicting evidence and preserves arbitrary command bytes', () => {
  const input = '\tGet-ChildItem "世界"  '
  const registry = createAdapterRegistry()
  assert.equal(registry.analyze(input, context).input, input)
  const conflict = createAdapterRegistry([
    createAdapter('powershell'),
    {
      family: 'bash',
      analyze: (value) => ({
        input: value,
        kind: 'recognized',
        evidence: [{ family: 'bash', form: 'test' }],
        stateful: false,
        reason: 'supported-form'
      })
    }
  ])
  assert.equal(conflict.analyze(input, context).kind, 'ambiguous')
  assert.equal(
    registry.analyze(input, { aliasesKnown: false, integration: 'unavailable' })
      .reason,
    'context-unverified'
  )
})
