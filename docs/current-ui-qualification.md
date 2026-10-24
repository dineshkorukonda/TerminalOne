# Current UI client qualification: issue #89

Status on 2026-10-24: incomplete. The owner confirmed that no manual Windows 10/11 qualification evidence is available. Issue #89 must remain open. This report reconciles historical issue closure with the evidence actually present; it does not certify the current UI or authorize signing or a release.

## Evidence inventory

Historical reports in `phase-4-verification.md`, `phase-5-verification.md` and `phase-5-followup.md` describe particular past builds. Closing #45/#46 did not produce new Narrator, physical IME, rendered-contrast or client-OS results. The attributed phase-5 artifacts predate the current compact UI and session host retirement.

Windows CI [run 40064151158](https://github.com/dineshkorukonda/TerminalOne/actions/runs/40064151158) passed UI/packaged security and installed-app qualification. Its head is `630430ce9d6f350522e6aaa04ae8b9ac63a99727`; the shared runtime artifact records actual build source `9f0c9d4b000fefa821e57e0f8b7c67969743316a`. The runner is Windows Server 2025, build 26100, not a Windows 10/11 client qualification machine. Automated axe/keyboard tests and UI Automation are distinct from Narrator speech, physical IME and physical monitor transitions.

For a concrete provenance example, the published unsigned [v0.2.0-alpha.10](https://github.com/dineshkorukonda/TerminalOne/releases/tag/v0.2.0-alpha.10) manifest identifies source `d7bb8222d6924601f7d2112089faca8cea8638d2` and installer `TerminalOne-0.2.0-alpha.10-unsigned-x64.exe`, 118,615,391 bytes, SHA-256 `782cc499ac281653559ce501300cd6b568fb3827acf6aca67be695d8f10469bf`. The release-data verifier downloaded and compared its assets on 2026-10-24. This artifact predates the subsequently merged settings/tab identity changes and is not evidence for those changes. Select a newly validated artifact containing the final UI for actual qualification, and use its identical hash on both client machines.

## Outstanding manual matrix

| Required evidence                                                                                            | Windows 10 client | Windows 11 client |
| ------------------------------------------------------------------------------------------------------------ | ----------------- | ----------------- |
| Exact product/edition/build/architecture, tester/date, source and installer SHA-256                          | Not recorded      | Not recorded      |
| Narrator version, names/reading order, terminal output reading, tab/pane context and focus announcements     | Not run           | Not run           |
| Keyboard-only tab rename, splits, palette, settings dirty close, close confirmation, search and focus return | Not run           | Not run           |
| Physical IME composition/commit/cancel in terminal and dialogs                                               | Not run           | Not run           |
| Move the same running window between physical monitors with different scale factors                          | Not run           | Not run           |
| Rendered text/control/focus contrast in both themes, active pane visibility and narrow-window clipping       | Not run           | Not run           |
| Menus and modal focus containment, Escape and cancellation preserving work                                   | Not run           | Not run           |

The 100/125/150/200% automated scale tests do not establish monitor-transition behavior. Token contrast ratios do not establish all rendered states. Zero axe violations can coexist with incomplete contrast checks. Running on a Windows client under automation does not constitute manual client qualification.

## How to supply completion evidence

Use the [client qualification procedure](release-readiness.md#client-windows-qualification) with a validated artifact containing the final UI. Run only synthetic commands and retain no private terminal output. For each machine record the actual OS product/build, Narrator version, GPU/display scale arrangement, physical IME/input language, tester/date, artifact version/hash/source and the result of every matrix row. Include failures and limitations. Verify focus after both cancellation and confirmation, and test a small window with split panes and renamed tabs.

Attach the reports and artifact provenance to #89, then reconcile this matrix against the actual results. Leave unperformed checks marked not run. Do not fill `release/qualification.json` approval/signing fields from this document or from automated results. Required reviews and owner release/signing approvals remain separate decisions.
