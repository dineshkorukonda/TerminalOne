import type {
  CommandAnalysis,
  ExecutionStrategy,
  SessionShellState,
  ShellCapability
} from '../../domain/shell-adapter/contracts.ts'
export function resolveExecution(
  analysis: CommandAnalysis,
  state: SessionShellState,
  capabilities: readonly ShellCapability[],
  requestedShellId?: string
): ExecutionStrategy {
  const active = capabilities.find(
    (shell) => shell.id === state.shellId && shell.available
  )
  const result = (
    type: ExecutionStrategy['type'],
    reason: ExecutionStrategy['reason'],
    shellId = state.shellId
  ): ExecutionStrategy => ({ type, shellId, command: analysis.input, reason })
  if (!active) return result('unavailable', 'target-unavailable')
  if (!state.atPrompt) return result('active-shell', 'interactive-attached')
  if (requestedShellId) {
    const requested = capabilities.find(
      (shell) => shell.id === requestedShellId && shell.available
    )
    if (!requested) return result('unavailable', 'target-unavailable')
    if (requested.id !== active.id)
      return result('requires-selection', 'state-isolated', requested.id)
    return result('active-shell', 'explicit-same-shell')
  }
  if (state.integration !== 'ready')
    return result('active-shell', 'integration-unavailable')
  if (analysis.kind !== 'recognized' || analysis.evidence.length !== 1)
    return result('active-shell', 'ambiguous-fallback')
  const evidence = analysis.evidence[0]!
  if (evidence.family === active.family)
    return result('active-shell', 'active-default')
  const target = capabilities.find(
    (shell) => shell.family === evidence.family && shell.available
  )
  if (!target) return result('active-shell', 'target-unavailable')
  return result(
    'requires-selection',
    analysis.stateful ? 'state-isolated' : 'incompatible-shell',
    target.id
  )
}
