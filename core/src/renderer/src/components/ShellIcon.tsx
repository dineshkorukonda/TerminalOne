import { Icon } from './Icon'

export function ShellIcon({ shellId }: { shellId: string }) {
  const kind = ['powershell', 'pwsh'].includes(shellId)
    ? 'powershell'
    : shellId === 'cmd'
      ? 'cmd'
      : shellId.includes('bash')
        ? 'bash'
        : 'terminal'
  return (
    <span className={`shell-icon shell-icon-${kind}`} aria-hidden="true">
      <Icon name="terminal" />
    </span>
  )
}
