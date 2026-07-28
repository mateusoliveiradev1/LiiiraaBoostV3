---
phase: 02-complete-desktop-experience
plan: "06"
subsystem: desktop-workflows
tags: [xstate, calibration, consent, persistence, revalidation, limited-mode]

requires:
  - phase: 02-03
    provides: Immutable S01-S24 desktop scenario truth
  - phase: 02-04
    provides: Deterministic browser and component verification harness
  - phase: 02-19
    provides: Unified planned Wave 0 evidence gate
provides:
  - Guarded resumable XState calibration workflow for D-01 through D-08
  - Immutable calibration model with seven steps and independent connected consents
  - Versioned product-owned snapshot validation and fail-closed migration
  - Progressive Home, dependency return-intent, limited-mode, and partial-revalidation selectors
affects: [desktop-home, calibration-ui, feature-shell, scenario-composition, phase-02-evidence]

tech-stack:
  added: []
  patterns:
    - XState actors remain internal while product-owned versioned snapshots cross persistence boundaries
    - Runtime event validation occurs before workflow authority changes
    - Required evidence gates global recommendations while optional evidence gates only dependent actions

key-files:
  created:
    - packages/feature-shell/src/index.ts
    - packages/feature-shell/src/model/calibration.ts
    - packages/feature-shell/src/machines/calibration.machine.ts
    - packages/feature-shell/src/machines/calibration.machine.test.ts
  modified:
    - packages/feature-shell/tsconfig.json

key-decisions:
  - "Persist only the versioned calibration product model, never XState actor internals or raw diagnostic values."
  - "Validate runtime events and restored snapshots structurally and semantically before they can change workflow authority."
  - "Permit recommendations after trust and inventory succeed; optional steps remain resumable and block only their dependent action."

patterns-established:
  - "Calibration persistence: exact-key snapshot validation, stable message IDs, and limited startup on any corrupt or unknown version."
  - "Progressive Home: trusted and incomplete regions are derived from immutable evidence rather than duplicated UI booleans."

requirements-completed: [UX-02, UX-03, UX-07, UX-10, UX-11]

duration: 13min
completed: 2026-07-28
status: complete
---

# Phase 02 Plan 06: Deterministic Calibration Safety Workflow Summary

**A guarded XState workflow now makes calibration resumable and progressive while failing corrupt persistence, mandatory evidence loss, and permission denial into a recommendation-free limited mode.**

## Performance

- **Duration:** 13 min
- **Started:** 2026-07-28T05:13:51.848Z
- **Completed:** 2026-07-28T05:26:40.480Z
- **Tasks:** 3
- **Files modified:** 5

## Accomplishments

- Defined all seven calibration steps, required-versus-optional evidence, stable message IDs, independent off-by-default connected consents, return intents, and limited reasons.
- Implemented explicit XState states for new, running, offline/local, deferred, partial, cancelled, resumed, Home, dependency-blocked, limited, completed, and revalidation behavior.
- Preserved unaffected evidence during hardware or stale-evidence revalidation and reopened only the affected steps.
- Added exact-key runtime validation for events and snapshots, including deterministic limited startup for corrupt or unknown snapshot versions.
- Proved all 25 behavior, migration, cancellation, consent, revalidation, and property-style invariant tests.

## Task Commits

Each TDD gate was committed atomically:

1. **Task 1 RED: Define calibration guards, consent, deferral, and resume behavior** - `3f468be` (test)
2. **Task 2 GREEN: Implement the calibration state machine** - `4babb0a` (feat)
3. **Task 3 REFACTOR: Prove persisted-state migration and invariants** - `31d977d` (refactor)

## Files Created/Modified

- `packages/feature-shell/src/model/calibration.ts` - Immutable steps, evidence, consent, events, snapshot, return-intent, limited-mode, and Home selector contracts.
- `packages/feature-shell/src/machines/calibration.machine.ts` - XState workflow, runtime guards, selectors, serialization, and fail-closed migration.
- `packages/feature-shell/src/machines/calibration.machine.test.ts` - D-01 through D-08 transition tables, reachable-state round trips, corrupt-state cases, and deterministic sequence invariants.
- `packages/feature-shell/src/index.ts` - Public feature-shell exports for calibration consumers.
- `packages/feature-shell/tsconfig.json` - Package-local library declaration isolation while application sources remain strictly checked.

