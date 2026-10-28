import {
  _electron as electron,
  expect,
  test as base,
  type Page
} from '@playwright/test'
import { mkdtemp, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import type { DesktopApi } from '../../src/contracts/desktop-api'
import { clickTerminalOption } from '../fixtures/terminal-options'

const test = base.extend<{ terminalPage: Page }>({
  // eslint-disable-next-line no-empty-pattern -- Playwright requires destructured fixtures.
  terminalPage: async ({}, use) => {
    const profile = await mkdtemp(join(tmpdir(), 'terminal-input-'))
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
      await use(page)
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
})

function fixture(page: Page, method: string, id?: string) {
  return page.evaluate(
    ({ method, id }) =>
      Reflect.get(Reflect.get(globalThis, 'uiFixture'), method)(id),
    { method, id }
  )
}
function writeClipboard(page: Page, text: string) {
  return page.evaluate(
    (text) =>
      (Reflect.get(globalThis, 'desktop') as DesktopApi).writeClipboard(text),
    text
  )
}
function readClipboard(page: Page) {
  return page.evaluate(() =>
    (Reflect.get(globalThis, 'desktop') as DesktopApi).readClipboard()
  )
}

test('keyboard input, clipboard aliases and interruption preserve exact input and focus', async ({
  terminalPage: page
}) => {
  const terminal = page.locator('.xterm-helper-textarea')
  await expect(terminal).toBeFocused()
  await page.keyboard.type('typed once', { delay: 15 })
  await expect
    .poll(async () =>
      ((await fixture(page, 'getSessionWrites')) as { data: string }[])
        .map((entry) => entry.data)
        .join('')
    )
    .toBe('typed once')
  for (const shortcut of ['Control+V', 'Shift+Insert', 'Control+Shift+V']) {
    const before = (await fixture(page, 'getSessionWrites')).length
    await writeClipboard(page, 'PASTE_世界\r\nnext')
    await page.keyboard.press(shortcut)
    await expect
      .poll(async () =>
        ((await fixture(page, 'getSessionWrites')) as { data: string }[])
          .slice(before)
          .map((entry) => entry.data)
          .join('')
      )
      .toBe('PASTE_世界\rnext')
    await expect(terminal).toBeFocused()
  }
  await page.keyboard.press('Control+Shift+F')
  const search = page.getByRole('textbox', { name: 'Search terminal output' })
  await search.fill('search match')
  await page.getByRole('button', { name: 'Next match', exact: true }).click()
  await terminal.focus()
  await writeClipboard(page, 'before copy')
  const beforeCopy = (await fixture(page, 'getSessionWrites')).length
  await page.keyboard.press('Control+C')
  await expect.poll(() => readClipboard(page)).toBe('search match')
  expect((await fixture(page, 'getSessionWrites')).length).toBe(beforeCopy)
  await page.keyboard.press('Control+Shift+C')
  await expect.poll(() => readClipboard(page)).toBe('search match')
  await page.getByRole('button', { name: 'Close search' }).click()
  await page.keyboard.press('Control+C')
  await expect
    .poll(async () => (await fixture(page, 'getSessionWrites')).at(-1)?.data)
    .toBe('\u0003')

  await page.keyboard.press('Control+Shift+F')
  await search.fill('editable search')
  const reads = await fixture(page, 'getClipboardReadCount')
  await writeClipboard(page, 'leave terminal clipboard alone')
  await search.evaluate((element) =>
    Reflect.get(element, 'select').call(element)
  )
  await page.keyboard.press('Control+Shift+C')
  expect(await readClipboard(page)).toBe('leave terminal clipboard alone')
  const afterRead = await fixture(page, 'getClipboardReadCount')
  expect(afterRead).toBe(reads + 1)
  await page.keyboard.press('Control+Shift+V')
  expect(await fixture(page, 'getClipboardReadCount')).toBe(afterRead)
  await expect(search).toBeFocused()
})

test('typing and unrelated preference saves do not redraw existing output or resize the PTY', async ({
  terminalPage: page
}) => {
  const terminal = page.locator('.xterm-helper-textarea')
  await expect(page.locator('.xterm-rows')).toContainText('search match two')
  await page.evaluate(() => {
    const dom = Reflect.get(globalThis, 'document')
    const firstRow = dom.querySelector('.xterm-rows').firstElementChild
    const state = { changes: 0 }
    const Observer = Reflect.get(globalThis, 'MutationObserver')
    new Observer((changes: unknown[]) => {
      state.changes += changes.length
    }).observe(firstRow, {
      childList: true,
      subtree: true,
      characterData: true
    })
    Reflect.set(globalThis, '__inputRedraws', state)
  })
  const terminalNode = await page.locator('.xterm').elementHandle()
  const grids = (await fixture(page, 'getSessionResizes')).length
  await terminal.focus()
  await page.keyboard.type('no redraw of older output', { delay: 25 })
  await expect(page.locator('.xterm-rows')).toContainText(
    'no redraw of older output'
  )
  expect(
    await page.evaluate(() => Reflect.get(globalThis, '__inputRedraws').changes)
  ).toBe(0)
  await clickTerminalOption(page, 'Developer settings')
  const settings = page.getByRole('dialog', {
    name: 'Developer settings',
    exact: true
  })
  // xterm redraws on blur to remove active selection styling. Saving settings
  // with the same font/theme must not cause any additional full redraws.
  const afterBlur = await page.evaluate(
    () => Reflect.get(globalThis, '__inputRedraws').changes
  )
  await settings
    .getByRole('button', { name: 'Save developer settings', exact: true })
    .click()
  await expect(settings.getByRole('status')).toContainText('saved')
  await settings
    .getByRole('button', { name: 'Close developer settings' })
    .click()
  await expect(terminal).toBeFocused()
  expect(
    await page
      .locator('.xterm')
      .evaluate((element, original) => element === original, terminalNode)
  ).toBe(true)
  expect(
    await page.evaluate(() => Reflect.get(globalThis, '__inputRedraws').changes)
  ).toBe(afterBlur)
  expect((await fixture(page, 'getSessionResizes')).length).toBe(grids)
})

test('large bracketed pastes preserve Unicode and stay inside IPC chunk limits', async ({
  terminalPage: page
}) => {
  const [id] = (await fixture(page, 'getSessionIds')) as string[]
  await page.evaluate(
    ({ id }) =>
      (Reflect.get(globalThis, 'desktop') as DesktopApi).writeSession(
        id!,
        '\u001b[?2004h'
      ),
    { id }
  )
  await expect(page.locator('.xterm-rows')).toContainText('search match two')
  const before = (await fixture(page, 'getSessionWrites')).length
  const text = 'A'.repeat(16377) + '\u{20000}' + 'B'.repeat(262144 - 16379)
  await writeClipboard(page, text)
  await page.keyboard.press('Control+V')
  const expected = `\u001b[200~${text}\u001b[201~`
  await expect
    .poll(async () =>
      ((await fixture(page, 'getSessionWrites')) as { data: string }[])
        .slice(before)
        .map((entry) => entry.data)
        .join('')
    )
    .toBe(expected)
  const chunks = (
    (await fixture(page, 'getSessionWrites')) as { data: string }[]
  ).slice(before)
  expect(chunks.length).toBeGreaterThan(1)
  for (const { data } of chunks) {
    expect(data.length).toBeLessThanOrEqual(16384)
    expect(data).not.toMatch(/[\uD800-\uDBFF]$/)
    expect(data).not.toMatch(/^[\uDC00-\uDFFF]/)
  }
})

test('Enter and later typing wait behind a pending paste', async ({
  terminalPage: page
}) => {
  await writeClipboard(page, 'pasted command')
  await fixture(page, 'holdNextClipboardRead')
  await page.keyboard.press('Control+V')
  await expect.poll(() => fixture(page, 'getClipboardReadCount')).toBe(1)
  await page.keyboard.press('Enter')
  await page.keyboard.type('next command')
  expect(await fixture(page, 'getSessionWrites')).toHaveLength(0)
  await fixture(page, 'finishClipboardRead')
  await expect
    .poll(async () =>
      ((await fixture(page, 'getSessionWrites')) as { data: string }[])
        .map((entry) => entry.data)
        .join('')
    )
    .toBe('pasted command\rnext command')
})

test('pending clipboard reads cannot reach a restarted session', async ({
  terminalPage: page
}) => {
  const [id] = (await fixture(page, 'getSessionIds')) as string[]
  await writeClipboard(page, 'must not execute in the new shell')
  await fixture(page, 'holdNextClipboardRead')
  await page.keyboard.press('Control+V')
  await expect.poll(() => fixture(page, 'getClipboardReadCount')).toBe(1)
  await fixture(page, 'exitSession', id)
  await page
    .getByRole('button', { name: 'Restart session', exact: true })
    .click()
  await expect(page.getByRole('status')).toHaveText('running')
  await fixture(page, 'finishClipboardRead')
  await page.keyboard.type('fresh')
  await expect
    .poll(async () =>
      ((await fixture(page, 'getSessionWrites')) as { data: string }[])
        .map((entry) => entry.data)
        .join('')
    )
    .toBe('fresh')
})

test('clipboard failure releases queued typing without stopping the session', async ({
  terminalPage: page
}) => {
  await fixture(page, 'failNextClipboardRead')
  await fixture(page, 'holdNextClipboardRead')
  await page.keyboard.press('Control+V')
  await expect.poll(() => fixture(page, 'getClipboardReadCount')).toBe(1)
  await page.keyboard.type('still usable')
  await fixture(page, 'finishClipboardRead')
  await expect(page.getByRole('alert')).toContainText(
    'Clipboard operation failed'
  )
  await expect
    .poll(async () =>
      ((await fixture(page, 'getSessionWrites')) as { data: string }[])
        .map((entry) => entry.data)
        .join('')
    )
    .toBe('still usable')
  await expect(page.getByRole('status')).toHaveText('running')
  expect(await fixture(page, 'getSessionIds')).toHaveLength(1)
})

test('startup events keep exited private sessions read-only', async ({
  terminalPage: page
}) => {
  await fixture(page, 'holdNextSessionReply')
  await clickTerminalOption(page, 'Private tab')
  await expect
    .poll(async () => (await fixture(page, 'getSessionIds')).length)
    .toBe(2)
  const ids = (await fixture(page, 'getSessionIds')) as string[]
  const id = ids[1]!
  await page.keyboard.type('ignored while starting')
  expect(await fixture(page, 'getSessionWrites')).toHaveLength(0)
  await fixture(page, 'exitSession', id)
  await fixture(page, 'readySessionIntegration', id)
  await fixture(page, 'finishSessionReply')
  const pane = page.locator('.tab-viewport:not([hidden])')
  await expect(pane.getByRole('status')).toHaveText('Exited (7)')
  await pane.locator('.xterm-helper-textarea').focus()
  await page.keyboard.type('ignored after exit')
  await writeClipboard(page, 'ignored paste')
  await page.keyboard.press('Control+V')
  expect(await fixture(page, 'getSessionWrites')).toHaveLength(0)
  expect(await fixture(page, 'getClipboardReadCount')).toBe(0)
})

test('a stopped pane can restart after its closed session record is reclaimed', async ({
  terminalPage: page
}) => {
  const [id] = (await fixture(page, 'getSessionIds')) as string[]
  await clickTerminalOption(page, 'Stop session')
  await expect(page.getByRole('status')).toHaveText('closed')
  await fixture(page, 'forgetClosedSession', id)
  await page
    .getByRole('button', { name: 'Restart session', exact: true })
    .click()
  await expect(page.getByRole('status')).toHaveText('running')
  await expect(page.locator('.xterm-helper-textarea')).toBeFocused()
  const ids = (await fixture(page, 'getSessionIds')) as string[]
  expect(ids).toHaveLength(1)
  expect(ids[0]).not.toBe(id)
})
