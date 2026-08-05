---
phase: 04-identity-commerce-devices-and-administration
plan: "14"
subsystem: devices
tags: [device-binding, concurrency, cooldown, idempotency, audit, outbox]
requires:
  - phase: 04-03
    provides: Generated device commands and projections
  - phase: 04-04
    provides: Entitlement, binding, audit, outbox, and partial unique-index schema
  - phase: 04-06
    provides: Protected device evidence comparison policy
  - phase: 04-11
    provides: Owner-scoped session authority independent from device binding
  - phase: 04-32
    provides: Owner-bound device concurrency RED witnesses
provides:
  - Pure D-23 through D-28 device binding, cooldown, theft, exception, and revalidation decisions
  - Transactional bind and transfer use cases with ownership, expected-version, idempotency, audit, and outbox guarantees
  - Owner-bound HTTP device operations and deterministic 20-way race evidence
affects: [04-15, 04-16, 04-17, desktop-entitlements, account-devices]
tech-stack:
  added: []
  patterns:
    - Entitlement-scoped serializable transaction before device mutation
    - Remote authoritative projection on expected-version conflict
    - Locked single-use support exception redemption
key-files:
  created:
    - packages/control-plane-domain/src/devices/device-binding.ts
    - packages/control-plane-application/src/use-cases/bind-device.ts
    - packages/control-plane-application/src/use-cases/transfer-device.ts
    - apps/api/src/modules/devices/routes.ts
  modified:
    - packages/control-plane-domain/src/devices/device-binding.test.ts
    - apps/api/src/modules/devices/device-concurrency.test.ts
    - packages/control-plane-domain/src/index.ts
    - packages/control-plane-application/src/index.ts
    - packages/control-plane-domain/package.json
key-decisions:
  - "Check command idempotency before expected-version arbitration, then lock entitlement and exception authority inside one transaction."
  - "Keep session revocation and Premium device binding as separate authorities; device mutations authorize the owning account without touching sessions."
  - "Use deterministic serializable repositories for local race proof under the daemon-free execution constraint while retaining the PostgreSQL partial unique index as final persistence defense."
patterns-established:
  - "Device mutation order: owner authorization -> transaction -> idempotency -> entitlement lock -> version -> pure decision -> binding/exception -> audit/outbox."
  - "Policy denials preserve and return the remote device projection whenever an authoritative binding exists."
requirements-completed: [WEB-05, IDEN-04, IDEN-05]
duration: 16 min
completed: 2026-08-05
status: complete
---

# Phase 04 Plan 14: Transactional Device Binding Authority Summary

**Race-safe one-PC Premium binding with non-stranding cooldowns, theft revocation, locked 24-hour exception redemption, evidence revalidation, and atomic audit/outbox evidence**

## Performance

- **Duration:** 16 min
- **Started:** 2026-08-05T02:07:39Z
- **Completed:** 2026-08-05T02:23:26Z
- **Tasks:** 1
- **Files modified:** 9

## Accomplishments

- Serialized 20 concurrent first-bind attempts so exactly one active PC survives and all 19 losers receive typed stale conflicts with the remote authoritative projection.
- Enforced explicit first-bind confirmation, active Premium, 30-day ordinary-transfer cooldown, immediate theft revocation, customer-only replacement confirmation, recent strong authentication, and single-use reviewed exceptions.
- Kept minor device evidence changes bound while substantial changes enter explainable revalidation, without coupling session revocation to Premium device authority.
- Wrote binding/version, exception consumption, immutable audit input, and outbox input inside the same repository transaction and proved command replay is idempotent.

## Task Commits

Each TDD gate was committed atomically:

1. **RED: Device binding authority witnesses** - `266360d` (test)
2. **GREEN: Race-safe device binding authority** - `c216e20` (feat)
3. **REFACTOR: Typed implemented decision tests** - `6467766` (refactor)
4. **Gate integration: Domain package test coverage** - `d204fb8` (chore)

## Files Created/Modified

- `packages/control-plane-domain/src/devices/device-binding.ts` - Pure binding, transfer, theft, cooldown, exception, and revalidation decisions.
- `packages/control-plane-domain/src/devices/device-binding.test.ts` - D-23 through D-28 decision table and rejection coverage.
- `packages/control-plane-application/src/use-cases/bind-device.ts` - Owner-bound serializable transaction orchestration, projections, idempotency, audit, and outbox.
- `packages/control-plane-application/src/use-cases/transfer-device.ts` - Transfer, revocation, exception, and revalidation command composition.
- `apps/api/src/modules/devices/routes.ts` - Current projection, bind, revoke, eligibility, replace/exception, and revalidation HTTP operations.
- `apps/api/src/modules/devices/device-concurrency.test.ts` - Deterministic serializable repository and 20-way race/cooldown/exception evidence.
- `packages/control-plane-domain/src/index.ts` - Public device binding decision exports.
- `packages/control-plane-application/src/index.ts` - Public device authority use-case exports.
- `packages/control-plane-domain/package.json` - Domain test gate now collects all device tests.

