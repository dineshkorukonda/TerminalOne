import { Buffer } from 'node:buffer';
import { execFileSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { readFile, rename, writeFile, appendFile } from 'node:fs/promises';
import { fileURLToPath, URL } from 'node:url';
import process from 'node:process';

const repository = 'dineshkorukonda/TerminalOne';
const releaseBase = `https://github.com/${repository}/releases`;
const metadataPath = fileURLToPath(
  new URL('../src/data/featured-alpha.json', import.meta.url),
);
const digest = (bytes) => createHash('sha256').update(bytes).digest('hex');
const versionParts = (version) => {
  const match = /^(\d+)\.(\d+)\.(\d+)-alpha\.(\d+)$/.exec(version);
  if (
    !match ||
    match.slice(1).some((part) => !Number.isSafeInteger(Number(part)))
  )
    throw new Error('Invalid alpha version');
  return match.slice(1).map(Number);
};
export function compareVersions(left, right) {
  const a = versionParts(left),
    b = versionParts(right);
  for (let index = 0; index < a.length; index++)
    if (a[index] !== b[index]) return a[index] - b[index];
  return 0;
}
function releaseAssets(release) {
  if (
    release?.draft !== false ||
    release.prerelease !== true ||
    !/^v\d+\.\d+\.\d+-alpha\.\d+$/.test(release.tag_name ?? '') ||
    !Array.isArray(release.assets)
  )
    throw new Error('Not a published alpha');
  const version = release.tag_name.slice(1);
  versionParts(version);
  if (
    release.html_url !== `${releaseBase}/tag/v${version}` ||
    typeof release.published_at !== 'string' ||
    !/^\d{4}-\d{2}-\d{2}T/.test(release.published_at) ||
    !Number.isFinite(Date.parse(release.published_at))
  )
    throw new Error('Invalid release metadata');
  const names = [
    `TerminalOne-${version}-unsigned-x64.exe`,
    'SHA256SUMS.txt',
    'alpha-notes.md',
    'release-manifest.json',
    'alpha.yml',
  ];
  return names.map((name) => {
    const matches = release.assets.filter((asset) => asset.name === name);
    const asset = matches[0];
    if (
      matches.length !== 1 ||
      asset.state !== 'uploaded' ||
      !Number.isSafeInteger(asset.id) ||
      asset.id < 1 ||
      !Number.isSafeInteger(asset.size) ||
      asset.size < 1 ||
      asset.size > (name.endsWith('.exe') ? 512 * 1024 * 1024 : 1024 * 1024) ||
      asset.browser_download_url !==
        `${releaseBase}/download/v${version}/${name}`
    )
      throw new Error(`Incomplete alpha asset: ${name}`);
    return asset;
  });
}
export function selectRelease(releases) {
  if (!Array.isArray(releases)) throw new Error('Invalid release listing');
  const candidates = releases
    .filter((release) => {
      try {
        releaseAssets(release);
        return true;
      } catch {
        return false;
      }
    })
    .sort((left, right) =>
      compareVersions(right.tag_name.slice(1), left.tag_name.slice(1)),
    );
  if (!candidates[0]) throw new Error('No complete published alpha found');
  return candidates[0];
}
export function verifyRelease(release, files) {
  const assets = releaseAssets(release);
  const version = release.tag_name.slice(1);
  for (const asset of assets) {
    const bytes = files.get(asset.name);
    if (
      !Buffer.isBuffer(bytes) ||
      bytes.length !== asset.size ||
      (asset.digest != null && asset.digest !== `sha256:${digest(bytes)}`)
    )
      throw new Error(
        `Asset bytes do not match GitHub metadata: ${asset.name}`,
      );
  }
  const manifest = JSON.parse(
    files.get('release-manifest.json').toString('utf8'),
  );
  const installer = assets[0];
  if (
    manifest.schema !== 1 ||
    manifest.version !== version ||
    manifest.tag !== release.tag_name ||
    !/^[a-f0-9]{40}$/.test(manifest.sourceCommit ?? '') ||
    manifest.installer?.file !== installer.name ||
    !/^[a-f0-9]{64}$/.test(manifest.installer?.sha256 ?? '') ||
    digest(files.get(installer.name)) !== manifest.installer.sha256 ||
    files.get('SHA256SUMS.txt').toString('utf8') !==
      `${manifest.installer.sha256}  ${installer.name}\n`
  )
    throw new Error('Release manifest, installer and checksum disagree');
  if (!files.get('alpha-notes.md').toString('utf8').includes(`v${version}`))
    throw new Error('Notes do not identify this alpha');
  const update = files.get('alpha.yml').toString('utf8');
  if (
    !update.startsWith(`version: ${version}\n`) ||
    !update.includes(`path: ${installer.name}\n`) ||
    !update.includes(`size: ${installer.size}\n`) ||
    !update.includes(
      `sha512: ${createHash('sha512').update(files.get(installer.name)).digest('base64')}\n`,
    )
  )
    throw new Error('Update metadata does not match installer');
  return {
    version,
    publishedOn: release.published_at.slice(0, 10),
    sizeBytes: installer.size,
    sha256: manifest.installer.sha256,
  };
}
export async function refreshFeatured({
  releases,
  download,
  path = metadataPath,
  check = false,
}) {
  const release = selectRelease(releases);
  const current = JSON.parse(
    (await readFile(path, 'utf8')).replace(/^\uFEFF/, ''),
  );
  if (compareVersions(release.tag_name.slice(1), current.version) < 0)
    throw new Error('Refusing to downgrade the featured alpha');
  const files = new Map();
  // Download only fixed, validated asset IDs from the fixed repository.
  for (const asset of releaseAssets(release))
    files.set(asset.name, await download(asset));
  const next = verifyRelease(release, files);
  if (
    next.version === current.version &&
    (next.sha256 !== current.sha256 || next.sizeBytes !== current.sizeBytes)
  )
    throw new Error('Previously verified release bytes changed');
  const serialized = JSON.stringify(next, null, 2) + '\n';
  const changed = JSON.stringify(current) !== JSON.stringify(next);
  if (changed && !check) {
    const temporary = `${path}.tmp`;
    await writeFile(temporary, serialized, { flag: 'wx' });
    await rename(temporary, path);
  }
  return { changed, version: next.version };
}
if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const gh = (args, maxBuffer = 1024 * 1024) =>
    execFileSync('gh', args, { maxBuffer, stdio: ['ignore', 'pipe', 'pipe'] });
  const pages = JSON.parse(
    gh([
      'api',
      `repos/${repository}/releases?per_page=100`,
      '--paginate',
      '--slurp',
    ]).toString('utf8'),
  );
  const result = await refreshFeatured({
    releases: pages.flat(),
    check: process.argv.includes('--check'),
    download: async (asset) =>
      gh(
        [
          'api',
          `repos/${repository}/releases/assets/${asset.id}`,
          '-H',
          'Accept: application/octet-stream',
        ],
        asset.size + 1024,
      ),
  });
  if (process.env.GITHUB_OUTPUT)
    await appendFile(
      process.env.GITHUB_OUTPUT,
      `changed=${result.changed}\nversion=${result.version}\n`,
    );
  process.stdout.write(
    `Verified featured alpha ${result.version}; changed=${result.changed}\n`,
  );
}
