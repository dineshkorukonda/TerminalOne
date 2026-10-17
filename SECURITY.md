# Security policy

This repository is pre-release. There is no published desktop release or supported-version commitment yet. Development/CI results do not establish installer, code-signing, update-channel, or Windows compatibility guarantees.

## Reporting a vulnerability

If GitHub offers **Security → Advisories → Report a vulnerability** for this repository, use that private reporting flow. Its availability was not confirmed in this change. If unavailable, use an existing private communication channel with the repository owner; do not publish exploit details, secrets, credentials, command history, or private terminal output in a public issue. This repository does not currently publish a dedicated security email or response-time commitment.

Provide the affected commit/version, OS/build/architecture, reproduction steps, impact, and sanitized evidence. Coordinate disclosure privately. Ordinary non-sensitive defects can use the bug form.

## Current boundaries and limitations

The renderer is sandboxed and isolated from Node. The preload exposes only app information and an exact allowlisted documentation URL. Main validates window/frame/document identity and complete arguments, denies renderer navigation/popups/permissions, and applies a strict built-content CSP. See [IPC security](docs/ipc-security.md) for details and test scope.

Never add arbitrary shell execution, generic IPC, filesystem primitives, raw events, or unvalidated external URLs to the bridge. New capabilities need schema checks, sender authorization, and negative tests. Do not persist credentials or terminal transcripts by default.

A complete security audit is tracked in #44; packaged runtime fuses, installer behavior, signing, and update verification belong to later issues. Playwright's Electron automation disables the OS sandbox and uses debugger flags, so those tests must not be represented as packaged security verification.
