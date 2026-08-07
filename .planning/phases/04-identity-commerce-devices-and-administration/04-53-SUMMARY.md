---
phase: 04-identity-commerce-devices-and-administration
plan: '53'
subsystem: api
tags: [admin, postgres, operations, readiness, workers, sse, tdd]
requires:
  - phase: 04-51
    provides: Persistent invitation authority and idempotent invitation worker behavior
  - phase: 04-52
    provides: Governance, approval, administrative invitation, and break-glass HTTP boundaries
provides:
  - Complete composed Admin registrar for core, invitations, governance, approvals, and operations
  - PostgreSQL-backed staging authority with migrations and fail-closed readiness
  - Server-filtered operational search, projections, freshness invalidation, and critical commands
  - Bounded Admin worker entrypoint for invitation and operational claims
affects: [04-54, 04-58, 04-62, admin-runtime, staging-readiness]
tech-stack:
  added: []
  patterns:
    [filter-before-match, invalidation-only-sse, capability-specific-degradation, fail-closed-readiness]
key-files:
  created:
    - apps/api/src/modules/admin/operations-routes.ts
    - apps/api/src/modules/admin/operations-routes.test.ts
  modified:
    - apps/api/src/modules/admin/routes.ts
    - apps/api/src/staging/runtime.ts
    - apps/api/src/staging/real-admin.test.ts
    - apps/api/src/worker.ts
key-decisions:
  - 'Live delivery carries only bounded invalidation metadata and reconnect cursors; every client must refetch authoritative PostgreSQL projections.'
  - 'Staging readiness requires invitation, governance, operations, and worker database objects after all three Admin migrations succeed.'
  - 'Unavailable invitation delivery providers fail closed instead of returning a simulated delivery receipt.'
  - 'Direct Node staging execution uses explicit TypeScript subpaths so OCI startup verifies the same entrypoint used in deployment.'
requirements-completed: [WEB-06, WEB-07, IDEN-03]
duration: 25 min
completed: 2026-08-07
status: complete
---

# Phase 04 Plan 53: Complete Admin Runtime Composition Summary

**Complete PostgreSQL Admin authority with bounded operational APIs, persistent role/action adapters, worker composition, and fail-closed staging readiness**

## Performance

- **Duration:** 25 min
- **Started:** 2026-08-07T01:24:00-03:00
- **Completed:** 2026-08-07T01:49:00-03:00
- **Tasks:** 2
- **Files modified:** 13

## Accomplishments

- Added server-authorized operational search plus masked queue, view, inbox, job, incident, export, configuration, capacity, environment, audit, alert, privacy, and emergency projections.
- Added invalidation-only SSE freshness with reconnect cursor and authoritative manual projection fallback; no secret payload is streamed.
- Added job, conflict, incident recovery, export, configuration rollback, privacy, and emergency endpoints with generated commands where available, HMAC CSRF, bounded input, no-store, idempotency, and distinct stale/conflict/partial/rate-limit/degraded outcomes.
- Composed core, invitation, governance, approval, and operations registrars into one required Admin registration boundary.
- Added Admin invitation/governance/operations migrations before staging startup and table/function checks before `/ready` can report `authorityConnected`.
- Replaced denied role/command placeholders with PostgreSQL transactions, immutable audit writes, outbox writes, persisted command receipts, and passkey-bound step-up resolution.
- Added a bounded worker entrypoint that drives invitation jobs and PostgreSQL operational item claims together.
- Preserved honest capability degradation: the absent invitation delivery provider rejects the operation instead of manufacturing a delivery receipt.

## Task Commits

1. **Task 04-53-01: Expose operational queries, commands, and freshness**
   - `64eeebb` — RED secure operations route contract
   - `8dee49b` — GREEN operational routes and freshness boundary
2. **Task 04-53-02: Compose real repositories, workers, and readiness**
   - `47d1860` — RED complete persistent composition contract
   - `f166811` — GREEN PostgreSQL Admin runtime, registrars, workers, and readiness

