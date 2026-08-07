---
phase: 04-identity-commerce-devices-and-administration
plan: '45'
subsystem: application
tags: [admin, invitations, transactions, idempotency, privacy, tdd]
requires:
  - phase: 04-42
    provides: Deterministic beta invitation admission, transition, batch, and retention policy
provides:
  - Transactional beta invitation preflight, issue, resend, reminder, revoke, decline, acceptance, and batch orchestration
  - Narrow authorization, recipient hashing, secret, delivery, repository, audit, outbox, job, and receipt ports
  - Rollback, idempotency, expected-version, secret-rotation, privacy, and durable-receipt witnesses
affects: [04-46, 04-51, admin-invitations, beta-access]
tech-stack:
  added: []
  patterns: [transactional application authority, digest-only secret persistence, durable command replay]
key-files:
  created:
    - packages/control-plane-application/src/ports/admin-invitations.ts
    - packages/control-plane-application/src/use-cases/manage-beta-invitations.ts
  modified:
    - packages/control-plane-application/src/use-cases/manage-beta-invitations.test.ts
    - packages/control-plane-application/src/index.ts
    - packages/control-plane-application/package.json
key-decisions:
  - 'Classify batch targets from repository-loaded invitation state; callers submit only target IDs and cannot declare authoritative outcomes.'
  - 'Keep plaintext invitation secrets inside the injected delivery handoff while persistence, audit, outbox, jobs, and receipts contain only digests or bounded references.'
patterns-established:
  - 'Invitation commands resolve durable replay before expected-version arbitration and commit state, lifecycle, audit, outbox, receipt, and command result in one repository transaction.'
  - 'Preflight authorizes before recipient hashing and never opens a mutation transaction or emits audit, outbox, delivery, or secret effects.'
requirements-completed: [WEB-06, IDEN-01]
duration: 11 min
completed: 2026-08-06
status: complete
---

# Phase 04 Plan 45: Transactional Beta Invitation Application Summary

**Transactional beta invitation authority with digest-only secret custody, durable replay, atomic acceptance, and repository-derived batch outcomes**

## Performance

- **Duration:** 11 min
- **Started:** 2026-08-06T22:36:39-03:00
- **Completed:** 2026-08-06T22:47:03-03:00
- **Tasks:** 1
- **Files modified:** 5

## Accomplishments

- Added read-only preflight and transactional issue, queue, resend, reminder, revoke, decline, expiry, acceptance, and batch use cases.
- Proved replay safety, stale-write rejection, secret rotation, single-use acceptance, rollback on audit/outbox/receipt failure, and privacy-safe external failures.
- Restricted plaintext secrets to the bounded delivery handoff and made batch classification derive from authoritative invitation state rather than caller input.

## Task Commits

Each TDD gate was committed atomically:

1. **RED: Invitation application authority tests** - `9b8fae5` (test)
2. **GREEN: Transactional beta invitation workflows** - `bbfc619` (feat)

## Files Created/Modified

- `packages/control-plane-application/src/ports/admin-invitations.ts` - Narrow invitation authority, delivery, repository, job, outbox, audit, and receipt contracts.
- `packages/control-plane-application/src/use-cases/manage-beta-invitations.ts` - Transactional orchestration for the complete beta invitation lifecycle.
- `packages/control-plane-application/src/use-cases/manage-beta-invitations.test.ts` - Transaction double proving atomicity, privacy, replay, rotation, acceptance, and batch behavior.
- `packages/control-plane-application/src/index.ts` - Public application exports for the new ports and use cases.
- `packages/control-plane-application/package.json` - Explicit invitation application subpath export.

## Decisions Made

- Batch callers provide only target identities; the application classifies issued, queued, skipped, and failed results from repository-loaded authority.
- Plaintext invitation secrets are passed only to the delivery handoff and never enter invitation state, audit, outbox, job, receipt, or command replay records.

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered

None.

## Verification

- Focused and package Vitest: 13/13 passed.
- Application TypeScript: passed.
- Focused ESLint: passed.
- Architecture suite: 46/46 passed.
- TDD gates: RED `9b8fae5`, GREEN `bbfc619`.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness

- Plan 04-46 can implement these ports with PostgreSQL migrations, locking, digest uniqueness, queue persistence, jobs, and receipts.
- Plan 04-51 can bind generated HTTP routes after the real repository exists.

## Self-Check: PASSED

---
*Phase: 04-identity-commerce-devices-and-administration*
*Completed: 2026-08-06*
