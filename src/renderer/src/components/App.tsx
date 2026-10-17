import { useEffect, useState } from 'react'
import { Icon } from './Icon'
import { TerminalPane } from './TerminalPane'
import type { ShellInfo } from '../../../contracts/desktop-api'

export function App() {
  const [shells, setShells] = useState<ShellInfo[]>([])
  const [shellId, setShellId] = useState('')
  const [generation, setGeneration] = useState(0)
  const [error, setError] = useState('')
  useEffect(() => {
    let active = true
    void window.desktop
      .listShells()
      .then((available) => {
        if (!active) return
        setShells(available)
        setShellId(available[0]?.id ?? '')
        if (!available.length)
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
  }, [])
  async function openDocumentation() {
    try {
      await window.desktop.openExternal(
        'https://github.com/dineshkorukonda/TerminalOne'
      )
    } catch {
      setError('Could not open project documentation.')
    }
  }
  return (
    <div className="min-h-screen bg-canvas font-ui text-ink app-shell">
      <header className="app-header border-b border-border">
        <div className="brand">
          <Icon name="terminal" />
          <h1>Terminal One</h1>
          <span className="build-label">Development</span>
        </div>
        <button
          className="documentation-button"
          onClick={() => {
            void openDocumentation()
          }}
        >
          <span>Project documentation</span>
          <Icon name="external" />
        </button>
      </header>
      <main className="workspace">
        <div className="session-controls">
          <label htmlFor="shell">Shell</label>
          <select
            id="shell"
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
            disabled={!shellId}
            onClick={() => setGeneration((value) => value + 1)}
          >
            New session
          </button>
        </div>
        {error && (
          <p role="alert" className="error-message">
            {error}
          </p>
        )}
        {shellId && (
          <TerminalPane key={`${shellId}-${generation}`} shellId={shellId} />
        )}
      </main>
    </div>
  )
}
