---
phase: 01-product-truth-and-modular-contracts
plan: "20"
subsystem: production-truth
tags:
  - artifact-scanning
  - fixture-refusal
  - subprocess-e2e
  - generated-contracts
requires:
  - phase: 01-product-truth-and-modular-contracts
    plan: "09"
    provides: Static, runtime, and type fixture refusal
provides:
  - Bounded deterministic scanning of explicit distributable roots
  - Public-export-only production subprocess smoke verification
  - Generated-contract and runtime boundary validation of process output
affects:
  - 02-desktop-visual-foundation
tech-stack:
  added: []
  patterns:
    - Scan only explicit absolute distribution roots with file and byte bounds
    - Resolve and execute package export maps instead of source composition
    - Validate subprocess evidence independently at artifact, contract, and runtime boundaries
key-files:
  created:
    - tooling/fixture-guard/src/artifact-guard.ts
    - tooling/fixture-guard/src/production-smoke.ts
    - tooling/fixture-guard/fixtures/leaking-artifact/fixture-sentinel.txt
    - tooling/fixture-guard/fixtures/clean-artifact/manifest.json
    - packages/desktop-production-reference/tsconfig.build.json
  modified:
    - tooling/fixture-guard/src/fixture-guard.test.ts
    - tooling/fixture-guard/package.json
    - packages/desktop-production-reference/package.json
    - packages/desktop-production-reference/src/unavailable-client.ts
    - dependency-cruiser.config.mjs
    - package.json
    - pnpm-lock.yaml
key-decisions:
  - "Treat ./dist/index.js as the sole default runtime export while retaining source types for TypeScript consumers."
  - "Project native unavailable values into generated contract DTOs inside the child process, then validate both contract and runtime truth in the parent."
  - "Exclude generated dist directories from source architecture traversal while scanning those directories independently with the artifact guard."
requirements-completed:
  - FOUND-04
duration: 10 min
completed: 2026-07-27
---

# Phase 01 Plan 20: Production Artifact and Process Truth Summary

Bounded artifact inspection and a production-mode subprocess now prove that the public built export is fixture-free and emits honest unavailable diagnostics.

## Performance

- **Duration:** 10 min
- **Started:** 2026-07-27T06:24:34Z
- **Completed:** 2026-07-27T06:34:45Z
- **Tasks:** 2
- **Files modified:** 12

## Accomplishments

- Added an explicit-root artifact scanner with deterministic findings, extension allowlisting, symlink/traversal refusal, and bounded file/byte reads.
- Seeded exact leaking and clean artifact corpora and proved source trees cannot masquerade as distributables.
- Changed the production package runtime export to a real TypeScript-emitted `dist/index.js`.
- Added a subprocess E2E that forces a production build, resolves the package export map, scans the artifact, executes only the resolved export, and verifies loaded-module evidence.
- Validated child diagnostics against the generated contract and the complete subprocess boundary against the existing runtime fixture guard.

## Task Commits

1. **Task 01-20-01 RED: Define artifact fixture refusal** — `62997ed`
2. **Task 01-20-01 GREEN: Enforce bounded artifact scanning** — `7c72033`
3. **Task 01-20-02 RED: Define production subprocess truth** — `4033326`
4. **Task 01-20-02 GREEN: Verify exported production subprocess** — `3686e19`

## Files Created/Modified

- `tooling/fixture-guard/src/artifact-guard.ts` — Bounded deterministic artifact walker and fixture detector.
- `tooling/fixture-guard/src/production-smoke.ts` — Build, export resolution, subprocess execution, contract validation, and runtime proof.
- `tooling/fixture-guard/src/fixture-guard.test.ts` — Exact positive and negative artifact/process cases.
- `tooling/fixture-guard/fixtures/leaking-artifact/fixture-sentinel.txt` — Known leaking artifact corpus.
- `tooling/fixture-guard/fixtures/clean-artifact/manifest.json` — Known clean distributable corpus.
- `packages/desktop-production-reference/package.json` — Public default runtime export points to built JavaScript.
- `packages/desktop-production-reference/tsconfig.build.json` — Production-only emit configuration.
- `packages/desktop-production-reference/src/unavailable-client.ts` — Runtime dependency-free production constants preserve standalone distribution.
- `tooling/fixture-guard/package.json` — Contract validator dependency and build-before-test sequencing.
- `package.json` — Root production truth verification command.
- `dependency-cruiser.config.mjs` — Generated distribution directories excluded from source architecture traversal.
- `pnpm-lock.yaml` — Workspace dependency graph update.

