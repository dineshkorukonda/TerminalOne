# Terminal One

Windows terminal application under development. The desktop runs native Windows shell sessions in xterm, with shell selection, ANSI/Unicode output, raw keyboard input, Ctrl+C, and window fitting.

## Desktop development

Install Node.js **24.21.0 LTS** with npm **11.19.0**. The exact Node version is recorded in `.node-version`; `.npmrc` rejects unsupported Node versions. Git and internet access to npm and Electron's GitHub release downloads are required.

From the repository root in PowerShell:

```powershell
npm ci
npm run native:build
npm run dev
```

`native:build` requires Visual Studio Build Tools with Desktop development with C++, the Windows SDK, and .NET Framework 4.x tooling on the development machine. It rebuilds pinned node-pty for Electron and compiles the small Windows Job Object helper. Run it again after installing dependencies or changing Electron. Distributed diagnostic builds already contain these components and require no compiler.

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

Build output is written to `out/`. This is a development bundle, not an installer. The renderer has no Node globals; the window enables context isolation and sandboxing. The preload exposes typed app-information, allowlisted external links, and owner-scoped terminal capabilities; see [IPC security](docs/ipc-security.md). Development permits React Refresh's inline script and Vite's local HMR connection; the built HTML uses the stricter production content security policy.

## Verification

```powershell
npm run test:smoke
npm run test:native
npm run test:packaged
npm audit --audit-level=moderate
```

The smoke suite installs Electron if needed, builds the application, and launches both the production renderer and the Vite development renderer in Electron. It checks visible React content, native window visibility, and absence of `require`, `process`, and `Buffer` in the page. Each launch uses a temporary profile that is cleaned up after the test. Screenshots and failure traces are saved under `test-results/`.

Run native checks in an interactive Windows session with ConPTY (Windows 10 build 18309 or later). `test:native` exercises real Electron utility sessions repeatedly and tests renderer/window/app cleanup. `test:packaged` creates an unsigned ASAR diagnostic under `artifacts/native-probe/` and runs the same native suite; it is not an installer or release. See [Phase 1 verification](docs/phase-1-verification.md) for scope, commands, and evidence. Linux shows an unsupported-platform message and cannot run native integration. Linux automation needs the Electron system libraries and a display server (for example, `xvfb-run -a npm run test:smoke` on a suitably provisioned machine). Playwright's Electron launcher disables the Chromium sandbox for automation, so passing these tests does not verify OS sandbox enforcement. See [bootstrap verification](docs/bootstrap-verification.md) for actual results and remaining Windows checks.

## Terminal workspace

Phase 2 adds independent tabs, horizontal/vertical splits, live appearance settings, a command palette, and per-pane search/copy/paste. Use Ctrl+Shift+P for application actions; plain Ctrl+C stays with the shell. Tabs remain alive while inactive. Four total views are supported; closing a pane releases its session. See [Phase 2 verification](docs/phase-2-verification.md) for shortcuts, limits, DPI coverage and exact checks.

## Source layout and roadmap

- `src/main/`: composition root, asset selection, and Electron application lifecycle.
- `src/domain/terminal/`: platform-free PTY port and input/grid rules.
- `src/application/terminal/`: owner-scoped session state and lifecycle.
- `src/infrastructure/pty/`: Electron utility adapter and bounded native stream.
- `native/`: Windows Job Object helper source, compiled during native build.
- `src/infrastructure/shells/`: executable discovery with explicit argument arrays.
- `src/infrastructure/window/`: Electron window creation and configuration.
- `src/preload/`: sandbox-compatible typed capability bridge.
- `src/contracts/`: framework-free transport types and channel constants.
- `src/renderer/`: React renderer with a separate DOM-only TypeScript configuration.
- `tests/`: Electron launch smoke tests.
- `website/`: independent marketing website; follow its [README](website/README.md) and run its npm commands from that directory.

The [architecture decision](docs/architecture/0001-dependency-direction.md) defines import direction and feature ownership. `lint:boundaries` checks production source; `test:architecture` verifies allowed and forbidden imports using temporary fixtures. Run the architecture test before typechecking or building, rather than concurrently with them. Domain and application code stays platform-free; native and transport details remain in infrastructure.

