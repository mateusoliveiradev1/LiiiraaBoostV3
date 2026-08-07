---
phase: 04-identity-commerce-devices-and-administration
plan: '42'
subsystem: domain
tags: [typescript, vitest, invitations, private-beta, state-machine, retention]
requires:
  - phase: 04-identity-commerce-devices-and-administration
    provides: generated Admin contracts and canonical invitation routes from Plan 04-41
provides:
  - Pure deterministic private-beta preflight, admission, capacity, queue, lifecycle, and reminder policy
  - Recipient-bound single-use acceptance with generic forwarded-link denial and account-authority handoff
  - Governed batch admission and purpose-bound closed-invitation retention decisions
affects: [admin-invitation-use-cases, postgres-invitations, invitation-api, admin-invitations-ui]
tech-stack:
  added: []
  patterns:
    [pure immutable domain decisions, explicit clock and capacity inputs, opaque recipient keys]
key-files:
  created:
    - packages/control-plane-domain/src/admin/invitations.ts
    - packages/control-plane-domain/src/admin/invitations.test.ts
  modified:
    - packages/control-plane-domain/src/index.ts
    - packages/control-plane-domain/package.json
key-decisions:
  - 'Represent beta and administrative-team invitations as disjoint kinds so beta lifecycle commands cannot mutate team access.'
  - 'Keep secrets outside domain state; pure decisions emit bounded issue, invalidate, consume, send, reminder, and handoff effects only.'
  - 'Use opaque recipient keys and a generic unavailable projection so forwarded links disclose neither account existence nor invited email.'
patterns-established:
  - 'Invitation lifecycle: all mutations are immutable versioned decisions over explicit time, with terminal history refusing further invitation authority.'
  - 'Capacity policy: only unexpired pending beta invitations consume one of 25 slots; queued records have no expiry, secret, or delivery effect until stable promotion.'
requirements-completed: [WEB-06, IDEN-01]
duration: 10 min
completed: 2026-08-06
status: complete
---

# Phase 04 Plan 42: Deterministic Invitation Authority Summary

**Private-beta invitations now have one provider-neutral authority for preflight, 25-slot admission, stable queueing, secret rotation effects, bounded reminders, atomic acceptance, immutable closure, batch governance, and retention.**

## Performance

- **Duration:** 10 min
- **Started:** 2026-08-06T22:09:00-03:00
- **Completed:** 2026-08-06T22:19:00-03:00
- **Tasks:** 1
- **Files modified:** 4

## Accomplishments

- Classified valid, duplicate, already-active, invalid, and ineligible individual/batch/CSV rows without issuing or exposing a secret.
- Enforced the exact 25-active beta cap across every boundary value and promoted queued recipients by stable queue position, creation time, and opaque ID.
- Modeled explicit preserve/restart resend expiry, immediate former-secret invalidation, immutable recipient identity, two localized reminders, delivery history, and all terminal outcomes.
- Kept forwarded lookup generic and consumed invitations only after recipient possession, essential terms, and completed account activation succeed together.
- Separated accepted-account authority and administrative-team invitation authority from beta revocation.
- Added governed bulk resend/revoke admission and purpose/legal-hold retention decisions that preserve a minimum technical audit receipt.

## Task Commits

1. **Task 04-42-01 RED: deterministic invitation policy matrix** - `60ab756` (test)
2. **Task 04-42-01 RED: D-90/D-93/D-97 governance coverage** - `ae1e0d5` (test)
3. **Task 04-42-01 GREEN: deterministic invitation authority** - `cfc386e` (feat)
4. **Task 04-42-01 verification hardening: boundary properties** - `b9db95c` (test)

## Files Created/Modified

