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
