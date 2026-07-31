---
phase: 03-complete-web-experience
plan: "02"
subsystem: architecture
tags: [module-boundaries, vitest, fixture-isolation, web-deployments]
requires:
  - phase: 01-product-truth-and-modular-contracts
    provides: Canonical module-boundary policy and live graph evaluator
  - phase: 03-complete-web-experience
    provides: Approved Phase 3 dependency identities from Plan 03-01
provides:
  - Seven reserved web package, tooling, and composition ownership records
  - Executable production-to-fixture and cross-composition isolation coverage
  - Mutation proof that an admin route group cannot replace an isolated deployment
affects: [03-03, 03-04, 03-05, web-core, web-preview, web-features, apps-web, apps-account, apps-admin]
tech-stack:
  added: []
  patterns:
    - Canonical roots remain reserved and undiscoverable until a manifest activates them
    - Production public composition cannot import fixture adapters or fixture compositions
key-files:
  created: []
  modified:
    - architecture/module-boundaries.json
    - tooling/architecture-tests/src/check-workspace.test.ts
key-decisions:
  - "Reserve all seven Phase 3 roots before scaffolding any package or application manifest."
  - "Keep account and admin compositions fixture-classified even when independently buildable."
patterns-established:
  - "Web activation: derive in-memory graphs from canonical module IDs rather than duplicating ownership metadata."
  - "Deployment isolation: reject nested admin route ownership, cross-composition imports, and fixture authority spoofing."
requirements-completed: [WEB-08]
duration: 10min
completed: 2026-07-31
status: complete
---

# Phase 03 Plan 02: Web Module Ownership and Isolation Summary

**Seven pre-declared web roots with executable production/fixture, public-root, deployment, and cycle isolation before any Next.js manifest exists**

## Performance

- **Duration:** 10 min
- **Started:** 2026-07-31T01:42:14Z
- **Completed:** 2026-07-31T01:51:55Z
- **Tasks:** 2
- **Files modified:** 2 implementation files

## Accomplishments

- Reserved `web-core`, `web-preview`, `web-features`, `web-evidence`, `web-app`, `account-app`, and `admin-app` with exact owners, layers, public roots, runtime classes, and reserved status.
- Proved all seven roots remain absent from live workspace discovery until their manifests are created.
- Added a legal Phase 3 activated graph plus ten focused isolation mutations covering public-to-preview, public-to-account/admin, account-to-admin, deep imports, duplicate ownership, fixture authority spoofing, and cycles.
- Proved an admin route group nested beneath `apps/web` creates duplicate ownership instead of satisfying the separate admin deployment boundary.

## Task Commits

Each task was committed atomically:

1. **Task 1: Reserve the Phase 3 module graph**
   - `2575c5d` (test: failing reservation coverage)
   - `2e0d4fc` (feat: seven canonical reserved records)
2. **Task 2: Reject web isolation and fixture-boundary violations**
   - `15b545b` (test: failing isolation mutation matrix)
   - `1d13790` (test: stable runtime-class diagnostics and green matrix)

## Files Created/Modified

- `architecture/module-boundaries.json` - Seven reserved ownership records for future Phase 3 roots.
- `tooling/architecture-tests/src/check-workspace.test.ts` - Reservation assertions, activated legal graph, and isolation mutations.

## Decisions Made

- Reserved roots are executable architectural authority before manifests exist; application scaffolding must activate these exact records instead of introducing new ownership.
- `apps/account` and `apps/admin` remain fixture compositions until Phase 4 supplies real authority, regardless of whether each app can build independently.
- A route group under `apps/web` is not an administrative isolation boundary because it overlaps the public composition owner.

## Deviations from Plan

None - the plan implementation stayed within the two declared architecture files.

## Deferred Issues

- The repository-wide `pnpm test:architecture` gate reports two pre-existing Phase 2 manifest failures unrelated to Plan 03-02: the frozen desktop workspace dependency expectation omits `@liiiraa/contracts-ts`, and the Phase 2 approval map omits `@types/node@24.13.3`. These appeared during the Task 1 RED run before the Phase 3 records were added and are recorded in `deferred-items.md`.

## Verification

- `pnpm --filter @liiiraa/architecture-tests exec vitest --run -t "Phase 3 web"` — PASS, 11 focused tests.
- Canonical reservation script — PASS, seven records exist exactly once, remain reserved, and have no directory or manifest.
- `pnpm test:architecture` — 43/45 tests pass; the two unrelated Phase 2 manifest failures above remain deferred.

## Issues Encountered

- The root `test:architecture` script forwards extra `--` arguments, so the plan's focused command executes the full suite. The package-local Vitest command was used to prove the Phase 3 focus independently while the full gate result was preserved above.

## User Setup Required

None - no dependencies, services, credentials, directories, or manifests were added.

## Next Phase Readiness

- Plans 03-03 onward can scaffold only the seven pre-approved roots and activate them against the canonical policy.
- The Phase 2 manifest drift should be reconciled by its owning maintenance plan; it does not block the Phase 3 reservation or isolation behavior.

## Known Stubs

None.

## Threat Review

- T-03-01 is mitigated by runtime-class mismatch, production-to-fixture, and cross-composition mutation tests.
- T-03-04 is mitigated by canonical public roots, duplicate-owner rejection, and deep-import refusal.
- No network endpoint, authentication path, file-access boundary, schema trust boundary, or package install was introduced.

## Self-Check: PASSED

- Both implementation files and this summary exist.
- All four task commits are present in repository history.
- The combined Phase 3 reservation and isolation suite passes all 11 focused tests.

---

*Phase: 03-complete-web-experience*
*Completed: 2026-07-31*
