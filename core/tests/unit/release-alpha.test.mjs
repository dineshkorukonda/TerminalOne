import assert from 'node:assert/strict'
import test from 'node:test'
import { createHash } from 'node:crypto'
import { mkdtemp, mkdir, readFile, writeFile, rm, cp } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import {
  prepareBundle,
  validateBundle,
  publishBundle,
  updateMetadata
} from '../../scripts/release-alpha.mjs'

const source = 'a'.repeat(40)
const version = '0.2.0-alpha.17'
const repository = 'synthetic/terminal'
const options = { source, version, repository }
const filename = `TerminalOne-${version}-unsigned-x64.exe`
const digest = (data) => createHash('sha256').update(data).digest('hex')

async function fixture(t) {
  const root = await mkdtemp(join(tmpdir(), 'terminal-release-test-'))
  t.after(() => rm(root, { recursive: true, force: true }))
  await mkdir(join(root, 'artifacts/windows'), { recursive: true })
  await mkdir(join(root, 'test-results/installer'), { recursive: true })
  const installer = Buffer.from(
    'synthetic installer bytes, never an executable'
  )
  const sha256 = digest(installer)
  const put = (file, value) =>
    writeFile(
      join(root, file),
      typeof value === 'string' || Buffer.isBuffer(value)
        ? value
        : JSON.stringify(value)
    )
  await put(`artifacts/windows/${filename}`, installer)
  await put('artifacts/windows/SHA256SUMS.txt', `${sha256}  ${filename}\n`)
  await put('test-results/installer/build.json', {
    version,
    commit: source,
    arch: 'x64',
    unsigned: true,
    publishing: false,
    checksums: [{ file: filename, sha256 }]
  })
  await put('test-results/installer/installed.json', {
    passed: true,
    unsigned: true,
    installerChecksum: sha256.toUpperCase()
  })
  await put(
    'test-results/release-notes.md',
    'Synthetic conventional-history notes.\n'
  )
  const directory = join(root, 'artifacts/alpha-release')
  return { root, directory, put }
}

function remote(
  directory,
  {
    existing = false,
    failUpload = false,
    corrupt = false,
    collision = false
  } = {}
) {
  const calls = []
  const gh = async (args) => {
    calls.push(args)
    if (args[0] === 'api') {
      if (args[1].includes('/git/ref/'))
        return collision || existing
          ? JSON.stringify({
              object: {
                type: 'commit',
                sha: collision ? 'b'.repeat(40) : source
              }
            })
          : null
      return existing
        ? JSON.stringify({
            target_commitish: source,
            prerelease: true,
            draft: false
          })
        : null
    }
    if (args[1] === 'upload' && failUpload)
      throw new Error('Synthetic upload failure')
    if (args[1] === 'download') {
      const target = args[args.indexOf('--dir') + 1]
      await cp(directory, target, { recursive: true })
      if (corrupt) await writeFile(join(target, filename), 'corrupted upload')
    }
    return ''
  }
  return { gh, calls }
}

test('prepare binds actual bytes to source, version and installed-app evidence', async (t) => {
  const f = await fixture(t)
  const manifest = await prepareBundle(f.root, source, version)
  assert.equal(manifest.tag, `v${version}`)
  assert.deepEqual(await validateBundle(f.directory, source, version), manifest)
  const notes = await readFile(join(f.directory, 'alpha-notes.md'), 'utf8')
  assert(
    notes.includes(source) && notes.includes('Synthetic conventional-history')
  )
  await f.put('test-results/installer/installed.json', {
    passed: true,
    unsigned: true,
    installerChecksum: 'b'.repeat(64)
  })
  await assert.rejects(prepareBundle(f.root, source, version), /evidence/)
})

test('tampering, extra assets, traversal and stable/beta channels cannot reach GitHub writes', async (t) => {
  const f = await fixture(t)
  await prepareBundle(f.root, source, version)
  await writeFile(join(f.directory, filename), 'tampered')
  const r = remote(f.directory)
  await assert.rejects(publishBundle(f.directory, options, r.gh), /checksum/)
  assert.equal(r.calls.length, 0)
  await prepareBundle(f.root, source, version)
  await writeFile(
    join(f.directory, 'private-trace.txt'),
    'synthetic forbidden extra file'
  )
  await assert.rejects(validateBundle(f.directory, source, version), /exactly/)
  await rm(join(f.directory, 'private-trace.txt'))
  for (const invalid of ['1.0.0', '1.0.0-beta.1', '../outside'])
    await assert.rejects(
      validateBundle(f.directory, source, invalid),
      /identity/
    )
})

