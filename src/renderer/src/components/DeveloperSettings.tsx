import { useEffect, useRef, useState } from 'react'
import {
  ACTIONS,
  DEFAULT_SHORTCUTS,
  parsePreferences
} from '../../../contracts/preferences'
import type { Preferences } from '../../../contracts/preferences'

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
  const [message, setMessage] = useState('')
  const [busy, setBusy] = useState(false)
  useEffect(() => {
    dialog.current?.showModal()
  }, [])
  useEffect(() => {
    setDraft(settings)
  }, [settings])
  async function perform(operation: () => Promise<unknown>, success: string) {
    setBusy(true)
    setMessage('')
    try {
      await operation()
      setMessage(success)
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
        close()
      }}
    >
      <div className="dialog-heading">
        <h2>Developer settings</h2>
        <button onClick={close} aria-label="Close developer settings">
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
            Saving a layout records launch folders and shells only. Private tabs
            are excluded. Restoring always starts fresh processes.
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
              {action}
              <input
                aria-label={`Shortcut ${action}`}
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
            onClick={() =>
              setDraft({ ...draft, shortcuts: { ...DEFAULT_SHORTCUTS } })
            }
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
      <div className="developer-operations">
        <button
          disabled={busy}
          onClick={() =>
            void perform(saveLayout, 'Current non-private layout saved.')
          }
        >
          Save current layout
        </button>
        <button
          disabled={busy}
          onClick={() =>
            void perform(async () => {
              const result = await window.desktop.importPreferences()
              if (result) {
                await reload()
                close()
              }
            }, 'Import canceled.')
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
          disabled={busy}
          onClick={() =>
            void perform(async () => {
              await window.desktop.resetPreferences()
              await reload()
              close()
            }, 'Settings reset.')
          }
        >
          Reset developer settings
        </button>
      </div>
      {message && <p role="status">{message}</p>}
    </dialog>
  )
}
