import { _electron as electron, expect, test } from '@playwright/test'
import type { Page } from '@playwright/test'
import { mkdtemp, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { createRequire } from 'node:module'
import type { DesktopApi } from '../src/contracts/desktop-api'

const require = createRequire(join(process.cwd(), 'package.json'))
const watchProcesses = require('./fixtures/process-watch.cjs') as (
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
  await page.locator('.xterm-helper-textarea').focus()
  await page.keyboard.type(input)
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
    await page
      .getByRole('combobox', { name: 'Shell' })
      .selectOption('powershell')
    await expect(page.getByRole('status')).toHaveText('running')
    await command(
      page,
      "Write-Output ([char]27 + '[32m' + 'UI_' + '世界' + [char]27 + '[0m')"
    )
    await expect(page.locator('.xterm-accessibility-tree')).toContainText(
      'UI_世界'
    )
    await command(
      page,
      "Write-Output ('BUSY_' + 'READY'); Start-Sleep -Seconds 90"
    )
    await expect(page.locator('.xterm-accessibility-tree')).toContainText(
      'BUSY_READY'
    )
    await page.keyboard.press('Control+c')
    await waitForPrompt(page)
    await command(page, "Write-Output ('CTRL_' + 'OK')")
    await expect(page.locator('.xterm-accessibility-tree')).toContainText(
      'CTRL_OK'
    )
    await app.evaluate(({ BrowserWindow }) => {
      BrowserWindow.getAllWindows()[0]!.setSize(1000, 720)
    })
    await expect(page.locator('.xterm-screen')).toHaveCSS('height', /\d+px/)
    await command(page, 'exit 0')
    await expect(page.getByRole('status')).toHaveText('Exited (0)')
    await page.getByRole('button', { name: 'New session' }).click()
    await expect(page.getByRole('status')).toHaveText('running')
    await command(page, "Write-Output ('RESTART_' + 'OK')")
    await expect(page.locator('.xterm-accessibility-tree')).toContainText(
      'RESTART_OK'
    )
    await page.getByRole('button', { name: 'Close session' }).click()
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
      watcher = await watchProcesses([tree.root, tree.child])
      if (mode === 'main-crash') {
        fixture.app.process().kill()
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
