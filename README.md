# TerminalOne

One Windows terminal workspace for PowerShell, CMD, and Git Bash.

**[Download Terminal One for Windows x64 — Experimental Alpha](https://github.com/dineshkorukonda/TerminalOne/releases)**

Unsigned preview builds, release notes, and SHA-256 checksums are available on the releases page. Alpha builds are published as prereleases.

TerminalOne brings native shell sessions, tabs, split panes, search, and appearance settings into one desktop app. Commands run locally on your machine without a required cloud account.

## Shells and commands

Choose an explicit PowerShell, CMD, or Git Bash profile for native shell behavior. Git Bash requires a separate Git for Windows installation.

Optional assisted Git Bash recognizes a bounded set of PowerShell commands and CMD forms and runs them through Bash adapters. It does not translate arbitrary scripts or shell state changes. See the [Bash experience guide](core/docs/bash-experience.md) for supported behavior and limits.

## Built around your commands

- **One terminal:** keep working in the same place across Bash, CMD, and PowerShell commands.
- **Assisted commands:** use supported PowerShell and CMD forms in an assisted Git Bash session.
- **A Unix-like experience on Windows:** a consistent command-line workflow with access to familiar Windows tools.
- **Local work:** run tools on your machine without a required cloud account.

## Availability

Experimental unsigned Windows x64 alpha installers are available on the [releases page](https://github.com/dineshkorukonda/TerminalOne/releases), with release notes and SHA-256 checksums. The app includes its runtime; no development tools are needed to install it.

The alpha supports native shell sessions, tabs, split panes, appearance settings, and optional assisted Git Bash. A bounded set of supported PowerShell commands and CMD forms can run through Bash adapters; arbitrary scripts and shell state changes require an explicit shell profile. Git Bash requires a separate Git for Windows installation. This is an early alpha for testing and feedback.

Unsigned alpha builds are intended for testing. Windows 10/11 manual compatibility and accessibility qualification remain incomplete; see [current qualification](core/docs/current-ui-qualification.md) and [release readiness](core/docs/release-readiness.md). A successful Windows Server CI run does not establish client Windows compatibility.

## Run from source

Use Node.js **24.21.0 LTS** and npm **11.19.0**. On Windows, install the native build prerequisites in the [development guide](core/docs/development.md), then run from the desktop package:

```sh
cd core
npm ci
npm run native:build
npm run dev
```

See the [development guide](core/docs/development.md) for build commands and verification, or the [website guide](website/README.md) to run the marketing site.

## Repository layout

- `core/`: desktop app package, with runtime code in `core/src/`.
- `core/tests/`: unit, Electron UI, Windows integration, and performance checks.
- `core/scripts/`: build, validation, packaging, and release commands.
- `core/docs/`: architecture decisions and attributed verification evidence.
- `website/`: independent Astro site with its own package and checks.
- `.github/`: CI workflows and shared GitHub Actions.

Desktop scripts are required by the npm commands and release workflows. Technical docs record security boundaries and qualification limits; neither belongs in production runtime source.

Keep runtime dependencies within the [architecture boundaries](core/docs/architecture/0001-dependency-direction.md). Follow [AGENTS.md](AGENTS.md) for commit conventions and review requirements.

## Checks

Run from `core/`, sequentially:

```sh
npm run format:check
npm run lint
npm run typecheck
npm run test:unit
npm run test:smoke
```

Native, packaged, and installed-app checks are described in the [development guide](core/docs/development.md). Windows Server CI, packaged security checks, and manual client Windows qualification provide different evidence.

## Feedback

Report reproducible bugs through [GitHub issues](https://github.com/dineshkorukonda/TerminalOne/issues), including the app version, Windows build, shell version, safe reproduction steps, and expected behavior. Remove credentials, private commands, terminal output, and personal paths from attachments. Avoid public exploit details for suspected security problems; request a private reporting route from the owner.

## License

[MIT](LICENSE).
