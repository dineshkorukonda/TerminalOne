import { useEffect, useState } from 'react'
import { useStore } from 'zustand'
import { Icon } from './Icon'
import { CommandPalette, type PaletteAction } from './CommandPalette'
import { DEFAULT_APPEARANCE, parseAppearance } from '../theme/appearance'
import { FONT_FAMILIES } from '../theme/font'
import { PaneLayout } from './PaneLayout'
import { createWorkspaceStore } from '../workspace/store'
import type { ShellInfo } from '../../../contracts/desktop-api'

export function App() {
  const [store] = useState(createWorkspaceStore)
  const workspace = useStore(store)
  const [shells, setShells] = useState<ShellInfo[]>([])
  const [shellId, setShellId] = useState('')
  const [error, setError] = useState('')
  const [appearance, setAppearance] = useState(DEFAULT_APPEARANCE)
  const [palette, setPalette] = useState(false)
  const [settings, setSettings] = useState(false)
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
  function focusTerminal() {
    requestAnimationFrame(() =>
      document
        .querySelector<HTMLTextAreaElement>(
          '.tab-viewport:not([hidden]) .pane-active .xterm-helper-textarea'
        )
        ?.focus()
    )
  }
  function paneAction(label: string) {
    document
      .querySelector<HTMLButtonElement>(
        `.tab-viewport:not([hidden]) .pane-active [aria-label="${label}"]`
      )
      ?.click()
  }
  const activeTab = workspace.tabs.find(
    (tab) => tab.id === workspace.activeTabId
  )
  function switchTab(offset: number) {
    const index = workspace.tabs.findIndex(
      (tab) => tab.id === workspace.activeTabId
    )
    const tab =
      workspace.tabs[
        (index + offset + workspace.tabs.length) % workspace.tabs.length
      ]
    if (tab) workspace.selectTab(tab.id)
    focusTerminal()
  }
  const actions: PaletteAction[] = [
    { id: 'new', label: 'New terminal tab', run: newTab },
    {
      id: 'close',
      label: 'Close active pane',
      run: () => {
        if (activeTab) workspace.closePane(activeTab.activePaneId)
      }
    },
    { id: 'next', label: 'Next tab', run: () => switchTab(1) },
    { id: 'previous', label: 'Previous tab', run: () => switchTab(-1) },
    {
      id: 'right',
      label: 'Split right',
      run: () => workspace.split('horizontal', shellId)
    },
    {
      id: 'down',
      label: 'Split down',
      run: () => workspace.split('vertical', shellId)
    },
    {
      id: 'search',
      label: 'Search terminal output',
      run: () => paneAction('Search terminal')
    },
    {
      id: 'settings',
      label: 'Appearance settings',
      run: () => setSettings(true)
    },
    ...workspace.tabs.map((tab, index) => ({
      id: tab.id,
      label: `Switch to tab ${index + 1}: ${tab.title}`,
      run: () => workspace.selectTab(tab.id)
    }))
  ]
  useEffect(() => {
    const keydown = (event: KeyboardEvent) => {
      if (!event.ctrlKey || !event.shiftKey || event.altKey || event.metaKey)
        return
      const key = event.key.toLowerCase()
      const action = (
        { t: 'new', w: 'close', e: 'right', o: 'down', f: 'search' } as Record<
          string,
          string
        >
      )[key]
      if (key === 'p') {
        event.preventDefault()
        setPalette((open) => !open)
        return
      }
      if (key === 'c' || key === 'v') {
        event.preventDefault()
        paneAction(key === 'c' ? 'Copy selection' : 'Paste clipboard')
        return
      }
      if (action) {
        event.preventDefault()
        actions.find((item) => item.id === action)?.run()
        if (key !== 'f') focusTerminal()
      }
    }
    document.addEventListener('keydown', keydown)
    return () => document.removeEventListener('keydown', keydown)
  })
  return (
    <div
      className={`min-h-screen bg-canvas font-ui text-ink app-shell theme-${appearance.theme}`}
    >
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
        {palette && (
          <CommandPalette
            actions={actions}
            close={(restore = true) => {
              setPalette(false)
              if (restore) focusTerminal()
            }}
          />
        )}
        {settings && (
          <section
            className="appearance-settings"
            aria-label="Appearance settings"
          >
            <label>
              Theme{' '}
              <select
                aria-label="Terminal theme"
                value={appearance.theme}
                onChange={(event) =>
                  setAppearance(
                    parseAppearance({
                      ...appearance,
                      theme: event.target.value
                    })
                  )
                }
              >
                <option value="midnight">Midnight</option>
                <option value="contrast">High contrast</option>
              </select>
            </label>
            <label>
              Font{' '}
              <select
                aria-label="Terminal font"
                value={appearance.font.family}
                onChange={(event) =>
                  setAppearance(
                    parseAppearance({
                      ...appearance,
                      font: { ...appearance.font, family: event.target.value }
                    })
                  )
                }
              >
                {FONT_FAMILIES.map((family) => (
                  <option key={family}>{family}</option>
                ))}
              </select>
            </label>
            <label>
              Size{' '}
              <input
                aria-label="Terminal font size"
                type="number"
                min="10"
                max="32"
                value={appearance.font.size}
                onChange={(event) => {
                  const size = Number(event.target.value)
                  if (Number.isInteger(size) && size >= 10 && size <= 32)
                    setAppearance(
                      parseAppearance({
                        ...appearance,
                        font: { ...appearance.font, size }
                      })
                    )
                }}
              />
            </label>
            <button
              onClick={() => {
                setSettings(false)
                focusTerminal()
              }}
            >
              Close appearance
            </button>
          </section>
        )}
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
        <div className="workspace-actions">
          <button onClick={() => setPalette(true)}>Commands</button>
          <button onClick={() => setSettings((open) => !open)}>
            Appearance
          </button>
        </div>
        <div className="tab-strip" role="tablist" aria-label="Terminal tabs">
          {workspace.tabs.map((tab) => (
            <div className="tab-item" key={tab.id}>
              <button
                id={`tab-${tab.id}`}
                role="tab"
                aria-selected={tab.id === workspace.activeTabId}
                tabIndex={tab.id === workspace.activeTabId ? 0 : -1}
                onKeyDown={(event) => {
                  if (event.key === 'ArrowRight' || event.key === 'ArrowLeft') {
                    event.preventDefault()
                    switchTab(event.key === 'ArrowRight' ? 1 : -1)
                  }
                }}
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
            appearance={appearance}
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
