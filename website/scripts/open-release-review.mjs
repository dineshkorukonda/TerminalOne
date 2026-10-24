import { execFileSync } from 'node:child_process';
import { appendFile, mkdtemp, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import process from 'node:process';

const repository = 'dineshkorukonda/TerminalOne';
export async function prepareReleaseReview(version, run) {
  if (!/^\d+\.\d+\.\d+-alpha\.[1-9]\d*$/.test(version))
    throw new Error('Invalid verified alpha version');
  const branch = `automation/98-alpha-${version}`;
  const existing = JSON.parse(
    run('gh', [
      'pr',
      'list',
      '--state',
      'open',
      '--base',
      'main',
      '--head',
      branch,
      '--json',
      'url',
    ]),
  );
  if (existing.length) return { branch, url: existing[0].url, manual: false };
  run('gh', ['auth', 'setup-git']);
  if (
    !run('git', [
      'ls-remote',
      '--heads',
      'origin',
      `refs/heads/${branch}`,
    ]).trim()
  ) {
    run('git', ['switch', '-c', branch]);
    run('git', ['config', 'user.name', 'github-actions[bot]']);
    run('git', [
      'config',
      'user.email',
      '41898282+github-actions[bot]@users.noreply.github.com',
    ]);
    run('git', ['add', 'website/src/data/featured-alpha.json']);
    run('git', [
      'commit',
      '-m',
      `chore(website): feature verified alpha ${version}`,
      '-m',
      'Replace featured metadata together after verifying published release assets, manifest and checksums.',
      '-m',
      'Refs #98',
    ]);
    run('git', ['push', 'origin', branch]);
  }
  const directory = await mkdtemp(join(tmpdir(), 'featured-alpha-review-'));
  try {
    const body = join(directory, 'body.md');
    await writeFile(
      body,
      `Feature the verified published alpha v${version}. Actual release asset bytes, metadata, manifest, checksums and notes were verified before replacing the single featured-data file. Static downloads remain available without JavaScript.\n\nNormal CI/review and owner merge authorization are required. Approve any workflow runs GitHub holds for this bot-created PR. Close superseded older metadata PRs before merging.\n\nRefs #98\n`,
    );
    try {
      const url = run('gh', [
        'pr',
        'create',
        '--base',
        'main',
        '--head',
        branch,
        '--title',
        `chore(website): feature verified alpha ${version}`,
        '--body-file',
        body,
      ]).trim();
      return { branch, url, manual: false };
    } catch {
      // The verified branch is already pushed. Keep it reviewable when the
      // repository prohibits bot PRs, without changing repository permissions.
      return {
        branch,
        url: `https://github.com/${repository}/compare/main...${branch}?expand=1`,
        manual: true,
      };
    }
  } finally {
    await rm(directory, { recursive: true, force: true });
  }
}
if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const result = await prepareReleaseReview(
    process.env.VERSION,
    (command, args) =>
      execFileSync(command, args, {
        encoding: 'utf8',
        stdio: ['ignore', 'pipe', 'pipe'],
      }),
  );
  const message = result.manual
    ? `Verified review branch prepared; automatic PR creation was unavailable. Open a PR: ${result.url}`
    : `Review PR ready: ${result.url}`;
  process.stdout.write(message + '\n');
  if (process.env.GITHUB_STEP_SUMMARY)
    await appendFile(process.env.GITHUB_STEP_SUMMARY, message + '\n');
}
