import { useEffect, useRef, useState } from 'react'
import type { UpdateStatus } from '../../../contracts/updates'

export function UpdateSettings({
  status,
  change,
  close
}: {
  status: UpdateStatus | null
  change(status: UpdateStatus): void
  close(): void
}) {
  const dialog = useRef<HTMLDialogElement>(null)
  const [error, setError] = useState('')
  useEffect(() => {
    dialog.current?.showModal()
  }, [])
  const busy =
    status && ['checking', 'downloading', 'installing'].includes(status.phase)
  async function action(run: () => Promise<UpdateStatus>) {
    setError('')
    try {
      change(await run())
    } catch {
      setError('The update action could not be completed. Please try again.')
    }
  }
  return (
    <dialog
      className="updates-dialog"
      ref={dialog}
      aria-labelledby="updates-heading"
      onCancel={(event) => {
        event.preventDefault()
        close()
      }}
    >
      <div className="dialog-heading">
        <h2 id="updates-heading">Updates</h2>
        <button onClick={close} aria-label="Close updates">
          Close
        </button>
      </div>
      <p>Terminal One {status?.currentVersion ?? ''}</p>
      {status?.version &&
        ['downloading', 'downloaded', 'installing'].includes(status.phase) && (
          <p>Update {status.version}</p>
        )}
      <p role="status" aria-live="polite">
        {status?.message ?? 'Update status is not available.'}
      </p>
      {error && <p role="alert">{error}</p>}
      {status?.phase === 'downloading' && (
        <label className="update-progress">
          Download {status.progress}%
          <progress
            aria-label="Update download"
            max="100"
            value={status.progress}
          />
        </label>
      )}
      <div className="update-actions">
        <button
          disabled={
            !status ||
            status.phase === 'unavailable' ||
            !!busy ||
            status.phase === 'downloaded'
          }
          onClick={() => {
            void action(window.desktop.checkForUpdates)
          }}
        >
          Check for updates
        </button>
        {status?.phase === 'available' && (
          <button
            onClick={() => {
              void action(window.desktop.downloadUpdate)
            }}
          >
            Download {status.version}
          </button>
        )}
        {status?.phase === 'downloaded' && (
          <button
            onClick={() => {
              void action(window.desktop.installUpdate)
            }}
          >
            Restart and install
          </button>
        )}
      </div>
      <p className="update-note">
        Alpha updates are currently unsigned. Your settings are kept. Restarting
        to install closes all terminal sessions.
      </p>
    </dialog>
  )
}
