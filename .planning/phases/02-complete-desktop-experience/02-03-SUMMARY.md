---
phase: 02-complete-desktop-experience
plan: "03"
subsystem: desktop-simulator
tags: [typescript, vitest, fixtures, scenarios, provenance, deterministic-state]
requires:
  - phase: 02-31
    provides: Approved deterministic Phase 2 dependency lockfile
  - phase: 01-foundation
    provides: Desktop truth boundary, simulator seam, and fixture provenance policy
provides:
  - Closed application-facing operational and evidence state contracts
  - Deeply frozen deterministic S01-S24 scenario catalog
  - Three recognizable scenario-family baselines with focused typed deltas
  - Fail-closed rejection of unknown scenarios, routes, states, provenance, and undeclared family mutations
affects: [feature-shell, desktop-app, storybook, visual-regression, desktop-e2e]
tech-stack:
  added: []
  patterns:
    - Unknown manifest data is validated before projection into frozen application values
    - Fixture construction remains owned by desktop-simulator and application contracts by desktop-client
    - Scenario worlds derive from a small immutable family set with explicit focused delta paths
key-files:
  created:
    - packages/desktop-client/src/experience.ts
    - packages/desktop-client/src/experience.test.ts
    - packages/desktop-simulator/src/scenarios/catalog.ts
    - packages/desktop-simulator/src/scenarios/catalog.test.ts
    - packages/desktop-simulator/src/scenarios/families.ts
    - packages/desktop-simulator/src/scenarios/deltas.ts
    - contracts/scenarios/desktop-scenarios.json
  modified:
    - packages/desktop-client/src/index.ts
    - packages/desktop-simulator/src/index.ts
key-decisions:
  - "Keep S01-S24 as one ordered, immutable manifest-backed catalog with S01 as the clean-install default."
  - "Model recognizable fixture worlds with three frozen hardware/game/profile family baselines and declare focused per-scenario delta paths."
  - "Treat undeclared family identity changes as invalid manifest input rather than silently accepting unrelated fixture worlds."
patterns-established:
  - "Scenario parser pattern: unknown JSON -> closed literal validation -> family/delta invariant -> deep-frozen DesktopScenario."
  - "Truth boundary pattern: desktop-client exports application state types while desktop-simulator alone exports fixtures and scenario constructors."
requirements-completed: [UX-02, UX-03, UX-04, UX-07, UX-08, UX-09, UX-11, UX-12]
duration: 18min
completed: 2026-07-28
status: complete
---

# Phase 02 Plan 03: Deterministic Desktop Scenario Contract Summary

**A closed experience-state model and deeply frozen S01-S24 catalog now project every later desktop route from recognizable fixture families with explicit provenance and focused deltas.**

## Performance

- **Duration:** 18 min
- **Started:** 2026-07-28T01:01:46Z
- **Completed:** 2026-07-28T01:20:00Z
- **Tasks:** 3
- **Files modified:** 9

## Accomplishments

- Defined exhaustive operational, evidence, entitlement, calibration, activity, route, receipt, and phase-boundary application contracts.
- Authored exactly S01-S24 with stable identity, seed, frozen clock, locale, hardware/game/profile fixture, latency, provenance, required route/state coverage, and explicit no-effect receipt.
- Preserved D-09 through D-12: S01 is the Intel/NVIDIA competitive golden journey, real games remain discovery-only and unqualified, and all scenarios reuse three recognizable fixture families.
- Added deterministic family/delta invariants that reject duplicate, unknown, or undeclared mutations before a catalog can be published.
- Preserved the existing standard and unavailable adapter conformance behavior and the production fixture boundary.

## Task Commits

Each TDD gate was committed atomically:

1. **Task 1 RED: Specify closed experience states and S01-S24 coverage** - `531b05c` (test)
2. **Task 2 GREEN: Implement immutable experience contracts and scenario catalog** - `9c46c57` (feat)
3. **Task 3 REFACTOR: Normalize families and focused deltas** - `21ce1bd` (refactor)

## Files Created/Modified

- `contracts/scenarios/desktop-scenarios.json` - Canonical ordered S01-S24 fixture evidence and route/state manifest.
- `packages/desktop-client/src/experience.ts` - Closed application-facing experience and scenario types.
- `packages/desktop-client/src/experience.test.ts` - Exhaustiveness tests for authored state unions.
- `packages/desktop-client/src/index.ts` - Public application contract exports.
- `packages/desktop-simulator/src/scenarios/catalog.ts` - Fail-closed manifest parser, frozen catalog, and ID lookup.
- `packages/desktop-simulator/src/scenarios/catalog.test.ts` - Scenario coverage, provenance, determinism, family, and mutation tests.
- `packages/desktop-simulator/src/scenarios/families.ts` - Three deeply frozen recognizable fixture-world baselines.
- `packages/desktop-simulator/src/scenarios/deltas.ts` - Ordered typed delta projections and undeclared-mutation guard.
- `packages/desktop-simulator/src/index.ts` - Public simulator-only catalog, family, and delta exports.

