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
  publish: null,
  artifactName: 'TerminalOne-${version}-unsigned-${arch}.${ext}',
  electronFuses: {
    runAsNode: false,
    enableNodeOptionsEnvironmentVariable: false,
    enableNodeCliInspectArguments: false,
    enableEmbeddedAsarIntegrityValidation: true,
    onlyLoadAppFromAsar: true
  },
  win: {
    target: [{ target: 'nsis', arch: ['x64'] }],
    signExecutable: false,
    requestedExecutionLevel: 'asInvoker'
  },
  nsis: {
    icon: 'assets/branding/terminal-one.ico',
    oneClick: false,
    perMachine: false,
    allowToChangeInstallationDirectory: true,
    runAfterFinish: false,
    deleteAppDataOnUninstall: false,
    installerIcon: 'assets/branding/terminal-one.ico',
    uninstallerIcon: 'assets/branding/terminal-one.ico',
    createDesktopShortcut: false,
    uninstallDisplayName: 'Terminal One (unsigned development)'
  }
}
