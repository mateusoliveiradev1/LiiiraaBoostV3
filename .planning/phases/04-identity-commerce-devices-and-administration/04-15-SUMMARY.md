---
phase: 04-identity-commerce-devices-and-administration
plan: '15'
subsystem: support-privacy
tags: [support, diagnostic-consent, retention, account-deletion, audit, outbox]
requires:
  - phase: 04-03
    provides: Generated support, consent, and account command contracts
  - phase: 04-04
    provides: PostgreSQL support, consent, object metadata, deletion, audit, and outbox schema
  - phase: 04-09
    provides: Continuously revalidated consent-bound diagnostic streaming
  - phase: 04-10
    provides: Immutable audit chain and accepted bounded-retention ADR
provides:
  - Threaded authoritative support cases with plan-aware SLA and incident priority decisions
  - Case/purpose/field-scoped diagnostic consent with immediate committed revocation notification
  - Thirty-day attachment purge, fourteen-day reopen, and fresh-consent lifecycle work
  - Strong-authenticated cancelable seven-day deletion with minimized bounded retention evidence
  - Owner-scoped support, consent, attachment metadata, and privacy HTTP operations
affects: [04-16, 04-17, 04-28, 04-29, account-support, privacy-lifecycle]
tech-stack:
  added: []
  patterns:
    - Account-scoped serializable lifecycle transactions with command-result replay
    - Metadata-only diagnostic persistence and provider-neutral outbox payloads
    - Post-commit consent change publication for active stream termination
key-files:
  created:
    - packages/control-plane-domain/src/support/case.ts
    - packages/control-plane-application/src/use-cases/manage-support-case.ts
    - packages/control-plane-application/src/use-cases/manage-consent.ts
    - packages/control-plane-application/src/use-cases/delete-account.ts
    - apps/api/src/modules/support/routes.ts
  modified:
    - packages/control-plane-domain/src/support/case.test.ts
    - apps/api/src/modules/support/support-lifecycle.test.ts
    - packages/control-plane-domain/src/index.ts
    - packages/control-plane-application/src/index.ts
key-decisions:
  - 'Resolve command replay before expected-version arbitration so lifecycle retries cannot duplicate audit or outbox evidence.'
  - 'Publish consent-change notifications only after the consent, audit, receipt, and outbox transaction commits.'
  - 'Persist diagnostic object identity, checksum, field class, and lifecycle metadata only; diagnostic content remains temporary and consent-bound.'
  - 'Keep legal holds separate from default retention with a named purpose, authorizer, and explicit future expiry.'
patterns-established:
  - 'Lifecycle mutation order: owner/generated-command admission -> serialized transaction -> idempotency -> version -> pure decision -> state/audit/outbox -> post-commit hook.'
  - 'Scheduled jobs carry stable idempotency keys and minimized provider-neutral payloads for Plans 04-28 and 04-29.'
requirements-completed: [WEB-04, WEB-07]
duration: 14 min
completed: 2026-08-05
status: complete
---

# Phase 04 Plan 15: Authoritative Support and Privacy Lifecycles Summary

**Threaded support authority with continuously revocable diagnostic consent, bounded attachment disposal, and strong-authenticated seven-day account deletion backed by minimized audit/outbox evidence**

## Performance

- **Duration:** 14 min
- **Started:** 2026-08-05T03:52:13Z
- **Completed:** 2026-08-05T04:05:46Z
- **Tasks:** 1
- **Files modified:** 9

## Accomplishments

- Implemented authoritative case threads with status/history, Free/Premium 72/24-business-hour targets, and plan-independent billing/security/restoration priority.
- Bound diagnostic consent to one case, purpose, exact admitted field classes, and at most 72 hours; revocation/expiry preserves minimized receipts and terminates active streams through the existing 04-09 hook.
- Scheduled attachment removal no later than 30 days after closure, allowed reopen for 14 days without reactivating consent, and created a related case after the reopen boundary.
- Required server-owned strong reauthentication for a cancelable seven-day deletion, then erased ordinary case/consent data while retaining only exact purpose-bound billing, antifraud, security/recovery, and audit evidence.
- Proved transaction rollback, command replay idempotency, metadata-only diagnostic storage, and provider-neutral lifecycle outbox payloads without Docker or a PostgreSQL daemon.

## Task Commits

Each TDD gate was committed atomically:

1. **RED: Support and privacy lifecycle specification** - `c9ff412` (test)
2. **GREEN: Support, consent, retention, deletion, and HTTP authority** - `69dc099` (feat)
3. **REFACTOR: Common lifecycle scheduling** - `cd2dbea` (refactor)
4. **Integration hardening: Post-commit notification and owner-bound routes** - `1e8c166` (fix)

## Files Created/Modified

- `packages/control-plane-domain/src/support/case.ts` - Pure case, consent, retention, legal-hold, and deletion decisions.
- `packages/control-plane-domain/src/support/case.test.ts` - SLA, reopen, disposal, consent, deletion, retention, and legal-hold decision coverage.
- `packages/control-plane-application/src/use-cases/manage-support-case.ts` - Shared serialized lifecycle transaction contract and authoritative case orchestration.
- `packages/control-plane-application/src/use-cases/manage-consent.ts` - Atomic consent/audit/receipt transitions with post-commit stream notification.
- `packages/control-plane-application/src/use-cases/delete-account.ts` - Seven-day request/cancel/finalize orchestration and ordinary-data erasure.
- `apps/api/src/modules/support/routes.ts` - Owner-scoped generated support, consent, attachment metadata, and deletion operations.
- `apps/api/src/modules/support/support-lifecycle.test.ts` - Daemon-free serializable integration, rollback, idempotency, minimization, finalization, and route witnesses.
- `packages/control-plane-domain/src/index.ts` - Public lifecycle decision exports.
- `packages/control-plane-application/src/index.ts` - Public lifecycle use-case and repository exports.

