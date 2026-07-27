---
phase: 01-product-truth-and-modular-contracts
plan: "03"
subsystem: architecture
tags:
  - module-boundaries
  - dependency-graph
  - typescript
  - vitest
requires:
  - phase: 01-product-truth-and-modular-contracts
    provides: Exact-pinned pnpm, TypeScript, Vitest, and strict workspace policy from Plan 01-02
provides:
  - Canonical cross-language module constitution with reserved module records
  - Deterministic dependency evaluator for ownership, public roots, layers, fixtures, exceptions, and cycles
  - Positive, TypeScript-negative, cycle-negative, and Cargo-negative graph fixtures
affects:
  - 01-04-contract-generation-spike
  - 01-05-contract-parity
  - phase-02-desktop-modules
  - all-future-module-packages
tech-stack:
  added: []
  patterns:
    - Policy-owned repository roots determine module identity
    - Named exceptions may waive layer direction only
    - Runtime class and public-root checks remain fail-closed
key-files:
  created:
    - architecture/module-boundaries.schema.json
    - architecture/module-boundaries.json
    - tooling/architecture-tests/package.json
    - tooling/architecture-tests/tsconfig.json
    - tooling/architecture-tests/src/policy.ts
    - tooling/architecture-tests/src/policy.test.ts
    - tooling/architecture-tests/fixtures/allowed-graph.json
    - tooling/architecture-tests/fixtures/forbidden-edge.json
    - tooling/architecture-tests/fixtures/cycle.json
    - tooling/architecture-tests/fixtures/cargo-forbidden-edge.json
  modified:
    - pnpm-lock.yaml
key-decisions:
  - "Resolve module ownership from canonical repository roots; overlapping roots invalidate the policy before graph evaluation."
  - "Named exceptions waive only an exact module-to-module layer-direction rule, never deep-import or production-to-fixture safety."
  - "Reserve future modules as policy records without creating empty package or crate shells."
  - "Treat the policy runtime class as authoritative and reject graph nodes that claim a different identity."
patterns-established:
  - "Architecture diagnostics: stable code, exact repository path, and deterministic message."
  - "Fixture mutation: each seeded negative becomes valid when its violating edge is removed."
requirements-completed:
  - FOUND-05
duration: 11 min
completed: 2026-07-27
status: complete
---

# Phase 1 Plan 3: Canonical Module Constitution and Graph Policy Summary

**A schema-backed module constitution and deterministic evaluator now reject ambiguous ownership, forbidden direction, deep imports, fixture leakage, and dependency cycles with exact path diagnostics.**

## Performance

- **Duration:** 11 min
- **Started:** 2026-07-27T02:31:03Z
- **Completed:** 2026-07-27T02:42:18Z
- **Tasks:** 2
- **Files modified:** 11

## Accomplishments

- Declared active and reserved TypeScript/Rust modules, owners, layers, public roots, runtime classes, and reviewable named exceptions in one canonical policy.
- Implemented schema and semantic validation before graph evaluation, deterministic ownership resolution, public-entry enforcement, fixture exclusion, layer checks, and topological cycle detection.
- Added 17 policy tests covering positive behavior, every required negative invariant, fixture coverage counts, and mutations that prove each fixture is actually exercised.
- Proved the same policy vocabulary handles TypeScript-shaped and Cargo-shaped dependency edges without language-specific exemptions.

## Task Commits

Each TDD task was committed through RED and GREEN:

1. **Task 01-03-01: Specify the module constitution and evaluator**
   - `057cefa` (`test`) — RED policy behavior and stable diagnostics
   - `694354d` (`feat`) — GREEN schema, constitution, and evaluator
2. **Task 01-03-02: Prove allowed, forbidden, cyclic, and Cargo-shaped graphs**
   - `4785023` (`test`) — RED fixture corpus and mutation expectations
   - `b4d1e81` (`feat`) — GREEN deterministic graph fixtures

## Files Created/Modified

