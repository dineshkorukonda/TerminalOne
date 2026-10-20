# Bash-first alpha experience

New workspaces prefer installed Git Bash, then PowerShell 7, Windows PowerShell,
and CMD. The options dropdown contains explicit shell overrides, splits, projects,
history and settings. Keyboard shortcuts and the command palette remain available
with the dropdown closed. Hover a pane or focus its buttons to show pane tools.

Git Bash uses an application-owned rc file. It loads Git's system profile and the
user's `.bashrc`, preserves the requested launch directory, then enables a colored
prompt and the bundled BSD-licensed ble.sh editor. Syntax highlighting, Tab
completion and automatic suggestions are on by default. Right arrow accepts a
suggestion at the end of the line. Nothing is installed into the user's dotfiles
and no editor code is downloaded at runtime. Build preparation verifies the pinned
archive checksum; packaging includes its license. Git Bash remains an optional
prerequisite, not a bundled shell. If unavailable, the detected native fallback is
shown honestly by its tab name.

## Automatic command adapters

Bash remains the primary runtime and parses the command line. Its native
command-not-found hook routes missing `Get-ChildItem`, `Get-Location`, `Get-Item`,
`Write-Output` and `Get-Process` commands to an installed PowerShell. Existing Bash
commands, functions and aliases take precedence. Named PowerShell parameters such
as `-Path` are supported; other arguments are escaped as literal PowerShell strings.
Use Bash quoting and expansion, including single quotes for literal dollar signs.
This is argument forwarding, not translation of arbitrary PowerShell scripts.

`dir /b`, `/s`, `/a`, `/o` and `/t` use CMD. Other `dir` forms keep GNU dir behavior.
CMD metacharacters, variable expansion and multiline arguments are rejected in the
adapted form. Use the explicit CMD override for those cases. Both adapters inherit
Bash's current directory and exported environment, return the child exit status,
and stay attached to the existing PTY. The child cannot change Bash's directory,
aliases, functions or environment. Stateful foreign commands, arbitrary scripts,
and unknown commands are not rerouted. Interactive programs continue receiving
raw PTY input; no terminal keystroke reconstruction or new IPC capability exists.

This narrow infrastructure integration extends the Phase 3 behavior described in
`architecture/0002-shell-adapter.md`. Its typed complete-string analyzer remains
conservative; the new hook receives argv already parsed by Bash, rather than
pretending that terminal output is trusted prompt-state evidence.

## Alpha delivery

Every push to main, including each merged PR, runs the alpha release workflow.
Feature branches do not publish. All versions are currently `0.2.0-alpha.N`, with
N taken from that workflow's increasing run number. Rerunning a failed run retains
its version. Version changes apply to the build's package and lockfile, without
creating another commit on main. The tag identifies the source commit; reproduce
its version by running `alpha-version.mjs` with the original `GITHUB_RUN_NUMBER`.

Quality, smoke, native shell, packaged native and installed-app checks run before
publishing. A separate job gets write permission only to upload verified artifacts
and publish the tagged prerelease. It first creates a draft, uploads the unsigned
installer and SHA-256 checksums, then publishes it as a prerelease, never latest.
A completed release is left intact on retries. No tag-triggered workflow chaining
is required. Failed checks produce no public release; rerun after resolving the
failure. Concurrent merges have independent versions and are not cancelled.

See [release bot operations](release-bot.md) for manual dry runs, recovery, exact
asset verification and upstream references.

The owner's request authorizes automated unsigned alpha publication. Stable/beta
promotion, signing and visibility changes retain their separate approval gates.
CI evidence does not claim manual Windows 10/11 or screen-reader qualification.
