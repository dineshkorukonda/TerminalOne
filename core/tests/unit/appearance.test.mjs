import assert from 'node:assert/strict'
import test from 'node:test'
import {
  DEFAULT_APPEARANCE,
  parseAppearance,
  terminalTheme
} from '../../src/renderer/src/theme/appearance.ts'
import { ANSI_NAMES } from '../../src/renderer/src/theme/font.ts'
import { layout, minimum } from '../../src/renderer/src/workspace/layout.ts'
test('appearance validates safe fonts and maps every ANSI color', () => {
  const theme = terminalTheme(DEFAULT_APPEARANCE, (name) => name)
  for (const name of ANSI_NAMES)
    assert.equal(
      theme[name.replace(/-([a-z])/g, (_, letter) => letter.toUpperCase())],
      `--ansi-${name}`
    )
  assert.equal(
    terminalTheme({ ...DEFAULT_APPEARANCE, theme: 'contrast' }, () => '#abcdef')
      .background,
    '#000000'
  )
  for (const value of [
    null,
    { ...DEFAULT_APPEARANCE, theme: 'unknown' },
    { ...DEFAULT_APPEARANCE, font: { ...DEFAULT_APPEARANCE.font, size: 100 } },
    {
      ...DEFAULT_APPEARANCE,
      font: { ...DEFAULT_APPEARANCE.font, family: 'url(remote)' }
    }
  ])
    assert.throws(() => parseAppearance(value))
})
test('pane geometry tiles the space and preserves enforced minimum dimensions', () => {
  const leaf = (id) => ({ kind: 'pane', id, shellId: 'cmd' })
  const tree = {
    kind: 'split',
    id: 's',
    direction: 'horizontal',
    ratio: 0.2,
    first: leaf('a'),
    second: {
      kind: 'split',
      id: 'v',
      direction: 'vertical',
      ratio: 0.5,
      first: leaf('b'),
      second: leaf('c')
    }
  }
  const bounds = minimum(tree),
    items = layout(tree).filter((item) => item.kind === 'pane')
  assert.equal(items.length, 3)
  for (const { rectangle } of items) {
    assert(rectangle.width * bounds.width >= 240)
    assert(rectangle.height * bounds.height >= 160)
  }
  assert.equal(
    items.reduce(
      (sum, { rectangle }) => sum + rectangle.width * rectangle.height,
      0
    ),
    1
  )
})
