---
phase: 01-product-truth-and-modular-contracts
plan: "09"
subsystem: production-truth
tags:
  - fixture-refusal
  - production-composition
  - typescript
  - dependency-graph
  - runtime-validation
requires:
  - phase: 01-product-truth-and-modular-contracts
    plan: "12"
    provides: Canonical live workspace graph policy
  - phase: 01-product-truth-and-modular-contracts
    plan: "18"
    provides: Runtime-validated diagnostic provenance
  - phase: 01-product-truth-and-modular-contracts
    plan: "19"
    provides: Simulator and fail-closed production adapters
provides:
  - Fixture-free production diagnostic and inspection output types
  - Public production composition containing only the fail-closed unavailable client
  - Independent canonical-graph and recursive runtime fixture guards
  - Negative type, graph, identity, mode, schema, and nested-provenance fixtures
affects:
  - 01-20-production-artifact-and-process-truth
  - 02-desktop-visual-foundation
tech-stack:
  added: []
  patterns:
    - Explicitly enumerate allowed production provenance variants
    - Validate the live dependency graph through the canonical architecture gate
    - Recursively reject nested fixture provenance before presentation
key-files:
  created:
    - packages/desktop-production-reference/src/composition.ts
    - tooling/fixture-guard/package.json
    - tooling/fixture-guard/tsconfig.json
    - tooling/fixture-guard/src/static-guard.ts
    - tooling/fixture-guard/src/runtime-guard.ts
    - tooling/fixture-guard/src/fixture-guard.test.ts
    - tooling/fixture-guard/fixtures/production-fixture-type.ts
    - tooling/fixture-guard/fixtures/static-runtime-leaks.json
  modified:
    - packages/desktop-production-reference/package.json
    - packages/desktop-production-reference/src/index.ts
    - packages/desktop-production-reference/src/unavailable-client.ts
    - architecture/module-boundaries.json
    - pnpm-lock.yaml
key-decisions:
  - "Enumerate observed, measured, modeled, and unavailable production values explicitly so fixture provenance is structurally unassignable."
  - "Expose one production composition whose only client is the honest unavailable reference until a native transport exists."
  - "Reuse the canonical graph evaluator and terminating live architecture command instead of creating a second dependency policy."
  - "Reject runtime identity, mode, schema, and nested fixture markers independently before truth reaches presentation."
requirements-completed:
  - FOUND-03
  - FOUND-04
  - FOUND-05
duration: 10 min
completed: 2026-07-27
status: complete
---

# Phase 01 Plan 09: Production Fixture Refusal Summary

**Production composition now exposes only fail-closed unavailable truth through a fixture-free type boundary, with independent live-graph and recursive runtime refusal.**

## Performance

- **Duration:** 10 min
- **Started:** 2026-07-27T06:08:00Z
- **Completed:** 2026-07-27T06:17:46Z
- **Tasks:** 2
- **Files:** 13

## Accomplishments

- Defined `ProductionDiagnosticValue` as an explicit union of the four allowed non-fixture provenance variants and propagated it through production inspection and client types.
- Added the public `createProductionDesktopComposition` entry, backed only by the existing unavailable production client, and pinned package/build resolution to `packages/desktop-production-reference/src/index.ts`.
- Added a negative TypeScript fixture whose `@ts-expect-error` becomes an executable failure if fixture provenance ever becomes assignable.
- Added two canonical graph leak cases and four independent runtime leak cases, all with exact non-zero corpus counts.
- Validated the actual workspace dependency graph and recursively rejected simulator identity, non-production mode, unsupported schema, and nested fixture provenance.

## Task Commits

1. **Task 01-09-01 RED: Prove production type boundary rejects fixtures** — `34e8316`
2. **Task 01-09-01 GREEN: Seal production inspection type boundary** — `7ccd4c9`
3. **Task 01-09-02 RED: Seed static and runtime fixture leaks** — `3bf3322`
4. **Task 01-09-02 GREEN: Enforce static and runtime fixture refusal** — `767e32d`

## Files Created/Modified

- `packages/desktop-production-reference/src/composition.ts` — Production-only value, inspection, client, identity, and composition types.
- `packages/desktop-production-reference/src/index.ts` — Sole public composition and production client entry.
- `packages/desktop-production-reference/src/unavailable-client.ts` — Fail-closed client narrowed to production-only output.
- `packages/desktop-production-reference/package.json` — Public package and type entry pinned to `packages/desktop-production-reference/src/index.ts`.
- `tooling/fixture-guard/src/static-guard.ts` — Canonical seeded-graph evaluation and live workspace architecture proof.
- `tooling/fixture-guard/src/runtime-guard.ts` — Recursive pre-presentation production boundary refusal.
- `tooling/fixture-guard/src/fixture-guard.test.ts` — Type, static, runtime, and clean-production proofs.
- `tooling/fixture-guard/fixtures/production-fixture-type.ts` — Negative compiler fixture.
- `tooling/fixture-guard/fixtures/static-runtime-leaks.json` — Consolidated two-case static and four-case runtime leak matrix.
- `architecture/module-boundaries.json` — Canonical ownership for the fixture-guard tooling module.

