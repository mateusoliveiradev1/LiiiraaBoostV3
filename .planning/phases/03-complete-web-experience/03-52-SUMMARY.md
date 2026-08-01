---
phase: 03-complete-web-experience
plan: '52'
subsystem: web-evidence
tags: [playwright, visual-regression, accessibility, csp, i18n, responsive-navigation]
requires:
  - phase: 03-47
    provides: Exact development-only CSP allowance with strict production and denied-origin policies
  - phase: 03-49
    provides: Redesigned public brand shell and artifact-led visitor hierarchy
  - phase: 03-50
    provides: Premium account shell with compact current-task mobile navigation
  - phase: 03-51
    provides: Role-aware admin shell and decision-first operational workspaces
provides:
  - Exact Plan 03-52-owned W01-W18/G01-G07 qualitative review contract
  - Browser proof for active navigation, route-preserving locale switching, compact mobile disclosure, and development CSP behavior
  - Twenty-five current-source, neutral-focus, visually inspected public/account/admin goldens
affects: [03-45, 03-46, phase-03-human-review, web-publication-gate]
tech-stack:
  added: []
  patterns:
    - Canonical route and locale behavior proven in executable per-surface browser projects
    - Controlled visual update followed by complete no-update replay and manual Impeccable inspection
key-files:
  created: []
  modified:
    - tooling/web-evidence/visual-manifest.json
    - tooling/web-evidence/tests/accessibility-responsive.spec.ts
    - tooling/web-evidence/tests/public.spec.ts
    - tooling/web-evidence/tests/account.spec.ts
    - tooling/web-evidence/tests/admin.spec.ts
    - tooling/web-evidence/tests/__screenshots__/accessibility-responsive.spec.ts/
    - apps/web/src/public-navigation.tsx
    - apps/web/src/features/documentation.tsx
    - apps/web/src/styles/public.css
    - quality/evidence/phase-03/web/route-reachability.json
key-decisions:
  - 'Treat all 25 regenerated goldens as qualitative review inputs owned by Plan 03-52; Plan 03-45 retains human approval and Plan 03-46 retains publication authority.'
  - 'Preserve canonical route identity during locale changes and retain only already validated admin role context; unmatched browser state fails back to a safe localized route.'
  - 'Keep the React/Turbopack unsafe-eval allowance development-only while exact browser console checks and production CSP suites independently enforce the boundary.'
  - 'Regenerate route reachability only through the canonical Plan 03-35 writer so source hashes and bounded observations remain authoritative.'
patterns-established:
  - 'Visual evidence closure: update once, inspect every image, repair source defects, then replay the complete matrix without update mode.'
  - 'Mobile application navigation: one current-context disclosure replaces stacked account/admin route inventories below the shell breakpoint.'
requirements-completed: [WEB-01, WEB-02, WEB-03, WEB-08]
duration: 47min
completed: 2026-08-01
status: complete
---

# Phase 03 Plan 52: Cross-Surface Evidence Rebaseline Summary

**Executable navigation, locale, CSP, accessibility, and responsive-shell gates with 25 current-source goldens inspected across public, account, and admin surfaces.**

## Performance

- **Duration:** 47 min
- **Started:** 2026-08-01T06:00:19Z
- **Completed:** 2026-08-01T06:46:57Z
- **Tasks:** 3
- **Files modified:** 36

## Accomplishments

- Bound the exact closed W01-W18/G01-G07 visual matrix to Plan 03-52 and strengthened every record with route, locale, viewport, shell, density, and no-authority review purpose without adding approval state.
- Added cross-surface Playwright gates for one active route, visible flag-plus-language controls, route-preserving bilingual switching, compact keyboard-operable mobile navigation, and clean development CSP console behavior.
- Regenerated and individually inspected all 25 captures with Impeccable, repaired the documentation header overlap found in W04/W05, and completed a clean 41-pass no-update matrix replay.
- Preserved separate origins, noindex account/admin surfaces, redaction, deterministic fixtures, admin role limits, fail-closed downloads, and the downstream human/publication gates.

## Task Commits

Each task was committed atomically using the required TDD gates where applicable:

1. **Task 1 RED: bind visual manifest to the second-rejection contract** - `960ec6c` (test)
2. **Task 1 GREEN: strengthen the exact 25-record review contract** - `a7217fa` (test)
3. **Task 2 RED: add browser rejection gates** - `e24653c` (test)
4. **Task 2 GREEN: close navigation, locale, CSP, and mobile-shell defects** - `34c16df` (fix)
5. **Task 3: rebaseline and inspect current web evidence** - `ae713df` (fix)

## Files Created/Modified

- `tooling/web-evidence/visual-manifest.json` - Exact Plan 03-52 ownership and qualitative purpose for all 25 W/G captures.
- `packages/web-features/src/components.test.tsx` - Closed-set and second-rejection manifest assertions.
- `tooling/web-evidence/tests/accessibility-responsive.spec.ts` - Cross-surface navigation, locale, mobile disclosure, CSP-console, accessibility, reflow, and screenshot matrix proof.
- `tooling/web-evidence/tests/public.spec.ts` - Public route safety and canonical reachability observations.
- `tooling/web-evidence/tests/account.spec.ts` - Account origin, no-authority, navigation, and bounded route proof.
- `tooling/web-evidence/tests/admin.spec.ts` - Admin role, origin, redaction, and bounded route proof.
- `apps/web/src/public-navigation.tsx` and `apps/web/src/public-shell.test.ts` - Canonical active-route and route-preserving locale behavior.
- `apps/web/src/features/documentation.tsx` and `apps/web/src/styles/public.css` - Documentation-specific single-column route header that prevents heading/description overlap without changing release headers.
- `tooling/web-evidence/tests/__screenshots__/accessibility-responsive.spec.ts/` - Twelve public, eight account, and five admin current-source PNG goldens.
- `quality/evidence/phase-03/web/route-reachability.json` - Canonically regenerated Plan 03-35 proof with current source hashes and 24 bounded observations.

