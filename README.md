# TerminalOne

An all-in-one terminal for Windows, built for a Unix-like command-line experience.

Type your command in one place. TerminalOne is designed to choose the right shell automatically, so you can use Bash, CMD, and PowerShell commands without moving between terminals yourself.

## How it works

1. You enter a command in TerminalOne.
2. TerminalOne identifies the appropriate shell for supported commands.
3. The command runs through that shell, with the result shown in the same terminal.

The goal is a continuous workflow on Windows: run development tools, work with Git, and manage files while TerminalOne handles shell selection for you.

## Built around your commands

- **One terminal:** keep working in the same place across Bash, CMD, and PowerShell commands.
- **Automatic shell selection:** let TerminalOne choose the shell based on the command you enter.
- **A Unix-like experience on Windows:** a consistent command-line workflow with access to familiar Windows tools.
- **Local work:** run tools on your machine without a required cloud account.

## Availability

TerminalOne is in development and has no published installer yet. The desktop already supports native shell sessions, tabs, split panes, and appearance settings. Automatic shell selection based on your command is still in development.

Browse the [source code](https://github.com/dineshkorukonda/TerminalOne) or check [releases](https://github.com/dineshkorukonda/TerminalOne/releases) for availability.

## Run from source

Use Node.js **24.21.0 LTS** and npm **11.19.0**. On Windows, install the native build prerequisites in the [development guide](docs/development.md), then run from the repository root:

```sh
npm ci
npm run native:build
npm run dev
```

See the [development guide](docs/development.md) for build commands and verification, or the [website guide](website/README.md) to run the marketing site.

## License

[MIT](LICENSE).
