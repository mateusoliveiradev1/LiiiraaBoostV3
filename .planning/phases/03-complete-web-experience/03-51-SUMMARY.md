---
phase: 03-complete-web-experience
plan: '51'
subsystem: admin-ui
tags: [nextjs, react, accessibility, responsive-navigation, admin, i18n]
requires:
  - phase: 03-48
    provides: Canonical localized-route resolver and shared flag-plus-language switcher
provides:
  - Role-aware admin topbar with exactly one current workspace
  - Compact sub-960px current-task disclosure and validated role-preserving locale switch
  - Decision-first role queues and semantic support, operations, security, diagnostics, and audit workspaces
affects: [03-52, admin-visual-evidence, WEB-08]
tech-stack:
  added: []
  patterns:
    - Canonical route localization with closed server-validated role query retention
    - Semantic assigned queues and progressive audit detail at narrow viewports
key-files:
  created: []
  modified:
    - apps/admin/src/app/[locale]/layout.tsx
    - apps/admin/src/admin-navigation.tsx
    - apps/admin/src/app/admin-shell.css
    - apps/admin/src/admin-shell.test.ts
    - apps/admin/src/features/admin-preview.tsx
    - apps/admin/src/features/admin-preview.test.tsx
    - apps/admin/src/content/admin.pt-BR.json
    - apps/admin/src/content/admin.en.json
    - .planning/debug/phase-03-admin-root-interface.md
key-decisions:
  - 'Keep pathname and role awareness inside one narrow AdminNavigation client boundary while the server layout owns role admission, identity, provenance, and content.'
  - 'Project only the server-validated closed role into localized workspace links; invalid query state never crosses the language boundary.'
  - 'At reflow widths, retain audit event identity as the essential table column and expose complete immutable fields through semantic row disclosure.'
patterns-established:
  - 'Admin orientation: role and current task remain visible in the topbar, with one aria-current desktop task and a compact native mobile disclosure.'
  - 'Decision workspace: consequence context precedes evidence, scoped constraints, unavailable authority, and immutable audit receipt.'
requirements-completed: [WEB-08]
duration: 20min
completed: 2026-08-01
status: complete
---

# Phase 03 Plan 51: Admin Operational Redesign Summary

**Premium role-scoped admin shell with route-preserving bilingual navigation, semantic assigned queues, and decision-first no-authority workspaces across 1440, 390, and 320px.**

## Performance

- **Duration:** 20 min
- **Started:** 2026-08-01T05:32:47Z
- **Completed:** 2026-08-01T05:52:23Z
- **Tasks:** 2
- **Files modified:** 9

## Accomplishments

- Replaced the static admin chrome with a role/current-task topbar, canonical route resolver, shared 🇧🇷 Português / 🇺🇸 English control, and closed-role query retention.
- Replaced the stacked narrow navigation inventory with a native current-role/task disclosure while preserving one desktop `aria-current` workspace and the semantic 960px high-risk gate.
- Rebuilt role landing, security, diagnostics, and audit presentation around assigned decisions, tables, definition groups, progressive detail, consent scope, immutable correlations, and no-change receipts.
- Preserved exact-origin isolation, rejected cross-surface cookie/link authority, redacted targets, disconnected credentials, disabled administrative effects, and `remoteStateChanged=false` terminals.

## Task Commits

Each task was committed atomically using TDD gates:

1. **Task 1 RED: role-aware shell and compact navigation tests** - `062090d` (test)
2. **Task 1 GREEN: role-aware shell and locale switching** - `f2e7100` (feat)
3. **Task 2 RED: semantic decision workspace tests** - `ae89fc2` (test)
4. **Task 2 GREEN: decision-first admin workspaces** - `01529f6` (feat)
5. **Visual QA fix: unique diagnostic decision heading** - `5b9a2a5` (fix)
6. **Visual QA fix: progressive audit table reflow** - `6cad575` (fix)

## Files Created/Modified

