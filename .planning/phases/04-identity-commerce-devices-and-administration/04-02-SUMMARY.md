---
phase: 04-identity-commerce-devices-and-administration
plan: "02"
subsystem: testing
tags: [postgresql, vitest, testcontainers, architecture, deterministic-testing]

requires:
  - phase: 01-product-truth-and-modular-contracts
    provides: Canonical module-boundary evaluator, workspace discovery, and generated contract layer
  - phase: 04-identity-commerce-devices-and-administration
    provides: Plan 04-01 approved Phase 4 package identities while keeping Better Auth conditional
provides:
  - Four manifest-backed control-plane workspace roots with executable inward-only ownership
  - Fail-closed synthetic PostgreSQL admission and daemon-free/Testcontainers strategy selection
  - Frozen clock, deterministic ID sequence, and serializable transaction test seams
affects: [04-03, 04-04, 04-05, 04-31, 04-32, 04-33]

tech-stack:
  added: []
  patterns:
    - Production composition depends inward through adapter and application packages only
    - PostgreSQL integration tests choose explicit synthetic URLs or isolated CI Testcontainers
    - Unit and PostgreSQL Vitest suites are separated by a cross-platform mode

key-files:
  created:
    - apps/api/package.json
    - apps/api/tsconfig.json
    - apps/api/vitest.config.ts
    - apps/api/src/testing/postgres.ts
    - apps/api/src/testing/determinism.ts
    - apps/api/src/testing/harness.test.ts
    - packages/control-plane-domain/package.json
    - packages/control-plane-application/package.json
    - packages/control-plane-adapters/package.json
  modified:
    - architecture/module-boundaries.json
    - tooling/architecture-tests/src/policy.test.ts

key-decisions:
  - "Keep account/admin preview compositions fixture-only while all new control-plane roots are production-class and protected by the canonical production-to-fixture denial."
  - "Treat ordinary local runs as daemon-free unit mode, CI as an isolated Testcontainers strategy, and external TEST_DATABASE_URL values as admissible only with an explicit synthetic identity."
  - "Do not import or install Phase 4 database packages before the approved dependency plan; Wave 0 exposes typed strategy seams only."

patterns-established:
  - "Synthetic database admission: reject empty, malformed, production-labeled, or unlabeled PostgreSQL identities with a credential-redacted error."
  - "Deterministic sources: clone frozen Date values, consume IDs in order, and fail closed when the sequence is exhausted."

requirements-completed: [WEB-04, WEB-05, WEB-06, WEB-07, IDEN-01, IDEN-02, IDEN-03, IDEN-04, IDEN-05, IDEN-06, IDEN-07, IDEN-08, IDEN-09]

duration: 20 min
completed: 2026-08-04
status: complete
---

# Phase 04 Plan 02: Wave 0 Control-Plane Validation Summary

**Manifest-backed control-plane layers with fail-closed synthetic PostgreSQL admission, deterministic clock/ID sources, and isolated Vitest suite selection**

## Performance

- **Duration:** 20 min
- **Started:** 2026-08-04T19:57:00Z
- **Completed:** 2026-08-04T20:17:18Z
- **Tasks:** 2
- **Files modified:** 11

## Accomplishments

- Activated `@liiiraa/api`, `@liiiraa/control-plane-domain`, `@liiiraa/control-plane-application`, and `@liiiraa/control-plane-adapters` with canonical production ownership and inward-only workspace dependencies.
- Added a PostgreSQL harness that rejects unsafe external database identities without exposing credentials, selects isolated Testcontainers in CI, and keeps ordinary local tests daemon-free.
- Added reusable `FrozenClock`, `SequenceIds`, and serializable transaction seams with a 10-test deterministic meta-suite.
- Extended live architecture discovery evidence so all four new roots participate in undeclared-owner, forbidden-direction, fixture, and cycle mutation gates.

## Task Commits

Each task was committed atomically:

1. **Task 04-02-01: Activate control-plane workspace boundaries** - `920c231` (chore)
2. **Task 04-02-02 RED: Add failing harness contract tests** - `7cc2da1` (test)
3. **Task 04-02-02 GREEN: Implement deterministic database harnesses** - `74f51b2` (feat)
4. **Task 04-02-01 acceptance correction: Register control-plane workspace roots** - `fe516d1` (test)

**Plan metadata:** committed separately after state and roadmap synchronization.

## Files Created/Modified