## Decisions Made

- Command idempotency is resolved before expected-version comparison so a safe retry returns the original result without duplicate audit or outbox records.
- Entitlement version is the concurrency aggregate; the database partial unique index remains the final defense against more than one active binding.
- A theft revocation may leave no active PC, but replacement remains cooldown-bound unless a reviewed, account-bound, unconsumed 24-hour exception with recent strong auth is redeemed by the customer.
- Ordinary pre-cooldown transfer never revokes the current PC and returns its authoritative eligibility timestamp.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] Replaced live PostgreSQL execution with a deterministic serializable repository**
- **Found during:** Task 04-14-01
- **Issue:** The plan requested real PostgreSQL transactions, while the execution contract explicitly prohibited Docker, Testcontainers, and live PostgreSQL.
- **Fix:** Implemented the same lock/version/partial-unique semantics through a deterministic transaction repository with rollback snapshots and concurrent promise arbitration.
- **Files modified:** `apps/api/src/modules/devices/device-concurrency.test.ts`
- **Verification:** The 20-way race commits one winner, returns 19 typed conflicts, and leaves one audit/outbox pair.
- **Committed in:** `c216e20`

**2. [Rule 2 - Missing Critical] Exported new authorities and included binding tests in the package gate**
- **Found during:** Task 04-14-01 GREEN verification
- **Issue:** Plan-declared implementation files would not be reachable through package public exports, and the existing domain test script named only the earlier evidence test.
- **Fix:** Added narrow public exports and changed the domain package test gate to collect the device test directory.
- **Files modified:** `packages/control-plane-domain/src/index.ts`, `packages/control-plane-application/src/index.ts`, `packages/control-plane-domain/package.json`
- **Verification:** Domain package test passes 9/9 and API TypeScript resolves the public use cases.
- **Committed in:** `c216e20`, `d204fb8`

---

**Total deviations:** 2 auto-fixed (1 blocking, 1 missing critical).
**Impact on plan:** The daemon-free substitute proves the same application transaction contract without weakening race coverage or provisioning infrastructure; public/gate seams are narrowly scoped.

## Issues Encountered

- The literal plan command `pnpm --filter @liiiraa/api test -- --run device-concurrency` forwards an extra argument separator and therefore executes all API unit files. The 04-14 device file passes 4/4, while 11 intentionally RED witnesses owned by future Plans 04-12, 04-16, and 04-17 remain failing. The correctly focused command `pnpm --filter @liiiraa/api exec vitest --run src/modules/devices/device-concurrency.test.ts` passes 4/4.

## Verification

- `pnpm --filter @liiiraa/control-plane-domain test` - PASS (2 files, 9 tests).
- `pnpm --filter @liiiraa/api exec vitest --run src/modules/devices/device-concurrency.test.ts` - PASS (1 file, 4 tests).
- Domain, application, and API TypeScript project checks - PASS.
- Changed-file ESLint and Prettier checks - PASS.
- 20-way race - PASS: 1 applied winner, 19 typed stale conflicts, exactly 1 active binding, 1 audit event, and 1 outbox job.

## TDD Gate Compliance

- **RED:** `266360d` reproduced four pure decision failures and both owner-bound concurrency failures.
- **GREEN:** `c216e20` turned all 04-14 witnesses green without weakening their behavior.
- **REFACTOR:** `6467766` replaced the dynamic RED sentinel with typed public decision imports while preserving all assertions.

## Known Stubs

None.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness

- Device authority is ready for desktop/account composition and later persistent PostgreSQL repository wiring against the existing schema.
- Future owner-bound API RED witnesses remain intentionally pending for Plans 04-12, 04-16, and 04-17; they do not block Plan 04-14.

## Self-Check: PASSED

- All four created implementation files exist.
- RED, GREEN, REFACTOR, and gate-integration commits exist in git history.
- Every 04-14 owner-bound domain and API witness passes.

---
*Phase: 04-identity-commerce-devices-and-administration*
*Completed: 2026-08-05*
