import { readFile, writeFile, appendFile } from 'node:fs/promises'
import { fileURLToPath } from 'node:url'

export function alphaVersion(version, run) {
  const base = /^(\d+\.\d+\.\d+)(?:-alpha\.\d+)?$/.exec(version)?.[1]
  if (!base || !/^[1-9]\d*$/.test(String(run)))
    throw new Error(
      'An alpha base version and positive workflow run number are required'
    )
  return `${base}-alpha.${run}`
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const metadata = JSON.parse(await readFile('package.json', 'utf8'))
  const lock = JSON.parse(await readFile('package-lock.json', 'utf8'))
  const version = alphaVersion(metadata.version, process.env.GITHUB_RUN_NUMBER)
  metadata.version = lock.version = lock.packages[''].version = version
  await writeFile('package.json', JSON.stringify(metadata, null, 2) + '\n')
  await writeFile('package-lock.json', JSON.stringify(lock, null, 2) + '\n')
  if (process.env.GITHUB_OUTPUT)
    await appendFile(
      process.env.GITHUB_OUTPUT,
      `version=${version}\ntag=v${version}\n`
    )
  console.log(version)
}
