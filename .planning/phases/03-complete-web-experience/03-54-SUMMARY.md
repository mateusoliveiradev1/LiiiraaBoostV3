---
phase: 03-complete-web-experience
plan: "54"
subsystem: ui
tags: [react-aria, accessibility, design-system, web-shells, responsive-layout, i18n]

requires:
  - phase: 03-complete-web-experience
    provides: Exact Cobalt Ignition Bay token authority and local typography from Plan 03-53
provides:
  - State-complete accessible controls with stable loading geometry
  - Localized semantic status projection with fail-closed transport translation
  - E1/E2 panels, semantic rows, tables, skeleton regions, and native disclosure
  - Shared branded topbars, quiet preview bands, task rails, mobile disclosure, and bounded workspaces
affects: [03-55, 03-56, 03-57, public-web, account, admin, design-system]

tech-stack:
  added: []
  patterns:
    - Human semantic status projection at the presentation boundary
    - One canonical aria-current destination across desktop and mobile task navigation
    - Token-backed 7/5 and 8/4 focal workspace composition

key-files:
  created: []
  modified:
    - packages/design-system/src/primitives.tsx
    - packages/design-system/src/evidence.tsx
    - packages/design-system/src/design-system.test.tsx
    - packages/design-tokens/src/tokens.css
    - packages/web-features/src/shells.tsx
    - packages/web-features/src/web.css
    - packages/web-features/src/components.test.tsx

key-decisions:
  - "Project recognized transport values into a closed human semantic status union and fail unknown values to unavailable instead of rendering raw enums."
  - "Keep one canonical desktop aria-current anchor while mobile disclosure names the current task without duplicating current-page semantics."
  - "Reuse the existing EmptyComposition public primitive and extend the current kit with E1/E2 material roles rather than creating a parallel component system."

patterns-established:
  - "Primary-button loading renders both labels in one grid cell so state changes never alter control width."
  - "Product workspaces expose one focal region and one tonal context region through explicit 7/5 or 8/4 contracts."

requirements-completed: [WEB-01, WEB-02, WEB-03, WEB-08]

duration: 21min
completed: 2026-08-01
status: complete
---

# Phase 03 Plan 54: Shared Cobalt Product Vocabulary Summary

**Accessible state-complete controls and branded account/admin workspace primitives with quiet preview truth, one focal region, and responsive task navigation**

## Performance

- **Duration:** 21 min
- **Started:** 2026-08-01T16:08:00Z
- **Completed:** 2026-08-01T16:29:09Z
- **Tasks:** 2
- **Files modified:** 7

## Accomplishments

- Completed the shared control state matrix with stable loading geometry, explicit interaction hooks, exact 100/160/200/220ms motion roles, reduced-motion behavior, and forced-color-safe styling.
- Added localized success, warning, critical, preview, unavailable, stale, offline, and error projection with icons, patterns, human labels, and a fail-closed transport-to-presentation mapper.
- Authored tonal/focal panels, semantic rows, named responsive tables, useful skeleton regions, and native disclosure without nested identical cards.
- Replaced sparse generic shared shell geometry with real product lockups, 72/60px topbars, a quiet 40px preview band, 264/280px task rails, compact mobile disclosure, and bounded 7/5 or 8/4 workspaces.
- Removed the rejected left-heavy shared 5/7 runway and ensured inactive navigation stays neutral while the single current task earns the cobalt edge and raised fill.

## Task Commits

Each TDD gate was committed atomically:

1. **Task 1 RED: shared control/material/state vocabulary** - `0ffb313` (test)
2. **Task 1 GREEN: accessible product vocabulary** - `b88c506` (feat)
3. **Task 2 RED: shared shell/workspace composition** - `c124a11` (test)
4. **Task 2 GREEN: branded responsive web workspaces** - `7c13240` (feat)

## Files Created/Modified