## Decisions Made

- Kept stable screenshots qualitative rather than authoritative: automation prepares review inputs, while Plan 03-45 still owns named human approval and Plan 03-46 still owns publication promotion.
- Used native anchors with canonical boundary matching for active navigation and locale switching, preserving exact route identity and only server-validated role state.
- Applied one documentation-specific header modifier after visual rejection so shared release-header composition remains unchanged.
- Refreshed stale reachability fingerprints only with the existing canonical writer; no hash or observation was hand-edited.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Repaired documentation route-header overlap**

- **Found during:** Task 3 individual Impeccable inspection of W04/W05
- **Issue:** The shared two-column route header caused documentation titles and descriptions to overlap at the declared 1280px captures.
- **Fix:** Added a documentation-only modifier that uses a single-column header grid while preserving the shared release header.
- **Files modified:** `apps/web/src/features/documentation.tsx`, `apps/web/src/styles/public.css`
- **Verification:** W03/W04/W05 were recaptured; the focused W03/W04/W05/W07/W08 replay passed 5 tests, and the complete no-update matrix passed 41 tests.
- **Committed in:** `ae713df`

**2. [Rule 1 - Blocking Bug] Regenerated stale canonical route-reachability fingerprints**

- **Found during:** Task 3 workspace regression
- **Issue:** Task 2 legitimately changed canonical route/spec sources, leaving the Plan 03-35 proof with stale source hashes and causing two planned-verifier assertions to fail.
- **Fix:** Removed the stale canonical proof temporarily and reran the exact existing Plan 03-35 Playwright writer. The regenerated artifact changed only four source hashes, retained exactly 24 bounded observations, and contains no raw text or PII.
- **Files modified:** `quality/evidence/phase-03/web/route-reachability.json`
- **Verification:** Canonical writer replay passed 5 tests; `verify-phase.ts --mode planned` and the complete workspace regression passed.
- **Committed in:** `ae713df`

**3. [Rule 1 - Bug] Reconciled inconsistent SDK progress projection**

- **Found during:** Final GSD state update
- **Issue:** `state.update-progress` correctly returned 108/110 and 98% but wrote `percent: 20`, retained the visible 97% bar, and left the visible completed-plan total stale.
- **Fix:** Reconciled the frontmatter and visible progress counters with the SDK's own 108/110 result after recording the metric, decisions, and named session fields through the installed handler interface.
- **Files modified:** `.planning/STATE.md`
- **Verification:** STATE now reports 108 completed plans and 98% consistently; ROADMAP reports 50/52 Phase 3 plans complete.
- **Committed in:** Plan metadata commit.

---

**Total deviations:** 3 auto-fixed (3 Rule 1 bugs)
**Impact on plan:** The evidence fixes were required for truthful, inspectable outputs, and the tracking fix restored internal consistency. No approval, publication, or authority scope was introduced.

## Issues Encountered

- The first visual update was correctly rejected rather than accepted on pixel stability because W04/W05 exposed documentation text overlap; source was repaired before the final no-update replay.
- The canonical reachability refresh remained owned by Plan 03-35 and was limited to its existing writer; UAT, visual/accessibility reports, approved bundles, and publication state were not touched.

## Validation Results

- Manifest contract suite - PASS, 6 passed and 6 skipped.
- Focused navigation/locale/CSP/reflow browser suite - PASS, 13 passed and 145 skipped.
- Focused post-repair visual replay - PASS, 5 passed and 40 skipped.
- Complete no-update accessibility/responsive matrix - PASS, 41 passed and 328 skipped.
- Public CSP suite - PASS, 4 passed and 17 skipped; account CSP suite - PASS, 7 passed; admin CSP suite - PASS, 16 passed.
- `@liiiraa/web`, `@liiiraa/account`, and `@liiiraa/admin` production builds - PASS.
- Canonical route-reachability writer - PASS, 5 passed and 16 skipped; planned verifier - PASS with 24 observations and 18 scenarios.
- Complete workspace regression - PASS, 49/49 Turbo tasks; web-evidence unit suite passed 141 tests with 1 skipped.
- `git diff --check` - PASS.
- Impeccable inspection - PASS after reviewing all 25 captures and repairing the two rejected documentation compositions.

## Known Stubs

None. Empty arrays in the changed tests are assertion accumulators, and the documentation article array is populated from admitted catalog records before rendering; neither is a disconnected or placeholder UI data source.

## Authentication Gates

None.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness

- Plan 03-45 can perform the blocking human review against current, source-bound, visually inspected inputs.
- Plan 03-46 remains blocked from publication promotion until that human approval exists; this plan grants no distribution authority.

## Self-Check: PASSED

- The summary, manifest, browser matrix, representative W/G captures, and canonical reachability proof exist on disk.
- Task commits `960ec6c`, `a7217fa`, `e24653c`, `34c16df`, and `ae713df` exist in git history.

---

_Phase: 03-complete-web-experience_
_Completed: 2026-08-01_
