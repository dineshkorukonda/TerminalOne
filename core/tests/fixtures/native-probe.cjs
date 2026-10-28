/* eslint-disable @typescript-eslint/no-require-imports -- The packaged Electron diagnostic uses a synchronous CommonJS bootstrap. */
const { app } = require('electron')
const path = require('node:path')
const fs = require('node:fs')
const os = require('node:os')
const assert = require('node:assert/strict')
const { stripVTControlCharacters } = require('node:util')
const { EventEmitter } = require('node:events')
const watchProcesses = require('./process-watch.cjs')
const root = app.isPackaged
  ? app.getAppPath()
  : path.resolve(__dirname, '../..')
const timer = setTimeout(() => {
  console.error('Native PTY integration timed out')
  app.exit(1)
}, 150000)
app
  .whenReady()
  .then(async () => {
    if (process.platform !== 'win32')
      throw new Error('Native ConPTY integration requires Windows')
    const { UtilityPtyPort } = require(
      path.join(root, 'out/main/pty-client.js')
    )
    const port = new UtilityPtyPort()
    const directory = fs.mkdtempSync(
      path.join(os.tmpdir(), 'Terminal One 空间-')
    )
    const shell = {
      id: 'powershell',
      name: 'Windows PowerShell',
      executable: path.join(
        process.env.SystemRoot,
        'System32/WindowsPowerShell/v1.0/powershell.exe'
      ),
      args: ['-NoLogo', '-NoProfile', '-NoExit']
    }
    const checks = []
    let sequence = 0
    async function session() {
      const events = new EventEmitter()
      let output = '',
        handle
      const early = []
      const detach = port.onFailure(() =>
        events.emit('failure', new Error('PTY host failed'))
      )
      handle = await port.start(
        `probe-${++sequence}`,
        shell,
        directory,
        { cols: 100, rows: 30 },
        (event) => {
          if (event.type === 'data') {
            output = (output + event.data).slice(-262144)
            if (handle) void handle.acknowledge(event.sequence).catch(() => {})
            else early.push(event.sequence)
            events.emit('data')
          }
          if (event.type === 'exit') events.emit('exit', event.exitCode)
          if (event.type === 'error')
            events.emit('failure', new Error(event.message))
        }
      )
      await Promise.all(early.map((value) => handle.acknowledge(value)))
      return {
        handle,
        wait(pattern, since = 0) {
          return new Promise((resolve, reject) => {
            const check = () => {
              const match = stripVTControlCharacters(output.slice(since)).match(
                pattern
              )
              if (match) {
                cleanup()
                resolve(match)
              }
            }
            const fail = (error) => {
              cleanup()
              reject(error)
            }
            const timeout = setTimeout(
              () =>
                fail(
                  new Error(
                    `Native output condition did not arrive: ${pattern}`
                  )
                ),
              20000
            )
            const cleanup = () => {
              clearTimeout(timeout)
              events.off('data', check)
              events.off('failure', fail)
            }
            events.on('data', check)
            events.on('failure', fail)
            check()
          })
        },
        exited() {
          return new Promise((resolve, reject) => {
            const timeout = setTimeout(() => {
              cleanup()
              reject(new Error('Shell exit timed out'))
            }, 20000)
            const cleanup = () => {
              clearTimeout(timeout)
              events.off('exit', done)
              events.off('failure', fail)
            }
            const done = (code) => {
              cleanup()
              resolve(code)
            }
            const fail = (error) => {
              cleanup()
              reject(error)
            }
            events.once('exit', done)
            events.once('failure', fail)
          })
        },
        output: () => output,
        position: () => output.length,
        dispose: detach
      }
    }
    try {
      for (let cycle = 0; cycle < 3; cycle++) {
        const current = await session()
        await current.handle.write("Write-Output ('START_' + 'OK')\r")
        await current.wait(/START_OK/)
        await current.handle.write(
          "Write-Output ([char]27 + '[31m' + 'COLOR_' + 'OK' + [char]27 + '[0m'); Write-Output ('UNICODE_' + '世界 café')\r"
        )
        await current.wait(/COLOR_OK/)
        await current.wait(/UNICODE_世界 café/)
        assert(
          current.output().includes('\x1b[31m'),
          'ANSI color escape was not preserved'
        )
        await current.handle.write(
          "Set-Content -LiteralPath '.\\данные file.txt' -Value ('PATH_' + 'OK'); Get-Content -LiteralPath '.\\данные file.txt'\r"
        )
        await current.wait(/PATH_OK/)
        await current.handle.resize({ cols: 112, rows: 37 })
        await current.handle.write(
          "Write-Output ('GRID_' + [Console]::WindowWidth + '_' + [Console]::WindowHeight)\r"
        )
        await current.wait(/GRID_112_37/)
        await current.handle.write(
          "Write-Output ('BUSY_' + 'READY'); Start-Sleep -Seconds 90\r"
        )
        await current.wait(/BUSY_READY/)
        const beforeInterrupt = current.position()
        await current.handle.write('\x03')
        await current.wait(/PS [^\r\n]*>/, beforeInterrupt)
        await current.handle.write("Write-Output ('CTRL_' + 'OK')\r")
        await current.wait(/CTRL_OK/)
        const exited = current.exited()
        await current.handle.write('exit 7\r')
        assert.equal(await exited, 7)
        await current.handle.close()
        await current.handle.close()
        current.dispose()
        checks.push(`cycle-${cycle + 1}:ansi-unicode-path-resize-ctrlc-exit`)
      }
      for (const mode of ['close', 'natural-exit', 'utility-crash']) {
        const current = await session()
        await current.handle.write(
          "$child=Start-Process -NoNewWindow -FilePath (Join-Path $PSHOME 'powershell.exe') -ArgumentList @('-NoProfile','-Command','Start-Sleep -Seconds 120') -PassThru; Write-Output ('CHILD_' + $child.Id)\r"
        )
        const match = await current.wait(/CHILD_(\d+)/)
        const watcher = await watchProcesses([
          current.handle.pid,
          Number(match[1])
        ])
        try {
          if (mode === 'close') await current.handle.close()
          else if (mode === 'natural-exit') {
            const exited = current.exited()
            await current.handle.write('exit 0\r')
            assert.equal(await exited, 0)
            await current.handle.close()
          } else {
            const failed = new Promise((resolve) => {
              const detach = port.onFailure(() => {
                detach()
                resolve()
              })
            })
            port.child.kill()
            await failed
          }
          await watcher.done
        } finally {
          watcher.cancel()
          current.dispose()
        }
        checks.push(`tree-cleanup:${mode}`)
      }
      // A fresh utility can launch after a crash; shutdown owns the final tree.
      const recovered = await session()
      await recovered.handle.write("Write-Output ('RECOVER_' + 'OK')\r")
      await recovered.wait(/RECOVER_OK/)
      const watcher = await watchProcesses([recovered.handle.pid])
      await port.dispose()
      await watcher.done
      watcher.cancel()
      recovered.dispose()
      checks.push('recovery-and-shutdown')
      const evidence = {
        passed: true,
        electron: process.versions.electron,
        modules: process.versions.modules,
        node: process.versions.node,
        os: os.release(),
        packaged: app.isPackaged,
        checks
      }
      if (process.env.PTY_PROBE_RESULT) {
        fs.mkdirSync(path.dirname(process.env.PTY_PROBE_RESULT), {
          recursive: true
        })
        fs.writeFileSync(
          process.env.PTY_PROBE_RESULT,
          JSON.stringify(evidence, null, 2)
        )
      }
      console.log(JSON.stringify(evidence))
      clearTimeout(timer)
      await fs.promises.rm(directory, {
        recursive: true,
        force: true,
        maxRetries: 10,
        retryDelay: 100
      })
      app.exit(0)
    } catch (error) {
      console.error(error.message)
      await port.dispose().catch(() => {})
      await fs.promises.rm(directory, {
        recursive: true,
        force: true,
        maxRetries: 10,
        retryDelay: 100
      })
      app.exit(1)
    }
  })
  .catch((error) => {
    console.error(error.message)
    app.exit(1)
  })
