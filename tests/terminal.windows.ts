import {
  clickTerminalOption,
  openTerminalOptions
} from './fixtures/terminal-options'
import { _electron as electron, expect, test } from '@playwright/test'
import type { Page } from '@playwright/test'
import { mkdtemp, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { createRequire } from 'node:module'
import type { DesktopApi } from '../src/contracts/desktop-api'

const require = createRequire(join(process.cwd(), 'package.json'))
const watchProcesses = require('./tests/fixtures/process-watch.cjs') as (
  pids: number[]
) => Promise<{ done: Promise<void>; cancel(): void }>
async function launch() {
  const profile = await mkdtemp(join(tmpdir(), 'terminal-native-ui-'))
  const env = Object.fromEntries(
    Object.entries(process.env).filter(
      (entry): entry is [string, string] => entry[1] !== undefined
    )
  )
  delete env['ELECTRON_RUN_AS_NODE']
  delete env['ELECTRON_RENDERER_URL']
  const app = await electron.launch({
    args: ['.', `--user-data-dir=${profile}`],
    env
  })
  const page = await app.firstWindow()
  await expect(page.getByRole('status')).toHaveText('running', {
    timeout: 20000
  })
  await page.getByRole('button', { name: 'Terminal options' }).click()
  await openTerminalOptions(page)
  await page.getByRole('combobox', { name: 'Shell' }).selectOption('powershell')
  await page.keyboard.press('Control+Shift+W')
  await page.getByRole('button', { name: 'New session', exact: true }).click()
  await expect(page.getByRole('status')).toHaveText('running')
  await waitForPrompt(page)
  return {
    app,
    page,
    async dispose() {
      await app.close()
      await rm(profile, {
        recursive: true,
        force: true,
        maxRetries: 5,
        retryDelay: 200
      })
    }
  }
}
async function command(page: Page, input: string) {
  await page
    .locator('.tab-viewport:not([hidden]) .pane-active .xterm-helper-textarea')
    .focus()
  if ([...input].some((character) => character.codePointAt(0)! > 127)) {
    // Screen-reader mode deliberately filters input-only insertText events.
    // Exercise Unicode through the same paste event xterm receives from the OS.
    await page
      .locator('.xterm-helper-textarea:visible')
      .evaluate((element, text) => {
        const Transfer = Reflect.get(globalThis, 'DataTransfer')
        const PasteEvent = Reflect.get(globalThis, 'ClipboardEvent')
        const data = new Transfer()
        data.setData('text/plain', text)
        element.dispatchEvent(
          new PasteEvent('paste', {
            clipboardData: data,
            bubbles: true,
            cancelable: true
          })
        )
      }, input)
  } else await page.keyboard.type(input)
  await page.keyboard.press('Enter')
}

async function waitForPrompt(page: Page) {
  await expect
    .poll(
      async () => {
        const rows = await page
          .locator('.xterm-accessibility-tree:visible > div')
          .allTextContents()
        return (
          rows
            .map((row) => row.trim())
            .filter(Boolean)
            .at(-1) ?? ''
        )
      },
      { timeout: 15000 }
    )
    .toMatch(/^PS .*?>$/)
}

test('xterm renders live ANSI and Unicode, sends Ctrl+C, fits grids, and restarts', async () => {
  const fixture = await launch()
  const { app, page } = fixture
  try {
    await openTerminalOptions(page)
    await page
      .getByRole('combobox', { name: 'Shell' })
      .selectOption('powershell')
    await expect(page.getByRole('status')).toHaveText('running')
    await command(
      page,
      "Write-Output ([char]27 + '[32m' + 'UI_' + '世界' + [char]27 + '[0m')"
    )
    await expect(
      page.locator('.tab-viewport:not([hidden]) .xterm-accessibility-tree')
    ).toContainText('UI_世界')
    await command(
      page,
      "Write-Output ('BUSY_' + 'READY'); Start-Sleep -Seconds 90"
    )
    await expect(
      page.locator('.tab-viewport:not([hidden]) .xterm-accessibility-tree')
    ).toContainText('BUSY_READY')
    await page.keyboard.press('Control+c')
    await waitForPrompt(page)
    await command(page, "Write-Output ('CTRL_' + 'OK')")
    await expect(
      page.locator('.tab-viewport:not([hidden]) .xterm-accessibility-tree')
    ).toContainText('CTRL_OK')
    await app.evaluate(({ BrowserWindow }) => {
      BrowserWindow.getAllWindows()[0]!.setSize(1000, 720)
    })
    await expect(
      page.locator('.tab-viewport:not([hidden]) .xterm-screen')
    ).toHaveCSS('height', /\d+px/)
    await command(page, 'exit 0')
    await expect(page.getByRole('status')).toHaveText('Exited (0)')
    await app.evaluate(({ BrowserWindow }) => {
      BrowserWindow.getAllWindows()[0]!.setContentSize(900, 600)
    })
    await expect(page.getByRole('status')).toHaveText('Exited (0)')
    await page.getByRole('button', { name: 'New session' }).click()
    await expect(page.getByRole('status')).toHaveText('running')
    await command(page, "Write-Output ('RESTART_' + 'OK')")
    await expect(
      page.locator('.tab-viewport:not([hidden]) .xterm-accessibility-tree')
    ).toContainText('RESTART_OK')
    await clickTerminalOption(page, 'Close session')
    await expect(page.getByRole('status')).toHaveText('closed')
  } finally {
    await fixture.dispose()
  }
})

async function ownedTree(page: Page) {
  return page.evaluate(async () => {
    const api = Reflect.get(globalThis, 'desktop') as DesktopApi
    let sessionId = '',
      output = ''
    let resolveChild!: (pid: number) => void
    let rejectChild!: (error: Error) => void
    const child = new Promise<number>((resolve, reject) => {
      resolveChild = resolve
      rejectChild = reject
    })
    const timeout = setTimeout(
      () => rejectChild(new Error('Child PID was not emitted')),
      15000
    )
    const early: { id: string; sequence: number }[] = []
    const unsubscribe = api.onSessionEvent((event) => {
      if (event.type !== 'data') return
      if (!sessionId) {
        early.push(event)
        return
      }
      if (event.id !== sessionId) return
      output = (output + event.data).slice(-65536)
      void api.acknowledgeSession(sessionId, event.sequence)
      const match = output.match(/CHILD_(\d+)/)
      if (match) resolveChild(Number(match[1]))
    })
    try {
      const session = await api.createSession({
        shellId: 'powershell',
        cols: 120,
        rows: 30
      })
      sessionId = session.id
      for (const event of early)
        if (event.id === sessionId)
          await api.acknowledgeSession(sessionId, event.sequence)
      await api.writeSession(
        sessionId,
        "$child=Start-Process -NoNewWindow -FilePath (Join-Path $PSHOME 'powershell.exe') -ArgumentList @('-NoProfile','-Command','Start-Sleep -Seconds 120') -PassThru; Write-Output ('CHILD_' + $child.Id)\r"
      )
      return { root: session.pid!, child: await child, id: sessionId }
    } finally {
      clearTimeout(timeout)
      unsubscribe()
    }
  })
}
for (const mode of [
  'renderer-crash',
  'window-close',
  'app-quit',
  'main-crash'
] as const) {
  test(`owned shell tree exits after ${mode}`, async () => {
    const fixture = await launch()
    let watcher: Awaited<ReturnType<typeof watchProcesses>> | undefined
    try {
      const tree = await ownedTree(fixture.page)
      // On Windows, Playwright's process() is a cmd.exe launcher, not Electron.
      const mainPid =
        mode === 'main-crash'
          ? await fixture.app.evaluate(() => process.pid)
          : null
      watcher = await watchProcesses([
        tree.root,
        tree.child,
        ...(mainPid ? [mainPid] : [])
      ])
      if (mode === 'main-crash') {
        process.kill(mainPid!, 'SIGKILL')
      } else if (mode === 'renderer-crash') {
        await fixture.app.evaluate(({ BrowserWindow }) =>
          BrowserWindow.getAllWindows()[0]!.webContents.forcefullyCrashRenderer()
        )
      } else if (mode === 'window-close') {
        const closed = fixture.app.waitForEvent('close')
        await fixture.app
          .evaluate(({ BrowserWindow }) =>
            BrowserWindow.getAllWindows()[0]!.close()
          )
          .catch(() => {})
        await closed
      } else {
        const closed = fixture.app.waitForEvent('close')
        await fixture.app.evaluate(({ app }) => app.quit()).catch(() => {})
        await closed
      }
      await watcher.done
    } finally {
      watcher?.cancel()
      await fixture.dispose()
    }
  })
}

test('terminal capabilities reject forged payloads and detach event subscribers', async () => {
  const fixture = await launch()
  try {
    const result = await fixture.page.evaluate(async () => {
      const api = Reflect.get(globalThis, 'desktop') as DesktopApi
      const rejected: boolean[] = []
      const attempts = [
        () => api.createSession({ shellId: 'powershell', cols: 0, rows: 24 }),
        () =>
          api.createSession({ shellId: 'missing-shell', cols: 80, rows: 24 }),
        () =>
          Reflect.apply(api.createSession, undefined, [
            {
              shellId: 'powershell',
              cols: 80,
              rows: 24,
              executable: 'evil.exe'
            }
          ]),
        () => api.writeSession('unknown-owned-session', 'x'),
        () =>
          api.resizeSession('unknown-owned-session', { cols: 80, rows: 24 }),
        () => api.closeSession('unknown-owned-session'),
        () => Reflect.apply(api.listShells, undefined, ['extra'])
      ]
      for (const attempt of attempts) {
        try {
          await attempt()
          rejected.push(false)
        } catch {
          rejected.push(true)
        }
      }
      let events = 0
      const detach = api.onSessionEvent(() => {
        events++
      })
      detach()
      detach()
      const session = await api.createSession({
        shellId: 'cmd',
        cols: 80,
        rows: 24
      })
      await api.closeSession(session.id)
      await api.closeSession(session.id)
      return { rejected, events }
    })
    expect(result.rejected).toEqual(Array(7).fill(true))
    expect(result.events).toBe(0)
  } finally {
    await fixture.dispose()
  }
})

test('real tabs and panes preserve sessions, search output and use the scoped Windows clipboard', async () => {
  const fixture = await launch()
  const { page } = fixture
  const visible = page.locator('.tab-viewport:not([hidden])')
  const originalClipboard = await page.evaluate(() =>
    (Reflect.get(globalThis, 'desktop') as DesktopApi).readClipboard()
  )
  async function captureStart(action: () => Promise<unknown>) {
    const started = page.evaluate(
      () =>
        new Promise<{ id: string; pid: number }>((resolve, reject) => {
          const api = Reflect.get(globalThis, 'desktop') as DesktopApi
          const timer = setTimeout(() => {
            detach()
            reject(new Error('UI session start timed out'))
          }, 15000)
          const detach = api.onSessionEvent((event) => {
            if (
              event.type === 'state' &&
              event.state === 'running' &&
              event.pid
            ) {
              clearTimeout(timer)
              detach()
              resolve({ id: event.id, pid: event.pid })
            }
          })
        })
    )
    await action()
    return started
  }
  try {
    await command(
      page,
      "$env:TERMINAL_UI_ISOLATION='first'; Write-Output ('TAB_ONE_' + 'OK')"
    )
    await expect(visible.locator('.xterm-accessibility-tree')).toContainText(
      'TAB_ONE_OK'
    )
    await openTerminalOptions(page)
    await page
      .getByRole('combobox', { name: 'Shell' })
      .selectOption('powershell')
    const second = await captureStart(() =>
      page.getByRole('button', { name: 'New session', exact: true }).click()
    )
    await expect(page.getByRole('tab')).toHaveCount(2)
    await command(
      page,
      "if (!$env:TERMINAL_UI_ISOLATION) {Write-Output ('ISOLATED_' + 'OK')}"
    )
    await expect(visible.locator('.xterm-accessibility-tree')).toContainText(
      'ISOLATED_OK'
    )
    await page.getByRole('tab').first().click()
    await page.evaluate(
      ({ id }) =>
        (Reflect.get(globalThis, 'desktop') as DesktopApi).writeSession(
          id,
          "Write-Output ('HIDDEN_' + 'OUTPUT')\r"
        ),
      second
    )
    await page.getByRole('tab').nth(1).click()
    await expect(visible.locator('.xterm-accessibility-tree')).toContainText(
      'HIDDEN_OUTPUT'
    )
    const split = await captureStart(() =>
      clickTerminalOption(page, 'Split right')
    )
    await expect(visible.locator('.xterm')).toHaveCount(2)
    const watcher = await watchProcesses([split.pid])
    try {
      await visible
        .getByRole('button', { name: 'Close pane', exact: true })
        .last()
        .click()
      await watcher.done
    } finally {
      watcher.cancel()
    }
    await expect(visible.locator('.xterm')).toHaveCount(1)
    await page.evaluate(() =>
      (Reflect.get(globalThis, 'desktop') as DesktopApi).writeClipboard(
        "Write-Output ('PASTE_' + 'OK')\r\nWrite-Output ('LINE_' + 'TWO')\r\n"
      )
    )
    await clickTerminalOption(page, 'Paste clipboard')
    await page.keyboard.press('Enter')
    await expect(visible.locator('.xterm-accessibility-tree')).toContainText(
      'PASTE_OK'
    )
    await expect(visible.locator('.xterm-accessibility-tree')).toContainText(
      'LINE_TWO'
    )
    await clickTerminalOption(page, 'Search terminal')
    await visible
      .getByRole('textbox', { name: 'Search terminal output' })
      .fill('PASTE_OK')
    await visible
      .getByRole('button', { name: 'Next match', exact: true })
      .click()
    await clickTerminalOption(page, 'Copy selection')
    await expect
      .poll(() =>
        page.evaluate(() =>
          (Reflect.get(globalThis, 'desktop') as DesktopApi).readClipboard()
        )
      )
      .toBe('PASTE_OK')
    await page.getByRole('tab').first().click()
    await expect(visible.locator('.xterm-accessibility-tree')).toContainText(
      'TAB_ONE_OK'
    )
  } finally {
    await page
      .evaluate(
        (text) =>
          (Reflect.get(globalThis, 'desktop') as DesktopApi).writeClipboard(
            text
          ),
        originalClipboard
      )
      .catch(() => {})
    await fixture.dispose()
  }
})
