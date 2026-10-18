# TerminalOne website

A self-contained marketing website for TerminalOne, an all-in-one terminal designed to select Bash, CMD, or PowerShell based on the command. A Unix-like command-line experience for Windows.

Built with Astro and strict TypeScript. The production output is static HTML, CSS, local fonts and a small amount of JavaScript for shell example tabs and mobile navigation. There is no server, account, analytics or external font service.

## Requirements

- Node.js 24 LTS, version 24.19.0 or later in the 24.x line.
- npm (included with Node).
- GitHub repository access while this repository is private.

## Development on Windows

From the repository root in PowerShell:

```powershell
Set-Location website
npm ci
npm run dev
```

Open the local URL printed by Astro. Stop the server with Ctrl+C.

All dependencies and the npm lockfile belong to this directory. Do not run a workspace migration or change the desktop package to start the website.

## Quality checks

Run from this directory:

```powershell
npm run format:check
npm run lint
npm run typecheck
npx playwright install chromium
npm test
npm run build
npm audit --audit-level=moderate
```

The Playwright suite starts a production build and local preview server automatically. It checks shell tab/keyboard behavior, mobile navigation, the FAQ, truthful calls to action, responsive widths, runtime errors, local assets, accessibility with axe and no-JavaScript behavior. Chromium must be installed before running it. Linux CI also installs Chromium system dependencies with the Playwright installer.

Use npm run format to format files and npm run lint:fix for supported automatic lint fixes.

## Build and preview

```powershell
npm run build
npm run preview
```

The static output is written to dist. No desktop build or installer is produced by this package. The isolated GitHub Actions workflow checks the website on Ubuntu and Windows; it does not publish or deploy.

The hosting provider and production domain are intentionally not configured. Before public deployment, configure Astro's site/base settings for the actual host and replace relative social-image metadata with the approved absolute production URL. Do not invent a domain.

## Editing the site

- src/pages/index.astro: hero and page composition.
- src/components: header, terminal concept preview, product content and footer.
- src/layouts/SiteLayout.astro: metadata, font loading and document shell.
- src/styles/global.css: design tokens, layout and responsive styles.
- public: social preview assets. The brand uses a text-only wordmark with no terminal icon.
- tests/website.spec.ts: production browser checks.
- docs/design.md: architecture, design decisions and content constraints.
- docs/baseline.md: desktop repository baseline and verification limits.

Shell tabs show clean workspace concepts without command output or logs; they do not execute commands. Product copy explains the workspace and intended uses without milestones or phase lists. No installer is currently published. Keep these statements accurate as the desktop product develops.

Regenerate the committed social PNG after editing public/social-card.svg:

```powershell
npm run assets:social
```

This uses the existing Playwright development dependency and the installed Chromium browser. Normal builds use the committed PNG and do not launch a browser to generate assets.

## License

[MIT](../LICENSE). Inter and JetBrains Mono are bundled from their Fontsource packages under the SIL Open Font License; Lucide icons use the ISC license. Dependency licenses remain available in their installed packages.