- `apps/api/package.json` - API root plus unit, PostgreSQL, and migration-test script contracts.
- `apps/api/tsconfig.json` - Strict API test-source TypeScript boundary.
- `apps/api/vitest.config.ts` - Daemon-free unit and PostgreSQL-mode suite separation.
- `apps/api/src/testing/postgres.ts` - Synthetic URL admission, strategy selection, and serializable transaction seam.
- `apps/api/src/testing/determinism.ts` - Frozen clock and finite deterministic ID source.
- `apps/api/src/testing/harness.test.ts` - Unsafe URL, redaction, strategy, transaction, clock, and ID witnesses.
- `packages/control-plane-domain/package.json` - Domain root depending only on generated contracts.
- `packages/control-plane-application/package.json` - Application root depending inward on domain and generated contracts.
- `packages/control-plane-adapters/package.json` - Adapter root depending inward on application, domain, and generated contracts.
- `architecture/module-boundaries.json` - Active domain/application/adapter/API composition records.
- `tooling/architecture-tests/src/policy.test.ts` - Live workspace discovery expectations for the four new roots.

## Decisions Made

- Existing account/admin preview applications remain fixture-class visual/test compositions. New API/control-plane packages are production-class, so the global canonical production-to-fixture restriction prevents them from importing `@liiiraa/web-preview`.
- `TEST_DATABASE_URL` is accepted only when its PostgreSQL identity contains an explicit `synthetic` or `test` marker and no `live`, `prod`, or `production` marker. Rejection errors never echo the supplied URL.
- No new external package was installed and `pnpm-lock.yaml` remains unchanged. The harness advertises the approved future Testcontainers strategy without importing it before Plan 04-04.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Made the transaction test double's generic type explicit**
- **Found during:** Task 04-02-02 GREEN strict TypeScript verification
- **Issue:** Runtime tests passed, but strict TypeScript inferred the transaction callback value as `unknown`.
- **Fix:** Bound the deterministic transaction marker and result types explicitly in the harness meta-test.
- **Files modified:** `apps/api/src/testing/harness.test.ts`
- **Verification:** `tsc -p apps/api/tsconfig.json --noEmit` passes.
- **Committed in:** `74f51b2`

**2. [Rule 3 - Blocking] Updated stale live workspace discovery expectations**
- **Found during:** Plan-level `pnpm test:architecture`
- **Issue:** The live discovery test hard-coded the pre-Phase-4 workspace list and rejected the four correctly discovered roots.
- **Fix:** Added the API, domain, application, and adapter roots to the expected live workspace set.
- **Files modified:** `tooling/architecture-tests/src/policy.test.ts`
- **Verification:** Architecture suite passes 46/46, including reverse-layer, production-to-fixture, undeclared-owner, and cycle mutations.
- **Committed in:** `fe516d1`

---

**Total deviations:** 2 auto-fixed (1 bug, 1 blocking issue).
**Impact on plan:** Both fixes were necessary to make strict typing and the declared live-discovery acceptance gate executable; no production authority or dependency scope was added.

## Issues Encountered

- An overlapping retry briefly raced the architecture suite's temporary mutation directory and returned `ENOENT`. The retry was stopped, cleanup was allowed to finish, and a single isolated exact run subsequently passed all 46 tests.
- `pnpm exec` refreshed workspace importer metadata during verification. The lockfile was restored after each run as required; no lockfile change is present in the final worktree.

## Verification

- `rtk pnpm test:architecture` - PASS (46/46 tests; workspace and Cargo adapters each executed once).
- `rtk pnpm exec vitest --run apps/api/src/testing` - PASS (10/10 tests; 1.8-second final run, below the 30-second focused target).
- `rtk proxy .\node_modules\.bin\tsc.CMD -p apps/api/tsconfig.json --noEmit` - PASS.
- Stub scan - PASS; no TODO, FIXME, placeholder, empty UI data source, or unfinished authority was introduced.
- Threat-surface scan - PASS; PostgreSQL URL admission and fixture isolation are both covered by the plan threat model, with no new endpoint, auth path, file access, or schema boundary.

## Authentication Gates

None.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness

- Plans 04-03 through 04-05 can build contracts, migrations, and the terminating identity spike on executable package boundaries.
- Plans 04-31 through 04-33 can reuse the deterministic sources and select real PostgreSQL semantics without requiring Docker Desktop for ordinary local tests.
- Better Auth and database/provider dependencies remain intentionally uninstalled until their approved security and supply-chain gates.

## Self-Check: PASSED

- All 11 created/modified implementation files exist.
- Task commits `920c231`, `7cc2da1`, `74f51b2`, and `fe516d1` exist in git history.
- All task acceptance criteria and plan-level verification commands pass.
- No tracked file deletions or unintended untracked artifacts remain.

---
*Phase: 04-identity-commerce-devices-and-administration*
*Completed: 2026-08-04*
