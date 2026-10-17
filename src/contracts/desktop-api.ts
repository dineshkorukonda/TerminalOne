export interface AppInfo {
  name: string
  version: string
}

export interface DesktopApi {
  getAppInfo(): Promise<AppInfo>
  openExternal(url: string): Promise<void>
}

export const IPC_CHANNELS = {
  getAppInfo: 'desktop:get-app-info',
  openExternal: 'desktop:open-external'
} as const
