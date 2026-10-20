import {
  clickTerminalOption,
  openTerminalOptions
} from './fixtures/terminal-options'
import { _electron as electron, expect, test } from '@playwright/test'
import type { ElectronApplication, Page } from '@playwright/test'
import { mkdtemp, rm, mkdir, writeFile } from 'node:fs/promises'
import { tmpdir, cpus, totalmem, release } from 'node:os'
import { join } from 'node:path'
import { performance } from 'node:perf_hooks'
import { createRequire } from 'node:module'
import type { DesktopApi } from '../src/contracts/desktop-api'

const require = createRequire(join(process.cwd(), 'package.json'))
const watchProcesses = require('./tests/fixtures/process-watch.cjs') as (
  pids: number[]
) => Promise<{ done: Promise<void>; cancel(): void }>
test('profile startup throughput and repeated native session cleanup', async () => {
  const profile = await mkdtemp(join(tmpdir(), 'terminal-profile-'))
  const env = Object.fromEntries(
    Object.entries(process.env).filter(
      (entry): entry is [string, string] => entry[1] !== undefined
    )
  )
  delete env['ELECTRON_RUN_AS_NODE']
  delete env['ELECTRON_RENDERER_URL']
  let app: ElectronApplication | null = null
  let page: Page
  const startupMs: number[] = []
  const cleanupMs: number[] = []
  const cycleWorkingSetKiB: number[] = []
  try {
    for (let run = 0; run < 3; run++) {
      const start = performance.now()
      app = await electron.launch({
        args: ['.', `--user-data-dir=${profile}`],
        env
      })
      page = await app.firstWindow()
      await expect(page.getByRole('status')).toHaveText('running', {
        timeout: 20000
      })
      startupMs.push(performance.now() - start)
      if (run < 2) {
        await app.close()
        app = null
      }
    }
    page = await app!.firstWindow()
    await page.getByRole('button', { name: 'Terminal options' }).click()
    await openTerminalOptions(page)
    await page
      .getByRole('combobox', { name: 'Shell' })
      .selectOption('powershell')
    await page.keyboard.press('Control+Shift+W')
    await page.getByRole('button', { name: 'New session', exact: true }).click()
    await expect(page.getByRole('status')).toHaveText('running')
    const versions = await app!.evaluate(() => ({ ...process.versions }))
    const memory = () =>
      app!.evaluate(({ app }) => {
        const metrics = app.getAppMetrics()
        return {
          workingSetKiB: metrics.reduce(
            (sum, item) => sum + item.memory.workingSetSize,
            0
          ),
          processCount: metrics.length,
          cpuPercentSum: metrics.reduce(
            (sum, item) => sum + item.cpu.percentCPUUsage,
            0
          ),
          processes: metrics.map((item) => ({
            pid: item.pid,
            type: item.type,
            serviceName: item.serviceName,
            name: item.name,
            workingSetKiB: item.memory.workingSetSize,
            cpuPercent: item.cpu.percentCPUUsage
          }))
        }
      })
    const before = await memory()
    const ownedHostPids = (sample: Awaited<ReturnType<typeof memory>>) =>
      sample.processes
        .filter((item) => item.name === 'Terminal PTY host')
        .map((item) => item.pid)
        .sort((a, b) => a - b)
    const baselineHosts = ownedHostPids(before)
    expect(baselineHosts).toHaveLength(1)
    // This interval is the measured idle workload, not an assertion delay.
    await page.waitForTimeout(10000)
    const idle = await memory()
    const resizeMs: number[] = []
    for (const [width, height] of [
      [900, 650],
      [1200, 800],
      [1000, 700]
    ] as const) {
      const started = performance.now()
      await app!.evaluate(
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
      resizeMs.push(performance.now() - started)
    }
    await page.evaluate(() => {
      const observation = {
        characters: 0,
        tail: '',
        complete: false,
        failure: ''
      }
      Reflect.set(globalThis, '__terminalProfileOutput', observation)
      const stop = (
        Reflect.get(globalThis, 'desktop') as DesktopApi
      ).onSessionEvent((event) => {
        if (event.type === 'data') {
          observation.characters += event.data.length
          observation.tail = (observation.tail + event.data).slice(-512)
          observation.complete ||= observation.tail.includes('PERF_DONE')
        } else if (event.type === 'error') observation.failure = event.message
      })
      // Observe only: the production renderer remains responsible for ACKs.
      Reflect.set(globalThis, '__terminalProfileStop', stop)
    })
    const outputStart = performance.now()
    await page.locator('.xterm-helper-textarea').focus()
    await page.keyboard.type(
      "[Console]::Write((('P'*1024)+[Environment]::NewLine)*1024); Write-Output ('PERF_' + 'DONE')"
    )
    await page.keyboard.press('Enter')
    let lastCharacters = -1
    let lastProgress = Date.now()
    await expect
      .poll(
        async () => {
          const state = await page.evaluate(() => {
            const state = Reflect.get(
              globalThis,
              '__terminalProfileOutput'
            ) as { characters: number; complete: boolean; failure: string }
            return {
              characters: state.characters,
              complete: state.complete,
              failure: state.failure
            }
          })
          expect(state.failure, 'production terminal stream failure').toBe('')
          if (state.characters > lastCharacters) {
            lastCharacters = state.characters
            lastProgress = Date.now()
          }
          if (Date.now() - lastProgress > 15000)
            throw new Error(
              `Terminal output stopped progressing after ${lastCharacters} characters`
            )
          return state.complete
        },
        {
          timeout: 120000,
          message:
            'synthetic output completes while retaining normal renderer backpressure'
        }
      )
      .toBe(true)
    await expect(page.locator('.xterm-accessibility-tree')).toContainText(
      'PERF_DONE',
      { timeout: 10000 }
    )
    const outputMs = performance.now() - outputStart
    await page.evaluate(() =>
      (Reflect.get(globalThis, '__terminalProfileStop') as () => void)()
    )
    await clickTerminalOption(page, 'Split right')
    await clickTerminalOption(page, 'Split down')
    await expect(page.locator('.xterm')).toHaveCount(3)
    await expect
      .poll(() => page.getByRole('status').allTextContents(), {
        timeout: 20000
      })
      .toEqual(['running', 'running', 'running'])
    const multiPane = await memory()
    await page
      .getByRole('button', { name: 'Close pane', exact: true })
      .last()
      .click()
    await page
      .getByRole('button', { name: 'Close pane', exact: true })
      .last()
      .click()
    await expect(page.locator('.xterm')).toHaveCount(1)
    await page.evaluate(() => {
      const api = Reflect.get(globalThis, 'desktop') as DesktopApi
      api.onSessionEvent((event) => {
        if (event.type === 'data')
          void api.acknowledgeSession(event.id, event.sequence)
      })
    })
    for (let cycle = 0; cycle < 20; cycle++) {
      const session = await page.evaluate(() =>
        (Reflect.get(globalThis, 'desktop') as DesktopApi).createSession({
          shellId: 'powershell',
          cols: 100,
          rows: 30
        })
      )
      expect(session.pid).not.toBeNull()
      const watcher = await watchProcesses([session.pid!])
      try {
        const start = performance.now()
        await page.evaluate(
          (id) =>
            (Reflect.get(globalThis, 'desktop') as DesktopApi).closeSession(id),
          session.id
        )
        await watcher.done
        await expect
          .poll(async () => ownedHostPids(await memory()), {
            timeout: 10000,
            message:
              'closed session utility exits without replacing the live pane host'
          })
          .toEqual(baselineHosts)
        cleanupMs.push(performance.now() - start)
        cycleWorkingSetKiB.push((await memory()).workingSetKiB)
      } finally {
        watcher.cancel()
      }
    }
    const after = await memory()
    // Observe normal reclamation without forcing GC or changing production flags.
    await page.waitForTimeout(10000)
    const settled = await memory()
    await mkdir('test-results/performance', { recursive: true })
    await writeFile(
      'test-results/performance/baseline.json',
      JSON.stringify(
        {
          platform: 'win32',
          os: release(),
          arch: process.arch,
          cpu: cpus()[0]?.model,
          logicalCpus: cpus().length,
          systemMemoryBytes: totalmem(),
          versions,
          instrumented: true,
          workload:
            'production bundle in Playwright Electron, one fresh profile then two same-profile launches; 1024 lines of 1024 ASCII characters in one bulk Console.Write; 20 native session create/close cycles',
          startupMs,
          outputMs,
          outputBytes: 1024 * 1024,
          observedStreamCharacters: lastCharacters,
          outputMiBPerSecond: 1000 / outputMs,
          cleanupMs,
          resizeMs,
          memory: {
            scope:
              'Electron processes reported by app.getAppMetrics; external shell/helper/conhost memory is excluded',
            before,
            idle,
            multiPane,
            after,
            settled,
            cycleWorkingSetKiB,
            deltaWorkingSetKiB: after.workingSetKiB - before.workingSetKiB
          },
          cleanupPassed: cleanupMs.length === 20
        },
        null,
        2
      )
    )
  } catch (error) {
    // Synthetic workload diagnostics only: retain counts/state, never output.
    const diagnosticPage = app?.windows()[0]
    const output = await diagnosticPage
      ?.evaluate(() => {
        const state = Reflect.get(globalThis, '__terminalProfileOutput') as
          { characters: number; complete: boolean; failure: string } | undefined
        return state
          ? {
              characters: state.characters,
              complete: state.complete,
              failure: state.failure
            }
          : null
      })
      .catch(() => null)
    await mkdir('test-results/performance', { recursive: true })
    await writeFile(
      'test-results/performance/failure.json',
      JSON.stringify({ startupMs, cleanupMs, output: output ?? null }, null, 2)
    )
    throw error
  } finally {
    await app?.close()
    await rm(profile, {
      recursive: true,
      force: true,
      maxRetries: 5,
      retryDelay: 200
    })
  }
})
