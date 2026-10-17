# Phase 1: native terminal engine

All #10–#16 changes are reviewed together in [PR #62](https://github.com/dineshkorukonda/TerminalOne/pull/62), with separate issue-linked commits. This document records the implementation and distinguishes completed evidence from checks still running.

## Runtime and build

Versions are locked: Node 24.21.0 / npm 11.19.0 for development, Electron 44.9.0, node-pty 1.1.0, @electron/rebuild 4.2.1, @electron/packager 20.3.0, @xterm/xterm 6.0.0, @xterm/addon-fit 0.11.0. The native addon is explicitly rebuilt against Electron's headers; host Node unit tests are not ABI evidence. The probe records the actual Electron, Node, module ABI, OS build, and packaged flag in its JSON evidence.

On Windows x64, install Visual Studio Build Tools (Desktop development with C++, Windows SDK) and .NET Framework 4.x developer tooling, then:

```powershell
npm ci
npm run native:build
npm run format:check
npm run lint
npm run typecheck
npm run test:unit
npm run test:smoke
npm run test:native
npm run test:packaged
npm audit --audit-level=moderate
```

The Job Object helper is compiled with Windows' .NET Framework C# compiler. No compilation or package download occurs when a built diagnostic runs. The native addon and helper are unpacked from ASAR for loading/execution. Packaging is an unsigned test application, not an installer, signed release, or full production packaging/security qualification (#40/#44).

## Delivered behavior and repeatable checks

| Issue | Implementation                                                                                                                                 | Verification                                                                                                                                                       |
| ----- | ---------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| #10   | Stable node-pty in an Electron utility process, explicit Electron rebuild and ASAR native assets                                               | Native fixture launches actual PowerShell and checks real output/exit; the same fixture runs from the packaged diagnostic                                          |
| #11   | Platform-free PTY port and application lifecycle with owner-scoped IDs, states, idempotent close, bounded sessions                             | Unit tests cover ownership, unknown IDs, spawn failure, host failure, close during start, owner cleanup and disposal                                               |
| #12   | Discover PowerShell 7, Windows PowerShell, CMD, optional Git Bash; fixed argument arrays                                                       | Injected discovery tests cover missing optional shells, CMD fallback, spaces/Unicode PATH and stable IDs; native/renderer tests launch Windows shells              |
| #13   | xterm parses ANSI/Unicode, named session capabilities and teardown, bounded output with acknowledgements                                       | Native fixture checks ANSI/Unicode; renderer integration observes xterm's accessibility tree and subscriber detachment                                             |
| #14   | Raw input including Ctrl+C, fit addon/ResizeObserver, bounded and coalesced grid updates                                                       | Native fixture verifies dimensions and Ctrl+C; unit test holds one resize in flight during a storm; renderer tests keyboard input and restart                      |
| #15   | Compiled Job Object helper terminates owned trees on close, natural exit and main/utility loss; renderer/window/quit cleanup; sanitized errors | Process watchers retain root/child handles before triggering cleanup and wait for actual process exit; unit tests verify safe spawn/host failure messages          |
| #16   | Separate unit, Electron renderer smoke, Windows native integration and ASAR diagnostic suites                                                  | CI fails on any error, preserves screenshots/traces and JSON evidence; three complete native cycles per fixture invocation; every Windows renderer case runs twice |

Native conditions use output events and OS process handles with bounded deadlines. There are no arbitrary sleeps to make assertions pass. Tests clean up ports, profiles, temporary Unicode files, and process watchers. Test output reports only synthetic markers and platform metadata, never a user's terminal content.

## Evidence

- Linux local: formatting, lint, strict typecheck, 17 unit/tooling tests, build, and seven Electron smoke checks passed during implementation. Linux smoke proves capability isolation and unsupported-platform handling; it cannot prove ConPTY or Windows cleanup.
- [Initial Windows utility spike](https://github.com/dineshkorukonda/TerminalOne/actions/runs/39037481547): rebuilt addon and real PowerShell output/exit passed. Packaged step failed on a packager import and was corrected; this run is not a passing packaged result.
- Full native cleanup, renderer integration, and ASAR checks are pending Windows CI at this revision. Do not treat source coverage as execution evidence. Results will be recorded after the complete run passes.

## Limits and later work

Requires Windows ConPTY, with a minimum Windows 10 build of 18309. Automated evidence comes from GitHub's Windows Server runner; interactive Windows 10/11 compatibility remains unverified. PowerShell 7 and Git Bash appear only when discovered; no shell is downloaded. Discovery tests exercise their paths, while native repetition targets Windows PowerShell and the UI uses available profiles.

Each window supports four concurrent sessions, with 16 utility sessions and 256 retained lifecycle records maximum. A long-lived window reaching the record limit shows an actionable error; reopening resets it. Output is paused with bounded backpressure; exceeding the hard bound closes the session visibly. Scrollback is limited to 2,000 lines and is not persisted. No command interception, rewriting, telemetry, transcript logging, tabs, splits, settings persistence, WSL, SSH, or installer/release features are included.

Job ownership covers the shell and descendants created normally under its job. It is not a command security sandbox and does not promise to terminate processes requested through unrelated services. Later production hardening, installer fuses/signing, accessibility qualification, and broad Windows compatibility remain separately tracked.
