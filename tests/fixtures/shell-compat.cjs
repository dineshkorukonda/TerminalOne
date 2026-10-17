/* eslint-disable @typescript-eslint/no-require-imports -- Electron native compatibility entry uses CommonJS. */
const { app } = require('electron')
const path = require('node:path'),
  fs = require('node:fs/promises'),
  os = require('node:os')
const assert = require('node:assert/strict')
const { stripVTControlCharacters } = require('node:util')
const watchProcesses = require('./process-watch.cjs')
const { UtilityPtyPort } = require('../../out/main/pty-client.js')
const { discoverShells } = require('../../out/main/shell-catalog.js')
const timer = setTimeout(() => app.exit(1), 180000)
delete process.env.TERMINAL_ONE_MATRIX
process.env.PS1 = 'MATRIX_PROMPT> '
app
  .whenReady()
  .then(async () => {
    if (process.platform !== 'win32')
      throw new Error('Shell matrix requires Windows ConPTY')
    const directory = await fs.mkdtemp(
      path.join(os.tmpdir(), 'Adapter matrix 空间-')
    )
    const port = new UtilityPtyPort(),
      shells = await discoverShells(),
      results = []
    let sequence = 0
    const emitCommand = (family, left, right) =>
      family === 'cmd'
        ? `set "_LEFT=${left}"\rset "_RIGHT=${right}"\recho %_LEFT%%_RIGHT%\r`
        : family === 'bash'
          ? `printf '%s%s\\n' '${left}' '${right}'\r`
          : `Write-Output ('${left}' + '${right}')\r`
    async function open(shell) {
      let handle,
        output = '',
        code = null
      const early = [],
        waiters = new Set()
      const check = () => {
        for (const waiter of waiters) waiter()
      }
      const detach = port.onFailure(() => {
        code = -1
        check()
      })
      handle = await port.start(
        `matrix-${++sequence}`,
        shell,
        directory,
        { cols: 160, rows: 40 },
        (event) => {
          if (event.type === 'data') {
            output = (output + event.data).slice(-262144)
            if (handle) void handle.acknowledge(event.sequence).catch(() => {})
            else early.push(event.sequence)
          }
          if (event.type === 'exit') code = event.exitCode
          if (event.type === 'error') code = -1
          check()
        }
      )
      await Promise.all(early.map((value) => handle.acknowledge(value)))
      const wait = (predicate) =>
        new Promise((resolve, reject) => {
          const timeout = setTimeout(
            () => finish(new Error('Shell compatibility condition timed out')),
            20000
          )
          const finish = (error) => {
            clearTimeout(timeout)
            waiters.delete(checkCondition)
            if (error) reject(error)
            else resolve()
          }
          const checkCondition = () => {
            if (predicate()) finish()
            else if (code !== null)
              finish(new Error('Shell stopped before compatibility condition'))
          }
          waiters.add(checkCondition)
          checkCondition()
        })
      return {
        handle,
        position: () => output.length,
        text: () => stripVTControlCharacters(output),
        wait: (pattern, since = 0) =>
          wait(() =>
            pattern.test(stripVTControlCharacters(output.slice(since)))
          ),
        exited: () => wait(() => code !== null),
        code: () => code,
        detach
      }
    }
    try {
      assert(shells.some((shell) => shell.id === 'powershell'))
      assert(shells.some((shell) => shell.id === 'cmd'))
      for (const shell of shells) {
        const family =
          shell.id === 'cmd'
            ? 'cmd'
            : shell.id === 'git-bash'
              ? 'bash'
              : 'powershell'
        for (let cycle = 0; cycle < 2; cycle++) {
          const session = await open(shell)
          try {
            await session.handle.write(
              emitCommand(family, 'QUOTE_', 'space 世界')
            )
            await session.wait(/QUOTE_space 世界/)
            const cwd =
              family === 'cmd'
                ? 'for %I in (.) do @echo CWD_%~nxI\r'
                : family === 'bash'
                  ? 'printf \'CWD_%s\\n\' "${PWD##*/}"\r'
                  : "Write-Output ('CWD_' + (Split-Path -Leaf (Get-Location).Path))\r"
            await session.handle.write(cwd)
            await session.wait(/CWD_Adapter matrix 空间-/)
            const isolation =
              family === 'cmd'
                ? `set "_LEFT=ISOLATED_"\rset "_RIGHT=OK"\rif not defined TERMINAL_ONE_MATRIX echo %_LEFT%%_RIGHT%\r`
                : family === 'bash'
                  ? "if [ -z \"${TERMINAL_ONE_MATRIX+x}\" ]; then printf '%s%s\\n' 'ISOLATED_' 'OK'; fi\r"
                  : "if (!$env:TERMINAL_ONE_MATRIX) { Write-Output ('ISOLATED_' + 'OK') }\r"
            await session.handle.write(isolation)
            await session.wait(/ISOLATED_OK/)
            const environment =
              family === 'cmd'
                ? 'set TERMINAL_ONE_MATRIX=owned\rset "_LEFT=ENV_"\recho %_LEFT%%TERMINAL_ONE_MATRIX%\r'
                : family === 'bash'
                  ? 'export TERMINAL_ONE_MATRIX=owned; printf \'ENV_%s\\n\' "$TERMINAL_ONE_MATRIX"\r'
                  : "$env:TERMINAL_ONE_MATRIX='owned'; Write-Output ('ENV_' + $env:TERMINAL_ONE_MATRIX)\r"
            await session.handle.write(environment)
            await session.wait(/ENV_owned/)
            const pipeline =
              family === 'cmd'
                ? 'set "_LEFT=PIPE_"\rset "_RIGHT=OK"\recho %_LEFT%%_RIGHT% | findstr OK\r'
                : family === 'bash'
                  ? "printf '%s%s\\n' 'PIPE_' 'OK' | cat\r"
                  : "'OK' | ForEach-Object { Write-Output ('PIPE_' + $_) }\r"
            await session.handle.write(pipeline)
            await session.wait(/PIPE_OK/)
            await session.handle.resize({ cols: 120, rows: 35 })
            await session.handle.write(
              emitCommand(family, 'INTERACTIVE_', 'READY')
            )
            await session.wait(/INTERACTIVE_READY/)
            const before = session.position()
            // Synchronize command start via output before blocking, not wall-clock sleeps.
            const busyWithMarker =
              family === 'cmd'
                ? 'set "_LEFT=BUSY_"\rset "_RIGHT=READY"\recho %_LEFT%%_RIGHT% & ping -n 90 127.0.0.1 >nul\r'
                : family === 'bash'
                  ? "printf '%s%s\\n' 'BUSY_' 'READY'; sleep 90\r"
                  : "Write-Output ('BUSY_' + 'READY'); Start-Sleep -Seconds 90\r"
            await session.handle.write(busyWithMarker)
            await session.wait(/BUSY_READY/, before)
            const interrupted = session.position()
            await session.handle.write('\x03')
            await session.wait(
              family === 'cmd'
                ? /Adapter matrix 空间-[^\r\n]*>/
                : family === 'bash'
                  ? /MATRIX_PROMPT>/
                  : /PS [^\r\n]*>/,
              interrupted
            )
            await session.handle.write(emitCommand(family, 'CTRL_', 'OK'))
            await session.wait(/CTRL_OK/)
            const watcher = await watchProcesses([session.handle.pid])
            try {
              const exited = session.exited()
              await session.handle.write(
                family === 'cmd' ? 'exit /b 7\r' : 'exit 7\r'
              )
              await exited
              assert.equal(session.code(), 7)
              await watcher.done
            } finally {
              watcher.cancel()
            }
            await session.handle.close()
            results.push({
              shell: shell.id,
              cycle: cycle + 1,
              checks: [
                'quoting-unicode',
                'cwd-space-unicode',
                'environment-isolation',
                'pipeline',
                'resize',
                'interactive-ctrlc',
                'exit-7',
                'cleanup'
              ]
            })
          } finally {
            session.detach()
            await session.handle.close().catch(() => {})
          }
        }
      }
      await port.dispose()
      await fs.mkdir('test-results/shells', { recursive: true })
      await fs.writeFile(
        'test-results/shells/compatibility.json',
        JSON.stringify(
          {
            os: os.release(),
            electron: process.versions.electron,
            available: shells.map((shell) => shell.id),
            unavailable: ['pwsh', 'git-bash'].filter(
              (id) => !shells.some((shell) => shell.id === id)
            ),
            results
          },
          null,
          2
        )
      )
      await fs.rm(directory, {
        recursive: true,
        force: true,
        maxRetries: 10,
        retryDelay: 100
      })
      clearTimeout(timer)
      app.exit(0)
    } catch (error) {
      console.error(error.message)
      await port.dispose().catch(() => {})
      await fs.rm(directory, {
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
