import { _electron as electron, expect } from '@playwright/test'
import { mkdtemp, mkdir, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join, resolve } from 'node:path'

// Controlled renderer preview. All command text and output below is synthetic;
// this does not execute PowerShell or claim native Windows verification.
const profile = await mkdtemp(join(tmpdir(), 'terminal-ui-preview-'))
const output = resolve('artifacts/ui')
await mkdir(output, { recursive: true })
const env = { ...process.env, UI_FIXTURE_PREVIEW: '1' }
delete env.ELECTRON_RUN_AS_NODE
delete env.ELECTRON_RENDERER_URL
const app = await electron.launch({
  args: ['tests/fixtures/ui-window.cjs', `--user-data-dir=${profile}`],
  env
})
const color = (code, text) => `\x1b[${code}m${text}\x1b[0m`
const prompt = (command) =>
  `${color('38;2;137;184;194', 'PS')} ${color('38;2;198;200;209', 'C:\\Projects\\terminal-one')} ${color('38;2;180;165;220', 'on main')}\r\n${color('38;2;180;190;130', '>')} ${command}`
const screen = [
  color('38;2;137;184;194', 'PowerShell 7.5.4'),
  color('38;2;164;171;192', 'Copyright (c) Microsoft Corporation.'),
  '',
  prompt('git status'),
  'On branch main',
  "Your branch is up to date with 'origin/main'.",
  '',
  color('38;2;180;190;130', 'nothing to commit, working tree clean'),
  '',
  prompt('npm run build'),
  '',
  '> terminal-one@0.1.0 build',
  '> electron-vite build',
  '',
  `${color('38;2;145;191;255', 'vite')} building for production...`,
  `${color('38;2;180;190;130', '  check')}  42 modules transformed.`,
  `${color('38;2;180;190;130', '  check')}  main and preload bundles ready.`,
  '',
  `${color('38;2;164;171;192', '  out/renderer/index.html')}         0.62 kB`,
  `${color('38;2;164;171;192', '  out/renderer/assets/index.css')}  18.24 kB`,
  `${color('38;2;164;171;192', '  out/renderer/assets/index.js')}  248.16 kB`,
  '',
  color('38;2;180;190;130', 'Build completed successfully.'),
  '',
  prompt('')
].join('\r\n')
const secondary = [
  prompt('npm run dev'),
  '',
  '> terminal-one@0.1.0 dev',
  '> electron-vite dev',
  '',
  `${color('38;2;145;191;255', '  VITE')}  ready in 184 ms`,
  '',
  `  ${color('38;2;180;190;130', 'Local:')}   http://127.0.0.1:5173/`,
  `  ${color('38;2;164;171;192', 'Press h + enter to show help')}`,
  '',
  '',
  `${color('38;2;164;171;192', '15:42:08')}  renderer ready`,
  `${color('38;2;164;171;192', '15:42:08')}  watching for file changes...`
].join('\r\n')
async function write(id, text) {
  await page.evaluate(
    ({ id, text }) => Reflect.get(globalThis, 'desktop').writeSession(id, text),
    { id, text: `\x1b[2J\x1b[H${text.replaceAll('\r\n', '\r')}` }
  )
}
const page = await app.firstWindow()
try {
  await app.evaluate(({ BrowserWindow }) =>
    BrowserWindow.getAllWindows()[0].setSize(1280, 800)
  )
  await expect(page.getByRole('status')).toHaveText('running')
  await write('fixture-1', screen)
  await expect(page.locator('.xterm-accessibility-tree')).toContainText(
    'Build completed successfully.'
  )
  await page.screenshot({ path: join(output, 'terminal-workspace.png') })
  await page
    .getByRole('combobox', { name: 'Shell', exact: true })
    .selectOption('cmd')
  await page.getByRole('button', { name: 'New session', exact: true }).click()
  await page.getByRole('tab', { name: 'PowerShell', exact: true }).click()
  await page
    .getByRole('combobox', { name: 'Shell', exact: true })
    .selectOption('powershell')
  await page.getByRole('button', { name: 'Split right', exact: true }).click()
  await expect(page.locator('.tab-viewport:not([hidden]) .xterm')).toHaveCount(
    2
  )
  await write('fixture-1', screen)
  await write('fixture-3', secondary)
  await expect(
    page.locator('.tab-viewport:not([hidden]) .xterm-accessibility-tree').last()
  ).toContainText('watching for file changes')
  await page.screenshot({ path: join(output, 'terminal-split.png') })
  await page.getByRole('button', { name: 'Commands', exact: true }).click()
  await expect(
    page.getByRole('dialog', { name: 'Application commands' })
  ).toBeVisible()
  await page.screenshot({ path: join(output, 'terminal-commands.png') })
  console.log(`Synthetic UI previews captured in ${output}`)
} finally {
  await app.close()
  await rm(profile, {
    recursive: true,
    force: true,
    maxRetries: 5,
    retryDelay: 200
  })
}
