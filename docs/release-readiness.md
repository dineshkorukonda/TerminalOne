# Windows beta readiness

Phase 5 covers #40–#48 in one PR targeting main. Building an artifact is separate from approving a public beta. No public release, signing provider, paid account or visibility change is authorized automatically.

## Build and verification

```powershell
npm ci
npm run build:win
npm run test:installed
npm run test:profile
npm run release:notes
npm audit --audit-level=moderate
```

build:win compiles the Windows Job Object helper, rebuilds node-pty for the pinned Electron ABI, builds the renderer and creates an x64 per-user NSIS installer under artifacts/windows. The application includes its runtime; end users do not need Node, Python, a compiler or development dependencies. The installer is unsigned and publishing is disabled. It preserves user data on uninstall. Source and dependency licenses remain included.

Production fuses disable RunAsNode, NODE_OPTIONS and Node CLI inspection, and require the integrity-bound app.asar. Native helper/addon files remain physically unpacked. Build verification reads the actual fuse wire and checks the native paths. These measures do not make an unsigned app a same-user security sandbox or authenticate unpacked native files.

The installed-app test uses a clean ephemeral CI runner or an explicitly selected clean VM. It silently installs into a temporary path containing spaces and Unicode, launches the actual executable without debugging flags, uses Windows UI Automation and guarded keyboard focus to exercise shell commands/Unicode/resize/Ctrl+C, closes the app and waits on retained owned process handles, and uninstalls. It records actual OS, checksum, startup sample and results under test-results/installer. A Windows Server result is installer evidence for that runner, not Windows 10/11 qualification. Local Linux cannot execute this installer test.

## Required evidence and current gaps

See [Phase 5 verification](phase-5-verification.md) for inspected main-branch CI results, measured performance, installer identity and automated accessibility evidence. The successful Server run does not resolve the client-OS, manual accessibility, performance-review or owner-approval gates below.

| Issue | Delivered engineering                                                                                          | Completion gate                                                                          |
| ----- | -------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------- |
| #40   | Self-contained unsigned NSIS build, checksums, fuse/native-path checks and actual installed-app/uninstall test | Windows CI execution must pass                                                           |
| #41   | Signing strategy and credential/publisher policy                                                               | Owner-approved provider/identity and actual signed verification; currently strategy-only |
| #42   | Update architecture and failure/trust model                                                                    | Architecture only; no updater/service activated                                          |
| #43   | Repeatable Windows startup/output/multiple-pane/cleanup profiling and hardware/runtime record                  | Measured Windows baselines plus owner review of proposed budgets                         |
| #44   | Threat model, findings/fixes/residual risk report and adversarial checks                                       | Relevant Windows/packaged checks pass; unresolved release risks remain explicit          |
| #45   | Client-OS verifier and evidence procedure                                                                      | Actual clean Windows 10 and 11 x64 results for the same source/artifact                  |
| #46   | Automated axe and keyboard flows, contrast checks, UI Automation evidence                                      | Windows Narrator and manual keyboard/IME results; automated checks do not substitute     |
| #47   | Main/version-tag artifact workflow and conventional-history draft notes; no publisher                          | Dry-run generation, branch guards and Windows artifact build pass                        |
| #48   | Qualification manifest, strict checklist validator and distribution procedure                                  | All evidence, signing decision, required CI/reviews and explicit owner release approval  |

The checked-in release/qualification.json deliberately records missing evidence and approvals. npm run release:check exits nonzero until complete. Synthetic passing manifests exist only inside tests. Completing manifest fields is bookkeeping, not proof or owner authentication; linked artifacts, reviews and repository permissions must establish the facts. Do not mark #41, #45, #46 or #48 complete from strategy documents or Server automation alone.

## Client Windows qualification

Provision licensed clean x64 Windows 10 22H2 (build 19045) and Windows 11 machines. Record exact edition/build, architecture, source commit and installer SHA256. These are qualification targets, not a support promise for every ConPTY-capable Windows build. Confirm the pinned Electron release's platform support before declaring a minimum supported build. Use the same artifact on both machines.

Copy the unsigned review artifact and SHA256SUMS.txt from CI. Verify the checksum independently, acknowledge its unsigned development status, and run the installation checks only in the dedicated VM:

```powershell
node scripts/qualify-windows.mjs --clean-vm
```

The verifier refuses Windows Server and unsupported architectures/builds, runs actual installed-app tests and writes test-results/qualification/windows-10.json or windows-11.json. It does not mark manual IME/Narrator checks as passing. No client-OS execution has been established by source code alone.

Manually repeat startup, shell selection, tabs/splits, quoting, paths with spaces/Unicode, resize, Ctrl+C, cleanup, install/uninstall and normal limited-user behavior. Test physical IME entry and monitor/DPI changes on actual target builds. With Narrator enabled, verify tab/shell/search/appearance and developer-settings names, focus order, modal behavior, xterm input/output reading and escape/focus restoration. Record date, tester, exact OS/Narrator version, artifact hash, pass/fail and limitations. Use synthetic commands and record no private terminal output. Attach results; do not replace not-run entries with assumptions.

## Public distribution handoff

Review actual installer, checksums, test reports, security findings, performance measurements and release-note draft. Obtain the signing decision and implement/verify it in a separate approved change. Obtain manual client-OS/Narrator evidence, required CI/reviews and explicit owner release approval. Only then decide a beta version/channel and publication action. The present workflows cannot publish, even on version tags. Releasing or changing repository visibility remains an owner action requiring explicit authorization.
