import { contextBridge, ipcRenderer } from 'electron'
import type { DesktopApi } from '../contracts/desktop-api'
import { IPC_CHANNELS } from '../contracts/desktop-api'

const api: DesktopApi = Object.freeze({
  getAppInfo: (...args: unknown[]) =>
    ipcRenderer.invoke(IPC_CHANNELS.getAppInfo, ...args),
  openExternal: (url: string, ...extra: unknown[]) =>
    ipcRenderer.invoke(IPC_CHANNELS.openExternal, url, ...extra)
})

contextBridge.exposeInMainWorld('desktop', api)
