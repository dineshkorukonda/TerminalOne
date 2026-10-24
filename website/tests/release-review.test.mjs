import assert from 'node:assert/strict';
import test from 'node:test';
import { readFileSync } from 'node:fs';
import { prepareReleaseReview } from '../scripts/open-release-review.mjs';

for (const prohibited of [false, true])
  test(`review update remains usable when bot PR creation is ${prohibited ? 'prohibited' : 'allowed'}`, async () => {
    const calls = [];
    const result = await prepareReleaseReview(
      '0.2.0-alpha.10',
      (command, args) => {
        calls.push([command, args]);
        if (args[0] === 'pr' && args[1] === 'list') return '[]';
        if (args[0] === 'ls-remote') return '';
        if (args[0] === 'pr' && args[1] === 'create') {
          assert.match(
            readFileSync(args[args.indexOf('--body-file') + 1], 'utf8'),
            /owner merge authorization/,
          );
          if (prohibited)
            throw new Error('GitHub Actions cannot create pull requests');
          return 'https://github.com/dineshkorukonda/TerminalOne/pull/999';
        }
        return '';
      },
    );
    assert.equal(result.manual, prohibited);
    assert.ok(
      calls.some(([command, args]) => command === 'git' && args[0] === 'push'),
    );
    assert.deepEqual(calls.find(([, args]) => args[0] === 'add')[1], [
      'add',
      'website/src/data/featured-alpha.json',
    ]);
    assert.ok(
      !calls.some(
        ([, args]) => args.includes('merge') || args.includes('release'),
      ),
    );
    if (prohibited)
      assert.match(result.url, /compare\/main\.\.\.automation\/98-alpha-/);
  });
test('repeated preparation reuses an existing review PR without git mutations', async () => {
  const calls = [];
  const result = await prepareReleaseReview(
    '0.2.0-alpha.10',
    (command, args) => {
      calls.push(command);
      assert.equal(args[1], 'list');
      return '[{"url":"https://github.com/dineshkorukonda/TerminalOne/pull/999"}]';
    },
  );
  assert.equal(result.manual, false);
  assert.deepEqual(calls, ['gh']);
});
test('an existing pushed branch remains reviewable when policy prohibits PR creation', async () => {
  const calls = [];
  const result = await prepareReleaseReview(
    '0.2.0-alpha.14',
    (command, args) => {
      calls.push([command, args]);
      if (args[0] === 'pr' && args[1] === 'list') return '[]';
      if (args[0] === 'ls-remote')
        return (
          'a'.repeat(40) + ' refs/heads/automation/98-alpha-0.2.0-alpha.14'
        );
      if (args[0] === 'pr' && args[1] === 'create')
        throw new Error('Prohibited');
      return '';
    },
  );
  assert.equal(result.manual, true);
  assert.ok(
    !calls.some(
      ([command, args]) =>
        command === 'git' && ['push', 'commit', 'switch'].includes(args[0]),
    ),
  );
});
