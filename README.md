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
npm run build
npm start
```

Build output is written to `out/`. This is a development bundle, not an installer. The renderer has no Node globals; the window enables context isolation and sandboxing. The preload exposes no capabilities yet. Development permits React Refresh's inline script and Vite's local HMR connection; the built HTML uses the stricter production content security policy.

## Verification

```powershell
npm run test:smoke
npm audit --audit-level=moderate
```

The smoke suite installs Electron if needed, builds the application, and launches both the production renderer and the Vite development renderer in Electron. It checks visible React content, native window visibility, and absence of `require`, `process`, and `Buffer` in the page. Each launch uses a temporary profile that is cleaned up after the test. Screenshots and failure traces are saved under `test-results/`.

Run desktop checks in an interactive Windows session. Linux automation needs the Electron system libraries and a display server (for example, `xvfb-run -a npm run test:smoke` on a suitably provisioned machine). Playwright's Electron launcher disables the Chromium sandbox for automation, so passing these tests does not verify OS sandbox enforcement. See [bootstrap verification](docs/bootstrap-verification.md) for actual results and remaining Windows checks.

## Source layout and roadmap

- `src/main/`: Electron application lifecycle and window creation.
- `src/preload/`: sandbox-compatible preload entry point.
- `src/renderer/`: React renderer with a separate DOM-only TypeScript configuration.
- `tests/`: Electron launch smoke tests.
- `website/`: independent marketing website; follow its [README](website/README.md) and run its npm commands from that directory.

Desktop work starts with [Phase 0: Repository Foundation](https://github.com/dineshkorukonda/Terminal/milestone/1), followed by the native terminal engine, terminal UI, shell adapter, developer experience, and production readiness. Track dependencies and acceptance criteria in [GitHub issues](https://github.com/dineshkorukonda/Terminal/issues). This bootstrap implements issue #1 only; architecture enforcement, typed IPC, quality tooling, CI, and theme tokens have their own issues. Windows execution is not yet verified, and no installer or release is available.
