import { createWorkspaceStore } from '../src/renderer/src/workspace/store.ts'
import { createSplitDrag } from '../src/renderer/src/workspace/split-drag.ts'
import { performance } from 'node:perf_hooks'
import { mkdir, writeFile } from 'node:fs/promises'
import { execFileSync } from 'node:child_process'

const store = createWorkspaceStore()
store.getState().newTab('powershell', 'Synthetic')
store.getState().split('horizontal')
let notifications = 0
const unsubscribe = store.subscribe(() => notifications++)
const tab = store.getState().tabs[0]
let started = performance.now()
for (let i = 0; i < 1000; i++) store.getState().focusPane(tab.activePaneId)
const focus = {
  calls: 1000,
  notifications,
  elapsedMs: performance.now() - started
}
notifications = 0
started = performance.now()
for (let i = 0; i < 1000; i++) store.getState().resizeSplit(tab.root.id, 0.5)
const unchangedResize = {
  calls: 1000,
  notifications,
  elapsedMs: performance.now() - started
}
let callbacks = 0,
  requestedFrames = 0
const drag = createSplitDrag(
  () => callbacks++,
  () => ++requestedFrames,
  () => {}
)
for (let i = 0; i < 1000; i++) drag.update('synthetic-split', 0.2 + i / 2000)
drag.flush()
drag.dispose()
unsubscribe()
await mkdir('test-results/performance', { recursive: true })
await writeFile(
  'test-results/performance/workspace-events.json',
  JSON.stringify(
    {
      sourceCommit: execFileSync('git', ['rev-parse', 'HEAD'], {
        encoding: 'utf8'
      }).trim(),
      node: process.version,
      focus,
      unchangedResize,
      pointerBurst: { updates: 1000, requestedFrames, callbacks },
      scope:
        'Deterministic store calls and synchronous synthetic pointer-update burst, not hardware pointer frequency or frame-rate measurement'
    },
    null,
    2
  ) + '\n'
)
