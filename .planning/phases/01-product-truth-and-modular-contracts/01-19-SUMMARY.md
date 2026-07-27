---
phase: 01-product-truth-and-modular-contracts
plan: "19"
subsystem: desktop-adapters
tags:
  - typescript
  - conformance
  - simulator
  - production-safety
  - tdd
requires:
  - phase: 01-product-truth-and-modular-contracts
    plan: "08"
    provides: Framework-neutral validated desktop inspection client and reusable eleven-case conformance suite
provides:
  - Deterministic synthetic desktop inspection scenarios with explicit fixture provenance
  - Production-safe unavailable-only reference adapter with no simulator dependency or hardware claims
  - One root adapter runner that executes identical conformance cases by identity or together
affects:
  - 01-10-final-acceptance
  - 02-desktop-visual-foundation
tech-stack:
  added: []
  patterns:
    - Adapter-local registration against one framework-neutral conformance factory
    - Production-unavailable truth represented as immutable value-free evidence
key-files:
  created:
    - packages/desktop-simulator/src/scenarios.ts
    - packages/desktop-simulator/src/index.ts
    - packages/desktop-production-reference/src/unavailable-client.ts
    - packages/desktop-production-reference/src/index.ts
    - tooling/adapter-conformance/run.mjs
  modified:
    - packages/desktop-client/src/conformance.test.ts
    - architecture/module-boundaries.json
    - package.json
    - pnpm-lock.yaml
key-decisions:
  - "Register each adapter in its own package test and select identities through one root runner, preserving the production-to-fixture prohibition."
  - "Keep the production reference unavailable-only until a real native transport exists; it performs no hardware operation and makes no observation claim."
requirements-completed:
  - FOUND-02
  - FOUND-03
duration: 8 min
completed: 2026-07-27
status: complete
---

# Phase 01 Plan 19: Desktop Adapter Substitutability Summary

**A deterministic synthetic simulator and a fail-closed production reference now satisfy the same eleven lifecycle, validation, provenance, immutability, and determinism cases without allowing fixture code into the production dependency graph.**

## Performance

- **Duration:** 8 min
- **Started:** 2026-07-27T02:54:00-03:00
- **Completed:** 2026-07-27T03:02:00-03:00
- **Tasks:** 2
- **Files modified:** 15

## Accomplishments

- Added frozen standard and unavailable simulator scenarios whose synthetic fixture values carry stable scenario and fixture-version identity.
- Added an immutable production adapter that returns typed unavailable provenance for every hardware field and never imports fixture or simulator code.
- Registered both adapters against the same eleven-case conformance factory, with exact case-count parity and deterministic injected clock/identifier checks.
- Added the production reference to the canonical module constitution so live architecture verification proves the absence of a production-to-fixture edge.

## Task Commits

Each task followed RED/GREEN TDD:

1. **Task 01-19-01: Implement deterministic simulator scenarios**
   - `5227b57` (`test`) — failing simulator registration and scenario-identity contract
   - `8145645` (`feat`) — deterministic validated simulator transport and frozen scenarios
2. **Task 01-19-02: Implement honest production-unavailable behavior**
   - `647f198` (`test`) — failing production-unavailable parity and truth contract
   - `411bc20` (`feat`) — unavailable-only production client and canonical architecture ownership

## Files Created/Modified

- `packages/desktop-simulator/` — package-local TypeScript project, adapter conformance registration, frozen scenarios, and validated transport.
- `packages/desktop-production-reference/` — package-local TypeScript project, adapter conformance registration, and unavailable-only production client.
- `packages/desktop-client/src/conformance.test.ts` — derives canonical parity size from the published group counts instead of duplicating a literal.
- `tooling/adapter-conformance/run.mjs` — validates `--identity simulator|production` and runs one or both adapter registrations.
- `architecture/module-boundaries.json` — declares the production reference as a production adapter so fixture-edge enforcement covers it.
- `package.json` and `pnpm-lock.yaml` — expose the terminating `test:adapters` command and register both workspace packages.

## Decisions Made

- Adapter conformance tests remain package-local. Importing the simulator into the production `desktop-client` test would create the exact production-to-fixture edge the architecture must prohibit.
- The production reference implements the narrow client contract directly and returns only unavailable values. Native inventory calls remain absent until their owning phase supplies a validated transport.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] Added adapter-local test projects and the root identity runner**

- **Found during:** Task 01-19-01 RED
- **Issue:** The plan required `pnpm test:adapters -- --identity simulator`, but no terminating script existed, and importing fixture code into the listed production test file would violate the canonical runtime boundary.
- **Fix:** Added package-local conformance registrations, strict package `tsconfig.json` files, and a small validated root runner.
- **Files modified:** `package.json`, `pnpm-lock.yaml`, both adapter package/test configurations, `tooling/adapter-conformance/run.mjs`
- **Verification:** Identity-filtered and combined adapter commands pass.

**2. [Rule 2 - Missing Critical Functionality] Registered the production reference in the canonical architecture**

- **Found during:** Task 01-19-02 GREEN
- **Issue:** A production package outside the module constitution would not participate in the production-to-fixture security gate.
- **Fix:** Added an explicit production adapter module record with its sole public root.
- **Files modified:** `architecture/module-boundaries.json`
- **Verification:** Both live architecture adapters and all 23 policy tests pass.

---

**Total deviations:** 2 auto-fixed (1 blocking issue, 1 missing critical security check)
**Impact on plan:** Both additions make the specified command and no-fixture guarantee executable without widening the desktop inspection contract.

## TDD Gate Compliance

- **Task 01-19-01 RED:** `5227b57` failed because the simulator package exported no adapter implementation.
- **Task 01-19-01 GREEN:** `8145645` passed simulator conformance and strict typecheck.
- **Task 01-19-02 RED:** `647f198` failed because the production reference exported no unavailable client.
- **Task 01-19-02 GREEN:** `411bc20` passed production and combined adapter conformance plus architecture verification.
- **REFACTOR:** Not required; the smallest implementations passed strict checks and full verification.

## Verification

- `pnpm test:adapters -- --identity simulator` — passed, 2/2 registration and scenario tests; all 11 shared cases passed internally.
- `pnpm test:adapters -- --identity production` — passed, 2/2 parity and unavailable-truth tests; all 11 shared cases passed internally.
- `pnpm test:adapters` — passed both registrations, 4/4 tests.
- `pnpm test:architecture` — passed both live graph adapters and 23/23 policy tests.
- `pnpm verify` — passed toolchain, architecture, contract drift/compatibility, generation, lint, typecheck, workspace tests, and builds.

## Issues Encountered

None.

## Known Stubs

None. The production adapter's unavailable-only behavior is the intentional fail-closed reference contract, not simulated production data.

## User Setup Required

None.

## Next Phase Readiness

- Plan 01-10 can promote the owned FOUND-02 evidence when final acceptance is assembled.
- Phase 2 can consume the simulator behind the desktop inspection port while production remains honest and unavailable.

## Self-Check: PASSED

- Both adapter package roots and public entrypoints exist.
- Simulator values are frozen, synthetic, scenario-identified, and deterministic under injected dependencies.
- Production source contains no simulator/fixture import and returns only typed unavailable truth.
- RED/GREEN commits exist in order for both TDD tasks.
- Adapter, architecture, and full root verification pass.

---

_Phase: 01-product-truth-and-modular-contracts_
_Completed: 2026-07-27_
