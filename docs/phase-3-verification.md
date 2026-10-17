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

Linux implementation checks before Phase 2 integration: formatting, strict build/typecheck, lint, all 23 unit/tooling tests, seven Electron smoke checks and audit (zero vulnerabilities) passed. The integrated branch now includes the merged Phase 2 workspace; formatting, lint, strict build/typecheck, all 27 unit/tooling tests and all 12 Electron smoke checks passed. Linux cannot verify native Windows behavior.

`test:shells` is a real Electron ConPTY compatibility matrix (#31), using production discovery and the utility adapter. Windows PowerShell and CMD must exist. PowerShell 7 and Git Bash run when installed; missing optional shells appear explicitly in JSON evidence. Each available shell runs twice, checking synthetic quoted Unicode text, cwd containing spaces/Unicode, fresh-session environment isolation, shell-native pipelines, resize, an interactive blocking command, raw Ctrl+C with observed-prompt synchronization, exit status 7, and retained-process-handle cleanup. It performs no script rewriting. CI fails on errors and writes `test-results/shells/compatibility.json` with actual OS/Electron and shell availability.

Windows native and packaged execution is pending CI at this revision. Do not interpret source coverage or unit tests as executed native compatibility evidence. Tests use synthetic data, bounded event/process waits and cleanup in finally. The shared native probe waits for the post-Ctrl+C prompt before sending more input; directory cleanup retries transient Windows locks.

Phase 2 run `39042730374` exposed a shared packaging defect: `native/**` did not match the absolute filename supplied to ASAR, leaving the Job Object executable packed while runtime expected a physical unpacked path. A local archive reproduction confirmed the defect and the corrected `**/native/**` rule. Packaging now checks the unpacked helper exists before launching. Synthetic helper/addon/worker unpacking passed locally; this is not evidence of executed packaged ConPTY behavior.

Windows run `39042101081` passed the native probe and all 12 repeated renderer/lifecycle cases, then timed out in the first shell matrix session. The matrix now feeds output through the pinned xterm headless engine, returns terminal protocol replies to the shell, acknowledges parsed output, and waits for the initial prompt before commands. Subsequent runs passed both PowerShell variants twice; packaged execution was not reached in those runs.

Run `39042629601` passed both complete cycles for PowerShell 7 and Windows PowerShell. CMD timed out on a prompt assertion. Discovery supplied `/q`, which disables echo and hides the prompt ([Microsoft echo reference](https://learn.microsoft.com/windows-server/administration/windows-commands/echo)); it now retains `/d` alone, with a regression assertion on the arguments. The fixture supplies an explicit CMD `PROMPT` marker, matching the controlled Bash prompt. Run `39043411787` still timed out on that marker, so removing `/q` did not fully resolve synchronization. The matrix checks the rendered terminal buffer rather than treating stripped protocol bytes as a rendered screen. A local cursor-redraw example verifies that these differ. Failures retain bounded synthetic fixture screen/protocol evidence under `test-results/shells/failure.json`; there is no production terminal logging.

The diagnostics from run `39044197760` show that CMD passed startup, quoted Unicode, cwd with spaces/Unicode, isolated environment, pipeline and resize assertions. The timeout was specifically after Ctrl+C: the fixture's echo marker preceded launching `ping`, allowing the interrupt to arrive before the blocking child started. CMD now waits for a loopback reply (`TTL=`) from `ping` itself before interrupting. Initial and post-interrupt prompt failures have distinct labels. Both PowerShell variants again completed both cycles. Full CMD, Git Bash and packaged execution remain pending a successful rerun.

Run `39056769238` completed both full cycles for PowerShell 7, Windows PowerShell and CMD. Git Bash passed the earlier checks but timed out after interrupting `printf; sleep`, another marker preceding a child launch. Its interactive case now uses Bash's blocking `read` builtin, whose own prompt signals readiness, and records `interactive-read-ctrlc` explicitly in evidence. A local Linux Bash PTY experiment passed readiness, raw Ctrl+C, subsequent command and exit using that exact input; this does not establish Git Bash behavior. The case verifies bounded interactive input; interruption of arbitrary Git Bash child processes remains unverified. Git Bash and packaged execution on the integrated branch still require a successful Windows rerun.

Run `39057457494` completed one full Git Bash cycle, including the read interrupt and cleanup. In the second cycle, the command sent immediately after resize reached Bash as `rintf` instead of `printf`. The synthetic fixture now installs a `WINCH` trap, waits for the post-pipeline prompt so Bash owns the foreground terminal, and waits for the trap acknowledgment after resize before submitting input. A Linux Bash PTY experiment passed 20 acknowledged resizes and subsequent commands. This tests delivery of the resize signal as well as the API call and avoids racing automated input against resize handling. It does not establish that simultaneous arbitrary input and resize is lossless; that remains unverified. Both full Git Bash cycles and packaged execution on this integrated branch still require a successful rerun.

The shared Windows renderer tests type ASCII keys and deliver Unicode through xterm's paste event path; input-only Playwright `insertText` events are deliberately ignored in xterm screen-reader mode. Physical IME entry is not claimed. Main-crash testing force-terminates Electron's actual main PID obtained from its runtime and retains that handle; the Playwright Windows launcher PID is a separate wrapper.

## Limits

A recognizer is not a parser, execution policy, threat model, or promise that arbitrary scripts behave equivalently. The compatibility suite covers its explicit synthetic cases, not arbitrary scripts or complete shell semantics. Unit tests validate UNC paths but no real network share is exercised in hosted CI. Hosted Windows Server results do not establish manual Windows 10/11 compatibility. No environment secrets or user terminal output are logged. Installing prompt hooks, exposing a user-facing analysis workflow, command history, settings persistence and production qualification remain separate work.
