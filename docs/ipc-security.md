# Desktop capability boundary

The sandboxed preload exposes `window.desktop.getAppInfo()` and `window.desktop.openExternal(url)`. It exposes no channel names, generic invoke/send method, IPC events, Node modules, filesystem access, or process control. The only external URL allowed is `https://github.com/dineshkorukonda/TerminalOne`, compared exactly before calling Electron's shell API. The renderer currently has no automatic external navigation.

The main process authorizes every request against the exact window's webContents, its current main frame, and its configured document URL. Other windows, subframes, missing frames, and other documents fail. It then checks the complete argument list and payload before returning data or opening a URL. Closing the window removes its handlers.

`src/contracts/` contains inert capability types and internal channel constants, with no framework imports. Preload, renderer, and infrastructure may depend on these contracts. Domain/application layers do not depend on transport contracts. New capabilities require a typed contract, validation, sender authorization, and negative tests; never expose generic IPC.

Windows enable sandboxing/context isolation and disable Node integration and webviews. All renderer/frame navigation, redirects, popups, and permissions are denied. External links use the allowlisted capability. Packaged windows disable DevTools; packaged startup rejects inspector/remote-debugging switches and `NODE_OPTIONS`. The application never enables debugging on its own. Packaging/fuse verification remains part of #40 and the security audit in #44; development launch tests use Playwright instrumentation and are not proof about a packaged binary.

The built HTML's CSP permits local scripts/styles only, with no inline scripts, eval, remote connections, objects, or form submissions. Vite development uses only `http://127.0.0.1:5173/`, adding the inline React Refresh preamble, inline styles, and local WebSocket needed by HMR.

Run `npm run test:unit` for schemas, authorization, startup flag policy, and architecture checks, then `npm run test:smoke` for the actual bridge, invalid payload rejection, untrusted-window rejection, navigation/popups, CSP, and Node isolation. A startup probe simulates the packaged flag in the real Electron process and verifies debugging options cause immediate exit, rather than an unhandled-error dialog. This is not a packaged distribution/fuse test. Linux tests need a display and Electron system libraries. Windows CI is added separately in #6. No packaged installer, OS sandbox enforcement, or real Windows result is claimed by Linux testing.

References: [Electron security](https://www.electronjs.org/docs/latest/tutorial/security/) and [IPC](https://www.electronjs.org/docs/latest/tutorial/ipc).
