---
phase: 01-product-truth-and-modular-contracts
plan: '06'
subsystem: testing
tags:
  - json-schema
  - ajv
  - vitest
  - acceptance-policy
  - tdd
requires:
  - phase: 01-product-truth-and-modular-contracts
    plan: '02'
    provides: Exact-pinned pnpm, TypeScript, Vitest, and root verification toolchain
provides:
  - Canonical schema requiring security, privacy, accessibility, performance, and recovery dispositions
  - Deterministic schema-first and semantic quality-manifest evaluator
  - Explicit planned and final acceptance modes
  - Six-case omission matrix with six staged/final transition cases
affects:
  - phase-02-desktop-shell-design-system-and-core-ux
  - all-feature-acceptance-manifests
  - release-quality-gates
tech-stack:
  added:
    - Ajv 8.20.0
  patterns:
    - Canonical JSON Schema validation precedes semantic policy validation
    - Planned evidence may be unresolved only with exact ownership and syntax
    - Final evidence must be passed and resolve exact files and commands
key-files:
  created:
    - architecture/quality-manifest.schema.json
    - tooling/acceptance-policy/package.json
    - tooling/acceptance-policy/tsconfig.json
    - tooling/acceptance-policy/src/policy.ts
    - tooling/acceptance-policy/src/policy.test.ts
    - tooling/acceptance-policy/fixtures/omission-matrix.json
  modified:
    - pnpm-lock.yaml
key-decisions:
  - 'Compile the canonical Draft 2020-12 schema with Ajv before any semantic acceptance checks.'
  - 'Require callers and CLI arguments to select planned or final mode explicitly; never infer mode from files or environment.'
  - 'Resolve final evidence against exact command and repository-file allowlists supplied by the caller for deterministic evaluation.'
patterns-established:
  - 'Two-mode certification: planned validates intent and accountability; final validates completed resolvable proof.'
  - 'Accountable exemption: bounded rationale, residual risk, independent reviewer, and future reopening trigger are mandatory.'
requirements-completed:
  - FOUND-06
duration: 8 min
completed: 2026-07-27
status: complete
---

# Phase 01 Plan 06: Two-Mode Quality Manifest Policy Summary

**Draft 2020-12 manifests and deterministic semantics now make all five quality dimensions accountable while separating honest planning from final certification.**

## Performance

- **Duration:** 8 min
- **Started:** 2026-07-27T03:07:21.718Z
- **Completed:** 2026-07-27T03:15:35.389Z
- **Tasks:** 2
- **Files modified:** 7

## Accomplishments

- Required security, privacy, accessibility, performance, and recovery in one canonical schema with exact evidence and bounded exemption shapes.
- Added deterministic semantic checks for unknown or missing requirements, duplicate evidence IDs, owner mismatches, wildcard paths, watch commands, stale triggers, and owner-reviewed exemptions.
- Proved explicit planned/final behavior with six deliberate omission cases and six transition stages, including unresolved, non-final, partially resolved, and fully certified evidence.
- Kept the full workspace green through generation, strict types, lint, formatting, all tests, and builds.

## Task Commits

Each task was executed with RED/GREEN TDD commits:

1. **Task 01-06-01: Specify quality dimensions and accountable exemptions**
   - `2af7bcd` (`test`) — failing schema, dimension, evidence, and exemption tests
   - `cce6e23` (`feat`) — canonical schema and deterministic accountable evaluator
2. **Task 01-06-02: Prove planned and final policy modes**
   - `be596e8` (`test`) — failing omission and transition fixture matrix
   - `61d8e6c` (`feat`) — explicit planned/final mode enforcement
   - `772dd74` (`refactor`) — strict-lint fixture helpers with all behavior preserved

## Files Created/Modified

- `architecture/quality-manifest.schema.json` — Canonical manifest structure and bounded evidence/exemption constraints.
- `tooling/acceptance-policy/package.json` — Exact Ajv, TypeScript, and Vitest package contract.
- `tooling/acceptance-policy/tsconfig.json` — Strict package compiler configuration.
- `tooling/acceptance-policy/src/policy.ts` — Schema-first and semantic planned/final evaluator.
- `tooling/acceptance-policy/src/policy.test.ts` — 37 behavioral tests including exact matrix-count assertions.
- `tooling/acceptance-policy/fixtures/omission-matrix.json` — Six omissions and six transition cases.
- `pnpm-lock.yaml` — Frozen acceptance-policy importer using already reviewed exact pins.

## Decisions Made

- Used the already reviewed `ajv@8.20.0` pin to execute the canonical JSON Schema rather than duplicating structural validation.
- Kept mode selection explicit in both `parsePolicyMode` and evaluator context, so missing or invalid modes fail instead of silently behaving as planned.
- Made final resolution deterministic through caller-provided exact file and command sets, avoiding filesystem or environment inference inside the policy core.
- Required exemption review to be independent from the manifest owner and the review date to remain later than the evaluation date.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] Added package-local strict TypeScript configuration**

- **Found during:** Task 01-06-01
- **Issue:** The planned package could not participate in root `check` and `build` without a package `tsconfig.json`, but the file was absent from the plan's `files_modified` list.
- **Fix:** Added `tooling/acceptance-policy/tsconfig.json` extending the root strict baseline with the runtime types required by Vitest.
- **Files modified:** `tooling/acceptance-policy/tsconfig.json`
- **Verification:** Package check, package tests, and root `pnpm verify` pass.
- **Committed in:** `2af7bcd`, refined in `cce6e23`

**Total deviations:** 1 auto-fixed (1 blocking).

**Impact:** No scope expansion; the file is the minimum package integration required by the approved monorepo contract.

## TDD Gate Compliance

- **RED 1:** `2af7bcd` — 21 expected failures against the initial evaluator stub.
- **GREEN 1:** `cce6e23` — all schema, dimension, and exemption tests passed.
- **RED 2:** `be596e8` — explicit-mode fixture failed because missing mode was still accepted.
- **GREEN 2:** `61d8e6c` — missing or invalid mode now fails deterministically.
- **REFACTOR:** `772dd74` — strict lint cleanup retained all 37 passing tests.

## Verification

- `pnpm --filter @liiiraa/acceptance-policy test -- --run -t "schema|dimension|exemption"` — passed; suite reports 37/37.
- `pnpm --filter @liiiraa/acceptance-policy test -- --run -t "planned|final"` — passed; suite reports 37/37.
- Omission matrix — exactly 6 omission cases and 6 transition stages, asserted non-vacuously in tests.
- `pnpm verify` — passed across generate, strict checks, 57 total workspace tests, and builds.

## Issues Encountered

- The first root verification exposed strict lint violations in test-fixture mutation helpers. Replaced unsafe assertions and dynamic deletion with typed helpers in the optional REFACTOR commit; the second root verification passed.

## Known Stubs

None.

## User Setup Required

None — no external services or manual configuration required.

## Next Phase Readiness

- Feature plans can now author honest planned manifests before evidence files exist.
- Release or completion gates can evaluate the same manifests in final mode and reject every unresolved or non-passing reference.
- No blockers remain for later Phase 1 plans to produce manifests against this policy.

## Self-Check: PASSED

- All six implementation artifacts and this summary exist on disk.
- All five TDD task commits are present in git history in RED/GREEN order.
- Both filtered verification commands and the full root verification chain pass.
- The omission fixture asserts exactly six omissions, six transition stages, and twelve total cases.

---

_Phase: 01-product-truth-and-modular-contracts_
_Completed: 2026-07-27_
