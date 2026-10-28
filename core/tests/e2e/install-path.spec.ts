import { _electron as electron, expect, test } from '@playwright/test'
import { cp, mkdtemp, mkdir, rm, symlink, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join, resolve } from 'node:path'
import type { DesktopApi } from '../../src/contracts/desktop-api'
import { pathToFileURL } from 'node:url'
import { realpath } from 'node:fs/promises'

test('production bundle authorizes its document from a space and Unicode install path', async () => {
  // Windows tmpdir commonly uses RUNNER~1. Keep that spelling when launching
  // the copied bundle so Chromium's DOS-path expansion is exercised in CI.
  const root = await mkdtemp(join(tmpdir(), 'terminal-path-'))
  const application = join(root, 'App with spaces 世界 #%')
  await mkdir(application)
  await cp('out', join(application, 'out'), { recursive: true })
  await cp('shell', join(application, 'shell'), { recursive: true })
  if (process.platform === 'win32')
    await cp('native', join(application, 'native'), { recursive: true })
  await symlink(
    resolve('node_modules'),
    join(application, 'node_modules'),
    'junction'
  )
  await writeFile(
    join(application, 'package.json'),
    JSON.stringify({
      name: 'terminal-one',
      version: '0.1.0',
      main: './out/main/index.js'
    })
  )
  const env = Object.fromEntries(
    Object.entries(process.env).filter(
      (entry): entry is [string, string] => entry[1] !== undefined
    )
  )
  delete env['ELECTRON_RENDERER_URL']
  delete env['ELECTRON_RUN_AS_NODE']
  const app = await electron.launch({
    args: [application, `--user-data-dir=${join(root, 'profile')}`],
    env
  })
  try {
    const page = await app.firstWindow()
    await expect(page).toHaveURL(
      pathToFileURL(
        await realpath(join(application, 'out/renderer/index.html'))
      ).href
    )
    expect(
      await page.evaluate(() =>
        (Reflect.get(globalThis, 'desktop') as DesktopApi).getAppInfo()
      )
    ).toMatchObject({ name: 'Terminal One', version: '0.1.0' })
    if (process.platform === 'win32')
      await expect(page.getByRole('status')).toHaveText('running', {
        timeout: 20000
      })
    else await expect(page.getByRole('alert')).toContainText('require Windows')
  } finally {
    await app.close()
    await rm(root, {
      recursive: true,
      force: true,
      maxRetries: 10,
      retryDelay: 200
    })
  }
})
