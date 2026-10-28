import { ipcMain, dialog } from 'electron'
import type { BrowserWindow } from 'electron'
import { readFile, writeFile, stat } from 'node:fs/promises'
import { basename } from 'node:path'
import { randomUUID } from 'node:crypto'
import { IPC_CHANNELS } from '../../contracts/desktop-api'
import { parsePreferences, shellId } from '../../contracts/preferences'
import { authorizeSender, validateArguments } from './policy'
import type { PreferenceRepository } from '../preferences/repository'

export function registerPreferencesIpc(
  window: BrowserWindow,
  trustedUrl: string,
  repository: PreferenceRepository
) {
  const channels: string[] = []
  let pending = 0
  function handle(
    channel: string,
    count: number,
    operation: (...args: unknown[]) => unknown
  ) {
    channels.push(channel)
    ipcMain.handle(channel, async (event, ...args: unknown[]) => {
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
      validateArguments(args, count)
      if (pending >= 8)
        throw new Error(
          'Developer settings are busy. Retry after the current operation.'
        )
      pending++
      try {
        return await operation(...args)
      } catch {
        throw new Error(
          'Developer settings operation failed. Check the values, selected file, or folder permissions.'
        )
      } finally {
        pending--
      }
    })
  }
  handle(IPC_CHANNELS.getPreferences, 0, () => repository.current())
  handle(IPC_CHANNELS.savePreferences, 1, (value) => repository.save(value))
  handle(IPC_CHANNELS.resetPreferences, 0, () => repository.reset())
  handle(IPC_CHANNELS.searchHistory, 2, (query, shell) =>
    repository.search(query, shell)
  )
  handle(IPC_CHANNELS.clearHistory, 0, () => repository.clearHistory())
  handle(IPC_CHANNELS.chooseProject, 1, async (value) => {
    const selectedShell = shellId(value)
    const { canceled, filePaths } = await dialog.showOpenDialog(window, {
      title: 'Choose project folder',
      properties: ['openDirectory']
    })
    if (canceled || !filePaths[0]) return null
    const project = {
      id: randomUUID(),
      name: basename(filePaths[0]).slice(0, 80),
      cwd: filePaths[0],
      shellId: selectedShell
    }
    const settings = repository.current().settings
    await repository.save({
      ...settings,
      projects: [...settings.projects, project]
    })
    return project
  })
  handle(IPC_CHANNELS.importPreferences, 0, async () => {
    const { canceled, filePaths } = await dialog.showOpenDialog(window, {
      title: 'Import Terminal One settings',
      properties: ['openFile'],
      filters: [{ name: 'Settings JSON', extensions: ['json'] }]
    })
    if (canceled || !filePaths[0]) return null
    if ((await stat(filePaths[0])).size > 65536)
      throw new Error('Import too large')
    const raw = await readFile(filePaths[0], 'utf8')
    if (Buffer.byteLength(raw) > 65536) throw new Error('Import too large')
    return repository.save(parsePreferences(JSON.parse(raw)))
  })
  handle(IPC_CHANNELS.exportPreferences, 0, async () => {
    const { canceled, filePath } = await dialog.showSaveDialog(window, {
      title: 'Export Terminal One settings',
      defaultPath: 'terminal-one-settings.json',
      filters: [{ name: 'Settings JSON', extensions: ['json'] }]
    })
    if (canceled || !filePath) return false
    await writeFile(
      filePath,
      JSON.stringify(repository.current().settings, null, 2),
      { mode: 0o600 }
    )
    return true
  })
  handle(IPC_CHANNELS.explainCommand, 1, (command) => {
    if (!repository.current().settings.explanations)
      throw new Error('Local explanations are disabled')
    if (
      typeof command !== 'string' ||
      command.length > 4096 ||
      [...command].some(
        (char) => char.charCodeAt(0) < 32 || char.charCodeAt(0) === 127
      )
    )
      throw new Error('Invalid command')
    const first = command.trim().split(/\s+/)[0]?.toLowerCase()
    const description: Record<string, string> = {
      'get-childitem': 'Lists items in a location.',
      'get-location': 'Shows the current location.',
      'write-output': 'Writes objects to the output stream.',
      dir: 'Lists directory entries in CMD; other shells may define aliases.',
      ls: 'Lists directory entries in Bash; aliases and options can change behavior.',
      cd: 'Changes the shell location; state remains local to that session.',
      pwd: 'Displays the current working directory in Bash.',
      git: 'Runs Git. Review its subcommand and options before execution.'
    }
    return (
      (description[first ?? ''] ??
        'No local explanation is available for this command.') +
      ' This is a short static reference, not a parser or safety assessment. Nothing was executed or sent to a provider.'
    )
  })
  return () => {
    for (const channel of channels) ipcMain.removeHandler(channel)
  }
}
