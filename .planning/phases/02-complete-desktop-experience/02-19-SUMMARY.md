---
phase: 02-complete-desktop-experience
plan: "19"
subsystem: testing
tags: [node, wave-zero, canonical-scenarios, evidence, mutation-testing]

requires:
  - phase: 02-complete-desktop-experience
    provides: Canonical scenarios, story axes, packaged prerequisites, and UX-01 through UX-12 planned manifests from Plans 02-03, 02-04, and 02-16 through 02-18
provides:
  - Unified planned-mode Wave 0 verifier for scenarios, route/state pairs, browser axes, packaged rows, manifests, and root commands
  - Thirteen in-memory omission mutations with stable diagnostic codes and source hash protection
affects: [02-28, 02-29, 02-30, phase-02-evidence]

tech-stack:
  added: []
  patterns:
    - Canonical scenario derivation without a duplicated S01-S24 list
    - In-memory omission mutation with deterministic diagnostics and byte-stability checks

key-files:
  created:
    - tooling/desktop-evidence/verify-wave-zero.mjs
  modified: []

key-decisions:
  - "Derive scenario IDs and route/state coverage only from contracts/scenarios/desktop-scenarios.json; the story manifest may contain axes and derivation rules but no scenario copy."
  - "Keep unavailable Windows, development-signing, NVDA, forced-colors, and scaling evidence explicitly planned and owner-attributed instead of treating absence as observed proof."
  - "Run omission mutations entirely in memory and hash all 20 Wave 0 source artifacts before and after the suite."

patterns-established:
  - "Structured verifier diagnostics: stable code, subject, and message fields sorted deterministically."
  - "Planned reachability: command owners and executable targets resolve now while future evidence artifacts remain planned-unresolved."

requirements-completed: [UX-01, UX-02, UX-03, UX-04, UX-05, UX-06, UX-07, UX-08, UX-09, UX-10, UX-11, UX-12]

duration: 12min
completed: 2026-07-28
status: complete
---

# Phase 02 Plan 19: Unified Wave 0 Evidence Gate Summary

**A deterministic Node verifier now proves 24 canonical scenarios, 59 required route/state pairs, 144 browser-axis projects, 11 packaged checks, 12 UX manifests, and 94 owner-attributed planned evidence entries without duplicating scenario truth.**

## Performance

- **Duration:** 12 min
- **Started:** 2026-07-28T03:52:50.214Z
- **Completed:** 2026-07-28T04:04:16.818Z
- **Tasks:** 2
- **Files modified:** 1

## Accomplishments

- Unified canonical scenario, story-axis, packaged prerequisite, quality-manifest, command-owner, artifact-owner, and root lifecycle verification under one planned-mode CLI.
- Preserved the free local development-signing contract with false public trust, SmartScreen reputation, production readiness, and distribution claims.
- Added 13 omission/drift mutations covering every requested Wave 0 artifact family while proving all 20 checked-in sources remain byte-stable.
- Passed story parity, packaged dry-run, planned acceptance policy, ESLint, and Prettier gates.

## Task Commits

Each TDD task was committed atomically:

1. **Task 1 RED: Add failing Wave 0 smoke contract** - `d3901e0` (test)
2. **Task 1 GREEN: Implement unified Wave 0 parity gate** - `701489f` (feat)
3. **Task 2 RED: Add failing Wave 0 mutation contract** - `0b8423d` (test)
4. **Task 2 GREEN: Enforce Wave 0 omission mutations** - `47ea77e` (feat)

## Files Created/Modified

- `tooling/desktop-evidence/verify-wave-zero.mjs` - Loads the canonical Wave 0 graph, emits structured planned-mode reports, and executes deterministic in-memory mutation cases.

## Decisions Made

- The scenario catalog is the sole scenario and route/state authority; the verifier generates the ordered S01-S24 expectation and compares story projection without persisting another list.
- Planned evidence may remain absent only when its exact manifest owner and command target are resolvable; final observed promotion remains owned by Plans 02-28 through 02-30.
- Local development signing remains explicitly self-signed, CurrentUser CNG, non-exportable, unavailable to CI, and non-distributable until Phase 10.

## Deviations from Plan

None - plan executed exactly as written.

## TDD Gate Compliance

- Task 1 RED failed with `WAVE_ZERO_IMPLEMENTATION_REQUIRED`, then GREEN passed the planned smoke.
- Task 2 RED failed with `MUTATION_SUITE_IMPLEMENTATION_REQUIRED`, then GREEN passed all 13 omission cases.
- Git history contains ordered `test(02-19)` then `feat(02-19)` commits for both tasks.

## Verification

- `node tooling/desktop-evidence/verify-wave-zero.mjs --mode planned --smoke` — passed with 24 scenarios, 59 route/state pairs, 144 browser projects, 11 packaged checks, 12 manifests, and 94 evidence entries.
- `node tooling/desktop-evidence/verify-wave-zero.mjs --mode planned --mutations` — 13/13 mutations passed; 20 source files remained byte-stable.
- `pnpm --filter @liiiraa/desktop test:wave-zero -- --story-parity` — 3 tests passed.
- `node tooling/desktop-evidence/verify-packaged-wave-zero.mjs --dry-run` — passed and retained planned packaged acceptance.
- `pnpm test:acceptance-policy -- --mode planned` — 50 tests passed.
- ESLint and Prettier checks passed for the verifier.

## Issues Encountered

None.

## User Setup Required

None - no external service, paid provider, certificate, or secret is required by this plan.

## Next Phase Readiness

- Plans 02-28 and 02-29 can promote only exact observed evidence while reusing this planned graph.
- Plan 02-30 can consume this verifier as the Wave 0 base for recursive final evidence enforcement.
- Windows images, human accessibility observations, and local development-signing evidence intentionally remain planned until their owning gates run.

## Self-Check: PASSED

- `tooling/desktop-evidence/verify-wave-zero.mjs` exists.
- Commits `d3901e0`, `701489f`, `0b8423d`, and `47ea77e` exist in git history.
- Both plan verification commands pass.

---

*Phase: 02-complete-desktop-experience*
*Completed: 2026-07-28*
