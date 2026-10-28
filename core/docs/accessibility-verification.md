# Accessibility verification

The reports below are historical evidence for their recorded builds. [Current UI qualification (#89)](current-ui-qualification.md) records the current manual-evidence gap and distinguishes it from closed historical issues.

The subsequent main-branch Windows Server run also recorded zero automated violations in all seven scenes, with incomplete contrast checks in six. See [Phase 5 verification](phase-5-verification.md) for the preserved reports and exact source/run provenance. Manual Narrator and client-Windows qualification remain outstanding.

Issue #46 adds automated WCAG 2 A/AA and 2.1 AA checks using axe and actual keyboard workflows in the Electron renderer. Checks cover terminal chrome, command palette, search and appearance, plus existing tab/split/clipboard/focus and 100/125/150/200% scale cases. Contrast tokens have focused numeric checks in the unit suite.

Electron does not implement Target.createTarget; axe uses its existing-page legacy mode. The app denies embedded frames, so this covers its document. Violations and incomplete checks are retained separately in JSON. Incomplete results and zero automated violations are not a manual accessibility pass. The audit found close buttons inside an ARIA tablist; the close control now sits outside the list so the list owns tabs only.

Linux verification reports no automated violations across workspace, palette, search, appearance, developer settings, history/draft and empty-workspace scenes after integrating Phase 4. Axe reports color-contrast as an incomplete serious check; rendered contrast still needs manual verification. Separate numeric token checks measured ink/canvas 16.57:1, muted/panel 7.67:1, focus/canvas 11.11:1 and control-border/elevated 3.20:1. These token ratios do not establish contrast for every rendered state. Keyboard tests also caught and fixed palette focus landing outside its filter input when opening the modal.

The installed-app test uses Windows UI Automation to find the terminal and verify actual interaction. It does not run Narrator speech or establish screen-reader usability. xterm screen-reader mode is enabled, but manual Narrator testing is still required on the actual packaged Windows artifact. Record exact Narrator/OS versions, keyboard/focus outcomes, reading order and limitations as described in release-readiness.md. Physical IME and actual multi-monitor transitions remain unverified until executed.

Do not close current issue #89 using automated axe results alone. Historical #46 closure does not establish the required Windows Narrator/manual keyboard evidence.
