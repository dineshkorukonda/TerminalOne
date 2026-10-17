## Problem and resulting behavior

Describe the problem, what changes for the user, and any limitations. Keep this PR scoped to the linked issue.

## Linked issue

Closes #<issue-number>

## Implementation

Explain the relevant design choices, architecture boundaries, and security or compatibility implications.

## Verification

List the exact commands or manual checks actually run and their results. Include the OS/build and architecture for Windows checks, and attach screenshots for visual changes. Explicitly list checks that remain unrun; do not claim success for skipped checks.

## Review checklist

- [ ] The PR title follows Conventional Commits (for example, `feat(terminal): add shell discovery`).
- [ ] The branch identifies the issue (bootstrap exception: `feat/project-bootstrap`).
- [ ] Commits have meaningful Conventional Commit bodies explaining why and referencing the issue (`Refs #<issue-number>`).
- [ ] Changes address only the linked issue and respect architecture boundaries.
- [ ] Relevant checks were run and their actual results are recorded above.
- [ ] Documentation describes delivered behavior and known limitations.
- [ ] User-facing text, documentation, and commit messages contain no emoji.
- [ ] No secrets or private terminal output are included.

Merge only after required checks and reviews pass and the owner authorizes the merge. Release publishing and repository visibility changes require separate owner approval.
