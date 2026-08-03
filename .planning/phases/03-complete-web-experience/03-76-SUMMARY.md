---
phase: 03-complete-web-experience
plan: '76'
subsystem: web-evidence
tags: [playwright, vitest, canonical-routes, accessibility, responsive, i18n, indexing]

requires:
  - phase: 03-73 through 03-80
    provides: Launch-ready public, account, admin, privacy, and zoom-safe route outcomes
provides:
  - Complete canonical route detector across PT-BR/English and 1440/960/390/320 CSS pixels
  - Structural D-102 through D-110 outcome assertions without weakening legacy or security gates
  - Collision-free 464-entry canonical candidate inventory for Plan 03-81
affects: [03-81-visual-validation, web-release-gates, route-governance]

tech-stack:
  added: []
  patterns:
    - Canonical route authority drives browser coverage, locale paths, indexing expectations, and candidate identity
    - Candidate snapshots are mechanically enumerable by dry list before any pixel-writing workflow is authorized

key-files:
  created:
    - .planning/phases/03-complete-web-experience/03-76-SUMMARY.md
  modified:
    - .planning/phases/03-complete-web-experience/03-ROUTE-EXPERIENCE-MATRIX.md
    - tooling/web-evidence/tests/final-route-experience.spec.ts
    - tooling/web-evidence/src/route-manifest.test.ts
    - tooling/web-evidence/src/content-publication.test.ts
    - apps/web/src/app/[locale]/(public)/[[...slug]]/page.tsx
    - apps/web/src/public-navigation.tsx
    - apps/web/src/public-shell.test.ts
    - apps/account/src/app/[locale]/[[...responsibility]]/page.tsx
    - apps/account/src/account-shell.test.ts
    - apps/admin/src/admin-navigation.tsx
    - apps/admin/src/app/admin-shell.css
    - apps/admin/src/admin-shell.test.ts
    - apps/admin/src/features/admin-preview.test.tsx

key-decisions:
  - 'Enumerate coverage from webRoutes and WEB_LOCALES; representative lists remain supplemental, never authoritative.'
  - 'Encode canonical candidate surface, route, locale, width, and state in one collision-checked identity owned by exactly one Playwright project.'
  - 'Project canonical noindex metadata even when an authored error route intentionally has no title or description metadata.'
  - 'Keep missing diagnostic consent fail-closed with no high-risk action; guarded actions are asserted only where the admitted route exposes them.'

patterns-established:
  - 'Complete route matrix: 58 canonical routes multiplied by two locales and four bounded width families.'
  - 'Dry-list candidate ownership: @candidate-capture plus an exact @project-{surface}-final-{axis} token.'

requirements-completed: [WEB-01, WEB-02, WEB-03, WEB-08]

duration: 42min
completed: 2026-08-03
status: complete
---

# Phase 03 Plan 76: Complete Canonical Route Matrix and Candidate Identity Summary

**A canonical-authority-driven browser matrix now proves every public, account, and admin route in both locales at all four required widths, with 464 deterministic candidate identities ready for Plan 03-81 dry-list-controlled capture.**

## Performance

- **Duration:** 42 min
- **Started:** 2026-08-03T09:30:16Z
- **Completed:** 2026-08-03T10:12:00Z
- **Tasks:** 2 TDD tasks
- **Files modified:** 13 implementation/test/planning files, plus this summary

## Accomplishments

- Expanded the route-experience matrix through D-110 and made every canonical route, including About and all authored error families, executable in PT-BR and English at 1440, 960, 390, and 320 CSS pixels.
- Added browser detectors for the complete home sequence, five-goal account navigation, account Home, privacy/consent, admin queue and guarded review, public trust/footer/legal outcomes, origin/CSP/indexing/release boundaries, accessibility, and explicit anti-fabrication classes.
- Preserved W01-W18, G01-G07, origin isolation, CSP, noindex, release fail-closed, keyboard/focus, responsive, forced-color, reduced-motion, and axe gates.
- Generated exactly 464 collision-free `@canonical-candidate` tests: 58 routes × 2 locales × 4 bounded widths, each assigned to exactly one surface/axis project.
- Kept Task 2 strictly non-pixel: only Playwright list mode was executed; no canonical candidate screenshot assertion ran, and no snapshot was updated, reviewed, approved, or published.

## Task Commits

