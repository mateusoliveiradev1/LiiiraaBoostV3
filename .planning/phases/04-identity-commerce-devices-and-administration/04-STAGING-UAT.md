---
phase: 04-identity-commerce-devices-and-administration
plan: '25'
status: blocked-awaiting-human-verification
build_fingerprint: 9c9b721392aa38cb34427810e75f85a1de2d5cc13c5270b93a0e05a16e914a7f
prepared: 2026-08-05T18:11:30.2902444Z
---

# Phase 04 Invited-Staging UAT

This record is prepopulated from checked-in immutable evidence. It is **not an approval**. No clean-Windows, live-consent, hosted-origin, packaged-installer, downgrade, or rollback observation has been supplied yet.

## Exact Build Identity

| Identity                          | Exact value                                                               |
| --------------------------------- | ------------------------------------------------------------------------- |
| Source commit                     | `51770454aa1d17647c4fe734ae1e57f3e0b403b0`                                |
| OCI digest                        | `sha256:8f9aca95cc177780961812c2b984c9e24c04750155754f082072e463001c4ec2` |
| Desktop build                     | `internal-023001` (`Internal #023001`)                                    |
| Rollback build                    | `internal-023000`                                                         |
| Contract SHA-256                  | `3b74af5bd2fef336e455b4e98947864a4fae42455c7cce480ef257c5241a67e3`        |
| Schema SHA-256                    | `8f65790d1d8a88ad52ec27a5bde93095133ea86240f9e364b7d7ad98d68c299c`        |
| Build fingerprint                 | `9c9b721392aa38cb34427810e75f85a1de2d5cc13c5270b93a0e05a16e914a7f`        |
| Evidence manifest SHA-256         | `bb25e08315149ab35d7edae0b11ed13a817dce60e4a05364768929031a5a99a8`        |
| Real-PC coverage SHA-256          | `0965f860f98e683299d05bca29392b1c10dcc1370e5c09a1eed21497348329d1`        |
| Internal-channel manifest SHA-256 | `cf04781e403a0300e8a0f6c83aba229de76a84844f962cf51c91655e96c90276`        |

Canonical sources: `tooling/phase4-evidence/evidence-manifest.json`, `tooling/phase4-evidence/real-pc-coverage.json`, and `apps/desktop/staging/internal-channel.json`.

## Automated Invited-Alpha Gate

- Command: `pnpm phase4:verify -- --stage invited-alpha`
- Executed: `2026-08-05T18:11:30.2902444Z`
- Result: **FAIL CLOSED (expected while manual evidence is absent)**
- Highest allowed stage: `internal-staging`
- Diagnostic: `REAL_PC_COVERAGE_GAP`
- Owner review: required and not supplied

The evaluator reported these 20 uncollected requirements:

| Axis        | Required values                                                            | Current evidence |
| ----------- | -------------------------------------------------------------------------- | ---------------- |
| OS          | Windows 10; Windows 11                                                     | Not collected    |
| CPU         | Intel; AMD                                                                 | Not collected    |
| GPU         | NVIDIA; AMD; Intel                                                         | Not collected    |
| Form factor | Notebook; desktop                                                          | Not collected    |
| Storage     | NVMe; SATA SSD                                                             | Not collected    |
| Network     | Ethernet; Wi-Fi                                                            | Not collected    |
| Journey     | Clean install; upgrade; offline; failure; restoration; rollback; uninstall | Not collected    |

## Observation Targets

| Target             | Checked-in identity                               | Observation status                                     |
| ------------------ | ------------------------------------------------- | ------------------------------------------------------ |
| Public web origin  | Protected `PUBLIC_STAGING_ORIGIN` workflow value  | Not deployed or supplied for this UAT                  |
| Account origin     | Protected `ACCOUNT_STAGING_ORIGIN` workflow value | Not deployed or supplied for this UAT                  |
| Admin origin       | Protected `ADMIN_STAGING_ORIGIN` workflow value   | Not deployed or supplied for this UAT                  |
| API origin         | `https://liiiraa-api-staging.onrender.com`        | Manifest identity only; live reachability not verified |
| Desktop installer  | `Liiiraa Boost Internal 023001_x64-setup.exe`     | `not-published`; no packaged artifact supplied         |
| Rollback installer | `internal-023000`                                 | Immutable ID declared; artifact/location not supplied  |

Provider-preview origins are valid only for bounded invited testing. This record does not grant broader-beta, release-candidate, production, public-download, trusted-publisher, or SmartScreen-reputation authority.

## Real-PC Observation Cells

Add one row per real machine. Each row must identify the exact build above and link immutable evidence (screenshots/log excerpts/checksums without secrets). Do not infer one axis from another or replace an observation with a simulated/browser test.

