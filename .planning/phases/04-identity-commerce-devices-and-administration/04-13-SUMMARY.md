---
phase: 04-identity-commerce-devices-and-administration
plan: '13'
subsystem: commerce
tags:
  [postgresql-authority, subscriptions, invoices, entitlements, reconciliation, idempotency, tdd]
requires:
  - phase: 04-identity-commerce-devices-and-administration
    provides: Generated commerce/provider contracts and deterministic authority witnesses from Plan 04-03
  - phase: 04-identity-commerce-devices-and-administration
    provides: PostgreSQL commerce, entitlement, audit, inbox, and outbox schema from Plan 04-04
  - phase: 04-identity-commerce-devices-and-administration
    provides: Signature-first unique webhook admission and fresh provider retrieval from Plan 04-08
provides:
  - Pure D-11 through D-21 subscription, refund, grace, cancellation, Pix, price, and dispute decisions
  - Provider-authoritative atomic subscription, invoice, entitlement, audit, outbox, and inbox convergence
  - Owner-scoped commerce HTTP operations and bounded SKIP LOCKED worker processing
affects: [04-18, 04-28, account-commerce, desktop-entitlements, administration]
tech-stack:
  added: []
  patterns:
    - Signed event admission plus fresh provider retrieval is the sole Premium mutation path
    - Reconciliation fingerprints suppress duplicate audit/outbox authority across replayed or reordered events
    - Deterministic serializable repositories prove PostgreSQL transaction behavior without a daemon
key-files:
  created:
    - packages/control-plane-domain/src/commerce/subscription.ts
    - packages/control-plane-domain/src/commerce/subscription.test.ts
    - packages/control-plane-application/src/use-cases/reconcile-commerce.ts
    - packages/control-plane-application/src/use-cases/manage-subscription.ts
    - apps/api/src/modules/commerce/routes.ts
    - apps/api/src/modules/commerce/reconciliation.test.ts
    - apps/api/src/worker.ts
    - apps/api/scripts/run-tests.mjs
  modified:
    - packages/control-plane-domain/src/index.ts
    - packages/control-plane-application/src/index.ts
    - packages/control-plane-application/src/ports/commerce.ts
    - apps/api/package.json
key-decisions:
  - 'Checkout intent and return navigation remain payment-pending; only reconciled provider truth may activate Premium.'
  - 'Bind subscription and invoice truth into one reconciliation fingerprint so duplicates and reorderings mark inbox progress without duplicating authority writes.'
  - 'Refund, expiry, and dispute may restrict new Premium actions but never remove safety, diagnostic history, warnings, or restoration capability.'
  - 'Keep local verification daemon-free with deterministic serializable repositories while preserving PostgreSQL SKIP LOCKED and atomic transaction contracts.'
patterns-established:
  - 'Commerce convergence: claim one provider event, retrieve current provider truth, lock the aggregate, then atomically write subscription, invoice, entitlement, audit, outbox, and processed inbox state.'
  - 'Commercial fail-closed validation: off-catalog, incomplete, Pix-monthly, or provider-unavailable truth cannot create an entitlement.'
requirements-completed: [WEB-04, IDEN-09]
metrics:
  duration: 26 min
  completed: 2026-08-05
  tasks: 1
  files: 12
status: complete
---

# Phase 04 Plan 13: Reconciled Subscription Authority Summary

**A complete D-11–D-21 subscription lifecycle now converges signed provider truth into one atomic PostgreSQL authority result while checkout intent, duplicates, retries, and disputes remain fail-closed.**

## Performance

- **Duration:** 26 min
- **Started:** 2026-08-05T03:14:46Z
- **Completed:** 2026-08-05T03:41:06Z
- **Tasks:** 1 TDD task
- **Files modified:** 12

## Accomplishments

- Implemented exact BRL/USD monthly/annual pricing, card/Pix admission, no-trial/no-card Free behavior, seven-day grace, cadence migrations, seven-day first-payment refund, prioritized exceptional review, cancel/undo, manual Pix renewal, 30-day price notice, and dispute restrictions.
- Added provider reconciliation that claims one signed event, retrieves fresh provider truth, locks the subscription authority, and atomically converges subscription, invoice, entitlement, audit, notification outbox, and processed inbox state.
- Proved duplicate, replayed, reordered, and concurrent delivery convergence plus rollback on audit/outbox failure with deterministic serializable repositories and no Docker, Testcontainers, or live PostgreSQL.
- Added authenticated commerce routes and a bounded worker claim loop using `FOR UPDATE SKIP LOCKED`, bounded batches, exponential retry delay, and terminal attempt limits.

