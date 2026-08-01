---
phase: 03-complete-web-experience
plan: "49"
subsystem: public-web-ui
tags: [nextjs, react, navigation, localization, accessibility, responsive-design]

requires:
  - phase: 03-48
    provides: canonical route resolver and accessible LocaleSwitcher
  - phase: 03-38
    provides: admitted deterministic desktop capture and canonical public tokens
provides:
  - Route-aware public task navigation with one active pillar
  - Route-preserving visible flag-plus-language locale switching
  - Compact native mobile navigation disclosure below 960px
  - Artifact-led Home with contextual evidence and fail-closed distribution
affects: [03-50, 03-52, public-visual-evidence, public-uat]

tech-stack:
  added: []
  patterns: [canonical pathname projection, server-shell/client-navigation split, disclosure-first evidence]

key-files:
  created:
    - apps/web/src/public-navigation.tsx
  modified:
    - apps/web/src/app/[locale]/layout.tsx
    - apps/web/src/app/public-shell.css
    - apps/web/src/public-shell.test.ts
    - apps/web/src/features/home.tsx
    - apps/web/src/styles/public.css
    - apps/web/src/home.test.tsx

key-decisions:
  - "Project active public pillars and locale destinations only after canonical route matching; unmatched paths fail back to the target-locale Home."
  - "Keep public chrome server-owned while isolating pathname awareness in one narrow client navigation component."
  - "Use one primary compatibility action and keep screenshot/evidence metadata behind native disclosures."

patterns-established:
  - "Public route orientation: docs and release descendants project to their task pillar while exact product pillars remain direct."
  - "Public proof hierarchy: visitor decision first, real artifact dominant wide, inspectable provenance secondary."

requirements-completed: [WEB-01, WEB-02, WEB-03, WEB-08]

duration: 13min
completed: 2026-08-01
status: complete
---

# Phase 3 Plan 49: Public Shell and Artifact-Led Home Summary

**Canonical task navigation and a 5/7 real-product Home now present Liiiraa Boost as one bilingual, evidence-led public application.**

## Performance

- **Duration:** 13 min
- **Started:** 2026-08-01T04:49:00Z
- **Completed:** 2026-08-01T05:02:22Z
- **Tasks:** 2
- **Files modified:** 10

## Accomplishments

- Added six canonical public task pillars with exactly one current route across desktop and mobile projections.
- Preserved documentation, release, search, and public-content paths while switching through visible 🇧🇷 Português / 🇺🇸 English controls.
- Rebuilt Home around the approved Prepare/Prove/Restore promise and admitted desktop capture, with semantic copy-first mobile order and wide artifact dominance.
- Replaced always-open implementation metadata with contextual evidence disclosures while retaining full screenshot access and fail-closed distribution.

## Task Commits

Each task was committed atomically:

1. **Task 1 RED: define public shell navigation behavior** - `27ef513` (test)
2. **Task 1 GREEN: author route-aware public shell** - `b1ac1fc` (feat)
3. **Task 2 RED: define artifact-led Home narrative** - `eab7c18` (test)
4. **Task 2 GREEN: recompose Home around real product proof** - `0e0819b` (feat)

## Files Created/Modified

- `apps/web/src/public-navigation.tsx` - Canonical active-route projection, locale state, desktop navigation, and mobile disclosure.
- `apps/web/src/app/[locale]/layout.tsx` - Server-owned locale validation, metadata, product lockup, and static public shell composition.
- `apps/web/src/app/public-shell.css` - Active route cues, 44px controls, compact responsive disclosure, forced-colors, and reduced-motion behavior.
- `apps/web/src/public-shell.test.ts` - Route projection, locale preservation, accessibility, and responsive shell contracts.
- `apps/web/src/features/home.tsx` - Command Runway, real product gate, three-step proof sequence, compatibility bridge, and distribution gate.
- `apps/web/src/styles/public.css` - Canonical 5/7 artifact hierarchy, authored evidence rhythm, responsive reflow, and disclosure styling.
- `apps/web/src/home.test.tsx` - Approved promise, semantic order, artifact dominance, disclosure, structure, and distribution assertions.
- `apps/web/src/content/public/home.en.json` - Correct approved English Prepare/Prove/Restore promise.
- `apps/web/src/home-content.test.ts` - English promise contract aligned with the approved UI specification.
- `.planning/debug/phase-03-public-visual-polish.md` - Public visual root cause marked resolved by Plan 03-49 implementation and verification.

## Decisions Made

- Canonical route matching is the only authority for current-route state or localized route preservation; arbitrary pathname state is never copied.
- Native anchors and `<details>` preserve browser, keyboard, reduced-motion, and no-JavaScript behavior without introducing another interaction dependency.
- The Home has one primary compatibility action. Evidence and the release gate remain secondary, explicit, and non-authoritative.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Corrected stale English promise coverage**
- **Found during:** Task 2 GREEN verification
- **Issue:** `home-content.test.ts` encoded the superseded English phrase and contradicted the exact approved UI-SPEC counterpart required by Plan 03-49.
- **Fix:** Updated the localized content title/promise and its contract assertion to “Prepare your PC. Prove the result. Restore with control.”
- **Files modified:** `apps/web/src/content/public/home.en.json`, `apps/web/src/home-content.test.ts`
- **Verification:** Focused Home/content tests and the complete public suite pass.
- **Committed in:** `0e0819b`

---

**Total deviations:** 1 auto-fixed (1 bug)
**Impact on plan:** The fix aligns existing content coverage with the locked bilingual acceptance criterion; no scope expansion.

## Issues Encountered

None.

## Known Stubs

None. The unavailable installer state is an intentional fail-closed product boundary, not a placeholder.

## Threat Review

- Canonical matching prevents arbitrary pathname preservation in navigation or locale links.
- Only the admitted checksum-verified desktop capture is rendered as product proof.
- No executable artifact URL or development installer path was introduced.
- No unplanned network endpoint, authentication path, file boundary, or schema trust surface was added.

## User Setup Required

None - no external service configuration required.

## Verification

- `rtk pnpm --filter @liiiraa/web test -- --run` — PASS, 60 tests
- `rtk pnpm --filter @liiiraa/web check` — PASS
- `rtk pnpm --filter @liiiraa/web build` — PASS
- Impeccable detector on modified public interface files — PASS, no findings

## Next Phase Readiness

The public shell and Home are ready for the remaining visual evidence refresh and named human UAT. Account and admin redesign remain isolated to their owning plans.

## Self-Check: PASSED

All key implementation, debug, and summary files exist. Commits `27ef513`, `b1ac1fc`, `eab7c18`, and `0e0819b` are present in repository history.

---
*Phase: 03-complete-web-experience*
*Completed: 2026-08-01*
