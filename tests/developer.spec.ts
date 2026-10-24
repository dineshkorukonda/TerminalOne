import {
  clickTerminalOption,
  openTerminalOptions
} from './fixtures/terminal-options'
import { _electron as electron, expect, test } from '@playwright/test'
import { mkdtemp, rm, readFile, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import type { DesktopApi } from '../src/contracts/desktop-api'

test('developer settings validate shortcuts and history suggestions remain draft-only', async () => {
  const profile = await mkdtemp(join(tmpdir(), 'terminal-developer-ui-'))
  const env = Object.fromEntries(
    Object.entries(process.env).filter(
      (entry): entry is [string, string] => entry[1] !== undefined
    )
  )
  delete env['ELECTRON_RUN_AS_NODE']
  delete env['ELECTRON_RENDERER_URL']
  const app = await electron.launch({
    args: ['tests/fixtures/ui-window.cjs', `--user-data-dir=${profile}`],
    env
  })
  try {
    const page = await app.firstWindow()
    await page.getByRole('button', { name: 'Terminal options' }).click()
    await expect(page.getByRole('status')).toHaveText('running')
    await clickTerminalOption(page, 'Developer settings')
    const settings = page.getByRole('dialog', {
      name: 'Developer settings',
      exact: true
    })
    await settings
      .getByRole('textbox', { name: 'Shortcut New terminal tab', exact: true })
      .fill('Ctrl+Shift+P')
    await settings
      .getByRole('button', { name: 'Save developer settings', exact: true })
      .click()
    await expect(settings.getByRole('status')).toContainText(
      'Shortcut collision'
    )
    await settings
      .getByRole('textbox', { name: 'Shortcut New terminal tab', exact: true })
      .fill('Ctrl+Shift+N')
    await settings
      .getByRole('checkbox', {
        name: 'Enable local command history for new PowerShell tabs'
      })
      .check()
    await settings
      .getByRole('checkbox', { name: 'Enable offline command explanations' })
      .check()
    await settings
      .getByRole('button', { name: 'Save developer settings', exact: true })
      .click()
    await expect(settings.getByRole('status')).toContainText('saved')
    await settings
      .getByRole('button', { name: 'Close developer settings' })
      .click()
    await page.keyboard.press('Control+Shift+N')
    await expect(page.getByRole('tab')).toHaveCount(2)
    await page.keyboard.press('Control+Shift+W')
    await expect(page.getByRole('tab')).toHaveCount(1)
    await clickTerminalOption(page, 'History')
    const history = page.getByRole('dialog', {
      name: 'History and command draft'
    })
    await expect(
      history.getByRole('textbox', { name: 'Search command history' })
    ).toBeFocused()
    const draft = history.getByRole('textbox', {
      name: 'Command draft',
      exact: true
    })
    await draft.fill('Get')
    await expect(
      history.getByRole('button', { name: /^Accept suggestion:/ })
    ).toHaveCount(2)
    await draft.press('Escape')
    await expect(
      history.getByRole('button', { name: /^Accept suggestion:/ })
    ).toHaveCount(0)
    await expect(history).toBeVisible()
    await draft.fill('Get-Child')
    await history.getByRole('button', { name: /^Accept suggestion:/ }).click()
    await expect(draft).toHaveValue("Get-ChildItem 'C:\\Fixture Spaces'")
    await history
      .getByRole('button', { name: 'Copy draft', exact: true })
      .click()
    expect(
      await page.evaluate(() =>
        (Reflect.get(globalThis, 'desktop') as DesktopApi).readClipboard()
      )
    ).toBe("Get-ChildItem 'C:\\Fixture Spaces'")
    await expect(page.locator('.xterm-accessibility-tree')).not.toContainText(
      'Get-ChildItem'
    )
    await history.getByRole('button', { name: 'Explain locally' }).click()
    await expect(history.getByRole('status')).toContainText('Nothing executed')
    await history.getByRole('button', { name: 'Close command draft' }).click()
    await expect(page.locator('.xterm-helper-textarea')).toBeFocused()
    await clickTerminalOption(page, 'Open project')
    await openTerminalOptions(page)
    await expect(
      page.getByRole('combobox', { name: 'Project', exact: true })
    ).toHaveValue('fixture-project')
    await expect(page.getByRole('tab')).toHaveCount(2)
    await expect(page.getByRole('tab').last()).toContainText('Fixture project')
    expect(
      await page.evaluate(() =>
        Reflect.get(globalThis, 'uiFixture').getSessionLaunches().slice(-1)
      )
    ).toEqual([{ shellId: 'powershell', projectId: 'fixture-project' }])
    await page.evaluate(() =>
      Reflect.get(globalThis, 'uiFixture').cancelNextProject()
    )
    await clickTerminalOption(page, 'Open project')
    await expect(page.getByRole('tab')).toHaveCount(2)
    await page.getByRole('tab').first().click()
    await expect(
      page.locator('.tab-viewport:not([hidden]) .xterm-accessibility-tree')
    ).toContainText('Project: home')
    await page.getByRole('tab').last().click()
    await expect(
      page.locator('.tab-viewport:not([hidden]) .xterm-accessibility-tree')
    ).toContainText('fixture-project')
    await clickTerminalOption(page, 'Developer settings')
    await settings
      .getByRole('button', { name: 'Save current layout', exact: true })
      .click()
    await expect(settings.getByRole('status')).toContainText('layout saved')
    const result = await page.evaluate(() =>
      (Reflect.get(globalThis, 'desktop') as DesktopApi).getPreferences()
    )
    expect(result.settings.restoration.enabled).toBe(true)
    expect(result.settings.restoration.tabs).toHaveLength(2)
  } finally {
    await app.close()
    await rm(profile, {
      recursive: true,
      force: true,
      maxRetries: 5,
      retryDelay: 200
    })
  }
})

test('production settings persist across restart and reject invalid or disabled capabilities', async () => {
  const profile = await mkdtemp(
    join(tmpdir(), 'terminal-developer-persistence-')
  )
  const env = Object.fromEntries(
    Object.entries(process.env).filter(
      (entry): entry is [string, string] => entry[1] !== undefined
    )
  )
  delete env['ELECTRON_RUN_AS_NODE']
  delete env['ELECTRON_RENDERER_URL']
  let app = await electron.launch({
    args: ['.', `--user-data-dir=${profile}`],
    env
  })
  try {
    expect(await app.evaluate(({ app }) => app.getPath('userData'))).toBe(
      profile
    )
    let page = await app.firstWindow()
    await page.waitForLoadState('domcontentloaded')
    const result = await page.evaluate(async () => {
      const api = Reflect.get(globalThis, 'desktop') as DesktopApi
      const { settings } = await api.getPreferences()
      const rejected = []
      for (const invoke of [
        () => Reflect.apply(api.getPreferences, api, ['extra']),
        () => api.savePreferences({ ...settings, version: 99 } as never),
        () => api.searchHistory('x'.repeat(257), 'powershell'),
        () => api.explainCommand('Get-Location')
      ]) {
        try {
          await invoke()
          rejected.push(false)
        } catch {
          rejected.push(true)
        }
      }
      await api.savePreferences({
        ...settings,
        appearance: { ...settings.appearance, theme: 'contrast' },
        shortcuts: { ...settings.shortcuts, new: 'Ctrl+Shift+N' }
      })
      return rejected
    })
    expect(result).toEqual([true, true, true, true])
    await app.close()
    app = await electron.launch({
      args: ['.', `--user-data-dir=${profile}`],
      env
    })
    page = await app.firstWindow()
    await page.waitForLoadState('domcontentloaded')
    const saved = await page.evaluate(() =>
      (Reflect.get(globalThis, 'desktop') as DesktopApi).getPreferences()
    )
    expect(saved.settings.appearance.theme).toBe('contrast')
    expect(saved.settings.shortcuts.new).toBe('Ctrl+Shift+N')
    const input = join(profile, 'controlled-import.json'),
      output = join(profile, 'controlled-export.json')
    await writeFile(input, JSON.stringify({ ...saved.settings, version: 99 }))
    await app.evaluate(
      ({ dialog }, paths) => {
        dialog.showOpenDialog = async () => ({
          canceled: false,
          filePaths: [paths.input]
        })
        dialog.showSaveDialog = async () => ({
          canceled: false,
          filePath: paths.output
        })
      },
      { input, output }
    )
    expect(
      await page.evaluate(() =>
        (Reflect.get(globalThis, 'desktop') as DesktopApi).exportPreferences()
      )
    ).toBe(true)
    expect(JSON.parse(await readFile(output, 'utf8'))).toEqual(saved.settings)
    expect(
      await page.evaluate(async () => {
        try {
          await (
            Reflect.get(globalThis, 'desktop') as DesktopApi
          ).importPreferences()
          return false
        } catch {
          return true
        }
      })
    ).toBe(true)
    expect(
      (
        await page.evaluate(() =>
          (Reflect.get(globalThis, 'desktop') as DesktopApi).getPreferences()
        )
      ).settings
    ).toEqual(saved.settings)
    await writeFile(input, await readFile(output, 'utf8'))
    expect(
      (
        await page.evaluate(() =>
          (Reflect.get(globalThis, 'desktop') as DesktopApi).importPreferences()
        )
      )?.settings
    ).toEqual(saved.settings)
    expect(
      await page.evaluate(() =>
        (Reflect.get(globalThis, 'desktop') as DesktopApi).searchHistory(
          '',
          'all'
        )
      )
    ).toEqual([])
  } finally {
    await app.close()
    await rm(profile, {
      recursive: true,
      force: true,
      maxRetries: 5,
      retryDelay: 200
    })
  }
})
