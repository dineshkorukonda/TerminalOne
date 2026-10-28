import { useEffect, useRef } from 'react'

export function CloseConfirmation({
  count,
  cancel,
  confirm
}: {
  count: number
  cancel(): void
  confirm(): void
}) {
  const dialog = useRef<HTMLDialogElement>(null)
  const cancelButton = useRef<HTMLButtonElement>(null)
  useEffect(() => {
    dialog.current?.showModal()
    cancelButton.current?.focus()
  }, [])
  return (
    <dialog
      ref={dialog}
      className="developer-dialog"
      aria-label="Close terminal views"
      onCancel={(event) => {
        event.preventDefault()
        cancel()
      }}
    >
      <h2>
        Close {count} terminal {count === 1 ? 'view' : 'views'}?
      </h2>
      <p>
        Running work in {count === 1 ? 'this view' : 'these views'} will stop.
        Closing removes the {count === 1 ? 'pane' : 'panes'} and their output.
      </p>
      <button ref={cancelButton} onClick={cancel}>
        Cancel
      </button>
      <button onClick={confirm}>
        Close {count} {count === 1 ? 'view' : 'views'}
      </button>
    </dialog>
  )
}
