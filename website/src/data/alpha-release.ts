// Verified against the published GitHub assets and matching release-manifest.json.
// Keep this release pinned so the installer, checksum and notes always agree.
const version = '0.2.0-alpha.4';
const tag = `v${version}`;
const releaseUrl = `https://github.com/dineshkorukonda/TerminalOne/releases/tag/${tag}`;
const assetsUrl = `https://github.com/dineshkorukonda/TerminalOne/releases/download/${tag}`;
const installerName = `TerminalOne-${version}-unsigned-x64.exe`;

export const alphaRelease = {
  version,
  tag,
  releaseUrl,
  installerName,
  installerUrl: `${assetsUrl}/${installerName}`,
  checksumsUrl: `${assetsUrl}/SHA256SUMS.txt`,
  notesUrl: `${assetsUrl}/alpha-notes.md`,
  publishedOn: '2026-10-20',
  sizeBytes: 118653689,
  sha256: '32afe7d5e5377c97f0152e753c1948044b94ba8173315f594d6894b70aef7353',
};
