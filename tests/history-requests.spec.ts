import { _electron as electron, expect, test } from '@playwright/test'
import { mkdtemp, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import type { DesktopApi } from '../src/contracts/desktop-api'
import { clickTerminalOption } from './fixtures/terminal-options'

test('history lookups coalesce edits and reject superseded draft responses', async () => {
  const profile = await mkdtemp(join(tmpdir(), 'terminal-history-requests-'))
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
    await page.evaluate(async () => {
      const api = Reflect.get(globalThis, 'desktop') as DesktopApi
      const { settings } = await api.getPreferences()
      await api.savePreferences({
        ...settings,
        history: { ...settings.history, enabled: true }
      })
    })
    await clickTerminalOption(page, 'History')
    const history = page.getByRole('dialog', {
      name: 'History and command draft'
    })
    await expect(
      history.getByRole('button', { name: 'Use command', exact: true })
    ).toHaveCount(2)
    await page.clock.install()
    await page.clock.pauseAt(Date.now() + 1000)
    const requests = () =>
      page.evaluate(
        () =>
          Reflect.get(globalThis, 'uiFixture').getHistoryRequests() as string[]
      )
    const baseline = await requests()
    const query = history.getByRole('textbox', {
      name: 'Search command history'
    })
    await query.fill('G')
    await query.fill('Get-')
    await query.fill('Get-Location')
    await page.clock.runFor(149)
    expect(await requests()).toHaveLength(baseline.length)
    await page.clock.runFor(1)
    await expect.poll(requests).toEqual([...baseline, 'Get-Location'])
    await expect(
      history.getByRole('button', { name: 'Use command', exact: true })
    ).toHaveCount(1)

    const draft = history.getByRole('textbox', {
      name: 'Command draft',
      exact: true
    })
    const suggestions = history.getByRole('button', {
      name: /^Accept suggestion:/
    })
    await draft.fill('Get')
    await page.clock.runFor(150)
    await expect(suggestions).toHaveCount(2)
    await page.evaluate(() =>
      Reflect.get(globalThis, 'uiFixture').delayNextHistory(500)
    )
    await draft.fill('Get-')
    await expect(suggestions).toHaveCount(0)
    await page.clock.runFor(150)
    await draft.fill('unmatched')
    await page.clock.runFor(150)
    await expect
      .poll(() =>
        page.evaluate(
          () =>
            Reflect.get(
              globalThis,
              'uiFixture'
            ).getHistoryCompletions() as string[]
        )
      )
      .toContain('Get-')
    await expect(suggestions).toHaveCount(0)

    const count = (await requests()).length
    await draft.fill('Get-Child')
    await history.getByRole('button', { name: 'Close command draft' }).click()
    await page.clock.runFor(500)
    expect(await requests()).toHaveLength(count)
    await expect(page.locator('.xterm-accessibility-tree')).not.toContainText(
      'Get-ChildItem'
    )
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
