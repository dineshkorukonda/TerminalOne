import type { SessionShellState } from '../../domain/shell-adapter/contracts.ts'

export interface PromptObservation {
  sequence: number
  cwd: string
  environmentRevision: string
  exitCode: number | null
}
function windowsPath(value: string): boolean {
  return (
    value.length <= 32767 &&
    ![...value].some((character) => character.charCodeAt(0) < 32) &&
    (/^[a-z]:\\/i.test(value) || /^\\\\[^\\]+\\[^\\]+(?:\\|$)/.test(value))
  )
}
export class ShellStateTracker {
  private readonly producer: object
  private readonly sessions = new Map<string, SessionShellState>()
  constructor(producer: object) {
    this.producer = producer
  }
  register(sessionId: string, shellId: string): SessionShellState {
    if (
      !sessionId ||
      !shellId ||
      this.sessions.has(sessionId) ||
      this.sessions.size >= 256
    )
      throw new Error('Invalid shell state registration')
    const state: SessionShellState = {
      sessionId,
      shellId,
      integration: 'unavailable',
      atPrompt: false,
      sequence: 0,
      cwd: null,
      environmentRevision: null,
      exitCode: null,
      provenance: 'unobserved'
    }
    this.sessions.set(sessionId, state)
    return { ...state }
  }
  observe(
    producer: object,
    sessionId: string,
    value: PromptObservation
  ): SessionShellState {
    const previous = this.sessions.get(sessionId)
    if (producer !== this.producer || !previous)
      throw new Error('Untrusted shell integration producer or session')
    if (
      !value ||
      !Number.isSafeInteger(value.sequence) ||
      value.sequence <= previous.sequence ||
      typeof value.cwd !== 'string' ||
      !windowsPath(value.cwd) ||
      typeof value.environmentRevision !== 'string' ||
      !/^[a-zA-Z0-9_-]{1,128}$/.test(value.environmentRevision) ||
      (value.exitCode !== null &&
        (!Number.isInteger(value.exitCode) ||
          value.exitCode < -2147483648 ||
          value.exitCode > 4294967295))
    )
      throw new Error('Invalid shell integration boundary')
    const state: SessionShellState = {
      ...previous,
      ...value,
      integration: 'ready',
      atPrompt: true,
      provenance: 'shell-integration'
    }
    // Copy only known metadata; never retain injected environment values or arbitrary properties.
    const clean: SessionShellState = {
      ...previous,
      sequence: state.sequence,
      cwd: state.cwd,
      environmentRevision: state.environmentRevision,
      exitCode: state.exitCode,
      integration: state.integration,
      atPrompt: true,
      provenance: state.provenance
    }
    this.sessions.set(sessionId, clean)
    return { ...clean }
  }
  executing(sessionId: string): void {
    const state = this.get(sessionId)
    this.sessions.set(sessionId, { ...state, atPrompt: false })
  }
  fail(sessionId: string): void {
    const state = this.get(sessionId)
    this.sessions.set(sessionId, {
      ...state,
      integration: 'failed',
      atPrompt: false,
      cwd: null,
      environmentRevision: null,
      provenance: 'unobserved'
    })
  }
  get(sessionId: string): SessionShellState {
    const state = this.sessions.get(sessionId)
    if (!state) throw new Error('Unknown shell state session')
    return { ...state }
  }
  close(sessionId: string): void {
    this.sessions.delete(sessionId)
  }
}
