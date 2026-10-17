import type { PaneNode } from './store.ts'
export interface Rectangle {
  x: number
  y: number
  width: number
  height: number
}
export function layout(
  node: PaneNode,
  rectangle: Rectangle = { x: 0, y: 0, width: 1, height: 1 }
): {
  id: string
  kind: PaneNode['kind']
  rectangle: Rectangle
  node: PaneNode
}[] {
  if (node.kind === 'pane')
    return [{ id: node.id, kind: node.kind, rectangle, node }]
  const horizontal = node.direction === 'horizontal'
  const first = {
    ...rectangle,
    width: horizontal ? rectangle.width * node.ratio : rectangle.width,
    height: horizontal ? rectangle.height : rectangle.height * node.ratio
  }
  const second = {
    ...rectangle,
    x: horizontal ? rectangle.x + first.width : rectangle.x,
    y: horizontal ? rectangle.y : rectangle.y + first.height,
    width: horizontal ? rectangle.width - first.width : rectangle.width,
    height: horizontal ? rectangle.height : rectangle.height - first.height
  }
  return [
    { id: node.id, kind: node.kind, rectangle, node },
    ...layout(node.first, first),
    ...layout(node.second, second)
  ]
}
export function minimum(node: PaneNode): { width: number; height: number } {
  if (node.kind === 'pane') return { width: 240, height: 160 }
  const first = minimum(node.first),
    second = minimum(node.second)
  return node.direction === 'horizontal'
    ? {
        width: Math.max(
          first.width / node.ratio,
          second.width / (1 - node.ratio)
        ),
        height: Math.max(first.height, second.height)
      }
    : {
        width: Math.max(first.width, second.width),
        height: Math.max(
          first.height / node.ratio,
          second.height / (1 - node.ratio)
        )
      }
}