## Decisions Made

- One account-scoped repository transaction owns case, consent, deletion, audit, and outbox mutation order; command results are replayed before version checks.
- Diagnostic bytes never enter domain state, audit events, outbox jobs, or route projections. Attachments admit only bounded object identity, SHA-256 checksum, field class, and byte length.
- Active stream notification occurs only after a committed consent version change, so a rolled-back revocation cannot terminate access while a committed revocation cannot leave a stream active.
- Default retention is executable policy: billing/invoice/tax five years after transaction, antifraud/dispute five years after closure, security/recovery two years after closure, and administrative/audit five years after append.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] Proved transaction behavior with a deterministic serializable repository**

- **Found during:** Task 04-15-01 GREEN implementation
- **Issue:** The plan required integration transactions while the execution contract prohibited Docker, Testcontainers, and live PostgreSQL.
- **Fix:** Added an account-serialized rollback-capable memory repository that exercises the same idempotency/version/state/audit/outbox contract against the existing 04-04 PostgreSQL schema.
- **Files modified:** `apps/api/src/modules/support/support-lifecycle.test.ts`
- **Verification:** Failed outbox enqueue rolls back case and audit state; concurrent replay produces one case/audit/outbox result.
- **Committed in:** `69dc099`

**2. [Rule 2 - Missing Critical] Added narrow package public exports**

- **Found during:** Task 04-15-01 GREEN verification
- **Issue:** Plan-created authorities were unreachable from the API package through the approved module roots.
- **Fix:** Exported only the new lifecycle decisions, state types, repositories, and use cases from the domain/application public indexes.
- **Files modified:** `packages/control-plane-domain/src/index.ts`, `packages/control-plane-application/src/index.ts`
- **Verification:** Domain, application, and API TypeScript checks resolve all public imports.
- **Committed in:** `69dc099`

**3. [Rule 1 - Bug] Bound route parameters and stream notifications to committed authority**

- **Found during:** Task 04-15-01 final lint/security verification
- **Issue:** Path identifiers needed an explicit equality check against generated command identifiers, and the consent hook needed an explicit post-transaction outcome channel.
- **Fix:** Rejected path/command mismatches and returned the notification effect from the transaction before publishing it after commit.
- **Files modified:** `apps/api/src/modules/support/routes.ts`, `packages/control-plane-application/src/use-cases/manage-consent.ts`, `apps/api/src/modules/support/support-lifecycle.test.ts`
- **Verification:** Changed-file ESLint, TypeScript, 26 support/API tests, and the active stream revocation suite pass.
- **Committed in:** `1e8c166`

---

**Total deviations:** 3 auto-fixed (1 blocking, 1 missing critical, 1 bug).
**Impact on plan:** All changes preserve the declared architecture and security boundaries; no provider, daemon, or unrelated feature scope was added.

## Issues Encountered

- The full API unit replay passes 68/74 tests; the remaining six failures are explicit `EXPECTED_RED` witnesses owned by future Plans 04-16 (admin authorization) and 04-17 (account projection). Both Plan 04-15 support files and the 04-09 consent-stream integration pass completely.

## Verification

- `pnpm --filter @liiiraa/api test -- --run support-lifecycle` - PASS (1 file, 6 tests).
- `pnpm --filter @liiiraa/api test -- --run consent-stream` - PASS (1 file, 20 tests).
- `pnpm --filter @liiiraa/control-plane-domain exec vitest --run src/support/case.test.ts` - PASS (1 file, 7 tests).
- Domain, application, and API TypeScript project checks - PASS.
- Changed-file ESLint and Prettier checks - PASS.
- `pnpm --filter @liiiraa/api db:migrate:test` - PASS in daemon-free mode (4 passed, 3 live-PostgreSQL probes skipped by policy).
- `pnpm test:architecture` - PASS for workspace and Cargo architecture adapters.
- Diagnostic persistence scan - PASS: no diagnostic byte/table payload type is present in production lifecycle files.

## TDD Gate Compliance

- **RED:** `c9ff412` failed because the planned domain and route authorities did not exist.
- **GREEN:** `69dc099` made all case, consent, deletion, retention, transaction, and route witnesses pass.
- **REFACTOR:** `cd2dbea` centralized idempotent lifecycle job construction while preserving all focused results.

## Known Stubs

None.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness

- Plan 04-28 can deliver the provider-neutral case/consent/deletion notices already emitted through idempotent outbox jobs.
- Plan 04-29 can claim attachment purge and account-finalization jobs, re-read authoritative lifecycle state, and record bounded failure evidence.
- Plans 04-16 and 04-17 retain their intentional RED admin/account witnesses and are not blocked by this plan.

## Self-Check: PASSED

- All five created implementation files and this summary exist on disk.
- RED, GREEN, REFACTOR, and integration-hardening commits exist in git history.
- Every Plan 04-15 domain, API, consent-stream, type, lint, formatting, migration, minimization, and architecture gate passes.

---

_Phase: 04-identity-commerce-devices-and-administration_
_Completed: 2026-08-05_
