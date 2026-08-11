---
phase: 04-identity-commerce-devices-and-administration
plan: '40'
status: awaiting-real-auth-human-uat
tested_commit: d257850588fbe4996d7dc68de6be4c9b031fe8bc
updated: 2026-08-11T05:21:47.527Z
---

# Phase 04 Real-Authority UAT

This record reconstructs the immutable deployment and database receipts after the Windows
workstation was formatted. It is **not an approval**. No email address, raw invitation token,
password, database credential, or session credential is recorded here.

## Current checkpoint

- Progress: Tasks 04-40-01 and 04-40-02 complete; Task 04-40-03 human observations pending.
- Automated environment: exact surface and API component revisions are recorded below with
  fixture/preview authority disabled.
- Published Admin automation: complete against Vercel -> API -> PostgreSQL authority.
- Device-binding remediation: deployed on the exact API revision below; owner UAT confirmed the
  PostgreSQL-backed binding and authoritative projection after refresh/restart.
- Recovery action: complete; three unique replacement URLs are available only in the owner-protected
  local output.
- Human approval: pending until the exact build passes every real-auth observation below.

## Exact deployment identity

| Identity                         | Exact value                                                               | Result |
| -------------------------------- | ------------------------------------------------------------------------- | ------ |
| Published surface/test revision  | `d257850588fbe4996d7dc68de6be4c9b031fe8bc`                                | PASS   |
| API build ID                     | `61d8db9f8e4e1d090d75c67e918f53228bec03de`                                | PASS   |
| API OCI digest                   | `sha256:332c8007d4e077ea6e8a0efac62b430cea413c106bba9b175634232c893d3933` | PASS   |
| GitHub API promotion run         | `31324354207`                                                             | PASS   |
| Render deploy                    | `dep-d9saslqfngtc73eva5a0`                                                | PASS   |
| API origin                       | `https://liiiraa-api-staging.onrender.com`                                | PASS   |
| Public Vercel revision endpoint  | `d257850588fbe4996d7dc68de6be4c9b031fe8bc`                                | PASS   |
| Account Vercel revision endpoint | `d257850588fbe4996d7dc68de6be4c9b031fe8bc`                                | PASS   |
| Admin Vercel revision endpoint   | `d257850588fbe4996d7dc68de6be4c9b031fe8bc`                                | PASS   |
| Surface verification run         | `31461120604`                                                             | PASS   |
| Published Admin authority run    | `31326815831`                                                             | PASS   |
| Neon project / branch / database | `floral-block-55553375` / `br-holy-credit-avgpp494` / `liiiraa_staging`   | PASS   |
| Applied schema migrations        | 8; latest durable receipt `2026-08-07T12:54:20.845Z`                      | PASS   |
| Desktop installer                | `target/release/bundle/nsis/Liiiraa Boost_0.0.1_x64-setup.exe`            | PASS   |
| Desktop installer SHA-256        | `7be3df5497dadad71399b00c46c736597707a7c9bbb3a753f185baf2bd92ecf4`        | PASS   |

The API readiness endpoint reported build ID
`61d8db9f8e4e1d090d75c67e918f53228bec03de`, `authorityConnected=true`, and
`device-authority`. Public, Account, and Admin serve the exact
`d257850588fbe4996d7dc68de6be4c9b031fe8bc` revision and continue to proxy to this API.

## Automated receipts

| Receipt                   | Observation                                                                                                                                                                    | Result              |
| ------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | ------------------- |
| Provisioner preflight     | invitation provisioning/crypto: 2 files, 11 tests passed                                                                                                                       | PASS                |
| Dependency policy         | 72 exact dependency pins verified                                                                                                                                              | PASS                |
| Vulnerability gate        | `nanoid` resolved to `3.3.18`; production audit has no HIGH/CRITICAL finding                                                                                                   | PASS                |
| API artifact              | SBOM, provenance, digest validation, Trivy scan, and anonymous digest pull passed                                                                                              | PASS                |
| API promotion             | Migrations, Stripe test catalog/webhook, immutable Render digest, health, and readiness passed                                                                                 | PASS                |
| API readiness             | `authorityConnected=true`, `invitationOnly=true`, `dataClassification=synthetic`, all Phase 4 capabilities present                                                             | PASS                |
| Isolated surfaces         | Public, Account, and Admin exact Git deployments are READY                                                                                                                     | PASS                |
| Fail-closed probes        | Origin, session, and consent-isolation probes passed                                                                                                                           | PASS                |
| Desktop package           | Tauri staging overlay compiled and produced one NSIS x64 installer                                                                                                             | PASS                |
| Device authority          | Free denial, Premium confirmations, native Windows evidence, server-only wrapping, replay, and concurrency passed                                                              | PASS                |
| Device privacy scan       | No raw serial, machine GUID, protected digest, or local digest crosses React source; beta gate absent                                                                          | PASS                |
| Phase evidence evaluator  | Refused stale artifact hashes and 20 missing real-PC coverage cells                                                                                                            | BLOCKED AS DESIGNED |
| Published Admin authority | Exact Vercel revision passed signup, TOTP, function switch, authorized PostgreSQL reads, fail-closed invitation issuance, responsive layout, accessibility, and runtime guards | PASS                |

