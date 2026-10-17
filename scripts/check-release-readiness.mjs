import { readFile } from 'node:fs/promises'
import { fileURLToPath } from 'node:url'

export function releaseBlockers(value) {
  if (!value || typeof value !== 'object')
    return ['Qualification manifest is missing']
  const blockers = []
  if (!/^\d+\.\d+\.\d+(?:-(?:beta|rc)\.\d+)?$/.test(value.version ?? ''))
    blockers.push('A version is required')
  if (!/^[a-f0-9]{40}$/.test(value.sourceCommit ?? ''))
    blockers.push('An exact source commit is required')
  if (!/^[a-f0-9]{64}$/i.test(value.installer?.sha256 ?? ''))
    blockers.push('Actual installer SHA256 is required')
  if (
    value.installer?.signatureStatus !== 'Valid' ||
    !value.installer?.publisher
  )
    blockers.push('A verified signed installer and publisher are required')
  for (const check of [
    'requiredCi',
    'securityAudit',
    'performanceBudgetsApproved',
    'windowsNarrator',
    'manualKeyboard'
  ])
    if (value.checks?.[check] !== true)
      blockers.push(`${check} evidence/approval is missing`)
  for (const os of ['windows10', 'windows11']) {
    const report = value[os]
    const validBuild =
      Number.isInteger(report?.build) &&
      (os === 'windows10'
        ? report.build >= 19045 && report.build < 22000
        : report.build >= 22000)
    if (
      report?.passed !== true ||
      report?.productType !== 1 ||
      !validBuild ||
      report.sourceCommit !== value.sourceCommit ||
      typeof report.installerSha256 !== 'string' ||
      report.installerSha256.toLowerCase() !==
        value.installer?.sha256?.toLowerCase()
    )
      blockers.push(
        `${os} requires client-OS evidence for this exact source and installer`
      )
  }
  if (
    value.signingDecision?.approved !== true ||
    !value.signingDecision.provider ||
    value.signingDecision.publisher !== value.installer?.publisher
  )
    blockers.push('Owner signing provider/identity decision is missing')
  if (
    value.releaseApproval?.approved !== true ||
    !value.releaseApproval.by ||
    !Number.isFinite(Date.parse(value.releaseApproval.at))
  )
    blockers.push('Explicit dated owner release approval is missing')
  return blockers
}
if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const manifest = JSON.parse(
    await readFile(process.argv[2] ?? 'release/qualification.json', 'utf8')
  )
  const blockers = releaseBlockers(manifest)
  if (blockers.length) {
    console.error(
      'Public beta remains blocked:\n' +
        blockers.map((value) => `- ${value}`).join('\n')
    )
    process.exitCode = 1
  } else
    console.log(
      'Checklist fields are complete. This is not authorization or a publishing command; owner review and repository permissions still apply.'
    )
}
