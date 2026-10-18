import { ipcMain, type BrowserWindow } from 'electron'
import { randomUUID } from 'node:crypto'
import { homedir } from 'node:os'
import { stat } from 'node:fs/promises'
import type { PreferenceRepository } from '../preferences/repository'
import { Sessions } from '../../application/terminal/sessions'
import { UtilityPtyPort } from '../pty/client'
import { SessionPtyPort } from '../pty/session-port'
import { discoverShells, selectShell } from '../shells/discover'
import { IPC_CHANNELS } from '../../contracts/desktop-api'
import { authorizeSender, validateArguments } from './policy'

export function registerTerminalIpc(
  window: BrowserWindow,
  trustedUrl: string,
  preferences: PreferenceRepository
) {
  const owner = String(window.webContents.id)
  let active = true
  let generation = 0
  let rendererAvailable = true
  const sessions = new Sessions(
    new SessionPtyPort(() => new UtilityPtyPort()),
    randomUUID,
    (_owner, event) => {
      if (active && rendererAvailable && !window.webContents.isDestroyed())
        window.webContents.send(IPC_CHANNELS.sessionEvent, event)
    },
    (shell, command) => {
      void preferences.record(shell, command).catch(() => {})
    }
  )
  const channels: string[] = []
  function handle(
    channel: string,
    count: number,
    callback: (...args: unknown[]) => unknown
  ) {
    channels.push(channel)
    ipcMain.handle(channel, (event, ...args: unknown[]) => {
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
      if (!active) throw new Error('Terminal window is closing')
      validateArguments(args, count)
      return callback(...args)
    })
  }
  function id(value: unknown): string {
    if (typeof value !== 'string' || !/^[a-zA-Z0-9-]{1,80}$/.test(value))
      throw new Error('Invalid terminal session')
    return value
  }
  handle(IPC_CHANNELS.listShells, 0, async () =>
    (await discoverShells()).map(({ id, name }) => ({ id, name }))
  )
  handle(IPC_CHANNELS.createSession, 1, async (value) => {
    if (!value || typeof value !== 'object' || Array.isArray(value))
      throw new Error('Invalid terminal options')
    const options = value as Record<string, unknown>
    if (
      !['cols', 'rows', 'shellId'].every((key) =>
        Object.hasOwn(options, key)
      ) ||
      Object.keys(options).some(
        (key) =>
          !['cols', 'rows', 'shellId', 'projectId', 'private'].includes(key)
      ) ||
      typeof options['shellId'] !== 'string' ||
      (options['private'] !== undefined &&
        typeof options['private'] !== 'boolean') ||
      (options['projectId'] !== undefined &&
        options['projectId'] !== null &&
        typeof options['projectId'] !== 'string')
    )
      throw new Error('Invalid terminal options')
    const expected = generation
    const shell = selectShell(await discoverShells(), options['shellId'])
    const settings = preferences.current().settings
    const project = options['projectId']
      ? settings.projects.find((project) => project.id === options['projectId'])
      : null
    if (options['projectId'] && !project)
      throw new Error('Project is unavailable. Choose a valid project folder.')
    const cwd = project?.cwd ?? homedir()
    try {
      if (!(await stat(cwd)).isDirectory()) throw new Error('Not a directory')
    } catch {
      throw new Error(
        'Project folder is missing or unavailable. Choose another project.'
      )
    }
    const privateHistory = options['private'] === true
    if (privateHistory && !['powershell', 'pwsh'].includes(shell.id))
      throw new Error(
        'Private shell-history integration currently requires PowerShell.'
      )
    shell.historyIntegration =
      (settings.history.enabled || privateHistory) &&
      ['powershell', 'pwsh'].includes(shell.id)
    shell.privateHistory = privateHistory
    if (!active || generation !== expected || window.webContents.isDestroyed())
      throw new Error('Terminal window is closing')
    return sessions.create(owner, shell, cwd, {
      cols: options['cols'] as number,
      rows: options['rows'] as number
    })
  })
  handle(IPC_CHANNELS.writeSession, 2, (sessionId, data) =>
    sessions.write(owner, id(sessionId), data)
  )
  handle(IPC_CHANNELS.resizeSession, 2, (sessionId, grid) =>
    sessions.resize(
      owner,
      id(sessionId),
      grid as { cols: number; rows: number }
    )
  )
  handle(IPC_CHANNELS.closeSession, 1, (sessionId) =>
    sessions.close(owner, id(sessionId))
  )
  handle(IPC_CHANNELS.acknowledgeSession, 2, (sessionId, sequence) =>
    sessions.acknowledge(owner, id(sessionId), sequence as number)
  )
  const lost = () => {
    generation++
    rendererAvailable = false
    void sessions.closeOwner(owner)
  }
  window.webContents.on('render-process-gone', lost)
  window.webContents.on('did-finish-load', () => {
    rendererAvailable = true
  })
  window.webContents.on(
    'did-start-navigation',
    (_event, _url, inPlace, mainFrame) => {
      if (mainFrame && !inPlace) lost()
    }
  )
  window.once('closed', () => {
    void dispose()
  })
  let disposing: Promise<void> | undefined
  function dispose(): Promise<void> {
    if (disposing) return disposing
    active = false
    for (const channel of channels) ipcMain.removeHandler(channel)
    disposing = sessions.dispose()
    return disposing
  }
  return dispose
}