test('update metadata is bound to installer bytes and rejects remote paths or hash tampering', async (t) => {
  const f = await fixture(t)
  await prepareBundle(f.root, source, version)
  const path = join(f.directory, 'alpha.yml')
  const original = await readFile(path, 'utf8')
  for (const altered of [
    original.replace(filename, 'https://evil.test/app.exe'),
    original.replace('sha512:', 'sha256:'),
    original.replace('size:', 'size: 999 #')
  ]) {
    await writeFile(path, altered)
    await assert.rejects(
      validateBundle(f.directory, source, version),
      /update metadata/
    )
  }
  await writeFile(path, original)
  await validateBundle(f.directory, source, version)
})

test('complete alpha stays draft until remote installer and metadata are verified', async (t) => {
  const f = await fixture(t)
  await prepareBundle(f.root, source, version)
  const r = remote(f.directory)
  assert.equal(await publishBundle(f.directory, options, r.gh), 'published')
  assert.deepEqual(
    r.calls.filter((c) => c[0] === 'release').map((c) => c[1]),
    ['create', 'upload', 'download', 'edit']
  )
  assert(r.calls.find((c) => c[1] === 'create').includes('--draft'))
  assert(r.calls.find((c) => c[1] === 'edit').includes('--latest=false'))
})

test('upload failure, corrupted remote assets and tag collisions never publish', async (t) => {
  const f = await fixture(t)
  await prepareBundle(f.root, source, version)
  for (const failure of [
    { failUpload: true },
    { corrupt: true },
    { collision: true }
  ]) {
    const r = remote(f.directory, failure)
    await assert.rejects(publishBundle(f.directory, options, r.gh))
    assert(!r.calls.some((c) => c[1] === 'edit'))
    if (failure.collision) assert(!r.calls.some((c) => c[0] === 'release'))
  }
})

test('published retry verifies original remote bytes and performs no mutations', async (t) => {
  const f = await fixture(t)
  await prepareBundle(f.root, source, version)
  const published = join(f.root, 'published')
  await cp(f.directory, published, { recursive: true })
  // A full rerun may produce different NSIS bytes for the same source/version.
  const rebuilt = Buffer.from(
    'synthetic rebuilt installer with a new timestamp'
  )
  await writeFile(join(f.directory, filename), rebuilt)
  const manifest = JSON.parse(
    await readFile(join(f.directory, 'release-manifest.json'), 'utf8')
  )
  manifest.installer.sha256 = digest(rebuilt)
  await writeFile(
    join(f.directory, 'release-manifest.json'),
    JSON.stringify(manifest)
  )
  await writeFile(
    join(f.directory, 'SHA256SUMS.txt'),
    `${digest(rebuilt)}  ${filename}\n`
  )
  await writeFile(
    join(f.directory, 'alpha.yml'),
    updateMetadata(version, filename, rebuilt)
  )
  const r = remote(published, { existing: true })
  assert.equal(
    await publishBundle(f.directory, options, r.gh),
    'already-published'
  )
  assert.deepEqual(
    r.calls.filter((c) => c[0] === 'release').map((c) => c[1]),
    ['download']
  )
  const bad = remote(f.directory, { existing: true, corrupt: true })
  await assert.rejects(publishBundle(f.directory, options, bad.gh), /checksum/)
})

test('interrupted draft can be completed by retrying with the same verified bundle', async (t) => {
  const f = await fixture(t)
  await prepareBundle(f.root, source, version)
  const r = remote(f.directory)
  const gh = async (args) =>
    args[0] === 'api' && args[1].includes('/releases/tags/')
      ? JSON.stringify({
          target_commitish: source,
          prerelease: true,
          draft: true
        })
      : r.gh(args)
  assert.equal(await publishBundle(f.directory, options, gh), 'published')
  assert(!r.calls.some((c) => c[1] === 'create'))
})
