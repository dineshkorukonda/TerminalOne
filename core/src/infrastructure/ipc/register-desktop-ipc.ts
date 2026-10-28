import { ipcMain, shell, clipboard } from 'electron'
import type { BrowserWindow, IpcMainInvokeEvent } from 'electron'
import type { AppInfo } from '../../contracts/desktop-api'
import { IPC_CHANNELS } from '../../contracts/desktop-api'
import {
  authorizeSender,
  validateArguments,
  validateExternalUrl
} from './policy'

export function registerDesktopIpc(
  window: BrowserWindow,
  trustedUrl: string,
  info: AppInfo
): () => void {
  function authorize(event: IpcMainInvokeEvent): void {
    authorizeSender(
      {
        sender: event.sender,
        frame: event.senderFrame,
        url: event.senderFrame?.url ?? ''
      },
      {
        sender: window.webContents,
        frame: window.webContents.mainFrame,
        url: trustedUrl
      }
    )
  }

  ipcMain.handle(IPC_CHANNELS.getAppInfo, (event, ...args: unknown[]) => {
    authorize(event)
    validateArguments(args, 0)
    return { ...info }
  })
  ipcMain.handle(
    IPC_CHANNELS.openExternal,
    async (event, ...args: unknown[]) => {
      authorize(event)
      validateArguments(args, 1)
      const url = validateExternalUrl(args[0])
      await shell.openExternal(url)
    }
  )

  ipcMain.handle(
    IPC_CHANNELS.readClipboard,
    async (event, ...args: unknown[]) => {
      authorize(event)
      validateArguments(args, 0)
      const text = await clipboard.readText()
      if (text.length > 262144)
        throw new Error('Clipboard text exceeds 262144 characters')
      return text
    }
  )
  ipcMain.handle(IPC_CHANNELS.writeClipboard, (event, ...args: unknown[]) => {
    authorize(event)
    validateArguments(args, 1)
    if (typeof args[0] !== 'string' || args[0].length > 262144)
      throw new Error('Invalid clipboard text')
    return clipboard.writeText(args[0])
  })
  return () => {
    ipcMain.removeHandler(IPC_CHANNELS.readClipboard)
    ipcMain.removeHandler(IPC_CHANNELS.writeClipboard)
    ipcMain.removeHandler(IPC_CHANNELS.getAppInfo)
    ipcMain.removeHandler(IPC_CHANNELS.openExternal)
  }
}
