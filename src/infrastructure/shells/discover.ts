import { win32 } from 'node:path'
import { stat } from 'node:fs/promises'
import type { Shell } from '../../domain/terminal/pty'

interface DiscoveryOptions {
  bashRcPath?: string | undefined
  platform?: string
  env?: Record<string, string | undefined>
  exists?: (path: string) => Promise<boolean>
}
export async function discoverShells(
  options: DiscoveryOptions = {}
): Promise<Shell[]> {
  if ((options.platform ?? process.platform) !== 'win32')
    throw new Error('Native terminal sessions require Windows ConPTY.')
  const env = options.env ?? process.env
  const exists =
    options.exists ??
    (async (path) => {
      try {
        return (await stat(path)).isFile()
      } catch {
        return false
      }
    })
  const environment = (name: string) =>
    env[
      Object.keys(env).find(
        (key) => key.toLowerCase() === name.toLowerCase()
      ) ?? name
    ]
  const root = environment('SystemRoot') ?? 'C:\\Windows'
  const programs = [
    environment('ProgramFiles'),
    environment('ProgramFiles(x86)'),
    environment('LOCALAPPDATA')
  ].filter((value): value is string => Boolean(value))
  const path = (environment('PATH') ?? '')
    .split(';')
    .map((entry) => entry.replace(/^"|"$/g, ''))
    .filter((entry) => win32.isAbsolute(entry))
  async function first(candidates: string[]): Promise<string | undefined> {
    for (const candidate of [...new Set(candidates)])
      if (win32.isAbsolute(candidate) && (await exists(candidate)))
        return candidate
    return undefined
  }
  const candidates = [
    {
      id: 'pwsh',
      name: 'PowerShell 7',
      args: ['-NoLogo', '-NoProfile', '-NoExit'],
      paths: [
        ...path.map((directory) => win32.join(directory, 'pwsh.exe')),
        ...programs.map((directory) =>
          win32.join(directory, 'PowerShell/7/pwsh.exe')
        )
      ]
    },
    {
      id: 'powershell',
      name: 'Windows PowerShell',
      args: ['-NoLogo', '-NoProfile', '-NoExit'],
      paths: [
        win32.join(root, 'System32/WindowsPowerShell/v1.0/powershell.exe')
      ]
    },
    {
      id: 'cmd',
      name: 'Command Prompt',
      // Keep the interactive prompt visible; /q disables echo and hides it.
      args: ['/d'],
      paths: [win32.join(root, 'System32/cmd.exe')]
    },
    {
      id: 'git-bash',
      name: 'Git Bash',
      args: options.bashRcPath
        ? ['--noprofile', '--rcfile', options.bashRcPath, '-i']
        : ['--login', '-i'],
      paths: [
        ...programs.map((directory) =>
          win32.join(directory, 'Git/bin/bash.exe')
        ),
        ...path
          .filter((directory) => /[\\/]Git[\\/]cmd$/i.test(directory))
          .map((directory) => win32.join(directory, '../bin/bash.exe'))
      ]
    }
  ]
  const shells: Shell[] = []
  for (const candidate of candidates) {
    const executable = await first(candidate.paths)
    if (executable)
      shells.push({
        id: candidate.id,
        name: candidate.name,
        args: candidate.args,
        executable
      })
  }
  return shells.sort(
    (a, b) => Number(b.id === 'git-bash') - Number(a.id === 'git-bash')
  )
}
export function selectShell(shells: Shell[], id: string): Shell {
  const shell =
    id === 'auto' ? shells[0] : shells.find((candidate) => candidate.id === id)
  if (!shell)
    throw new Error(
      'The requested shell is unavailable. Install it or select another detected shell.'
    )
  return shell
}
