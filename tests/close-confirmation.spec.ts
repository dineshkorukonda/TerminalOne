import { _electron as electron, expect, test } from '@playwright/test'
import { mkdtemp, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { clickTerminalOption } from './fixtures/terminal-options'

test('close confirmation protects pane and multi-pane tab paths without changing default closure', async () => {
  const profile = await mkdtemp(join(tmpdir(), 'terminal-close-'))
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
    await page.keyboard.press('Control+Shift+W')
    await expect(page.getByRole('tab')).toHaveCount(0)
    await page.getByRole('button', { name: 'New session', exact: true }).click()
    await clickTerminalOption(page, 'Developer settings')
    const settings = page.getByRole('dialog', {
      name: 'Developer settings',
      exact: true
    })
    await settings
      .getByRole('checkbox', { name: 'Confirm before closing terminal views' })
      .check()
    await settings
      .getByRole('button', { name: 'Save developer settings', exact: true })
      .click()
    await expect(settings.getByRole('status')).toContainText('saved')
    await settings
      .getByRole('button', { name: 'Close developer settings' })
      .click()
    await clickTerminalOption(page, 'Split right')
    const ids = await page.evaluate(() =>
      Reflect.get(globalThis, 'uiFixture').getSessionIds()
    )
    const confirm = page.getByRole('dialog', {
      name: 'Close terminal views',
      exact: true
    })
    for (const path of ['shortcut', 'pane', 'palette', 'tab']) {
      if (path === 'shortcut') await page.keyboard.press('Control+Shift+W')
      else if (path === 'pane')
        await page
          .getByRole('button', { name: 'Close pane', exact: true })
          .last()
          .click()
      else if (path === 'tab')
        await page.getByRole('button', { name: /^Close tab / }).click()
      else {
        await page.keyboard.press('Control+Shift+P')
        await page
          .getByRole('textbox', { name: 'Filter application commands' })
          .fill('Close active pane')
        await page
          .getByRole('button', { name: 'Close active pane', exact: true })
          .click()
      }
      await expect(confirm).toBeVisible()
      await expect(confirm.getByRole('heading')).toHaveText(
        `Close ${path === 'tab' ? 2 : 1} terminal ${path === 'tab' ? 'views' : 'view'}?`
      )
      await expect(
        confirm.getByRole('button', { name: 'Cancel', exact: true })
      ).toBeFocused()
      await page.keyboard.press('Escape')
      await expect(confirm).toHaveCount(0)
      expect(
        await page.evaluate(() =>
          Reflect.get(globalThis, 'uiFixture').getSessionIds()
        )
      ).toEqual(ids)
      await expect(page.locator('.xterm')).toHaveCount(2)
    }
    await page.getByRole('button', { name: /^Close tab / }).click()
    await confirm
      .getByRole('button', { name: 'Close 2 views', exact: true })
      .click()
    await expect(page.getByRole('tab')).toHaveCount(0)
    expect(
      await page.evaluate(() =>
        Reflect.get(globalThis, 'uiFixture').getSessionIds()
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
