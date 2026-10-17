import assert from 'node:assert/strict'
import test from 'node:test'
import {
  mkdtemp,
  readFile,
  writeFile,
  rm,
  mkdir,
  readdir
} from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import {
  defaultPreferences,
  parsePreferences,
  parseShortcuts
} from '../src/contracts/preferences.ts'
import { PreferenceRepository } from '../src/infrastructure/preferences/repository.ts'

test('settings validate version, paths, bounded layout and shortcut conflicts without dropping prior values', () => {
  const defaults = defaultPreferences()
  assert.deepEqual(
    parsePreferences(JSON.parse(JSON.stringify(defaults))),
    defaults
  )
  assert.throws(() => parsePreferences({ ...defaults, version: 2 }))
  assert.throws(() => parsePreferences({ ...defaults, unknown: true }))
  assert.throws(() =>
    parseShortcuts({ ...defaults.shortcuts, palette: 'Ctrl+C' })
  )
  assert.throws(() =>
    parseShortcuts({ ...defaults.shortcuts, new: defaults.shortcuts.palette })
  )
  const project = {
    id: 'project-1',
    name: '世界 project',
    cwd: 'C:\\work space\\世界',
    shellId: 'pwsh'
  }
  const settings = {
    ...defaults,
    projects: [project],
    restoration: {
      enabled: true,
      tabs: [
        {
          title: 'Project',
          root: { kind: 'pane', shellId: 'pwsh', projectId: project.id }
        }
      ]
    }
  }
  assert.deepEqual(parsePreferences(settings), settings)
  for (const cwd of [
    'relative',
    '\\\\?\\C:\\work',
    'https://example.com',
    'C:\\work\nfile'
  ])
    assert.throws(() =>
      parsePreferences({ ...settings, projects: [{ ...project, cwd }] })
    )
  assert.throws(() => parsePreferences({ ...settings, projects: [] }))
  assert.throws(() =>
    parsePreferences({
      ...defaults,
      restoration: {
        enabled: true,
        tabs: Array(5).fill(settings.restoration.tabs[0])
      }
    })
  )
})

test('repository preserves corruption, validates imports before mutation, round-trips settings, and gates history', async () => {
  const directory = await mkdtemp(join(tmpdir(), 'terminal-settings-test-'))
  try {
    const repository = new PreferenceRepository(directory)
    await repository.load()
    await repository.record('pwsh', 'Get-Location')
    assert.deepEqual(repository.search('', 'all'), [])
    const settings = {
      ...defaultPreferences(),
      history: { enabled: true, limit: 50 }
    }
    await repository.save(settings)
    await repository.record('pwsh', 'Get-Location')
    await repository.record('pwsh', 'Get-Location')
    await repository.record('pwsh', "$env:API_TOKEN='synthetic'")
    await repository.record('pwsh', ' Write-Output private')
    await repository.record('cmd', 'dir')
    assert.equal(repository.search('location', 'pwsh').length, 1)
    await assert.rejects(repository.save({ ...settings, version: 9 }))
    await assert.rejects(
      repository.save({
        ...settings,
        projects: Array.from({ length: 20 }, (_, index) => ({
          id: `project-${index}`,
          name: '界'.repeat(80),
          cwd: 'C:\\' + '界'.repeat(1000),
          shellId: 'powershell'
        }))
      }),
      /64 KiB/
    )
    assert.deepEqual(repository.current().settings, settings)
    const reopened = new PreferenceRepository(directory)
    await reopened.load()
    assert.equal(reopened.search('location', 'pwsh').length, 1)
    await reopened.save(defaultPreferences())
    assert.deepEqual(
      JSON.parse(await readFile(join(directory, 'history.json'), 'utf8')),
      []
    )
    await writeFile(join(directory, 'settings.json'), '{corrupt')
    const corrupt = new PreferenceRepository(directory)
    assert((await corrupt.load()).warning)
    await assert.rejects(corrupt.save(defaultPreferences()))
    assert.equal(
      await readFile(join(directory, 'settings.json'), 'utf8'),
      '{corrupt'
    )
    await corrupt.reset()
    assert.deepEqual(corrupt.current().settings, defaultPreferences())
    await rm(join(directory, 'history.json'), { force: true })
    await mkdir(join(directory, 'history.json'))
    await assert.rejects(corrupt.clearHistory())
    assert(!(await readdir(directory)).some((name) => name.endsWith('.tmp')))
  } finally {
    await rm(directory, { recursive: true, force: true })
  }
})
