---
phase: 04-identity-commerce-devices-and-administration
plan: '50'
subsystem: database
tags: [admin, operations, postgresql, workers, concurrency, audit, tdd]
requires:
  - phase: 04-48
    provides: PostgreSQL governance migration and repository authority patterns
  - phase: 04-49
    provides: Admin operations ports and transactional application use cases
provides:
  - Environment-keyed normalized operational schema for views, inbox, jobs, conflicts, incidents, exports, configuration, capacity, privacy, alerts, and emergency controls
  - PostgreSQL operations repository with scope-first search, replay, row/advisory locks, version guards, immutable history, audit, outbox, and receipts
  - Bounded SKIP LOCKED worker claims plus synthetic-only live concurrency proof
affects: [04-53, admin-operations, postgres, workers, incidents, privacy]
tech-stack:
  added: []
  patterns:
    [
      environment-in-every-authority-key,
      immutable-operational-history,
      bounded-skip-locked-claims,
      synthetic-only-live-proof,
    ]
key-files:
  created:
    - packages/control-plane-adapters/src/postgres/migrations/0006_admin_operations.sql
    - packages/control-plane-adapters/src/postgres/admin-operations.ts
    - packages/control-plane-adapters/src/postgres/admin-operations.test.ts
  modified:
    - packages/control-plane-adapters/src/postgres/migrations.test.ts
    - packages/control-plane-adapters/src/index.ts
    - packages/control-plane-adapters/package.json
key-decisions:
  - 'Put the operational environment UUID in every primary, unique, foreign, search, command, receipt, and audit authority key.'
  - 'Claim job items only through one bounded PostgreSQL function using ordered FOR UPDATE SKIP LOCKED leases.'
  - 'Append configuration versions, conflicts, incident timeline, receipts, and audit evidence instead of overwriting completed history.'
  - 'Run destructive PostgreSQL concurrency proof only against an explicitly synthetic TEST_DATABASE_URL; never Docker or staging.'
patterns-established:
  - 'Operational search applies environment, scope, and owner predicates before text matching and uses a stable occurred-at/record-id cursor order.'
  - 'Completed jobs cannot be replaced by later cancel/retry writes even when a higher version is presented.'
requirements-completed: [WEB-06, WEB-07, IDEN-03]
duration: 12 min
completed: 2026-08-07
status: complete
---

# Phase 04 Plan 50: PostgreSQL Admin Operations Summary

**Durable environment-bound operational storage with scope-first queries, versioned append-only evidence, replay-safe transactions, and bounded `SKIP LOCKED` worker claims**

## Performance

- **Duration:** 12 min
- **Started:** 2026-08-07T00:20:56-03:00
- **Completed:** 2026-08-07T00:33:24-03:00
- **Tasks:** 2
- **Files modified:** 6

## Accomplishments

- Added migration `0006_admin_operations` with normalized environments, saved views, inbox, jobs/items, conflicts, procedures/incidents/timeline, exports, configuration versions/rollouts, capacity samples/forecasts, ownership/escalations, alerts/acknowledgements, privacy cases, emergency controls, commands, receipts, and audit.
- Added environment-crossing guards, immutable history triggers, bounded retention, idempotency uniqueness, expected versions, lease metadata, and a 1–100 item ordered `FOR UPDATE SKIP LOCKED` claim function.
- Implemented the migration runner and production repository with authorization-ready scope/owner/environment predicates, stable ordering, advisory subject locks, row locks, replay, version guards, minimized outbox work, append-only audit, and durable receipts.
- Implemented exact reload of partial jobs and preserved conflicts plus configuration version history that supports rollback without mutating prior versions.
- Added a worker adapter that maps claimed items without exposing provider-specific state and rejects invalid/unbounded claims.
- Added an optional real PostgreSQL proof that serializes competing workers, preserves completed jobs, retains conflict/config history, enforces receipt immutability, and filters hidden inbox rows.

## Task Commits

1. **Task 04-50-01: Migrate operational ledgers and authority**
   - `5096073` — RED operations migration invariants
   - `47d5825` — GREEN durable operations migration
