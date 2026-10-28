import { useEffect, useRef, useState } from 'react'
import { parseTabTitle } from '../../../contracts/preferences'

export function RenameTab({
  title,
  save,
  close
}: {
  title: string
  save(title: string): void
  close(): void
}) {
  const dialog = useRef<HTMLDialogElement>(null)
  const input = useRef<HTMLInputElement>(null)
  const [name, setName] = useState(title)
  const [error, setError] = useState('')
  useEffect(() => {
    dialog.current?.showModal()
    input.current?.select()
  }, [])
  return (
    <dialog
      ref={dialog}
      className="developer-dialog"
      aria-label="Rename tab"
      onCancel={(event) => {
        event.preventDefault()
        close()
      }}
    >
      <form
        onSubmit={(event) => {
          event.preventDefault()
          try {
            save(parseTabTitle(name))
          } catch {
            setError('Enter a tab name with 1 to 80 characters.')
          }
        }}
      >
        <h2>Rename tab</h2>
        <label>
          Tab name
          <input
            ref={input}
            aria-label="Tab name"
            autoFocus
            maxLength={80}
            value={name}
            onChange={(event) => {
              setName(event.target.value)
              setError('')
            }}
          />
        </label>
        {error && <p role="alert">{error}</p>}
        <button type="button" onClick={close}>
          Cancel
        </button>
        <button type="submit">Save tab name</button>
      </form>
    </dialog>
  )
}
