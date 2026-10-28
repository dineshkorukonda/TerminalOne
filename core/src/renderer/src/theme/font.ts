export const FONT_FAMILIES = [
  'Cascadia Mono',
  'Consolas',
  'Liberation Mono'
] as const
export interface TerminalFontConfig {
  family: (typeof FONT_FAMILIES)[number]
  size: number
  lineHeight: number
  ligatures: boolean
}

export const DEFAULT_TERMINAL_FONT: Readonly<TerminalFontConfig> =
  Object.freeze({
    family: 'Cascadia Mono',
    size: 16,
    lineHeight: 1.2,
    ligatures: false
  })

export function parseTerminalFont(value: unknown): TerminalFontConfig {
  if (!value || typeof value !== 'object' || Array.isArray(value))
    throw new Error('Invalid terminal font')
  const config = value as Record<string, unknown>
  if (
    Object.keys(config).sort().join(',') !==
      'family,ligatures,lineHeight,size' ||
    !FONT_FAMILIES.some((family) => family === config['family']) ||
    typeof config['size'] !== 'number' ||
    !Number.isInteger(config['size']) ||
    config['size'] < 10 ||
    config['size'] > 32 ||
    typeof config['lineHeight'] !== 'number' ||
    !Number.isFinite(config['lineHeight']) ||
    config['lineHeight'] < 1 ||
    config['lineHeight'] > 2 ||
    typeof config['ligatures'] !== 'boolean'
  )
    throw new Error('Invalid terminal font')
  return {
    family: config['family'] as TerminalFontConfig['family'],
    size: config['size'],
    lineHeight: config['lineHeight'],
    ligatures: config['ligatures']
  }
}

export function terminalFontStyle(config: Readonly<TerminalFontConfig>) {
  const font = parseTerminalFont(config)
  return {
    fontFamily: `"${font.family}", Consolas, "Liberation Mono", monospace`,
    fontSize: `${font.size}px`,
    lineHeight: font.lineHeight,
    fontVariantLigatures: font.ligatures ? 'normal' : 'none'
  }
}

export const ANSI_NAMES = [
  'black',
  'red',
  'green',
  'yellow',
  'blue',
  'magenta',
  'cyan',
  'white',
  'bright-black',
  'bright-red',
  'bright-green',
  'bright-yellow',
  'bright-blue',
  'bright-magenta',
  'bright-cyan',
  'bright-white'
] as const
