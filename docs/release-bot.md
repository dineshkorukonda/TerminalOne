# Automatic alpha release bot

`github-actions[bot]` builds and publishes a versioned unsigned Windows x64 alpha
for each push to main, including merged PRs. It uses the repository's built-in
`GITHUB_TOKEN`; no separate GitHub App, personal token, external bot or paid
service is required. The owner authorized this alpha channel in #71. This repair
is tracked in #76. Stable/beta promotion and signing retain their separate gates.

## Pipeline

The `Alpha release bot` workflow checks formatting, lint, types and unit tests,
prepares the native runtime, assigns `package.json` and its lockfile the build-only
version `0.2.0-alpha.N`, and runs all existing smoke, native, shell, packaged,
installed-app, performance and dependency-audit checks. N is the workflow run
number, so an Actions rerun keeps the original version. Independent main updates
are not cancelled or coalesced. No version commit is pushed back to main.

Preparation verifies the checksum-pinned ble.sh archive and all required shell
resources before packaging, including `blesh/licenses/LICENSE.md` and its
contributed license. The previous failed run
[39201804245](https://github.com/dineshkorukonda/TerminalOne/actions/runs/39201804245)
looked under `blesh/doc/LICENSE.md`, which does not exist in that archive.
The license stays in its upstream location and ships with the editor.

The release bundle contains exactly:

- `TerminalOne-VERSION-unsigned-x64.exe`
- `SHA256SUMS.txt`
- `release-manifest.json`, binding version, exact source commit and installer hash
- `alpha-notes.md`, including actual conventional history and qualification limits
- `alpha.yml`, binding the updater's installer URL, SHA-512 and size to those exact bytes

Preparation requires build and successful installed-app evidence for that exact
installer hash. It copies only those five files into a separate artifact; unpacked
executables and test traces cannot become release assets accidentally. The Windows
PR workflow performs the same preparation as a dry run without publishing.

Only the final Ubuntu job receives `contents: write`. It validates the downloaded
bundle, rejects an existing tag/source/channel collision, creates or resumes a
draft, uploads the allowlisted assets and downloads them again to verify their
bytes and metadata. It publishes only after that verification, always as a
prerelease with `latest=false`. Failed checks never reach the publishing job;
failed uploads or verification leave the release as a draft.

A retry verifies a completed release's original manifest and checksums and leaves
its assets intact. NSIS rebuild timestamps may change bytes, so a full build rerun
does not replace already published installers. Draft retries may replace partial
uploads before verification. Unexpected draft assets fail verification and require
inspection rather than silently becoming public.

The publishing job runs in the same workflow after the build. It does not depend
on a bot-created tag triggering another workflow, which GitHub's default workflow
token does not normally do. Feature branches and pull requests cannot publish.

## Recovery

Open Actions → **Alpha release bot**. For an interrupted job, use **Re-run failed
jobs** on the original run to reuse the build version and, when the build already
succeeded, its preserved artifact. Artifacts expire after GitHub's configured
retention period; if unavailable, rebuild the run or start a new one.

For a new run, choose **Run workflow**, select **main**, and leave **publish**
unselected for a full build/validation dry run. Select **publish** to publish a
new validated alpha automatically. The CLI equivalent is:

```sh
gh workflow run alpha-release.yml --ref main -f publish=false
# When a new alpha is intended:
gh workflow run alpha-release.yml --ref main -f publish=true
```

A rerun executes the workflow/code from that original run. A source fix therefore
needs to land on main before starting a fresh run; repeatedly rerunning the old
missing-license build cannot incorporate the fix. Both automatic and manual runs
keep every validation suite enabled. The job summary identifies the exact source,
version and whether publication occurred.

## Upstream references and scope

Reviewed on 2026-10-20:

- [T3 Code release workflow](https://github.com/pingdotgg/t3code/blob/main/.github/workflows/release.yml)
  separates release metadata, checks, platform builds and publication, and uses
  the workflow token for GitHub Release creation. Terminal One adopts the staged
  dependency ordering and explicit source/channel identity without copying its
  multi-platform deployment or Release App requirements.
- [Zed release workflow](https://github.com/zed-industries/zed/blob/main/.github/workflows/release.yml)
  separates draft creation, asset upload/validation and publication. Terminal One
  uses the same complete-assets-before-publication principle.
- [Release Please token documentation](https://github.com/googleapis/release-please-action#other-actions-on-release-please-prs)
  explains why resources created with `GITHUB_TOKEN` do not normally trigger more
  Actions runs. A release PR/version bot is useful for stable releases, but would
  introduce additional configuration for the requested every-merge alpha channel.

This workflow publishes experimental unsigned alpha artifacts. It does not prove
manual Windows 10/11, Narrator or IME qualification, sign installers, approve a
stable/beta release or change repository visibility. In-app update behavior is
documented separately in [Windows updates](updates.md). The strict
qualification manifest remains unchanged for those later decisions.
