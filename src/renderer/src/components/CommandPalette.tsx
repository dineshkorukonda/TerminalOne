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
  const filterInput = useRef<HTMLInputElement>(null)
  const [filter, setFilter] = useState('')
  useEffect(() => {
    dialog.current?.showModal()
    filterInput.current?.focus()
  }, [])
  const matches = actions.filter((action) =>
    action.label.toLowerCase().includes(filter.toLowerCase())
  )
  return (
    <dialog
      ref={dialog}
      className="command-palette"
      aria-label="Application commands"
      onKeyDown={(event) => {
        const buttons = Array.from(
          dialog.current?.querySelectorAll<HTMLButtonElement>(
            '.palette-action'
          ) ?? []
        )
        if (!buttons.length) return
        const index = buttons.findIndex((button) => button === event.target)
        const inFilter = event.target === filterInput.current
        if (!inFilter && index < 0) return
        let next: number
        if (event.key === 'ArrowDown') next = (index + 1) % buttons.length
        else if (event.key === 'ArrowUp')
          next = index <= 0 ? buttons.length - 1 : index - 1
        else if (!inFilter && event.key === 'Home') next = 0
        else if (!inFilter && event.key === 'End') next = buttons.length - 1
        else return
        event.preventDefault()
        buttons[next]?.focus()
      }}
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
        ref={filterInput}
        aria-label="Filter application commands"
        autoFocus
        maxLength={128}
        value={filter}
        onChange={(event) => setFilter(event.target.value)}
        onKeyDown={(event) => {
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
