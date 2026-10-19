import assert from 'node:assert/strict'
import test from 'node:test'
import { readFile } from 'node:fs/promises'
import config from '../electron-builder.config.mjs'
import {
  allowedBuildRef,
  renderNotes,
  generateNotes
} from '../scripts/release-notes.mjs'
import { releaseBlockers } from '../scripts/check-release-readiness.mjs'

test('packaging and release builds remain unsigned and publishing is unavailable on feature branches', async () => {
  assert.equal(config.publish, null)
  assert.equal(config.win.signExecutable, false)
  assert.deepEqual(config.win.target, [{ target: 'nsis', arch: ['x64'] }])
  assert.equal(config.npmRebuild, false)
  for (const key of [
    'runAsNode',
    'enableNodeOptionsEnvironmentVariable',
    'enableNodeCliInspectArguments'
  ])
    assert.equal(config.electronFuses[key], false)
  assert.equal(config.electronFuses.onlyLoadAppFromAsar, true)
  assert.equal(config.electronFuses.enableEmbeddedAsarIntegrityValidation, true)
  for (const ref of [
    'refs/heads/feat/release',
    'refs/pull/65/merge',
    'refs/tags/not-a-version',
    'refs/tags/v1.2.3;publish'
  ])
    assert.equal(allowedBuildRef(ref), false)
  for (const ref of [
    'refs/heads/main',
    'refs/tags/v1.2.3',
    'refs/tags/v0.2.0-alpha.17',
    'refs/tags/v1.2.3-beta.1'
  ])
    assert.equal(allowedBuildRef(ref), true)
  const workflow = await readFile('.github/workflows/release-build.yml', 'utf8')
  assert(workflow.includes('contents: read'))
  assert(workflow.includes("github.ref == 'refs/heads/main'"))
  assert(!/contents: write|gh release|publish always/.test(workflow))
  assert(
    (await readFile('scripts/build-win.mjs', 'utf8')).includes(
      "publish: 'never'"
    ) ||
      (await readFile('scripts/build-win.mjs', 'utf8')).includes(
        "publish:'never'"
      )
  )
})

test('release notes summarize actual conventional history and keep publishing manual', () => {
  const notes = renderNotes(
    [
      {
        hash: 'abcdef012345',
        subject: 'feat(terminal): preserve Unicode',
        body: 'Closes #12\nRefs #12\nRefs #14'
      },
      { hash: 'deadbeef0123', subject: 'fix(ui): restore focus', body: '' },
      { hash: 'aaaaaaa', subject: 'unstructured message', body: '' }
    ],
    'synthetic-source'
  )
  assert(notes.includes('preserve Unicode (abcdef0) — #12, #14'))
  assert(notes.includes('restore focus'))
  assert(!notes.includes('unstructured message'))
  assert(notes.includes('not a public beta approval'))
  assert.throws(() => generateNotes('--all', 'HEAD'), /Invalid/)
  assert(generateNotes(undefined, 'HEAD').includes('Source:'))
})

test('public beta gate rejects unqualified Server artifacts and unapproved signing or release', async () => {
  const template = JSON.parse(
    await readFile('release/qualification.json', 'utf8')
  )
  assert(releaseBlockers(template).length >= 10)
  const sourceCommit = 'a'.repeat(40),
    sha = 'b'.repeat(64)
  const report = {
    passed: true,
    productType: 1,
    build: 19045,
    sourceCommit,
    installerSha256: sha
  }
  const value = {
    version: '1.2.3-beta.1',
    sourceCommit,
    installer: {
      sha256: sha,
      signatureStatus: 'Valid',
      publisher: 'Synthetic test identity'
    },
    checks: {
      requiredCi: true,
      securityAudit: true,
      performanceBudgetsApproved: true,
      windowsNarrator: true,
      manualKeyboard: true
    },
    windows10: report,
    windows11: { ...report, build: 26100 },
    signingDecision: {
      approved: true,
      provider: 'Synthetic test provider',
      publisher: 'Synthetic test identity'
    },
    releaseApproval: {
      approved: true,
      by: 'Synthetic test owner',
      at: '2026-01-01T00:00:00Z'
    }
  }
  assert.deepEqual(releaseBlockers(value), [])
  assert.deepEqual(
    releaseBlockers({
      ...value,
      installer: { ...value.installer, sha256: sha.toUpperCase() }
    }),
    []
  )
  assert(
    releaseBlockers({
      ...value,
      windows10: { ...report, productType: 3 }
    }).some((value) => value.includes('windows10'))
  )
  assert(
    releaseBlockers({
      ...value,
      windows11: { ...value.windows11, installerSha256: 'c'.repeat(64) }
    }).some((value) => value.includes('windows11'))
  )
  assert(
    releaseBlockers({ ...value, releaseApproval: { approved: false } }).some(
      (value) => value.includes('owner release')
    )
  )
})