Desktop work starts with [Phase 0: Repository Foundation](https://github.com/dineshkorukonda/TerminalOne/milestone/1), followed by the native terminal engine, terminal UI, shell adapter, developer experience, and production readiness. Track dependencies and acceptance criteria in [GitHub issues](https://github.com/dineshkorukonda/TerminalOne/issues). Phase 0 provides the repository foundation; Phase 1 adds the native terminal engine (#10–#16). Tabs, splits, appearance, search and application actions are implemented in Phase 2. Persistent settings, shell integration, installers, signing and production qualification remain later roadmap work. The Windows Server CI runner has passed the desktop checks; Windows 10/11 manual compatibility remains unverified, and no installer or release is available.

## Code quality

`npm run lint` checks desktop source, tests, and tooling with flat ESLint and TypeScript recommended rules, including dependency boundaries. `npm run lint:fix` applies safe fixes. `npm run format` and `npm run format:check` use Prettier. Generated output, dependencies, lockfiles, and the separate website toolchain are excluded as appropriate. TypeScript strict mode remains enabled for both runtime configurations. Explicit `any` is rejected; any necessary exception requires a narrow ESLint suppression with a written justification and reviewer approval. `npm run test:unit` verifies that real lint/type violations fail and removes its fixtures.

## Local Git checks

`npm ci` runs Husky's prepare script in a normal Git clone. The pre-commit hook runs `npm run staged` (ESLint and Prettier checks on staged desktop files); commit-msg runs commitlint. Git for Windows provides the hook shell; all task commands use Node/npm and also run from PowerShell. Website files retain their own quality commands.

Use a conventional header, a body explaining why (at least 20 characters), and an issue reference such as `Refs #5`. Empty bodies, missing issue references, invalid headers, and emoji are rejected. Configure the optional editor template with `git config commit.template .gitmessage`. PR titles use the same header rules via `npm run check:pr-title` with the `PR_TITLE` environment variable, without requiring a body.

`npm run test:unit` exercises valid/invalid commit messages and lint-staged against a temporary alternate Git index, preserving the real staging area. Hooks are a convenience and do not replace CI. In CI set `HUSKY=0` and run the full checks explicitly. In a linked worktree, hook installation changes shared Git configuration; run prepare with `HUSKY=0` if another checkout owns the hook configuration, then run the checks explicitly.

## Desktop CI

The Desktop workflow runs on Windows for PRs targeting `main` and issue branches used by the review stack, on pushes to `main`, and on manual dispatch. It installs the locked dependencies using `.node-version`, validates PR titles, and runs formatting, lint, typecheck, unit/tooling tests, the native Electron rebuild, production build, Electron smoke tests, native/session cleanup integration, ASAR diagnostic checks, and a dependency audit. Failures propagate; tests are never replaced by success-on-skip scripts. The only event-specific omission is PR-title validation outside PR events. Hook installation is disabled in CI because the complete checks run directly.

Actions are pinned to immutable commits and the GitHub token has read-only repository contents access. The workflow uploads launch screenshots and failure traces for seven days. It packages an unsigned native diagnostic solely for verification; it does not sign, publish, or deploy desktop releases. Required-check settings must be configured by the repository owner; a workflow file alone does not enable branch protection.

## Contributing and security

Follow [CONTRIBUTING.md](CONTRIBUTING.md) for beginner-friendly Windows setup, the complete check sequence, issue branches/commit bodies, review gates, and owner-managed repository settings. [AGENTS.md](AGENTS.md) records persistent engineering rules. See [SECURITY.md](SECURITY.md) for reporting without exposing sensitive terminal data and [CHANGELOG.md](CHANGELOG.md) for delivered changes and release limitations. The project retains the [MIT license](LICENSE).

## Theme foundation

The renderer consumes shared Tailwind surface, typography, focus, border, and ANSI tokens. The xterm renderer uses the validated font configuration and all 16 ANSI colors from these tokens. See [theme tokens, contrast, focus, and scale limits](docs/theme-foundation.md). Electron component checks retain screenshots at 100%, 150%, and 200% renderer scale for both built and development content.

The [Phase 0 verification record](docs/phase-0-verification.md) maps all nine issues to delivered scope and links actual Windows runs and retained screenshots. Owner-managed merge/settings gates and later compatibility/security work remain explicit.
