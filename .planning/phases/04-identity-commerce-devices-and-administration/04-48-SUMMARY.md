---
phase: 04-identity-commerce-devices-and-administration
plan: '48'
subsystem: database
tags: [admin, governance, postgresql, concurrency, approvals, offboarding, tdd]
requires:
  - phase: 04-46
    provides: Invitation PostgreSQL migration and adapter patterns
  - phase: 04-47
    provides: Transactional administrative governance ports and use cases
provides:
  - Normalized PostgreSQL governance schema with database-enforced function, approval, expiry, review, and immutable-history constraints
  - Serializable governance repository with subject locking, row locks, version guards, normalized grant history, and masked projections
  - Atomic function switching, approval decisions, authority removal, urgent-work reassignment, reveal evidence, audit, outbox, receipts, and replay
affects: [04-52, admin-governance, approvals, isolated-admin, postgres]
tech-stack:
  added: []
  patterns: [normalized append-oriented grants, singular approval decision, scope-first masked projection]
key-files:
  created:
    - packages/control-plane-adapters/src/postgres/migrations/0005_admin_governance.sql
    - packages/control-plane-adapters/src/postgres/admin-governance.ts
    - packages/control-plane-adapters/src/postgres/admin-governance.test.ts
  modified:
    - packages/control-plane-adapters/src/postgres/migrations.test.ts
    - packages/control-plane-adapters/src/index.ts
    - packages/control-plane-adapters/package.json
    - packages/control-plane-application/src/ports/admin-governance.ts
    - packages/control-plane-application/src/use-cases/manage-admin-access.ts
key-decisions:
  - 'Migrate a legacy administrative identity only when an active passkey or TOTP factor already proves strong authentication; migration never fabricates a factor.'
  - 'Permit exactly one approval decision per request and validate the approver against author, beneficiary, assignment, pending state, and expiry inside PostgreSQL.'
  - 'Load membership authority from normalized grants without joining email, credentials, tokens, or other identity fields.'
patterns-established:
  - 'Governance transactions take a subject advisory lock and row-lock the exact membership, session, delegation, or approval aggregate before mutation.'
  - 'Permission/function/capability/scope changes revoke old normalized assignments and append new assignment rows, retaining history without standing super-admin authority.'
requirements-completed: [WEB-06, IDEN-03]
duration: 13 min
completed: 2026-08-07
status: complete
---

# Phase 04 Plan 48: PostgreSQL Admin Governance Summary

**Serializable PostgreSQL governance with normalized grant history, singular active functions and approvals, factor-safe legacy upgrade, masked reads, and atomic authority removal**

## Performance

- **Duration:** 13 min
- **Started:** 2026-08-06T23:50:09-03:00
- **Completed:** 2026-08-07T00:02:59-03:00
- **Tasks:** 2
- **Files modified:** 8

## Accomplishments

- Added migration `0005_admin_governance` for memberships, function/capability/scope history, active function sessions, delegations, impacts, approvals/decisions, reviews, inactivity, offboarding, work reassignment, reveal evidence, commands, receipts, and immutable audit.
- Added database triggers/constraints against standing super-admin, multiple active functions per session, self/beneficiary approval, wrong assigned approver, expired approval reuse, invalid delegation/approval windows, and audit mutation.
- Implemented the production repository with advisory and row locks, optimistic version guards, exact normalized projections, durable replay, and provider-neutral redacted audit/outbox payloads.
- Made function switching end the former projection before inserting the new one and made offboarding revoke every authority while preserving immutable evidence.
- Preserved existing admin roles exactly and migrated them only when real strong-factor evidence exists.

## Task Commits

1. **Task 04-48-01: Migrate governance authority**
   - `826a616` — RED governance migration invariants
   - `0975613` — GREEN authoritative governance migration
2. **Task 04-48-02: Implement governance repository races**
   - `3e29ffe` — RED PostgreSQL governance repository tests
   - `a780cd4` — GREEN PostgreSQL governance authority

