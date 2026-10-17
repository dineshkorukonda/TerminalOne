export type ShellFamily = 'powershell' | 'cmd' | 'bash'
export interface ShellCapability {
  id: string
  family: ShellFamily
  available: boolean
}
export interface AnalysisContext {
  aliasesKnown: boolean
  integration: 'ready' | 'unavailable' | 'failed'
}
export interface Evidence {
  family: ShellFamily
  form: string
}
export interface CommandAnalysis {
  input: string
  kind: 'recognized' | 'unknown' | 'ambiguous'
  evidence: readonly Evidence[]
  stateful: boolean
  reason:
    | 'supported-form'
    | 'unknown-form'
    | 'complex-input'
    | 'conflicting-evidence'
    | 'incomplete-input'
    | 'context-unverified'
}
export interface ShellAdapter {
  family: ShellFamily
  analyze(input: string, context: AnalysisContext): CommandAnalysis
}
export interface AdapterRegistry {
  adapters: readonly ShellAdapter[]
  analyze(input: string, context: AnalysisContext): CommandAnalysis
}
export interface SessionShellState {
  sessionId: string
  shellId: string
  integration: 'ready' | 'unavailable' | 'failed'
  atPrompt: boolean
  sequence: number
  cwd: string | null
  environmentRevision: string | null
  exitCode: number | null
  provenance: 'unobserved' | 'shell-integration'
}
export type ExecutionStrategy = {
  type: 'active-shell' | 'requires-selection' | 'unavailable'
  shellId: string
  command: string
  reason:
    | 'active-default'
    | 'ambiguous-fallback'
    | 'integration-unavailable'
    | 'interactive-attached'
    | 'state-isolated'
    | 'incompatible-shell'
    | 'target-unavailable'
    | 'explicit-same-shell'
}