## TDD Gates

### RED

- Commit `95928f0` introduced 9 lifecycle cases and atomic reconciliation/worker witnesses.
- Both suites failed for the intended reason: `subscription.ts` and `worker.ts` did not exist, so no production behavior could satisfy the contract.

### GREEN

- Commit `a7a4176` implemented the domain decision table, provider reconciliation, subscription command handling, routes, worker, public exports, and focused command seam.
- The exact plan command passes 6 reconciliation cases; the domain suite passes 9 D-11–D-21 cases.

### REFACTOR

- Money, time-window, capability-preservation, provider fingerprint, and worker backoff invariants were consolidated during GREEN.
- No separate behavior-neutral refactor commit was required after strict type, lint, signature-regression, supply-chain, and architecture gates passed.

## Task Commits

1. **Task 04-13-01 RED: specify reconciled subscription lifecycle** — `95928f0` (`test`)
2. **Task 04-13-01 GREEN: implement reconciled subscription authority** — `a7a4176` (`feat`)
3. **Task 04-13-01 post-GREEN correction: retain non-interactive test execution** — `d11e28d` (`fix`)

## Files Created/Modified

- `packages/control-plane-domain/src/commerce/subscription.ts` — Pure price, time-window, cadence, refund, cancellation, Pix, price-change, dispute, and capability-preservation decisions.
- `packages/control-plane-domain/src/commerce/subscription.test.ts` — Complete D-11 through D-21 state table.
- `packages/control-plane-application/src/use-cases/reconcile-commerce.ts` — Fresh-provider reconciliation with aggregate lock, fingerprint convergence, atomic authority writes, and retryable failure handling.
- `packages/control-plane-application/src/use-cases/manage-subscription.ts` — Idempotent checkout/change/cancel/undo/refund intent orchestration that never self-grants Premium.
- `packages/control-plane-application/src/ports/commerce.ts` — Provider-neutral cadence, payment, price, failure, refund, and dispute truth needed for authoritative reconciliation.
- `apps/api/src/modules/commerce/routes.ts` — Owner-scoped checkout, projection, change, cancel/undo, invoice, refund, status, and signed-webhook operations.
- `apps/api/src/modules/commerce/reconciliation.test.ts` — Atomic rollback, current-truth lifecycle, duplicate/reorder/concurrency, no-provider-authority, and worker proofs.
- `apps/api/src/worker.ts` — Bounded `SKIP LOCKED` commerce job claiming and retry policy.
- `apps/api/scripts/run-tests.mjs` / `apps/api/package.json` — Argument normalization that keeps the exact focused GSD command truthful and all default API tests non-interactive.
- Package public roots export the new domain and application contracts without forbidden deep imports.

## Decisions Made

- Provider webhook payload order is never lifecycle authority. Every admitted event triggers retrieval of current provider truth, and only that retrieved snapshot can change Premium.
- Checkout creation/return stores a pending intent only; URL state, navigation, and client request bodies cannot promote the subscription or entitlement.
- Reconciliation compares a provider-customer-bound subscription/invoice fingerprint under the aggregate lock. Identical later truth marks each inbox event processed without another subscription, entitlement, audit, or outbox write.
- Existing safety, history, warnings, and restoration are modeled independently from authorization for new Premium actions and remain true through refund, expiry, and dispute.

## Verification Results

- `rtk pnpm --filter @liiiraa/api test -- --run reconciliation`: **PASS** — 6/6 atomic reconciliation, lifecycle, idempotency, rollback, and worker cases.
- Domain lifecycle suite: **PASS** — 9/9 D-11 through D-21 state-table cases.
- Plan 04-08 Stripe regression: **PASS** — 8 passed, 1 explicitly skipped environment-gated PostgreSQL probe; signature-before-parse and 5,040-order convergence remain intact.
- Strict TypeScript: **PASS** — domain, application, and API projects all compile with `exactOptionalPropertyTypes` and no errors.
- Focused ESLint and Prettier: **PASS** — no warnings or formatting drift across all plan files and critical seams.
- `rtk pnpm supply-chain:check`: **PASS** — all 72 exact dependency pins verified; no dependency changed.
- `rtk pnpm test:architecture`: **PASS** — both workspace/Cargo adapters executed and 46/46 architecture tests passed.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Included provider customer identity in the first reconciliation fingerprint**

