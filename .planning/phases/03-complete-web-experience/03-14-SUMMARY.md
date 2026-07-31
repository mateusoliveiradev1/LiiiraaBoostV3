---
phase: 03-complete-web-experience
plan: "14"
subsystem: web-evidence
tags: [vitest, playwright, nyquist, evidence, security]
requires:
  - phase: 03-complete-web-experience
    provides: canonical web routes and W01-W18 scenarios
provides:
  - omission-resistant route, content, release, and security evidence inspectors
  - fail-closed WEB-01/02/03/08 workspace readiness lifecycle
  - three-origin Playwright quick and final browser matrix
  - five-dimension planned requirement evidence manifests
affects: [03-15, 03-18, 03-19, 03-20, 03-21, 03-22, 03-23, 03-24, 03-25, 03-26, 03-27, 03-28, 03-29, 03-30, 03-31, 03-32]
tech-stack:
  added: []
  patterns:
    - isolated positive fixture plus one-at-a-time omission mutations
    - explicit source-tree rejection and real-build-root readiness
    - bounded quick projects with final-only accessibility and responsive axes
key-files:
  created:
    - tooling/web-evidence/src/web-evidence-harness.ts
    - tooling/web-evidence/src/route-manifest.test.ts
    - tooling/web-evidence/src/content-publication.test.ts
    - tooling/web-evidence/src/security-boundaries.test.ts
    - tooling/web-evidence/src/release-gate.test.ts
    - tooling/web-evidence/playwright.config.ts
    - tooling/web-evidence/tests/matrix.config.pw.ts
    - quality/features/WEB-01.json
    - quality/features/WEB-02.json
    - quality/features/WEB-03.json
    - quality/features/WEB-08.json
  modified:
    - package.json
    - tooling/web-evidence/package.json
    - tooling/web-evidence/src/index.ts
    - .planning/phases/03-complete-web-experience/03-VALIDATION.md
key-decisions:
  - "Keep harness self-test and real-workspace readiness as separate evidence modes so Wave 0 can pass without fabricating downstream evidence."
  - "Read the canonical scenario JSON directly in Playwright configuration instead of loading generated runtime validators during config discovery."
  - "Assign all planned requirement evidence to plan-03-32, which owns final evidence promotion."
patterns-established:
  - "Every seeded omission returns one stable bounded diagnostic."
  - "Requirement readiness accepts exact build roots only and rejects source-tree evidence."
requirements-completed: [WEB-01, WEB-02, WEB-03, WEB-08]
metrics:
  duration: 10m
  completed: 2026-07-31
  tasks: 2
  files: 17
status: complete
---

# Phase 3 Plan 14: Wave 0 Web Evidence Harness Summary

**Omission-resistant web evidence with stable diagnostics, fail-closed real-build readiness, and a deterministic three-origin W01-W18 browser matrix.**

## Performance

- **Duration:** 10 minutes
- **Started:** 2026-07-31T01:44:05-03:00
- **Completed:** 2026-07-31T01:54:00-03:00
- **Tasks:** 2
- **Files modified:** 17

## Accomplishments

- Added four focused Vitest suites covering complete fixtures plus route, unsafe-context, translation, stale-content, evidence, visual, indexing, header, CSP, origin, cookie, fixture, release, development-artifact, mismatch, integrity, and bypass mutations.
- Added package and root readiness lifecycles that accept `--requirement WEB-01|WEB-02|WEB-03|WEB-08`, reject source roots, and currently fail with owned `MISSING_*` diagnostics until downstream build evidence exists.
- Configured public, account, and admin web servers and projects at their distinct localhost origins, with three bounded quick cases and 165 final matrix enumerations covering W01-W18 and every locked browser axis.
- Created schema-valid planned manifests for WEB-01, WEB-02, WEB-03, and WEB-08 with five non-empty dimensions, exact commands/files, terminating commands, and one accountable owner.

## Task Commits

1. **Task 1 RED: failing evidence gate tests** — `dfb4161`
2. **Task 1 GREEN: omission-resistant inspectors and readiness lifecycle** — `8d65a69`
3. **Task 2: browser axes and planned requirement manifests** — `7137547`

## Files Created/Modified