1. **Task 1 RED: failing complete-route and D-102-D-110 contracts** - `b976d0f` (test)
2. **Task 1 GREEN: canonical matrix, detectors, and narrow correctness repairs** - `e712faa` (feat)
3. **Task 2 RED: failing deterministic candidate inventory contract** - `0ad1077` (test)
4. **Task 2 GREEN: 464 collision-free dry-list candidate identities** - `a128a04` (feat)

## Files Created/Modified

- `.planning/phases/03-complete-web-experience/03-ROUTE-EXPERIENCE-MATRIX.md` - Extends the authoritative matrix through D-110 and requires complete locale/width verification.
- `tooling/web-evidence/tests/final-route-experience.spec.ts` - Derives route coverage and candidate identities from canonical authorities and proves all additive outcomes.
- `tooling/web-evidence/src/route-manifest.test.ts` - Enforces complete route coverage and bounded collision-free candidate generation.
- `tooling/web-evidence/src/content-publication.test.ts` - Preserves explicit D-102-D-110 content and anti-fabrication contracts.
- `apps/web/src/app/[locale]/(public)/[[...slug]]/page.tsx` - Projects canonical noindex metadata for search and authored errors without inventing copy metadata.
- `apps/web/src/public-navigation.tsx`, `apps/web/src/public-shell.test.ts` - Maps About to its product pillar and covers the public error metadata boundary.
- `apps/account/src/app/[locale]/[[...responsibility]]/page.tsx`, `apps/account/src/account-shell.test.ts` - Removes duplicate child-owned robots metadata while preserving layout authority.
- `apps/admin/src/admin-navigation.tsx`, `apps/admin/src/app/admin-shell.css` - Adds the mobile search accessible name and safe 960/320 reflow.
- `apps/admin/src/admin-shell.test.ts`, `apps/admin/src/features/admin-preview.test.tsx` - Lock the revised responsive and accessibility contracts.

## Decisions Made

- Canonical records are the only source of route identity and surface ownership. Browser navigation uses explicit localized paths, independent of browser locale.
- Candidate identity is `{surface}--{routeId}--{locale}--{axis}--{state}`. A module-load uniqueness guard fails before listing if any identity collides.
- Error states encode their HTTP family in the candidate identity; ordinary deterministic routes use `ready`.
- Public error routes may intentionally omit title and description copy metadata, but their canonical noindex policy must still reach the rendered head.
- Support is the validated implicit admin role. Diagnostics without exact consent must expose the authored blocked state and no high-risk action.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Restored an active public navigation destination for About**

- **Found during:** Task 1 complete route matrix
- **Issue:** About had no active primary navigation destination.
- **Fix:** Projected About to the canonical product pillar on desktop and mobile.
- **Files modified:** `apps/web/src/public-navigation.tsx`, `apps/web/src/public-shell.test.ts`
- **Committed in:** `e712faa`

**2. [Rule 1 - Bug] Removed duplicate account robots metadata**

- **Found during:** Task 1 account error route verification
- **Issue:** Account error pages emitted both layout-owned and child-owned robots policies.
- **Fix:** Kept the strict layout policy as the single metadata authority.
- **Files modified:** `apps/account/src/app/[locale]/[[...responsibility]]/page.tsx`, `apps/account/src/account-shell.test.ts`
- **Committed in:** `e712faa`

**3. [Rule 1 - Bug] Corrected implicit support role projection**

- **Found during:** Task 1 admin route verification
- **Issue:** The detector expected `?role=support` even though support is the validated implicit/default role.
- **Fix:** Preserved the canonical support URL without a redundant role query and retained explicit queries for other roles.
- **Files modified:** `tooling/web-evidence/tests/final-route-experience.spec.ts`
- **Committed in:** `e712faa`

**4. [Rule 1 - Bug] Closed admin reflow overflow at 960 and 320 CSS pixels**

- **Found during:** Task 1 width matrix
- **Issue:** The admin role workspace exceeded the viewport and the exact 960px boundary retained an unstable desktop grid.
- **Fix:** Compacted the header and filters, extended single-column reflow through 960px, and bounded the narrow header/search layout below 400px.
- **Files modified:** `apps/admin/src/app/admin-shell.css`, `apps/admin/src/admin-shell.test.ts`, `apps/admin/src/features/admin-preview.test.tsx`
- **Committed in:** `e712faa`

**5. [Rule 2 - Missing Critical] Added an accessible name to the mobile admin search action**

