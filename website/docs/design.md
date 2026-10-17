# Terminal One website design

Issue: https://github.com/dineshkorukonda/Terminal/issues/49

## Scope and approval baseline

The owner approved adding the self-contained marketing website to the roadmap and directed implementation to start. This design implements that approved scope. The desktop application and root package/configuration files are outside this issue. No deployment or merge is authorized.

## Architecture options

Use Astro static generation with strict TypeScript, authored CSS and small progressive-enhancement scripts. This gives semantic HTML, indexable content and low browser JavaScript without a server. React/Vite would align with the eventual desktop renderer but adds client rendering to a mostly static site. A server-rendered framework adds deployment and runtime requirements that this page does not need.

All site source, dependencies, lockfile, assets, tests and documentation live under website. No root workspace migration. A separate path-filtered GitHub Actions workflow is the only planned file outside website; it verifies this issue without altering any desktop workflow.

## Visual direction

Near-black canvas with warm off-white text, acid-lime accents, oversized tightly spaced headlines and monospace technical details. Use local Inter and JetBrains Mono fonts. A compact wordmark, generous content width and restrained borders give the site a product identity without dashboard decorations.

Hero: “One terminal. Every shell.” followed by a clear Windows-native product description. Show an illustrative terminal concept next to the hero, labeled as a concept with sample output. The shell tabs select independent PowerShell, CMD and Git Bash examples. They do not execute commands, translate input or simulate an available application release.

Follow with the supported-shell direction, three product principles, a planned-adapter section, a linked development roadmap, a short FAQ and a final contributor call to action. Avoid testimonials, invented usage numbers, fake screenshots and nonexistent download buttons. Present planned desktop capabilities as planned.

## Components and behavior

- SiteHeader: semantic navigation and accessible expandable mobile menu.
- TerminalPreview: tablist, labeled tabpanel and arrow-key/Home/End navigation. Sample output is static local content.
- ProductSections: semantic feature, adapter and roadmap content with explicit planned states.
- FAQ: native details/summary controls.
- Footer: real repository, issue roadmap, license and releases links.
- Static SVG icons from Lucide; decorative icons hidden from assistive technology.

Use progressive enhancement. Without JavaScript, content, anchor navigation and FAQs remain readable; the first terminal example remains visible. Show shell switching controls only when interactive behavior is ready.

## Messaging and links

Product name: Terminal One.
Tagline: One terminal. Every shell.
Philosophy: The terminal should adapt to the developer, not the developer to the shell.

Repository: https://github.com/dineshkorukonda/Terminal
Roadmap: https://github.com/dineshkorukonda/Terminal/milestones
Releases: https://github.com/dineshkorukonda/Terminal/releases
License: https://github.com/dineshkorukonda/Terminal/blob/main/LICENSE

The repository is currently private; link targets are real but require repository access until the owner makes it public. Do not change visibility. No published installer is available. Do not invent a production domain or canonical URL. Open Graph metadata uses a relative local asset until a production URL is supplied.

## Accessibility and responsiveness

Use one h1, named landmarks, a skip link, visible keyboard focus, adequately sized controls and sufficient contrast. Provide reduced-motion styles. Terminal examples have meaningful plain-text descriptions and no endless cursor animation. Mobile layout stacks the preview beneath the heading, wraps long code and has no page-level horizontal overflow.

## Testing and errors

Playwright tests run against the built production site. Write failing tests before implementing shell tab changes, keyboard navigation, mobile navigation and content/link honesty. Verify semantics, a meaningful FAQ interaction, responsive layouts, reduced motion and runtime errors. Add automated axe accessibility scans. Browser preview validates actual visual results at desktop and mobile sizes.

Run independent npm installation, formatting, lint, Astro/TypeScript checks, production build, browser tests and dependency audit. Report actual output. Do not claim desktop tests/build passed: no desktop source exists at baseline.

## Delivery

Branch: feat/49-marketing-website. Conventional Commits have meaningful bodies and Refs #49. A focused PR uses Closes #49, documents validation and screenshots, is registered with T3 Code and is not merged without owner authorization.

