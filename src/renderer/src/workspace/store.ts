import { parseTabTitle } from '../../../contracts/preferences.ts'
import { createStore } from 'zustand/vanilla'
import type { SavedNode, Preferences } from '../../../contracts/preferences'
export type Pane = {
  kind: 'pane'
  id: string
  shellId: string
  projectId: string | null
  private: boolean
}
export type PaneNode =
  | Pane
  | {
      kind: 'split'
      id: string
      direction: 'horizontal' | 'vertical'
      ratio: number
      first: PaneNode
      second: PaneNode
    }
export interface Tab {
  id: string
  title: string
  root: PaneNode
  activePaneId: string
}
export function panes(node: PaneNode): Pane[] {
  return node.kind === 'pane'
    ? [node]
    : [...panes(node.first), ...panes(node.second)]
}
function replace(
  node: PaneNode,
  id: string,
  transform: (node: PaneNode) => PaneNode
): PaneNode {
  if (node.id === id) return transform(node)
  return node.kind === 'pane'
    ? node
    : {
        ...node,
        first: replace(node.first, id, transform),
        second: replace(node.second, id, transform)
      }
}
function remove(node: PaneNode, id: string): PaneNode | null {
  if (node.id === id) return null
  if (node.kind === 'pane') return node
  const first = remove(node.first, id),
    second = remove(node.second, id)
  return first && second ? { ...node, first, second } : (first ?? second)
}
export interface Workspace {
  tabs: Tab[]
  activeTabId: string | null
  error: string
  newTab(
    shellId: string,
    title: string,
    projectId?: string | null,
    privateSession?: boolean
  ): void
  snapshot(): Preferences['restoration']['tabs']
  restore(tabs: Preferences['restoration']['tabs']): void
  selectTab(id: string): void
  closeTab(id: string): void
  renameTab(id: string, title: string): void
  focusPane(id: string): void
  split(direction: 'horizontal' | 'vertical'): void
  closePane(id: string): void
  resizeSplit(id: string, ratio: number): void
}
export function createWorkspaceStore() {
  let sequence = 0
  const next = () => `view-${++sequence}`
  return createStore<Workspace>((set, get) => ({
    tabs: [],
    activeTabId: null,
    error: '',
    snapshot() {
      const save = (node: PaneNode): SavedNode =>
        node.kind === 'pane'
          ? { kind: 'pane', shellId: node.shellId, projectId: node.projectId }
          : {
              kind: 'split',
              direction: node.direction,
              ratio: node.ratio,
              first: save(node.first),
              second: save(node.second)
            }
      return get()
        .tabs.filter((tab) => !panes(tab.root).some((pane) => pane.private))
        .map((tab) => ({ title: tab.title, root: save(tab.root) }))
    },
    restore(tabs) {
      if (get().tabs.length) {
        set({ error: 'Close existing tabs before restoring a saved layout.' })
        return
      }
      const load = (node: SavedNode): PaneNode =>
        node.kind === 'pane'
          ? { ...node, id: next(), private: false }
          : {
              ...node,
              id: next(),
              first: load(node.first),
              second: load(node.second)
            }
      const restored = tabs.map((item) => {
        const root = load(item.root)
        return {
          id: next(),
          title: item.title,
          root,
          activePaneId: panes(root)[0]!.id
        }
      })
      set({ tabs: restored, activeTabId: restored[0]?.id ?? null, error: '' })
    },
    newTab(shellId, title, projectId = null, privateSession = false) {
      if (get().tabs.flatMap((tab) => panes(tab.root)).length >= 4) {
        set({
          error: 'Four terminal views are open. Close a pane or tab first.'
        })
        return
      }
      const pane: Pane = {
        kind: 'pane',
        id: next(),
        shellId,
        projectId,
        private: privateSession
      }
      const tab: Tab = { id: next(), title, root: pane, activePaneId: pane.id }
      set({ tabs: [...get().tabs, tab], activeTabId: tab.id, error: '' })
    },
    renameTab(id, title) {
      const name = parseTabTitle(title)
      set({
        tabs: get().tabs.map((tab) =>
          tab.id === id ? { ...tab, title: name } : tab
        )
      })
    },
    selectTab(id) {
      if (get().tabs.some((tab) => tab.id === id)) set({ activeTabId: id })
    },
    closeTab(id) {
      const before = get().tabs,
        index = before.findIndex((tab) => tab.id === id)
      if (index < 0) return
      const tabs = before.filter((tab) => tab.id !== id)
      set({
        tabs,
        activeTabId:
          get().activeTabId === id
            ? (tabs[Math.min(index, tabs.length - 1)]?.id ?? null)
            : get().activeTabId,
        error: ''
      })
    },
    focusPane(id) {
      set({
        tabs: get().tabs.map((tab) =>
          panes(tab.root).some((pane) => pane.id === id)
            ? { ...tab, activePaneId: id }
            : tab
        )
      })
    },
    split(direction) {
      const state = get(),
        tab = state.tabs.find((tab) => tab.id === state.activeTabId)
      if (!tab) return
      if (state.tabs.flatMap((tab) => panes(tab.root)).length >= 4) {
        set({
          error: 'Four terminal views are open. Close a pane or tab first.'
        })
        return
      }
      const source = panes(tab.root).find(
        (pane) => pane.id === tab.activePaneId
      )
      if (!source) return
      const pane: Pane = { ...source, id: next() }
      const root = replace(tab.root, tab.activePaneId, (original) => ({
        kind: 'split',
        id: next(),
        direction,
        ratio: 0.5,
        first: original,
        second: pane
      }))
      set({
        tabs: state.tabs.map((item) =>
          item.id === tab.id ? { ...tab, root, activePaneId: pane.id } : item
        ),
        error: ''
      })
    },
    closePane(id) {
      const state = get(),
        tab = state.tabs.find((tab) =>
          panes(tab.root).some((pane) => pane.id === id)
        )
      if (!tab) return
      const root = remove(tab.root, id)
      if (!root) {
        state.closeTab(tab.id)
        return
      }
      set({
        tabs: state.tabs.map((item) =>
          item.id === tab.id
            ? {
                ...tab,
                root,
                activePaneId:
                  tab.activePaneId === id
                    ? panes(root)[0]!.id
                    : tab.activePaneId
              }
            : item
        ),
        error: ''
      })
    },
    resizeSplit(id, ratio) {
      if (!Number.isFinite(ratio)) return
      set({
        tabs: get().tabs.map((tab) => ({
          ...tab,
          root: replace(tab.root, id, (node) =>
            node.kind === 'split'
              ? { ...node, ratio: Math.max(0.2, Math.min(0.8, ratio)) }
              : node
          )
        }))
      })
    }
  }))
}
