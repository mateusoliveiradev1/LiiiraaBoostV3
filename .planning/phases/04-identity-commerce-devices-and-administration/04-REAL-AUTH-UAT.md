---
phase: 04-identity-commerce-devices-and-administration
plan: '40'
status: protected-invitation-compensation-ready
tested_commit: 210f1b354da6a7a152e087a4db02f9db5f5c3ba4
updated: 2026-08-09T07:04:06.969Z
---

# Phase 04 Real-Authority UAT

This record reconstructs the immutable deployment and database receipts after the Windows
workstation was formatted. It is **not an approval**. No email address, raw invitation token,
password, database credential, or session credential is recorded here.

## Current checkpoint

- Progress: Task 04-40-01 automated provisioner complete; Tasks 04-40-02 and 04-40-03 blocked.
- Automated environment: ready on one exact revision with fixture/preview authority disabled.
- Recovery action: owner authorized invalidating exactly two lost active tester invitations and
  reissuing all three from protected input; execution is pending the encrypted recovery workflow.
- Human approval: pending until the exact build passes every real-auth observation below.

## Exact deployment identity

| Identity                         | Exact value                                                               | Result |
| -------------------------------- | ------------------------------------------------------------------------- | ------ |
| Source commit / API build ID     | `210f1b354da6a7a152e087a4db02f9db5f5c3ba4`                                | PASS   |
| API OCI digest                   | `sha256:7123313c6e92c491f7ca24861e2edd303746158762e18671cf5ad584976f2c4c` | PASS   |
| GitHub API promotion run         | `31277608537`                                                             | PASS   |
| Render deploy                    | `dep-d9rpc4tbedkc73c883og`                                                | PASS   |
| API origin                       | `https://liiiraa-api-staging.onrender.com`                                | PASS   |
| Public Vercel deployment         | `dpl_DR6BmRc6MJRApNgorq5cDCmaDxbF`                                        | PASS   |
| Account Vercel deployment        | `dpl_8TQfQQk58htcZ3ZqiBFgqZcttA6H`                                        | PASS   |
| Admin Vercel deployment          | `dpl_36eA8tMw5sJwzhSLiUdDp2BeQWUr`                                        | PASS   |
| Surface verification run         | `31277822553`                                                             | PASS   |
| Neon project / branch / database | `floral-block-55553375` / `br-holy-credit-avgpp494` / `liiiraa_staging`   | PASS   |
| Applied schema migrations        | 8; latest durable receipt `2026-08-07T12:54:20.845Z`                      | PASS   |
| Desktop installer                | `target/release/bundle/nsis/Liiiraa Boost_0.0.1_x64-setup.exe`            | PASS   |
| Desktop installer SHA-256        | `3d1c31a14dff1987b296f043f5f7dc96625199a9b6a5919232f2a900341deb89`        | PASS   |

The canonical Public, Account, Admin, and API endpoints each reported revision/build ID
`210f1b354da6a7a152e087a4db02f9db5f5c3ba4` after promotion.

## Automated receipts

| Receipt                  | Observation                                                                                                        | Result              |
| ------------------------ | ------------------------------------------------------------------------------------------------------------------ | ------------------- |
| Provisioner preflight    | `provision-invitations.test.ts`: 1 file, 5 tests passed                                                            | PASS                |
| Dependency policy        | 72 exact dependency pins verified                                                                                  | PASS                |
| Vulnerability gate       | `nanoid` resolved to `3.3.18`; production audit has no HIGH/CRITICAL finding                                       | PASS                |
| API artifact             | SBOM, provenance, digest validation, Trivy scan, and anonymous digest pull passed                                  | PASS                |
| API promotion            | Migrations, Stripe test catalog/webhook, immutable Render digest, health, and readiness passed                     | PASS                |
| API readiness            | `authorityConnected=true`, `invitationOnly=true`, `dataClassification=synthetic`, all Phase 4 capabilities present | PASS                |
| Isolated surfaces        | Public, Account, and Admin exact Git deployments are READY                                                         | PASS                |
| Fail-closed probes       | Origin, session, and consent-isolation probes passed                                                               | PASS                |
| Desktop package          | Tauri staging overlay compiled and produced one NSIS x64 installer                                                 | PASS                |
| Phase evidence evaluator | Refused stale artifact hashes and 20 missing real-PC coverage cells                                                | BLOCKED AS DESIGNED |

