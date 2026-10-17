# Phase 3: shell adapter

Issues #24–#32 are delivered together in one phase PR targeting main, with issue-linked commits. The adapter is a pure explicit analysis/decision boundary; the interactive terminal remains raw and unchanged. This phase does not install shell prompt hooks, scrape output for state, intercept keystrokes, translate scripts, automatically start a different shell, or expose arbitrary process execution.

## Contracts and behavior

The [architecture decision](architecture/0002-shell-adapter.md) defines `ShellAdapter`, `CommandAnalysis`, `ExecutionStrategy`, `AdapterRegistry`, syntax evidence, confidence/unknown state, executable availability, and explicit integration provenance (#24/#25).

Recognizers (#26–#28) support only documented positive forms: selected explicit PowerShell cmdlets and `$env:NAME=` assignments; CMD `set`, `setlocal`/`endlocal`, selected `dir` switches and percent-environment echo; Bash `export`, `source`, and simple assignments. They preserve the original string. Bare `dir`/`cd`, quoted command names, incomplete quotes, pipelines/operators, functions, multiline scripts, escape-dependent forms and unknown commands fall back. Evidence is not a claim about command safety or alias/function semantics. Without verified integration/alias context, even positive evidence is unverified.

Resolution (#29/#32) defaults to the active shell. Interactive input stays attached. Unknown/ambiguous input preserves command bytes and reports a non-sensitive reason code. Recognized incompatible syntax asks for deliberate selection, accounting for missing executables and isolated state; the resolver itself never executes. Explicitly requesting another shell still requires a selection workflow and does not migrate state.

State tracking (#30) accepts only its configured integration-producer object and registered session ID. Monotonic prompt observations validate drive/UNC/Unicode cwd, exit code, and an opaque environment revision. It stores no environment values and never copies aliases/functions/state across sessions. Without a producer observation, cwd/environment are unknown. Integration failure clears provenance. No real prompt integration producer is installed by this phase; the state boundary is exercised through focused tests for later explicit consumers.

## Checks

```powershell
npm ci
npm run native:build
npm run format:check
npm run lint
npm run typecheck
npm run test:unit
npm run test:smoke
npm run test:native
npm run test:shells
npm run test:packaged
```

Local Linux checks on the integrated Phase 2/3 branch passed: formatting, lint, strict build/typecheck, all 27 unit/tooling tests, all 12 Electron smoke checks and dependency audit (zero vulnerabilities). Linux results do not verify native Windows behavior.

Windows CI [run 39058103399](https://github.com/dineshkorukonda/TerminalOne/actions/runs/39058103399) passed at `a4497f1` on Windows Server 10.0.26100, Electron 44.9.0, Node 24.22.0, ABI 149:

- Formatting, lint, strict typecheck, all 27 unit/tooling tests and dependency audit (zero vulnerabilities).
- All 12 Electron smoke checks and all 14 native renderer/lifecycle checks (seven cases repeated twice).
- Three utility-process PTY cycles and three packaged ASAR cycles: ANSI, Unicode, file paths, resize, Ctrl+C, exit status, close/natural-exit/utility-crash cleanup, recovery and shutdown.
- All eight installed-shell compatibility cycles in the following table. No optional shells were unavailable in this run.

| Installed shell    | Passed cycles | Interactive interrupt case                   |
| ------------------ | ------------- | -------------------------------------------- |
| PowerShell 7       | 2             | Ctrl+C during Start-Sleep                    |
| Windows PowerShell | 2             | Ctrl+C during Start-Sleep                    |
| CMD                | 2             | Ctrl+C after a loopback ping reply           |
| Git Bash           | 2             | Ctrl+C during the blocking Bash read builtin |

Downloaded `shells/compatibility.json` records quoting/Unicode, cwd containing spaces/Unicode, environment isolation, native pipelines, resize, interactive Ctrl+C, exit status 7 and retained-process-handle cleanup for every cycle. It records `interactive-read-ctrlc` explicitly for Bash. Windows PowerShell and CMD are mandatory; PowerShell 7 and Git Bash run when installed and missing optional shells are recorded rather than counted as passing.

Downloaded `native/utility.json` and `native/packaged.json` both report `passed: true`, with `packaged: false` and `packaged: true` respectively. The package is an unsigned diagnostic executable, not an installer or release. The Job Object executable and node-pty files are unpacked from ASAR; packaging verifies the helper's physical path before launch.

The matrix uses production discovery and the utility adapter. Its pinned xterm headless engine parses output, acknowledges buffers and returns terminal protocol replies. Startup waits for a prompt; CMD uses an explicit fixture prompt and launches with `/d` to disable AutoRun while preserving echo. Interrupt tests wait for readiness from the blocking operation itself. Bash resize waits for the post-pipeline prompt and a fixture `WINCH` trap acknowledgment before more input. A Linux Bash PTY experiment separately passed 20 acknowledged resizes and subsequent commands. There are no assertion sleeps or arbitrary script rewrites. Bounded synthetic failure diagnostics are confined to `test-results/shells/failure.json`; no production terminal logging is added.

These cases do not establish that arbitrary Git Bash child processes can be interrupted, or that simultaneous input and resize is lossless. Those behaviors remain unverified. The matrix deliberately covers the stated supported interactive cases.

The shared Windows renderer tests type ASCII keys and deliver Unicode through xterm's paste event path; input-only Playwright `insertText` events are deliberately ignored in xterm screen-reader mode. Physical IME entry is not claimed. Main-crash testing force-terminates Electron's actual main PID obtained from its runtime and retains that handle; the Playwright Windows launcher PID is a separate wrapper.

## Limits

A recognizer is not a parser, execution policy, threat model, or promise that arbitrary scripts behave equivalently. The compatibility suite covers its explicit synthetic cases, not arbitrary scripts or complete shell semantics. Unit tests validate UNC paths but no real network share is exercised in hosted CI. Hosted Windows Server results do not establish manual Windows 10/11 compatibility. No environment secrets or user terminal output are logged. Installing prompt hooks, exposing a user-facing analysis workflow, command history, settings persistence and production qualification remain separate work.
