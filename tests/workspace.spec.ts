import { _electron as electron, expect, test } from '@playwright/test'
import { mkdtemp, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import type { ViteDevServer } from 'vite'
import type { DesktopApi } from '../src/contracts/desktop-api'

for (const { scale, mode } of [
  ...[1, 1.25, 1.5, 2].map((scale) => ({ scale, mode: 'built' })),
  { scale: 1, mode: 'development' }
]) {
  // eslint-disable-next-line no-empty-pattern -- Playwright requires destructured fixtures.
  test(`${mode} workspace keyboard, splits, search and appearance at ${scale * 100}%`, async ({}, info) => {
    const profile = await mkdtemp(join(tmpdir(), 'terminal-workspace-'))
    const env = Object.fromEntries(
      Object.entries(process.env).filter(
        (entry): entry is [string, string] => entry[1] !== undefined
      )
    )
    delete env['ELECTRON_RUN_AS_NODE']
    delete env['ELECTRON_RENDERER_URL']
    let server: ViteDevServer | undefined
    if (mode === 'development') {
      const { resolveConfig } = await import('electron-vite')
      const { createServer } = await import('vite')
      const config = await resolveConfig({}, 'serve', 'development')
      if (!config.config?.renderer)
        throw new Error('Missing renderer configuration')
      server = await createServer(config.config.renderer)
      await server.listen()
      env['UI_FIXTURE_RENDERER_URL'] = 'http://127.0.0.1:5173'
    }
    const app = await electron.launch({
      args: [
        'tests/fixtures/ui-window.cjs',
        `--user-data-dir=${profile}`,
        `--force-device-scale-factor=${scale}`
      ],
      env
    })
    try {
      const page = await app.firstWindow()
      const errors: string[] = []
      page.on('pageerror', (error) => errors.push(error.message))
      await page.waitForURL(
        mode === 'development'
          ? 'http://127.0.0.1:5173/'
          : /\/out\/renderer\/index\.html$/,
        { waitUntil: 'domcontentloaded' }
      )
      const panel = page.locator('.tab-viewport:not([hidden])')
      await expect(panel.getByRole('status')).toHaveText('running')
      await expect(panel.locator('.xterm-accessibility-tree')).toContainText(
        '世界'
      )
      const identity = await panel.locator('.xterm').evaluate((element) => {
        Reflect.set(globalThis, '__firstTerminal', element)
        return true
      })
      expect(identity).toBe(true)
      await page
        .getByRole('button', { name: 'Split right', exact: true })
        .click()
      await expect(panel.locator('.xterm')).toHaveCount(2)
      await expect(
        panel.locator('.pane-active .xterm-helper-textarea')
      ).toBeFocused()
      expect(
        await panel
          .locator('.xterm')
          .first()
          .evaluate(
            (element) => element === Reflect.get(globalThis, '__firstTerminal')
          )
      ).toBe(true)
      const separator = panel.getByRole('separator')
      await separator.focus()
      await page.keyboard.press('ArrowRight')
      await expect(separator).toHaveAttribute('aria-valuenow', '55')
      await page
        .getByRole('button', { name: 'New session', exact: true })
        .click()
      await expect(page.getByRole('tab')).toHaveCount(2)
      await expect(page.locator('.xterm')).toHaveCount(3)
      await expect(
        panel.locator('.pane-active .xterm-helper-textarea')
      ).toBeFocused()
      await page
        .getByRole('button', { name: 'New session', exact: true })
        .click()
      await expect(page.getByRole('tab')).toHaveCount(3)
      await expect(page.locator('.xterm')).toHaveCount(4)
      await expect(panel.getByRole('status')).toHaveText('running')
      await page
        .getByRole('button', { name: 'New session', exact: true })
        .click()
      await expect(page.getByRole('alert')).toContainText('Four terminal views')
      await expect(page.getByRole('tab')).toHaveCount(3)
      await page.keyboard.press('Control+Shift+W')
      await expect(page.getByRole('tab')).toHaveCount(2)
      await page.getByRole('tab').first().click()
      expect(
        await panel
          .locator('.xterm')
          .first()
          .evaluate(
            (element) => element === Reflect.get(globalThis, '__firstTerminal')
          )
      ).toBe(true)
      await panel
        .getByRole('button', { name: 'Close pane', exact: true })
        .last()
        .click()
      await expect(panel.locator('.xterm')).toHaveCount(1)
      await page.keyboard.press('Control+Shift+P')
      await expect(
        page.getByRole('dialog', { name: 'Application commands' })
      ).toBeVisible()
      await page
        .getByRole('textbox', { name: 'Filter application commands' })
        .fill('Search terminal')
      await page.keyboard.press('Enter')
      const search = panel.getByRole('textbox', {
        name: 'Search terminal output'
      })
      await expect(search).toBeVisible()
      await search.fill('search match')
      await panel
        .getByRole('button', { name: 'Next match', exact: true })
        .click()
      await expect(
        panel.getByText('Match selected', { exact: true })
      ).toBeVisible()
      await expect(
        panel.getByText('Match 1 of 2', { exact: true })
      ).toBeVisible()
      await panel
        .getByRole('button', { name: 'Next match', exact: true })
        .click()
      await expect(
        panel.getByText('Match 2 of 2', { exact: true })
      ).toBeVisible()
      await panel
        .getByRole('button', { name: 'Previous match', exact: true })
        .click()
      await expect(
        panel.getByText('Match 1 of 2', { exact: true })
      ).toBeVisible()
      await panel
        .getByRole('button', { name: 'Copy selection', exact: true })
        .click()
      expect(
        await page.evaluate(() =>
          (Reflect.get(globalThis, 'desktop') as DesktopApi).readClipboard()
        )
      ).toBe('search match')
      await search.focus()
      await page.keyboard.press('Escape')
      await expect(panel.locator('.xterm-helper-textarea')).toBeFocused()
      await page.evaluate(() =>
        (Reflect.get(globalThis, 'desktop') as DesktopApi).writeClipboard(
          'PASTE_世界\r\nsecond line'
        )
      )
      await panel
        .getByRole('button', { name: 'Paste clipboard', exact: true })
        .click()
      await expect(panel.locator('.xterm-accessibility-tree')).toContainText(
        'PASTE_世界'
      )
      await page
        .getByRole('button', { name: 'Appearance', exact: true })
        .click()
      await page
        .getByRole('combobox', { name: 'Terminal theme' })
        .selectOption('contrast')
      await page
        .getByRole('spinbutton', { name: 'Terminal font size' })
        .fill('18')
      await expect(panel.locator('.xterm-rows')).toHaveCSS('font-size', '18px')
      await page.getByRole('button', { name: 'Close appearance' }).click()
      await app.evaluate(({ BrowserWindow }) =>
        BrowserWindow.getAllWindows()[0]!.setSize(640, 420)
      )
      expect(
        await page.evaluate(
          () =>
            Reflect.get(globalThis, 'document').documentElement.scrollWidth <=
            Reflect.get(globalThis, 'document').documentElement.clientWidth
        )
      ).toBe(true)
      await expect(
        page.getByRole('button', { name: 'Commands', exact: true })
      ).toBeVisible()
      expect(errors).toEqual([])
      await expect(
        page.getByRole('button', { name: 'Project documentation' })
      ).toBeVisible()
      await page.screenshot({ path: info.outputPath(`workspace-${scale}.png`) })
      await page.keyboard.press('Control+Shift+W')
      await expect(page.getByRole('tab')).toHaveCount(1)
      await page.keyboard.press('Control+Shift+W')
      await expect(page.getByRole('tab')).toHaveCount(0)
      await expect(page.getByText('Open a new session to begin.')).toBeVisible()
    } finally {
      await app.close()
      await server?.close()
      await rm(profile, {
        recursive: true,
        force: true,
        maxRetries: 5,
        retryDelay: 200
      })
    }
  })
}
