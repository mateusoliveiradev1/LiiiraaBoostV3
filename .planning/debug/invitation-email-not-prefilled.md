---
status: investigating
trigger: 'ja nao apareceu preenchido nao'
created: 2026-08-10T00:00:00-03:00
updated: 2026-08-10T10:16:00-03:00
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
- next_action: Commit and push the protected refresh path, run it against the single remaining staging invitation, then verify the refreshed link in published Account.

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

## Eliminated

- Account hydration/state loss: the existing effect correctly projects and locks a valid recipient fragment.
- Invalid or expired invitation token: the published page admitted the token and rendered the invitation-only registration state.

## Resolution

- root_cause:
- fix:
- verification:
- files_changed:
