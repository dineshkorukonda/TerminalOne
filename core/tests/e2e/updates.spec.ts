import { _electron as electron, expect, test } from '@playwright/test'
import { mkdtemp, rm } from 'node:fs/promises'
import { join } from 'node:path'
import { tmpdir } from 'node:os'
import type { DesktopApi } from '../../src/contracts/desktop-api'
import { clickTerminalOption } from '../fixtures/terminal-options'

for (const fixture of [true, false]) {
  test(
    fixture
      ? 'update dialog checks, downloads and waits for explicit install'
      : 'development updater rejects installation and malformed IPC calls',
    // eslint-disable-next-line no-empty-pattern -- Playwright requires destructured fixtures before testInfo.
    async ({}, info) => {
      const profile = await mkdtemp(join(tmpdir(), 'terminal-updates-'))
      const env = Object.fromEntries(
        Object.entries(process.env).filter(
          (entry): entry is [string, string] => entry[1] !== undefined
        )
      )
      delete env['ELECTRON_RUN_AS_NODE']
      delete env['ELECTRON_RENDERER_URL']
      const app = await electron.launch({
        args: [
          fixture ? 'tests/fixtures/ui-window.cjs' : '.',
          `--user-data-dir=${profile}`
        ],
        env
      })
      try {
        const page = await app.firstWindow()
        if (fixture) {
          await clickTerminalOption(page, 'Updates')
          const dialog = page.getByRole('dialog', {
            name: 'Updates',
            exact: true
          })
          await expect(dialog).toBeVisible()
          await dialog
            .getByRole('button', { name: 'Check for updates', exact: true })
            .click()
          await expect(dialog.getByRole('status')).toContainText(
            '0.2.0-alpha.2'
          )
          await dialog
            .getByRole('button', {
              name: 'Download 0.2.0-alpha.2',
              exact: true
            })
            .click()
          await expect(
            dialog.getByRole('button', {
              name: 'Restart and install',
              exact: true
            })
          ).toBeVisible()
          await dialog.getByRole('button', { name: 'Close updates' }).click()
          await expect(page.locator('.xterm-helper-textarea')).toBeFocused()
          await clickTerminalOption(page, 'Updates')
          await expect(
            dialog.getByRole('button', {
              name: 'Restart and install',
              exact: true
            })
          ).toBeVisible()
          await page.screenshot({
            path: info.outputPath('update-ready-fixture.png')
          })
          await dialog
            .getByRole('button', { name: 'Restart and install', exact: true })
            .click()
          await expect(dialog.getByRole('status')).toContainText(
            'Closing terminal sessions'
          )
        } else {
          const result = await page.evaluate(async () => {
            const api = Reflect.get(globalThis, 'desktop') as DesktopApi
            const status = await api.getUpdateStatus()
            const rejected = []
            for (const method of [
              api.getUpdateStatus,
              api.checkForUpdates,
              api.downloadUpdate,
              api.installUpdate
            ]) {
              try {
                await Reflect.apply(method, undefined, ['unexpected'])
                rejected.push(false)
              } catch {
                rejected.push(true)
              }
            }
            for (const method of [api.downloadUpdate, api.installUpdate]) {
              try {
                await method()
                rejected.push(false)
              } catch {
                rejected.push(true)
              }
            }
            const detach = api.onUpdateStatus(() => {})
            detach()
            detach()
            return { phase: status.phase, rejected }
          })
          expect(result).toEqual({
            phase: 'unavailable',
            rejected: Array(6).fill(true)
          })
        }
      } finally {
        await app.close()
        await rm(profile, {
          recursive: true,
          force: true,
          maxRetries: 5,
          retryDelay: 200
        })
      }
    }
  )
}
