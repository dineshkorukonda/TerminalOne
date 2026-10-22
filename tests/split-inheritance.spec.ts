import { _electron as electron, expect, test } from '@playwright/test'
import { mkdtemp, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import {
  clickTerminalOption,
  openTerminalOptions
} from './fixtures/terminal-options'

for (const privateSession of [false, true]) {
  test(`splits inherit the active ${privateSession ? 'private' : 'normal'} project pane, independently of the new-session shell`, async () => {
    const profile = await mkdtemp(join(tmpdir(), 'terminal-split-context-'))
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
      await expect(page.getByRole('tab')).toHaveCount(1)
      await clickTerminalOption(page, 'Open project')
      await expect(page.getByRole('tab')).toHaveCount(2)
      if (privateSession) {
        await clickTerminalOption(page, 'Private tab')
        await expect(page.getByRole('tab')).toHaveCount(3)
      }
      const panel = page.locator('.tab-viewport:not([hidden])')
      await expect(panel.locator('.xterm')).toHaveCount(1)
      await panel
        .locator('.xterm')
        .evaluate((element) =>
          Reflect.set(globalThis, '__splitOriginal', element)
        )
      await openTerminalOptions(page)
      await page
        .getByRole('combobox', { name: 'Shell', exact: true })
        .selectOption('cmd')
      await clickTerminalOption(page, 'Split right')
      await expect(panel.locator('.xterm')).toHaveCount(2)
      await expect(panel.getByRole('status')).toHaveText(['running', 'running'])
      expect(
        await page.evaluate(() =>
          Reflect.get(globalThis, 'uiFixture').getSessionOptions().slice(-1)
        )
      ).toEqual([
        {
          shellId: 'powershell',
          projectId: 'fixture-project',
          private: privateSession
        }
      ])
      expect(
        await panel
          .locator('.xterm')
          .first()
          .evaluate(
            (element) => element === Reflect.get(globalThis, '__splitOriginal')
          )
      ).toBe(true)
      if (privateSession)
        await expect(
          panel.getByText('Private tab', { exact: true })
        ).toHaveCount(2)
      await expect(
        panel.locator('.pane-active .xterm-helper-textarea')
      ).toBeFocused()
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
}
