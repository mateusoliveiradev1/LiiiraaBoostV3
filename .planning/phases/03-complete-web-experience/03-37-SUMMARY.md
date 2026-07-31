---
phase: 03-complete-web-experience
plan: "37"
subsystem: ui-testing
tags: [react, design-system, playwright, accessibility, visual-evidence]

requires:
  - phase: 02-complete-desktop-experience
    provides: Approved Pre-Dawn Flight Deck product identity and qualitative comparison captures
  - phase: 03-complete-web-experience
    provides: W01-W18 scenarios, independent web surfaces, and deterministic evidence harness
provides:
  - Reusable exact Liiiraa Boost ProductLockup primitive
  - App-local typography and spacing drift gate with owned migration debt
  - Neutral-focus visual capture helper for W01-W18 and G01-G07
  - Manifest v2 with complete cross-surface review ownership and metadata
affects: [03-38, 03-39, 03-41, 03-42, 03-43, 03-44, 03-45]

tech-stack:
  added: []
  patterns:
    - Exact visual identity extraction without geometry duplication
    - Focus-first accessibility assertions followed by deterministic neutral capture
    - Owner-bound visual debt and rebaseline metadata

key-files:
  created:
    - packages/design-system/src/product-lockup.tsx
  modified:
    - packages/design-system/src/shell.tsx
    - packages/design-system/src/index.ts
    - packages/design-system/src/design-system.test.tsx
    - packages/web-features/src/components.test.tsx
    - tooling/web-evidence/tests/accessibility-responsive.spec.ts
    - tooling/web-evidence/visual-manifest.json

key-decisions:
  - "ProductLockup preserves the approved WindowTitleBar SVG paths and exposes only compact/full composition variants."
  - "Pre-existing off-contract CSS values are recorded exactly with Plans 03-38, 03-39, and 03-41 as cleanup owners; any addition, removal, or mutation fails the gate until ownership is reconciled."
  - "Visual evidence proves skip-link and ordinary focus visibility before blurring focus and resetting scroll for deterministic capture."

patterns-established:
  - "Shared identity: web surfaces import ProductLockup instead of recreating or substituting product branding."
  - "Evidence metadata: every capture declares route, locale, viewport, state, review purpose, comparison source, and rebaseline owner."

requirements-completed: [WEB-01, WEB-02, WEB-03, WEB-08]

duration: 12min
completed: 2026-07-31
status: complete
---

# Phase 03 Plan 37: Shared Visual Foundation and Evidence Gates Summary

**Exact shared Liiiraa Boost lockup, owner-bound app CSS scale enforcement, and neutral-focus W01-W18/G01-G07 review evidence contracts.**

## Performance

- **Duration:** 12 min
- **Started:** 2026-07-31T23:25:36Z
- **Completed:** 2026-07-31T23:37:51Z
- **Tasks:** 2
- **Files modified:** 7

## Accomplishments

- Extracted the approved desktop product mark and wordmark into reusable compact/full `ProductLockup` variants while keeping `WindowTitleBar` geometry and semantics intact.
- Extended the existing web visual contract test to scan shared, public, account, and admin CSS and fail on unowned type or spacing drift.
- Upgraded visual evidence to test skip-link and ordinary keyboard focus, then blur focus and reset scroll before screenshots.
- Expanded the visual manifest from W01-W18 to the complete 25-case W01-W18/G01-G07 matrix with explicit surface, route, locale, viewport, state, purpose, Phase 2 comparison source, and rebaseline owner.

## Task Commits

Each task was committed atomically through its TDD gates:

1. **Task 1 RED: approved product lockup contract** - `bf31610` (test)
2. **Task 1 GREEN: shared ProductLockup extraction** - `4ff0398` (feat)
3. **Task 2 RED: web visual contract gates** - `dd248e2` (test)
4. **Task 2 GREEN: neutral evidence and manifest contracts** - `a7d3801` (test)

## Files Created/Modified

