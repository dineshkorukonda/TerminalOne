# Contributing

The desktop supports native Windows terminal sessions. Installers, signing, updates, and broad compatibility qualification remain future work tracked in GitHub. The MIT license remains in [LICENSE](LICENSE).

## Windows setup

1. Install Git for Windows and Node.js **24.21.0 LTS**, including npm **11.19.0**. Check `git --version`, `node --version`, and `npm --version` in PowerShell. If script execution policy blocks `npm.ps1`, use `npm.cmd` for the same commands; no policy change is required.
2. Clone the repository and open PowerShell in its root. The marketing website is a separate package; do not run desktop commands inside `website/`.
3. Run `npm ci`. In a normal clone this also installs Husky hooks. Electron's binary is downloaded on first launch via the explicit installation command in the npm scripts. Network access to npm and GitHub releases is required.
4. Run `npm run native:build`, then `npm run dev` in an interactive desktop session. Keep port 5173 free. Close the window to stop the app. Run `npm run build` followed by `npm start` to check built content.

Native development requires Visual Studio Build Tools with Desktop development with C++, a Windows SDK, and .NET Framework 4.x tooling; node-gyp may also require Python as documented by the installed build tools. Built diagnostics already include the native components and need no compiler. See [Phase 1 verification](docs/phase-1-verification.md). Do not infer Windows 10/11 compatibility from a hosted Windows CI runner.

## Issue and review workflow

Start with an issue's acceptance criteria and dependencies. Use branches such as `feat/3-secure-ipc`, `chore/4-quality-tooling`, or `docs/8-engineering-guide`; the bootstrap branch is the existing exception. Keep unrelated website work separate. Use one PR per phase targeting main, with separate issue-linked commits for its issues. Do not stack the phase across multiple PRs.

Commit example:

```text
feat(security): validate desktop requests

Authorize each sender and frame before exposing application data.

Refs #3
```

Bodies must explain the change and contain at least 20 characters. Commitlint enforces conventional headers, nonempty meaningful-length bodies, issue references, and no emoji. Human review checks the substance of the body. Configure an optional template with `git config commit.template .gitmessage`. The pre-commit hook runs ESLint/Prettier checks on staged desktop files; format fixes explicitly before retrying. For manual checks run `npm run staged` and `npm run commitlint -- --edit <message-file>`.

PR titles use Conventional Commits and PR descriptions link `Closes #<issue>`, explain resulting behavior, and record verification and limitations. No emoji in UI text, docs, or commit messages. Required checks, required review, resolved conversations, and explicit owner authorization precede merging. A ready PR is not permission to merge, release, sign, publish, or change visibility.

## Architecture and verification

Read [dependency direction](docs/architecture/0001-dependency-direction.md), [IPC security](docs/ipc-security.md), and [AGENTS.md](AGENTS.md). Use small contracts around actual consumers, keep platform adapters outside pure core code, and expose only named, validated capabilities through preload. Avoid placeholder abstractions and explicit `any`; explain any narrow exception in a reviewed suppression.

Run in order:

```powershell
npm run format:check
npm run lint
npm run typecheck
npm run test:unit
npm run test:smoke
npm run test:native
npm run test:packaged
npm audit --audit-level=moderate
```

`npm run format` and `npm run lint:fix` apply fixes. Smoke tests build before launching Electron; no standalone build is necessary for that command. Unit tests exercise invalid schemas, sender authorization, architecture imports, commit policies, and actual quality failures. Temporary fixture files are removed after testing. Do not run fixture tests concurrently with typecheck/build. Tests may emit Node's module-detection warning while importing pure TypeScript policy code; the warning does not replace or skip a test.

Record the actual OS/build/architecture, commands/results, and relevant screenshots. Mark unrun checks explicitly. Playwright adds debugger flags and disables the Chromium sandbox for Electron automation; passing it is not evidence that a packaged binary's fuses or OS sandbox are correct. Windows screenshots and traces are uploaded by Desktop CI for seven days. Manual Windows 10/11, Narrator, installer, and packaged security checks remain separate issues.

In a normal clone `npm ci` installs hooks. In CI use `HUSKY=0` and run the complete checks directly. Linked worktrees share hook configuration: to avoid changing another checkout, set `$env:HUSKY = '0'` in PowerShell for installation, then remove it with `Remove-Item Env:HUSKY` when appropriate. Do not disable hooks to conceal failing checks.

## Required owner-managed repository settings

After the workflows have reported real results, protect `main` with PR review, resolved conversations, and required checks including **Desktop quality (Windows)**; retain applicable website checks for website changes. Require review of new changes and restrict force-push/deletion on protected branches. Workflow files do not configure these settings automatically, and their current enforcement has not been verified by this change.

Keep Actions tokens least-privileged and avoid release/deployment secrets in PR jobs. Enable private vulnerability reporting if available and document any actual reporting channel in [SECURITY.md](SECURITY.md). Release publishing, signing, and repository visibility remain owner decisions. No release or visibility change is part of Phase 0.
