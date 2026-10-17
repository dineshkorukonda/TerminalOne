import { contextBridge, ipcRenderer } from 'electron'
import type { DesktopApi, SessionEvent } from '../contracts/desktop-api'
import { IPC_CHANNELS } from '../contracts/desktop-api'

const api: DesktopApi = Object.freeze({
  getPreferences: (...args: unknown[]) =>
    ipcRenderer.invoke(IPC_CHANNELS.getPreferences, ...args),
  savePreferences: (...args: unknown[]) =>
    ipcRenderer.invoke(IPC_CHANNELS.savePreferences, ...args),
  resetPreferences: (...args: unknown[]) =>
    ipcRenderer.invoke(IPC_CHANNELS.resetPreferences, ...args),
  chooseProject: (...args: unknown[]) =>
    ipcRenderer.invoke(IPC_CHANNELS.chooseProject, ...args),
  importPreferences: (...args: unknown[]) =>
    ipcRenderer.invoke(IPC_CHANNELS.importPreferences, ...args),
  exportPreferences: (...args: unknown[]) =>
    ipcRenderer.invoke(IPC_CHANNELS.exportPreferences, ...args),
  searchHistory: (...args: unknown[]) =>
    ipcRenderer.invoke(IPC_CHANNELS.searchHistory, ...args),
  clearHistory: (...args: unknown[]) =>
    ipcRenderer.invoke(IPC_CHANNELS.clearHistory, ...args),
  explainCommand: (...args: unknown[]) =>
    ipcRenderer.invoke(IPC_CHANNELS.explainCommand, ...args),
  readClipboard: (...args: unknown[]) =>
    ipcRenderer.invoke(IPC_CHANNELS.readClipboard, ...args),
  writeClipboard: (...args: unknown[]) =>
    ipcRenderer.invoke(IPC_CHANNELS.writeClipboard, ...args),
  getAppInfo: (...args: unknown[]) =>
    ipcRenderer.invoke(IPC_CHANNELS.getAppInfo, ...args),
  openExternal: (url: string, ...extra: unknown[]) =>
    ipcRenderer.invoke(IPC_CHANNELS.openExternal, url, ...extra),
  listShells: (...args: unknown[]) =>
    ipcRenderer.invoke(IPC_CHANNELS.listShells, ...args),
  createSession: (...args: unknown[]) =>
    ipcRenderer.invoke(IPC_CHANNELS.createSession, ...args),
  writeSession: (...args: unknown[]) =>
    ipcRenderer.invoke(IPC_CHANNELS.writeSession, ...args),
  resizeSession: (...args: unknown[]) =>
    ipcRenderer.invoke(IPC_CHANNELS.resizeSession, ...args),
  closeSession: (...args: unknown[]) =>
    ipcRenderer.invoke(IPC_CHANNELS.closeSession, ...args),
  acknowledgeSession: (...args: unknown[]) =>
    ipcRenderer.invoke(IPC_CHANNELS.acknowledgeSession, ...args),
  onSessionEvent: (listener: (event: SessionEvent) => void) => {
    if (typeof listener !== 'function')
      throw new Error('Expected a terminal listener')
    const receive = (_event: unknown, data: SessionEvent) => listener(data)
    ipcRenderer.on(IPC_CHANNELS.sessionEvent, receive)
    return () => {
      ipcRenderer.removeListener(IPC_CHANNELS.sessionEvent, receive)
    }
  }
})

contextBridge.exposeInMainWorld('desktop', api)
