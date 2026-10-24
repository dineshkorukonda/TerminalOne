import { _electron as electron, expect, test } from '@playwright/test'
import { mkdtemp, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { clickTerminalOption } from './fixtures/terminal-options'

test('recovery preserves output, session ownership, sibling identity and search focus', async () => {
  const profile = await mkdtemp(join(tmpdir(), 'terminal-recovery-'))
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
    // xterm's accessibility tree exposes the viewport, not the whole scrollback.
    // Keep all synthetic restart output visible for the retention assertions.
    await app.evaluate(({ BrowserWindow }) =>
      BrowserWindow.getAllWindows()[0]!.setContentSize(1000, 1000)
    )
    const fixture = (method: string, id?: string) =>
      page.evaluate(
        ({ method, id }) => {
          const api = Reflect.get(globalThis, 'uiFixture')
          return Reflect.get(api, method)(id)
        },
        { method, id }
      )
    await expect(page.getByRole('status')).toHaveText('running')
    await clickTerminalOption(page, 'Split right')
    const panes = page.locator('.terminal-panel')
    const pane = panes.last()
    const sibling = panes.first()
    await expect(pane.getByRole('status')).toHaveText('running')
    const siblingTerminal = await sibling.locator('.xterm').elementHandle()
    const terminal = await pane.locator('.xterm').elementHandle()
    const ids: string[] = await fixture('getSessionIds')
    let previous = ids[1]!
    for (const mode of ['exitSession', 'failSession', 'stop', 'exitSession']) {
      if (mode === 'stop') await clickTerminalOption(page, 'Stop session')
      else await fixture(mode, previous)
      const restart = pane.getByRole('button', {
        name: 'Restart session',
        exact: true
      })
      await expect(restart).toBeVisible()
      await expect(pane.locator('.xterm-accessibility-tree')).toContainText(
        'Fixture fixture-2'
      )
      if (mode === 'failSession') await fixture('failNextSession')
      await restart.click()
      if (mode === 'failSession') {
        await expect(pane.getByRole('alert')).toContainText(
          'Verify shell installation'
        )
        await expect(pane.locator('.xterm-accessibility-tree')).toContainText(
          'Fixture fixture-2'
        )
        await restart.click()
      }
      await expect(pane.getByRole('status')).toHaveText('running')
      await expect(pane.locator('.xterm-helper-textarea')).toBeFocused()
      const current: string[] = await fixture('getSessionIds')
      expect(current).toHaveLength(2)
      expect(current[0]).toBe(ids[0])
      expect(current[1]).not.toBe(previous)
      previous = current[1]!
      expect(await fixture('getSessionListenerCount')).toBe(2)
      expect(
        await pane
          .locator('.xterm')
          .evaluate((el, original) => el === original, terminal)
      ).toBe(true)
      expect(
        await sibling
          .locator('.xterm')
          .evaluate((el, original) => el === original, siblingTerminal)
      ).toBe(true)
      await expect(sibling.getByRole('status')).toHaveText('running')
    }
    for (const close of ['button', 'escape', 'shortcut']) {
      await clickTerminalOption(page, 'Search terminal')
      const search = pane.getByRole('textbox', {
        name: 'Search terminal output'
      })
      await search.fill('search match')
      await pane
        .getByRole('button', { name: 'Next match', exact: true })
        .click()
      await expect(pane.locator('.xterm-decoration')).not.toHaveCount(0)
      if (close === 'button')
        await pane.getByRole('button', { name: 'Close search' }).click()
      else {
        await search.focus()
        await page.keyboard.press(
          close === 'escape' ? 'Escape' : 'Control+Shift+F'
        )
      }
      await expect(search).toHaveCount(0)
      await expect(pane.locator('.xterm-decoration')).toHaveCount(0)
      await expect(pane.locator('.xterm-helper-textarea')).toBeFocused()
    }
    await page.keyboard.press('Control+Shift+W')
    await expect(panes).toHaveCount(1)
    expect(await fixture('getSessionIds')).toEqual([ids[0]])
    expect(await fixture('getSessionListenerCount')).toBe(1)
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
