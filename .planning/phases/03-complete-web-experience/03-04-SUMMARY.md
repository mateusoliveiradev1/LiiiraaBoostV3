---
phase: 03-complete-web-experience
plan: "04"
subsystem: web-packages
tags: [typescript, esm, package-boundaries, fixtures, web-core]
requires:
  - phase: 01-product-truth-and-modular-contracts
    provides: Generated TypeScript contract package and enforced module boundaries
  - phase: 03-complete-web-experience
    provides: Reserved web-core and web-preview ownership roots from Plans 03-02 and 03-03
provides:
  - Private strict ESM @liiiraa/web-core package with a stable public contract root
  - Separately enforceable @liiiraa/web-preview fixture adapter package
  - Literal production contract version and preview runtime identity markers
affects: [03-05, 03-06, 03-07, 03-08, 03-09, 03-10, 03-11, web-features, apps-web, apps-account, apps-admin]
tech-stack:
  added: []
  patterns:
    - Production web contracts and deterministic preview adapters live in sibling packages
    - Package tests use terminating Vitest run mode
key-files:
  created:
    - packages/web-core/package.json
    - packages/web-core/tsconfig.json
    - packages/web-core/src/index.ts
    - packages/web-preview/package.json
    - packages/web-preview/tsconfig.json
    - packages/web-preview/src/index.ts
  modified: []
key-decisions:
  - "Keep web-core dependency-minimal with only @liiiraa/contracts-ts as a runtime dependency."
  - "Make web-preview fixture identity explicit and allow only @liiiraa/web-core as its runtime dependency."
  - "Defer package lifecycle and TypeScript execution until Plan 03-11 materializes the approved dependency graph."
patterns-established:
  - "Web package boundary: one explicit public root per private ESM package."
  - "Fixture isolation: production web-core never imports or identifies web-preview."
requirements-completed: [WEB-01, WEB-02, WEB-03, WEB-08]
duration: 3min
completed: 2026-07-31
status: complete
---

# Phase 03 Plan 04: Core and Preview Package Boundaries Summary

**Strict ESM production and fixture package roots with minimal one-way workspace dependencies and literal boundary identities.**

## Performance

- **Duration:** 3 min
- **Started:** 2026-07-31T02:14:09Z
- **Completed:** 2026-07-31T02:16:17Z
- **Tasks:** 2
- **Files modified:** 6

## Accomplishments

- Created `@liiiraa/web-core` as a private, strict ESM package exposing only its public root and versioned contract marker.
- Created `@liiiraa/web-preview` as a separately owned fixture adapter package with literal adapter and runtime-class identities.
- Enforced a one-way dependency boundary: web-core consumes generated contracts, while web-preview consumes only web-core.

## Task Commits

Each task was committed atomically:

1. **Task 1: Scaffold the production web-core package** — `abc4280` (feat)
2. **Task 2: Scaffold the fixture-only web-preview package** — `900851c` (feat)

## Files Created/Modified

- `packages/web-core/package.json` — Private ESM manifest with explicit public root, terminating scripts, and minimal approved dependencies.
- `packages/web-core/tsconfig.json` — Strict inherited TypeScript configuration for the production contract package.
- `packages/web-core/src/index.ts` — Public `WEB_CORE_CONTRACT_VERSION` marker.
- `packages/web-preview/package.json` — Private fixture-package manifest depending only on web-core at runtime.
- `packages/web-preview/tsconfig.json` — Strict inherited TypeScript configuration for preview adapters.
- `packages/web-preview/src/index.ts` — Literal adapter ID and fixture runtime-class markers.

## Decisions Made

- Kept both packages behavior-free so downstream TDD plans can add route, scenario, and adapter behavior without renaming public roots.
- Used `vitest --run` for terminating package tests while retaining the repository-approved Vitest 4.1.10 identity.
- Per plan ownership, performed static manifest/config/source verification only; Plan 03-11 owns dependency materialization and the first TypeScript lifecycle checks.

## Deviations from Plan

None - plan executed exactly as written.

## Threat Review

- T-03-01 is mitigated by the separate `@liiiraa/web-preview` public root and literal `fixture` runtime classification.
- T-03-SC is mitigated by exact existing dependency identities, workspace links only, and no package installation.
- No network endpoint, authentication path, file-access boundary, schema mutation, or other unplanned threat surface was introduced.

## Issues Encountered

None.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness

- Downstream web-core, web-preview, web-features, and application plans can import stable public package roots.
- Package lifecycle execution remains intentionally deferred until Plan 03-11 installs and links the approved workspace graph.

## Self-Check: PASSED

- All six package files and this summary exist on disk.
- Task commits `abc4280` and `900851c` are present in repository history in execution order.
- Both task-level static assertions and the combined package ownership/public-root verification pass.
- Stub and threat-surface review found no incomplete behavior or unplanned trust boundary.

---

*Phase: 03-complete-web-experience*
*Completed: 2026-07-31*
