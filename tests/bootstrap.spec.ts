import { _electron as electron, expect, test } from '@playwright/test'
import { mkdtemp, rm, writeFile, readFile } from 'node:fs/promises'
import { spawnSync } from 'node:child_process'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import type { ViteDevServer } from 'vite'
import type { DesktopApi } from '../src/contracts/desktop-api'

for (const mode of ['built', 'development'] as const) {
  for (const scale of [1, 1.5, 2]) {
    // eslint-disable-next-line no-empty-pattern -- Playwright requires a destructured fixture argument.
    test(`launches the ${mode} React window at ${scale * 100}% with an isolated renderer`, async ({}, testInfo) => {
      const profile = await mkdtemp(join(tmpdir(), 'terminal-one-smoke-'))
      // Do not inherit an electron-vite development URL or Electron's Node mode.
      const env: Record<string, string> = {}
      for (const [key, value] of Object.entries(process.env)) {
        if (value !== undefined) env[key] = value
      }
      delete env['ELECTRON_RENDERER_URL']
      delete env['ELECTRON_RUN_AS_NODE']

      let server: ViteDevServer | undefined
      try {
        if (mode === 'development') {
          const { resolveConfig } = await import('electron-vite')
          const { createServer } = await import('vite')
          const config = await resolveConfig({}, 'serve', 'development')
          if (!config.config?.renderer)
            throw new Error('Missing renderer configuration')
          server = await createServer(config.config.renderer)
          await server.listen()
          env['ELECTRON_RENDERER_URL'] = 'http://127.0.0.1:5173'
        }
        const app = await electron.launch({
          args: [
            '.',
            `--user-data-dir=${profile}`,
            `--force-device-scale-factor=${scale}`
          ],
          env
        })
        try {
          const window = await app.firstWindow()
          const errors: string[] = []
          window.on('pageerror', (error) => errors.push(error.message))
          await expect(window).toHaveTitle('Terminal One')
          await expect(
            window.getByRole('heading', { name: 'Terminal One' })
          ).toBeAttached()
          await expect(
            window.getByRole('combobox', { name: 'Shell' })
          ).toBeHidden()
          await window.getByRole('button', { name: 'Terminal options' }).click()
          await expect(
            window.getByRole('combobox', { name: 'Shell' })
          ).toBeVisible()
          if (process.platform === 'win32') {
            await expect(window.locator('.xterm')).toBeVisible()
            await expect(window.getByRole('status')).toHaveText('running')
          } else {
            await expect(window.getByRole('alert')).toContainText(
              'require Windows'
            )
          }
          expect(window.url()).toMatch(
            mode === 'built' ? /^file:/ : /^http:\/\/127\.0\.0\.1:5173/
          )

          const isolation = await window.evaluate(() => ({
            require: typeof Reflect.get(window, 'require'),
            process: typeof Reflect.get(window, 'process'),
            buffer: typeof Reflect.get(window, 'Buffer')
          }))
          expect(isolation).toEqual({
            require: 'undefined',
            process: 'undefined',
            buffer: 'undefined'
          })
          expect(
            await window.evaluate(() =>
              Object.keys(
                Reflect.get(globalThis, 'desktop') as DesktopApi
              ).sort()
            )
          ).toEqual([
            'acknowledgeSession',
            'checkForUpdates',
            'chooseProject',
            'clearHistory',
            'closeSession',
            'createSession',
            'downloadUpdate',
            'explainCommand',
            'exportPreferences',
            'getAppInfo',
            'getPreferences',
            'getUpdateStatus',
            'importPreferences',
            'installUpdate',
            'listShells',
            'onSessionEvent',
            'onUpdateStatus',
            'openExternal',
            'readClipboard',
            'resetPreferences',
            'resizeSession',
            'savePreferences',
            'searchHistory',
            'writeClipboard',
            'writeSession'
          ])
          expect(
            await window.evaluate(() =>
              (Reflect.get(globalThis, 'desktop') as DesktopApi).getAppInfo()
            )
          ).toMatchObject({
            name: 'Terminal One',
            version: JSON.parse(await readFile('package.json', 'utf8')).version
          })
          expect(
            await window.evaluate(async () => {
              try {
                await (
                  Reflect.get(globalThis, 'desktop') as DesktopApi
                ).openExternal('javascript:alert(1)')
                return 'allowed'
              } catch {
                return 'rejected'
              }
            })
          ).toBe('rejected')
          expect(
            await window.evaluate(async () => {
              try {
                await Reflect.apply(
                  (Reflect.get(globalThis, 'desktop') as DesktopApi).getAppInfo,
                  undefined,
                  ['unexpected']
                )
                return 'allowed'
              } catch {
                return 'rejected'
              }
            })
          ).toBe('rejected')
          expect(
            await window.evaluate(async () => {
              const api = Reflect.get(globalThis, 'desktop') as DesktopApi
              const rejected: boolean[] = []
              for (const [method, args] of [
                [api.readClipboard, ['extra']],
                [api.writeClipboard, [{}]],
                [api.writeClipboard, ['x'.repeat(262145)]]
              ] as const) {
                try {
                  await Reflect.apply(method, undefined, args)
                  rejected.push(false)
                } catch {
                  rejected.push(true)
                }
              }
              return rejected
            })
          ).toEqual([true, true, true])
          const documentation = window.getByRole('button', {
            name: 'Project documentation'
          })
          await window.keyboard.press('Tab')
          await documentation.focus()
          await expect(documentation).toBeFocused()
          await expect(documentation).toHaveCSS('outline-width', '2px')
          await expect(documentation).toHaveCSS('outline-style', 'solid')
          await expect(documentation).toHaveCSS(
            'outline-color',
            'rgb(96, 205, 255)'
          )
          await expect(window.locator('.min-h-screen')).toHaveCSS(
            'background-color',
            'rgb(12, 12, 12)'
          )
          expect(
            await window.evaluate(() => {
              const element = Reflect.get(
                globalThis,
                'document'
              ).documentElement
              return element.scrollWidth <= element.clientWidth
            })
          ).toBe(true)
          const currentUrl = window.url()
          expect(
            await app.evaluate(
              ({ BrowserWindow }) =>
                new Promise<boolean>((resolve) => {
                  const contents = BrowserWindow.getAllWindows()[0]?.webContents
                  if (!contents) throw new Error('Missing window')
                  contents.once('will-frame-navigate', (event) =>
                    queueMicrotask(() => resolve(event.defaultPrevented))
                  )
                  void contents.executeJavaScript(
                    "location.assign('https://example.com')"
                  )
                })
            )
          ).toBe(true)
          expect(window.url()).toBe(currentUrl)
          expect(
            await window.evaluate(() =>
              Reflect.get(globalThis, 'open')('https://example.com')
            )
          ).toBeNull()
          expect(
            await app.evaluate(
              async ({ BrowserWindow }, preloadPath) => {
                const rogue = new BrowserWindow({
                  show: false,
                  webPreferences: {
                    preload: preloadPath,
                    sandbox: true,
                    contextIsolation: true,
                    nodeIntegration: false
                  }
                })
                try {
                  await rogue.loadURL(
                    'data:text/html,<title>Untrusted window</title>'
                  )
                  return await rogue.webContents.executeJavaScript(
                    "window.desktop.getAppInfo().then(() => 'allowed', () => 'rejected')"
                  )
                } finally {
                  rogue.destroy()
                }
              },
              join(process.cwd(), 'out/preload/index.js')
            )
          ).toBe('rejected')
          if (mode === 'built') {
            const csp = await window
              .locator('meta[http-equiv="Content-Security-Policy"]')
              .getAttribute('content')
            expect(csp).toContain("script-src 'self';")
            expect(csp).toContain("style-src 'self' 'unsafe-inline';")
            expect(csp).not.toContain('ws:')
          }
          await expect
            .poll(() =>
              app.evaluate(({ BrowserWindow }) => {
                const window = BrowserWindow.getAllWindows()[0]
                if (!window) throw new Error('Expected a desktop window')
                return {
                  visible: window.isVisible()
                }
              })
            )
            .toEqual({ visible: true })
          expect(errors).toEqual([])
          const screenshot = testInfo.outputPath(
            `${mode}-${scale * 100}-window.png`
          )
          await window.screenshot({ path: screenshot })
          await testInfo.attach(`${mode}-window`, {
            path: screenshot,
            contentType: 'image/png'
          })
        } finally {
          await app.close()
        }
      } finally {
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
}

test('packaged startup policy exits on debugging flags without an error dialog', async () => {
  const directory = await mkdtemp(join(tmpdir(), 'terminal-packaged-policy-'))
  const env = { ...process.env }
  delete env['ELECTRON_RUN_AS_NODE']
  try {
    const entry = join(directory, 'entry.cjs')
    const main = join(process.cwd(), 'out/main/index.js')
    await writeFile(
      entry,
      `const { app } = require('electron'); Object.defineProperty(app, 'isPackaged', { value: true }); require(${JSON.stringify(main)});`
    )
    const result = spawnSync(
      process.execPath,
      [
        join(process.cwd(), 'node_modules/electron/cli.js'),
        entry,
        '--no-sandbox',
        '--inspect=0',
        '--remote-debugging-port=0'
      ],
      { env, timeout: 10_000, encoding: 'utf8' }
    )
    expect(result.error).toBeUndefined()
    expect(result.status).toBe(1)
    expect(result.stderr).toContain(
      'Debugging flags are disabled in packaged builds'
    )
  } finally {
    await rm(directory, {
      recursive: true,
      force: true,
      maxRetries: 5,
      retryDelay: 200
    })
  }
})
