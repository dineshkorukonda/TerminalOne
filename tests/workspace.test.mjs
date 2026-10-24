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
  store.getState().split('horizontal')
  let tab = store.getState().tabs[0]
  const splitId = tab.root.id
  assert.equal(panes(tab.root)[0], original)
  store.getState().resizeSplit(splitId, 100)
  assert.equal(store.getState().tabs[0].root.ratio, 0.8)
  store.getState().split('vertical')
  store.getState().newTab('cmd', 'CMD')
  store.getState().newTab('cmd', 'too many')
  assert.match(store.getState().error, /Four/)
  store.getState().closePane(original.id)
  tab = store.getState().tabs[0]
  assert.equal(panes(tab.root).length, 2)
  assert(panes(tab.root).every((pane) => pane.shellId === 'powershell'))
})

test('restoration snapshots contain launch metadata only, exclude private tabs, and allocate fresh view IDs', () => {
  const source = createWorkspaceStore()
  source.getState().newTab('powershell', 'Project', 'project-1')
  source.getState().split('horizontal')
  source.getState().newTab('pwsh', 'Private', null, true)
  const saved = source.getState().snapshot()
  assert.equal(saved.length, 1)
  assert.equal(saved[0].root.first.projectId, 'project-1')
  assert(!JSON.stringify(saved).includes('view-'))
  assert(!JSON.stringify(saved).includes('Private'))
  const target = createWorkspaceStore()
  target.getState().restore(saved)
  assert.equal(panes(target.getState().tabs[0].root).length, 2)
  assert.equal(panes(target.getState().tabs[0].root)[1].projectId, 'project-1')
  target.getState().restore(saved)
  assert.match(target.getState().error, /Close existing/)
})

test('splits copy the active pane launch context and preserve private snapshots', () => {
  const store = createWorkspaceStore()
  store.getState().restore([
    {
      title: 'Mixed shells',
      root: {
        kind: 'split',
        direction: 'horizontal',
        ratio: 0.5,
        first: { kind: 'pane', shellId: 'cmd', projectId: null },
        second: { kind: 'pane', shellId: 'pwsh', projectId: 'project-1' }
      }
    }
  ])
  const original = panes(store.getState().tabs[0].root)
  store.getState().focusPane(original[1].id)
  store.getState().split('vertical')
  const children = panes(store.getState().tabs[0].root)
  assert.equal(children[0], original[0])
  assert.equal(children[1], original[1])
  assert.deepEqual(children[2], { ...original[1], id: children[2].id })
  assert.notEqual(children[2].id, original[1].id)
  store.getState().closeTab(store.getState().activeTabId)
  store.getState().newTab('powershell', 'Private project', 'project-2', true)
  const privatePane = panes(store.getState().tabs[0].root)[0]
  store.getState().split('horizontal')
  const split = panes(store.getState().tabs[0].root)[1]
  assert.deepEqual(split, { ...privatePane, id: split.id })
  assert.deepEqual(store.getState().snapshot(), [])
})

test('renaming preserves session identity and validates names before saving layouts', () => {
  const store = createWorkspaceStore()
  const state = () => store.getState()
  state().newTab('pwsh', 'PowerShell')
  const before = state().tabs[0]
  state().renameTab(before.id, '  Project API  ')
  assert.equal(state().tabs[0].title, 'Project API')
  assert.equal(state().tabs[0].root, before.root)
  assert.equal(state().tabs[0].activePaneId, before.activePaneId)
  for (const name of ['', ' '.repeat(3), 'x'.repeat(81), 'line\nbreak'])
    assert.throws(() => state().renameTab(before.id, name))
  const snapshot = state().snapshot()
  assert.equal(snapshot[0].title, 'Project API')
  state().closeTab(before.id)
  state().restore(snapshot)
  assert.equal(state().tabs[0].title, 'Project API')
  state().newTab('pwsh', 'Private', null, true)
  state().renameTab(state().activeTabId, 'Private project')
  assert.equal(state().snapshot().length, 1)
})
