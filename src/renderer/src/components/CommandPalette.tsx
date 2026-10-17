import { useEffect, useRef, useState } from 'react'
export interface PaletteAction {
  id: string
  label: string
  run(): void
}
export function CommandPalette({
  actions,
  close
}: {
  actions: PaletteAction[]
  close(restore?: boolean): void
}) {
  const dialog = useRef<HTMLDialogElement>(null)
  const [filter, setFilter] = useState('')
  useEffect(() => {
    dialog.current?.showModal()
  }, [])
  const matches = actions.filter((action) =>
    action.label.toLowerCase().includes(filter.toLowerCase())
  )
  return (
    <dialog
      ref={dialog}
      className="command-palette"
      aria-label="Application commands"
      onCancel={(event) => {
        event.preventDefault()
        close()
      }}
    >
      <div className="dialog-heading">
        <h2>Application commands</h2>
        <button aria-label="Close command palette" onClick={() => close()}>
          ×
        </button>
      </div>
      <input
        aria-label="Filter application commands"
        autoFocus
        maxLength={128}
        value={filter}
        onChange={(event) => setFilter(event.target.value)}
        onKeyDown={(event) => {
          if (event.key === 'ArrowDown') {
            event.preventDefault()
            dialog.current
              ?.querySelector<HTMLButtonElement>('.palette-action')
              ?.focus()
          }
          if (event.key === 'Enter' && matches[0]) {
            event.preventDefault()
            matches[0].run()
            close(
              !['search', 'settings', 'developer', 'draft'].includes(
                matches[0].id
              )
            )
          }
        }}
      />
      <div className="palette-results">
        {matches.map((action) => (
          <button
            className="palette-action"
            key={action.id}
            onClick={() => {
              action.run()
              close(
                !['search', 'settings', 'developer', 'draft'].includes(
                  action.id
                )
              )
            }}
          >
            {action.label}
          </button>
        ))}
        {!matches.length && <p>No matching actions</p>}
      </div>
    </dialog>
  )
}
