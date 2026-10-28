import {
  ANSI_NAMES,
  DEFAULT_TERMINAL_FONT,
  parseTerminalFont,
  type TerminalFontConfig
} from './font.ts'
export interface Appearance {
  theme: 'midnight' | 'contrast'
  font: TerminalFontConfig
}
export const DEFAULT_APPEARANCE: Appearance = {
  theme: 'midnight',
  font: { ...DEFAULT_TERMINAL_FONT }
}
export function parseAppearance(value: unknown): Appearance {
  if (!value || typeof value !== 'object' || Array.isArray(value))
    throw new Error('Invalid appearance')
  const config = value as Record<string, unknown>
  if (
    Object.keys(config).sort().join(',') !== 'font,theme' ||
    !['midnight', 'contrast'].includes(String(config['theme']))
  )
    throw new Error('Invalid appearance')
  return {
    theme: config['theme'] as Appearance['theme'],
    font: parseTerminalFont(config['font'])
  }
}
export function terminalTheme(
  appearance: Appearance,
  read: (name: string) => string
): Record<string, string> {
  const config = parseAppearance(appearance)
  const theme: Record<string, string> = {
    background:
      config.theme === 'contrast' ? '#000000' : read('--color-canvas'),
    foreground: config.theme === 'contrast' ? '#ffffff' : read('--color-ink'),
    cursor: read('--color-ink'),
    scrollbarSliderBackground: read('--color-border'),
    scrollbarSliderHoverBackground: read('--color-control-border'),
    scrollbarSliderActiveBackground: read('--color-muted')
  }
  for (const name of ANSI_NAMES)
    theme[
      name.replace(/-([a-z])/g, (_match, letter: string) =>
        letter.toUpperCase()
      )
    ] = read(`--ansi-${name}`)
  return theme
}
