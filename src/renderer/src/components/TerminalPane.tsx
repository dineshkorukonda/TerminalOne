import { useEffect, useRef, useState } from 'react'
import { FitAddon } from '@xterm/addon-fit'
import { createGridSender } from '../grid-sender'
import { Terminal } from '@xterm/xterm'
import '@xterm/xterm/css/xterm.css'
import type { SessionEvent } from '../../../contracts/desktop-api'
import {
  DEFAULT_TERMINAL_FONT,
  terminalFontStyle,
  ANSI_NAMES
} from '../theme/font'

export function TerminalPane({ shellId }: { shellId: string }) {
  const container = useRef<HTMLDivElement>(null)
  const [status, setStatus] = useState('Starting…')
  const [error, setError] = useState('')
  const closeSession = useRef<() => void>(() => {})
  useEffect(() => {
    const element = container.current
    if (!element) return
    let disposed = false
    let stopping = false
    let id: string | undefined
    let pending: SessionEvent[] = []
    let buffered = 0
    let input = Promise.resolve()
    let queuedInput = 0
    const colors = getComputedStyle(element)
    const theme: Record<string, string> = {
      background: colors.getPropertyValue('--color-canvas').trim(),
      foreground: colors.getPropertyValue('--color-ink').trim(),
      cursor: colors.getPropertyValue('--color-ink').trim()
    }
    for (const name of ANSI_NAMES)
      theme[
        name.replace(/-([a-z])/g, (_match, letter: string) =>
          letter.toUpperCase()
        )
      ] = colors.getPropertyValue(`--ansi-${name}`).trim()
    const font = terminalFontStyle(DEFAULT_TERMINAL_FONT)
    const terminal = new Terminal({
      cols: 80,
      rows: 24,
      scrollback: 2000,
      fontFamily: font.fontFamily,
      fontSize: DEFAULT_TERMINAL_FONT.size,
      lineHeight: DEFAULT_TERMINAL_FONT.lineHeight,
      cursorBlink: true,
      screenReaderMode: true,
      theme
    })
    const fit = new FitAddon()
    terminal.loadAddon(fit)
    terminal.open(element)
    const fail = (message: string) => {
      if (disposed) return
      stopping = true
      terminal.options.disableStdin = true
      setError(message)
      setStatus('Failed')
      if (id) void window.desktop.closeSession(id).catch(() => {})
    }
    const grids = createGridSender(
      async (grid) => {
        if (id && !disposed && !stopping)
          await window.desktop.resizeSession(id, grid)
      },
      () => fail('Could not resize the terminal. Start a new session.')
    )
    function measure() {
      if (disposed || element!.clientWidth <= 0 || element!.clientHeight <= 0)
        return
      const proposed = fit.proposeDimensions()
      if (!proposed) return
      const grid = {
        cols: Math.max(2, Math.min(500, proposed.cols)),
        rows: Math.max(1, Math.min(300, proposed.rows))
      }
      terminal.resize(grid.cols, grid.rows)
      if (id) grids.update(grid)
    }
    let frame = 0
    const scheduleFit = () => {
      if (!frame)
        frame = requestAnimationFrame(() => {
          frame = 0
          measure()
        })
    }
    const observer = new ResizeObserver(scheduleFit)
    observer.observe(element)
    measure()
    function receive(event: SessionEvent) {
      if (disposed || event.id !== id) return
      if (event.type === 'data') {
        terminal.write(event.data, () => {
          if (!disposed && id)
            void window.desktop
              .acknowledgeSession(id, event.sequence)
              .catch(() =>
                fail('Terminal output connection stopped. Start a new session.')
              )
        })
      } else if (event.type === 'state') {
        setStatus(
          event.state === 'exited' ? `Exited (${event.exitCode})` : event.state
        )
        terminal.options.disableStdin = event.state !== 'running'
      } else if (event.type === 'error') fail(event.message)
    }
    const unsubscribe = window.desktop.onSessionEvent((event) => {
      if (disposed) return
      if (!id) {
        buffered += event.type === 'data' ? event.data.length : 1
        if (buffered > 262144 || pending.length >= 512) {
          fail(
            'Terminal startup output exceeded its buffer. Start a new session.'
          )
          return
        }
        pending.push(event)
      } else receive(event)
    })
    const onData = terminal.onData((data) => {
      if (!id || disposed || stopping) return
      queuedInput += data.length
      if (queuedInput > 262144) {
        fail('Terminal input queue is full. Start a new session.')
        return
      }
      const sessionId = id
      input = input
        .then(async () => {
          for (let offset = 0; offset < data.length;) {
            let end = Math.min(offset + 16384, data.length)
            if (end < data.length && /[\uD800-\uDBFF]/.test(data[end - 1]!))
              end--
            if (!disposed && !stopping)
              await window.desktop.writeSession(
                sessionId,
                data.slice(offset, end)
              )
            offset = end
          }
        })
        .catch(() =>
          fail('Could not send terminal input. Start a new session.')
        )
        .finally(() => {
          queuedInput -= data.length
        })
    })
    closeSession.current = () => {
      stopping = true
      terminal.options.disableStdin = true
      if (id)
        void window.desktop
          .closeSession(id)
          .catch(() =>
            fail(
              'Could not close the terminal. Close the window to stop its host.'
            )
          )
    }
    void window.desktop
      .createSession({ shellId, cols: terminal.cols, rows: terminal.rows })
      .then(async (session) => {
        id = session.id
        if (disposed || stopping) {
          await window.desktop.closeSession(id)
          return
        }
        for (const event of pending) receive(event)
        pending = []
        setStatus(session.state)
        terminal.options.disableStdin = session.state !== 'running'
        scheduleFit()
      })
      .catch(() =>
        fail(
          'Could not start the shell. Verify it is installed and the Windows native components were built.'
        )
      )
    return () => {
      disposed = true
      unsubscribe()
      observer.disconnect()
      cancelAnimationFrame(frame)
      grids.dispose()
      onData.dispose()
      pending = []
      terminal.dispose()
      if (id) void window.desktop.closeSession(id).catch(() => {})
    }
  }, [shellId])
  return (
    <section className="terminal-panel" aria-label="Terminal session">
      <div className="terminal-toolbar">
        <span role="status">{status}</span>
        <button onClick={() => closeSession.current()}>Close session</button>
      </div>
      {error && (
        <p role="alert" className="error-message">
          {error}
        </p>
      )}
      <div className="terminal-surface" ref={container} />
    </section>
  )
}
