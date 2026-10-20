import {
  useEffect,
  useImperativeHandle,
  useRef,
  useState,
  type Ref
} from 'react'
import { SearchAddon } from '@xterm/addon-search'
import { terminalTheme, type Appearance } from '../theme/appearance'
import { FitAddon } from '@xterm/addon-fit'
import { createGridSender } from '../grid-sender'
import { Terminal } from '@xterm/xterm'
import '@xterm/xterm/css/xterm.css'
import type { SessionEvent } from '../../../contracts/desktop-api'
import { terminalFontStyle } from '../theme/font'
import type { Preferences } from '../../../contracts/preferences'

export interface TerminalActions {
  search(): void
  copy(): void
  paste(): void
  stop(): void
}

export function TerminalPane({
  shellId,
  appearance,
  projectId,
  privateSession,
  shortcuts,
  actionsRef
}: {
  shellId: string
  appearance: Appearance
  projectId: string | null
  privateSession: boolean
  shortcuts: Preferences['shortcuts']
  actionsRef?: Ref<TerminalActions> | undefined
}) {
  const shortcutRef = useRef(shortcuts)
  shortcutRef.current = shortcuts
  const [integrated, setIntegrated] = useState(false)
  const terminalInstance = useRef<Terminal | null>(null)
  const searchInstance = useRef<SearchAddon | null>(null)
  const refit = useRef<() => void>(() => {})
  const [searchOpen, setSearchOpen] = useState(false)
  const [query, setQuery] = useState('')
  const [searchResult, setSearchResult] = useState('')
  const [searchSummary, setSearchSummary] = useState('')
  const searchOptions = {
    decorations: {
      matchBackground: '#34415b',
      activeMatchBackground: '#536b94',
      matchOverviewRuler: '#91bfff',
      activeMatchColorOverviewRuler: '#b8d5ff'
    }
  }
  function search(reverse = false) {
    const found = reverse
      ? searchInstance.current?.findPrevious(query, searchOptions)
      : searchInstance.current?.findNext(query, searchOptions)
    setSearchResult(found ? 'Match selected' : 'No matches')
  }
  async function clipboard(action: 'copy' | 'paste') {
    try {
      const terminal = terminalInstance.current
      if (!terminal) return
      if (action === 'copy') {
        const selected = terminal.getSelection()
        if (selected) await window.desktop.writeClipboard(selected)
      } else terminal.paste(await window.desktop.readClipboard())
      terminal.focus()
    } catch {
      setError(
        'Clipboard operation failed. Select less text or paste a smaller block.'
      )
    }
  }
  const container = useRef<HTMLDivElement>(null)
  const [status, setStatus] = useState('Starting…')
  const [error, setError] = useState('')
  const closeSession = useRef<() => void>(() => {})
  useImperativeHandle(actionsRef, () => ({
    search: () => setSearchOpen((value) => !value),
    copy: () => {
      void clipboard('copy')
    },
    paste: () => {
      void clipboard('paste')
    },
    stop: () => closeSession.current()
  }))
  useEffect(() => {
    const element = container.current
    if (!element) return
    let disposed = false
    let stopping = false
    let running = false
    let id: string | undefined
    let pending: SessionEvent[] = []
    let buffered = 0
    let input = Promise.resolve()
    let queuedInput = 0
    let integrationReady = false
    const colors = getComputedStyle(element)
    const theme = terminalTheme(appearance, (name) =>
      colors.getPropertyValue(name).trim()
    )
    const font = terminalFontStyle(appearance.font)
    const terminal = new Terminal({
      cols: 80,
      rows: 24,
      scrollback: 2000,
      fontFamily: font.fontFamily,
      fontSize: appearance.font.size,
      lineHeight: appearance.font.lineHeight,
      cursorBlink: true,
      cursorStyle: 'bar',
      allowProposedApi: true,
      screenReaderMode: true,
      theme
    })
    const fit = new FitAddon()
    terminal.loadAddon(fit)
    const searchAddon = new SearchAddon({ highlightLimit: 500 })
    terminal.loadAddon(searchAddon)
    const searchResults = searchAddon.onDidChangeResults(
      ({ resultIndex, resultCount }) => {
        if (!disposed)
          setSearchSummary(
            resultIndex >= 0
              ? `Match ${resultIndex + 1} of ${resultCount}`
              : `${resultCount} matches`
          )
      }
    )
    searchInstance.current = searchAddon
    terminal.open(element)
    terminalInstance.current = terminal
    terminal.attachCustomKeyEventHandler(
      (event) =>
        !(
          event.ctrlKey &&
          event.shiftKey &&
          !event.altKey &&
          !event.metaKey &&
          Object.values(shortcutRef.current).includes(
            `Ctrl+Shift+${event.key.toUpperCase()}`
          )
        )
    )
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
        if (id && running && !disposed && !stopping)
          await window.desktop.resizeSession(id, grid)
      },
      () => {
        if (running) fail('Could not resize the terminal. Start a new session.')
      }
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
      if (id && running && !stopping) grids.update(grid)
    }
    let frame = 0
    const scheduleFit = () => {
      if (!frame)
        frame = requestAnimationFrame(() => {
          frame = 0
          measure()
        })
    }
    refit.current = scheduleFit
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
      } else if (event.type === 'integration') {
        integrationReady = event.ready
        setIntegrated(event.ready)
        if (privateSession && integrationReady && !stopping)
          terminal.options.disableStdin = false
      } else if (event.type === 'state') {
        running = event.state === 'running'
        setStatus(
          event.state === 'exited' ? `Exited (${event.exitCode})` : event.state
        )
        terminal.options.disableStdin =
          event.state !== 'running' || (privateSession && !integrationReady)
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
    // React development effect replay can dispose this view before the microtask.
    // Avoid allocating a native session for that discarded mount.
    void Promise.resolve()
      .then(() =>
        disposed
          ? null
          : window.desktop.createSession({
              shellId,
              projectId,
              private: privateSession,
              cols: terminal.cols,
              rows: terminal.rows
            })
      )
      .then(async (session) => {
        if (!session) return
        id = session.id
        if (disposed || stopping) {
          await window.desktop.closeSession(id)
          return
        }
        running = session.state === 'running'
        setStatus(session.state)
        terminal.options.disableStdin =
          session.state !== 'running' || (privateSession && !integrationReady)
        for (const event of pending) receive(event)
        pending = []
        scheduleFit()
      })
      .catch(() =>
        fail(
          'Could not start this shell or project folder. Verify shell installation, project availability, and the Windows native components.'
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
      searchResults.dispose()
      terminalInstance.current = null
      searchInstance.current = null
      terminal.dispose()
      if (id) void window.desktop.closeSession(id).catch(() => {})
    }
  }, [shellId, projectId, privateSession])
  useEffect(() => {
    const terminal = terminalInstance.current
    const element = container.current
    if (!terminal || !element) return
    const style = getComputedStyle(element)
    terminal.options.fontFamily = terminalFontStyle(appearance.font).fontFamily
    terminal.options.fontSize = appearance.font.size
    terminal.options.lineHeight = appearance.font.lineHeight
    terminal.options.theme = terminalTheme(appearance, (name) =>
      style.getPropertyValue(name).trim()
    )
    refit.current()
  }, [appearance])
  return (
    <section className="terminal-panel" aria-label="Terminal session">
      <div className="terminal-toolbar">
        <span role="status" data-state={status}>
          {status}
        </span>
        {privateSession && <span className="session-privacy">Private tab</span>}
        {integrated && !privateSession && (
          <span className="session-privacy">History integration ready</span>
        )}
      </div>
      {searchOpen && (
        <form
          className="terminal-search"
          onSubmit={(event) => {
            event.preventDefault()
            search()
          }}
          onKeyDown={(event) => {
            if (event.key === 'Escape') {
              event.stopPropagation()
              setSearchOpen(false)
              searchInstance.current?.clearDecorations()
              terminalInstance.current?.focus()
            }
          }}
        >
          <input
            aria-label="Search terminal output"
            value={query}
            maxLength={256}
            autoFocus
            onChange={(event) => setQuery(event.target.value)}
          />
          <button type="button" onClick={() => search(true)}>
            Previous match
          </button>
          <button type="submit">Next match</button>
          <span aria-live="polite">{searchResult}</span>
          <span aria-live="polite">{searchSummary}</span>
          <button
            type="button"
            aria-label="Close search"
            onClick={() => {
              setSearchOpen(false)
              terminalInstance.current?.focus()
            }}
          >
            ×
          </button>
        </form>
      )}
      {error && (
        <p role="alert" className="error-message">
          {error}
        </p>
      )}
      <div className="terminal-surface" ref={container} />
    </section>
  )
}