- `tooling/web-evidence/src/web-evidence-harness.ts` — Pure route, content, security, release, and workspace readiness inspectors.
- `tooling/web-evidence/src/*-manifest.test.ts`, `content-publication.test.ts`, `security-boundaries.test.ts`, `release-gate.test.ts` — Positive and mutation coverage with stable diagnostics.
- `tooling/web-evidence/readiness.mjs` — Terminating requirement readiness CLI.
- `tooling/web-evidence/run-web-verify.mjs` — Root quick verification wrapper with optional requirement readiness.
- `tooling/web-evidence/playwright.config.ts` — Three servers, bounded quick projects, and final-only browser axes.
- `tooling/web-evidence/tests/matrix.config.pw.ts` — Canonical W01-W18 Playwright enumeration.
- `quality/features/WEB-01.json`, `WEB-02.json`, `WEB-03.json`, `WEB-08.json` — Five-dimension planned evidence roots.
- `.planning/phases/03-complete-web-experience/03-VALIDATION.md` — Wave 0 execution marked complete.

## Decisions Made

- Self-test success proves the harness only; it does not promote unfinished workspace evidence.
- Real readiness scans `.next/standalone` build roots and exact evidence artifacts, never source files.
- Playwright reads the canonical scenario JSON directly because package-level runtime validators are not needed for configuration enumeration and currently expose a CommonJS/ESM loader conflict.
- Final evidence ownership remains `plan-03-32` so planned entries can be promoted without ownership drift.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 2 - Missing critical functionality] Added executable readiness support outside the four test files**
- **Found during:** Task 1
- **Issue:** Tests alone could not provide the required package/root `--requirement` lifecycle or scan real build roots.
- **Fix:** Added a shared inspector, terminating readiness CLI, package script, root wrapper, and exports.
- **Files modified:** `tooling/web-evidence/src/web-evidence-harness.ts`, `tooling/web-evidence/readiness.mjs`, `tooling/web-evidence/run-web-verify.mjs`, `tooling/web-evidence/package.json`, `tooling/web-evidence/src/index.ts`, `package.json`
- **Verification:** Package readiness and root readiness both terminate with the expected owned `MISSING_*` codes.
- **Commit:** `8d65a69`

**2. [Rule 2 - Missing critical functionality] Added a canonical matrix enumeration spec**
- **Found during:** Task 2
- **Issue:** `playwright test --list` cannot prove project/scenario reachability from configuration alone without collected tests.
- **Fix:** Added one config-focused spec derived from the canonical JSON scenario authority, with bounded quick tags and final W01-W18 tags.
- **Files modified:** `tooling/web-evidence/tests/matrix.config.pw.ts`
- **Verification:** Playwright lists 165 tests across public, account, and admin projects.
- **Commit:** `7137547`

**3. [Rule 3 - Blocking issue] Avoided generated validator CommonJS/ESM conflict during Playwright discovery**
- **Found during:** Task 2
- **Issue:** Importing `@liiiraa/web-preview` loaded a generated validator containing CommonJS `require` in an ESM package and blocked config discovery.
- **Fix:** Read the canonical `contracts/scenarios/web-scenarios.json` authority directly in the config and matrix spec.
- **Files modified:** `tooling/web-evidence/playwright.config.ts`, `tooling/web-evidence/tests/matrix.config.pw.ts`
- **Verification:** `playwright test --list` completes and enumerates all W01-W18 identities.
- **Commit:** `7137547`

**Total deviations:** 3 auto-fixed (2 missing critical functionality, 1 blocking issue).
**Impact:** All additions are evidence infrastructure required by the plan; no product architecture or dependency identity changed.

## TDD Gate Compliance

- RED commit `dfb4161` failed because `web-evidence-harness.js` did not exist.
- GREEN commit `8d65a69` passes all 33 harness tests.
- No refactor commit was needed.

## Verification

- `pnpm --filter @liiiraa/web-evidence test -- --run -t "web evidence harness self-test"` — 33 passed.
- `pnpm --filter @liiiraa/web-evidence exec playwright test --list` — 165 tests in one file across all projects.
- `pnpm test:acceptance-policy -- --mode planned` — 50 passed.
- Direct canonical evaluation — WEB-01, WEB-02, WEB-03, and WEB-08 planned manifests valid.
- `pnpm web:verify:quick` — web check and test graph passed.
- Requirement readiness — intentionally red with stable `MISSING_*` diagnostics until downstream evidence exists.

## Known Stubs

None. Planned manifest statuses and missing downstream readiness artifacts are deliberate staged evidence states, not runtime or UI stubs.

## Next Phase Readiness

- Plans 03-15 onward can call `pnpm web:verify:quick -- --requirement WEB-0X` and receive exact owned omissions.
- Plan 03-30 can replace the config enumeration spec with route/state E2E suites while reusing the final-only project axes.
- Plan 03-32 owns promotion of planned manifest entries after exact files and commands resolve.

## Self-Check: PASSED

- All key created and modified files exist.
- Task commits `dfb4161`, `8d65a69`, and `7137547` exist in repository history.
- Plan-level verification commands passed.
