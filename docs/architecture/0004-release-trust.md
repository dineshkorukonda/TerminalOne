# Decision 0004: signing and update trust

## Current decision

Installer builds are unsigned development artifacts. The build API uses publish: never, configuration has no publishing provider, and workflows have read-only repository contents permissions. There is no update client, feed, background request, release creation or signing credential in the application. Feature-branch workflows cannot publish. Version-tag artifact builds require the tag to match package.json and still cannot publish.

No signing provider, legal publisher identity, certificate budget or signing credentials have been approved. Issue #41 is strategy-only until the owner makes those decisions and an actual signed artifact is verified. A GitHub username is not fabricated into an Authenticode identity. Unsigned files are labeled in filenames, installer metadata, checksums, evidence and documentation.

## Signing path to approve

The owner can select an identity-verified remote signing service with restricted CI/OIDC access, or an OV/EV certificate using a supported hardware/HSM-backed key. Compare legal identity eligibility, budget, timestamp support, Windows verification and CI access before purchase. No provider enrollment or expenditure is authorized by this document.

An approved implementation must sign application executables, the Job Object helper, native components as required, and the final installer, then verify the expected publisher and trusted RFC 3161 timestamp on Windows. Keep keys outside the repository and logs; prefer short-lived scoped identities over exported private keys. Build and release permissions must remain separate, with a protected owner-approved signing/publishing environment. A checksum records the exact downloaded file; it does not authenticate an unsigned publisher or promise byte-identical rebuilds.

## Update architecture for a later implementation

Issue #42 defines this architecture; it does not authorize an update service. A future implementation must be separately approved, default to no background checks until opt-in/channel configuration, and keep core terminal use offline. It must disclose any outgoing request and exclude commands, output, history, credentials and project paths.

Use HTTPS plus an authenticated signed manifest, exact artifact SHA256, expected Authenticode publisher and validated channel/version. Transport encryption alone is insufficient. Restrict stable/beta channels explicitly and reject unsigned artifacts, mismatched publishers, tampered manifests and unintended downgrades. Key compromise requires pausing distribution, a reviewed key transition and trusted replacement artifacts; no silent trust-on-first-use change is acceptable.

Download to a staging location. Verify before replacing anything. Failed download, verification or install keeps the current executable usable. An explicit rollback must use a previously verified signed installer and compatible settings migration; never recover by executing an unverified cached binary. Do not overwrite active terminal processes: obtain user consent, close owned sessions through their normal lifecycle, flush local data, and only then hand off to the installer. Persist no automatic command replay.

The release workflow currently produces reviewable artifacts and draft notes only. Any future publishing workflow needs main/tag-only source checks, protected environment approval, least privileges, signature/checksum verification and completed client-OS qualification. The qualification checklist is evidence bookkeeping, not an authentication mechanism or an authorization to publish.

References: [Electron fuses](https://www.electronjs.org/docs/latest/tutorial/fuses), [electron-builder publishing](https://www.electron.build/docs/publish/), [NSIS configuration](https://www.electron.build/docs/nsis/).