- **Found during:** Task 04-13-01 GREEN concurrency verification
- **Issue:** The first fingerprint omitted `providerCustomerId`, so the next reordered event appeared different and duplicated one audit/outbox pair.
- **Fix:** Bind provider customer identity into the first authoritative state before fingerprinting.
- **Files modified:** `packages/control-plane-application/src/use-cases/reconcile-commerce.ts`
- **Verification:** Concurrent duplicate/reordered test converges to one subscription, invoice, entitlement, audit, and outbox result.
- **Committed in:** `a7a4176`

**2. [Rule 3 - Blocking] Normalized pnpm's standalone argument separator for focused API tests**

- **Found during:** Task 04-13-01 exact plan verification
- **Issue:** `pnpm test -- --run reconciliation` forwarded a literal `--`, causing Vitest to collect unrelated intentional RED witnesses owned by future Plans 04-16/04-17.
- **Fix:** Added a package-local runner that removes only standalone separators, preserves all requested filters, and defaults to non-interactive run mode.
- **Files modified:** `apps/api/scripts/run-tests.mjs`, `apps/api/package.json`
- **Verification:** Both `test -- reconciliation` and the exact plan command collect only the 6 reconciliation cases and pass.
- **Committed in:** `a7a4176`, `d11e28d`

**3. [Rule 2 - Missing Critical] Exposed new authority contracts through approved package roots**

- **Found during:** Task 04-13-01 GREEN integration
- **Issue:** The declared implementation files could not be consumed without forbidden cross-package deep imports, and the earlier provider port lacked cadence/payment/refund/dispute truth required to validate D-11–D-21.
- **Fix:** Added narrow public-root exports and provider-neutral optional reconciliation fields without changing generated contracts or provider adapter ownership.
- **Files modified:** `packages/control-plane-domain/src/index.ts`, `packages/control-plane-application/src/index.ts`, `packages/control-plane-application/src/ports/commerce.ts`
- **Verification:** All strict type checks and 46 architecture cases pass; the 04-08 provider adapter regression remains green.
- **Committed in:** `a7a4176`

---

**Total deviations:** 3 auto-fixed (1 correctness bug, 1 blocking verification seam, 1 missing critical package boundary).
**Impact on plan:** All fixes were required for truthful idempotency, executable verification, and approved module ownership. No dependency, provider credential, daemon, schema table, or infrastructure scope was added.

## Known Stubs

None. Provider operations remain injected ports by architecture, not placeholder authority; every local verification path is deterministic and executable.

## Issues Encountered

- The exact pnpm/Vitest filter initially collected unrelated future RED suites. The package-local argument normalizer resolved this without excluding or weakening those witnesses.
- Live PostgreSQL was intentionally not started. The user-mandated daemon-free deterministic repository proves serializable atomicity locally, while the existing schema and environment-gated PostgreSQL probes remain unchanged.

## Authentication Gates

None.

## User Setup Required

None - no Stripe credentials, provider account, Docker daemon, Testcontainers runtime, or live PostgreSQL is required for deterministic verification.

## Next Phase Readiness

- Account and desktop surfaces can consume a truthful pending/active/grace/restricted/expired projection without deriving authority from navigation.
- Plan 04-28 can consume provider-neutral commerce notification jobs for grace/retry, Pix renewal, refund review, price change, and dispute notices.
- Staging must provide concrete PostgreSQL repository bindings and provider credentials through approved adapters; the domain/application authority contract is complete.

## Self-Check: PASSED

- All eight declared created files and four modified seams exist on disk.
- RED `95928f0`, GREEN `a7a4176`, and correction `d11e28d` exist in repository history in the required order.
- All D-11–D-21 lifecycle, atomicity, duplicate/reorder/concurrency, signature regression, type, lint, formatting, supply-chain, and architecture gates pass.
- Stub and threat-surface scans found no incomplete goal-blocking behavior or unplanned trust boundary.

---

_Phase: 04-identity-commerce-devices-and-administration_
_Completed: 2026-08-05_
