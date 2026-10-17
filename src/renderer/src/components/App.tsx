import { useState } from 'react'
import { Icon } from './Icon'
import {
  ANSI_NAMES,
  DEFAULT_TERMINAL_FONT,
  terminalFontStyle
} from '../theme/font'

export function App() {
  const [error, setError] = useState('')
  async function openDocumentation() {
    try {
      await window.desktop.openExternal(
        'https://github.com/dineshkorukonda/TerminalOne'
      )
      setError('')
    } catch {
      setError('Could not open project documentation.')
    }
  }
  return (
    <div className="min-h-screen bg-canvas font-ui text-ink">
      <header className="app-header border-b border-border">
        <div className="brand">
          <Icon name="terminal" />
          <span>Terminal One</span>
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
        <p className="eyebrow">Desktop foundation</p>
        <h1>Terminal One</h1>
        <p className="intro">The application window is ready.</p>
        <section
          className="foundation-panel bg-panel border border-border rounded-panel"
          aria-labelledby="foundation-title"
        >
          <div className="panel-heading">
            <h2 id="foundation-title">A foundation for your terminal</h2>
            <span className="phase-label">Phase 0</span>
          </div>
          <p className="status">Shell sessions arrive in the next phase.</p>
          <div
            className="type-sample"
            data-testid="font-sample"
            style={terminalFontStyle(DEFAULT_TERMINAL_FONT)}
          >
            <p className="sample-label">Terminal typography</p>
            <p>Aa Bb Cc &nbsp; 0123456789</p>
            <p className="sample-detail">{'~ / _ - + = { } [ ] ( ) < >'}</p>
          </div>
          <ul className="ansi-palette" aria-label="ANSI color palette">
            {ANSI_NAMES.map((name) => (
              <li key={name}>
                <span
                  className={`ansi-swatch ansi-${name}`}
                  aria-hidden="true"
                />
                <span className="sr-only">{name}</span>
              </li>
            ))}
          </ul>
          <p className="palette-label">
            16 ANSI colors · system monospace fonts
          </p>
        </section>
        <p className="foundation-note">
          This development build has no shell sessions or installer.
        </p>
        {error && (
          <p role="alert" className="error-message">
            {error}
          </p>
        )}
      </main>
    </div>
  )
}
