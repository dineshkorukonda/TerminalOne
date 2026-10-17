# Phase 4: developer experience

Issues #33–#39 are implemented in one phase PR against main. The core terminal remains usable offline with history, saved-layout offers and local explanations disabled by default.

## Delivered behavior

- #33: opt-in complete-command history for new Windows PowerShell/PowerShell 7 sessions through PSReadLine's AddToHistoryHandler. Capture does not interpret raw input or scrape displayed output. Retention is 50–1,000 records with a 262,144-character aggregate bound, coalesced serialized writes, search and clear. Disable removes app records. Private PowerShell sessions disable native PSReadLine file saving, never reach the history sink, and reject input until the no-save integration is ready. Integration failure exits the private session.
- #34: explicit same-shell history suggestions in a command draft, with acceptance, dismissal, stale-request cancellation and exact quoting/text preservation. Copying a draft does not submit it to a PTY or execute it. CMD/Git Bash and interactive programs retain native input and completion.
- #35: named local project folders selected through a scoped OS dialog, detected default shells and validated normal Windows/UNC paths. The folder must exist at session creation; unavailable folders/shells produce errors. No environment is stored.
- #36: save a non-private launch layout and offer restoration at next launch. Restoring is explicit and creates fresh processes. It restores launch folders and split/tab geometry, not later cd changes, live processes, environment, output or commands. Tabs containing a private pane are excluded. Missing projects/directories fail safely.
- #37: validated distinct Ctrl+Shift+letter application bindings, live application across mounted terminals, collision reporting and default reset. Plain Ctrl+C, Tab and OS/shell combinations remain outside the configurable map. Dialog/text-input flows preserve their own editing behavior.
- #38: version 1 bounded settings JSON with atomic local storage, corruption preservation until explicit reset, controlled import/export dialogs and validation before mutation. Unsupported versions are rejected. Export contains appearance, shortcuts, project folder paths and saved launch metadata; it excludes history, environment, output and process identifiers. No older settings format existed to migrate.
- #39: opt-in offline static command references for a small documented command set. No model or cloud provider is installed, no content leaves the device, and the explanation capability has no execution path. It rejects requests when disabled. Provider integration would require a separately reviewed implementation and per-submission consent. Phase 5 reviews this boundary before beta qualification.

## Checks and evidence

Run the repository quality checks, `npm run test:smoke`, and on Windows `npm run native:build`, `npm run test:native`, `npm run test:shells`, and `npm run test:packaged`.

Local Linux: all 32 unit/tooling tests, all 14 Electron smoke checks, formatting, lint and strict build/typecheck passed. Focused tests cover version/path/layout/shortcut validation, corrupt-file preservation, settings round trips, disabled/private history policy, split metadata frames, Unicode/multiline frame payloads, launch snapshots and private-tab exclusion. Electron checks cover real settings persistence across restart, scoped import/export with controlled dialogs, invalid/disabled capability rejection, collision feedback, changed shortcuts, draft-only suggestions, exact copied text, project selection and layout saving. Existing workspace scaling/focus/search/clipboard cases continue to pass.

Windows verification is incomplete. Run `39061326615` passed all 14 smoke checks, the utility probe and 16 of 18 repeated native checks, including both complete-command/private-isolation cases. Both restoration cases created fresh sessions in the correct project but compared a short DOS path against PowerShell's expanded path; expected paths now use realpath. New native/packaged execution after that correction remains pending. Linux and synthetic UI fixtures are not proof of Windows integration. Do not call the phase Windows-verified until all gates pass.

## Privacy and limits

Opt-in history is plaintext local data. Leading-space commands and common credential terms are excluded, but filtering cannot find every secret: use a private PowerShell tab or disable capture before sensitive work. App retention does not control CMD/Git Bash or other shell-native history files. Private integration currently requires PowerShell and an available PSReadLine module. The hook's same-user metadata is not an execution authorization or a trusted prompt-state producer. No terminal output is logged or persisted by the app.

The offline reference is not semantic parsing, AI inference or a safety assessment. Native completion is not replaced. Restoration records approved launch configuration only and preserves the four-view limit. Arbitrary shell-child interruption, concurrent Git Bash input/resize, manual IME/Narrator, Windows 10/11 qualification, signing and public distribution remain separate evidence or approval requirements. See [decision 0003](architecture/0003-developer-data.md).