The global evidence evaluator remains closed because the checked-in evidence manifest predates
this revision and the required Windows 10/11 hardware and lifecycle matrix has not been observed.
Those failures must not be converted into a pass for this plan.

## Protected invitation state

Aggregate Neon inspection at this checkpoint found:

| Lifecycle         | Role   | Count | Usable after workstation format                                                       |
| ----------------- | ------ | ----: | ------------------------------------------------------------------------------------- |
| Active            | tester |     2 | No: only token digests remain in PostgreSQL and the protected local URL file was lost |
| Redeemed          | tester |     0 | Not applicable                                                                        |
| Tester identities | active |     0 | Not applicable                                                                        |

The GitHub secret input exists, but GitHub correctly does not allow its value to be read back.
The two existing tokens cannot be reconstructed from their SHA-256 digests. Recovery therefore
requires invalidating only those two unusable active tester invitations and provisioning all three
addresses again into a new owner-only file outside the repository. That destructive recovery has
not yet been performed.

Owner authorization receipt:

- Timestamp UTC: `2026-08-09T06:58:58.604Z`
- Exact response: `SIM`
- Authorized scope: invalidate exactly the two active, unredeemed tester invitations whose raw
  URLs were lost, then issue three replacements from the existing protected GitHub input.
- Safety gate: the recovery aborts unless PostgreSQL returns exactly two matching records; the
  replacement URLs are transported only as a one-day encrypted artifact and decrypted into an
  owner-only local file.

First recovery execution receipt:

- GitHub run: `31300134764`, exact revision `6431b0ba3e20eb5d982edce01f1a15017a458e9d`.
- PostgreSQL step: PASS; exactly two lost records were invalidated and three replacements issued.
- Encryption/upload step: FAIL before any artifact upload; the ephemeral runner discarded the raw
  URLs and no token appeared in logs.
- Compensating boundary: invalidate exactly the three active tester invitations created between
  `2026-08-09T07:00:00.000Z` and `2026-08-09T07:01:00.000Z` for the same protected recipient
  digests, then encrypt the next output inside the same database transaction before commit.
- The corrected workflow proves encryption with benign input before touching PostgreSQL and rolls
  back the transaction if protected-output encryption fails.
- Preflight run `31300324810` stopped before PostgreSQL because the YAML split the benign crypto
  command arguments onto a separate shell line. No invitation state changed in this run; the
  command was corrected to keep the paths on the invocation line.

## Human real-authority observations

Every row must be exercised on the exact identities above. A fixture response, optimistic success,
revision mismatch, or result that does not survive reload is a critical failure.

| Observation                                                                                            | Evidence                    | Result  |
| ------------------------------------------------------------------------------------------------------ | --------------------------- | ------- |
| Three invitation URLs create three persistent tester accounts                                          | _pending protected reissue_ | PENDING |
| Account login, reload, browser restart, profile/locale mutation, and logout persist in PostgreSQL      | _pending_                   | PENDING |
| Desktop system-browser PKCE login returns to the app and Credential Manager restores after restart     | _pending_                   | PENDING |
| Web/admin/desktop logout and server-side revocation remove the corresponding session                   | _pending_                   | PENDING |
| Tester cannot enter Admin; administrative identities cannot leak protected payloads to tester surfaces | _pending_                   | PENDING |
| Consent revocation terminates live access and preserves only bounded audit receipts                    | _pending_                   | PENDING |
| Invitation issue/resend/revoke and governance/approval changes survive reload                          | _pending_                   | PENDING |
| Function switch and independent approval enforce permission impact and strong authentication           | _pending_                   | PENDING |
| Jobs expose durable progress and final receipt; universal search respects authorization                | _pending_                   | PENDING |
| Live, reconnecting, stale, and degraded states expose freshness and block unsafe mutations             | _pending_                   | PENDING |
| Incidents, configuration, privacy, emergency controls, and audit use PostgreSQL authority              | _pending_                   | PENDING |
| Desktop About/profile/session/tray fixes pass on the new installer                                     | _pending_                   | PENDING |

## Approval

- Approver: _pending_
- Timestamp UTC: _pending_
- Exact response: _pending_
- Result: **PENDING**

Create `04-40-SUMMARY.md` only after the protected invitation recovery is complete and the owner
types `approved` for this exact deployed revision.
