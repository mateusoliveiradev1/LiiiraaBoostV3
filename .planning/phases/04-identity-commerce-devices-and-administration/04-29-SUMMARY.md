---
phase: 04-identity-commerce-devices-and-administration
plan: "29"
subsystem: privacy-lifecycle
tags: [privacy, s3, outbox, retention, tdd]
status: complete
requires:
  - phase: 04-04
    provides: PostgreSQL lifecycle, object metadata, deletion, and outbox schema
  - phase: 04-09
    provides: consent-bound diagnostic storage boundary
  - phase: 04-15
    provides: support, consent, and account deletion domain transactions
provides:
  - idempotent private-object purge with checksum and provider receipt evidence
  - locked seven-day account finalization with cancellation precedence
  - exact bounded retention scheduling and expiry through the privacy worker
affects: [04-30, 04-35, phase-10-production-promotion]
tech-stack:
  added: []
  patterns:
    - versioned outbox jobs claimed with FOR UPDATE SKIP LOCKED
    - delete object before committing metadata deletion evidence
    - domain-owned deletion finalization reused inside the worker transaction boundary
key-files:
  created:
    - packages/control-plane-application/src/ports/objects.ts
    - packages/control-plane-adapters/src/storage/s3-object-lifecycle.ts
    - apps/api/src/workers/privacy-lifecycle.ts
    - apps/api/src/workers/privacy-lifecycle.test.ts
  modified:
    - packages/control-plane-application/src/index.ts
    - packages/control-plane-application/src/use-cases/delete-account.ts
    - packages/control-plane-application/src/use-cases/manage-consent.ts
    - packages/control-plane-application/src/use-cases/manage-support-case.ts
    - packages/control-plane-adapters/src/index.ts
    - apps/api/src/modules/support/support-lifecycle.test.ts
key-decisions:
  - "Use the outbox job ID plus aggregate version as the durable privacy-work identity; completed jobs are never reclaimed."
  - "Delete private objects before persisting checksum/provider receipt evidence, and never mark deletion on provider failure."
  - "Run account finalization through the existing row-locked deletion use case and schedule every bounded retained record back through the same worker."
metrics:
  duration: 13 min
  completed: 2026-08-05
---

# Phase 04 Plan 29: Privacy Lifecycle Summary

Idempotent S3-backed attachment disposal and row-locked seven-day account finalization with exact, self-expiring retained evidence.

## Performance

- **Duration:** 13 min
- **Started:** 2026-08-05T05:47:05Z
- **Completed:** 2026-08-05T06:00:00Z
- **Tasks:** 1
- **Files modified:** 10

## Accomplishments

- Added provider-neutral private-object head/delete contracts and an S3 adapter that checks persisted SHA-256 metadata, deletes the exact version, and returns bounded provider evidence.
- Added a durable privacy worker for 30-day attachment purge, immediate consent-copy disposal, seven-day account finalization, and retained-row expiry.
- Preserved cancellation precedence and exact timing through the existing serialized deletion transaction while scheduling only the approved 5-year billing/antifraud/audit and 2-year security/recovery records.
- Added retry and terminal failure evidence that never reports provider-failed objects as deleted.

## TDD Gates

### RED

- Added clock-bound purge, immediate-disposal, provider retry, cancellation-race, finalization, retention-expiry, and S3 receipt tests.
- The prescribed focused suite failed because `privacy-lifecycle.ts` did not exist, proving the planned handler boundary was absent.
- Commit: `05c9870` (`test(04-29): add failing privacy lifecycle tests`)

### GREEN

- Implemented the object port, S3 adapter, privacy worker, consent disposal scheduling, and retention expiry scheduling.
- The privacy lifecycle suite passes 8 tests; the support lifecycle suite passes 6 tests; the complete daemon-free API suite passes 133 tests across 16 files.
- Commit: `7e6e73f` (`feat(04-29): implement privacy lifecycle worker`)

### REFACTOR

- Kept the GREEN implementation minimal and reused the existing deletion decision/transaction boundary; no separate refactor commit was necessary.
- Formatting, API type checking, and changed-file lint all pass.

## Task Commits

1. **Task 04-29-01 RED: lifecycle witnesses** - `05c9870`
2. **Task 04-29-01 GREEN: privacy lifecycle worker** - `7e6e73f`

## Files Created/Modified

- `packages/control-plane-application/src/ports/objects.ts` - Private object head/delete contracts and evidence types.
- `packages/control-plane-adapters/src/storage/s3-object-lifecycle.ts` - Version-aware S3 checksum verification and idempotent deletion.
- `apps/api/src/workers/privacy-lifecycle.ts` - Locked claims, object purge, account finalization, retry/terminal health, and retention expiry.
- `apps/api/src/workers/privacy-lifecycle.test.ts` - Deterministic lifecycle, race, retry, and S3 adapter witnesses.
- `apps/api/src/modules/support/support-lifecycle.test.ts` - Exact 30-day purge and immediate consent disposal scheduling witnesses.
- `packages/control-plane-application/src/use-cases/manage-consent.ts` - Immediate copy-disposal outbox work on revoke/expiry.
- `packages/control-plane-application/src/use-cases/delete-account.ts` - Exact retained-record expiry jobs after finalization.

## Decisions Made

- Outbox claims carry the aggregate/version assertion used by the worker, while the deletion aggregate is loaded inside its existing serialized transaction so a cancellation committed first always wins.
- A missing object is an idempotent success only after a provider head result proves absence; a checksum mismatch is terminal and provider unavailability remains retryable.
- Retained evidence remains a closed domain union with fixed purposes and calendar-year deadlines; each record receives an exact expiry job handled by the same privacy worker.

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered

- Direct package-level TypeScript checks for the application/adapters expose a pre-existing missing Node type configuration in `packages/contracts-ts/src/offline-entitlement.ts`. The task-scoped API TypeScript check passes, and no dependency was installed or changed.
- Context7 was not available through MCP or the local `ctx7` CLI, so the implementation followed the already pinned AWS SDK types and the repository's established S3 adapter pattern.

## Verification

- `rtk pnpm --filter @liiiraa/api test -- --run privacy-lifecycle` - PASS (8/8)
- `rtk pnpm --filter @liiiraa/api test -- --run support-lifecycle` - PASS (6/6)
- `rtk pnpm --filter @liiiraa/api test -- --run` - PASS (133/133 across 16 files)
- `rtk pnpm exec tsc -p apps/api/tsconfig.json --noEmit` - PASS
- Changed-file ESLint and Prettier checks - PASS
- TDD log contains RED `05c9870` followed by GREEN `7e6e73f` - PASS
- Docker/Testcontainers - not invoked; all verification was daemon-free

## Known Stubs

None.

## Next Phase Readiness

- The privacy lifecycle is ready for PostgreSQL repository composition and staging object-store credentials in downstream deployment plans.
- Production retention promotion still requires the external legal/security review recorded by the accepted audit-security ADR.

## Self-Check: PASSED

- All four created files exist.
- Both task commits exist and are ordered RED then GREEN.
- Required focused and complete daemon-free verification suites pass.
- Protected untracked `.impeccable/` and `apps/desktop/src-tauri/gen/` remain untouched and unstaged.
