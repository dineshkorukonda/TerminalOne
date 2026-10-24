// Every featured field is replaced together after release verification.
import featured from './featured-alpha.json';
const { version } = featured;
const tag = `v${version}`;
const releaseUrl = `https://github.com/dineshkorukonda/TerminalOne/releases/tag/${tag}`;
const assetsUrl = `https://github.com/dineshkorukonda/TerminalOne/releases/download/${tag}`;
const installerName = `TerminalOne-${version}-unsigned-x64.exe`;

export const alphaRelease = {
  ...featured,
  tag,
  releaseUrl,
  installerName,
  installerUrl: `${assetsUrl}/${installerName}`,
  checksumsUrl: `${assetsUrl}/SHA256SUMS.txt`,
  notesUrl: `${assetsUrl}/alpha-notes.md`,
};
