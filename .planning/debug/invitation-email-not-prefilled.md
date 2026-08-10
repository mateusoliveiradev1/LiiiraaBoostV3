---
status: verifying
trigger: 'ja nao apareceu preenchido nao'
created: 2026-08-10T00:00:00-03:00
updated: 2026-08-10T10:20:00-03:00
---

## Symptoms

- expected: A recognized invitation pre-fills the exact invited e-mail and keeps the field read-only.
- actual: The registration page reports `Convite reconhecido`, but the e-mail field is blank and appears editable.
- errors: No console or authority error was included in this reproduction.
- reproduction: Open the third protected invitation on the published Account registration route and observe the recognized invitation state with an empty e-mail input.

## Current Focus

- hypothesis: Confirmed. Canonical-link repair preserved the invitation token but stripped the recipient fragment required by the account client to pre-fill and lock the e-mail.
- test: Repair a legacy protected payload and require each canonical URL to contain the exact base64url recipient fragment; refresh only the single remaining unredeemed tester invitation.
- expecting: The refreshed owner-only URL retains the same e-mail authority in PostgreSQL and opens registration with a pre-filled, read-only recipient.
- next_action: Owner opens the refreshed owner-only link and confirms that the exact invited e-mail is pre-filled and read-only before completing tester signup.

## Evidence

- timestamp: 2026-08-10T00:00:00-03:00
  checked: User-provided published registration screenshot.
  found: The invitation is recognized, while the e-mail input is blank and visually enabled.
  implication: Token/query parsing works; the defect is downstream in recipient projection or form state.

- timestamp: 2026-08-10T10:11:00-03:00
  checked: Account registration state and staging invitation output repair.
  found: The form reads the recipient only from `location.hash`, while `repairInvitationOutputPayload` explicitly rejected every hash and rewrote the canonical URL without adding a replacement fragment.
  implication: The repaired links were structurally valid for the route and token but incomplete for recipient projection; no account or invitation data was lost.

- timestamp: 2026-08-10T10:15:00-03:00
  checked: Regression-first API tests, TypeScript, ESLint, formatting, and full API test suite.
  found: The legacy-link regression failed before the fix and now passes; a fail-closed mode refreshes exactly one active unredeemed tester invitation. All 237 API tests pass.
  implication: Future repaired and refreshed links carry the protected recipient fragment without exposing invitation material in ordinary output.

- timestamp: 2026-08-10T10:20:00-03:00
  checked: Protected GitHub refresh run `31392110895` at exact revision `da5fd181a778e5ae474f86b6e7161deb60ca8f6a` and local decryption validation.
  found: Exactly one active tester invitation was refreshed. The owner-only output contains one future-dated canonical Account URL with one bounded token and a recipient fragment matching its protected e-mail. The remote encrypted artifact and temporary recovery keys were deleted after validation.
  implication: The corrected third link is available only in the protected local file and is ready for published Account UAT.

## Eliminated

- Account hydration/state loss: the existing effect correctly projects and locks a valid recipient fragment.
- Invalid or expired invitation token: the published page admitted the token and rendered the invitation-only registration state.

## Resolution

- root_cause: Canonical-link repair preserved the bearer token but stripped the `#recipient` fragment used by Account to project and lock the invited e-mail.
- fix: Reconstruct the recipient fragment from the protected output e-mail and add a fail-closed encrypted refresh mode that replaces exactly one active tester invitation.
- verification: Regression-first tests, all 237 API tests, TypeScript, ESLint, formatting, protected GitHub refresh, and secret-free local URL validation pass. Owner browser confirmation remains pending.
- files_changed:
  - .github/workflows/phase-4-invitation-recovery.yml
  - apps/api/src/staging/provision-invitations.test.ts
  - apps/api/src/staging/provision-invitations.ts
