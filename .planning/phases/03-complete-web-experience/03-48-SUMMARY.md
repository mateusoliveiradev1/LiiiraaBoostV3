---
phase: 03-complete-web-experience
plan: "48"
subsystem: web-navigation
tags: [react, typescript, routing, localization, accessibility, tdd]

requires:
  - phase: 03-44
    provides: Isolated public, account, and admin shells with canonical route manifests
provides:
  - Fail-closed current-route locale projection across public, account, and admin boundaries
  - Native flag-plus-language locale links with explicit localized accessible actions
  - One deterministic aria-current and data-current navigation anchor contract
affects: [03-49, 03-50, 03-51, WEB-01, WEB-02, WEB-03, WEB-08]

tech-stack:
  added: []
  patterns:
    - Match untrusted pathnames inside the expected boundary before rebuilding canonical localized hrefs
    - Preserve ordinary anchor behavior while layering explicit current-page and language semantics

key-files:
  created:
    - .planning/phases/03-complete-web-experience/03-48-SUMMARY.md
  modified:
    - packages/web-core/src/routes.ts
    - packages/web-core/src/routes.test.ts
    - packages/web-core/src/index.ts
    - packages/web-features/src/shells.tsx
    - packages/web-features/src/components.test.tsx
    - packages/web-features/src/web.css

key-decisions:
  - "Project locales only after matchWebRoute admits the pathname at its expected security boundary, then pass only matched path parameters plus the target locale to routeHref."
  - "Use native anchors for locale and shared navigation controls so browser link behavior remains intact while aria-current, data-current, hrefLang, and textual names remain explicit."

patterns-established:
  - "Localized route projection: never copy query, fragment, origin, credential, or ambient URL state into a locale destination."
  - "Current navigation: resolve the first matching canonical item once so duplicate input cannot produce multiple current anchors."

requirements-completed: [WEB-01, WEB-02, WEB-03, WEB-08]

duration: 6 min
completed: 2026-08-01
status: complete
---

# Phase 03 Plan 48: Route-Preserving Locale and Navigation Foundation Summary

**Boundary-matched locale projection now preserves canonical route identity and path parameters, paired with native flag-plus-language links and one explicit current-page anchor across shared shells.**

## Performance

- **Duration:** 6 min
- **Started:** 2026-08-01T04:41:49Z
- **Completed:** 2026-08-01T04:47:09Z
- **Tasks:** 2
- **Files modified:** 6

## Accomplishments

- Added `resolveLocalizedCurrentRoute`, which matches the current path within the expected origin boundary and reconstructs the same route using only canonical parameters and the target locale.
- Proved public Home, documentation, release, account Profile, and dynamic admin workspaces retain route IDs and parameter identities across PT-BR and English.
- Rejected malformed, foreign-boundary, unknown, query-bearing, fragment-bearing, credential-bearing, source-locale-invalid, and target-locale-invalid inputs without inventing a fallback destination.
- Added a shared native `LocaleSwitcher` that visibly renders `🇧🇷 Português` or `🇺🇸 English`, hides the flag from assistive technology, and exposes a complete localized language-switch action.
- Added deterministic shared navigation semantics with exactly one `aria-current="page"` and `data-current="page"` anchor, 44px targets, visible focus, and forced-colors support.

## TDD Execution

### RED

- The route matrix failed because `resolveLocalizedCurrentRoute` did not exist.
- The component suite failed because `LocaleSwitcher` did not exist and shared navigation rendered no current anchor.

### GREEN

- Locale projection composes `matchWebRoute` and `routeHref` without retaining arbitrary URL state.
- Locale and navigation primitives use ordinary anchors with explicit accessibility and selected-state attributes.

### REFACTOR

- No separate refactor commit was needed; both GREEN implementations remained minimal and passed their package gates.

## Task Commits

Each TDD gate was committed atomically:

1. **Task 1 RED: Localized canonical route matrix** - `9fa9666` (test)
2. **Task 1 GREEN: Boundary-safe localized route projection** - `eb80fcb` (feat)
3. **Task 2 RED: Locale and current-navigation semantics** - `b05136a` (test)
4. **Task 2 GREEN: Accessible locale and navigation primitives** - `ff7cee9` (feat)

## Files Created/Modified

- `packages/web-core/src/routes.ts` - Adds the pure boundary-matched locale projection helper.
- `packages/web-core/src/routes.test.ts` - Covers route/parameter preservation and fail-closed input classes.
- `packages/web-core/src/index.ts` - Exports the locale projection helper through the package root.
- `packages/web-features/src/shells.tsx` - Adds `LocaleSwitcher` and explicit current-anchor navigation semantics.
- `packages/web-features/src/components.test.tsx` - Proves visible labels, accessible flag handling, native link behavior, and one-current-anchor behavior.
- `packages/web-features/src/web.css` - Adds minimal 44px, selected-state, focus-compatible, and forced-colors hooks.

## Verification

- `rtk pnpm --filter @liiiraa/web-core exec vitest run src/routes.test.ts -t "locale|localized current route"` - PASS, 12 selected assertions.
- `rtk pnpm --filter @liiiraa/web-features exec vitest run src/components.test.tsx -t "locale|navigation|shell"` - PASS, 5 selected assertions.
- `rtk pnpm --filter @liiiraa/web-core test` - PASS, 109 assertions.
- `rtk pnpm --filter @liiiraa/web-features test` - PASS, 32 assertions.
- `rtk pnpm --filter @liiiraa/web-features check` - PASS, strict TypeScript no-emit check.

## Decisions Made

- Canonical route matching is the sole authority for preserved path data; the helper accepts no query, fragment, origin, credential, or arbitrary state channel.
- Native anchors carry shared navigation and locale behavior so familiar keyboard, context-menu, open-in-new-tab, and browser navigation semantics are retained.
- The shared navigation list resolves one active index before rendering, preventing duplicate item IDs from producing ambiguous multiple-current-page output.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Corrected stale STATE progress projections**
- **Found during:** Plan close-out
- **Issue:** The state SDK reported 95% progress but serialized a default 20% frontmatter value and left the human-readable plan/activity/progress fields stale.
- **Fix:** Reconciled the serialized fields to the SDK's computed 104/110 completion count, Plan 46 position, and completed Plan 03-48 activity.
- **Files modified:** `.planning/STATE.md`
- **Verification:** STATE now records 104 completed plans, 95% progress, and the Plan 03-48 stop/activity point consistently.
- **Committed in:** Plan metadata commit.

---

**Total deviations:** 1 auto-fixed (1 bug)
**Impact on plan:** Tracking-only correction; implementation scope and runtime behavior were unchanged.

## Issues Encountered

- React exposes `aria-hidden` as the DOM-valid string value `"true"` in raw element props; the component assertion was aligned to that rendered accessibility contract.

## Known Stubs

None.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness

- Plans 03-49 through 03-51 can project their current public, account, or admin path into the target locale without merging origins, shells, cookies, roles, or authority.
- Surface-specific shell composition and visual redesign remain intentionally owned by those later plans.

## Self-Check: PASSED

- All six implementation/test/style files and this summary exist on disk.
- All four RED/GREEN commits are present in repository history in test-before-feature order.
- All focused and plan-level verification commands passed.
- No unplanned network endpoint, authentication path, file access, schema change, dependency, or package installation was introduced.

---
*Phase: 03-complete-web-experience*
*Completed: 2026-08-01*