- `packages/design-system/src/primitives.tsx` - Stable-loading buttons, exact motion roles, E1/E2 panels, rows, table, skeleton region, and disclosure.
- `packages/design-system/src/evidence.tsx` - Localized semantic status union and bounded transport projection.
- `packages/design-system/src/design-system.test.tsx` - Executable state matrix, material, motion, and accessibility contracts.
- `packages/design-tokens/src/tokens.css` - Token-backed loading, panel, row, skeleton, and disclosure presentation.
- `packages/web-features/src/shells.tsx` - Branded topbar, quiet preview band, task navigation, responsive disclosure, and workspace composition.
- `packages/web-features/src/web.css` - Cobalt shell geometry, focal hierarchy, responsive behavior, motion, and forced-color treatment.
- `packages/web-features/src/components.test.tsx` - Shell, navigation, preview, workspace, responsive-table, and anti-raw-enum assertions.

## Decisions Made

- Unknown transport values map to `unavailable`; they never become user-visible raw labels or acquire authority through presentation.
- Preview uses neutral/cyan language and pattern, while semantic green, amber, and red remain reserved for actual success, warning, and critical meaning.
- Desktop and mobile may carry breakpoint-specific route links, but only the canonical desktop destination owns `aria-current`; the mobile summary communicates the current task without duplicate semantics.
- Permanent hierarchy uses one E2 focal workspace plus E1 tonal context, with no shadow and no repeated card geometry.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 2 - Missing Critical] Added token-backed material and loading styles to the token owner**

- **Found during:** Task 1 GREEN
- **Issue:** The planned primitive files could expose semantic hooks, but stable loading geometry and E1/E2 material behavior would not be visually complete without shared token-owner CSS.
- **Fix:** Added scoped button-label, panel, row, skeleton-region, and disclosure rules to `packages/design-tokens/src/tokens.css` using only the approved Cobalt properties and motion roles.
- **Files modified:** `packages/design-tokens/src/tokens.css`
- **Verification:** Design-token tests pass 11/11, design-system tests pass 19/19, and both TypeScript checks pass.
- **Committed in:** `b88c506`

---

**Total deviations:** 1 auto-fixed (1 Rule 2 missing critical)
**Impact on plan:** The additional owner file was required to make the planned accessible state vocabulary production-complete; no new tokens, dependencies, or authority were introduced.

## Issues Encountered

- A formatting write normalized significant zeroes in canonical OKLCH declarations and correctly tripped Plan 03-53's exact token gate. The token file was restored, only the scoped new CSS was reapplied, and the complete 11-test token suite returned green before either GREEN commit.
- The repository already exported `EmptyComposition` from `shell.tsx`; Task 1 reused and tested that existing primitive instead of introducing a duplicate export.

## TDD Gate Compliance

- Task 1 RED `0ffb313` failed on six missing state/material behaviors before GREEN `b88c506` passed 19/19 tests.
- Task 2 RED `c124a11` failed on the three missing shared shell compositions before GREEN `7c13240` passed the filtered 10-test gate and the full 36-test package suite.
- Both required `test(...)` commits precede their corresponding `feat(...)` commits.

## Known Stubs

None.

## Verification

- `rtk pnpm --filter @liiiraa/design-system test` — 19/19 passed.
- `rtk pnpm --filter @liiiraa/design-system check` — passed.
- `rtk pnpm --filter @liiiraa/web-features test` — 36/36 passed.
- `rtk pnpm --filter @liiiraa/web-features check` — passed.
- `rtk pnpm --filter @liiiraa/design-tokens test` — 11/11 passed.
- `rtk pnpm --filter @liiiraa/design-tokens check` — passed.
- `rtk pnpm web:check` — 10/10 workspace checks passed across public, account, admin, core, preview, features, and evidence packages.
- Impeccable detector on `shells.tsx` and `web.css` — zero findings.

## Threat Review

- Typed status projection mitigates spoofing by keeping raw scenario/adapter values out of ordinary chrome and defaulting unknown values to unavailable.
- Shared actions remain route/handler driven and add no session, payment, device, support, diagnostic, administrative, release, or mutation authority.
- No new endpoint, authentication path, file access pattern, schema, external script, dependency, or supply-chain surface was introduced.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness

- Plans 03-55 through 03-57 can compose public, account, and admin revisions from one accessible Cobalt foundation through package public roots.
- Human visual approval remains explicitly pending and is not granted by these deterministic component gates.

## Self-Check: PASSED

- All seven implementation files and this summary exist on disk.
- RED/GREEN commits `0ffb313`, `b88c506`, `c124a11`, and `7c13240` resolve in Git history.

---
*Phase: 03-complete-web-experience*
*Completed: 2026-08-01*
