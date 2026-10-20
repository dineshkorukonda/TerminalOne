import { createHash } from 'node:crypto'
import { readFile, mkdir, rm, access } from 'node:fs/promises'
import { execFileSync } from 'node:child_process'
import { resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

import { shellResources } from './shell-resources.mjs'

const archive = 'vendor/ble.tar.xz'
const expected =
  '7a2445f138e7f099dd5dee749391a8b045646d1b8a605975885be5b34b6b5f7e'
if (
  createHash('sha256')
    .update(await readFile(archive))
    .digest('hex') !== expected
)
  throw new Error('Bundled Bash editor checksum mismatch')
const destination = resolve('shell/blesh')
if (destination !== fileURLToPath(new URL('../shell/blesh', import.meta.url)))
  throw new Error('Run shell preparation from the repository root')
// This directory contains generated files only; remove stale upstream modules.
await rm(destination, { recursive: true, force: true })
await mkdir(destination, { recursive: true })
execFileSync('tar', [
  '-xf',
  archive,
  '--strip-components=1',
  '-C',
  'shell/blesh'
])
for (const file of shellResources) await access(resolve('shell', file))
console.log('Verified and prepared bundled Bash editor.')
