import { Buffer } from 'node:buffer';
import assert from 'node:assert/strict';
import test from 'node:test';
import { createHash } from 'node:crypto';
import { mkdtemp, readFile, writeFile, rm } from 'node:fs/promises';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import {
  selectRelease,
  verifyRelease,
  refreshFeatured,
} from '../scripts/refresh-alpha.mjs';

function fixture(version = '0.2.0-alpha.5') {
  const base = 'https://github.com/dineshkorukonda/TerminalOne/releases';
  const installer = `TerminalOne-${version}-unsigned-x64.exe`;
  const bytes = Buffer.from('synthetic installer bytes');
  const hash = (data, algorithm = 'sha256') =>
    createHash(algorithm)
      .update(data)
      .digest(algorithm === 'sha512' ? 'base64' : 'hex');
  const files = new Map([
    [installer, bytes],
    [
      'release-manifest.json',
      Buffer.from(
        JSON.stringify({
          schema: 1,
          sourceCommit: 'a'.repeat(40),
          version,
          tag: `v${version}`,
          installer: { file: installer, sha256: hash(bytes) },
        }),
      ),
    ],
    ['SHA256SUMS.txt', Buffer.from(`${hash(bytes)}  ${installer}\n`)],
    ['alpha-notes.md', Buffer.from(`# Terminal One v${version}\n`)],
    [
      'alpha.yml',
      Buffer.from(
        `version: ${version}\npath: ${installer}\nsize: ${bytes.length}\nsha512: ${hash(bytes, 'sha512')}\n`,
      ),
    ],
  ]);
  const release = {
    draft: false,
    prerelease: true,
    tag_name: `v${version}`,
    html_url: `${base}/tag/v${version}`,
    published_at: '2026-10-24T00:00:00Z',
    assets: [...files].map(([name, data], index) => ({
      id: index + 1,
      name,
      size: data.length,
      state: 'uploaded',
      digest: `sha256:${hash(data)}`,
      browser_download_url: `${base}/download/v${version}/${name}`,
    })),
  };
  return { release, files };
}
test('discovers the newest complete published alpha and excludes drafts/stable/incomplete releases', () => {
  const good = fixture();
  assert.equal(
    selectRelease([
      { ...fixture('0.2.0-alpha.20').release, draft: true },
      { ...fixture('0.2.0-alpha.10').release, assets: [] },
      good.release,
    ]).tag_name,
    good.release.tag_name,
  );
  assert.throws(() => selectRelease([{ ...good.release, prerelease: false }]));
  assert.throws(() => selectRelease(null));
});
test('verifies matching manifest, checksum, notes, metadata and actual installer bytes', () => {
  const { release, files } = fixture();
  assert.equal(verifyRelease(release, files).version, '0.2.0-alpha.5');
  for (const name of files.keys()) {
    const corrupt = new Map(files);
    corrupt.set(name, Buffer.from('tampered'));
    assert.throws(() => verifyRelease(release, corrupt));
  }
  for (const change of [
    { draft: true },
    { published_at: 'bad' },
    { html_url: 'https://other.example' },
    { assets: [...release.assets, release.assets[0]] },
    { assets: release.assets.map((asset) => ({ ...asset, size: -1 })) },
  ])
    assert.throws(() => verifyRelease({ ...release, ...change }, files));
  const changedManifest = new Map(files);
  const manifest = JSON.parse(files.get('release-manifest.json'));
  manifest.version = '0.2.0-alpha.6';
  changedManifest.set(
    'release-manifest.json',
    Buffer.from(JSON.stringify(manifest)),
  );
  const metadataWithoutDigests = {
    ...release,
    assets: release.assets.map((asset) => ({
      ...asset,
      digest: null,
      size: changedManifest.get(asset.name).length,
    })),
  };
  assert.throws(() => verifyRelease(metadataWithoutDigests, changedManifest));
});
test('failed verification/download and dry run retain the last pin; successful update is atomic and never downgrades', async (t) => {
  const directory = await mkdtemp(join(tmpdir(), 'alpha-data-'));
  t.after(() => rm(directory, { recursive: true, force: true }));
  const path = join(directory, 'featured.json');
  const before =
    JSON.stringify({
      version: '0.2.0-alpha.4',
      publishedOn: '2026-10-20',
      sizeBytes: 1,
      sha256: 'b'.repeat(64),
    }) + '\n';
  await writeFile(path, before);
  const { release, files } = fixture();
  const options = {
    path,
    releases: [release],
    download: async (asset) => files.get(asset.name),
  };
  await assert.rejects(
    refreshFeatured({
      ...options,
      download: async () => {
        throw new Error('download failed');
      },
    }),
  );
  assert.equal(await readFile(path, 'utf8'), before);
  await refreshFeatured({ ...options, check: true });
  assert.equal(await readFile(path, 'utf8'), before);
  await refreshFeatured(options);
  const after = await readFile(path, 'utf8');
  assert.equal(JSON.parse(after).version, '0.2.0-alpha.5');
  assert.equal((await refreshFeatured(options)).changed, false);
  await assert.rejects(
    refreshFeatured({
      ...options,
      releases: [fixture('0.2.0-alpha.3').release],
    }),
  );
  assert.equal(await readFile(path, 'utf8'), after);
});
