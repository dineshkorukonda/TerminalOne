import { build, Platform, Arch } from 'electron-builder'
import { getCurrentFuseWire, FuseV1Options, FuseState } from '@electron/fuses'
import { access, readFile, writeFile, mkdir } from 'node:fs/promises'
import { createHash } from 'node:crypto'
import { basename, join } from 'node:path'
import { execFileSync } from 'node:child_process'
import config from '../electron-builder.config.mjs'

if (process.platform !== 'win32' || process.arch !== 'x64')
  throw new Error('Windows x64 is required for the installer build')
if (config.publish !== null || config.win.signExecutable !== false)
  throw new Error('This workflow permits unsigned non-publishing builds only')
const metadata = JSON.parse(await readFile('package.json', 'utf8'))
if (
  process.env.GITHUB_REF?.startsWith('refs/tags/') &&
  process.env.GITHUB_REF !== `refs/tags/v${metadata.version}`
)
  throw new Error('Version tag must match package.json')
await access('native/pty-job-host.exe')
await access('node_modules/node-pty/build/Release/conpty.node')
await access('shell/bashrc')
await access('shell/blesh/ble.sh')
await access('shell/blesh/doc/LICENSE.md')
const artifacts = await build({
  targets: Platform.WINDOWS.createTarget(['nsis'], Arch.x64),
  publish: 'never',
  config
})
const installers = artifacts.filter((path) => path.endsWith('.exe'))
for (const file of [
  'bashrc',
  'adapters.bash',
  'blesh/ble.sh',
  'blesh/doc/LICENSE.md'
])
  await access(
    join(config.directories.output, 'win-unpacked/resources/shell', file)
  )
if (
  installers.length !== 1 ||
  !basename(installers[0]).includes('-unsigned-x64')
)
  throw new Error('Unexpected installer artifacts')
const executable = join(
  config.directories.output,
  'win-unpacked/TerminalOne.exe'
)
const fuses = await getCurrentFuseWire(executable)
for (const option of [
  FuseV1Options.RunAsNode,
  FuseV1Options.EnableNodeOptionsEnvironmentVariable,
  FuseV1Options.EnableNodeCliInspectArguments
]) {
  if (fuses[option] !== FuseState.DISABLE)
    throw new Error('Unsafe packaged fuse state')
}
for (const option of [
  FuseV1Options.EnableEmbeddedAsarIntegrityValidation,
  FuseV1Options.OnlyLoadAppFromAsar
]) {
  if (fuses[option] !== FuseState.ENABLE)
    throw new Error('Missing packaged archive fuse')
}
await access(
  join(
    config.directories.output,
    'win-unpacked/resources/app.asar.unpacked/native/pty-job-host.exe'
  )
)
await access(
  join(
    config.directories.output,
    'win-unpacked/resources/app.asar.unpacked/node_modules/node-pty/lib/worker/conoutSocketWorker.js'
  )
)
const checksums = await Promise.all(
  installers.map(async (file) => ({
    file: basename(file),
    sha256: createHash('sha256')
      .update(await readFile(file))
      .digest('hex')
  }))
)
await writeFile(
  join(config.directories.output, 'SHA256SUMS.txt'),
  checksums.map((item) => `${item.sha256}  ${item.file}`).join('\n') + '\n'
)
await mkdir('test-results/installer', { recursive: true })
await writeFile(
  'test-results/installer/build.json',
  JSON.stringify(
    {
      version: metadata.version,
      commit: execFileSync('git', ['rev-parse', 'HEAD'], {
        encoding: 'utf8'
      }).trim(),
      arch: process.arch,
      unsigned: true,
      publishing: false,
      fuses,
      checksums
    },
    null,
    2
  )
)
console.log(
  'Unsigned Windows installer built; archive and native paths verified; publishing disabled.'
)
