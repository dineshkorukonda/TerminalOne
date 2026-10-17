import assert from 'node:assert/strict'
import test from 'node:test'
import { createGridSender } from '../src/renderer/src/grid-sender.ts'

test('resize storms keep the latest grid, deduplicate, and stop on disposal', async () => {
  const calls = []
  let release
  const sender = createGridSender(
    async (grid) => {
      calls.push(grid)
      await new Promise((resolve) => {
        release = resolve
      })
    },
    () => assert.fail('Unexpected failure')
  )
  sender.update({ cols: 80, rows: 24 })
  sender.update({ cols: 90, rows: 30 })
  sender.update({ cols: 100, rows: 40 })
  assert.equal(calls.length, 1)
  release()
  await new Promise(setImmediate)
  assert.deepEqual(calls[1], { cols: 100, rows: 40 })
  sender.update({ cols: 100, rows: 40 })
  release()
  await new Promise(setImmediate)
  assert.equal(calls.length, 2)
  sender.update({ cols: 0, rows: 0 })
  sender.update({ cols: 50.5, rows: 20 })
  sender.dispose()
  sender.update({ cols: 120, rows: 50 })
  assert.equal(calls.length, 2)
})
