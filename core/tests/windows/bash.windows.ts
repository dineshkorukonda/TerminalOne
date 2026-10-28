import { _electron as electron, expect, test } from '@playwright/test'
import { mkdtemp, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'

test('default Bash loads bundled highlighting and completion and adapts commands', async () => {
  const profile = await mkdtemp(join(tmpdir(), 'terminal-bash-'))
  const env = Object.fromEntries(
    Object.entries(process.env).filter(
      (entry): entry is [string, string] => entry[1] !== undefined
    )
  )
  delete env['ELECTRON_RUN_AS_NODE']
  delete env['ELECTRON_RENDERER_URL']
  // Exercise a fresh editor cache without loading the developer's shell config.
  env['HOME'] = profile
  const app = await electron.launch({
    args: ['.', `--user-data-dir=${profile}`],
    env
  })
  try {
    const page = await app.firstWindow()
    await expect(page.getByRole('tab', { name: 'Git Bash' })).toBeVisible()
    const input = page.locator('.xterm-helper-textarea')
    const rows = page.locator('.xterm-accessibility-tree')
    const send = async (command: string) => {
      await expect
        .poll(
          async () => {
            const lines = await rows.locator(':scope > div').allTextContents()
            return /@.*:.*[$#]$/.test(
              lines
                .map((line) => line.trim())
                .filter(Boolean)
                .at(-1) ?? ''
            )
          },
          { timeout: 15000, message: 'Bash is ready for the next command' }
        )
        .toBe(true)
      await input.focus()
      await input.evaluate((element, text) => {
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
      }, command)
      await page.keyboard.press('Enter')
    }
    await expect(rows).toContainText('$', { timeout: 20000 })
    await input.focus()
    await send(
      "[[ $BLE_VERSION && $bleopt_complete_auto_complete ]] && printf '%s%s\\n' EDITOR_ READY"
    )
    await expect(rows).toContainText('EDITOR_READY', { timeout: 20000 })
    await send("Write-Output 'ADAPTER_'OK")
    await expect(rows).toContainText('ADAPTER_OK', { timeout: 15000 })
    await send("printf '%s%s\\n' BUSY_ READY; sleep 90")
    await expect(rows).toContainText('BUSY_READY')
    await page.keyboard.press('Control+c')
    await send("printf '%s%s\\n' INTERRUPT_ OK")
    await expect(rows).toContainText('INTERRUPT_OK')
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