- **Found during:** Task 1 axe verification
- **Issue:** The icon-only submit button had no accessible name.
- **Fix:** Applied the localized search action as its `aria-label` and added a regression assertion.
- **Files modified:** `apps/admin/src/admin-navigation.tsx`, `apps/admin/src/admin-shell.test.ts`
- **Committed in:** `e712faa`

**6. [Rule 2 - Missing Critical] Projected canonical noindex metadata independently of optional copy**

- **Found during:** Task 1 indexing verification
- **Issue:** Search and authored public error routes were registered as noindex, but missing optional copy metadata could return before robots projection.
- **Fix:** Carried canonical indexing through route resolution and returned only the robots policy when title/description metadata is intentionally absent; added bilingual 403/404/410/500 coverage.
- **Files modified:** `apps/web/src/app/[locale]/(public)/[[...slug]]/page.tsx`, `apps/web/src/public-shell.test.ts`
- **Committed in:** `e712faa`

---

**Total deviations:** 6 auto-fixed (4 correctness bugs, 2 critical accessibility/indexing gaps)
**Impact on plan:** All fixes were narrow consequences of executing the widened matrix; no route, authority, security, or detector gate was weakened.

## Issues Encountered

- The complete matrix required sequential correction of stale detector assumptions: D-106 intentionally contains five privacy purposes, ordinary support is not a high-risk mutation, and missing diagnostic consent intentionally exposes no guarded action. The final assertions now match existing authored contracts without reducing coverage.

## Deferred Downstream Inputs

The repository-wide Phase 3 verifier remains red because its checked-in closed evidence graph predates the route and decision authority added by this plan. These are expected downstream evidence-refresh inputs owned by Plans 03-81/03-82, not failures of the bounded 03-76 implementation:

- `UNKNOWN_DECISION` for `D-102` through `D-110`.
- `UNKNOWN_ROUTE` for `public-about`.
- `ROUTE_REACHABILITY_CANONICAL_ROUTE_SOURCE_HASH_MISMATCH` at `$.routeReachability.canonicalRouteSourceSha256`.

Plan 03-76 intentionally does not modify verifier constants, route-reachability proof data, snapshots, approvals, or publication evidence. Plans 03-81/03-82 must refresh those artifacts after canonical pixel capture/review and final evidence closure.

## Verification

- Task 1 source contracts: 21/21 passed.
- Public metadata regression: 32/32 passed, including both locales for public 403/404/410/500.
- Exact Task 1 Playwright command: 18 passed, 144 project-selection skips, zero failures.
- Full web suite: 119/119 passed; account: 67/67 passed; admin: 71/71 passed.
- Task 2 candidate source contract: 12/12 passed.
- Exact Task 2 dry list: 464 tests in one file, matching 58 × 2 × 4 with only the 12 authorized surface/width projects.
- Strict TypeScript for web, account, admin, and web-evidence: passed.
- Impeccable structural detector: no findings.
- Prettier and `git diff --check`: passed.
- No canonical candidate screenshot test was executed; no snapshot was updated, inspected, approved, or published.

## Known Stubs

None. The disconnected authority and missing-consent states are intentional, validated Phase 3 boundaries rather than unwired UI.

## TDD Gate Compliance

- Task 1 RED `b976d0f` failed on missing complete route and D-102-D-110 contracts; GREEN `e712faa` passes the exact source and browser gates.
- Task 2 RED `0ad1077` failed because no canonical candidate block existed; GREEN `a128a04` lists exactly 464 bounded candidates.
- No refactor commit was required.

## User Setup Required

None. No dependency, credential, service, or environment change was introduced.

## Next Phase Readiness

- Plan 03-81 can mechanically select the exact 464 canonical candidates with no hidden quick, 1280, 768, text-scale, motion, or forced-color writer.
- Candidate pixels remain unapproved until the explicitly authorized Plan 03-81 capture and review workflow.
- Plans 03-81/03-82 must admit D-102-D-110 and `public-about` into the closed Phase 3 verifier graph and refresh the canonical route source hash after their owned evidence work.

## Self-Check: PASSED

- The summary file exists at the required plan output path.
- Task commits `b976d0f`, `e712faa`, `0ad1077`, and `a128a04` exist in repository history.
- Both exact PLAN.md verification commands are green: Task 1 source/browser gates pass, and Task 2 dry-list enumerates exactly 464 authorized identities.
- The repository-wide evidence staleness is explicitly deferred to Plans 03-81/03-82 and does not block the scoped 03-76 objective.

---

_Phase: 03-complete-web-experience_
_Completed: 2026-08-03_