- `packages/control-plane-domain/src/admin/invitations.ts` - Pure invitation preflight, admission, queue, lifecycle, privacy, batch, and retention decisions.
- `packages/control-plane-domain/src/admin/invitations.test.ts` - D-88 through D-98 state table and boundary properties.
- `packages/control-plane-domain/src/index.ts` - Stable root exports for invitation constants, decisions, states, commands, effects, and results.
- `packages/control-plane-domain/package.json` - Public `./admin/invitations` subpath and Admin domain coverage in the package test command.

## Decisions Made

- Domain state stores an opaque `recipientKey`, never a usable email, link, token, or plaintext secret.
- Queued recipients carry no expiry and emit no secret/delivery effects; promotion begins their explicit 14-day window.
- Accepted invitations emit a beta-access handoff and then become immutable history; later restriction must use account, subscription, or beta-access authority.
- High-risk bulk actions require impact review, a reason, and approval before the application layer may create a durable job and receipt.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 2 - Missing Critical] Added explicit D-90, D-93, and D-97 witnesses**

- **Found during:** Task 04-42-01 RED completeness review
- **Issue:** The initial state table covered core lifecycle behavior but did not yet prove essential-term acceptance, permitted delivery events/no invasive tracking, or governed high-risk batch actions.
- **Fix:** Added failing cases and pure batch-admission policy before implementing GREEN.
- **Files modified:** `packages/control-plane-domain/src/admin/invitations.test.ts`, `packages/control-plane-domain/src/admin/invitations.ts`
- **Verification:** Focused invitation suite passes all seven D-88–D-98 scenarios.
- **Committed in:** `ae1e0d5`, `cfc386e`

**2. [Rule 1 - Bug] Made privacy assertions BigInt-safe**

- **Found during:** Task 04-42-01 GREEN verification
- **Issue:** Native `JSON.stringify` rejects the version `bigint`, preventing privacy assertions from inspecting the complete decision state.
- **Fix:** Added a test-only serializer that converts BigInt values to strings while preserving the inspected field names and values.
- **Files modified:** `packages/control-plane-domain/src/admin/invitations.test.ts`
- **Verification:** Privacy assertions and strict TypeScript both pass.
- **Committed in:** `cfc386e`

**3. [Rule 2 - Missing Critical] Added exhaustive cap and single-use boundary properties**

- **Found during:** Task 04-42-01 acceptance-criteria verification
- **Issue:** Example cases at active counts 24 and 25 did not alone prove every admissible count or the fail-closed 26th-state input; acceptance also required explicit single-use proof.
- **Fix:** Exercised active counts 0–24, queueing at 25, rejection at 26, and immutable repeated activation.
- **Files modified:** `packages/control-plane-domain/src/admin/invitations.test.ts`
- **Verification:** Focused suite, package suite, TypeScript, ESLint, and architecture gates pass.
- **Committed in:** `b9db95c`

---

**Total deviations:** 3 auto-fixed (1 bug, 2 missing critical).
**Impact on plan:** The additions close specification-proof gaps without expanding outside the planned pure invitation domain.

## Issues Encountered

- The repository contains older unrelated commits whose messages also contain `04-42`; current execution is identified by the four hashes above and this summary.

## Verification

- Focused invitation state table: 7/7 tests passed.
- Control-plane domain package: 65/65 tests across 7 files passed.
- Strict TypeScript check passed.
- ESLint passed for all changed TypeScript files.
- Architecture gate passed: 46/46 tests with both workspace and Cargo adapters executed.
- `rtk git diff --check` passed.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness

- Plan 04-43 can add governed administrative access policy independently.
- Plan 04-45 can consume the stable invitation decisions through transactional ports without recreating product rules.
- Plan 04-46 can persist the exact 25-slot, one-recipient, version, queue, event, and retention invariants under PostgreSQL concurrency.

## Self-Check: PASSED

- Created files exist and are exported through the public package boundary.
- RED commits precede GREEN, and the complete acceptance matrix is green.
- No unrelated or locally untracked user files were included.

---

_Phase: 04-identity-commerce-devices-and-administration_
_Completed: 2026-08-06_