- `apps/admin/src/app/[locale]/layout.tsx` - Server-owned product identity, admitted role context, provenance, viewport policy, and client navigation composition.
- `apps/admin/src/admin-navigation.tsx` - Canonical current-route resolution, validated role retention, locale switching, and desktop/mobile navigation.
- `apps/admin/src/app/admin-shell.css` - Restrained operational shell, compact disclosure, semantic queue, decision workbench, and 320px audit reflow.
- `apps/admin/src/admin-shell.test.ts` - TDD coverage for role scope, one current task, mobile disclosure, and accessible language switching.
- `apps/admin/src/features/admin-preview.tsx` - Assigned queue and decision-first support, operations, security, diagnostics, and audit compositions.
- `apps/admin/src/features/admin-preview.test.tsx` - TDD semantic, consent adjacency, authority, and workspace structure coverage.
- `apps/admin/src/content/admin.pt-BR.json` - Authored PT-BR containment decision, evidence, authority, and immutable audit copy.
- `apps/admin/src/content/admin.en.json` - Equivalent English containment decision, evidence, authority, and immutable audit copy.
- `.planning/debug/phase-03-admin-root-interface.md` - Resolved the origin-plus-interface diagnosis with current verification evidence.

## Decisions Made

- Kept all server admission and authority boundaries outside the client navigation component; the client owns only browser pathname/query awareness.
- Preserved a role query only when it agrees with the already validated server role; support remains the fail-closed default with no privileged query invention.
- Used a semantic queue table on role landing and native detail disclosure for narrow audit data instead of repeated dashboard cards or horizontal inventory.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Disambiguated duplicate diagnostic headings**

- **Found during:** Task 2 browser QA at 1440px
- **Issue:** The decision region and consent scope exposed the same accessible heading, causing strict role lookup and landmark ambiguity.
- **Fix:** Added a distinct localized diagnostic decision heading while preserving the consent status heading.
- **Files modified:** `apps/admin/src/features/admin-preview.tsx`
- **Verification:** W15 Playwright wide flow and complete admin unit suite pass.
- **Committed in:** `5b9a2a5`

**2. [Rule 1 - Bug] Collapsed audit evidence at 320px**

- **Found during:** Manual inspection of the 320px audit capture
- **Issue:** Three essential columns made the immutable audit table visually clipped inside its horizontal region.
- **Fix:** Retained event identity as the essential column and moved actor, action, result, and timestamp into the existing complete-row disclosure below 640px.
- **Files modified:** `apps/admin/src/features/admin-preview.tsx`
- **Verification:** W18 320px axe/reflow passes and the recaptured audit route has no clipped columns.
- **Committed in:** `6cad575`

**3. [Rule 1 - Bug] Corrected inconsistent SDK progress projection**

- **Found during:** Final GSD state update
- **Issue:** `state.update-progress` reported 107/110 and 97% in its response but wrote `percent: 20` and left the visible completion counters stale.
- **Fix:** Reconciled the frontmatter and visible progress/activity counters with the SDK's own 107/110 result.
- **Files modified:** `.planning/STATE.md`
- **Verification:** STATE now reports 107 completed plans and 97% consistently.
- **Committed in:** Plan metadata commit.

---

**Total deviations:** 3 auto-fixed (3 Rule 1 bugs)
**Impact on plan:** The UI fixes were required for accessible browser behavior, and the tracking fix restored internally consistent execution state without changing plan scope.

## Issues Encountered

- One manual screenshot attempt used an artifact built for the default `admin.localhost:3002` origin and correctly rendered the fail-closed denial at port 3102. The QA artifact was rebuilt with the exact injected `http://admin.localhost:3102` origin before the final capture; production admission code was unchanged.

## Verification

- `rtk pnpm --filter @liiiraa/admin test -- --run` - PASS, 46/46 tests.
- `rtk pnpm --filter @liiiraa/admin check` - PASS.
- `rtk pnpm --filter @liiiraa/admin build` - PASS.
- `rtk pnpm --filter @liiiraa/admin exec vitest run src/admin-security.test.ts` - PASS, 16/16 tests.
- Impeccable detector over changed admin markup/styles - PASS, zero findings.
- Playwright W14/W15 at 1440 and W16 at 390 - PASS.
- Playwright W18 axe/reflow at 320 - PASS.
- Fresh 1440/390/320 screenshots manually inspected; the final 320 audit recapture confirms progressive detail without clipped columns.

## Known Stubs

None. Workflow `null` states and empty safe-draft defaults are intentional state-machine inputs, not rendered placeholders or disconnected data sources.

## Authentication Gates

None.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness

- Plan 03-52 can regenerate the declared admin visual evidence from the current implementation.
- Human publication approval remains outside this plan; no administrative authority or release permission was introduced.

## Self-Check: PASSED

- All nine modified/tracking files and this summary exist on disk.
- RED, GREEN, and visual QA fix commits `062090d`, `f2e7100`, `ae89fc2`, `01529f6`, `5b9a2a5`, and `6cad575` exist in git history.

---

_Phase: 03-complete-web-experience_
_Completed: 2026-08-01_
