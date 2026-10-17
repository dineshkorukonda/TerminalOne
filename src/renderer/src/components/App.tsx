import { useEffect, useState } from 'react'
import { useStore } from 'zustand'
import { Icon } from './Icon'
import { PaneLayout } from './PaneLayout'
import { createWorkspaceStore } from '../workspace/store'
import type { ShellInfo } from '../../../contracts/desktop-api'

export function App() {
  const [store] = useState(createWorkspaceStore)
  const workspace = useStore(store)
  const [shells, setShells] = useState<ShellInfo[]>([])
  const [shellId, setShellId] = useState('')
  const [error, setError] = useState('')
  useEffect(() => {
    let active = true
    void window.desktop
      .listShells()
      .then((available) => {
        if (!active) return
        setShells(available)
        const shell = available[0]
        if (shell) {
          setShellId(shell.id)
          if (!store.getState().tabs.length)
            store.getState().newTab(shell.id, shell.name)
        } else
          setError(
            'No supported shell was found. Install PowerShell or enable Command Prompt, then reopen the window.'
          )
      })
      .catch(() => {
        if (active)
          setError(
            'Terminal sessions require Windows 10 build 18309 or later and the built native Windows components.'
          )
      })
    return () => {
      active = false
    }
  }, [store])
  const newTab = () => {
    const shell = shells.find((shell) => shell.id === shellId)
    if (shell) workspace.newTab(shell.id, shell.name)
  }
  return (
    <div className="min-h-screen bg-canvas font-ui text-ink app-shell">
      <header className="app-header border-b border-border">
        <div className="brand">
          <Icon name="terminal" />
          <h1>Terminal One</h1>
        </div>
        <button
          className="documentation-button"
          onClick={() => {
            void window.desktop
              .openExternal('https://github.com/dineshkorukonda/TerminalOne')
              .catch(() => setError('Could not open project documentation.'))
          }}
        >
          <span>Project documentation</span>
          <Icon name="external" />
        </button>
      </header>
      <main className="workspace">
        <div className="session-controls">
          <label htmlFor="shell">New shell</label>
          <select
            id="shell"
            aria-label="Shell"
            value={shellId}
            onChange={(event) => setShellId(event.target.value)}
            disabled={!shells.length}
          >
            {shells.map((shell) => (
              <option key={shell.id} value={shell.id}>
                {shell.name}
              </option>
            ))}
          </select>
          <button disabled={!shellId} onClick={newTab}>
            New session
          </button>
          <button
            disabled={!workspace.activeTabId}
            onClick={() => workspace.split('horizontal', shellId)}
          >
            Split right
          </button>
          <button
            disabled={!workspace.activeTabId}
            onClick={() => workspace.split('vertical', shellId)}
          >
            Split down
          </button>
        </div>
        <div className="tab-strip" role="tablist" aria-label="Terminal tabs">
          {workspace.tabs.map((tab) => (
            <div className="tab-item" key={tab.id}>
              <button
                id={`tab-${tab.id}`}
                role="tab"
                aria-selected={tab.id === workspace.activeTabId}
                aria-controls={`panel-${tab.id}`}
                onClick={() => workspace.selectTab(tab.id)}
              >
                {tab.title}
              </button>
              <button
                aria-label={`Close tab ${tab.title}`}
                onClick={() => workspace.closeTab(tab.id)}
              >
                ×
              </button>
            </div>
          ))}
        </div>
        {(error || workspace.error) && (
          <p role="alert" className="error-message">
            {error || workspace.error}
          </p>
        )}
        {!workspace.tabs.length && !error && (
          <p className="empty-workspace">Open a new session to begin.</p>
        )}
        {workspace.tabs.map((tab) => (
          <PaneLayout
            key={tab.id}
            tab={tab}
            active={tab.id === workspace.activeTabId}
            focusPane={workspace.focusPane}
            closePane={workspace.closePane}
            resizeSplit={workspace.resizeSplit}
          />
        ))}
      </main>
    </div>
  )
}
