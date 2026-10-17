import test from 'node:test'
import assert from 'node:assert/strict'
import { historyIntegration } from '../src/infrastructure/shells/history-integration.ts'

test('complete-command integration strips split frames, preserves raw output and rejects forged or invalid payloads', () => {
  const commands = []
  let ready = 0
  const integration = historyIntegration(
    (command) => commands.push(command),
    () => ready++
  )
  const script = Buffer.from(integration.encoded, 'base64').toString('utf16le')
  const nonce = script.match(/\]777;T1;([a-f0-9]+);C;/)[1]
  assert(script.includes('HistorySaveStyle SaveNothing'))
  assert(script.includes('AddToHistoryHandler'))
  const value = "Write-Output '世界'\nGet-Location"
  const frame = `\x1b]777;T1;${nonce};C;${Buffer.from(value).toString('base64')}\x07`
  let rendered = ''
  for (const char of `before\x1b]777;T1;${nonce};R;\x07${frame}after`)
    rendered += integration.feed(char)
  assert.equal(rendered, 'beforeafter')
  assert.deepEqual(commands, [value])
  assert.equal(ready, 1)
  const forged = '\x1b]777;T1;wrong;C;AAAA\x07'
  assert.equal(integration.feed(forged), forged)
  integration.feed(`\x1b]777;T1;${nonce};C;not-base64!\x07`)
  assert.deepEqual(commands, [value])
  assert.throws(
    () => integration.feed(`\x1b]777;T1;${nonce};C;${'A'.repeat(32768)}`),
    /too large/
  )
})
