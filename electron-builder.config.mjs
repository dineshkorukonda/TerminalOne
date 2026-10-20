export default {
  appId: 'com.github.dineshkorukonda.terminalone',
  productName: 'Terminal One',
  executableName: 'TerminalOne',
  directories: { output: 'artifacts/windows' },
  files: ['out/**/*', 'native/pty-job-host.exe', 'package.json', 'LICENSE'],
  asar: true,
  extraResources: [
    { from: 'shell', to: 'shell' },
    {
      from: 'assets/branding',
      to: 'branding',
      filter: ['terminal-one.png', 'terminal-one.ico']
    }
  ],
  asarUnpack: ['**/node-pty/**', '**/native/**'],
  npmRebuild: false,
  nodeGypRebuild: false,
  publish: {
    provider: 'github',
    owner: 'dineshkorukonda',
    repo: 'TerminalOne',
    releaseType: 'prerelease'
  },
  artifactName: 'TerminalOne-${version}-unsigned-${arch}.${ext}',
  electronFuses: {
    runAsNode: false,
    enableNodeOptionsEnvironmentVariable: false,
    enableNodeCliInspectArguments: false,
    enableEmbeddedAsarIntegrityValidation: true,
    onlyLoadAppFromAsar: true
  },
  win: {
    icon: 'assets/branding/terminal-one.ico',
    target: [{ target: 'nsis', arch: ['x64'] }],
    signExecutable: false,
    requestedExecutionLevel: 'asInvoker'
  },
  nsis: {
    installerIcon: 'assets/branding/terminal-one.ico',
    uninstallerIcon: 'assets/branding/terminal-one.ico',
    oneClick: false,
    perMachine: false,
    allowToChangeInstallationDirectory: true,
    runAfterFinish: false,
    deleteAppDataOnUninstall: false,
    createDesktopShortcut: false,
    uninstallDisplayName: 'Terminal One (unsigned development)'
  }
}