## Files Created/Modified

- `packages/control-plane-adapters/src/postgres/migrations/0005_admin_governance.sql` — Normalized schema, upgrade, constraints, triggers, and immutable history.
- `packages/control-plane-adapters/src/postgres/admin-governance.ts` — Migration runner and production governance repository.
- `packages/control-plane-adapters/src/postgres/admin-governance.test.ts` — Locking, normalized projection, function/approval/offboarding, reveal, privacy, and checksum witnesses.
- `packages/control-plane-adapters/src/postgres/migrations.test.ts` — Governance schema and non-widening upgrade witnesses.
- `packages/control-plane-application/src/ports/admin-governance.ts` — Durable approval decision reason.
- `packages/control-plane-application/src/use-cases/manage-admin-access.ts` — Reveal context evidence and corrected atomic authority-removal order.
- Adapter index/package exports expose the PostgreSQL authority.

## Decisions Made

- The database accepts only the explicit synthetic non-production environment identity during this staging phase.
- Legacy roles map to exactly their existing function policy; no wildcard, super-admin, or all-capabilities record exists.
- One approval request has one durable decision; concurrent competing decisions converge under the request row lock and unique constraint.
- Default membership reads include only governance state and normalized grants, never email, password hashes, session tokens, or sensitive audit values.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 2 - Missing Critical] Prevented fabricated strong-factor authority during upgrade**

- **Found during:** Task 04-48-02 migration/repository integration review
- **Issue:** A literal passkey value would have upgraded legacy admin roles even when no passkey/TOTP proof existed.
- **Fix:** Legacy upgrade now requires an active strong factor and derives passkey versus MFA from that persisted evidence.
- **Verification:** Migration tests prove active factor filtering and exact role mapping.
- **Committed in:** `a780cd4`

**2. [Rule 1 - Bug] Made concurrent approval decisions singular**

- **Found during:** Task 04-48-02 concurrency review
- **Issue:** Uniqueness by request plus approver would allow two actors to approve one request concurrently.
- **Fix:** Approval decisions are unique by request and PostgreSQL validates the locked pending request before insertion.
- **Verification:** Schema/repository suites pass with the singular request constraint and decision insertion.
- **Committed in:** `a780cd4`

**3. [Rule 1 - Bug] Reassigned urgent work before expiring pending approvals**

- **Found during:** Task 04-48-02 offboarding integration review
- **Issue:** Expiring approvals first removed the pending rows used to derive durable reassignment evidence.
- **Fix:** Reassignment is captured first, then future approvals are removed in the same transaction; access-review suspension also revokes delegations and approvals.
- **Verification:** Application rollback tests and repository authority-removal SQL witnesses pass.
- **Committed in:** `a780cd4`

---

**Total deviations:** 3 auto-fixed (1 missing security invariant, 2 correctness bugs). **Impact on plan:** Required to meet non-widening upgrade, concurrency, and atomic offboarding guarantees; no scope expansion.

## Issues Encountered

- Four live PostgreSQL cases remain intentionally skipped because no explicitly synthetic `TEST_DATABASE_URL` is configured and Docker is prohibited for this workflow. Unit/schema, full adapter/application, architecture, Rust, and contract checks pass.

## User Setup Required

None - no production service or secret configuration was introduced.

## Next Phase Readiness

- PostgreSQL governance authority is ready for Plan 04-52 API routes and later Admin UI consumption.
- No code blocker remains; a dedicated synthetic PostgreSQL URL is optional for daemon-free live race execution.

## Self-Check: PASSED

- All key files exist and all four TDD commits are present.
- Application: 20/20; adapters: 57 passed with 4 guarded live cases skipped.
- Architecture: 46/46; Rust: 85/85; Cargo build passed; contracts: 12 artifacts without drift.

---

*Phase: 04-identity-commerce-devices-and-administration*
*Completed: 2026-08-07*