The global evidence evaluator remains closed because the checked-in evidence manifest predates
this revision and the required Windows 10/11 hardware and lifecycle matrix has not been observed.
Those failures must not be converted into a pass for this plan.

## Protected invitation state

Aggregate Neon inspection at this checkpoint found:

| Lifecycle         | Role   | Count | Current state                                          |
| ----------------- | ------ | ----: | ------------------------------------------------------ |
| Active            | tester |     3 | Yes: replacement URLs exist in owner-only local output |
| Redeemed          | tester |     0 | Pending human UAT                                      |
| Tester identities | active |     0 | Pending invitation redemption                          |

The GitHub secret input exists, but GitHub correctly does not allow its value to be read back.
The two original tokens could not be reconstructed from their SHA-256 digests. They were invalidated
within the authorized scope and replaced by three new invitations in the owner-only file outside
the repository.

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
- Atomic run `31300385241` passed benign encryption, then returned `ENOENT` inside the real
  transaction. PostgreSQL rolled back the compensation and issuance; no invitation state changed.
  The crypto boundary now reports only a safe stage/code pair so the missing file operation can be
  corrected without exposing protected values.
- Diagnostic run `31300480948` narrowed the rollback to `READ_ENOENT`: the expected plaintext was
  absent before encryption. A new transaction gate now rejects any compensating execution that
  does not report exactly three newly created replacement URLs before the crypto boundary runs.
- Result-gated run `31300591705` proved that three replacements were created inside the transaction
  but the plaintext path was still missing, and rolled back. Root cause: POSIX `/home/...` paths
  were incorrectly classified as Windows-rooted paths and rewritten with backslashes. The path
  classifier now recognizes only drive-letter and UNC paths as Windows paths, with a Linux-runner
  regression test.

Successful recovery receipt:

- GitHub run: `31300711469`, exact revision `cbb9adc821422301f4a84c4a9eb5051236c63c74`.
- Benign crypto preflight, exact three-record compensation, in-transaction encryption, plaintext
  absence assertion, and encrypted artifact upload: PASS.
- Local decryption validation: three invitations, three unique protected recipients, three unique
  tokens, canonical Account staging origin, canonical `/pt-BR/register` route: PASS.
- Remote encrypted artifact `9034398973` was deleted after local validation; the run now reports
  zero retained artifacts.
- Raw emails and tokens remain absent from Git, CI logs, this UAT record, and chat.

Owner signup recovery supplement:

- The invitation exposed during the failed signup report was selected by both token and owner
  recipient digests and expired without logging either protected value.
- GitHub run `31302923313`, exact revision
  `943445ecf2d635e0bc9eea3c7e4de934dc7c2e15`, superseded at most one stale owner-test invitation
  and issued exactly one replacement inside the protected transaction.
- Local validation proved one canonical Account staging URL, the expected recipient digest, a
  matching recipient hash fragment, and a valid token shape without printing protected values.
- Remote encrypted artifact `9035042500` was deleted after local validation; GitHub reports zero
  retained artifacts for the run.
- Browser verification on the exact deployed revision proved a read-only invited email, a native
  checkbox, and no CSP or console errors.
- Owner verification completed account creation and desktop login without the prior CSP,
  invitation-rejection loop, or server error.

Remaining tester invitation refresh supplement:

- The owner reported that the remaining protected link reached the canonical registration route
  but did not pre-fill the invited e-mail.
- Root cause: canonical-link repair retained the valid token while removing the protected
  `#recipient` fragment consumed by Account for read-only e-mail projection.
- GitHub run `31392110895`, exact revision
  `da5fd181a778e5ae474f86b6e7161deb60ca8f6a`, aborted unless PostgreSQL returned exactly one active,
  unredeemed tester invitation and then issued exactly one recipient-bound replacement.
- Local validation proved one future-dated canonical Account staging URL, one bounded token, and a
  matching recipient fragment without printing the e-mail or token.
- Remote encrypted artifact `9064091118` and temporary recovery keys were deleted after local
  validation. The corrected URL remains only in the owner-protected local file outside Git.
- At `2026-08-10T13:30:03.208Z`, the owner responded `pass` after verifying the corrected
  pre-filled/read-only recipient flow and completing the published signup.
- At `2026-08-10T13:37:03.707Z`, the owner responded `pass` after closing and reopening a normal
  browser and confirming that the authenticated Account session persisted. A separate incognito
  check correctly discarded the session when the private window was closed.
- At `2026-08-10T13:46:19.255Z`, the owner responded `pass` after changing the tester account's
  display name, saving it, and confirming that the updated profile survived a page reload.
- At `2026-08-10T13:48:49.546Z`, the owner responded `pass` after switching the authenticated
  Account locale to English and confirming that the selected locale survived a page reload.
- At `2026-08-10T13:58:42.747Z`, the owner confirmed that logout removed private authority, but
  browser Back restored the protected route inside an unauthenticated account shell. The secure
  denial passed; UX approval remains pending the staging retest of fix `e647013`.
