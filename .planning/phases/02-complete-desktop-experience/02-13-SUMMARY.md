---
phase: 02-complete-desktop-experience
plan: 13
subsystem: desktop-browser-acceptance
tags: [playwright, chromium, accessibility, axe, visual-regression, pseudo-localization]

requires:
  - phase: 02-19
    provides: Desktop evidence manifest and deterministic visual axes
  - phase: 02-25
    provides: Real desktop application composition and native shell boundary
provides:
  - Deterministic Chromium coverage for every typed route and all 59 canonical S01-S24 route/state pairs
  - Automated axe, keyboard, locale, scale, motion, forced-colors, clipping, and screenshot acceptance
  - Five reviewed visual baselines spanning the locked visual axes
affects: [desktop-uat, packaged-evidence, accessibility, visual-regression]

tech-stack:
  added: []
  patterns:
    - Marker-gated browser composition using frozen scenario data
    - Canonical catalog enumeration with stable omission diagnostics
    - Reviewed screenshot baselines separated from native and manual evidence

key-files:
  created:
    - apps/desktop/tests/browser/routes.spec.ts
    - apps/desktop/tests/browser/scenarios.spec.ts
    - apps/desktop/tests/browser/accessibility.spec.ts
    - apps/desktop/tests/browser/visual.spec.ts
    - apps/desktop/tests/browser/__screenshots__/visual.spec.ts/
  modified:
    - apps/desktop/playwright.config.ts
    - apps/desktop/src/app.tsx
    - apps/desktop/src/index.ts
    - packages/design-system/src/evidence.tsx
    - packages/design-system/src/shell.tsx

key-decisions:
  - "Accept browser test composition only when the frozen scenario carries the exact SIMULATED SCENARIO marker."
  - "Keep pseudo-localization test-only and transform rendered copy without adding pseudo as a shipping preference."
  - "Use icon rail controls below 1180 px while retaining full accessible names and focus/hover labels."

patterns-established:
  - "Browser truth: routes and states are derived from canonical contracts rather than duplicated test lists."
  - "Visual acceptance: baseline updates require deterministic fixtures, clipping checks, and human PNG inspection."

requirements-completed: [UX-02, UX-03, UX-04, UX-05, UX-06, UX-07, UX-08, UX-09, UX-10, UX-11, UX-12]

duration: 35 min
completed: 2026-07-28
status: complete
---

# Phase 02 Plan 13: Deterministic Browser Acceptance Summary

**Chromium acceptance now proves every desktop route and canonical scenario pair, keyboard and axe behavior, and five reviewed visual axes with frozen local fixtures.**

## Performance

- **Duration:** 35 min
- **Started:** 2026-07-28T09:11:41Z
- **Completed:** 2026-07-28T09:47:26Z
- **Tasks:** 2
- **Files modified:** 21

## Accomplishments

- Rendered every typed route and executed all 59 required S01-S24 route/state pairs with stable missing, extra, and duplicate diagnostics.
- Verified D-01 through D-20, all canonical pairs with axe, keyboard navigation, F6 focus regions, locale switching, and favorite management.
- Locked PT-BR, English, pseudo, 100/125/150 percent scale, reduced motion, forced colors, and five visually reviewed screenshot baselines.
- Added a deterministic clipped-control detector and corrected the compact goal rail to icon controls with accessible labels and focus/hover tooltips.

## Task Commits

Each task was committed atomically:

1. **Task 1: Prove route and canonical scenario parity**
   - `258915e` — configure deterministic Chromium acceptance
   - `f73b209` — RED route and scenario acceptance
   - `61632fa` — GREEN canonical route/state execution
2. **Task 2: Prove automated accessibility and visual axes**
   - `0d6b372` — RED accessibility and visual acceptance
   - `00d22ed` — GREEN accessible visual browser acceptance

## Files Created/Modified

- `apps/desktop/tests/browser/routes.spec.ts` - Browser rendering coverage for every typed route.
- `apps/desktop/tests/browser/scenarios.spec.ts` - Canonical S01-S24 parity, route/state execution, and D-01-D-20 evidence.
- `apps/desktop/tests/browser/accessibility.spec.ts` - Axe and keyboard journeys across canonical and critical states.
- `apps/desktop/tests/browser/visual.spec.ts` - Locked axes, clipping assertions, semantic status checks, and pixel comparisons.
- `apps/desktop/tests/browser/__screenshots__/visual.spec.ts/` - Five reviewed Chromium reference images.
- `apps/desktop/src/app.tsx` - Marker-gated pseudo composition, corrected F6 focus, locale control, and favorite management.
- `packages/design-system/src/shell.tsx` - Accessible labeled and compact icon goal rail.
- `packages/design-system/src/evidence.tsx` - Explicit operational `data-state` marker.
- `apps/desktop/scripts/desktop-lifecycle.mjs` - Unit/browser suite separation.

## Decisions Made

