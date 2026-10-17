# Terminal One Marketing Website Implementation Plan

> For agentic workers: use superpowers:executing-plans for this approved issue. Steps use checkbox syntax. Obtain a separate code review with superpowers:requesting-code-review.

**Goal:** Deliver a polished, accessible, independently built Terminal One marketing website for issue #49.

**Architecture:** Astro generates static semantic HTML. Small typed browser scripts enhance shell tabs and mobile navigation; CSS owns layout and motion. Desktop code is outside this package.

**Tech Stack:** Astro, TypeScript, Lucide SVG icons, self-hosted fonts, ESLint, Prettier, Playwright and axe.

**Spec:** design.md

## Global constraints

- All website application files and tooling stay in website.
- Do not alter existing root files, desktop dependencies, Electron or node-pty configuration.
- Only a new path-filtered website CI workflow may live outside website.
- No emoji, invented release downloads, fake product claims, public deployment or automatic merge.
- Use Node 24 LTS, npm and a committed website/package-lock.json.
- Shell adaptation is planned; the terminal visual is explicitly a concept preview.

## Task 1: Independent package and regression tests

Files: package.json, package-lock.json, astro.config.mjs, tsconfig.json, eslint.config.js, .prettierrc.json, playwright.config.ts, tests/website.spec.ts, src/pages/index.astro.

Consumes: baseline.md and design.md. Produces: an independently installable Astro site and executable browser checks.

- [ ] Add package/tool configurations and a minimal index page containing only a titled page.
- [ ] Install dependencies and the Playwright Chromium browser.
- [ ] Write behavior tests before the functional UI. Shell selection example:

    await page.getByRole('tab', { name: 'CMD', exact: true }).click();
    await expect(page.getByRole('tabpanel')).toContainText('Microsoft Windows');

- [ ] Verify tests fail because required controls and content are missing.
- [ ] Include tests for arrow-key tab selection, mobile menu navigation, no horizontal overflow, semantic links, explicit planned claims, reduced motion and accessibility.

## Task 2: Branded landing page and accessible enhancements

Files: src/layouts/SiteLayout.astro, src/components/SiteHeader.astro, src/components/TerminalPreview.astro, src/components/ProductSections.astro, src/components/SiteFooter.astro, src/styles/global.css, src/pages/index.astro, public/favicon.svg, public/social-card.svg.

Consumes: semantic behavior specified by the tests. Produces: complete responsive landing page and narrow browser enhancement scripts.

- [ ] Create the static layout with local fonts, favicon, title/description and social metadata.
- [ ] Implement header, hero, three-shell preview, product direction, planned adapter, linked roadmap, FAQs and footer.
- [ ] Enhance native buttons with tablist selection: set aria-selected, update tabindex and show exactly the matching tabpanel; arrow keys wrap and Home/End select the first/last shell.
- [ ] Enhance the mobile menu with aria-expanded, navigation close and Escape focus restoration.
- [ ] Style responsive typography, terminal surfaces, restrained interactions and reduced motion.
- [ ] Run the tests to verify behaviors pass, then inspect desktop and mobile browser screenshots.
- [ ] Fix any observed layout, accessibility or behavior defects.

## Task 3: Documentation, automated quality and review

Files: README.md, docs/verification.md, ../.github/workflows/website.yml.

Consumes: actual command output and implemented website behavior. Produces: accurate setup documentation, isolated website CI and review-ready PR.

- [ ] Document PowerShell startup: Set-Location website; npm ci; npm run dev.
- [ ] Run npm run format:check, npm run lint, npm run typecheck, npm test, npm run build and npm audit.
- [ ] Add path-filtered CI using the same commands, npm cache and Chromium browser installation. No publishing.
- [ ] Compare changed files against origin/main and verify existing root files are untouched.
- [ ] Request a code review; resolve critical and important findings and rerun affected checks.
- [ ] Commit with a meaningful Conventional Commit body and Refs #49.
- [ ] Push the feature branch, create a PR with Closes #49, register it with T3 Code and verify available CI.
- [ ] Leave the PR open for owner review; never merge automatically.

