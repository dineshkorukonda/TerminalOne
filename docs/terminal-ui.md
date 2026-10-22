# Terminal workspace appearance

The workspace uses a Windows Terminal-style top tab strip with a new-tab button, compact profile/action toolbar, edge-to-edge resizable panes and a slim workspace footer. Windows retains native minimize/maximize/close controls through Electron's title-bar overlay. Other platforms retain their normal native window frame. Tab navigation, commands, shortcuts, project selection, search, clipboard, history and private sessions retain their existing behavior.

iTerm Night is an iTerm-inspired charcoal palette with muted blue, mint, lavender and warm ANSI colors. It is a custom palette, not an official iTerm preset. Existing saved `midnight` preferences select this appearance without a schema change; high contrast remains available. Icon controls retain accessible names, keyboard focus rings and tooltips. Shell state indicators reflect the existing session state.

To reproduce UI screenshots after building:

```sh
npm run build
node scripts/capture-ui.mjs
```

The screenshot script launches the controlled Electron renderer fixture and writes workspace, split-pane and command-palette PNGs under `artifacts/ui/`. Linux needs the same display and Electron libraries as the smoke suite. All depicted commands/output are synthetic; no PowerShell commands are executed and the previews do not establish Windows compatibility or title-bar behavior. The preview flag and sample output exist only in test/tooling files and are not part of the production application.

Splitting inherits the focused pane's launch shell, saved project and private-session policy together. The new-session shell selector affects newly opened tabs, not splits of an existing pane. Split creation preserves the original pane and its running process; the new pane starts a fresh session in the saved launch folder, not an inferred current working directory.
