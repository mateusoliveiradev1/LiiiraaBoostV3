---
phase: 03-complete-web-experience
plan: '55'
subsystem: ui
tags: [nextjs, responsive-navigation, i18n, accessibility, product-hero, visual-evidence]

requires:
  - phase: 03-complete-web-experience
    provides: Exact Cobalt token authority, local display type, and shared accessible primitives from Plans 03-53 and 03-54
provides:
  - Branded 72px/60px public chrome with six intent pillars and one dominant compatibility action
  - Canonical route-preserving flag-plus-language navigation with a full-height responsive menu
  - Centered three-line promise and 1120px real desktop artifact stage with truthful invoked provenance
  - Exact public first-load motion roles with reduced-motion and forced-color fallbacks
affects: [03-56, 03-61, public-web, visual-evidence, localization]

tech-stack:
  added: []
  patterns:
    - Server-owned public shell with narrow client pathname projection
    - Copy-first cinematic artifact staging from checksum-admitted locale captures
    - Geometry and motion contracts exposed through deterministic semantic hooks

key-files:
  created: []
  modified:
    - apps/web/src/app/[locale]/layout.tsx
    - apps/web/src/public-navigation.tsx
    - apps/web/src/app/public-shell.css
    - apps/web/src/public-shell.test.ts
    - apps/web/src/features/home.tsx
    - apps/web/src/home.test.tsx

key-decisions:
  - 'Use compatibility, not release availability, as the unequal primary action in both desktop and mobile public chrome.'
  - 'Preserve canonical locale destinations through native anchors while unmatched browser state fails safely to the target-locale Home.'
  - 'Render the approved promise as three authored wide-screen lines above the checksum-admitted product capture, while allowing safe narrow-screen reflow.'

patterns-established:
  - 'Public mobile chrome keeps flag-plus-language visible outside the menu and repeats the complete locale action inside the full-height task surface.'
  - 'Hero media carries intrinsic capture dimensions, bounded display crops, complete-image access, and provenance only through an invoked disclosure.'

requirements-completed: [WEB-01, WEB-03, WEB-08]

duration: 15min
completed: 2026-08-01
status: complete
---

# Phase 03 Plan 55: Branded Public Shell and Cinematic Product Hero Summary

**Route-aware cobalt public chrome and a centered three-line promise staged above a truthful 1120px desktop capture with responsive evidence access**

## Performance

- **Duration:** 15 min
- **Started:** 2026-08-01T16:35:08Z
- **Completed:** 2026-08-01T16:50:29Z
- **Tasks:** 2
- **Files modified:** 6

## Accomplishments

- Rebuilt the public entrance as a bounded 72px desktop topbar and 60px mobile topbar with the full product lockup, six intent pillars, exact active-route projection, search, readable flag-plus-language controls, and a committed compatibility CTA.
- Added a keyboard/touch-operable full-height menu below 1100px while preserving native anchor behavior, canonical locale identity, skip-link focus, forced colors, and the development-only CSP exception.
- Replaced the rejected left-heavy 5/7 hero with a centered authored promise, concise lead, unequal CTAs, proof note, and the real locale-matched desktop artifact as the largest visual object.
- Staged the artifact at 1120px with a non-destructive 16:9 wide crop, 16:10 mobile crop, full-screenshot access, invoked provenance, intrinsic media dimensions, and one bounded cobalt/cyan bloom.
- Implemented the exact 360ms headline and 480ms/80ms artifact roles, with an 8px translation cap, 0.985 scale floor, and complete reduced-motion/forced-color fallbacks.

## Task Commits

Each TDD gate was committed atomically:

1. **Task 1 RED: branded public shell contract** - `4b381f5` (test)
2. **Task 1 GREEN: route-aware public navigation shell** - `e601da9` (feat)
3. **Task 2 RED: cinematic hero contract** - `ee34bc2` (test)
4. **Task 2 GREEN: centered real-product hero** - `e5f3a81` (feat)

## Files Created/Modified

- `apps/web/src/app/[locale]/layout.tsx` - Supplies bilingual compatibility copy to the server-owned public shell.
- `apps/web/src/public-navigation.tsx` - Projects one canonical current intent, route-preserving locale anchors, desktop actions, and complete mobile navigation.
- `apps/web/src/app/public-shell.css` - Owns exact shell, hero, stage, motion, reflow, forced-color, and reduced-motion geometry.
- `apps/web/src/public-shell.test.ts` - Enforces topbar dimensions, native locale semantics, active-route projection, focus, responsive menu, and CSP boundaries.
- `apps/web/src/features/home.tsx` - Renders the authored promise, concise visitor copy, compatibility/product actions, and admitted real capture stage.
- `apps/web/src/home.test.tsx` - Enforces promise hierarchy, stage geometry hooks, mobile crop/action order, provenance, and motion caps.

## Decisions Made

- The public topbar and hero share one compatibility-first action hierarchy because public distribution remains fail closed; no CTA implies that an installer is available.
- The mobile locale control remains visible beside the compact lockup and is also available inside the task menu, always as a native flag-plus-readable-language anchor to the canonical localized route.
- Wide screens preserve the promise as exactly three authored sentences/lines; 320px reflow may wrap safely rather than forcing overflow.
- The real capture remains unedited. CSS supplies only a bounded presentation crop, edge, and atmospheric bloom, while the complete image and exact provenance remain available through native links/disclosure.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Test Bug] Generalized the mobile crop selector assertion**

