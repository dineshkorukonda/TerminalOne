import { execFileSync } from 'node:child_process'
import { createHash } from 'node:crypto'
import {
  readFile,
  writeFile,
  readdir,
  mkdtemp,
  rm,
  appendFile,
  mkdir
} from 'node:fs/promises'
import { join, resolve } from 'node:path'
import { tmpdir } from 'node:os'
import { fileURLToPath } from 'node:url'

const sha256 = (data) => createHash('sha256').update(data).digest('hex')
const json = async (path) => JSON.parse(await readFile(path, 'utf8'))

export function updateMetadata(version, filename, bytes) {
  const sha512 = createHash('sha512').update(bytes).digest('base64')
  return `version: ${version}\nfiles:\n  - url: ${filename}\n    sha512: ${sha512}\n    size: ${bytes.length}\npath: ${filename}\nsha512: ${sha512}\n`
}

function identity(manifest, source, version) {
  if (
    manifest.schema !== 1 ||
    !/^\d+\.\d+\.\d+-alpha\.\d+$/.test(version) ||
    !/^[a-f0-9]{40}$/.test(source) ||
    manifest.sourceCommit !== source ||
    manifest.version !== version ||
    manifest.tag !== `v${version}` ||
    manifest.installer?.file !== `TerminalOne-${version}-unsigned-x64.exe` ||
    !/^[a-f0-9]{64}$/.test(manifest.installer?.sha256 ?? '')
  )
    throw new Error(
      'Alpha release identity does not match the expected source/version'
    )
}

export async function validateBundle(directory, source, version) {
  const manifest = await json(join(directory, 'release-manifest.json'))
  identity(manifest, source, version)
  const expected = [
    manifest.installer.file,
    'SHA256SUMS.txt',
    'alpha-notes.md',
    'alpha.yml',
    'release-manifest.json'
  ].sort()
  if (
    JSON.stringify((await readdir(directory)).sort()) !==
    JSON.stringify(expected)
  )
    throw new Error(
      'Release bundle must contain exactly the installer, checksum, notes, update metadata and manifest'
    )
  const checksum = `${manifest.installer.sha256}  ${manifest.installer.file}\n`
  if (
    (await readFile(join(directory, 'SHA256SUMS.txt'), 'utf8')) !== checksum ||
    sha256(await readFile(join(directory, manifest.installer.file))) !==
      manifest.installer.sha256
  )
    throw new Error('Alpha installer checksum mismatch')
  const expectedUpdate = updateMetadata(
    version,
    manifest.installer.file,
    await readFile(join(directory, manifest.installer.file))
  )
  if ((await readFile(join(directory, 'alpha.yml'), 'utf8')) !== expectedUpdate)
    throw new Error('Alpha update metadata does not match the installer')
  return manifest
}

export async function prepareBundle(root, source, version) {
  const directory = join(root, 'artifacts/windows')
  const build = await json(join(root, 'test-results/installer/build.json'))
  const installed = await json(
    join(root, 'test-results/installer/installed.json')
  )
  const installer = {
    file: `TerminalOne-${version}-unsigned-x64.exe`,
    sha256: build.checksums?.[0]?.sha256
  }
  const manifest = {
    schema: 1,
    sourceCommit: source,
    version,
    tag: `v${version}`,
    installer
  }
  identity(manifest, source, version)
  if (
    build.commit !== source ||
    build.version !== version ||
    build.unsigned !== true ||
    build.publishing !== false ||
    build.arch !== 'x64' ||
    build.checksums?.length !== 1 ||
    build.checksums[0].file !== installer.file ||
    installed.passed !== true ||
    installed.unsigned !== true ||
    installed.installerChecksum?.toLowerCase() !== installer.sha256
  )
    throw new Error(
      'Build and installed-app evidence must match the alpha installer'
    )
  if (
    sha256(await readFile(join(directory, installer.file))) !== installer.sha256
  )
    throw new Error('Built installer checksum mismatch')
  if (
    (await readFile(join(directory, 'SHA256SUMS.txt'), 'utf8')) !==
    `${installer.sha256}  ${installer.file}\n`
  )
    throw new Error('Build checksum list mismatch')
  const notes =
    `# Terminal One v${version}\n\nExperimental unsigned Windows x64 alpha from ${source}.\n\nThis is not a stable or beta release. Windows Server CI does not establish manual Windows 10/11, Narrator or IME qualification. See docs/release-readiness.md.\n\n` +
    (await readFile(join(root, 'test-results/release-notes.md'), 'utf8'))
  // A separate allowlisted directory excludes unpacked executables and test traces.
  const bundle = join(root, 'artifacts/alpha-release')
  await mkdir(bundle, { recursive: true })
  await writeFile(
    join(bundle, installer.file),
    await readFile(join(directory, installer.file))
  )
  await writeFile(
    join(bundle, 'SHA256SUMS.txt'),
    `${installer.sha256}  ${installer.file}\n`
  )
  await writeFile(
    join(bundle, 'release-manifest.json'),
    JSON.stringify(manifest, null, 2) + '\n'
  )
  await writeFile(join(bundle, 'alpha-notes.md'), notes)
  await writeFile(
    join(bundle, 'alpha.yml'),
    updateMetadata(
      version,
      installer.file,
      await readFile(join(directory, installer.file))
    )
  )
  await validateBundle(bundle, source, version)
  return manifest
}