2. **Task 04-50-02: Implement operations repository and worker claims**
   - `48535e2` — RED PostgreSQL operations repository tests
   - `6e6b452` — GREEN PostgreSQL operations authority

## Files Created/Modified

- `packages/control-plane-adapters/src/postgres/migrations/0006_admin_operations.sql` — Environment-bound normalized schema, history guards, retention, leases, and claim function.
- `packages/control-plane-adapters/src/postgres/admin-operations.ts` — Migration runner, operational repository, exact projections, and worker adapter.
- `packages/control-plane-adapters/src/postgres/admin-operations.test.ts` — Migration, scope-first search, reload, replay/version, claim, history, and guarded live concurrency witnesses.
- `packages/control-plane-adapters/src/postgres/migrations.test.ts` — Static schema, minimization, environment, claim, and immutability invariants.
- Adapter index/package exports expose one explicit PostgreSQL operations entry.

## Decisions Made

- The staging migration admits only the deterministic `synthetic-non-production` environment identity; adapter construction rejects production authority against that store.
- Environment, allowed scopes, and owner are SQL predicates before `ILIKE`, so matching cannot discover records outside authorization.
- Operational job items are claimed by a database function with ordered bounded selection, row locks, expiring leases, and attempt increments in one statement.
- Configuration changes append a new version row and load the highest version under lock; prior rollout/rollback evidence is never updated.
- Outbox work keeps only allowlisted references (`kind`, incident/procedure/export/case IDs), never provider data, credentials, secrets, or diagnostic content.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Removed a uniqueness rule that would have blocked configuration history**

- **Found during:** Task 04-50-02 repository design
- **Issue:** A partial unique index across active configuration statuses would reject appending rollout and rollback versions for one configuration.
- **Fix:** Replaced it with a descending environment/configuration/version index and kept exact current-state loading under row lock.
- **Verification:** Repository tests require inserts only, and the guarded live proof retains two versions.
- **Committed in:** `6e6b452`

**2. [Rule 2 - Missing Critical] Added a destructive-test database identity gate**

- **Found during:** Task 04-50-02 concurrency verification
- **Issue:** Real race proof requires schema reset but must never target staging or production.
- **Fix:** Live proof runs only when protocol and host/user/database identity explicitly contain `synthetic` or `test` and reject `live`, `prod`, or `production`.
- **Verification:** Without `TEST_DATABASE_URL`, the live proof is skipped; unit/schema/full gates pass without Docker.
- **Committed in:** `6e6b452`

**3. [Rule 2 - Missing Critical] Prevented completed-job overwrite by later cancellation/retry**

- **Found during:** Task 04-50-02 version-guard review
- **Issue:** A higher version alone could otherwise replace completed operational evidence.
- **Fix:** PostgreSQL upsert requires both a newer version and current status other than `completed`.
- **Verification:** Unit SQL witness and guarded live proof assert completed version 2 survives a version 3 cancellation attempt.
- **Committed in:** `6e6b452`

---

**Total deviations:** 3 auto-fixed (1 schema correctness bug, 2 missing safety/concurrency guarantees). **Impact on plan:** Required for durable history, safe real-PostgreSQL proof, and immutable completed effects; no scope expansion.

## Issues Encountered

- Five live PostgreSQL cases across the adapter package remain intentionally skipped because no explicitly synthetic `TEST_DATABASE_URL` is configured. Docker is not used, and Neon staging is never eligible.

## User Setup Required

None. An isolated synthetic PostgreSQL URL is optional only for executing the guarded live race proofs.

## Next Phase Readiness

- Plan 04-53 can compose one production operations repository and worker entry without direct SQL or domain imports.
- Operational records now survive process restart and concurrent worker claims at the PostgreSQL boundary.

## Self-Check: PASSED

- Focused operations/migration suites: 15 passed, 4 guarded live cases skipped.
- Full adapters: 64 passed, 5 guarded live cases skipped.
- Architecture: 46/46.
- Contract generation: 12 artifacts without drift.
- Rust workspace: 85/85.

---

_Phase: 04-identity-commerce-devices-and-administration_
_Completed: 2026-08-07_
