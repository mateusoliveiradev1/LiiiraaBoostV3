---
phase: 04-identity-commerce-devices-and-administration
plan: '46'
subsystem: database
tags: [admin, invitations, postgresql, concurrency, migrations, privacy, tdd]
requires:
  - phase: 04-45
    provides: Transactional invitation use cases and narrow persistence ports
provides:
  - Durable PostgreSQL invitation lifecycle, capacity, secret, event, job, receipt, and audit schema
  - Race-safe repository transactions with row locking, expected versions, idempotency, and bounded SKIP LOCKED claims
  - Digest-only recipient and secret persistence with rotation history and closed-record pseudonymization
affects: [04-47, 04-51, admin-invitations, beta-access, postgres]
tech-stack:
  added: []
  patterns: [serialized capacity aggregate, append-only lifecycle history, digest-only invitation authority]
key-files:
  created:
    - packages/control-plane-adapters/src/postgres/migrations/0004_admin_invitations.sql
    - packages/control-plane-adapters/src/postgres/admin-invitations.ts
    - packages/control-plane-adapters/src/postgres/admin-invitations.test.ts
  modified:
    - packages/control-plane-adapters/src/postgres/migrations.test.ts
    - packages/control-plane-adapters/src/index.ts
    - packages/control-plane-adapters/package.json
    - packages/control-plane-application/src/ports/admin-invitations.ts
    - packages/control-plane-application/src/use-cases/manage-beta-invitations.ts
    - packages/control-plane-application/src/use-cases/manage-beta-invitations.test.ts
key-decisions:
  - 'Serialize the 25-slot beta capacity through one locked singleton aggregate and reinforce it with a database trigger.'
  - 'Retain every rotated secret digest as immutable history while a partial unique index permits exactly one usable secret per invitation.'
  - 'Upgrade legacy active beta invitations deterministically: the first 25 remain pending and all excess recipients enter the durable queue.'
patterns-established:
  - 'Invitation writes lock capacity and aggregate authority inside the same PostgreSQL transaction that persists events, audit, outbox, receipts, and replay results.'
  - 'Legacy identity material crosses the migration boundary only as normalized SHA-256 recipient digests; legacy token material is never copied.'
requirements-completed: [WEB-06, IDEN-01]
duration: 17 min
completed: 2026-08-06
status: complete
---

# Phase 04 Plan 46: PostgreSQL Invitation Authority Summary

**Durable invitation authority with a serialized 25-slot beta cap, digest-only secret rotation, append-only lifecycle history, and atomic acceptance**

## Performance

- **Duration:** 17 min
- **Started:** 2026-08-06T23:15:40-03:00
- **Completed:** 2026-08-06T23:32:08-03:00
- **Tasks:** 2
- **Files modified:** 9

## Accomplishments

- Added migration `0004_admin_invitations` with authoritative capacity, lifecycle, secret, command, job, receipt, event, audit, and retention records.
- Implemented the production PostgreSQL repository for every invitation application port, including transaction-scoped locks, command replay, version guards, atomic secret consumption, job claims, and pseudonymization.
- Preserved legacy invitations without plaintext email or token material and safely queued beta invitations beyond the 25-active limit.
- Verified 167 TypeScript tests across domain/application/adapters, 46 architecture checks, 85 Rust tests, Cargo build, lint/typecheck, and 12 generated contract artifacts without drift.

## Task Commits

Each TDD task was committed atomically:

1. **Task 04-46-01: Migrate authoritative invitation records**
   - `41db779` — RED migration invariants
   - `6bc1d2d` — GREEN authoritative migration
2. **Task 04-46-02: Implement the invitation repository transaction**
   - `9f43af0` — RED repository tests
   - `d45ecad` — GREEN PostgreSQL invitation authority

## Files Created/Modified

