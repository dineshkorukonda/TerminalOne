import type {
  AdapterRegistry,
  AnalysisContext,
  CommandAnalysis,
  Evidence,
  ShellAdapter,
  ShellFamily
} from './contracts.ts'

// This scanner only rejects unsupported boundaries; it is deliberately not a shell parser.
function boundary(
  input: string
): 'complete' | 'complex-input' | 'incomplete-input' {
  if (!input.trim() || input.length > 16384) return 'incomplete-input'
  let quote = ''
  for (let index = 0; index < input.length; index++) {
    const character = input[index]!
    if ('\r\n\0'.includes(character)) return 'complex-input'
    if (['`', '^', '\\'].includes(character)) {
      // Escape rules differ between shells. Do not guess across dialects.
      if (
        character !== '\\' ||
        input[index + 1] === '"' ||
        input[index + 1] === "'"
      )
        return 'complex-input'
    }
    if (quote) {
      if (character === quote) quote = ''
      continue
    }
    if (character === '"' || character === "'") {
      quote = character
      continue
    }
    if ('|&;><(){}[]'.includes(character)) return 'complex-input'
  }
  return quote ? 'incomplete-input' : 'complete'
}
function evidence(
  input: string,
  family: ShellFamily
): { form: string; stateful: boolean } | null {
  const value = input.trim()
  if (family === 'powershell') {
    if (/^\$env:[a-z_]\w*\s*=/i.test(value))
      return { form: 'environment-assignment', stateful: true }
    if (/^(?:Set-Location|Push-Location|Pop-Location)(?:\s|$)/i.test(value))
      return { form: 'location-cmdlet', stateful: true }
    if (
      /^(?:Get-ChildItem|Get-Location|Get-Item|Write-Output|Get-Process)(?:\s|$)/i.test(
        value
      )
    )
      return { form: 'explicit-cmdlet', stateful: false }
  }
  if (family === 'cmd') {
    if (/^set\s+(?:\/[ap]\s+)?[a-z_]\w*=/i.test(value))
      return { form: 'set-assignment', stateful: true }
    if (/^setlocal(?:\s|$)/i.test(value) || /^endlocal\s*$/i.test(value))
      return { form: 'local-environment', stateful: true }
    if (/^dir\s+\/(?:b|s|a|o|t)(?:\s|$)/i.test(value))
      return { form: 'dir-switch', stateful: false }
    if (/^echo\s+(?:"?)%[a-z_]\w*%(?:"?)(?:\s|$)/i.test(value))
      return { form: 'percent-environment', stateful: false }
  }
  if (family === 'bash') {
    if (/^export\s+[a-z_]\w*=/i.test(value))
      return { form: 'export-assignment', stateful: true }
    if (/^source\s+[^\s]+/.test(value))
      return { form: 'source-file', stateful: true }
    if (/^[a-z_]\w*=[^\s]*(?:\s+[a-z_][\w-]*(?:\s|$)|$)/i.test(value))
      return { form: 'prefix-assignment', stateful: true }
  }
  return null
}
export function createAdapter(family: ShellFamily): ShellAdapter {
  return {
    family,
    analyze(input: string, context: AnalysisContext): CommandAnalysis {
      const condition = boundary(input)
      if (condition !== 'complete')
        return {
          input,
          kind: 'unknown',
          evidence: [],
          stateful: false,
          reason: condition
        }
      const match = evidence(input, family)
      if (!match)
        return {
          input,
          kind: 'unknown',
          evidence: [],
          stateful: false,
          reason: 'unknown-form'
        }
      const verified = context.integration === 'ready' && context.aliasesKnown
      return {
        input,
        kind: verified ? 'recognized' : 'unknown',
        evidence: [{ family, form: match.form }],
        stateful: match.stateful,
        reason: verified ? 'supported-form' : 'context-unverified'
      }
    }
  }
}
export function createAdapterRegistry(
  adapters: readonly ShellAdapter[] = [
    createAdapter('powershell'),
    createAdapter('cmd'),
    createAdapter('bash')
  ]
): AdapterRegistry {
  return {
    adapters: [...adapters],
    analyze(input, context) {
      const analyses = adapters.map((adapter) =>
        adapter.analyze(input, context)
      )
      const evidence: Evidence[] = analyses.flatMap((analysis) => [
        ...analysis.evidence
      ])
      const families = new Set(evidence.map((item) => item.family))
      if (families.size > 1)
        return {
          input,
          kind: 'ambiguous',
          evidence,
          stateful: analyses.some((analysis) => analysis.stateful),
          reason: 'conflicting-evidence'
        }
      return (
        analyses.find((analysis) => analysis.evidence.length) ??
        analyses[0] ?? {
          input,
          kind: 'unknown',
          evidence: [],
          stateful: false,
          reason: 'unknown-form'
        }
      )
    }
  }
}
