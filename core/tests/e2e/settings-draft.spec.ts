import { _electron as electron, expect, test } from '@playwright/test'
import { mkdtemp, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { clickTerminalOption } from '../fixtures/terminal-options'

test('settings labels, draft protection and saved operations preserve keyboard editing', async () => {
  const profile = await mkdtemp(join(tmpdir(), 'terminal-settings-draft-'))
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
    const open = () => clickTerminalOption(page, 'Developer settings')
    const settings = page.getByRole('dialog', {
      name: 'Developer settings',
      exact: true
    })
    const shortcut = settings.getByRole('textbox', {
      name: 'Shortcut New terminal tab',
      exact: true
    })
    const prompt = settings.getByRole('alertdialog', {
      name: 'Unsaved settings edits'
    })
    await open()
    await settings
      .getByRole('button', { name: 'Close developer settings' })
      .click()
    await expect(settings).toHaveCount(0)
    await open()
    await shortcut.fill('Ctrl+Shift+N')
    await expect(
      settings.getByText('Unsaved local draft edits. Save to apply them.', {
        exact: true
      })
    ).toBeVisible()
    await expect(
      settings.getByRole('button', { name: 'Import settings', exact: true })
    ).toBeDisabled()
    await shortcut.press('Escape')
    await expect(prompt).toBeVisible()
    await expect(
      prompt.getByRole('button', { name: 'Continue editing' })
    ).toBeFocused()
    await prompt.getByRole('button', { name: 'Continue editing' }).click()
    await expect(shortcut).toBeFocused()
    await expect(shortcut).toHaveValue('Ctrl+Shift+N')
    await settings
      .getByRole('button', { name: 'Close developer settings' })
      .click()
    await prompt.getByRole('button', { name: 'Discard edits' }).click()
    await expect(settings).toHaveCount(0)
    await open()
    await expect(shortcut).toHaveValue('Ctrl+Shift+T')
    await shortcut.fill('Ctrl+Shift+P')
    await settings
      .getByRole('button', { name: 'Save developer settings', exact: true })
      .click()
    await expect(settings.getByRole('status')).toContainText(
      'Shortcut collision'
    )
    await shortcut.fill('Ctrl+Shift+N')
    await settings
      .getByRole('button', { name: 'Save developer settings', exact: true })
      .click()
    await expect(
      settings.getByText('Showing saved preferences. No unsaved edits.', {
        exact: true
      })
    ).toBeVisible()
    await settings
      .getByRole('button', { name: 'Import settings', exact: true })
      .click()
    await expect(settings.getByRole('status')).toContainText('Import canceled')
    await settings
      .getByRole('button', { name: 'Reset developer settings', exact: true })
      .click()
    await expect(settings.getByRole('status')).toContainText(
      'reset to defaults'
    )
    await expect(settings).toBeVisible()
    await settings
      .getByRole('button', { name: 'Close developer settings' })
      .click()
    await expect(page.locator('.xterm-helper-textarea')).toBeFocused()
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
