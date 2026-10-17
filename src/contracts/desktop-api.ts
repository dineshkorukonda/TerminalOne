export interface AppInfo {
  name: string
  version: string
}
export interface ShellInfo {
  id: string
  name: string
}
export interface Grid {
  cols: number
  rows: number
}
export interface SessionInfo {
  id: string
  state: 'starting' | 'running' | 'exited' | 'failed' | 'closed'
  pid: number | null
  shellId: string
  exitCode: number | null
}
export type SessionEvent =
  | ({ type: 'state' } & SessionInfo)
  | { type: 'data'; id: string; data: string; sequence: number }
  | { type: 'exit'; id: string; exitCode: number }
  | { type: 'error'; id: string; message: string }
export interface DesktopApi {
  getAppInfo(): Promise<AppInfo>
  openExternal(url: string): Promise<void>
  listShells(): Promise<ShellInfo[]>
  createSession(options: Grid & { shellId: string }): Promise<SessionInfo>
  writeSession(id: string, data: string): Promise<void>
  resizeSession(id: string, grid: Grid): Promise<void>
  closeSession(id: string): Promise<void>
  acknowledgeSession(id: string, sequence: number): Promise<void>
  onSessionEvent(listener: (event: SessionEvent) => void): () => void
}
export const IPC_CHANNELS = {
  getAppInfo: 'desktop:get-app-info',
  openExternal: 'desktop:open-external',
  listShells: 'terminal:list-shells',
  createSession: 'terminal:create',
  writeSession: 'terminal:write',
  resizeSession: 'terminal:resize',
  closeSession: 'terminal:close',
  acknowledgeSession: 'terminal:acknowledge',
  sessionEvent: 'terminal:event'
} as const
