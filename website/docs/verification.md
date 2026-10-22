# Website verification

Independent read-only review found no critical or important issues. Both minor findings were addressed: tests always start a fresh production server, and reduced-motion checks assert automatic scrolling and disabled transitions. The affected lint and seven browser tests passed again after these changes.

Verified on 2026-10-17 on Windows with Node 24.19.0 and npm 11.17.0 for issue #49.

- `npm run format:check`: passed.
- `npm run lint`: passed.
- `npm run typecheck`: passed, zero errors, warnings or hints.
- `npm run build`: passed, one static page generated.
- `CI=true npx playwright test --reporter=list`: seven tests passed against a freshly built production site.
- `npm audit --audit-level=moderate`: passed, zero vulnerabilities.
- Workflow Prettier check and `git diff --cached --check`: passed.
- Root README.md and LICENSE match freshly fetched origin/main (37ad17d).
- Only the isolated website workflow is added outside website.

The browser suite covers shell switching and keyboard navigation, mobile navigation, FAQ operation, truthful content, axe accessibility, layouts from 320 to 1440 pixels, runtime/local asset failures and no-JavaScript behavior. Saved desktop and mobile screenshots are in screenshots/ and were visually inspected.

A previous Astro preview daemon blocked the first fresh test startup. Stopping the task's old daemon with `npx astro preview stop` allowed the clean production run to pass. If this happens during local development, stop the existing preview before running the suite.

Desktop builds and tests remain unavailable: origin/main contains only README.md and LICENSE. No desktop verification is claimed. There is no public deployment or installer. Repository links require access while the repository is private; production hosting and absolute social-image URLs require configuration before deployment.

## Published alpha downloads (#91)

Verified on Linux on 2026-10-22 with Node 24.21.0 and npm 11.19.0. The initial report above describes the historical #49 baseline; the desktop and published release state have since changed.

- Website formatting, lint and Astro typecheck passed (zero diagnostics).
- Production build passed; the browser suite rebuilt the production site and passed all seven tests.
- Browser coverage includes exact versioned installer/checksum/notes/release URLs, release size/date, checksum instructions, mobile menu, keyboard shell tabs, FAQ, automated axe checks, 320/390/768/1440-pixel layouts with expanded checksum details, local asset/runtime errors and downloads without JavaScript.
- The existing social-card generator regenerated the PNG after changing the SVG status to Windows x64 alpha. The favicon reuses the desktop T1 icon.
- Website dependency audit found zero vulnerabilities.
- Root formatting, lint, typecheck and unit checks passed; unit results were 55 passed and three platform-specific skips. Root README availability text changed; desktop runtime source did not change, and desktop smoke tests were not rerun for this website phase.
- T3 collaborative browser visual inspection covered the desktop hero/download section and the stacked download layout at 390 pixels.

The featured v0.2.0-alpha.4 installer filename, size and SHA-256 were checked against published GitHub asset metadata, SHA256SUMS.txt and release-manifest.json. The website links the existing release and hosts no installer copy. It makes no claim that later merged commits are in that artifact. Updating the featured release is documented in website/README.md and requires matching the release files together.

These checks are local Linux website evidence. New PR CI, client Windows/manual accessibility qualification, merge, and production deployment remain separate evidence/actions.
