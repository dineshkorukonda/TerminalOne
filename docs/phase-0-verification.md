# Phase 0 implementation and verification

The complete foundation is collected in [PR #60](https://github.com/dineshkorukonda/TerminalOne/pull/60), targeting `main`. Earlier focused PRs #54–#59 document the issue-sized changes; several were merged into parent branches after those parents had already been merged, so their merged state alone did not place all changes on `main`. The integration PR carries the complete implementation and preserves the current website tree from `main`.

## Implemented issue scope

- #1: runnable Electron/React/Vite bootstrap, locked dependencies and strict TypeScript (already merged).
- #2: window adapter/composition separation, architecture decision, resolved import restrictions, and 39 allowed/forbidden dependency cases.
- #3: named preload capabilities, main-window/frame/document authorization, strict argument/URL policy, navigation/permission/CSP restrictions, and packaged startup debugging rejection.
- #4: working lint/fix/format/check/type commands, generated-output exclusions, and verified failure fixtures.
- #5: Husky/lint-staged, meaningful Conventional Commit bodies and issue references, no-emoji checks, PR-title validation, and a commit template.
- #6: real pinned Windows quality workflow with least-privilege permissions and uploaded launch evidence; LF checkout policy fixes the observed Windows CRLF failure.
- #7: actionable issue forms and a review/evidence-oriented PR template (already merged).
- #8: README, contribution/security policy, persistent agent instructions, unreleased changelog, and owner-managed repository settings guidance. Original MIT license retained.
- #9: shared Tailwind/ANSI tokens, validated typed font configuration, consistent SVG icons, keyboard focus, contrast checks, and scaled Electron component tests.

## Actual evidence

Local environment: Ubuntu 24.04 LTS x86_64, Node 24.21.0, npm 11.19.0. Locked installation, formatting, lint, strict types/build, unit/tooling tests, Electron launches, and audit were exercised. The unit suite includes schema/sender/startup-policy checks, 39 architecture cases, positive/negative commit fixtures, controlled alternate-index staged checks, real lint/type violations, font validation, and token contrast. The real staging area is preserved and fixtures are removed. Linux launch checks use the temporary extracted Xvfb/GTK setup described in the original [bootstrap record](bootstrap-verification.md).

[Windows tooling/security run](https://github.com/dineshkorukonda/TerminalOne/actions/runs/39035715791) passed on Windows Server 2025 Datacenter, build 10.0.26100, x64. Install, PR title, formatting, lint, typecheck, unit/tooling tests, built/development Electron launches, audit, and artifact upload all passed.

[Windows theme run](https://github.com/dineshkorukonda/TerminalOne/actions/runs/39036017441) also passed, including six built/development Electron launches at Chromium renderer scales 100%, 150%, and 200%. The built-window screenshots below were downloaded from that run and visually inspected for readable content, intact layout, and visible keyboard focus. These retained images came from theme revision `1dd96e3`; subsequent integration/startup-policy edits do not change the renderer's appearance.

- [Windows 100%](screenshots/phase-0/windows-100.png)
- [Windows 150%](screenshots/phase-0/windows-150.png)
- [Windows 200%](screenshots/phase-0/windows-200.png)

At larger forced scales the small hosted desktop has vertical scrolling; focus and text remain intact and the component tests verify no horizontal overflow. These are renderer-scale checks, not native titlebar or cross-monitor system-DPI qualification.

The final integration head's checks are available on [PR #60](https://github.com/dineshkorukonda/TerminalOne/pull/60/checks). Its Electron suite additionally simulates packaged mode in a startup probe and checks that debugging flags cause immediate exit, rather than an error dialog. That test does not create or certify a packaged installer.

## Remaining external gates and later work

Owner review/merge authorization and repository required-check/review settings remain owner-managed. A workflow file does not enforce branch protection by itself. Private vulnerability-reporting availability was not confirmed; no contact or response SLA is invented.

Windows Server CI is not Windows 10/11 compatibility evidence. Manual desktop/assistive-technology testing, cross-monitor DPI changes, PTY/shell sessions, packaging/fuses, installer/signing/updates, and the security audit remain their separately tracked later-phase issues. No desktop release, installer, signing, visibility change, or production-security certification is claimed. Playwright launch automation uses debugger flags and disables the OS sandbox.
