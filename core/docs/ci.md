# Desktop CI

Pull requests run the full Windows quality job when opened, updated with code,
or reopened. Drafts receive the same checks. Description/title edits and marking
a PR ready do not restart Windows qualification. A separate Ubuntu workflow
validates the PR title, including on edits, without running native install scripts.
New commits still cancel obsolete PR builds.

Main updates run the alpha workflow once, including formatting, lint, types,
unit, smoke, native, shell compatibility, packaged security, installed-app,
performance, release notes and dependency audit checks before publishing.
The desktop workflow does not duplicate this main-branch qualification. Its
manual dispatch remains available for diagnostics. No validation suite has been
removed to reduce elapsed time.

All Windows workflows share an exact-match cache of node-pty and the compiled
process-owner helper. Its key includes the dependency lockfile (and thus Electron
ABI), Node version file, native build script, helper source, cache action definition,
runner OS/architecture and hosted image version. There are no fallback restore
keys. Dependencies are installed before restoration; missing keys rebuild normally.
Compiled outputs are checked on both paths, and each workflow retains its runtime
or installed-package validation. Alpha version stamping happens after cache lookup
so a unique release number does not invalidate identical native code. The cache
is saved only after a successful job. Cold/image-update runs still rebuild.

Baseline: successful Desktop run 39153788423 took 11 minutes 16 seconds on
October 18, 2026. Native rebuilding took 1 minute 56 seconds; installer building
took 1 minute 41 seconds. PR metadata events repeatedly cancelled newer runs
before they could finish. These trigger changes remove that wasted work; they
do not claim a measured reduction in the duration of one complete Windows run.
A warm native cache should remove most of the native rebuild time; the actual
cache-hit duration must be measured in GitHub Actions.
