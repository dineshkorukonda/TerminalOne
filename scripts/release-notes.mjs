import { execFileSync } from 'node:child_process'
import { writeFile, mkdir } from 'node:fs/promises'
import { dirname } from 'node:path'
import { fileURLToPath } from 'node:url'

export function allowedBuildRef(ref) {
  return (
    ref === 'refs/heads/main' ||
    /^refs\/tags\/v\d+\.\d+\.\d+(?:-(?:beta|rc)\.\d+)?$/.test(ref)
  )
}
export function renderNotes(records, revision) {
  const sections = new Map()
  for (const record of records) {
    const match =
      /^(feat|fix|docs|test|ci|chore|refactor|perf|build)(?:\([^\n)]*\))?!?: (.+)$/.exec(
        record.subject
      )
    if (!match) continue
    const entries = sections.get(match[1]) ?? []
    const issues = [
      ...new Set(
        [...record.body.matchAll(/(?:Closes|Fixes|Refs)\s+#(\d+)/gi)].map(
          (value) => `#${value[1]}`
        )
      )
    ]
    entries.push(
      `- ${match[2]} (${record.hash.slice(0, 7)})${issues.length ? ' — ' + issues.join(', ') : ''}`
    )
    sections.set(match[1], entries)
  }
  return (
    `# Terminal One release notes draft\n\nSource: ${revision}. Review against the linked issues and actual qualification evidence before release.\n\n` +
    [...sections]
      .map(([name, entries]) => `## ${name}\n\n${entries.join('\n')}`)
      .join('\n\n') +
    '\n\nUnsigned development artifacts are not a public beta approval. See docs/release-readiness.md for remaining qualification and owner decisions.\n'
  )
}
export function generateNotes(from, to = 'HEAD') {
  const validate = (ref) => {
    if (
      !/^(?:HEAD|[a-f0-9]{7,40}|v\d+\.\d+\.\d+(?:-(?:beta|rc)\.\d+)?)$/.test(
        ref
      )
    )
      throw new Error('Invalid release revision')
    return execFileSync('git', ['rev-parse', '--verify', `${ref}^{commit}`], {
      encoding: 'utf8'
    }).trim()
  }
  const end = validate(to)
  const range = from ? `${validate(from)}..${end}` : end
  const log = execFileSync(
    'git',
    ['log', '--format=%H%x1f%s%x1f%b%x1e', range, '--', '.', ':!website'],
    { encoding: 'utf8', maxBuffer: 4194304 }
  )
  const records = log
    .split('\x1e')
    .filter((value) => value.trim())
    .map((value) => {
      const [hash, subject, body] = value.trim().split('\x1f')
      return { hash, subject, body: body ?? '' }
    })
  return renderNotes(records, end)
}
if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const args = process.argv.slice(2)
  if (
    args.length % 2 ||
    args.some(
      (value, index) =>
        index % 2 === 0 && !['--from', '--to', '--output'].includes(value)
    )
  )
    throw new Error('Use --from TAG --to HEAD --output FILE')
  const options = Object.fromEntries(
    Array.from({ length: args.length / 2 }, (_, index) => [
      args[index * 2],
      args[index * 2 + 1]
    ])
  )
  const output = options['--output'] ?? 'test-results/release-notes.md'
  await mkdir(dirname(output), { recursive: true })
  await writeFile(
    output,
    generateNotes(options['--from'], options['--to'] ?? 'HEAD')
  )
  console.log('Reviewable release notes draft generated; nothing published.')
}
