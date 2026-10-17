# Terminal One

Windows terminal application under development. The desktop currently opens a small React application window; shell sessions and terminal interaction are planned work.

## Desktop development

Install Node.js **24.21.0 LTS** with npm **11.19.0**. The exact Node version is recorded in `.node-version`; `.npmrc` rejects unsupported Node versions. Git and internet access to npm and Electron's GitHub release downloads are required.

From the repository root in PowerShell:

```powershell
npm ci
npm run dev
```

`dev` downloads the pinned Electron binary if needed, builds main/preload, serves the React renderer on `127.0.0.1:5173`, and opens the desktop window. Keep that port free. Close the window or press Ctrl+C to stop development.

To check and launch the production bundle:

```powershell
npm run typecheck
npm run lint
npm run format:check
npm run test:unit
npm run build
npm start
```

Build output is written to `out/`. This is a development bundle, not an installer. The renderer has no Node globals; the window enables context isolation and sandboxing. The preload exposes only typed app-information and allowlisted external-link capabilities; see [IPC security](docs/ipc-security.md). Development permits React Refresh's inline script and Vite's local HMR connection; the built HTML uses the stricter production content security policy.

## Verification

```powershell
npm run test:smoke
npm audit --audit-level=moderate
```

The smoke suite installs Electron if needed, builds the application, and launches both the production renderer and the Vite development renderer in Electron. It checks visible React content, native window visibility, and absence of `require`, `process`, and `Buffer` in the page. Each launch uses a temporary profile that is cleaned up after the test. Screenshots and failure traces are saved under `test-results/`.

Run desktop checks in an interactive Windows session. Linux automation needs the Electron system libraries and a display server (for example, `xvfb-run -a npm run test:smoke` on a suitably provisioned machine). Playwright's Electron launcher disables the Chromium sandbox for automation, so passing these tests does not verify OS sandbox enforcement. See [bootstrap verification](docs/bootstrap-verification.md) for actual results and remaining Windows checks.

## Source layout and roadmap

- `src/main/`: composition root, asset selection, and Electron application lifecycle.
- `src/infrastructure/window/`: Electron window creation and configuration.
- `src/preload/`: sandbox-compatible typed capability bridge.
- `src/contracts/`: framework-free transport types and channel constants.
- `src/renderer/`: React renderer with a separate DOM-only TypeScript configuration.
- `tests/`: Electron launch smoke tests.
- `website/`: independent marketing website; follow its [README](website/README.md) and run its npm commands from that directory.

The [architecture decision](docs/architecture/0001-dependency-direction.md) defines import direction and feature ownership. `lint:boundaries` checks production source; `test:architecture` verifies allowed and forbidden imports using temporary fixtures. Run the architecture test before typechecking or building, rather than concurrently with them. Domain and application directories are reserved for future core behavior and are not created as placeholders.

Desktop work starts with [Phase 0: Repository Foundation](https://github.com/dineshkorukonda/TerminalOne/milestone/1), followed by the native terminal engine, terminal UI, shell adapter, developer experience, and production readiness. Track dependencies and acceptance criteria in [GitHub issues](https://github.com/dineshkorukonda/TerminalOne/issues). The current desktop provides the bootstrap and architecture foundation from #1 and #2. Typed IPC is described in the security document; quality checks are available below; CI and theme tokens have their own issues. The Windows Server CI runner has passed the desktop checks; Windows 10/11 manual compatibility remains unverified, and no installer or release is available.

## Code quality

`npm run lint` checks desktop source, tests, and tooling with flat ESLint and TypeScript recommended rules, including dependency boundaries. `npm run lint:fix` applies safe fixes. `npm run format` and `npm run format:check` use Prettier. Generated output, dependencies, lockfiles, and the separate website toolchain are excluded as appropriate. TypeScript strict mode remains enabled for both runtime configurations. Explicit `any` is rejected; any necessary exception requires a narrow ESLint suppression with a written justification and reviewer approval. `npm run test:unit` verifies that real lint/type violations fail and removes its fixtures.

## Local Git checks

`npm ci` runs Husky's prepare script in a normal Git clone. The pre-commit hook runs `npm run staged` (ESLint and Prettier checks on staged desktop files); commit-msg runs commitlint. Git for Windows provides the hook shell; all task commands use Node/npm and also run from PowerShell. Website files retain their own quality commands.

Use a conventional header, a body explaining why (at least 20 characters), and an issue reference such as `Refs #5`. Empty bodies, missing issue references, invalid headers, and emoji are rejected. Configure the optional editor template with `git config commit.template .gitmessage`. PR titles use the same header rules via `npm run check:pr-title` with the `PR_TITLE` environment variable, without requiring a body.

`npm run test:unit` exercises valid/invalid commit messages and lint-staged against a temporary alternate Git index, preserving the real staging area. Hooks are a convenience and do not replace CI. In CI set `HUSKY=0` and run the full checks explicitly. In a linked worktree, hook installation changes shared Git configuration; run prepare with `HUSKY=0` if another checkout owns the hook configuration, then run the checks explicitly.

## Desktop CI

The Desktop workflow runs on Windows for PRs targeting `main` and issue branches used by the review stack, on pushes to `main`, and on manual dispatch. It installs the locked dependencies using `.node-version`, validates PR titles, and runs formatting, lint, typecheck, unit/tooling tests, the production build and Electron smoke tests, and a dependency audit. Failures propagate; tests are never replaced by success-on-skip scripts. The only event-specific omission is PR-title validation outside PR events. Hook installation is disabled in CI because the complete checks run directly.

Actions are pinned to immutable commits and the GitHub token has read-only repository contents access. The workflow uploads launch screenshots and failure traces for seven days. It does not package, sign, publish, or deploy desktop releases. Required-check settings must be configured by the repository owner; a workflow file alone does not enable branch protection.

## Contributing and security

Follow [CONTRIBUTING.md](CONTRIBUTING.md) for beginner-friendly Windows setup, the complete check sequence, issue branches/commit bodies, review gates, and owner-managed repository settings. [AGENTS.md](AGENTS.md) records persistent engineering rules. See [SECURITY.md](SECURITY.md) for reporting without exposing sensitive terminal data and [CHANGELOG.md](CHANGELOG.md) for delivered changes and release limitations. The project retains the [MIT license](LICENSE).

## Theme foundation

The renderer consumes shared Tailwind surface, typography, focus, border, and ANSI tokens. Its font sample uses a validated typed font configuration; the foundation view does not open shell sessions. See [theme tokens, contrast, focus, and scale limits](docs/theme-foundation.md). Electron component checks retain screenshots at 100%, 150%, and 200% renderer scale for both built and development content.
