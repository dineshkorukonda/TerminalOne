# Post-fix performance measurements: issue #87

Measured 2026-10-24. This report replaces the statement that all post-retirement measurements are still pending. It preserves historical findings rather than treating them as current results. Raw profiles and hash/provenance records are in [issue-87 evidence](evidence/issue-87/source.json).

## Sources and workload

The existing post-fix [Windows CI run 40064151158](https://github.com/dineshkorukonda/TerminalOne/actions/runs/40064151158) was inspected before collecting additional data. Its actual artifact build source is `9f0c9d4b000fefa821e57e0f8b7c67969743316a`, distinct from PR head `630430c`. It used Windows Server 2025 build 26100, two logical AMD EPYC 7763 CPUs, 7.99 GiB RAM and Electron 44.9.3. It predates the latest workspace UI. The earlier phase-5 attributed profile predates host retirement and remains historical.

Two additional automated local runs used clean source `1d8ca45ef981a581f1bef4d5034058158220850d` on Windows 11 Home Single Language x64 build 26300, Intel Core Ultra 7 255H, 16 logical CPUs, 15.24 GiB RAM and 125% display scaling. Runtime: Electron 44.9.3, embedded Node 24.22.0, ABI 149; tooling Node 24.21.0/npm 11.19.0. `sourceDirty` is false in both retained profiles. This is an instrumented source build, not installed-app or manual client qualification.

Each run records one fresh-profile and two same-profile launches, 1 MiB synthetic output rendered through production xterm/backpressure, a three-pane snapshot and 20 native create/close cycles. The added workload submits commands in one pane while a sibling produces 128 paced 4096-character chunks. Only samples starting before sibling completion are recorded. Timings include command typing, automation and observing the rendered marker; they are not raw physical-key-to-glyph latency. Post-workload memory is sampled at 10, 20, 30 and 40 seconds without forced GC. Existing session/output/scrollback limits remain unchanged.

## Actual results

| Sample      | Fresh profile startup ms | Same-profile median ms | 1 MiB output ms | Sibling input count / median / nearest-rank p95 ms | Cleanup median / max ms | Settled increase over initial Electron working set |
| ----------- | ------------------------ | ---------------------- | --------------- | -------------------------------------------------- | ----------------------- | -------------------------------------------------- |
| Existing CI | 2015.4                   | 937.9                  | 8303.2          | Not measured                                       | 47.9 / 92.8             | 20.07 MiB after 10 seconds                         |
| Local run 1 | 1612.4                   | 1358.2                 | 2259.0          | 6 / 996.7 / 1087.0                                 | 62.2 / 94.0             | 36.25 MiB                                          |
| Local run 2 | 2574.1                   | 2225.6                 | 2212.8          | 5 / 1010.9 / 1491.5                                | 64.4 / 81.0             | 18.34 MiB                                          |

Both new runs completed all 20 cycles with retained-handle process exit and the original live pane's utility-host PID set restored. No sibling was replaced or closed. This supports owned lifecycle cleanup; it does not prove absence of all native/renderer leaks. Electron metrics exclude external shells, helper and conhost processes.

The local same-profile timings vary substantially even on the same machine. The small sample set and uncontrolled background scheduling do not support cross-machine regression claims. The roughly one-second sibling-input observations are a concrete performance concern; changing no-op notifications does not establish that input responsiveness is solved. The output workload includes long wrapped lines, screen-reader rendering and automation, so further tracing must separate these costs before attributing them to PTY input.

Working set declines during the extended idle observations but remains above the initial snapshot. The retained buffers and renderer allocations contribute; working set alone does not identify leaks. Forty seconds is longer than the historical ten-second sample but is not an hours-long soak or allocation trace.

## Focus and split-update investigation

A deterministic baseline on store source `7807ca7` generated 1000 notifications from 1000 calls to focus the already-active pane, and another 1000 from unchanged split ratios. The current store generates zero for both cases while preserving real changes. Structural identity is retained for unchanged roots/tabs. The exact before/after Node measurements are retained; their tiny method timings are not a claim about overall UI speed.

Split pointer updates previously called the store once per delivered event. A frame scheduler now retains the latest ratio per split, flushes the final position on pointer completion/lost capture, and cancels work on unmount. A synchronous synthetic burst of 1000 updates requested one frame and delivered one resize callback. Unit tests cover multiple split IDs, final flush and disposal. This establishes callback coalescing for that workload, not physical mouse frequency, OS event delivery or a frame-rate benchmark. Real hardware pointer traces remain useful follow-up evidence.

The client resize probe exposed two fractional-DPI conversions: requested 800 CSS pixels became native content 801 and renderer viewport 802 at 125% scale. The harness now records requested/native/renderer sizes and checks each conversion within one pixel. It still requires viewport completion; it does not silently accept arbitrary window dimensions.

## Proposed review budgets and remaining limitations

For owner review, preserve zero surviving owned processes as a hard correctness failure and the existing bounded queues/session counts as hard limits. For comparable hardware/builds, investigate over 20% regression in repeated same-profile startup or output medians only after collecting at least five complete runs and examining run-to-run variance. Investigate sibling-input p95 above 1000 ms under this exact paced workload; the observed samples already warrant that investigation. Investigate a settled increase over 64 MiB that repeats across equal workloads and survives a longer observation interval, with per-process/allocation attribution before calling it a leak.

These are proposals, not approved CI/release budgets, and this report does not assert they are all met. The p95 figures have only five or six observations per run and are descriptive maxima at that sample size. Longer soak, ETW/input tracing, total process-tree memory and controlled same-machine repeats remain limitations. No signing decision, release approval, Windows 10 qualification, Narrator, physical IME or monitor transition result is inferred. Issue #89 tracks the separate manual client evidence.

Validation for the implementation: format:check, lint, typecheck, all 63 unit tests, all 27 smoke tests and two completed `npm run test:profile` runs on the local Windows client. Earlier profiling attempts stopped at an incorrect exact/fractional resize assumption before producing complete profiles; they are not counted as successful measurements. Hosted CI must validate this PR head independently.
