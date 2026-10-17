export const ACTIONS = [
  'palette',
  'new',
  'close',
  'right',
  'down',
  'search',
  'copy',
  'paste'
] as const
export type ShortcutAction = (typeof ACTIONS)[number]
export const DEFAULT_SHORTCUTS: Record<ShortcutAction, string> = {
  palette: 'Ctrl+Shift+P',
  new: 'Ctrl+Shift+T',
  close: 'Ctrl+Shift+W',
  right: 'Ctrl+Shift+E',
  down: 'Ctrl+Shift+O',
  search: 'Ctrl+Shift+F',
  copy: 'Ctrl+Shift+C',
  paste: 'Ctrl+Shift+V'
}
export interface Project {
  id: string
  name: string
  cwd: string
  shellId: string
}
export type SavedNode =
  | { kind: 'pane'; shellId: string; projectId: string | null }
  | {
      kind: 'split'
      direction: 'horizontal' | 'vertical'
      ratio: number
      first: SavedNode
      second: SavedNode
    }
export interface Preferences {
  version: 1
  appearance: {
    theme: 'midnight' | 'contrast'
    font: {
      family: 'Cascadia Mono' | 'Consolas' | 'Liberation Mono'
      size: number
      lineHeight: number
      ligatures: boolean
    }
  }
  history: { enabled: boolean; limit: number }
  shortcuts: Record<ShortcutAction, string>
  projects: Project[]
  restoration: { enabled: boolean; tabs: { title: string; root: SavedNode }[] }
  explanations: boolean
}
export function defaultPreferences(): Preferences {
  return {
    version: 1,
    appearance: {
      theme: 'midnight',
      font: {
        family: 'Cascadia Mono',
        size: 14,
        lineHeight: 1.5,
        ligatures: false
      }
    },
    history: { enabled: false, limit: 200 },
    shortcuts: { ...DEFAULT_SHORTCUTS },
    projects: [],
    restoration: { enabled: false, tabs: [] },
    explanations: false
  }
}
export function object(value: unknown, keys: string): Record<string, unknown> {
  if (
    !value ||
    typeof value !== 'object' ||
    Array.isArray(value) ||
    Object.keys(value).sort().join(',') !== keys.split(',').sort().join(',')
  )
    throw new Error('Invalid settings schema')
  return value as Record<string, unknown>
}
export function text(value: unknown, max: number): string {
  if (
    typeof value !== 'string' ||
    value.length > max ||
    /[\x00-\x1f\x7f]/.test(value)
  )
    throw new Error('Invalid settings text')
  return value
}
export function shellId(value: unknown): string {
  if (
    !['auto', 'powershell', 'pwsh', 'cmd', 'git-bash'].includes(String(value))
  )
    throw new Error('Unsupported shell')
  return String(value)
}
export function parseShortcut(value: unknown): string {
  if (typeof value !== 'string' || !/^Ctrl\+Shift\+[A-Z]$/.test(value))
    throw new Error(
      'Use Ctrl+Shift and one letter; terminal and OS shortcuts are reserved'
    )
  return value
}
export function parseShortcuts(value: unknown): Record<ShortcutAction, string> {
  const obj = object(value, ACTIONS.join(','))
  const result = {} as Record<ShortcutAction, string>
  const seen = new Set<string>()
  for (const action of ACTIONS) {
    const shortcut = parseShortcut(obj[action])
    if (seen.has(shortcut)) throw new Error('Shortcut collision')
    seen.add(shortcut)
    result[action] = shortcut
  }
  return result
}
export function parsePreferences(value: unknown): Preferences {
  const obj = object(
    value,
    'version,appearance,history,shortcuts,projects,restoration,explanations'
  )
  if (obj['version'] !== 1 || typeof obj['explanations'] !== 'boolean')
    throw new Error('Unsupported settings version')
  const appearance = object(obj['appearance'], 'theme,font')
  const font = object(appearance['font'], 'family,size,lineHeight,ligatures')
  if (
    !['midnight', 'contrast'].includes(String(appearance['theme'])) ||
    !['Cascadia Mono', 'Consolas', 'Liberation Mono'].includes(
      String(font['family'])
    ) ||
    !Number.isInteger(font['size']) ||
    Number(font['size']) < 10 ||
    Number(font['size']) > 32 ||
    typeof font['lineHeight'] !== 'number' ||
    !Number.isFinite(font['lineHeight']) ||
    font['lineHeight'] < 1 ||
    font['lineHeight'] > 2 ||
    typeof font['ligatures'] !== 'boolean'
  )
    throw new Error('Invalid appearance')
  const history = object(obj['history'], 'enabled,limit')
  if (
    typeof history['enabled'] !== 'boolean' ||
    !Number.isInteger(history['limit']) ||
    Number(history['limit']) < 50 ||
    Number(history['limit']) > 1000
  )
    throw new Error('Invalid history policy')
  if (!Array.isArray(obj['projects']) || obj['projects'].length > 20)
    throw new Error('Too many projects')
  const ids = new Set<string>()
  const projects = obj['projects'].map((value): Project => {
    const item = object(value, 'id,name,cwd,shellId'),
      id = text(item['id'], 80),
      cwd = text(item['cwd'], 1024),
      name = text(item['name'], 80)
    if (
      !/^[a-zA-Z0-9-]{1,80}$/.test(id) ||
      ids.has(id) ||
      !name.trim() ||
      !/^(?:[a-zA-Z]:[\\/]|\\\\[^\\/]+[\\/][^\\/]+[\\/])/.test(cwd) ||
      /^\\\\[?.]\\/.test(cwd)
    )
      throw new Error('Invalid project path or identity')
    ids.add(id)
    return { id, cwd, name, shellId: shellId(item['shellId']) }
  })
  const restoration = object(obj['restoration'], 'enabled,tabs')
  if (
    typeof restoration['enabled'] !== 'boolean' ||
    !Array.isArray(restoration['tabs']) ||
    restoration['tabs'].length > 4
  )
    throw new Error('Invalid restoration')
  let panes = 0
  const node = (value: unknown, depth = 0): SavedNode => {
    if (depth > 3) throw new Error('Invalid saved layout')
    const kind = (value as { kind?: unknown } | null)?.kind
    if (kind === 'pane') {
      const item = object(value, 'kind,shellId,projectId')
      if (
        ++panes > 4 ||
        (item['projectId'] !== null && !ids.has(String(item['projectId'])))
      )
        throw new Error('Invalid saved project')
      return {
        kind,
        shellId: shellId(item['shellId']),
        projectId: item['projectId'] as string | null
      }
    }
    const item = object(value, 'kind,direction,ratio,first,second')
    if (
      kind !== 'split' ||
      !['horizontal', 'vertical'].includes(String(item['direction'])) ||
      typeof item['ratio'] !== 'number' ||
      !Number.isFinite(item['ratio']) ||
      item['ratio'] < 0.2 ||
      item['ratio'] > 0.8
    )
      throw new Error('Invalid split')
    return {
      kind,
      direction: item['direction'] as 'horizontal' | 'vertical',
      ratio: item['ratio'],
      first: node(item['first'], depth + 1),
      second: node(item['second'], depth + 1)
    }
  }
  const tabs = restoration['tabs'].map((value) => {
    const item = object(value, 'title,root')
    return { title: text(item['title'], 80), root: node(item['root']) }
  })
  return {
    version: 1,
    appearance: {
      theme: appearance['theme'] as Preferences['appearance']['theme'],
      font: {
        family: font['family'] as Preferences['appearance']['font']['family'],
        size: Number(font['size']),
        lineHeight: font['lineHeight'],
        ligatures: font['ligatures']
      }
    },
    history: { enabled: history['enabled'], limit: Number(history['limit']) },
    projects,
    shortcuts: parseShortcuts(obj['shortcuts']),
    restoration: { enabled: restoration['enabled'], tabs },
    explanations: obj['explanations']
  }
}
export interface HistoryEntry {
  id: string
  shellId: string
  command: string
  time: number
}