- `packages/control-plane-adapters/src/postgres/migrations/0004_admin_invitations.sql` — Durable schema, invariants, legacy upgrade, capacity trigger, append-only events, and job claim function.
- `packages/control-plane-adapters/src/postgres/admin-invitations.ts` — Migration runner and production repository adapter.
- `packages/control-plane-adapters/src/postgres/admin-invitations.test.ts` — Migration checksum, repository locking, job claim, privacy, and retention witnesses.
- `packages/control-plane-adapters/src/postgres/migrations.test.ts` — Fresh/upgrade structural migration witnesses.
- `packages/control-plane-application/src/ports/admin-invitations.ts` — Worker claim and retention ports plus complete durable job states.
- `packages/control-plane-application/src/use-cases/manage-beta-invitations.ts` — Foreign-key-safe invitation and secret persistence ordering.
- `packages/control-plane-application/src/use-cases/manage-beta-invitations.test.ts` — Updated deterministic repository harness.
- `packages/control-plane-adapters/src/index.ts` and `package.json` — Public adapter exports.

## Decisions Made

- Capacity is authoritative in PostgreSQL, not inferred from an Admin UI count or process-local memory.
- Secret rotation inserts a new digest record and invalidates the prior active digest, preserving non-usable history for audit without retaining plaintext.
- Queue positions are durable and deterministic during legacy migration; administrative-team invitations do not consume beta capacity.
- Worker claims return the real `running` state produced by PostgreSQL and are bounded to 100 rows per claim.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Prevented legacy upgrade failure above the beta capacity**

- **Found during:** Task 04-46-02 integration review
- **Issue:** The initial upgrade classified every unexpired legacy tester invitation as pending, so row 26 would trip the capacity trigger and roll back the migration.
- **Fix:** Deduplicated recipients, ranked active beta rows, kept the first 25 pending, and assigned deterministic queue positions to the remainder.
- **Files modified:** `packages/control-plane-adapters/src/postgres/migrations/0004_admin_invitations.sql`, `packages/control-plane-adapters/src/postgres/migrations.test.ts`
- **Verification:** Migration tests pass and explicitly witness ranking, overflow classification, queue position, and absence of legacy token copying.
- **Committed in:** `d45ecad`

**2. [Rule 2 - Missing Critical] Preserved secret rotation history under the real foreign key**

- **Found during:** Task 04-46-02 repository integration
- **Issue:** A one-row-per-invitation secret key would overwrite rotation history, and inserting the digest before its invitation violated the production foreign key.
- **Fix:** Added immutable secret record IDs plus one-active-secret partial uniqueness, inserted each rotated digest separately, and persisted the invitation before its secret.
- **Files modified:** migration, repository, invitation use case, and tests
- **Verification:** Adapter/application tests, typecheck, lint, and architecture checks pass.
- **Committed in:** `d45ecad`

**3. [Rule 1 - Bug] Aligned claimed job projection with database state**

- **Found during:** Task 04-46-02 repository review
- **Issue:** PostgreSQL changes claimed jobs to `running`, while the application projection did not admit that durable state and the test did not inspect the returned row.
- **Fix:** Completed the job-state union and asserted the claimed `running` projection.
- **Files modified:** application port and repository test
- **Verification:** Repository claim test passes with `FOR UPDATE SKIP LOCKED` and a `running` result.
- **Committed in:** `d45ecad`

---

**Total deviations:** 3 auto-fixed (2 correctness bugs, 1 missing critical durability invariant). **Impact on plan:** All fixes were required for the planned concurrency, persistence, and privacy guarantees; no scope expansion.

## Issues Encountered

- Live PostgreSQL cases remain intentionally skipped because this workstation has no explicitly synthetic `TEST_DATABASE_URL`, and the approved workflow forbids Docker. The deterministic unit/schema witnesses, full package suites, architecture tests, Rust tests, and contract drift checks all pass; CI or a dedicated synthetic database can execute the four guarded live cases later.

## User Setup Required

None - no production service or secret configuration was introduced by this plan.

## Next Phase Readiness

- The durable invitation repository is ready for Plan 04-47 worker and operational integration.
- No code blocker remains. A synthetic PostgreSQL URL is optional for running the guarded live migration cases without Docker.

## Self-Check: PASSED

- All key files exist and all four TDD commits are present.
- Domain: 103/103; application: 13/13; adapters: 51 passed with 4 live PostgreSQL cases intentionally skipped.
- Architecture: 46/46; Rust: 85/85; Cargo build passed; contracts: 12 artifacts without drift.

---

*Phase: 04-identity-commerce-devices-and-administration*
*Completed: 2026-08-06*
