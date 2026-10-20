import {
  clickTerminalOption,
  openTerminalOptions
} from './fixtures/terminal-options'
import { _electron as electron, expect, test } from '@playwright/test'
import { mkdtemp, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import type { ViteDevServer } from 'vite'
import type { DesktopApi } from '../src/contracts/desktop-api'

// eslint-disable-next-line no-empty-pattern -- Playwright requires destructured fixtures before testInfo.
test('profile dropdown and per-tab close preserve the active terminal', async ({}, info) => {
  const profile = await mkdtemp(join(tmpdir(), 'terminal-classic-ui-'))
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
    const firstTerminal = page.locator('.xterm').first()
    await firstTerminal.evaluate((element) =>
      Reflect.set(globalThis, '__classicTerminal', element)
    )
    await expect(page.locator('.terminal-panel')).toHaveCSS(
      'border-width',
      '0px'
    )
    await page.locator('.terminal-surface').hover()
    await expect(
      page.getByRole('button', { name: 'Close pane', exact: true })
    ).toHaveCount(0)
    await expect(page.locator('.terminal-toolbar')).toHaveCSS(
      'clip-path',
      'inset(50%)'
    )
    const options = page.getByRole('button', {
      name: 'Terminal options',
      exact: true
    })
    await options.click()
    await page
      .getByRole('button', { name: 'New CMD fixture tab', exact: true })
      .click()
    await expect(options).toHaveAttribute('aria-expanded', 'false')
    await expect(page.getByRole('tab')).toHaveCount(2)
    await expect(page.getByRole('tab', { selected: true })).toHaveText(
      'CMD fixture'
    )
    await page.getByRole('tab').first().click()
    await page
      .getByRole('button', { name: 'Close tab CMD fixture', exact: true })
      .click()
    await expect(page.getByRole('tab')).toHaveCount(1)
    expect(
      await firstTerminal.evaluate(
        (element) => element === Reflect.get(globalThis, '__classicTerminal')
      )
    ).toBe(true)
    await expect(page.locator('.xterm-helper-textarea')).toBeFocused()
    await options.click()
    await page.keyboard.press('Escape')
    await expect(options).toHaveAttribute('aria-expanded', 'false')
    await expect(options).toBeFocused()
    await options.click()
    await page.getByRole('tab').click()
    await expect(options).toHaveAttribute('aria-expanded', 'false')
    await page.screenshot({ path: info.outputPath('classic-dark.png') })
    await options.click()
    await page.screenshot({ path: info.outputPath('classic-options.png') })
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
      await page.getByRole('button', { name: 'Terminal options' }).click()
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
      await clickTerminalOption(page, 'Split right')
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
      const terminalHeight = await panel
        .locator('.terminal-surface')
        .evaluate((element) => element.clientHeight)
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
      expect(
        await panel
          .locator('.terminal-surface')
          .evaluate((element) => element.clientHeight)
      ).toBe(terminalHeight)
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
      await clickTerminalOption(page, 'Copy selection')
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
      await clickTerminalOption(page, 'Paste clipboard')
      await expect(panel.locator('.xterm-accessibility-tree')).toContainText(
        'PASTE_世界'
      )
      await clickTerminalOption(page, 'Appearance')
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
      await openTerminalOptions(page)
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