- **Found during:** Task 2 GREEN
- **Issue:** The RED assertion required the image to be an immediate stage descendant even though the canonical `RealProductStage` inserts its semantic figure wrapper.
- **Fix:** Allowed the selector to preserve the canonical wrapper while still requiring the 16:10 crop under the mobile breakpoint.
- **Files modified:** `apps/web/src/home.test.tsx`
- **Verification:** The targeted 13-test hero gate and complete 67-test public suite pass.
- **Committed in:** `e5f3a81`

**2. [Rule 3 - Blocking] Closed an unchecked proof-note lookup**

- **Found during:** Task 2 GREEN TypeScript verification
- **Issue:** Strict unchecked-index access correctly treated the first warning as possibly undefined after it became a required string prop.
- **Fix:** Added a fail-closed runtime guard that rejects incomplete hero content before rendering.
- **Files modified:** `apps/web/src/features/home.tsx`
- **Verification:** `@liiiraa/web` strict TypeScript check and all public tests pass.
- **Committed in:** `e5f3a81`

**3. [Rule 1 - Responsive Bug] Corrected the wide promise wrap and artifact fold position**

- **Found during:** Task 2 responsive visual inspection at 1440×900
- **Issue:** The final promise sentence wrapped into a fourth line, pushing the artifact top to roughly y=613 despite the 560px maximum.
- **Fix:** Kept each authored sentence centered and unbroken only at widths at or above 960px; narrow reflow remains unconstrained.
- **Files modified:** `apps/web/src/app/public-shell.css`
- **Verification:** The recaptured 1440×900 render shows three lines and the 1120px artifact beginning around y=540; 320×800 remains free of horizontal overflow.
- **Committed in:** `e5f3a81`

---

**Total deviations:** 3 auto-fixed (2 Rule 1, 1 Rule 3)
**Impact on plan:** All fixes enforce the approved responsive and strict-type contract without expanding scope, dependencies, or authority.

## Issues Encountered

- The workspace already had a Next development server on port 3000. It was reused for read-only responsive capture and left running unchanged.

## TDD Gate Compliance

- Task 1 RED `4b381f5` failed only on the missing topbar/menu geometry before GREEN `e601da9` passed all 25 shell and CSP tests.
- Task 2 RED `ee34bc2` failed on five missing hero behaviors before GREEN `e5f3a81` passed the 13-test hero gate.
- Both required RED commits precede their corresponding GREEN commits.

## Owner Correction Replay

- **Trigger:** Plan 03-56 replay exposed one stale Plan 03-55 Home contract that still expected the hero's `clamp(52px, 6vw, 76px)` value to be declared directly in `public-shell.css`.
- **Correction:** `apps/web/src/home.test.tsx` now verifies that the hero consumes `var(--lb-public-hero-display-size)` and independently verifies that the canonical design token resolves to the exact approved clamp.
- **Scope:** Test-only; no hero source, CSS, layout, assets, or screenshots changed.
- **Commit:** `bc2d32b` (`test(03-55): follow canonical hero display token`)
- **Replay results:** Targeted Home contract 1/1 passed; complete `@liiiraa/web` suite 81/81 passed; strict package TypeScript and the 10-task public workspace check passed; the production Next build and Prettier check passed.
- **Verification note:** An initial TypeScript check overlapped Next's `.next/types` regeneration and transiently reported missing generated route files. The serialized rerun after the successful build passed with no source changes.

## Known Stubs

None. The public-download unavailable state is an intentional fail-closed product boundary, not a placeholder.

## Verification

- `rtk pnpm --filter @liiiraa/web test` — 7 files, 67 tests passed.
- `rtk pnpm --filter @liiiraa/web exec vitest run src/home.test.tsx src/public-shell.test.ts` — 38/38 passed.
- `rtk pnpm web:check` — 10/10 workspace checks passed.
- Prettier checks passed for all modified sources.
- Impeccable detector on the public navigation, hero, and shell CSS — zero findings.
- Responsive render inspection passed at 1440×900, 960×900, 390×844, and 320×800.

## Threat Review

- Canonical route matching remains the only source for active navigation and locale destinations; unmatched paths fail to localized Home.
- The marketing artifact remains checksum-admitted, source-bound, locale-matched, and unmodified; raw scenario, viewport, commit, and checksum detail stays inside invoked provenance.
- Critical copy, navigation, and actions render before hero media and retain intrinsic media geometry.
- No endpoint, authentication path, schema, file-access boundary, external script, dependency, or distribution authority was added.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness

- Plan 03-56 can build the next public movement on the same branded shell and compatibility-first hierarchy.
- Plan 03-61 can consume the deterministic geometry hooks for exact browser-level accessibility and fold proof.
- Human qualitative approval remains pending and was not inferred from deterministic stability.

## Self-Check: PASSED

- All six plan-owned implementation files and this summary exist on disk.
- RED/GREEN commits `4b381f5`, `e601da9`, `ee34bc2`, and `e5f3a81`, plus owner-correction commit `bc2d32b`, resolve in Git history.

---

_Phase: 03-complete-web-experience_
_Completed: 2026-08-01_
