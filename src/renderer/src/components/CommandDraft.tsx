import { useEffect, useRef, useState } from 'react'
import type { HistoryEntry } from '../../../contracts/preferences'

export function CommandDraft({
  shellId,
  explanations,
  close
}: {
  shellId: string
  explanations: boolean
  close(): void
}) {
  const dialog = useRef<HTMLDialogElement>(null)
  const queryInput = useRef<HTMLInputElement>(null)
  const [query, setQuery] = useState(''),
    [draft, setDraft] = useState(''),
    [entries, setEntries] = useState<HistoryEntry[]>([]),
    [suggestions, setSuggestions] = useState<HistoryEntry[]>([])
  const [message, setMessage] = useState('')
  const [dismissed, setDismissed] = useState(false)
  useEffect(() => {
    dialog.current?.showModal()
    queryInput.current?.focus()
  }, [])
  useEffect(() => {
    let active = true
    void window.desktop
      .searchHistory(query, shellId)
      .then((values) => {
        if (active) setEntries(values)
      })
      .catch(() => {
        if (active) setMessage('History could not be loaded.')
      })
    return () => {
      active = false
    }
  }, [query, shellId])
  useEffect(() => {
    let active = true
    if (!draft || dismissed) {
      setSuggestions([])
      return
    }
    void window.desktop
      .searchHistory(draft.slice(0, 256), shellId)
      .then((values) => {
        if (active)
          setSuggestions(
            values
              .filter(
                (value) =>
                  value.command.toLowerCase().startsWith(draft.toLowerCase()) &&
                  value.command !== draft
              )
              .slice(0, 5)
          )
      })
      .catch(() => {
        if (active) setSuggestions([])
      })
    return () => {
      active = false
    }
  }, [draft, shellId, dismissed])
  return (
    <dialog
      ref={dialog}
      className="developer-dialog"
      aria-label="History and command draft"
      onCancel={(event) => {
        event.preventDefault()
        close()
      }}
    >
      <div className="dialog-heading">
        <h2>History and command draft</h2>
        <button aria-label="Close command draft" onClick={close}>
          ×
        </button>
      </div>
      <p>
        Suggestions fill this draft only. Review it before copying and pasting
        into your terminal. Native completion stays available in the terminal.
      </p>
      <label>
        Search app history
        <input
          autoFocus
          aria-label="Search command history"
          ref={queryInput}
          value={query}
          maxLength={256}
          onChange={(event) => setQuery(event.target.value)}
        />
      </label>
      <ul aria-label="Command history" className="history-results">
        {entries.map((entry) => (
          <li key={entry.id}>
            <code>{entry.command}</code>
            <button
              onClick={() => {
                setDraft(entry.command)
                setDismissed(false)
              }}
            >
              Use command
            </button>
          </li>
        ))}
      </ul>
      {!entries.length && (
        <p>
          No matching app history. Capture is opt-in for new integrated
          PowerShell tabs; private tabs and other shells do not contribute.
        </p>
      )}
      <label>
        Command draft
        <textarea
          aria-label="Command draft"
          value={draft}
          maxLength={4096}
          onChange={(event) => {
            setDraft(event.target.value)
            setDismissed(false)
            setMessage('')
          }}
          onKeyDown={(event) => {
            if (event.key === 'Escape' && suggestions.length) {
              event.preventDefault()
              event.stopPropagation()
              setDismissed(true)
            }
          }}
        />
      </label>
      {suggestions.length > 0 && (
        <div aria-label="Command suggestions">
          {suggestions.map((entry) => (
            <button
              key={entry.id}
              onClick={() => {
                setDraft(entry.command)
                setDismissed(true)
              }}
            >
              Accept suggestion: {entry.command}
            </button>
          ))}
          <button onClick={() => setDismissed(true)}>
            Dismiss suggestions
          </button>
        </div>
      )}
      <div className="developer-operations">
        <button
          disabled={!draft}
          onClick={() => {
            void window.desktop
              .writeClipboard(draft)
              .then(() =>
                setMessage(
                  'Draft copied. Review it in your terminal before pressing Enter.'
                )
              )
              .catch(() => setMessage('Could not copy the draft.'))
          }}
        >
          Copy draft
        </button>
        <button
          disabled={!draft || !explanations}
          onClick={() => {
            void window.desktop
              .explainCommand(draft)
              .then(setMessage)
              .catch(() => setMessage('Local explanation is unavailable.'))
          }}
        >
          Explain locally
        </button>
        <button
          onClick={() => {
            void window.desktop
              .clearHistory()
              .then(() => {
                setEntries([])
                setSuggestions([])
                setMessage('App history cleared.')
              })
              .catch(() => setMessage('Could not clear history.'))
          }}
        >
          Clear history
        </button>
      </div>
      {!explanations && (
        <p>
          Offline explanations are disabled. Enable them in Developer settings.
        </p>
      )}
      {message && <p role="status">{message}</p>}
    </dialog>
  )
}
