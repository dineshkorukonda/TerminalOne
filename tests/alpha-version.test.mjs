import assert from 'node:assert/strict'
import test from 'node:test'
import { alphaVersion } from '../scripts/alpha-version.mjs'

test('alpha versions are unique per workflow run and stable across retries', () => {
  assert.equal(alphaVersion('0.2.0-alpha.0', '17'), '0.2.0-alpha.17')
  assert.equal(alphaVersion('0.2.0-alpha.17', '17'), '0.2.0-alpha.17')
  assert.equal(alphaVersion('0.2.0-alpha.0', '18'), '0.2.0-alpha.18')
  for (const invalid of ['0', '-1', '1.2', '1;echo', undefined])
    assert.throws(() => alphaVersion('0.2.0-alpha.0', invalid))
  assert.throws(() => alphaVersion('0.2.0-beta.1', '17'))
})
