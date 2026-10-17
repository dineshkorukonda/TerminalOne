import { _electron as electron, expect, test } from '@playwright/test'
import { mkdtemp, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import type { ViteDevServer } from 'vite'

for (const mode of ['built', 'development'] as const) {
  test(`launches the ${mode} React window with an isolated renderer`, async ({}, testInfo) => {
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
        args: ['.', `--user-data-dir=${profile}`],
        env
      })
      try {
        const window = await app.firstWindow()
        const errors: string[] = []
        window.on('pageerror', (error) => errors.push(error.message))
        await expect(window).toHaveTitle('Terminal One')
        await expect(
          window.getByRole('heading', { name: 'Terminal One' })
        ).toBeVisible()
        await expect(
          window.getByText('The application window is ready.')
        ).toBeVisible()
        await expect(
          window.getByText('Shell sessions arrive in the next phase.')
        ).toBeVisible()
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
        const screenshot = testInfo.outputPath(`${mode}-window.png`)
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
