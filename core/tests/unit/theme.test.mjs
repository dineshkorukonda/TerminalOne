import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import test from 'node:test'
import {
  DEFAULT_TERMINAL_FONT,
  parseTerminalFont,
  terminalFontStyle
} from '../../src/renderer/src/theme/font.ts'

test('terminal font configuration accepts bounded values and rejects CSS injection', () => {
  assert.deepEqual(
    parseTerminalFont(DEFAULT_TERMINAL_FONT),
    DEFAULT_TERMINAL_FONT
  )
  assert.equal(terminalFontStyle(DEFAULT_TERMINAL_FONT).fontSize, '16px')
  assert.equal(
    parseTerminalFont({ ...DEFAULT_TERMINAL_FONT, size: 32, lineHeight: 2 })
      .size,
    32
  )
  for (const config of [
    null,
    [],
    {},
    { ...DEFAULT_TERMINAL_FONT, size: 9 },
    { ...DEFAULT_TERMINAL_FONT, size: 33 },
    { ...DEFAULT_TERMINAL_FONT, size: 12.5 },
    { ...DEFAULT_TERMINAL_FONT, lineHeight: NaN },
    { ...DEFAULT_TERMINAL_FONT, lineHeight: 0 },
    { ...DEFAULT_TERMINAL_FONT, family: 'url(https://evil.test)' },
    { ...DEFAULT_TERMINAL_FONT, ligatures: 'yes' },
    { ...DEFAULT_TERMINAL_FONT, extra: true }
  ]) {
    assert.throws(() => parseTerminalFont(config), /Invalid terminal font/)
  }
})

test('shared text and focus tokens meet documented contrast targets', async () => {
  const css = await readFile(
    new URL('../../src/renderer/src/theme/tokens.css', import.meta.url),
    'utf8'
  )
  const token = (name) => {
    const match = css.match(new RegExp(`--color-${name}: (#[a-f0-9]{6})`))
    assert(match)
    return match[1]
  }
  function luminance(hex) {
    const channels = [1, 3, 5].map(
      (offset) => parseInt(hex.slice(offset, offset + 2), 16) / 255
    )
    const linear = channels.map((channel) =>
      channel <= 0.04045 ? channel / 12.92 : ((channel + 0.055) / 1.055) ** 2.4
    )
    return linear[0] * 0.2126 + linear[1] * 0.7152 + linear[2] * 0.0722
  }
  function contrast(first, second) {
    const a = luminance(token(first))
    const b = luminance(token(second))
    return (Math.max(a, b) + 0.05) / (Math.min(a, b) + 0.05)
  }
  for (const [foreground, background, minimum] of [
    ['ink', 'canvas', 4.5],
    ['muted', 'panel', 4.5],
    ['ink', 'elevated', 4.5],
    ['focus', 'canvas', 3],
    ['focus', 'panel', 3],
    ['control-border', 'elevated', 3]
  ]) {
    const ratio = contrast(foreground, background)
    assert(ratio >= minimum, `${foreground}/${background}: ${ratio}`)
    console.log(`${foreground}/${background}: ${ratio.toFixed(2)}:1`)
  }
})