- Browser-only composition remains ignored unless the exact simulated-scenario marker is present, preventing ambient globals from changing production truth.
- Pseudo-localization is available only to the verified browser fixture and is not exposed as a shipping locale.
- The compact goal rail follows the UI contract: visible icons at 72/64 px, full names for assistive technology, and names surfaced on focus or hover.
- All work remains local and free; no package, paid service, or cloud resource was added.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] Added the missing deterministic Chromium project**

- **Found during:** Task 1
- **Issue:** The repository had generated browser evidence projects but no runnable `chromium` project or automatic Vite preview for the acceptance specs.
- **Fix:** Added the local Chromium project, automatic preview server, and marker-gated browser fixture composition.
- **Files modified:** `apps/desktop/playwright.config.ts`, `apps/desktop/tests/browser/fixtures.ts`, `apps/desktop/src/index.ts`, `apps/desktop/src/app.tsx`, `eslint.config.mjs`
- **Verification:** Route/scenario smoke and full Chromium project passed.
- **Committed in:** `258915e`, `61632fa`

**2. [Rule 2 - Missing Critical] Completed keyboard-accessible locale and favorite composition**

- **Found during:** Task 2
- **Issue:** The real settings route did not expose the existing locale and favorite controls, F6 focused an inner main instead of the locked focus region, and operational state lacked a machine-readable state marker.
- **Fix:** Integrated the existing controls, corrected F6 focus, preserved heading hierarchy, and added `data-state`.
- **Files modified:** `apps/desktop/src/app.tsx`, `packages/feature-shell/src/features/account-settings.tsx`, `packages/feature-shell/src/features/favorites.tsx`, `packages/design-system/src/evidence.tsx`
- **Verification:** Keyboard journeys and axe checks across 59 canonical pairs passed.
- **Committed in:** `00d22ed`

**3. [Rule 1 - Bug] Replaced clipped compact rail labels with accessible icons**

- **Found during:** Task 2 visual baseline inspection
- **Issue:** At 960 px and below, pseudo and shipping labels were visibly clipped inside the 72/64 px rail.
- **Fix:** Added deterministic goal icons, retained accessible names, exposed names on focus/hover, and added automated clipped-control detection.
- **Files modified:** `packages/design-system/src/shell.tsx`, `packages/design-tokens/src/tokens.css`, `apps/desktop/src/app.css`, `apps/desktop/tests/browser/visual.spec.ts`
- **Verification:** All five images were regenerated, individually inspected, and passed without snapshot updates on the next run.
- **Committed in:** `00d22ed`

**4. [Rule 3 - Blocking] Kept Playwright specs out of Vitest discovery**

- **Found during:** Task 2 regression verification
- **Issue:** The desktop unit lifecycle attempted to execute Playwright specs through Vitest.
- **Fix:** Excluded `tests/browser/**/*.spec.ts` from the Vitest invocation while retaining browser Vitest helpers.
- **Files modified:** `apps/desktop/scripts/desktop-lifecycle.mjs`
- **Verification:** Desktop unit suite passed 62 tests; the Chromium project passed 13 tests.
- **Committed in:** `00d22ed`

---

**Total deviations:** 4 auto-fixed (1 bug, 1 missing critical, 2 blocking).
**Impact on plan:** All fixes were necessary to make the specified browser acceptance executable and truthful; native and manual evidence boundaries remain unchanged.

## Issues Encountered

- Initial RED exposed missing F6 focus, state semantics, locale/favorite composition, pseudo rendering, and baselines; each was resolved through the planned TDD loop.
- Root-wide lint still contains unrelated pre-existing violations in untouched desktop localization, startup, and native bridge files. All files changed by this plan pass type-aware ESLint with zero warnings.

## Verification

- `rtk pnpm --filter @liiiraa/desktop test:e2e -- --project chromium` — 13 passed.
- `rtk pnpm --filter @liiiraa/desktop test` — 62 passed.
- `rtk pnpm --filter @liiiraa/design-system test` — 11 passed.
- `rtk pnpm --filter @liiiraa/feature-shell test` — 86 passed.
- `rtk pnpm --filter @liiiraa/design-tokens test` — 5 passed.
- `rtk pnpm --filter @liiiraa/desktop check` — passed.
- Type-aware ESLint for every changed JS/TS file — passed with zero warnings.
- Prettier and `git diff --check` — passed.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness

- Browser-observable route, scenario, accessibility, and visual evidence is ready for packaged and manual promotion.
- Native assistive-technology and clean-machine claims remain correctly reserved for Plan 02-26.

## Self-Check: PASSED

- All required browser specs and five screenshot baselines exist.
- All five production/test commits for 02-13 are present.
- Both task acceptance criteria and the plan-level Chromium verification passed.
- No paid service, cloud resource, or new dependency was introduced.

---

*Phase: 02-complete-desktop-experience*
*Completed: 2026-07-28*
