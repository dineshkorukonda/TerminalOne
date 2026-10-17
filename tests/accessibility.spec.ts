import { _electron as electron, expect, test } from '@playwright/test'
import AxeBuilder from '@axe-core/playwright'
import { mkdtemp, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'

// eslint-disable-next-line no-empty-pattern -- Playwright requires a destructured fixture argument before testInfo.
test('terminal chrome passes automated accessibility checks and keyboard workflows', async ({}, info) => {
  const profile = await mkdtemp(join(tmpdir(), 'terminal-accessibility-'))
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
    async function audit(name: string) {
      const result = await new AxeBuilder({ page })
        // Electron does not implement Target.createTarget. This app denies
        // embedded frames, so the existing-page axe mode covers its document.
        .setLegacyMode(true)
        .withTags(['wcag2a', 'wcag2aa', 'wcag21aa'])
        .analyze()
      await writeFile(
        info.outputPath(`${name}-axe.json`),
        JSON.stringify(
          {
            violations: result.violations,
            passes: result.passes.map((item) => item.id),
            incomplete: result.incomplete.map((item) => ({
              id: item.id,
              impact: item.impact
            }))
          },
          null,
          2
        )
      )
      expect(result.violations, `${name}: automated WCAG violations`).toEqual(
        []
      )
    }
    await audit('workspace')
    await page.keyboard.press('Control+Shift+P')
    await expect(
      page.getByRole('dialog', { name: 'Application commands' })
    ).toBeVisible()
    await expect(
      page.getByRole('textbox', { name: 'Filter application commands' })
    ).toBeFocused()
    await audit('palette')
    await page.keyboard.type('New terminal tab')
    await page.keyboard.press('Enter')
    await expect(page.getByRole('tab')).toHaveCount(2)
    await expect(
      page.locator('.tab-viewport:not([hidden]) .xterm-helper-textarea')
    ).toBeFocused()
    await page.keyboard.press('Control+Shift+F')
    await expect(
      page.getByRole('textbox', { name: 'Search terminal output' })
    ).toBeFocused()
    await page.keyboard.type('search match')
    await page.keyboard.press('Enter')
    await expect(
      page.getByText('Match selected', { exact: true })
    ).toBeVisible()
    await audit('search')
    await page.keyboard.press('Escape')
    await page.keyboard.press('Control+Shift+P')
    await page.keyboard.type('Appearance settings')
    await page.keyboard.press('Enter')
    await expect(
      page.getByRole('combobox', { name: 'Terminal theme' })
    ).toBeFocused()
    await page.keyboard.press('ArrowDown')
    await audit('appearance')
    await page.keyboard.press('Tab')
    await expect(
      page.getByRole('combobox', { name: 'Terminal font', exact: true })
    ).toBeFocused()
    await page.keyboard.press('Tab')
    await expect(
      page.getByRole('spinbutton', { name: 'Terminal font size' })
    ).toBeFocused()
    await page.keyboard.press('Tab')
    await expect(
      page.getByRole('button', { name: 'Close appearance' })
    ).toBeFocused()
    await page.keyboard.press('Enter')
    await expect(
      page.locator('.tab-viewport:not([hidden]) .xterm-helper-textarea')
    ).toBeFocused()
    await page.keyboard.press('Control+Shift+W')
    await page.keyboard.press('Control+Shift+W')
    await expect(page.getByRole('tab')).toHaveCount(0)
    await audit('empty-workspace')
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
