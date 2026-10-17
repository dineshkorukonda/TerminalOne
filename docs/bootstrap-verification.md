# Desktop bootstrap verification

Issue: [#1](https://github.com/dineshkorukonda/Terminal/issues/1).

## Checks executed

On 2026-10-17, Ubuntu 24.04 LTS x86_64, Node 24.21.0, npm 11.19.0:

- `npm ci`: passed with the committed lockfile.
- `npm run typecheck`: passed for main/preload/config/tests and the separate DOM-only renderer configuration.
- `npm run build`: passed, producing main, preload, and renderer bundles in `out/`.
- `npm run test:smoke`: passed both built and development renderer launches in Electron 44.9.0. Visible React content and native window visibility passed; page globals `require`, `process`, and `Buffer` were absent.
- `npm audit --audit-level=moderate`: passed, zero reported vulnerabilities.
- Temporary renderer TypeScript fixture using `process`, `require`, and `Buffer`: each name was rejected. The fixture was removed after checking the failure.

This headless environment lacked GTK and a display server. Ubuntu Xvfb and required shared-library packages were extracted under `/tmp/terminal-bootstrap-display`, without system installation. The temporary Xvfb binary's compiler lookup was redirected to an extracted `xkbcomp` under `/tmp/xxx`. The smoke command used `DISPLAY=:91` and `LD_LIBRARY_PATH=/tmp/terminal-bootstrap-display/root/usr/lib/x86_64-linux-gnu`. These environment-specific files are not application dependencies or repository contents. On a provisioned Linux machine, use `xvfb-run -a npm run test:smoke` instead.

Playwright adds debugging flags and `--no-sandbox` when launching Electron. These launch tests demonstrate renderer Node isolation but do not establish OS sandbox enforcement. Normal application startup specifies `sandbox: true`, `contextIsolation: true`, and `nodeIntegration: false`; no test-only flags are added by the application.

## Outstanding Windows verification

No Windows execution occurred in this environment. Issue #1 remains pending Windows evidence; passing Linux checks does not complete its Windows launch requirement.

In an interactive Windows session with the pinned Node/npm versions:

1. Record OS edition, version/build, and architecture.
2. Run `npm ci`, `npm run typecheck`, and `npm run build` from the repository root.
3. Run `npm run dev`. Confirm the React window appears without load errors, then close it and confirm the development process stops.
4. Run `npm start`. Confirm the built window appears and closes cleanly.
5. Run `npm run test:smoke` and record both results. Preserve screenshots from `test-results/`.
6. Record failures and limitations alongside the actual command output in the PR.

Installer creation, Windows 10/11 compatibility qualification, native terminal sessions, and the full security test suite are separate roadmap issues. No installer or release has been produced here.

## References

- [electron-vite getting started](https://electron-vite.org/guide/)
- [Electron sandboxing](https://www.electronjs.org/docs/latest/tutorial/sandbox)
- [Electron 42 binary installation change](https://www.electronjs.org/blog/electron-42-0): use the explicit `install-electron` command before programmatic launch. The npm scripts include this for development, preview, and smoke testing.