- At `2026-08-10T14:07:48.677Z`, the owner responded `pass` after retesting staging revision
  `3fd725f`: logout remained revoked and browser Back returned to the clean sign-in experience
  without restoring the authenticated account shell.
- At `2026-08-10T14:09:52.482Z`, the owner responded `pass` after closing the packaged desktop
  without signing out and reopening it: the authenticated account was restored from Windows
  Credential Manager without reopening the browser or requesting credentials.
- At `2026-08-10T14:13:10.599Z`, the owner supplied an incognito staging screenshot showing a
  Free tester identity rejected by the isolated administrative origin. The Admin sign-in surface
  reported that it could not validate administrative access and exposed no protected dashboard data.
- At `2026-08-10T14:24:01.045Z`, the owner confirmed that one Admin logout revoked only the isolated
  administrative session and returned to the independently authenticated Account portal. Browser
  Back did not restore the Admin dashboard; the Account session correctly remained active.
- At `2026-08-10T15:15:00.000Z`, the owner exercised read-only function simulation in Pessoas. The
  interface clearly identified `operations` as simulated and retained `security` as the real active
  function, but exposed no explicit control to leave simulation. This checkpoint remains open until
  the missing exit action is published and retested.
- At `2026-08-11T05:08:45.148Z`, the owner confirmed that a full reload recovered an Admin tab that
  had remained on the pre-session skeleton across a revision/cold-start boundary. The exact published
  route had already loaded normally in a clean browser, Render health/readiness and the Admin proxy
  were responsive, and no persistent product regression was reproduced.
- At `2026-08-11T05:12:35.393Z`, the owner confirmed that the published exit action is present but
  visually indistinguishable from loose text beneath the simulation banner. The action remains safe
  and local, but this checkpoint stays open until staging exposes an unmistakable button affordance.
- At `2026-08-11T05:21:47.527Z`, the owner responded `pass` after confirming the published bordered
  exit button is visible in the simulation banner. The read-only simulation can now be closed without
  changing the real active administrative function.

## Human real-authority observations

Every row must be exercised on the exact identities above. A fixture response, optimistic success,
revision mismatch, or result that does not survive reload is a critical failure.

| Observation                                                                                            | Evidence                               | Result  |
| ------------------------------------------------------------------------------------------------------ | -------------------------------------- | ------- |
| Owner-test replacement creates an account and authenticates the packaged desktop                       | owner-confirmed                        | PASS    |
| Free account opens the secure plan-management flow from the packaged desktop                           | owner-confirmed `f1ae8b1`              | PASS    |
| Premium current-PC preview requires both confirmations and creates one PostgreSQL-backed binding       | owner screenshot + API `61d8db9`       | PASS    |
| The same binding survives desktop restart and appears in the authenticated Account device route        | owner screenshot + `04-UAT.md`         | PASS    |
| Protected tester invitations create the intended persistent accounts                                   | owner-confirmed + `31392110895`        | PASS    |
| Account login, reload, and normal-browser restart preserve the authenticated session                   | owner-confirmed                        | PASS    |
| Profile display-name mutation persists after reload                                                    | owner-confirmed                        | PASS    |
| Locale mutation persists after reload                                                                  | owner-confirmed                        | PASS    |
| Account logout terminates the browser session                                                          | owner-confirmed + 31395841650          | PASS    |
| Desktop system-browser PKCE login returns to the app and Credential Manager restores after restart     | owner-confirmed                        | PASS    |
| Web/admin/desktop logout and server-side revocation remove the corresponding session                   | owner-confirmed + `04-UAT.md`          | PASS    |
| Tester cannot enter Admin; administrative identities cannot leak protected payloads to tester surfaces | owner screenshot                       | PASS    |
| Consent revocation terminates live access and preserves only bounded audit receipts                    | _pending_                              | PENDING |
| Invitation issue/resend/revoke and governance/approval changes survive reload                          | fail-closed issue subset `31326815831` | PENDING |
| Function switch and independent approval enforce permission impact and strong authentication           | switch + TOTP subset `31326815831`     | PENDING |
| Read-only function simulation preserves real authority and provides an explicit exit                   | owner-confirmed `d257850`              | PASS    |
| Jobs expose durable progress and final receipt; universal search respects authorization                | authorized reads subset `31326815831`  | PENDING |
| Live, reconnecting, stale, and degraded states expose freshness and block unsafe mutations             | live subset `31326815831`              | PENDING |
| Incidents, configuration, privacy, emergency controls, and audit use PostgreSQL authority              | authorized reads subset `31326815831`  | PENDING |
| Desktop About/profile/session/tray fixes pass on the new installer                                     | owner-approved `04-UAT.md`             | PASS    |

## Approval

- Approver: _pending_
- Timestamp UTC: _pending_
- Exact response: _pending_
- Result: **PENDING**

Create `04-40-SUMMARY.md` only after the protected invitation recovery is complete and the owner
types `approved` for this exact deployed revision.
