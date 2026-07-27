---
phase: 01-product-truth-and-modular-contracts
plan: "08"
subsystem: desktop-application
tags: [typescript, contracts, runtime-validation, conformance, tdd]
requires:
  - phase: 01-product-truth-and-modular-contracts
    provides: Public schema-pinned TypeScript runtime validator from Plan 01-18
provides:
  - Framework-neutral validated desktop inspection client port
  - Immutable native truth values with explicit provenance
  - Reusable eleven-case adapter conformance suite
affects: [01-19-desktop-contract-adapter, 02-desktop-visual-foundation]
tech-stack:
  added: []
  patterns:
    - Public contract validation before native application mapping
    - Framework-neutral conformance cases with injected clocks and request identifiers
key-files:
  created:
    - packages/desktop-client/src/client.ts
    - packages/desktop-client/src/truth.ts
    - packages/desktop-client/src/errors.ts
    - packages/desktop-client/src/conformance.ts
    - packages/desktop-client/src/conformance.test.ts
  modified:
    - packages/desktop-client/src/index.ts
    - packages/desktop-client/package.json
    - pnpm-lock.yaml
key-decisions:
  - "Map generated transport provenance into nested frozen native values so transport DTOs never become application entities."
  - "Keep conformance framework-neutral by returning structured case reports instead of importing a test runner."
  - "Model standard and unavailable conformance scenarios separately so a fully available future adapter is not forced to fabricate unavailability."
patterns-established:
  - "Boundary order: reject metadata, validate unknown diagnostic payloads through @liiiraa/contracts-ts, then map and deep-freeze."
  - "Adapter proof: fixed group counts cover metadata, lifecycle, truth, and determinism with value-free failures."
requirements-completed:
  - FOUND-02
  - FOUND-03
duration: 14 min
completed: 2026-07-27
status: complete
---

# Phase 01 Plan 08: Validated Desktop Client and Conformance Summary

**A narrow inspection-only client now validates unknown canonical transports before producing deeply immutable native truth, with an eleven-case reusable suite that rejects unsafe adapter behavior.**

## Performance

- **Duration:** 14 min
- **Started:** 2026-07-27T05:35:23.000Z
- **Completed:** 2026-07-27T05:49:00.000Z
- **Tasks:** 2
- **Files modified:** 10

## Accomplishments

- Added the `@liiiraa/desktop-client` package with an operation-specific inspection port, immutable identity/capabilities, cancellation, strict input handling, and typed value-free errors.
- Validated every unknown diagnostic through the public `@liiiraa/contracts-ts` validator before mapping transport DTOs into distinct frozen native truth values.
- Exported a deterministic eleven-case conformance factory that catches raw throws, wrong versions, mutable results, missing provenance, capability lies, invalid input, cancellation defects, unavailable-state omissions, and nondeterminism.

## Task Commits

Each task was committed atomically with the required TDD sequence:

1. **Task 01-08-01: Define validated native truth and client types**
   - `e195f05` — RED: define validated desktop client behavior
   - `a892e9a` — GREEN: add validated desktop inspection port
2. **Task 01-08-02: Prove the reusable conformance factory**
   - `f1039d0` — RED: define desktop adapter conformance failures
   - `fde4ba7` — GREEN: export reusable adapter conformance suite
   - `095f743` — REFACTOR: separate unavailable conformance scenario

## Files Created/Modified

- `packages/desktop-client/package.json` — Package public surface, scripts, and canonical contracts dependency.
- `packages/desktop-client/tsconfig.json` — Strict package typecheck and DOM cancellation types.
- `packages/desktop-client/src/client.ts` — Unknown transport boundary, validation order, narrow port, cancellation, and mapping orchestration.
- `packages/desktop-client/src/truth.ts` — Distinct deeply immutable native diagnostic provenance values.
- `packages/desktop-client/src/errors.ts` — Typed result and bounded structured error vocabulary.
- `packages/desktop-client/src/conformance.ts` — Framework-neutral conformance factory and fixed case groups.
- `packages/desktop-client/src/client.test.ts` — Boundary validation and native mapping evidence.
- `packages/desktop-client/src/conformance.test.ts` — Positive suite proof and six deliberately defective adapters.
- `packages/desktop-client/src/index.ts` — Public client, truth, error, and conformance exports.
- `pnpm-lock.yaml` — Workspace importer for the desktop client package.