| Cell ID   | Date/time UTC | Tester    | Windows edition/build | CPU/vendor | GPU/vendor/driver | Form factor | Storage   | Network   | Journeys exercised | Evidence reference/hash | Result  |
| --------- | ------------- | --------- | --------------------- | ---------- | ----------------- | ----------- | --------- | --------- | ------------------ | ----------------------- | ------- |
| _pending_ | _pending_     | _pending_ | _pending_             | _pending_  | _pending_         | _pending_   | _pending_ | _pending_ | _pending_          | _pending_               | PENDING |

## Checklist 1 — System-Browser Identity and Credential Custody

For each enabled path on clean supported Windows 10 and Windows 11, record PASS/FAIL and immutable evidence. A critical failure blocks approval.

| Check                                                                                                                                  | Windows/cell | Observation and evidence | Result  |
| -------------------------------------------------------------------------------------------------------------------------------------- | ------------ | ------------------------ | ------- |
| Verified-email sign-in completes through the external system browser and exact callback                                                | _pending_    | _pending_                | PENDING |
| Google sign-in completes through the external system browser and exact callback                                                        | _pending_    | _pending_                | PENDING |
| Discord sign-in completes through the external system browser and exact callback                                                       | _pending_    | _pending_                | PENDING |
| Passkey enrollment and sign-in complete with expected user verification                                                                | _pending_    | _pending_                | PENDING |
| MFA enrollment/challenge and recovery/contest paths follow the locked policy                                                           | _pending_    | _pending_                | PENDING |
| Credential Manager contains only the expected app credential custody                                                                   | _pending_    | _pending_                | PENDING |
| No provider password, verifier, bearer token, or refresh token appears in WebView, deep link, localStorage, SQLite, logs, or clipboard | _pending_    | _pending_                | PENDING |
| Session revocation clears native credential custody on the next authenticated contact without deleting local safety data               | _pending_    | _pending_                | PENDING |

## Checklist 2 — Live Consent Revocation

| Check                                                                                                                      | Observation and evidence | Result  |
| -------------------------------------------------------------------------------------------------------------------------- | ------------------------ | ------- |
| Open a consented diagnostic case on the isolated admin origin                                                              | _pending_                | PENDING |
| Revoke the same consent from the account origin while the operator view is active                                          | _pending_                | PENDING |
| Active stream terminates and already-rendered diagnostic data clears immediately                                           | _pending_                | PENDING |
| No durable URL, browser cache, download, or recoverable rendered payload remains                                           | _pending_                | PENDING |
| Immutable access and revocation receipts/events remain, bound to the exact account/case/version without diagnostic content | _pending_                | PENDING |

## Checklist 3 — Device, Offline, Downgrade, and Rollback

| Check                                                                                                       | Windows/cell | Observation and evidence | Result  |
| ----------------------------------------------------------------------------------------------------------- | ------------ | ------------------------ | ------- |
| One-PC bind succeeds and a conflicting bind cannot create two active PCs                                    | _pending_    | _pending_                | PENDING |
| Cooldown and reviewed exception behavior match policy                                                       | _pending_    | _pending_                | PENDING |
| Offline entitlement remains exact-byte verified, expires at the bound limit, and fails closed after expiry  | _pending_    | _pending_                | PENDING |
| Premium loss blocks only new paid work; in-flight work, history, warnings, and restoration remain available | _pending_    | _pending_                | PENDING |
| Force one critical failure for this exact build and record the immutable failed gate                        | _pending_    | _pending_                | PENDING |
| Downgrade from `internal-023001` to `internal-023000` succeeds without widening trust                       | _pending_    | _pending_                | PENDING |
| Execute the manifest rollback and confirm evidence/history remain intact and readable                       | _pending_    | _pending_                | PENDING |
| Upgrade and uninstall journeys preserve the required evidence/safety behavior                               | _pending_    | _pending_                | PENDING |

## Critical Failures

None recorded because no manual run has been supplied. Any observed critical failure must be appended here and remains blocking even after a later pass.

| Failure ID | Build fingerprint                                                  | Cell/check | Observation                    | Evidence reference/hash | Disposition |
| ---------- | ------------------------------------------------------------------ | ---------- | ------------------------------ | ----------------------- | ----------- |
| _none yet_ | `9c9b721392aa38cb34427810e75f85a1de2d5cc13c5270b93a0e05a16e914a7f` | _pending_  | No manual observation supplied | _pending_               | BLOCKED     |

## Approver Response

- Approver: _pending_
- Response timestamp UTC: _pending_
- Response: **PENDING**
- Exact response text: _pending_
- Approved build fingerprint: _pending_

Approval may be recorded only after every critical observation passes against the exact identities in this document. A response that is not bound to the build fingerprint is invalid.