## Decisions Made

- Search input never accepts browser-supplied scopes or owner authority. The application authorization port supplies permitted scopes before PostgreSQL matching.
- Critical mutations always return `secretlyQueued: false` on uncertainty or outage. HTTP status preserves stale/conflict (`409`), partial (`207`), rate limit (`429`), and unavailable/degraded (`503`) distinctions.
- The live endpoint emits only cursor, version, observed time, and affected resource names. Record authority stays in ordinary filtered PostgreSQL queries.
- Administrative runtime registration is all-or-nothing. A staging process cannot advertise complete Admin readiness when any Admin schema or worker claim function is absent.
- Passkey step-up is derived from the persisted admin session and bound to action, resource, target, and authorization context for at most five minutes.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] Preserved direct Node/OCI module resolution**

- **Found during:** Full API container-contract gate
- **Issue:** New runtime imports initially traversed package index files containing `.js` source references that direct `node --experimental-strip-types` could not resolve.
- **Fix:** Routed Admin runtime dependencies through explicit exported TypeScript subpaths and changed the composed registrar's runtime imports to `.ts`.
- **Verification:** `container-contract.test.ts` passes and rejects invalid environment admission with `STAGING_API_STARTUP_FAILED`, not `ERR_MODULE_NOT_FOUND`.
- **Committed in:** `f166811`

**2. [Rule 2 - Missing Critical] Removed legacy denied Admin mutation placeholders**

- **Found during:** Task 04-53-02 composition audit
- **Issue:** The pre-existing read-only staging Admin still wired `deniedRoleAuthority` and `deniedCommandAuthority`.
- **Fix:** Added PostgreSQL role/function-session transitions and allowlisted command transactions with audit, outbox, replay receipt, version, and passkey step-up boundaries.
- **Verification:** Real staging test proves function-session, audit, and outbox writes occur in one transaction; source guard finds neither denied placeholder.
- **Committed in:** `f166811`

**3. [Rule 2 - Missing Critical] Prevented simulated invitation delivery success**

- **Found during:** Zero-mock runtime review
- **Issue:** An opaque locally generated reference could be mistaken for a real provider handoff.
- **Fix:** Provider absence now fails closed; PostgreSQL invitation storage and management remain available without claiming an email was delivered.
- **Verification:** Runtime contains no fixture/placeholder authority and no synthetic provider receipt path.
- **Committed in:** `f166811`

---

**Total deviations:** 3 auto-fixed correctness/runtime issues. **Impact on plan:** Required for deployable Node execution, zero-placeholder authority, and honest provider degradation; no product scope expansion.

## Issues Encountered

- Repository-wide `pnpm lint` still reports 258 pre-existing errors across unrelated account/admin UI, older API tests, desktop, and web-evidence project-service configuration. Every file changed by this plan passes ESLint, and the complete API/type/architecture/contract/Rust gates pass. No unrelated lint files were modified.
- No Docker or destructive Neon staging test was used.

## User Setup Required

- A real invitation email delivery provider remains intentionally unavailable and fail-closed until its provider credentials/recipient transport are configured in the owning delivery plan.

## Next Phase Readiness

- Plan 04-54 can build on a runtime where all Admin schemas and registrars are mandatory before readiness.
- Plan 04-62 can bind the redesigned Admin UI to search, projections, freshness, and mutation outcomes without fixtures or client-owned authority.

## Self-Check: PASSED

- Full API: 212/212.
- Focused Admin staging/module suites: 31/31.
- Changed-file ESLint and API/application/adapter typechecks: passed.
- Admin application tests: 21/21.
- Admin adapter tests: 12 passed, 1 environment-gated skip.
- Architecture: 46/46.
- Contract generation: 12 artifacts without drift.
- Rust workspace: 85/85.
- Direct Node/OCI entrypoint contract: 6/6.

---

_Phase: 04-identity-commerce-devices-and-administration_
_Completed: 2026-08-07_
