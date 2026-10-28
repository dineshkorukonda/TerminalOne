# Terminal session recovery

Use **Stop session** in Terminal options to stop the owned process while retaining its pane and output. **Close active pane**, the pane close button, and tab closure remove terminal views and stop their processes.

Exited, failed and stopped sessions offer **Restart session** in their pane. Restart waits for the previous owned session to close, then creates a fresh session with the same detected shell, saved launch project and privacy option. It retains the terminal buffer, marks the restart boundary and focuses terminal input. It does not restore shell variables, jobs or the shell's live working directory. A failed startup can be retried; existing output stays visible. If cleanup fails, restart reports the failure instead of allocating another process.

Closing terminal search with Escape, its close button or the search shortcut clears match decorations, selection and result messages, then returns focus to terminal input.

## Verification

`tests/e2e/recovery.spec.ts` exercises repeated exits, session errors, stop/restart, failed-start retry, terminal buffer and DOM identity, sibling isolation, listener/session cleanup and search close paths through the controlled Electron UI fixture. `tests/windows/terminal.windows.ts` exercises restart after a real PowerShell exit. These checks do not establish packaged installer behavior, physical keyboard/IME compatibility or manual Windows client qualification.
