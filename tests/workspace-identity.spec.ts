import { _electron as electron, expect, test } from '@playwright/test'
import { mkdtemp, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { clickTerminalOption } from './fixtures/terminal-options'

test('tab rename preserves terminal identity, saved names and pane launch context', async () => {
  const profile = await mkdtemp(join(tmpdir(), 'terminal-rename-'))
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
    await expect(page.getByRole('status')).toHaveText('running')
    await clickTerminalOption(page, 'Open project')
    const active = page.locator('.tab-viewport:not([hidden])')
    await expect(active.locator('.pane-context')).toContainText(
      'Launch project: Fixture project'
    )
    await expect(active.locator('.pane-context')).toContainText(
      'PowerShell fixture'
    )
    const identity = await active.locator('.xterm').elementHandle()
    await clickTerminalOption(page, 'Rename active tab')
    const dialog = page.getByRole('dialog', { name: 'Rename tab', exact: true })
    const name = dialog.getByRole('textbox', { name: 'Tab name', exact: true })
    await expect(name).toBeFocused()
    await name.fill(' ')
    await dialog
      .getByRole('button', { name: 'Save tab name', exact: true })
      .click()
    await expect(dialog.getByRole('alert')).toContainText('1 to 80')
    await name.fill('Backend API')
    await name.press('Enter')
    await expect(page.getByRole('tab', { selected: true })).toHaveText(
      'Backend API'
    )
    expect(
      await active
        .locator('.xterm')
        .evaluate((el, original) => el === original, identity)
    ).toBe(true)
    await expect(active.locator('.xterm-helper-textarea')).toBeFocused()
    await clickTerminalOption(page, 'Split right')
    await expect(active.locator('.pane-context')).toHaveCount(2)
    await expect(active.locator('.pane-context').last()).toContainText(
      'Fixture project'
    )
    await clickTerminalOption(page, 'Developer settings')
    const settings = page.getByRole('dialog', {
      name: 'Developer settings',
      exact: true
    })
    await settings
      .getByRole('button', { name: 'Save current layout', exact: true })
      .click()
    await expect(settings.getByRole('status')).toContainText('layout saved')
    expect(
      await page.evaluate(
        async () =>
          (
            await Reflect.get(globalThis, 'desktop').getPreferences()
          ).settings.restoration.tabs.at(-1).title
      )
    ).toBe('Backend API')
    await settings
      .getByRole('button', { name: 'Close developer settings' })
      .click()
    await clickTerminalOption(page, 'Private tab')
    await expect(active.locator('.pane-context')).toContainText(
      'Private session'
    )
    await page.keyboard.press('Control+Shift+P')
    await page
      .getByRole('textbox', { name: 'Filter application commands' })
      .fill('Rename active tab')
    await page
      .getByRole('button', { name: 'Rename active tab', exact: true })
      .click()
    await expect(dialog).toBeVisible()
    await page.keyboard.press('Escape')
    await expect(active.locator('.xterm-helper-textarea')).toBeFocused()
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
