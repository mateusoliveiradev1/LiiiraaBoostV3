---
phase: 02-complete-desktop-experience
plan: '14'
subsystem: workspace
tags: [pnpm, typescript, manifests, supply-chain, ownership]
requires:
  - phase: 02-02
    provides: reserved canonical ownership for the four Phase 2 TypeScript roots
provides:
  - four manifest-backed active TypeScript workspace roots
  - exact approved direct dependency graph for desktop composition
  - strict-peer support with two explicitly approved free MIT identities
  - executable workspace discovery, ownership, and identity gates
affects: [02-24, 02-31, desktop-ui, contract-generation]
tech-stack:
  added:
    - '@types/react@19.2.17'
    - '@typespec/openapi@1.14.0'
  patterns:
    - exact external versions with workspace protocol for internal edges
    - canonical root activation only after a manifest exists
    - supplemental dependency approval recorded before manifest admission
key-files:
  created:
    - apps/desktop/package.json
    - packages/design-system/package.json
    - packages/design-tokens/package.json
    - packages/feature-shell/package.json
  modified:
    - architecture/module-boundaries.json
    - tooling/architecture-tests/src/check-workspace.test.ts
    - tooling/architecture-tests/src/policy.test.ts
    - tooling/contract-generation/package.json
    - architecture/dependency-allowlist.json
    - architecture/dependency-review.md
    - .planning/phases/02-complete-desktop-experience/02-DEPENDENCY-APPROVAL.md
key-decisions:
  - 'Keep every Phase 2 dependency free for now; add only the two exact MIT peers explicitly approved by the user.'
  - 'Place @types/react in feature-shell and @typespec/openapi in contract-generation, their narrowest real consumers.'
  - 'Leave pnpm-lock.yaml unchanged so deterministic lockfile resolution remains owned by Plan 02-31.'
patterns-established:
  - 'Workspace activation is atomic: manifest existence, pnpm discovery, and canonical ownership become valid together.'
  - 'Supplemental peer requirements pass the same exact-version approval and evidence gates as planned dependencies.'
requirements-completed:
  [UX-01, UX-02, UX-03, UX-04, UX-05, UX-06, UX-07, UX-08, UX-09, UX-10, UX-11, UX-12]
duration: 23min
completed: 2026-07-27
status: complete
---

# Phase 2 Plan 14: TypeScript Workspace Activation Summary

**Four canonical TypeScript roots are now manifest-backed, uniquely owned, discoverable by pnpm, and constrained to the 33 exact free dependency identities approved for Phase 2.**

## Performance

- **Duration:** 23 min
- **Started:** 2026-07-27T23:41:32Z
- **Completed:** 2026-07-28T00:04:15Z
- **Tasks:** 2
- **Files modified:** 12

## Accomplishments

- Created the desktop, feature-shell, design-system, and design-token manifests with legal design-to-feature-to-composition workspace edges.
- Activated all four canonical owners only after their manifests existed and verified each workspace root is discovered exactly once.
- Extended dependency evidence and approval to the two free MIT peers required by strict pnpm peer enforcement.
- Preserved `pnpm-lock.yaml` unchanged for Plan 02-31.

## Task Commits

Each implementation stage was committed atomically:

1. **Task 1 RED: add failing workspace activation gates** — `2e47f43` (test)
2. **Task 1 GREEN and Task 2 verification: activate roots and approved identities** — `c3a49ce` (feat)
3. **Audit correctness fix: keep generated dependency evidence wording truthful** — `6b35c7f` (fix)
4. **Post-wave gate fix: satisfy architecture test lint policy** — `c76c752` (fix)

## Files Created/Modified