## Decisions Made

- Generated contract values remain transport-only; application truth uses an explicit nested provenance model that cannot accidentally retain an envelope or mutable transport object.
- Adapter exceptions are converted into a value-free `TRANSPORT_FAILURE`; raw messages and payload values never cross the client boundary.
- The reusable suite exposes cases and aggregate reports without a Vitest dependency, allowing later simulator and production-reference packages to register the same cases in any runner.
- Standard and unavailable scenarios are distinct conformance inputs, preserving unavailable-state evidence without requiring every future successful machine inspection to contain an unavailable value.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] Added a strict package TypeScript project**

- **Found during:** Task 01-08-01 RED
- **Issue:** The new workspace package needed an owning `tsconfig.json` before its strict check could execute.
- **Fix:** Added a package-local project extending the canonical root configuration with DOM cancellation types and Vitest declarations.
- **Files modified:** `packages/desktop-client/tsconfig.json`
- **Verification:** Package typecheck, lint, tests, architecture policy, and root verification pass.
- **Committed in:** `e195f05`

**2. [Rule 2 - Missing Critical Functionality] Added direct boundary behavior evidence**

- **Found during:** Task 01-08-01 RED
- **Issue:** The TDD task listed production files but no dedicated test file, leaving validation-before-mapping and error redaction unprovable.
- **Fix:** Added `client.test.ts` covering invalid provenance, deep immutability, metadata, cancellation, and raw error redaction.
- **Files modified:** `packages/desktop-client/src/client.test.ts`
- **Verification:** Four boundary tests pass and fail against the pre-implementation package root.
- **Committed in:** `e195f05`, `a892e9a`

---

**Total deviations:** 2 auto-fixed (1 blocking issue, 1 missing critical test surface).
**Impact:** Both additions are package-local execution evidence required by the plan's strict TDD and verification contract; no external dependency or architecture surface was introduced.

## Issues Encountered

None.

## TDD Gate Compliance

- **Task 01-08-01 RED:** `e195f05` failed because the desktop client package root did not exist.
- **Task 01-08-01 GREEN:** `a892e9a` passed four validation, native truth, cancellation, and error-redaction tests.
- **Task 01-08-02 RED:** `f1039d0` failed all seven conformance-factory tests because the public factory did not exist.
- **Task 01-08-02 GREEN:** `fde4ba7` passed the conforming fake and rejected six defective fake clients.
- **Task 01-08-02 REFACTOR:** `095f743` separated standard and unavailable scenarios while all checks remained green.

## Verification

- `rtk pnpm --filter @liiiraa/desktop-client check` — passed.
- `rtk pnpm --filter @liiiraa/desktop-client test -- --run` — passed, 11 tests.
- `rtk pnpm test:architecture` — passed, 23 tests and both workspace/Cargo adapters.
- `rtk pnpm verify` — passed all toolchain, architecture, contract drift/compatibility, generation, lint, typecheck, test, and build gates.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness

- Plan 01-19 can implement deterministic simulator and production-safe unavailable adapters against the same exported scenario-aware suite.
- No blockers remain for adapter substitution work.

## Self-Check: PASSED

- All ten package/lock files exist.
- Five TDD task commits are present in order.
- Package, architecture, and root verification commands pass from a clean checkout.
- The client imports runtime validation only from the public `@liiiraa/contracts-ts` entrypoint.

---

_Phase: 01-product-truth-and-modular-contracts_
_Completed: 2026-07-27_
