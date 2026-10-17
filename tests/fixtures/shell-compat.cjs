/* eslint-disable @typescript-eslint/no-require-imports -- Electron native compatibility entry uses CommonJS. */
const { app } = require('electron')
const path = require('node:path'),
  fs = require('node:fs/promises'),
  os = require('node:os')
const assert = require('node:assert/strict')
const { stripVTControlCharacters } = require('node:util')
const { Terminal } = require('@xterm/headless')
const watchProcesses = require('./process-watch.cjs')
const { UtilityPtyPort } = require('../../out/main/pty-client.js')
const { discoverShells } = require('../../out/main/shell-catalog.js')
const timer = setTimeout(() => app.exit(1), 180000)
delete process.env.TERMINAL_ONE_MATRIX
process.env.PS1 = 'MATRIX_PROMPT> '
process.env.PROMPT = 'MATRIX_PROMPT$G '
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
      const terminal = new Terminal({
        cols: 160,
        rows: 40,
        scrollback: 2000,
        allowProposedApi: true
      })
      const screen = () => {
        const buffer = terminal.buffer.active
        return Array.from(
          { length: buffer.length },
          (_, row) => buffer.getLine(row)?.translateToString(true) ?? ''
        ).join('\n')
      }
      const early = [],
        replies = [],
        waiters = new Set()
      const check = () => {
        for (const waiter of waiters) waiter()
      }
      const detach = port.onFailure(() => {
        code = -1
        check()
      })
      const reply = (data) => {
        if (!handle) replies.push(data)
        else
          void handle.write(data).catch(() => {
            code = -1
            check()
          })
      }
      // Interactive shells query terminal state (including cursor position).
      // Parse with the same terminal engine as the UI and return its replies.
      terminal.onData(reply)
      handle = await port.start(
        `matrix-${++sequence}`,
        shell,
        directory,
        { cols: 160, rows: 40 },
        (event) => {
          if (event.type === 'data') {
            terminal.write(event.data, () => {
              output = (output + event.data).slice(-262144)
              if (handle)
                void handle.acknowledge(event.sequence).catch(() => {})
              else early.push(event.sequence)
              check()
            })
          }
          if (event.type === 'exit') code = event.exitCode
          if (event.type === 'error') code = -1
          check()
        }
      )
      await Promise.all(early.map((value) => handle.acknowledge(value)))
      for (const data of replies) await handle.write(data)
      const wait = (predicate, condition) =>
        new Promise((resolve, reject) => {
          const timeout = setTimeout(
            () =>
              finish(
                new Error(
                  `${shell.id} session ${sequence}: timed out waiting for ${condition}`
                )
              ),
            20000
          )
          const finish = async (error) => {
            clearTimeout(timeout)
            waiters.delete(checkCondition)
            if (error) {
              // This fixture runs only synthetic commands with profiles disabled.
              // Retain bounded evidence here; never add production PTY logging.
              try {
                await fs.mkdir('test-results/shells', { recursive: true })
                await fs.writeFile(
                  'test-results/shells/failure.json',
                  JSON.stringify(
                    {
                      shell: shell.id,
                      condition,
                      screen: screen().slice(-8192),
                      protocol: output.slice(-8192)
                    },
                    null,
                    2
                  )
                )
              } catch {
                // Diagnostic retention must not replace the assertion failure.
              }
              reject(error)
            } else resolve()
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
        text: screen,
        wait: (pattern, since = 0) =>
          wait(
            () =>
              pattern.test(
                since === 0
                  ? screen()
                  : stripVTControlCharacters(output.slice(since))
              ),
            String(pattern)
          ),
        exited: () => wait(() => code !== null, 'process exit'),
        resize: async (size) => {
          terminal.resize(size.cols, size.rows)
          await handle.resize(size)
        },
        code: () => code,
        detach: () => {
          detach()
          terminal.dispose()
        }
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
            await session.wait(
              family === 'cmd'
                ? /MATRIX_PROMPT>/
                : family === 'bash'
                  ? /MATRIX_PROMPT>/
                  : /PS [^\r\n]*>/
            )
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
            await session.resize({ cols: 120, rows: 35 })
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
                ? /MATRIX_PROMPT>/
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
            console.log(
              `${shell.id} cycle ${cycle + 1}: compatibility checks passed`
            )
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
