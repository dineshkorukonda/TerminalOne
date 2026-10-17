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

Linux implementation checks: formatting, strict build/typecheck, lint, all 23 unit/tooling tests, seven Electron smoke checks and audit (zero vulnerabilities) passed. Linux cannot verify native Windows behavior.

`test:shells` is a real Electron ConPTY compatibility matrix (#31), using production discovery and the utility adapter. Windows PowerShell and CMD must exist. PowerShell 7 and Git Bash run when installed; missing optional shells appear explicitly in JSON evidence. Each available shell runs twice, checking synthetic quoted Unicode text, cwd containing spaces/Unicode, fresh-session environment isolation, shell-native pipelines, resize, an interactive blocking command, raw Ctrl+C with observed-prompt synchronization, exit status 7, and retained-process-handle cleanup. It performs no script rewriting. CI fails on errors and writes `test-results/shells/compatibility.json` with actual OS/Electron and shell availability.

Windows native and packaged execution is pending CI at this revision. Do not interpret source coverage or unit tests as executed native compatibility evidence. Tests use synthetic data, bounded event/process waits and cleanup in finally. The shared native probe waits for the post-Ctrl+C prompt before sending more input; directory cleanup retries transient Windows locks.

Windows run `39042101081` passed the native probe and all 12 repeated renderer/lifecycle cases, then timed out in the first shell matrix session. The matrix now feeds output through the pinned xterm headless engine, returns terminal protocol replies to the shell, acknowledges parsed output, and waits for the initial prompt before commands. Failures identify the shell and expected condition without logging terminal contents. This correction still requires a Windows rerun; packaged execution was not reached in that run.

The shared Windows renderer tests type ASCII keys and deliver Unicode through xterm's paste event path; input-only Playwright `insertText` events are deliberately ignored in xterm screen-reader mode. Physical IME entry is not claimed. Main-crash testing force-terminates Electron's actual main PID obtained from its runtime and retains that handle; the Playwright Windows launcher PID is a separate wrapper.

## Limits

A recognizer is not a parser, execution policy, threat model, or promise that arbitrary scripts behave equivalently. The compatibility suite covers its explicit synthetic cases, not arbitrary scripts or complete shell semantics. Unit tests validate UNC paths but no real network share is exercised in hosted CI. Hosted Windows Server results do not establish manual Windows 10/11 compatibility. No environment secrets or user terminal output are logged. Installing prompt hooks, exposing a user-facing analysis workflow, command history, settings persistence and production qualification remain separate work.
