import assert from 'node:assert/strict'
import { randomUUID } from 'node:crypto'
import { mkdir, rm, rmdir, writeFile } from 'node:fs/promises'
import { join } from 'node:path'
import { fileURLToPath } from 'node:url'
import test from 'node:test'
import { ESLint } from 'eslint'

const root = fileURLToPath(new URL('../', import.meta.url))

test('architecture lint permits inward imports and rejects prohibited dependencies', async () => {
  const probe = `__boundary_probe_${randomUUID()}`
  const layers = [
    'domain',
    'application',
    'infrastructure',
    'main',
    'preload',
    'renderer'
  ]
  const created = []
  const missingParents = []
  const eslint = new ESLint({ cwd: root })

  try {
    for (const layer of layers) {
      const parent = join(root, 'src', layer)
      try {
        await mkdir(parent)
        missingParents.push(parent)
      } catch (error) {
        if (error.code !== 'EEXIST') throw error
      }
      const directory = join(parent, probe)
      await mkdir(directory)
      created.push(directory)
      await writeFile(
        join(directory, 'target.ts'),
        'export const probe = true\nexport interface Probe { value: boolean }\n'
      )
    }

    const cases = [
      ['renderer', 'import type { DesktopApi } from "../../contracts/desktop-api"', null],
      ['preload', 'import { IPC_CHANNELS } from "../../contracts/desktop-api"', null],
      ['contracts', 'import { app } from "electron"', 'no-restricted-imports'],
      ['domain', 'import type { DesktopApi } from "../../contracts/desktop-api"', 'import-x/no-restricted-paths'],

      ['domain', 'import { probe } from "./target"', null],
      [
        'application',
        `import { probe } from "../../domain/${probe}/target"`,
        null
      ],
      [
        'infrastructure',
        `import { probe } from "../../application/${probe}/target"`,
        null
      ],
      [
        'main',
        `import { probe } from "../../infrastructure/${probe}/target"`,
        null
      ],
      ['renderer', 'import { createElement } from "react"', null],
      ['preload', 'import { contextBridge } from "electron"', null],
      ['infrastructure', 'import { BrowserWindow } from "electron"', null],
      ['infrastructure', 'import { join } from "node:path"', null],
      [
        'domain',
        'import { BrowserWindow } from "electron"',
        'no-restricted-imports'
      ],
      [
        'domain',
        'import { createElement } from "react"',
        'no-restricted-imports'
      ],
      [
        'application',
        'import { readFile } from "node:fs"',
        'no-restricted-imports'
      ],
      ['domain', 'import("node:fs")', 'import-x/no-nodejs-modules'],
      ['domain', 'import("electron")', 'import-x/no-restricted-paths'],
      [
        'domain',
        `import { probe } from "../../application/${probe}/target"`,
        'import-x/no-restricted-paths'
      ],
      [
        'application',
        `import { probe } from "../../infrastructure/${probe}/target"`,
        'import-x/no-restricted-paths'
      ],
      [
        'application',
        `import type { Probe } from "../../infrastructure/${probe}/target"`,
        'import-x/no-restricted-paths'
      ],
      [
        'domain',
        `export * from "../../infrastructure/${probe}/target"`,
        'import-x/no-restricted-paths'
      ],
      [
        'domain',
        `import("../../infrastructure/${probe}/target")`,
        'import-x/no-restricted-paths'
      ],
      [
        'infrastructure',
        `import { probe } from "../../main/${probe}/target"`,
        'import-x/no-restricted-paths'
      ],
      [
        'renderer',
        `import { probe } from "../../main/${probe}/target"`,
        'import-x/no-restricted-paths'
      ],
      [
        'renderer',
        `import { probe } from "../../infrastructure/${probe}/target"`,
        'import-x/no-restricted-paths'
      ],
      [
        'renderer',
        'import { ipcRenderer } from "electron"',
        'no-restricted-imports'
      ],
      ['renderer', 'import("electron")', 'import-x/no-restricted-paths'],
      ['renderer', 'import("node:fs")', 'import-x/no-nodejs-modules'],
      [
        'preload',
        `import { probe } from "../../main/${probe}/target"`,
        'import-x/no-restricted-paths'
      ],
      [
        'preload',
        'import { createElement } from "react"',
        'no-restricted-imports'
      ],
      ['preload', 'import("react")', 'no-restricted-syntax'],
      [
        'main',
        `import { probe } from "../../renderer/${probe}/target"`,
        'import-x/no-restricted-paths'
      ],
      [
        'main',
        'import { createElement } from "react"',
        'no-restricted-imports'
      ],
      [
        'domain',
        'const name = "electron"; import(name)',
        'no-restricted-syntax'
      ],
      ['domain', 'require("electron")', 'no-restricted-syntax'],
      [
        'domain',
        'type Window = import("electron").BrowserWindow',
        'no-restricted-syntax'
      ],
      ['domain', 'process.cwd()', 'no-restricted-globals'],
      ['application', 'Buffer.from("test")', 'no-restricted-globals'],
      ['unclassified', 'export const misplaced = true', 'no-restricted-syntax']
    ]

    for (const [layer, code, expectedRule] of cases) {
      const [result] = await eslint.lintText(code, {
        filePath: join(root, 'src', layer, probe, 'source.ts')
      })
      const label = `${layer}: ${code}`
      assert.equal(result.fatalErrorCount, 0, label)
      if (expectedRule) {
        assert(
          result.messages.some((message) => message.ruleId === expectedRule),
          `${label}\n${JSON.stringify(result.messages)}`
        )
      } else {
        assert.equal(
          result.errorCount,
          0,
          `${label}\n${JSON.stringify(result.messages)}`
        )
        assert.equal(result.warningCount, 0, label)
      }
    }
    console.log(
      `Verified ${cases.length} allowed and forbidden dependency cases`
    )
  } finally {
    for (const directory of created)
      await rm(directory, { recursive: true, force: true })
    for (const directory of missingParents) {
      try {
        await rmdir(directory)
      } catch (error) {
        // Preserve anything another process created while the check ran.
        if (error.code !== 'ENOTEMPTY') throw error
      }
    }
  }
})
