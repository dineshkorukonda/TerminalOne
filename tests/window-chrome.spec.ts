import { _electron as electron, expect, test } from '@playwright/test'
import { mkdtemp, rm } from 'node:fs/promises'
import { join } from 'node:path'
import { tmpdir } from 'node:os'

test('native content resizing preserves the terminal chrome viewport', async () => {
  const profile = await mkdtemp(join(tmpdir(), 'terminal-window-chrome-'))
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
  try {
    const page = await app.firstWindow()
    await expect(
      page.getByRole('heading', { name: 'Terminal One' })
    ).toBeVisible()
    for (const [width, height] of [
      [900, 650],
      [1200, 800],
      [640, 420]
    ] as const) {
      await app.evaluate(
        ({ BrowserWindow }, size) => {
          BrowserWindow.getAllWindows()[0]!.setContentSize(
            size.width,
            size.height
          )
        },
        { width, height }
      )
      await expect
        .poll(() =>
          page.evaluate(() => ({
            width: Number(Reflect.get(globalThis, 'innerWidth')),
            height: Number(Reflect.get(globalThis, 'innerHeight'))
          }))
        )
        .toEqual({ width, height })
      await expect(page.locator('.app-shell')).toHaveCSS('width', `${width}px`)
      await expect(page.locator('.app-shell')).toHaveCSS(
        'height',
        `${height}px`
      )
      await expect(
        page.getByRole('button', { name: 'New session', exact: true })
      ).toBeVisible()
    }
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
