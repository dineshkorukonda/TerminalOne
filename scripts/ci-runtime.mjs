import { createHash } from 'node:crypto'
import { execFileSync } from 'node:child_process'
import { lstat, mkdir, readFile, readdir, writeFile } from 'node:fs/promises'
import { join } from 'node:path'
import { fileURLToPath } from 'node:url'

const roots = [
  'out',
  'native/pty-job-host.exe',
  'node_modules/node-pty/build/Release',
  'shell/blesh'
]

async function snapshot(root, source, version) {
  if (
    !/^[a-f0-9]{40}$/.test(source) ||
    !/^\d+\.\d+\.\d+(?:-[0-9A-Za-z.-]+)?$/.test(version)
  )
    throw new Error('Invalid runtime source or version')
  const files = {}
  async function walk(relative) {
    const path = join(root, relative)
    const info = await lstat(path)
    if (info.isSymbolicLink())
      throw new Error('Runtime artifacts cannot contain symlinks')
    if (info.isDirectory()) {
      for (const name of (await readdir(path)).sort())
        await walk(`${relative}/${name}`)
    } else if (info.isFile()) {
      files[relative] = createHash('sha256')
        .update(await readFile(path))
        .digest('hex')
    } else throw new Error('Unsupported runtime artifact entry')
  }
  for (const directory of roots) await walk(directory)
  if (
    !Object.keys(files).some((name) => name.startsWith('out/')) ||
    !Object.keys(files).some((name) => name.endsWith('/conpty.node'))
  )
    throw new Error('Runtime build is incomplete')
  return { schema: 1, sourceCommit: source, version, files }
}

export async function writeRuntime(root, source, version) {
  const manifest = await snapshot(root, source, version)
  await mkdir(join(root, 'test-results'), { recursive: true })
  await writeFile(
    join(root, 'test-results/ci-runtime.json'),
    JSON.stringify(manifest, null, 2) + '\n'
  )
}

export async function verifyRuntime(root, source, version) {
  const manifest = JSON.parse(
    await readFile(join(root, 'test-results/ci-runtime.json'), 'utf8')
  )
  const current = await snapshot(root, source, version)
  const errors = []
  if (manifest.sourceCommit !== current.sourceCommit) {
    errors.push(
      `sourceCommit: expected ${manifest.sourceCommit}, got ${current.sourceCommit}`
    )
  }
  if (manifest.version !== current.version) {
    errors.push(`version: expected ${manifest.version}, got ${current.version}`)
  }
  const manifestFiles = manifest.files || {}
  const currentFiles = current.files || {}
  const missing = Object.keys(manifestFiles).filter((f) => !(f in currentFiles))
  const extra = Object.keys(currentFiles).filter((f) => !(f in manifestFiles))
  const changed = Object.keys(manifestFiles).filter(
    (f) => f in currentFiles && manifestFiles[f] !== currentFiles[f]
  )
  if (missing.length) {
    errors.push(
      `missing files (${missing.length}): ${missing.slice(0, 10).join(', ')}`
    )
  }
  if (extra.length) {
    errors.push(
      `extra files (${extra.length}): ${extra.slice(0, 10).join(', ')}`
    )
  }
  if (changed.length) {
    errors.push(
      `changed files (${changed.length}): ${changed.slice(0, 10).join(', ')}`
    )
  }
  if (errors.length) {
    throw new Error(
      `Shared runtime does not match this source, version and exact file bytes:\n${errors.join('\n')}`
    )
  }
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const mode = process.argv[2]
  if (process.argv.length !== 3 || !['--write', '--verify'].includes(mode))
    throw new Error('Use --write or --verify')
  const root = process.cwd()
  const source = execFileSync('git', ['rev-parse', 'HEAD'], {
    encoding: 'utf8'
  }).trim()
  if (process.env.GITHUB_SHA && source !== process.env.GITHUB_SHA)
    throw new Error('Checkout does not match the workflow source')
  const { version } = JSON.parse(
    await readFile(join(root, 'package.json'), 'utf8')
  )
  if (mode === '--write') await writeRuntime(root, source, version)
  else await verifyRuntime(root, source, version)
  console.log(
    `Shared runtime ${mode === '--write' ? 'recorded' : 'verified'}: ${source} ${version}`
  )
}