## Decisions Made

- XState is orchestration infrastructure, not the persistence contract. Only the small versioned calibration snapshot is serialized.
- Trust/privacy and system inventory are the only global Home/recommendation gate. Deferred optional steps remain visible without nagging and become dominant only for a current dependency.
- Telemetry, cloud AI, and diagnostic sharing are separate booleans initialized to false; no connected consent is inferred.
- Every diagnostic and action label is represented by a stable message ID rather than concatenated PT-BR or English copy.

## TDD Gate Compliance

- **RED:** `3f468be` ran 18 tests; 17 failed specifically with `CALIBRATION_MACHINE_NOT_IMPLEMENTED`, while the ordered seven-step contract passed.
- **GREEN:** `4babb0a` made all 18 behavior tests pass with the explicit XState workflow and immutable runtime boundary.
- **REFACTOR:** `31d977d` retained behavior while extracting pure selector branches, round-tripping every reachable persisted state, and expanding to 25 passing tests with deterministic event-sequence invariants.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] Added the declared feature-shell public entry point**

- **Found during:** Task 2 public API verification
- **Issue:** `packages/feature-shell/package.json` exported `src/index.ts`, but the file did not exist, so future route and Home consumers had no valid public boundary.
- **Fix:** Added `src/index.ts` with explicit model and machine value/type exports.
- **Files modified:** `packages/feature-shell/src/index.ts`
- **Verification:** Feature-shell typecheck, ESLint, package tests, and architecture gates pass.
- **Committed in:** `4babb0a`

**2. [Rule 3 - Blocking] Isolated an upstream XState declaration incompatibility**

- **Found during:** Task 2 typecheck
- **Issue:** XState 5.32.5 declarations fail under the repository's TypeScript 6.0.3 `exactOptionalPropertyTypes` setting inside `setup.d.ts`, even though application code and runtime tests are valid.
- **Fix:** Enabled package-local `skipLibCheck` for feature-shell, matching the existing design-system boundary while retaining strict checking for every authored source file.
- **Files modified:** `packages/feature-shell/tsconfig.json`
- **Verification:** Feature-shell typecheck and all authored-source ESLint rules pass; 25 runtime tests and both architecture adapters pass.
- **Committed in:** `4babb0a`

---

**Total deviations:** 2 auto-fixed (2 Rule 3).
**Impact on plan:** Both fixes were required to expose and typecheck the planned workflow; neither adds a dependency, paid resource, service, or new architecture.

## Issues Encountered

None.

## Known Stubs

None. The RED-only `CALIBRATION_MACHINE_NOT_IMPLEMENTED` sentinel was fully removed by the GREEN commit.

## Authentication Gates

None.

## User Setup Required

None - all work is local and free; no service, credential, certificate, secret, or paid product is required.

## Verification

- `pnpm --filter @liiiraa/feature-shell test -- --run -t "UX-02|calibration"` - PASS, 25 tests.
- `pnpm --filter @liiiraa/feature-shell test -- --run -t "snapshot|invariant|revalidation"` - PASS, 25 collected tests with the focused cases passing.
- `pnpm --filter @liiiraa/feature-shell test` - PASS, 25 tests.
- `pnpm --filter @liiiraa/feature-shell check` - PASS.
- Focused type-aware ESLint and Prettier gates - PASS.
- `pnpm test:architecture` - PASS, 34 tests and both workspace/Cargo adapters.
- `pnpm contracts:check` - PASS, 8 generated artifacts drift-free.

## Next Phase Readiness

- Home and calibration UI plans can consume one stable workflow instead of duplicating boolean state.
- Scenario composition can restore safe snapshots for S01, S06, S14, and S22 without exposing actor internals.
- No Plan 02-06 blocker remains.

## Self-Check: PASSED

- All four created files, the modified package configuration, and this summary exist on disk.
- RED `3f468be`, GREEN `4babb0a`, and REFACTOR `31d977d` exist in Git history in the required order.
- Focused tests, full package tests, typecheck, lint, formatting, architecture, and contract drift gates all pass.
- No generated or unrelated untracked file remains.

---

_Phase: 02-complete-desktop-experience_
_Completed: 2026-07-28_
