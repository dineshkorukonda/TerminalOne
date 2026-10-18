import { useEffect, useState, useRef } from 'react'
import { useStore } from 'zustand'
import { Icon } from './Icon'
import { CommandPalette, type PaletteAction } from './CommandPalette'
import { DEFAULT_APPEARANCE, parseAppearance } from '../theme/appearance'
import { FONT_FAMILIES } from '../theme/font'
import { PaneLayout } from './PaneLayout'
import { createWorkspaceStore, type PaneNode } from '../workspace/store'
import type { ShellInfo } from '../../../contracts/desktop-api'
import {
  defaultPreferences,
  parsePreferences
} from '../../../contracts/preferences'
import type { Preferences } from '../../../contracts/preferences'
import { DeveloperSettings } from './DeveloperSettings'
import { CommandDraft } from './CommandDraft'

export function App() {
  const [store] = useState(createWorkspaceStore)
  const workspace = useStore(store)
  const [shells, setShells] = useState<ShellInfo[]>([])
  const [shellId, setShellId] = useState('')
  const [error, setError] = useState('')
  const [appearance, setAppearanceState] = useState(DEFAULT_APPEARANCE)
  const [preferences, setPreferences] = useState(defaultPreferences)
  const [developer, setDeveloper] = useState(false)
  const [draftOpen, setDraftOpen] = useState(false)
  const [projectId, setProjectId] = useState('')
  const [restoreOffered, setRestoreOffered] = useState(false)
  const saving = useRef(0)
  async function saveSettings(value: Preferences) {
    const next = parsePreferences(value),
      revision = ++saving.current
    const result = await window.desktop.savePreferences(next)
    if (revision === saving.current) {
      setPreferences(result.settings)
      setAppearanceState(result.settings.appearance)
      setError(result.warning)
    }
  }
  function setAppearance(value: typeof appearance) {
    setAppearanceState(value)
    void saveSettings({ ...preferences, appearance: value }).catch(() =>
      setError('Appearance could not be saved. Check Developer settings.')
    )
  }
  async function reloadPreferences() {
    const result = await window.desktop.getPreferences()
    setPreferences(result.settings)
    setAppearanceState(result.settings.appearance)
    setError(result.warning)
  }
  const [palette, setPalette] = useState(false)
  const [settings, setSettings] = useState(false)
  useEffect(() => {
    let active = true
    void window.desktop
      .getPreferences()
      .then(async (result) => {
        if (!active) return null
        setPreferences(result.settings)
        setAppearanceState(result.settings.appearance)
        setError(result.warning)
        const available = await window.desktop.listShells()
        return {
          available,
          restore:
            result.settings.restoration.enabled &&
            result.settings.restoration.tabs.length > 0
        }
      })
      .then((result) => {
        if (!result) return
        const { available, restore } = result
        if (!active) return
        setShells(available)
        const shell = available[0]
        if (shell) {
          setShellId(shell.id)
          setRestoreOffered(restore)
          if (!restore && !store.getState().tabs.length)
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
  const newTab = (privateSession = false) => {
    const shell = shells.find((shell) => shell.id === shellId)
    if (shell) {
      const project = preferences.projects.find((item) => item.id === projectId)
      workspace.newTab(
        shell.id,
        (privateSession
          ? `Private ${shell.name}`
          : project
            ? `${project.name} — ${shell.name}`
            : shell.name
        ).slice(0, 80),
        project?.id ?? null,
        privateSession
      )
      focusTerminal()
    }
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
  function split(direction: 'horizontal' | 'vertical') {
    workspace.split(direction, shellId)
    focusTerminal()
  }
  function openSettings() {
    setSettings(true)
    requestAnimationFrame(() =>
      document
        .querySelector<HTMLSelectElement>('.appearance-settings select')
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
  function activeShell(node: PaneNode, id: string): string | null {
    return node.kind === 'pane'
      ? node.id === id
        ? node.shellId
        : null
      : (activeShell(node.first, id) ?? activeShell(node.second, id))
  }
  const draftShell = activeTab
    ? (activeShell(activeTab.root, activeTab.activePaneId) ?? shellId)
    : shellId
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
      run: () => split('horizontal')
    },
    {
      id: 'down',
      label: 'Split down',
      run: () => split('vertical')
    },
    {
      id: 'search',
      label: 'Search terminal output',
      run: () => paneAction('Search terminal')
    },
    {
      id: 'settings',
      label: 'Appearance settings',
      run: openSettings
    },
    {
      id: 'developer',
      label: 'Developer settings',
      run: () => setDeveloper(true)
    },
    {
      id: 'draft',
      label: 'History and command draft',
      run: () => setDraftOpen(true)
    },
    ...workspace.tabs.map((tab, index) => ({
      id: tab.id,
      label: `Switch to tab ${index + 1}: ${tab.title}`,
      run: () => {
        workspace.selectTab(tab.id)
        focusTerminal()
      }
    }))
  ]
  useEffect(() => {
    const keydown = (event: KeyboardEvent) => {
      if (!event.ctrlKey || !event.shiftKey || event.altKey || event.metaKey)
        return
      if (
        (event.target as HTMLElement | null)?.closest(
          'dialog, .appearance-settings'
        )
      )
        return
      const key = event.key.toUpperCase()
      const action = Object.entries(preferences.shortcuts).find(
        ([, binding]) => binding === `Ctrl+Shift+${key}`
      )?.[0]
      if (action === 'palette') {
        event.preventDefault()
        setPalette((open) => !open)
        if (palette) focusTerminal()
        return
      }
      if (action === 'copy' || action === 'paste') {
        event.preventDefault()
        paneAction(action === 'copy' ? 'Copy selection' : 'Paste clipboard')
        return
      }
      if (action) {
        event.preventDefault()
        actions.find((item) => item.id === action)?.run()
        if (action !== 'search') focusTerminal()
      }
    }
    document.addEventListener('keydown', keydown)
    return () => document.removeEventListener('keydown', keydown)
  })
  return (
    <div
      className={`min-h-screen bg-canvas font-ui text-ink app-shell theme-${appearance.theme}`}
    >
      <header className="app-header">
        <div className="tab-chrome">
          <div
            className="tab-strip"
            role={workspace.tabs.length ? 'tablist' : undefined}
            aria-label={workspace.tabs.length ? 'Terminal tabs' : undefined}
          >
            {workspace.tabs.map((tab) => (
              <div className="tab-item" key={tab.id}>
                <button
                  id={`tab-${tab.id}`}
                  role="tab"
                  aria-selected={tab.id === workspace.activeTabId}
                  tabIndex={tab.id === workspace.activeTabId ? 0 : -1}
                  onKeyDown={(event) => {
                    if (
                      event.key === 'ArrowRight' ||
                      event.key === 'ArrowLeft'
                    ) {
                      event.preventDefault()
                      switchTab(event.key === 'ArrowRight' ? 1 : -1)
                    }
                  }}
                  aria-controls={`panel-${tab.id}`}
                  onClick={() => {
                    workspace.selectTab(tab.id)
                    focusTerminal()
                  }}
                >
                  <Icon name="terminal" />
                  <span>{tab.title}</span>
                </button>
              </div>
            ))}
          </div>
          {activeTab && (
            <button
              aria-label={`Close tab ${activeTab.title}`}
              title="Close active tab"
              onClick={() => {
                workspace.closeTab(activeTab.id)
                focusTerminal()
              }}
            >
              <Icon name="close" />
            </button>
          )}
        </div>
        <button
          className="new-tab-button"
          aria-label="New session"
          title={`New tab (${preferences.shortcuts.new})`}
          disabled={!shellId}
          onClick={() => newTab()}
        >
          <Icon name="plus" />
        </button>
        <div className="brand">
          <Icon name="terminal" />
          <h1>Terminal One</h1>
        </div>
      </header>
      <main className="workspace">
        {developer && (
          <DeveloperSettings
            settings={preferences}
            save={saveSettings}
            reload={reloadPreferences}
            saveLayout={() =>
              saveSettings({
                ...preferences,
                restoration: { enabled: true, tabs: workspace.snapshot() }
              })
            }
            close={() => {
              setDeveloper(false)
              focusTerminal()
            }}
          />
        )}
        {draftOpen && (
          <CommandDraft
            shellId={draftShell}
            explanations={preferences.explanations}
            close={() => {
              setDraftOpen(false)
              focusTerminal()
            }}
          />
        )}
        {restoreOffered && (
          <section className="restore-offer" aria-label="Saved workspace">
            <p>
              A saved layout is available. Restore fresh sessions in their saved
              launch folders; no commands will be replayed.
            </p>
            <button
              onClick={() => {
                workspace.restore(preferences.restoration.tabs)
                setRestoreOffered(false)
              }}
            >
              Restore saved layout
            </button>
            <button onClick={() => setRestoreOffered(false)}>
              Dismiss saved layout
            </button>
          </section>
        )}
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
                <option value="midnight">iTerm Night</option>
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
        <div className="workspace-toolbar">
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
            <button
              disabled={!workspace.activeTabId}
              aria-label="Split right"
              title={`Split right (${preferences.shortcuts.right})`}
              onClick={() => split('horizontal')}
            >
              <Icon name="split" />
              <span>Split right</span>
            </button>
            <button
              disabled={!workspace.activeTabId}
              aria-label="Split down"
              title={`Split down (${preferences.shortcuts.down})`}
              onClick={() => split('vertical')}
            >
              <Icon name="split-down" />
              <span>Split down</span>
            </button>
          </div>
          <div className="workspace-actions">
            <button
              aria-label="Commands"
              onClick={() => setPalette(true)}
              title={`Command palette (${preferences.shortcuts.palette})`}
            >
              <Icon name="commands" />
              <span>Commands</span>
            </button>
            <button
              aria-label="Appearance"
              title="Appearance"
              onClick={() => {
                if (settings) {
                  setSettings(false)
                  focusTerminal()
                } else openSettings()
              }}
            >
              <Icon name="appearance" />
              <span>Appearance</span>
            </button>
            <button
              aria-label="Developer settings"
              title="Developer settings"
              onClick={() => setDeveloper(true)}
            >
              <Icon name="settings" />
            </button>
            <button
              aria-label="History"
              title="Command history"
              onClick={() => setDraftOpen(true)}
            >
              <Icon name="history" />
            </button>
            <button
              aria-label="Private tab"
              title="New private tab"
              disabled={!['powershell', 'pwsh'].includes(shellId)}
              onClick={() => newTab(true)}
            >
              <Icon name="lock" />
              <span>Private tab</span>
            </button>
            <button
              aria-label="Open project"
              title="Open project"
              disabled={!shellId}
              onClick={() => {
                void window.desktop
                  .chooseProject(shellId)
                  .then(async (project) => {
                    if (project) {
                      await reloadPreferences()
                      setProjectId(project.id)
                      setShellId(project.shellId)
                    }
                  })
                  .catch(() =>
                    setError(
                      'Could not add a project. Choose a normal local or UNC folder.'
                    )
                  )
              }}
            >
              <Icon name="folder" />
              <span>Open project</span>
            </button>
            <label>
              Project
              <select
                aria-label="Project"
                value={projectId}
                onChange={(event) => {
                  setProjectId(event.target.value)
                  const project = preferences.projects.find(
                    (item) => item.id === event.target.value
                  )
                  if (project) setShellId(project.shellId)
                }}
              >
                <option value="">Home directory</option>
                {preferences.projects.map((project) => (
                  <option key={project.id} value={project.id}>
                    {project.name}
                  </option>
                ))}
              </select>
            </label>
          </div>
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
            closePane={(id) => {
              workspace.closePane(id)
              focusTerminal()
            }}
            resizeSplit={workspace.resizeSplit}
            shortcuts={preferences.shortcuts}
          />
        ))}
      </main>
      <footer className="workspace-status">
        <div className="workspace-status-left">
          <Icon name="folder" />
          <span>
            {preferences.projects.find((item) => item.id === projectId)?.name ??
              'Home directory'}
          </span>
          <span className="status-divider" />
          <span>
            {workspace.tabs.length}{' '}
            {workspace.tabs.length === 1 ? 'tab' : 'tabs'}
          </span>
        </div>
        <div className="workspace-status-right">
          <span>
            {appearance.theme === 'contrast' ? 'High contrast' : 'iTerm Night'}
          </span>
          <span className="status-divider" />
          <button
            aria-label="Project documentation"
            title="Project documentation"
            onClick={() => {
              void window.desktop
                .openExternal('https://github.com/dineshkorukonda/TerminalOne')
                .catch(() => setError('Could not open project documentation.'))
            }}
          >
            Documentation
            <Icon name="external" />
          </button>
        </div>
      </footer>
    </div>
  )
}
