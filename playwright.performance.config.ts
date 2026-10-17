import { defineConfig } from '@playwright/test'
if (process.platform !== 'win32')
  throw new Error('Performance profiling requires Windows ConPTY')
export default defineConfig({
  testDir: './tests',
  testMatch: '**/*.profile.ts',
  workers: 1,
  fullyParallel: false,
  timeout: 180000,
  retries: 0,
  reporter: 'list',
  outputDir: 'test-results/performance',
  use: { trace: 'retain-on-failure' }
})
