# Changelog

No desktop release has been published. These entries describe implementation changes prepared for review; they do not announce a release or compatibility guarantee.

## Unreleased

- Add a rebuilt node-pty utility host and ASAR native diagnostic (#10).
- Add owner-scoped terminal lifecycle and detected Windows shell profiles (#11, #12).
- Render live ANSI/Unicode sessions in xterm with raw input, Ctrl+C, fitted grids, and bounded stream backpressure (#13, #14).
- Own shell trees with Windows Job Objects and clean up on session, renderer, utility, window, and app exit (#15).
- Add repeated real ConPTY and packaged diagnostic integration checks alongside unit and renderer smoke suites (#16).

- Bootstrap Electron/React with pinned tooling, strict TypeScript, production bundles, and launch smoke tests (#1).
- Add actionable feature/bug forms and a verification-oriented PR template (#7).
- Separate application composition from the window adapter and enforce architecture imports (#2).
- Add a typed, authorized capability bridge, payload/URL validation, and navigation/CSP policy (#3).
- Add lint, formatting, and real failure-detection checks (#4).
- Add staged checks, Conventional Commit body/reference validation, hooks, and a commit template (#5).
- Add a pinned Windows CI workflow with launch artifacts and read-only permissions (#6).
- Document setup, architecture, contribution/review gates, security reporting limitations, and persistent agent instructions (#8).
- Add shared Tailwind theme/ANSI tokens, a validated terminal font model, consistent SVG icons, keyboard focus, and contrast/scale checks (#9).
