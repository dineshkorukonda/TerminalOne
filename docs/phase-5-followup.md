# Phase 5 follow-up: CI and remaining issues

This follow-up targets main independently of the UI change in PR #68. It does not authorize signing, publishing or a beta release. The five open issues are #41, #43, #45, #46 and #48; none is closed by a fabricated approval or a Windows Server result.

## Installed-app readiness failure

Main run [39103384198](https://github.com/dineshkorukonda/TerminalOne/actions/runs/39103384198) passed UI/native/shell/packaged checks but timed out on the command following Ctrl+C in the installed app. The fixture accepted a prompt anywhere in the accessibility tree; an old prompt or a command echo could satisfy that check before input was idle. It now reads terminal ListItem rows and requires the last nonblank row to be a bare PowerShell prompt, at startup, after the Unicode command and after interruption. The new PowerShell regression rejects historical prompts and incomplete command echoes. This is fixture synchronization for a controlled synthetic workload, not a security decision about arbitrary shell output. Windows execution remains required to verify the correction.

## Performance evidence and mitigation: #43

The [preserved attributed profile](evidence/phase-5-attributed/performance.json) comes from successful run [39102983220](https://github.com/dineshkorukonda/TerminalOne/actions/runs/39102983220). [Source metadata](evidence/phase-5-attributed/source.json) records the actual artifact build commit separately from the PR head. This is pre-fix evidence from Windows Server 2025 x64 on a two-core AMD EPYC 9V74 runner, not newly executed client-Windows testing.

Electron working set was 411,960 KiB before work, 690,336 KiB after work and 626,620 KiB after ten idle seconds. The idle interval reclaimed 62.22 MiB but left 209.63 MiB above the initial snapshot. One utility retained 175.07 MiB of that increase; the renderer retained 31.35 MiB. The data does not support calling all growth transient, nor does working set alone prove which objects leak. Per-cycle aggregate memory rose from 552,932 to 690,320 KiB with one intervening drop.

Source inspection and upstream reports identified ConPTY worker/native resource retention as a concrete lifecycle risk. [Decision 0005](architecture/0005-session-host-lifetime.md) gives each session an owned utility-process lifetime, including confirmed process exit on close and automatic retirement after natural exit. Existing Job Object cleanup is retained, with no node-pty private-method patch and no bare-PID sweep. New profiles record service names and require twenty session cycles to return to the original live pane's PTY-host PID set. Unit cases cover sibling isolation, natural exit, startup/shutdown races, host failure/recovery, allocation bounds and failed cleanup. Actual post-fix Windows timings and settled-memory measurements are still pending CI. Extra per-pane processes and fresh startup are deliberate costs to measure.

#43 remains open until the post-fix finding is assessed and measured budgets are agreed by the owner. Existing proposed budgets are not silently promoted into approved release gates.

## Remaining completion requirements

- #41: the strategy and unsigned labeling exist. An approved signing provider/legal publisher identity, authorized credentials and signed-artifact verification are still missing.
- #45: installed-app automation exists. The same artifact still needs actual clean Windows 10 and Windows 11 x64 results, with OS/build/architecture/source/hash recorded. Server build 26100 is not Windows 11 evidence.
- #46: automated keyboard, scale, axe and token-contrast checks exist. The UI PR refreshes the palette and retains high contrast. Actual Narrator, physical IME, rendered contrast and manual keyboard results remain missing.
- #48: CI assets, checksums and release-note tooling exist. Required reviews, complete qualification and explicit owner release approval remain missing. The checked-in qualification manifest stays incomplete and publishing stays disabled.

These requirements explain why the issues remain open; they are not permission to change their acceptance criteria or mark unperformed work complete.
