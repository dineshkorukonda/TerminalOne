import { dialog, ipcMain } from 'electron'
import type { BrowserWindow, IpcMainInvokeEvent } from 'electron'
import { IPC_CHANNELS } from '../../contracts/desktop-api'
import { authorizeSender, validateArguments } from './policy'
import type { UpdateService } from '../updates/service'

export function registerUpdateIpc(
  window: BrowserWindow,
  trustedUrl: string,
  updates: UpdateService
) {
  const authorize = (event: IpcMainInvokeEvent, args: unknown[]) => {
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
    validateArguments(args, 0)
  }
  const handlers = [
    [IPC_CHANNELS.getUpdateStatus, () => updates.current()],
    [IPC_CHANNELS.checkForUpdates, () => updates.check()],
    [IPC_CHANNELS.downloadUpdate, () => updates.download()],
    [
      IPC_CHANNELS.installUpdate,
      () =>
        updates.install(async () => {
          const result = await dialog.showMessageBox(window, {
            type: 'question',
            buttons: ['Cancel', 'Restart and install'],
            defaultId: 0,
            cancelId: 0,
            message: 'Restart Terminal One to install the update?',
            detail:
              'All terminal sessions will close. Finish running commands and save your work before continuing.'
          })
          return result.response === 1
        })
    ]
  ] as const
  for (const [channel, run] of handlers)
    ipcMain.handle(channel, (event, ...args: unknown[]) => {
      authorize(event, args)
      return run()
    })
  const detach = updates.subscribe((status) => {
    if (!window.webContents.isDestroyed())
      window.webContents.send(IPC_CHANNELS.updateStatusEvent, status)
  })
  return () => {
    detach()
    for (const [channel] of handlers) ipcMain.removeHandler(channel)
  }
}