## Decisions Made

- Runtime consumers receive only the emitted default export; the source path remains available solely as the TypeScript `types` condition.
- The subprocess outputs both native runtime evidence and generated-contract diagnostic projections so both representations are checked without weakening the production type model.
- Generated `dist` content is excluded from source dependency-cruiser analysis and independently subjected to the stricter bounded artifact scanner.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] Added an emit-only production build configuration**

- **Found during:** Task 01-20-02 GREEN
- **Issue:** The existing package `build` script only type-checked and its public default export targeted source, so no distributable entry existed to execute.
- **Fix:** Added `tsconfig.build.json`, emitted `dist/index.js`, and changed only the runtime export to the emitted entry.
- **Files modified:** `packages/desktop-production-reference/package.json`, `packages/desktop-production-reference/tsconfig.build.json`
- **Verification:** `pnpm test:production-truth` executes the resolved `dist/index.js`.

**2. [Rule 3 - Blocking] Removed an empty runtime import from the standalone build**

- **Found during:** Task 01-20-02 GREEN
- **Issue:** Inline type imports were preserved as an empty runtime import, causing Node to traverse a source-only workspace dependency.
- **Fix:** Converted the dependency to a true type-only import and localized the already-canonical literal constants.
- **Files modified:** `packages/desktop-production-reference/src/unavailable-client.ts`
- **Verification:** The clean Node subprocess imports and executes the built package without source dependency resolution.

**3. [Rule 3 - Blocking] Excluded emitted distributions from source architecture traversal**

- **Found during:** Task 01-20-02 GREEN
- **Issue:** Dependency-cruiser treated emitted files as duplicate source modules and reported false deep-import violations.
- **Fix:** Added `dist` to the canonical generated-directory exclusion while preserving independent artifact scanning.
- **Files modified:** `dependency-cruiser.config.mjs`
- **Verification:** `pnpm test:architecture` passes with workspace and Cargo adapters each executed once.

---

**Total deviations:** 3 auto-fixed blocking issues

**Impact on plan:** All deviations were required to create and execute the planned real distribution path. No external package or product architecture was introduced.

## TDD Gate Compliance

- **Task 01-20-01 RED:** `62997ed` failed because `artifact-guard.ts` did not exist.
- **Task 01-20-01 GREEN:** `7c72033` passed the exact leaking, clean, explicit-root, and source-tree cases.
- **Task 01-20-02 RED:** `4033326` failed because `production-smoke.ts` did not exist.
- **Task 01-20-02 GREEN:** `3686e19` passed public export execution plus fixture module and fixture response refusal.
- **REFACTOR:** No separate refactor commit was required; formatting and strict type cleanup were completed before each GREEN commit.

## Verification

- `rtk pnpm --filter @liiiraa/fixture-guard test -- --run -t "artifact"` — passed, 10 selected/collected tests with four artifact cases.
- `rtk pnpm test:production-truth` — passed, 13 fixture-guard tests including the real production subprocess.
- `rtk pnpm test:architecture` — passed, 23 policy tests and both live adapters.
- `rtk pnpm verify` — passed complete workspace toolchain, contracts, generation, types, lint, formatting, tests, and builds.

## Issues Encountered

None.

## Next Phase Readiness

FOUND-04 now has independent type, static, runtime, artifact, and process evidence. Phase 01 is ready for aggregate verification after its remaining plan state is reconciled.

## Execution Mode

Generic-agent workaround used because typed `gsd-executor` dispatch was unavailable in this Codex session.

## Self-Check: PASSED

- All five created artifacts and seven modified artifacts exist.
- Both RED/GREEN TDD commit pairs exist in order.
- The exact task commands, architecture gate, and full root verification pass.
- Working tree was clean before planning metadata close-out.

---

_Phase: 01-product-truth-and-modular-contracts_
_Completed: 2026-07-27_
