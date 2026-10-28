import type { Page } from '@playwright/test'

export async function openTerminalOptions(page: Page) {
  const trigger = page.getByRole('button', {
    name: 'Terminal options',
    exact: true
  })
  if ((await trigger.getAttribute('aria-expanded')) === 'false')
    await trigger.click()
}

export async function clickTerminalOption(page: Page, name: string) {
  await openTerminalOptions(page)
  await page.getByRole('button', { name, exact: true }).click()
}