- `architecture/module-boundaries.schema.json` — Closed JSON Schema for the policy vocabulary.
- `architecture/module-boundaries.json` — Canonical owners, roots, dependency layers, runtime classes, and reserved modules.
- `tooling/architecture-tests/src/policy.ts` — Strict parser plus semantic and dependency-graph evaluator.
- `tooling/architecture-tests/src/policy.test.ts` — Policy behavior, fixture coverage, and mutation tests.
- `tooling/architecture-tests/fixtures/*.json` — Minimal allowed, fixture-forbidden, cyclic, and Cargo-forbidden graphs.
- `tooling/architecture-tests/package.json` — Architecture test workspace package.
- `tooling/architecture-tests/tsconfig.json` — Strict package compiler configuration.
- `pnpm-lock.yaml` — Frozen importer for the new workspace package using already-approved exact pins.

## Decisions Made

- Ownership is derived from canonical roots instead of trusting graph-provided module names.
- An overlap between any two module roots is a policy error, preventing ambiguous or spoofed ownership.
- Exceptions are exact named source/target records and cannot bypass public-root or fixture controls.
- Reserved modules express future direction without introducing stale empty packages.

## TDD Gate Compliance

| Task | RED | GREEN | REFACTOR | Status |
| --- | --- | --- | --- | --- |
| 01-03-01 | `057cefa` | `694354d` | — | Pass |
| 01-03-02 | `4785023` | `b4d1e81` | — | Pass |

Both RED runs failed because their intended implementation artifacts were absent. Both GREEN commits passed the exact plan verification commands. No refactor commit was necessary.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] Added the architecture package TypeScript project**

- **Found during:** Task 01-03-01
- **Issue:** The planned package had no project configuration, so the strict compiler and ESLint project service could not validate its source.
- **Fix:** Added `tooling/architecture-tests/tsconfig.json` inheriting the root strict policy and the platform library declarations required by Vitest's public types.
- **Verification:** Package `check`, type-aware ESLint, and root `verify` pass.
- **Committed in:** `057cefa`, `694354d`

**2. [Rule 3 - Blocking] Recorded the new workspace importer in the frozen lockfile**

- **Found during:** Task 01-03-01
- **Issue:** A workspace package with exact TypeScript and Vitest declarations must appear in `pnpm-lock.yaml` for frozen installs.
- **Fix:** pnpm added only the new importer and reused the already-approved exact dependency graph with zero downloads.
- **Verification:** The filtered test and full root verification run with pnpm 11.17.0.
- **Committed in:** `057cefa`

---

**Total deviations:** 2 auto-fixed blocking issues.

## Issues Encountered

- Vitest's declarations reference browser event/timer primitives while the root TypeScript library intentionally starts at ES2024. The package adds the standard DOM type library without weakening `skipLibCheck: false`.

## Verification

- `rtk pnpm --filter @liiiraa/architecture-tests test -- --run -t "policy"` — 8/8 policy tests passed.
- `rtk pnpm --filter @liiiraa/architecture-tests test -- --run` — 17/17 complete fixture and mutation tests passed.
- `rtk pnpm --filter @liiiraa/architecture-tests check` — strict TypeScript passed.
- Type-aware ESLint and Prettier checks passed for all new source and fixture files.
- `rtk pnpm verify` — root generate, check, test, and build chain passed.

## User Setup Required

None — no external service configuration required.

## Next Phase Readiness

- Plan 01-04 can place generated contract packages into already-declared canonical roots.
- Future TypeScript and Cargo graph adapters can emit the shared fixture shape and reuse identical diagnostics.
- No blockers remain.

## Execution Mode

Generic-agent workaround used because typed `gsd-executor` dispatch was unavailable in this Codex session.

## Self-Check: PASSED

- All ten planned architecture artifacts exist on disk.
- Four ordered TDD commits are present in git history.
- The complete 17-test package suite and root `verify` chain pass.
- FOUND-05 has executable positive and negative policy evidence independent of language adapters.

---

_Phase: 01-product-truth-and-modular-contracts_
_Completed: 2026-07-27_