## Decisions Made

- Production truth types enumerate allowed provenance kinds rather than subtracting fixture only at an adapter-kind flag.
- Production composition carries an immutable `production` mode and exact unavailable adapter identity for independent runtime checking.
- Static seeded proofs call the same canonical evaluator as the live repository gate; the live proof executes the terminating architecture command from the repository root.
- Runtime traversal reports stable structural paths and stops descending once an object itself proves fixture provenance.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] Scaffolded the planned fixture-guard workspace package**

- **Found during:** Task 01-09-01 RED
- **Issue:** The plan referenced `@liiiraa/fixture-guard`, but the package and TypeScript project did not yet exist, so the mandated filtered test command could not run.
- **Fix:** Added the package manifest, strict TypeScript configuration, workspace links, and lockfile importer using only already-approved dependencies.
- **Files modified:** `tooling/fixture-guard/package.json`, `tooling/fixture-guard/tsconfig.json`, `pnpm-lock.yaml`
- **Verification:** The exact filtered commands and full root verification terminate green.
- **Committed in:** `34e8316`

**2. [Rule 3 - Blocking] Registered fixture-guard ownership in the canonical module constitution**

- **Found during:** Task 01-09-02 live graph verification
- **Issue:** A new workspace package without canonical ownership would make the real architecture graph fail as an unknown module.
- **Fix:** Added the active tooling module with explicit public guard roots.
- **Files modified:** `architecture/module-boundaries.json`
- **Verification:** `pnpm test:architecture` reports `workspace=1, cargo=1` and 23/23 policy tests pass.
- **Committed in:** `767e32d`

---

**Total deviations:** 2 auto-fixed blocking issues

**Impact on plan:** Both additions were required to make the planned guard executable and governed by the existing workspace rules. No new external dependency or architecture layer was introduced.

## TDD Gate Compliance

- **Task 01-09-01 RED:** `34e8316` failed with missing production composition/type exports, an unused negative diagnostic directive, and absent package entry metadata.
- **Task 01-09-01 GREEN:** `7ccd4c9` made both type-boundary proofs pass while preserving production adapter conformance.
- **Task 01-09-02 RED:** `3bf3322` failed both seeded groups because the placeholder guards accepted leaks.
- **Task 01-09-02 GREEN:** `767e32d` passed exactly 2 static and 4 runtime negative cases plus clean live-graph and unavailable-truth cases.
- **REFACTOR:** No separate refactor commit was needed; strict lint and Prettier cleanup completed before each GREEN commit.

## Verification

- `rtk pnpm --filter @liiiraa/fixture-guard test -- --run -t "type-boundary"` — passed; negative compiler fixture and public entry proof execute.
- `rtk pnpm --filter @liiiraa/fixture-guard test -- --run -t "static|runtime"` — passed; fixture matrix asserts exactly 2 static and 4 runtime negative cases.
- `rtk pnpm test:architecture` — passed; live adapters report `workspace=1, cargo=1`, 23/23 tests pass.
- `rtk pnpm lint` — passed with zero warnings.
- `rtk pnpm verify` — passed toolchain, architecture, contract drift/compatibility, generation, strict checks, all workspace tests, and all builds.

## Issues Encountered

None.

## Known Stubs

None. The unavailable-only production client is an intentional closed-by-default reference boundary until a native transport exists.

## User Setup Required

None.

## Next Phase Readiness

- Plan 01-20 can scan and launch the exported production artifact using the public composition and runtime guard.
- Phase 2 can consume deterministic simulator truth only through fixture-owned wiring while production remains structurally and recursively fixture-free.

## Execution Mode

Generic-agent workaround used because typed `gsd-executor` dispatch was unavailable in this Codex session.

## Self-Check: PASSED

- All eight created artifacts and five modified artifacts exist.
- RED/GREEN commits exist in order for both TDD tasks.
- The exact task commands, canonical architecture gate, and full root verification pass.
- Working tree was clean before planning metadata close-out.

---

_Phase: 01-product-truth-and-modular-contracts_
_Completed: 2026-07-27_
