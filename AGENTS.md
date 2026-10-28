# Repository instructions

- Desktop commands run from `core/` with Node 24.21.0 and npm 11.19.0. The independent website has its own instructions and package under `website/`.
- Follow `core/docs/architecture/0001-dependency-direction.md` and `core/docs/ipc-security.md`. Main composes adapters; pure core code must not depend on Electron, React, Node, or transport implementations. Do not create placeholder layers or generic IPC APIs.
- Use one PR per phase targeting main, with separate issue-linked commits and closing references for every delivered issue. Use issue-numbered phase branches. Do not create stacks for a phase; the established bootstrap branch remains an exception.
- Use Conventional Commit headers, a meaningful body explaining why, and `Refs #<issue>`; PRs use `Closes #<issue>`. No emoji in code-facing text, documentation, or commit messages.
- Preserve MIT licensing. Never include credentials or private terminal output.
- Keep TypeScript strict. Avoid explicit `any`; a necessary narrow suppression requires a reason and review.
- Run `npm run format:check`, `npm run lint`, `npm run typecheck`, and `npm run test:unit`. For runtime changes also run `npm run test:smoke`; Linux requires Electron libraries and a display. Run fixture-based checks sequentially, not alongside builds.
- Report only checks actually run. Distinguish Linux, Windows CI, packaged security, and manual compatibility evidence. Inspect relevant PR CI before claiming success; never replace tests with skip-success scripts.
- Do not discard another checkout's edits or staging area. Linked worktrees share Git hook configuration; use `HUSKY=0` when installing dependencies if another checkout owns it and run checks directly.
- Required CI/reviews and explicit owner authorization precede merge. Publishing releases, signing decisions, and visibility changes require separate owner approval.
