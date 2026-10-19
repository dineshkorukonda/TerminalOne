import { _electron as electron, expect, test } from '@playwright/test'
import { mkdtemp, rm, realpath } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import type { DesktopApi, SessionEvent } from '../src/contracts/desktop-api'

test('PowerShell complete-command history is opt-in and private sessions never reach storage', async () => {
  const profile = await mkdtemp(join(tmpdir(), 'terminal-history-native-'))
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
  await page.getByRole('button', { name: 'Terminal options' }).click()
  try {
    await expect(page.getByRole('status')).toHaveText('running', {
      timeout: 20000
    })
    const shells = await page.evaluate(async () => {
      const api = Reflect.get(globalThis, 'desktop') as DesktopApi
      const value = await api.getPreferences()
      await api.savePreferences({
        ...value.settings,
        history: { enabled: true, limit: 50 }
      })
      Reflect.set(globalThis, '__historyEvents', [])
      api.onSessionEvent((event) => {
        ;(Reflect.get(globalThis, '__historyEvents') as SessionEvent[]).push(
          event
        )
        if (event.type === 'data')
          void api.acknowledgeSession(event.id, event.sequence)
      })
      return (await api.listShells()).filter((shell) =>
        ['pwsh', 'powershell'].includes(shell.id)
      )
    })
    for (const shell of shells) {
      const id = await page.evaluate(
        async (shellId) =>
          (
            await (
              Reflect.get(globalThis, 'desktop') as DesktopApi
            ).createSession({ shellId, cols: 100, rows: 30 })
          ).id,
        shell.id
      )
      await expect
        .poll(
          () =>
            page.evaluate(
              (id) =>
                (
                  Reflect.get(globalThis, '__historyEvents') as SessionEvent[]
                ).some(
                  (event) =>
                    event.id === id &&
                    event.type === 'integration' &&
                    event.ready
                ),
              id
            ),
          { timeout: 20000 }
        )
        .toBe(true)
      await page.evaluate(
        async ({ id, command }) =>
          (Reflect.get(globalThis, 'desktop') as DesktopApi).writeSession(
            id,
            command
          ),
        { id, command: `Write-Output ('PUBLIC_' + '${shell.id}')\r` }
      )
      await expect
        .poll(
          () =>
            page.evaluate(
              async (shellId) =>
                (
                  await (
                    Reflect.get(globalThis, 'desktop') as DesktopApi
                  ).searchHistory('PUBLIC_', shellId)
                ).length,
              shell.id
            ),
          { timeout: 15000 }
        )
        .toBe(1)
      await page.evaluate(
        (id) =>
          (Reflect.get(globalThis, 'desktop') as DesktopApi).closeSession(id),
        id
      )
    }
    const privateId = await page.evaluate(
      async () =>
        (
          await (
            Reflect.get(globalThis, 'desktop') as DesktopApi
          ).createSession({
            shellId: 'powershell',
            cols: 100,
            rows: 30,
            private: true
          })
        ).id
    )
    await expect
      .poll(
        () =>
          page.evaluate(
            (id) =>
              (
                Reflect.get(globalThis, '__historyEvents') as SessionEvent[]
              ).some(
                (event) =>
                  event.id === id && event.type === 'integration' && event.ready
              ),
            privateId
          ),
        { timeout: 20000 }
      )
      .toBe(true)
    await page.evaluate(
      (id) =>
        (Reflect.get(globalThis, 'desktop') as DesktopApi).writeSession(
          id,
          "Write-Output ('PRIVATE_' + 'DONE')\r"
        ),
      privateId
    )
    await expect
      .poll(
        () =>
          page.evaluate(
            (id) =>
              (Reflect.get(globalThis, '__historyEvents') as SessionEvent[])
                .filter((event) => event.id === id && event.type === 'data')
                .map((event) => (event.type === 'data' ? event.data : ''))
                .join('')
                .includes('PRIVATE_DONE'),
            privateId
          ),
        { timeout: 15000 }
      )
      .toBe(true)
    expect(
      await page.evaluate(() =>
        (Reflect.get(globalThis, 'desktop') as DesktopApi).searchHistory(
          'PRIVATE_',
          'all'
        )
      )
    ).toEqual([])
    await page.evaluate(
      (id) =>
        (Reflect.get(globalThis, 'desktop') as DesktopApi).closeSession(id),
      privateId
    )
    await page.evaluate(async () => {
      const api = Reflect.get(globalThis, 'desktop') as DesktopApi
      const value = await api.getPreferences()
      await api.savePreferences({
        ...value.settings,
        history: { enabled: false, limit: 50 }
      })
    })
    expect(
      await page.evaluate(() =>
        (Reflect.get(globalThis, 'desktop') as DesktopApi).searchHistory(
          '',
          'all'
        )
      )
    ).toEqual([])
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

test('saved projects restore fresh sessions only after explicit confirmation', async () => {
  const profile = await mkdtemp(join(tmpdir(), 'terminal-restore-native-'))
  const folder = await mkdtemp(join(tmpdir(), 'Terminal project 世界 '))
  const canonicalFolder = await realpath(folder)
  const env = Object.fromEntries(
    Object.entries(process.env).filter(
      (entry): entry is [string, string] => entry[1] !== undefined
    )
  )
  delete env['ELECTRON_RUN_AS_NODE']
  delete env['ELECTRON_RENDERER_URL']
  let app = await electron.launch({
    args: ['.', `--user-data-dir=${profile}`],
    env
  })
  try {
    let page = await app.firstWindow()
    await expect(page.getByRole('status')).toHaveText('running', {
      timeout: 20000
    })
    await app.evaluate(({ dialog }, folder) => {
      dialog.showOpenDialog = async () => ({
        canceled: false,
        filePaths: [folder]
      })
    }, folder)
    await page
      .getByRole('button', { name: 'Open project', exact: true })
      .click()
    await expect(
      page.getByRole('combobox', { name: 'Project', exact: true })
    ).not.toHaveValue('')
    await page.getByRole('button', { name: 'New session', exact: true }).click()
    let panel = page.locator('.tab-viewport:not([hidden])')
    await expect(panel.getByRole('status')).toHaveText('running', {
      timeout: 20000
    })
    await panel.locator('.xterm-helper-textarea').focus()
    await page.keyboard.type(
      "$env:TERMINAL_RESTORE_TEST='synthetic'; Write-Output ('SET_' + 'OK')"
    )
    await page.keyboard.press('Enter')
    await expect(panel.locator('.xterm-accessibility-tree')).toContainText(
      'SET_OK'
    )
    await page
      .getByRole('button', { name: 'Developer settings', exact: true })
      .click()
    const settings = page.getByRole('dialog', {
      name: 'Developer settings',
      exact: true
    })
    await settings
      .getByRole('button', { name: 'Save current layout', exact: true })
      .click()
    await expect(settings.getByRole('status')).toContainText('layout saved')
    await app.close()
    app = await electron.launch({
      args: ['.', `--user-data-dir=${profile}`],
      env
    })
    page = await app.firstWindow()
    await expect(
      page.getByRole('button', { name: 'Restore saved layout', exact: true })
    ).toBeVisible()
    await expect(page.locator('.xterm')).toHaveCount(0)
    await page
      .getByRole('button', { name: 'Restore saved layout', exact: true })
      .click()
    await expect(page.getByRole('tab')).toHaveCount(2)
    await page.getByRole('tab').last().click()
    panel = page.locator('.tab-viewport:not([hidden])')
    await expect(panel.getByRole('status')).toHaveText('running', {
      timeout: 20000
    })
    await panel.locator('.xterm-helper-textarea').focus()
    await page.keyboard.type(
      "Write-Output ('RESTORED_' + (Get-Location).Path); if (!$env:TERMINAL_RESTORE_TEST) { Write-Output ('FRESH_' + 'OK') }"
    )
    await page.keyboard.press('Enter')
    await expect(panel.locator('.xterm-accessibility-tree')).toContainText(
      `RESTORED_${canonicalFolder}`
    )
    await expect(panel.locator('.xterm-accessibility-tree')).toContainText(
      'FRESH_OK'
    )
  } finally {
    await app.close()
    await rm(profile, {
      recursive: true,
      force: true,
      maxRetries: 5,
      retryDelay: 200
    })
    await rm(folder, {
      recursive: true,
      force: true,
      maxRetries: 10,
      retryDelay: 100
    })
  }
})
