export interface Grid {
  cols: number
  rows: number
}
export interface Shell {
  id: string
  name: string
  executable: string
  args: string[]
}
export type PtyEvent =
  | { type: 'data'; data: string; sequence: number }
  | { type: 'exit'; exitCode: number }
  | { type: 'error'; message: string }
export interface PtyHandle {
  pid: number
  write(data: string): Promise<void>
  resize(grid: Grid): Promise<void>
  acknowledge(sequence: number): Promise<void>
  close(): Promise<void>
}
export interface PtyPort {
  start(
    id: string,
    shell: Shell,
    cwd: string,
    grid: Grid,
    emit: (event: PtyEvent) => void
  ): Promise<PtyHandle>
  onFailure(callback: () => void): () => void
  dispose(): Promise<void>
}
export function validateGrid(value: unknown): Grid {
  if (!value || typeof value !== 'object')
    throw new Error('Invalid terminal dimensions')
  const grid = value as Record<string, unknown>
  if (
    !Number.isInteger(grid['cols']) ||
    !Number.isInteger(grid['rows']) ||
    Number(grid['cols']) < 2 ||
    Number(grid['cols']) > 500 ||
    Number(grid['rows']) < 1 ||
    Number(grid['rows']) > 300
  )
    throw new Error('Invalid terminal dimensions')
  return { cols: Number(grid['cols']), rows: Number(grid['rows']) }
}
export function validateInput(value: unknown): string {
  if (typeof value !== 'string' || value.length > 16384)
    throw new Error('Terminal input must be at most 16384 characters')
  return value
}
