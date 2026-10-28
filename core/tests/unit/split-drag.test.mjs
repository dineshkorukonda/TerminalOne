import assert from 'node:assert/strict'
import test from 'node:test'
import { createSplitDrag } from '../../src/renderer/src/workspace/split-drag.ts'
import { createWorkspaceStore } from '../../src/renderer/src/workspace/store.ts'

test('split drags coalesce per frame, preserve the final position and stop after disposal', () => {
  const frames = new Map()
  let sequence = 0
  const calls = []
  const drag = createSplitDrag(
    (id, ratio) => calls.push({ id, ratio }),
    (callback) => {
      frames.set(++sequence, callback)
      return sequence
    },
    (id) => frames.delete(id)
  )
  for (let i = 0; i < 1000; i++) drag.update('split', i / 1000)
  drag.update('other', 0.4)
  assert.equal(frames.size, 1)
  drag.flush()
  assert.deepEqual(calls, [
    { id: 'split', ratio: 0.999 },
    { id: 'other', ratio: 0.4 }
  ])
  assert.equal(frames.size, 0)
  drag.update('split', 0.6)
  drag.dispose()
  drag.update('split', 0.7)
  drag.flush()
  assert.equal(calls.length, 2)
  assert.equal(frames.size, 0)
})
test('unchanged focus and split updates do not notify workspace consumers', () => {
  const store = createWorkspaceStore()
  store.getState().newTab('powershell', 'Synthetic')
  store.getState().split('horizontal')
  const tab = store.getState().tabs[0]
  let notifications = 0
  store.subscribe(() => notifications++)
  for (let i = 0; i < 1000; i++) {
    store.getState().focusPane(tab.activePaneId)
    store.getState().resizeSplit(tab.root.id, 0.5)
  }
  assert.equal(notifications, 0)
  store.getState().resizeSplit(tab.root.id, 0.6)
  assert.equal(notifications, 1)
})
