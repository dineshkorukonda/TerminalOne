// Coalesce pointer updates per split per animation frame; flush the final drag.
export function createSplitDrag(
  resize: (id: string, ratio: number) => void,
  requestFrame: (callback: () => void) => number,
  cancelFrame: (id: number) => void
) {
  const pending = new Map<string, number>()
  let frame: number | null = null
  let disposed = false
  function flush() {
    if (frame !== null) cancelFrame(frame)
    frame = null
    if (disposed) return
    const updates = [...pending]
    pending.clear()
    for (const [id, ratio] of updates) resize(id, ratio)
  }
  return {
    update(id: string, ratio: number) {
      if (disposed || !Number.isFinite(ratio)) return
      pending.set(id, ratio)
      if (frame === null) frame = requestFrame(flush)
    },
    flush,
    dispose() {
      disposed = true
      if (frame !== null) cancelFrame(frame)
      frame = null
      pending.clear()
    }
  }
}
