import type { Grid } from '../../contracts/desktop-api'

// Keep the latest observed grid while one native resize is in flight.
export function createGridSender(
  send: (grid: Grid) => Promise<void>,
  failed: () => void
) {
  let next: Grid | undefined
  let previous = ''
  let sending = false
  let disposed = false
  async function flush() {
    if (sending || disposed) return
    sending = true
    try {
      while (next && !disposed) {
        const grid = next
        next = undefined
        const key = `${grid.cols}:${grid.rows}`
        if (key === previous) continue
        await send(grid)
        previous = key
      }
    } catch {
      if (!disposed) failed()
    } finally {
      sending = false
    }
  }
  return {
    update(grid: Grid) {
      if (
        disposed ||
        !Number.isInteger(grid.cols) ||
        !Number.isInteger(grid.rows) ||
        grid.cols < 2 ||
        grid.cols > 500 ||
        grid.rows < 1 ||
        grid.rows > 300
      )
        return
      next = { ...grid }
      void flush()
    },
    dispose() {
      disposed = true
      next = undefined
    }
  }
}