## Decisions Made

- Kept the manifest as the stable declarative source while validating every value before it enters the application truth model.
- Limited family baselines to hardware, game, and profile identity so route/state evidence may vary per scenario without inventing an unrelated PC/game/profile world.
- Reused the fictional Vector Strike Arena anchor for S23 and changed only its long display name; a display stress scenario does not receive a fabricated second game identity.
- Added no dependencies, services, credentials, or paid resources.

## Automated Checks

- `pnpm --filter @liiiraa/desktop-client test -- --run` - PASS, 12 tests.
- `pnpm --filter @liiiraa/desktop-simulator test -- --run` - PASS, 12 tests.
- `pnpm --filter @liiiraa/desktop-client check` - PASS.
- `pnpm --filter @liiiraa/desktop-simulator check` - PASS.
- Scenario-focused `family|delta|deterministic` target - PASS, 12 tests collected.
- `pnpm test:adapters` - PASS, 4 conformance tests.
- `pnpm test:architecture` - PASS, 34 tests and both workspace/Cargo adapters executed.
- `pnpm contracts:check` - PASS, 8 generated artifacts drift-free.
- Changed-file ESLint and Prettier gates - PASS.

## TDD Gate Compliance

- RED commit `531b05c` failed because the experience contract and catalog implementation were absent.
- GREEN commit `9c46c57` supplied the minimum complete immutable catalog and passed the scenario contract.
- REFACTOR commit `21ce1bd` retained public scenario IDs and behavior while extracting family baselines, focused deltas, and mutation guards.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Removed an undeclared second game identity from S23**

- **Found during:** Task 3 family/delta verification
- **Issue:** S23 declared only a long `game.displayName` delta but also changed `game.id`, causing an undeclared family mutation.
- **Fix:** Reused the family anchor ID `vector-strike-arena`; only the long PT-BR display name now changes.
- **Files modified:** `contracts/scenarios/desktop-scenarios.json`
- **Verification:** Family/delta tests reject undeclared identity changes and all S01-S24 projections pass.
- **Committed in:** `21ce1bd`

**2. [Rule 1 - Bug] Made candidate delta validation use the candidate being parsed**

- **Found during:** Task 3 mutation-test execution
- **Issue:** The partial guard read canonical delta paths from the imported manifest, so a mutated candidate could bypass duplicate or unknown path validation.
- **Fix:** Validate `scenario.deltaPaths` directly after projection, including non-empty, unique, and known-root checks.
- **Files modified:** `packages/desktop-simulator/src/scenarios/deltas.ts`, `packages/desktop-simulator/src/scenarios/catalog.test.ts`
- **Verification:** Duplicate, unknown, and undeclared mutation tests all fail closed.
- **Committed in:** `21ce1bd`

---

**Total deviations:** 2 auto-fixed (2 Rule 1).
**Impact on plan:** Both corrections enforce the planned focused-delta invariant without broadening architecture, dependencies, or services.

## Issues Encountered

- The global `pnpm check` gate is blocked by six pre-existing lint errors in `tooling/architecture-tests/src/check-workspace.test.ts`, a file not changed by Plan 02-03. The owning package tests and every Plan 02-03-specific lint, type, conformance, architecture, and drift gate pass. The item is recorded in `deferred-items.md`.

## Known Stubs

None.

## User Setup Required

None - no external service, paid product, secret, certificate, or manual configuration is required.

## Next Phase Readiness

- Feature-shell, Storybook, screenshot, and packaged desktop plans can consume one stable S01-S24 truth model.
- Fixture provenance and no-effect receipts are explicit for every scenario.
- No Plan 02-03 blocker remains.

## Self-Check: PASSED

- All seven created contract/catalog files, both modified package roots, and this summary exist on disk.
- RED `531b05c`, GREEN `9c46c57`, and REFACTOR `21ce1bd` exist in Git history.
- Package tests, typechecks, lint, formatting, adapter conformance, architecture tests, and contract drift checks pass.

---

_Phase: 02-complete-desktop-experience_
_Completed: 2026-07-28_