- `packages/design-system/src/product-lockup.tsx` - Exact approved mark and wordmark with compact/full variants and accessible naming.
- `packages/design-system/src/shell.tsx` - Reuses `ProductLockup` in the title bar.
- `packages/design-system/src/index.ts` - Exports the shared lockup from the package root.
- `packages/design-system/src/design-system.test.tsx` - Locks exact geometry, variants, and title-bar semantics.
- `packages/web-features/src/components.test.tsx` - Scans every shared/app-local stylesheet and validates the 25-case review matrix.
- `tooling/web-evidence/tests/accessibility-responsive.spec.ts` - Separates focus verification from neutral deterministic capture and declares G01-G07 tests.
- `tooling/web-evidence/visual-manifest.json` - Manifest v2 review metadata and ownership for W01-W18/G01-G07.

## Decisions Made

- Reused the exact existing mark paths; no logo geometry, wordmark, product naming, color treatment, or brand component was invented.
- Kept current CSS violations as an exact migration ledger rather than changing future surface compositions in this foundation plan. Plans 03-38, 03-39, and 03-41 own their removal, and the test fails on either new drift or stale ledger entries.
- Kept focus globally visible in CSS. Only the active element is blurred immediately before evidence capture, after both skip-link and ordinary focus indicators are proven visible.
- Added G01-G07 as manifest-driven tests without updating PNGs; Plans 03-42 through 03-44 own the controlled rebaseline.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] Bound pre-existing off-contract CSS to exact follow-up owners**

- **Found during:** Task 2 (app-local token enforcement)
- **Issue:** Enabling the new repository-wide gate immediately exposed 34 existing public/account/admin declarations that Plans 03-38, 03-39, and 03-41 are already scoped to redesign. Editing those surfaces here would conflict with their authored composition work; leaving the gate red would block this plan.
- **Fix:** Recorded every current violation with exact file, property, value, surface, and cleanup owner. The test now rejects any unowned addition and also fails when an owner removes debt without reconciling the ledger.
- **Files modified:** `packages/web-features/src/components.test.tsx`
- **Verification:** `@liiiraa/web-features` components suite passes 9/9 and the initial RED output proved the scanner detects all existing violations.
- **Committed in:** `a7d3801`

---

**Total deviations:** 1 auto-fixed (1 blocking)
**Impact on plan:** The gate is executable now without stealing visual-composition scope from the three follow-up plans; no new CSS drift can enter silently.

## Issues Encountered

- The original app-local CSS contains known scale violations by design-gap diagnosis. These remain visible and owner-bound until their dedicated redesign plans execute.
- No PNG baseline was updated, as required.

## Known Stubs

None. The scan found only an intentional search-field placeholder prop and internal empty accumulator/default arrays; no rendered data stub or unfinished feature was introduced.

## Verification

- `rtk pnpm --filter @liiiraa/design-system exec vitest run src/design-system.test.tsx` - 15 tests passed.
- `rtk pnpm --filter @liiiraa/web-features exec vitest run src/components.test.tsx` - 9 tests passed.
- `rtk pnpm --filter @liiiraa/web-evidence exec vitest run src/route-manifest.test.ts src/playwright-config.test.ts` - 12 tests passed.
- `rtk pnpm --filter @liiiraa/web-evidence exec playwright test tests/accessibility-responsive.spec.ts --list` - 351 project/case combinations listed successfully.
- Package manifests, `pnpm-lock.yaml`, and generated contracts have no drift.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness

- Plans 03-38, 03-39, and 03-41 can remove their exact token-debt entries while applying the approved public/account/admin compositions.
- Plans 03-42 through 03-44 can produce the complete neutral-focus rebaseline from manifest v2.
- Phase 3 is not marked complete. Blocking human visual approval remains owned by Plan 03-45.

## Self-Check: PASSED

All eight expected files exist and commits `bf31610`, `4ff0398`, `dd248e2`, and `a7d3801` are present in git history.

---
*Phase: 03-complete-web-experience*
*Completed: 2026-07-31*
