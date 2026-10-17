import assert from 'node:assert/strict'
import test from 'node:test'
import {
  createWorkspaceStore,
  panes
} from '../src/renderer/src/workspace/store.ts'

test('tabs preserve inactive panes, close deterministically, and support an empty last tab', () => {
  const store = createWorkspaceStore()
  store.getState().newTab('powershell', 'PowerShell')
  const first = store.getState().tabs[0]
  store.getState().newTab('cmd', 'CMD')
  const second = store.getState().tabs[1]
  store.getState().selectTab(first.id)
  assert.equal(store.getState().tabs[1], second)
  store.getState().closeTab(first.id)
  assert.equal(store.getState().activeTabId, second.id)
  store.getState().closeTab(second.id)
  assert.deepEqual(store.getState().tabs, [])
  assert.equal(store.getState().activeTabId, null)
})
test('splits retain sibling session identity, collapse, clamp ratios and bound allocation', () => {
  const store = createWorkspaceStore()
  store.getState().newTab('powershell', 'PS')
  const original = panes(store.getState().tabs[0].root)[0]
  store.getState().split('horizontal', 'cmd')
  let tab = store.getState().tabs[0]
  const splitId = tab.root.id
  assert.equal(panes(tab.root)[0], original)
  store.getState().resizeSplit(splitId, 100)
  assert.equal(store.getState().tabs[0].root.ratio, 0.8)
  store.getState().split('vertical', 'pwsh')
  store.getState().newTab('cmd', 'CMD')
  store.getState().newTab('cmd', 'too many')
  assert.match(store.getState().error, /Four/)
  store.getState().closePane(original.id)
  tab = store.getState().tabs[0]
  assert.equal(panes(tab.root).length, 2)
  assert(panes(tab.root).some((pane) => pane.shellId === 'pwsh'))
})
