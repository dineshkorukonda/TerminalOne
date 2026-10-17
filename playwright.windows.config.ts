import { defineConfig } from '@playwright/test'
if (process.platform !== 'win32')
  throw new Error('Windows terminal integration requires real ConPTY')
export default defineConfig({
  testDir: './tests',
  testMatch: '**/*.windows.ts',
  workers: 1,
  fullyParallel: false,
  timeout: 45000,
  retries: 0,
  outputDir: 'test-results/windows',
  reporter: 'list',
  use: { trace: 'retain-on-failure' }
})