- `apps/desktop/package.json` — desktop composition dependencies and development tools.
- `packages/design-tokens/package.json` — dependency-free token owner.
- `packages/design-system/package.json` — authored UI primitives over design tokens.
- `packages/feature-shell/package.json` — feature composition over desktop client and design system.
- `architecture/module-boundaries.json` — activated the four canonical owners.
- `tooling/architecture-tests/src/check-workspace.test.ts` — discovery, ownership, and exact identity gates.
- `tooling/architecture-tests/src/policy.test.ts` — live adapter expectations for the newly active roots.
- `tooling/contract-generation/package.json` — exact TypeSpec OpenAPI peer.
- `architecture/dependency-allowlist.json` — approved free peer identities and provenance.
- `architecture/dependency-review.md` — regenerated 59-pin evidence, including all 33 Phase 2 pins.
- `.planning/phases/02-complete-desktop-experience/02-DEPENDENCY-APPROVAL.md` — explicit supplemental human approval.
- `tooling/supply-chain/verify-pins.mjs` — truthful evidence-generation wording.

## Decisions Made

- All current dependencies remain free; no paid signing, service, or infrastructure was introduced.
- Strict peer enforcement remains enabled instead of weakening workspace policy.
- The two peer identities were assigned to their narrowest consumers rather than promoted to the repository root.
- Lockfile mutation remains deferred to Plan 02-31.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] Added two explicitly approved strict peers**

- **Found during:** Task 1 GREEN verification
- **Issue:** `pnpm` rejected the workspace because `@types/react@19.2.17` and `@typespec/openapi@1.14.0` were required peers of approved packages.
- **Fix:** After explicit user approval, added both exact free MIT identities to the approval, allowlist, generated evidence, and their narrowest consuming manifests.
- **Verification:** Supply-chain evidence verifies 59 exact pins, including 33 Phase 2 pins; architecture tests pass 34/34.
- **Commit:** `c3a49ce`

**2. [Rule 3 - Blocking] Updated the live workspace adapter expectation**

- **Found during:** Full architecture verification
- **Issue:** `policy.test.ts` still expected only the pre-activation workspace roots.
- **Fix:** Added the four newly active roots to the deterministic expected discovery list.
- **Verification:** Architecture tests pass 34/34.
- **Commit:** `c3a49ce`

**3. [Rule 1 - Bug] Corrected generated evidence wording**

- **Found during:** Post-commit audit
- **Issue:** The report made a global claim that no Phase 2 package had been installed, which ceased to be true after approved verification.
- **Fix:** Scoped the statement to the evidence generator's actual behavior: it does not install packages.
- **Verification:** `verify-pins.mjs --check` passes with regenerated evidence.
- **Commit:** `6b35c7f`

## Post-Wave Gate Correction

- Replaced two `ReadonlyArray<T>` spellings with the repository-required `readonly T[]` syntax.
- Removed four unused properties from a test-only destructuring without changing assertions or behavior.
- Focused architecture tests pass 34/34, package typecheck passes, and repository lint passes with zero warnings.
- The requested `rtk pnpm check` now advances beyond all 02-14 lint errors and stops only at a later-plan `TS18003` in `packages/design-tokens/tsconfig.json`; that unrelated package scaffold was intentionally left untouched.

## Issues Encountered

- The plan's `pnpm` verification command refreshes workspace installation metadata and therefore temporarily updates `pnpm-lock.yaml`; every such mutation was restored, and the final commit leaves the lockfile unchanged.

## Known Stubs

None.

## User Setup Required

None. No paid service, credentials, or external infrastructure is required.

## Next Phase Readiness

- Plan 02-24 can consume the active desktop workspace and contract tooling.
- Plan 02-31 can perform the intentionally deferred deterministic lockfile resolution.
- No blockers attributable to Plan 02-14 remain.

## Self-Check: PASSED

- All four created manifests and this summary exist on disk.
- RED `2e47f43`, GREEN `c3a49ce`, audit fix `6b35c7f`, and post-wave gate fix `c76c752` exist in git history.
- Architecture tests pass 34/34, supply-chain evidence is current, and `pnpm-lock.yaml` is unchanged.

---

_Phase: 02-complete-desktop-experience_
_Completed: 2026-07-27_
