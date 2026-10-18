# Phase 5 evidence and remaining qualification

Evidence retrieved on 2026-10-18 from the successful [main Windows CI run 39068974464](https://github.com/dineshkorukonda/Terminal/actions/runs/39068974464), for source commit `f78f59adf08a2f5563568ad0a5c71ec5d7d77631`. These are existing CI results inspected during this follow-up, not newly executed local tests. Small JSON reports are preserved under [evidence/phase-5-main](evidence/phase-5-main/) because CI artifacts expire after seven days.

The runner log identifies Microsoft Windows Server 2025, image `windows-2025-vs2026`, x64, build 26100. It used Node 24.21.0 and npm 11.19.0 for the build; Electron 44.9.0 embeds Node 24.22.0. This evidence does not qualify Windows 10 or Windows 11.

## Passed CI checks

Formatting, lint, typecheck, 35 unit/tooling tests, 16 Electron smoke tests, 18 native workspace tests, real utility-process ConPTY probing, shell compatibility, packaged native verification, installer build/install/uninstall, one performance profile, release-note generation and dependency audit passed. PR-title validation was skipped on the main push, as configured. A successful workflow is not evidence of a human review or release approval.

The unsigned installer was `TerminalOne-0.1.0-unsigned-x64.exe`, SHA256 `fe1486ff0447da363a1f19ebfad289fd64c13ac63adf2799604a6ed0cc14bf23`. Its installed-app report passed launch, shell command, Unicode, resize, Ctrl+C, owned-process cleanup and uninstall checks. Packaged launch took 2065 ms in this single sample. The saved build/test JSON reports agree on the checksum; the installer has not been independently downloaded or rehashed in this follow-up.

## Performance: #43

The [raw profile](evidence/phase-5-main/performance.json) records an AMD EPYC 7763 runner with two logical CPUs and 8,584,425,472 bytes of system memory. Fresh-profile startup was 2965.82 ms; subsequent launches were 1021.51 and 870.27 ms (median 945.89 ms). The synthetic 1 MiB output workload completed in 8083.12 ms, or 0.124 MiB/s including automation and command submission. Window geometry changes took 46.03, 27.33 and 26.20 ms. All 20 retained shell-process cleanup checks passed, taking 31.88–66.14 ms.

Electron working set rose from 408,540 KiB before the workload to 638,708 KiB afterward, a 224.77 MiB increase. During session cycling it rose from 550,080 KiB to a peak of 681,124 KiB, then fell to 638,696 KiB in the last sample. This is a memory-growth finding requiring investigation, not proof of either a leak or leak freedom. The scope excludes shell/helper/conhost memory; output rendering and multiple panes also occur between initial and final snapshots. The last-sample drop prevents interpreting the sequence as strictly monotonic growth.

Next qualification work is repeated equal-workload runs with per-process attribution and a post-workload idle interval to distinguish retained allocations from transient growth. Existing proposed regression budgets remain unapproved. Do not close #43 until that finding is assessed and the owner agrees to budgets supported by measurements.

## Accessibility: #46

The seven saved [axe reports](evidence/phase-5-main/accessibility/) contain zero violations in workspace, palette, search, appearance, developer settings, history/draft and empty workspace. Six retain incomplete color-contrast checks; only empty workspace has no incomplete checks. These are automated Windows Server results, supplementing the earlier Linux evidence. They do not establish rendered contrast in all states, Narrator speech/reading order, physical IME behavior or manual keyboard usability on the distributed artifact. #46 remains open pending those actual manual results.

## Remaining owner and environment gates

- #41: approved signing provider and legal publisher identity, authorized credentials, then actual signed-artifact verification. No provider has been selected on the owner's behalf.
- #43: memory-growth investigation and approved performance budgets as described above.
- #45: clean Windows 10 and Windows 11 x64 qualification of the same source and installer. Server build 26100 must not be relabeled as Windows 11.
- #46: manual Narrator, keyboard and rendered-contrast evidence with tester, exact OS/Narrator versions and artifact hash.
- #48: all qualification evidence, required CI/reviews, signing implementation and explicit dated release approval. The unsigned development artifact is not a public beta.

The release manifest remains incomplete deliberately. Preserve its false/missing approval fields until real evidence and decisions exist; this report does not authorize publication or merge. See [release readiness](release-readiness.md) for the existing qualification commands and manual procedure.

## Local follow-up environment

The development machine is Windows 11 Home Single Language x64, build 26300, product type 1. A repository-local Node 24.21.0/npm 11.19.0 toolchain was installed after verifying the Node archive against its published SHA256 listing; locked dependency installation passed with zero audit vulnerabilities. Native rebuild failed because node-gyp could not find a Visual Studio installation. Consequently the new per-process/settled-memory profile has not run locally, and this machine supplies no installer or compatibility qualification. The existing Windows CI job can execute the updated harness with its installed C++ toolchain.

Local formatting, lint, typecheck and all 35 unit/tooling tests passed. `npm run release:check` exited 1 as expected, listing missing qualification evidence and approvals. No release-manifest approval was changed to make that check pass.
