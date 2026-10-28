import assert from 'node:assert/strict'
import test from 'node:test'
import {
  authorizeSender,
  DOCUMENTATION_URL,
  validateArguments,
  validateExternalUrl,
  validatePackagedArguments
} from '../../src/infrastructure/ipc/policy.ts'

test('IPC schemas reject extra arguments and URLs outside the exact allowlist', () => {
  validateArguments([], 0)
  validateArguments([DOCUMENTATION_URL], 1)
  assert.throws(() => validateArguments([null], 0), /Invalid IPC/)
  assert.throws(() => validateArguments([], 1), /Invalid IPC/)
  assert.throws(
    () => validateArguments([DOCUMENTATION_URL, true], 1),
    /Invalid IPC/
  )
  assert.equal(validateExternalUrl(DOCUMENTATION_URL), DOCUMENTATION_URL)
  for (const url of [
    null,
    {},
    42,
    '',
    'javascript:alert(1)',
    'file:///etc/passwd',
    `${DOCUMENTATION_URL}/issues`,
    `${DOCUMENTATION_URL}?redirect=evil`,
    'https://github.com.evil.test',
    'https://user:pass@github.com/dineshkorukonda/TerminalOne'
  ]) {
    assert.throws(() => validateExternalUrl(url), /not allowed/)
  }
})

test('authorization requires the exact window, main frame, and trusted document', () => {
  const trusted = { sender: {}, frame: {}, url: 'file:///app/index.html' }
  authorizeSender(trusted, trusted)
  for (const actual of [
    { ...trusted, sender: {} },
    { ...trusted, frame: {} },
    { ...trusted, frame: null },
    { ...trusted, url: 'https://evil.test/' },
    { ...trusted, url: `${trusted.url}?other` }
  ]) {
    assert.throws(() => authorizeSender(actual, trusted), /Unauthorized/)
  }
})

test('packaged startup rejects inspector and remote debugging arguments', () => {
  validatePackagedArguments(['app.exe', '--user-data-dir=profile'])
  for (const flag of [
    '--remote-debugging-port=9222',
    '--remote-debugging-pipe',
    '--remote-debugging-address=0.0.0.0',
    '--inspect',
    '--inspect-brk=9229',
    '--inspect-port=9229',
    '--inspect-wait=9229',
    '--inspect-brk-node=9229'
  ]) {
    assert.throws(
      () => validatePackagedArguments(['app.exe', flag]),
      /disabled/
    )
  }
})
