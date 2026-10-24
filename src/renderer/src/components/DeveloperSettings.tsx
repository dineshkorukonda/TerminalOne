import { useEffect, useRef, useState } from 'react'
import {
  ACTIONS,
  DEFAULT_SHORTCUTS,
  parsePreferences
} from '../../../contracts/preferences'
import type {
  Preferences,
  ShortcutAction
} from '../../../contracts/preferences'

function preferenceSignature(value: Preferences): string {
  return JSON.stringify(value, (_key: string, item: unknown) =>
    item && typeof item === 'object' && !Array.isArray(item)
      ? Object.fromEntries(
          Object.entries(item).sort(([left], [right]) =>
            left.localeCompare(right)
          )
        )
      : item
  )
}

const shortcutLabels: Record<ShortcutAction, string> = {
  palette: 'Open command palette',
  new: 'New terminal tab',
  close: 'Close active pane',
  right: 'Split pane right',
  down: 'Split pane down',
  search: 'Search terminal output',
  copy: 'Copy terminal selection',
  paste: 'Paste clipboard'
}

export function DeveloperSettings({
  settings,
  save,
  close,
  saveLayout,
  reload
}: {
  settings: Preferences
  save(value: Preferences): Promise<void>
  close(): void
  saveLayout(): Promise<void>
  reload(): Promise<void>
}) {
  const dialog = useRef<HTMLDialogElement>(null)
  const [draft, setDraft] = useState(settings)
  const [saved, setSaved] = useState(settings)
  const baseline = useRef(settings)
  const [discardPrompt, setDiscardPrompt] = useState(false)
  const continueButton = useRef<HTMLButtonElement>(null)
  const returnFocus = useRef<HTMLElement | null>(null)
  const dirty = preferenceSignature(draft) !== preferenceSignature(saved)
  const [message, setMessage] = useState('')
  const [busy, setBusy] = useState(false)
  useEffect(() => {
    dialog.current?.showModal()
  }, [])
  useEffect(() => {
    const previous = baseline.current
    setDraft((current) =>
      preferenceSignature(current) === preferenceSignature(previous)
        ? settings
        : current
    )
    baseline.current = settings
    setSaved(settings)
  }, [settings])
  useEffect(() => {
    if (discardPrompt) continueButton.current?.focus()
  }, [discardPrompt])
  function continueEditing() {
    setDiscardPrompt(false)
    requestAnimationFrame(() => returnFocus.current?.focus())
  }
  function requestClose() {
    if (busy) return
    if (discardPrompt) {
      continueEditing()
      return
    }
    if (!dirty) {
      close()
      return
    }
    returnFocus.current =
      document.activeElement instanceof HTMLElement
        ? document.activeElement
        : null
    setDiscardPrompt(true)
  }
  async function perform(operation: () => Promise<unknown>, success: string) {
    setBusy(true)
    setMessage('')
    try {
      const result = await operation()
      setMessage(typeof result === 'string' ? result : success)
    } catch (error) {
      setMessage(
        error instanceof Error ? error.message : 'Settings operation failed.'
      )
    } finally {
      setBusy(false)
    }
  }
  return (
    <dialog
      ref={dialog}
      className="developer-dialog"
      aria-label="Developer settings"
      onCancel={(event) => {
        event.preventDefault()
        requestClose()
      }}
    >
      <div className="dialog-heading">
        <h2>Developer settings</h2>
        <button
          disabled={busy || discardPrompt}
          onClick={requestClose}
          aria-label="Close developer settings"
        >
          ×
        </button>
      </div>
      <p>
        Preferences stay on this device. App history is opt-in and stored as
        local text. Never capture sensitive commands; filtering cannot find
        every secret.
      </p>
      <form
        onSubmit={(event) => {
          event.preventDefault()
          void perform(
            () => save(parsePreferences(draft)),
            'Developer settings saved. History policy applies to new sessions.'
          )
        }}
      >
        <fieldset disabled={busy}>
          <legend>Privacy and assistance</legend>
          <label>
            <input
              type="checkbox"
              checked={!!draft.confirmClose}
              onChange={(event) =>
                setDraft({ ...draft, confirmClose: event.target.checked })
              }
            />
            Confirm before closing terminal views
          </label>
          <p>
            Applies to pane and tab closure. App quit, Stop session and update
            installation keep their separate behavior.
          </p>
          <label>
            <input
              type="checkbox"
              checked={draft.history.enabled}
              onChange={(event) =>
                setDraft({
                  ...draft,
                  history: { ...draft.history, enabled: event.target.checked }
                })
              }
            />
            Enable local command history for new PowerShell tabs
          </label>
          <label>
            History retention
            <input
              aria-label="History retention"
              type="number"
              min={50}
              max={1000}
              value={draft.history.limit}
              onChange={(event) =>
                setDraft({
                  ...draft,
                  history: {
                    ...draft.history,
                    limit: Number(event.target.value)
                  }
                })
              }
            />
          </label>
          <label>
            <input
              type="checkbox"
              checked={draft.explanations}
              onChange={(event) =>
                setDraft({ ...draft, explanations: event.target.checked })
              }
            />
            Enable offline command explanations
          </label>
          <p>
            Your local draft has not been saved. Discarding keeps your saved
            preferences.
          </p>
          <button ref={continueButton} onClick={continueEditing}>
            Continue editing
          </button>
          <button onClick={close}>Discard edits</button>
        </section>
      )}
      <div hidden={discardPrompt}>
        <p aria-live="polite">
          {dirty
            ? 'Unsaved local draft edits. Save to apply them.'
            : 'Showing saved preferences. No unsaved edits.'}
        </p>
        <p>
          Preferences stay on this device. App history is opt-in and stored as
          local text. Never capture sensitive commands; filtering cannot find
          every secret.
        </p>
        <form
          onSubmit={(event) => {
            event.preventDefault()
            void perform(
              () => save(parsePreferences(draft)),
              'Developer settings saved. History policy applies to new sessions.'
            )
          }}
        >
          <fieldset disabled={busy}>
            <legend>Privacy and assistance</legend>
            <label>
              <input
                type="checkbox"
                checked={draft.history.enabled}
                onChange={(event) =>
                  setDraft({
                    ...draft,
                    history: { ...draft.history, enabled: event.target.checked }
                  })
                }
              />
              Enable local command history for new PowerShell tabs
            </label>
            <label>
              History retention
              <input
                aria-label="History retention"
                type="number"
                min={50}
                max={1000}
                value={draft.history.limit}
                onChange={(event) =>
                  setDraft({
                    ...draft,
                    history: {
                      ...draft.history,
                      limit: Number(event.target.value)
                    }
                  })
                }
              />
            </label>
            <label>
              <input
                type="checkbox"
                checked={draft.explanations}
                onChange={(event) =>
                  setDraft({ ...draft, explanations: event.target.checked })
                }
              />
              Enable offline command explanations
            </label>
            <p>
              Explanations use a small static reference. No command or output is
              sent to a provider or executed.
            </p>
            <label>
              <input
                type="checkbox"
                checked={draft.restoration.enabled}
                onChange={(event) =>
                  setDraft({
                    ...draft,
                    restoration: {
                      ...draft.restoration,
                      enabled: event.target.checked
                    }
                  })
                }
              />
              Offer saved layout on next launch
            </label>
            <p>
              Saving a layout records launch folders and shells only. Private
              tabs are excluded. Restoring always starts fresh processes.
            </p>
          </fieldset>
          <fieldset disabled={busy}>
            <legend>Application shortcuts</legend>
            <p>
              Use distinct Ctrl+Shift+letter bindings. Plain Ctrl+C, Tab and
              shell/OS combinations remain reserved.
            </p>
            {ACTIONS.map((action) => (
              <label key={action}>
                {shortcutLabels[action]}
                <input
                  aria-label={`Shortcut ${shortcutLabels[action]}`}
                  maxLength={12}
                  value={draft.shortcuts[action]}
                  onChange={(event) =>
                    setDraft({
                      ...draft,
                      shortcuts: {
                        ...draft.shortcuts,
                        [action]: event.target.value
                      }
                    })
                  }
                />
              </label>
            ))}
            <button
              type="button"
              onClick={() => {
                setDraft({ ...draft, shortcuts: { ...DEFAULT_SHORTCUTS } })
                setMessage(
                  'Shortcut defaults applied to local draft. Save to keep them.'
                )
              }}
            >
              Reset shortcut defaults
            </button>
          </fieldset>
          <fieldset disabled={busy}>
            <legend>Projects</legend>
            {!draft.projects.length && (
              <p>Choose Open project in the workspace to add a local folder.</p>
            )}
            {draft.projects.map((project) => (
              <div key={project.id} className="project-row">
                <span>
                  {project.name} — {project.cwd}
                </span>
                <button
                  type="button"
                  aria-label={`Remove project ${project.name}`}
                  onClick={() =>
                    setDraft({
                      ...draft,
                      projects: draft.projects.filter(
                        (item) => item.id !== project.id
                      ),
                      restoration: { ...draft.restoration, tabs: [] }
                    })
                  }
                >
                  Remove project and saved layout
                </button>
              </div>
            ))}
          </fieldset>
          <button type="submit" disabled={busy}>
            Save developer settings
          </button>
        </form>
        <h3>Saved data operations</h3>
        <p>
          Export uses saved preferences. Save or discard local edits before
          importing, resetting or saving a layout.
        </p>
        <div className="developer-operations">
          <button
            disabled={busy || dirty}
            onClick={() =>
              void perform(saveLayout, 'Current non-private layout saved.')
            }
          >
            Save current layout
          </button>
          <button
            disabled={busy || dirty}
            onClick={() =>
              void perform(async () => {
                const result = await window.desktop.importPreferences()
                if (result) {
                  await reload()
                  return 'Settings imported and saved.'
                }
                return 'Import canceled. Saved preferences unchanged.'
              }, 'Settings imported and saved.')
            }
          >
            Import settings
          </button>
          <button
            disabled={busy}
            onClick={() =>
              void perform(async () => {
                if (!(await window.desktop.exportPreferences()))
                  throw new Error('Export canceled.')
              }, 'Settings exported. Project folder paths are included; history is excluded.')
            }
          >
            Export settings
          </button>
          <button
            disabled={busy}
            onClick={() =>
              void perform(async () => {
                await window.desktop.clearHistory()
              }, 'App history cleared.')
            }
          >
            Clear history
          </button>
          <button
            disabled={busy || dirty}
            onClick={() =>
              void perform(async () => {
                await window.desktop.resetPreferences()
                await reload()
              }, 'Saved preferences reset to defaults.')
            }
          >
            Reset developer settings
          </button>
        </div>
        {message && <p role="status">{message}</p>}
      </div>
    </dialog>
  )
}
