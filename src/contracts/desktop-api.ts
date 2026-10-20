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
  | { type: 'integration'; id: string; ready: boolean }
  | ({ type: 'state' } & SessionInfo)
  | { type: 'data'; id: string; data: string; sequence: number }
  | { type: 'exit'; id: string; exitCode: number }
  | { type: 'error'; id: string; message: string }
export interface DesktopApi {
  getUpdateStatus(): Promise<UpdateStatus>
  checkForUpdates(): Promise<UpdateStatus>
  downloadUpdate(): Promise<UpdateStatus>
  installUpdate(): Promise<UpdateStatus>
  onUpdateStatus(listener: (status: UpdateStatus) => void): () => void
  getPreferences(): Promise<{ settings: Preferences; warning: string }>
  savePreferences(
    settings: Preferences
  ): Promise<{ settings: Preferences; warning: string }>
  resetPreferences(): Promise<{ settings: Preferences; warning: string }>
  chooseProject(shellId: string): Promise<Project | null>
  importPreferences(): Promise<{
    settings: Preferences
    warning: string
  } | null>
  exportPreferences(): Promise<boolean>
  searchHistory(query: string, shellId: string): Promise<HistoryEntry[]>
  clearHistory(): Promise<void>
  explainCommand(command: string): Promise<string>
  readClipboard(): Promise<string>
  writeClipboard(text: string): Promise<void>
  getAppInfo(): Promise<AppInfo>
  openExternal(url: string): Promise<void>
  listShells(): Promise<ShellInfo[]>
  createSession(
    options: Grid & {
      shellId: string
      projectId?: string | null
      private?: boolean
    }
  ): Promise<SessionInfo>
  writeSession(id: string, data: string): Promise<void>
  resizeSession(id: string, grid: Grid): Promise<void>
  closeSession(id: string): Promise<void>
  acknowledgeSession(id: string, sequence: number): Promise<void>
  onSessionEvent(listener: (event: SessionEvent) => void): () => void
}
export const IPC_CHANNELS = {
  getUpdateStatus: 'updates:status',
  checkForUpdates: 'updates:check',
  downloadUpdate: 'updates:download',
  installUpdate: 'updates:install',
  updateStatusEvent: 'updates:event',
  getPreferences: 'preferences:get',
  savePreferences: 'preferences:save',
  resetPreferences: 'preferences:reset',
  chooseProject: 'preferences:choose-project',
  importPreferences: 'preferences:import',
  exportPreferences: 'preferences:export',
  searchHistory: 'history:search',
  clearHistory: 'history:clear',
  explainCommand: 'assistant:explain-local',
  getAppInfo: 'desktop:get-app-info',
  readClipboard: 'desktop:read-clipboard',
  writeClipboard: 'desktop:write-clipboard',
  openExternal: 'desktop:open-external',
  listShells: 'terminal:list-shells',
  createSession: 'terminal:create',
  writeSession: 'terminal:write',
  resizeSession: 'terminal:resize',
  closeSession: 'terminal:close',
  acknowledgeSession: 'terminal:acknowledge',
  sessionEvent: 'terminal:event'
} as const
import type { Preferences, HistoryEntry, Project } from './preferences'
import type { UpdateStatus } from './updates'
