import type { Appearance } from '../theme/appearance'
import { useRef } from 'react'
import type { Tab } from '../workspace/store'
import { layout, minimum } from '../workspace/layout'
import { TerminalPane } from './TerminalPane'
import type { Preferences } from '../../../contracts/preferences'

export function PaneLayout({
  tab,
  appearance,
  active,
  focusPane,
  closePane,
  resizeSplit,
  shortcuts
}: {
  tab: Tab
  appearance: Appearance
  active: boolean
  focusPane(id: string): void
  closePane(id: string): void
  resizeSplit(id: string, ratio: number): void
  shortcuts: Preferences['shortcuts']
}) {
  const space = useRef<HTMLDivElement>(null)
  const bounds = minimum(tab.root)
  return (
    <div
      className="tab-viewport"
      hidden={!active}
      role="tabpanel"
      id={`panel-${tab.id}`}
      aria-labelledby={`tab-${tab.id}`}
    >
      <div
        className="pane-space"
        ref={space}
        style={{ minWidth: bounds.width, minHeight: bounds.height }}
      >
        {layout(tab.root)
          .filter((item) => item.kind === 'pane')
          .map(
            ({ id, rectangle, node }) =>
              node.kind === 'pane' && (
                <div
                  key={id}
                  className={`pane-position ${tab.activePaneId === id ? 'pane-active' : ''}`}
                  style={{
                    left: `${rectangle.x * 100}%`,
                    top: `${rectangle.y * 100}%`,
                    width: `${rectangle.width * 100}%`,
                    height: `${rectangle.height * 100}%`
                  }}
                  onFocusCapture={() => focusPane(id)}
                  onPointerDown={() => focusPane(id)}
                >
                  <TerminalPane
                    shellId={node.shellId}
                    appearance={appearance}
                    projectId={node.projectId}
                    privateSession={node.private}
                    shortcuts={shortcuts}
                  />
                  <button
                    className="pane-close"
                    aria-label="Close pane"
                    onClick={() => closePane(id)}
                  >
                    ×
                  </button>
                </div>
              )
          )}
        {layout(tab.root).map(
          ({ id, rectangle, node }) =>
            node.kind === 'split' && (
              <div
                key={id}
                role="separator"
                aria-label={`Resize ${node.direction} split`}
                aria-orientation={
                  node.direction === 'horizontal' ? 'vertical' : 'horizontal'
                }
                aria-valuemin={20}
                aria-valuemax={80}
                aria-valuenow={Math.round(node.ratio * 100)}
                tabIndex={0}
                className={`split-divider ${node.direction}`}
                style={
                  node.direction === 'horizontal'
                    ? {
                        left: `${(rectangle.x + rectangle.width * node.ratio) * 100}%`,
                        top: `${rectangle.y * 100}%`,
                        height: `${rectangle.height * 100}%`
                      }
                    : {
                        top: `${(rectangle.y + rectangle.height * node.ratio) * 100}%`,
                        left: `${rectangle.x * 100}%`,
                        width: `${rectangle.width * 100}%`
                      }
                }
                onKeyDown={(event) => {
                  if (
                    ![
                      'ArrowLeft',
                      'ArrowRight',
                      'ArrowUp',
                      'ArrowDown'
                    ].includes(event.key)
                  )
                    return
                  event.preventDefault()
                  resizeSplit(
                    id,
                    node.ratio +
                      (['ArrowRight', 'ArrowDown'].includes(event.key)
                        ? 0.05
                        : -0.05)
                  )
                }}
                onPointerDown={(event) => {
                  event.currentTarget.setPointerCapture(event.pointerId)
                }}
                onPointerMove={(event) => {
                  if (!event.currentTarget.hasPointerCapture(event.pointerId))
                    return
                  const box = space.current!.getBoundingClientRect()
                  const ratio =
                    node.direction === 'horizontal'
                      ? ((event.clientX - box.left) / box.width - rectangle.x) /
                        rectangle.width
                      : ((event.clientY - box.top) / box.height - rectangle.y) /
                        rectangle.height
                  resizeSplit(id, ratio)
                }}
                onPointerUp={(event) => {
                  event.currentTarget.releasePointerCapture(event.pointerId)
                }}
              />
            )
        )}
      </div>
    </div>
  )
}