// gh runs as a subprocess with argv, never a shell. Only explicit 404s are absent;
// authorization, rate-limit and transport errors must stop publication.
export function githubCommand(args, optional = false) {
  try {
    return execFileSync('gh', args, {
      encoding: 'utf8',
      stdio: ['ignore', 'pipe', 'pipe']
    }).trim()
  } catch (error) {
    if (optional && /\(HTTP 404\)/.test(String(error.stderr))) return null
    throw new Error(`GitHub command failed: ${args.slice(0, 2).join(' ')}`, {
      cause: error
    })
  }
}

export async function publishBundle(
  directory,
  { repository, source, version },
  gh = githubCommand
) {
  if (!/^[\w.-]+\/[\w.-]+$/.test(repository))
    throw new Error('Invalid GitHub repository')
  const manifest = await validateBundle(directory, source, version)
  const tag = manifest.tag
  const api = async (path, optional = false) => {
    const result = await gh(['api', `repos/${repository}/${path}`], optional)
    return result === null ? null : JSON.parse(result)
  }
  const reference = await api(`git/ref/tags/${tag}`, true)
  if (
    reference &&
    (reference.object.type !== 'commit' || reference.object.sha !== source)
  )
    throw new Error('Existing alpha tag points to a different source')
  let release = await api(`releases/tags/${tag}`, true)
  if (
    release &&
    (release.target_commitish !== source || release.prerelease !== true)
  )
    throw new Error('Existing release has a different source or channel')
  if (release && !release.draft && !reference)
    throw new Error('Published alpha is missing its source tag')
  const verifyRemote = async () => {
    const temp = await mkdtemp(join(tmpdir(), 'terminal-alpha-'))
    try {
      await gh([
        'release',
        'download',
        tag,
        '--repo',
        repository,
        '--dir',
        temp
      ])
      const remote = await validateBundle(temp, source, version)
      if (release.draft) {
        if (remote.installer.sha256 !== manifest.installer.sha256)
          throw new Error('Uploaded alpha differs from the validated build')
        for (const file of [
          'SHA256SUMS.txt',
          'alpha-notes.md',
          'alpha.yml',
          'release-manifest.json'
        ])
          if (
            !(await readFile(join(temp, file))).equals(
              await readFile(join(directory, file))
            )
          )
            throw new Error(
              'Uploaded alpha metadata differs from the validated build'
            )
      }
    } finally {
      await rm(temp, { recursive: true, force: true })
    }
  }
  if (release && !release.draft) {
    // A new build may have different NSIS timestamps. Verify the published
    // source and its own checksums, then leave those original bytes intact.
    await verifyRemote()
    return 'already-published'
  }
  if (!release) {
    await gh([
      'release',
      'create',
      tag,
      '--repo',
      repository,
      '--target',
      source,
      '--draft',
      '--prerelease',
      '--latest=false',
      '--title',
      `Terminal One ${tag}`,
      '--notes-file',
      join(directory, 'alpha-notes.md')
    ])
    release = { draft: true }
  }
  await gh([
    'release',
    'upload',
    tag,
    '--repo',
    repository,
    ...[
      manifest.installer.file,
      'SHA256SUMS.txt',
      'alpha-notes.md',
      'alpha.yml',
      'release-manifest.json'
    ].map((file) => join(directory, file)),
    '--clobber'
  ])
  await verifyRemote()
  await gh([
    'release',
    'edit',
    tag,
    '--repo',
    repository,
    '--draft=false',
    '--prerelease',
    '--latest=false'
  ])
  return 'published'
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const mode = process.argv[2]
  if (
    !['--prepare', '--dry-run', '--publish'].includes(mode) ||
    process.argv.length !== 3
  )
    throw new Error('Use --prepare, --dry-run or --publish')
  if (mode === '--publish' && process.env.GITHUB_REF !== 'refs/heads/main')
    throw new Error('Alpha publication requires the main branch')
  const source = process.env.GITHUB_SHA
  const version =
    mode === '--prepare'
      ? (await json('package.json')).version
      : process.env.RELEASE_VERSION
  const directory = resolve(
    process.env.RELEASE_DIRECTORY ?? 'artifacts/alpha-release'
  )
  const result =
    mode === '--prepare'
      ? await prepareBundle(process.cwd(), source, version)
      : mode === '--dry-run'
        ? await validateBundle(directory, source, version)
        : await publishBundle(directory, {
            repository: process.env.GITHUB_REPOSITORY,
            source,
            version
          })
  const message =
    mode === '--publish'
      ? `Alpha release ${result}: v${version}`
      : `Validated alpha bundle: v${version} (${source}); nothing published.`
  console.log(message)
  if (process.env.GITHUB_STEP_SUMMARY)
    await appendFile(process.env.GITHUB_STEP_SUMMARY, message + '\n')
  if (mode === '--prepare' && process.env.GITHUB_OUTPUT)
    await appendFile(
      process.env.GITHUB_OUTPUT,
      `version=${result.version}\ntag=${result.tag}\n`
    )
}
