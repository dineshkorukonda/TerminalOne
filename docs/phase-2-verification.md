# Phase 2: terminal UI

Issues #17–#23 are delivered in one phase PR targeting main, with separate issue-linked commits. The native frame remains integrated; terminal content is primary, with compact accessible application controls.

## Delivered behavior

- #17: native window behavior, compact action/tab strip, near-black terminal surfaces, named controls and real terminal startup.
- #18: Zustand presentation store creates, switches and closes independent tabs. Selected shell applies to new sessions. Inactive terminals remain mounted, process output, acknowledge buffers, and retain scrollback. Closing the last tab leaves an empty workspace with New session available. No workspace persistence is included.
- #19: horizontal (right) and vertical (down) split trees, pointer/arrow-key resizing, stable terminal identity through layout changes, deterministic focus target after closure, and sibling preservation. The flat keyed terminal layer is independent of split-tree structure, avoiding remount/restart when splitting or collapsing. Panes have a 240×160 CSS-pixel minimum; the pane viewport scrolls when the tree cannot fit. Split ratios stay within 20–80%. Four total views match the native owner limit and produce an actionable limit message.
- #20: Midnight/high-contrast appearance, whitelisted local font families and bounded 10–32px font sizes. Changes update every mounted terminal and refit the grid. Fonts use system fallbacks; no download or persistence. All 16 ANSI colors map from theme tokens.
- #21: modal application command palette, filtered actions, keyboard navigation, and Escape focus restoration. Actions create/close/switch tabs, split panes, search, or open appearance controls; they do not infer or execute terminal commands.
- #22: per-pane search, previous/next matches, bounded 2,000-line scrollback, selection copy and explicit paste. Named authorized clipboard capabilities accept/return text only, bounded to 262,144 characters. Content is never logged or persisted. xterm handles bracketed paste; the PTY input queue preserves its bytes and normal shell behavior.
- #23: compact responsive controls, scrollable tabs/pane viewport and automated scale/minimum-window checks. Hosted scale tests do not replace manual multi-monitor Windows DPI verification.

## Keyboard controls

| Shortcut                            | Action                                      |
| ----------------------------------- | ------------------------------------------- |
| Ctrl+Shift+P                        | Open/close application commands             |
| Ctrl+Shift+T                        | New tab using selected shell                |
| Ctrl+Shift+W                        | Close active pane (last pane closes tab)    |
| Ctrl+Shift+E / Ctrl+Shift+O         | Split right / down                          |
| Ctrl+Shift+F                        | Search active terminal                      |
| Ctrl+Shift+C / Ctrl+Shift+V         | Copy selection / explicitly paste clipboard |
| Arrow keys on tab strip / separator | Switch tabs / resize split                  |
| Escape in palette / search          | Close and restore terminal focus            |

Plain Ctrl+C remains raw terminal input. Shortcuts are a small application action map, leaving configurable bindings for #37.

## Checks and evidence

Run `npm run native:build` on Windows after installation, then `npm run format:check`, `npm run lint`, `npm run typecheck`, `npm run test:unit`, `npm run test:smoke`, `npm run test:native`, `npm run test:packaged`, and `npm audit --audit-level=moderate`.

Local Linux implementation results: formatting, lint, strict typecheck, build, 21 unit/tooling tests, 12 Electron renderer checks and audit (zero vulnerabilities) passed. Renderer checks include the actual secure production/development bridge and controlled synthetic PTY fixtures for workspace interaction at 100/125/150/200% scale, native minimum window 640×420, stable terminal DOM identity through split/tab changes, search/copy/paste, appearance application and last-tab keyboard closure. A development renderer case also verifies four live views and strict effect replay without duplicate native allocation. The synthetic fixture is confined to tests; it is not a production capability or native-execution claim. The headless display server expired during one run; restarting it resolved the missing-X-server launch failures.

Windows integration additionally exercises real independent tabs, inactive output, isolated environments, split-process cleanup, multiline clipboard paste, search and OS clipboard copy. The inherited native suite verifies real ConPTY/ASAR behavior; its Ctrl+C checks now wait for the observed PowerShell prompt before subsequent input. Windows execution remains pending CI at this revision; it must pass before the phase is considered verified. Screenshots/traces are retained under `test-results/`.

Windows input automation types ASCII keys and sends Unicode through xterm's paste event path. xterm screen-reader mode deliberately ignores input-only `insertText` events, so those are not physical IME coverage. Manual IME entry remains unverified. The main-crash probe retrieves Electron's actual main PID and retains that process handle before force termination; Playwright's Windows process handle belongs to a launcher wrapper.

The Phase 3 native matrix exposed a shared CMD discovery defect: `/q` disabled echo and hid the interactive prompt. CMD now launches with `/d` alone to retain AutoRun protection and show its prompt. The discovery test checks those arguments; actual CMD matrix evidence is tracked in Phase 3.

Windows run `39042102056` passed all four built-workspace scale checks and the seven bootstrap checks, but the development-workspace check found no elements at its initial assertion. The fixture now awaits navigation to the expected renderer URL and DOM loading before checking session state, and reports navigation failures explicitly. The status assertion retains its existing timeout. A Windows rerun is required; native and packaged gates were not reached in that run.

The built CSP still prohibits inline/eval scripts and remote resources. It allows inline styles because xterm's DOM renderer injects trusted dimension/theme stylesheets. This is necessary for real font metrics, ANSI colors and layout; stylesheet values come from validated font config and fixed palette tokens. It does not allow terminal output to become HTML or execute scripts. Existing navigation, sender authorization and Node isolation remain enforced.

## Limits

No settings/workspace persistence, tab reordering, custom shortcut editor, ligature renderer, WSL/SSH, installers, signing, or release changes. Search is bounded by xterm scrollback and uses literal text. The pinned addon uses xterm decoration APIs for match counts/highlights; upgrades require these renderer checks. Native frame/chrome and actual multi-monitor DPI transitions need manual Windows testing. Linux's installed fallback fonts do not cover every CJK glyph, although Unicode input/output and accessible text are preserved; no broad font-coverage guarantee is claimed. Windows Server CI is not Windows 10/11 compatibility qualification. These limitations remain visible in the PR and later roadmap work.
