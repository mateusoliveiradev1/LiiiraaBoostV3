---
phase: 03-complete-web-experience
plan: '60'
subsystem: admin-ui
tags: [react, responsive-table, accessibility, consent, audit, xstate, tdd]

requires:
  - phase: 03-complete-web-experience
    provides: Cobalt product vocabulary, isolated admin shell, closed role admission, and guarded preview authority from Plans 03-54 and 03-59
provides:
  - Explicit role-specific focal decisions in an exact 8/4 administrative workspace
  - Dense responsive task queues and immutable audit rows with progressive detail
  - Localized human audit presentation with exact consent and no-change provenance
  - Semantic removal of high-risk admin authority below the 960px desktop boundary
affects: [03-61-browser-proof, admin-visual-evidence, admin-accessibility, admin-security]

tech-stack:
  added: []
  patterns:
    - Closed role-to-focal-route projection with E2 decision and E1 context regions
    - Transport-to-human audit projection before ordinary UI rendering
    - Presentation-level mobile authority omission backed by workflow viewport rejection

key-files:
  created: []
  modified:
    - apps/admin/src/features/admin-preview.tsx
    - apps/admin/src/features/admin-preview.test.tsx
    - apps/admin/src/app/admin-shell.css

key-decisions:
  - 'Give support, operations, security, and audit an explicit focal route instead of inferring the next task from route order.'
  - 'Keep immutable raw audit values inside validated records while projecting action, role, and result into localized human copy at render time.'
  - 'Omit critical admin and diagnostic controls from mobile DOM semantics below 960px while retaining safe review and unavailable-authority explanation.'

patterns-established:
  - 'Role landing composition uses one exact 8/4 focal/context region followed by a full-width responsive queue.'
  - 'Event identity remains the essential reflow column while complete immutable audit detail stays available through row disclosure.'

requirements-completed: [WEB-08]

duration: 11min
completed: 2026-08-01
status: complete
---

# Phase 03 Plan 60: Focal Admin Decision Workspaces Summary

**Role-specific 8/4 operator workspaces with responsive queues, localized audit evidence, exact consent scope, and semantically absent mobile high-risk authority**

## Performance

- **Duration:** 11 min
- **Started:** 2026-08-01T18:08:11Z
- **Completed:** 2026-08-01T18:19:10Z
- **Tasks:** 2
- **Files modified:** 3

## Accomplishments

- Assigned each admitted admin role a distinct next decision and composed it as a decisive E2 focal region beside calm E1 role/status context.
- Replaced the plain role queue with a dense responsive table that retains task identity and exposes complete row detail without clipped mobile columns or generic card reflow.
- Translated audit action, role, result, and diagnostic readiness into localized human meaning while preserving validated immutable transport records, redacted targets, consent references, timestamps, and correlations.
- Kept safe mobile review and no-authority explanation available while removing critical administrative and diagnostic controls from DOM semantics below 960px.

## Task Commits

Each TDD task was committed through RED then GREEN:

1. **Task 1: Compose role-specific focal decision workspaces**
   - `2ec675b` — RED role, density, geometry, reflow, and localization contracts
   - `8ef2006` — GREEN 8/4 role workspaces and responsive human audit presentation
2. **Task 2: Keep consent, audit, and high-risk authority fail closed**
   - `981c424` — RED mobile semantics, audit detail, and workflow-policy contracts
   - `f2eb53c` — GREEN semantic viewport gate with preserved consent and no-change evidence

## Files Created/Modified

- `apps/admin/src/features/admin-preview.tsx` — Explicit role focal projection, responsive queues, localized audit presentation, and semantic high-risk viewport gating.
- `apps/admin/src/features/admin-preview.test.tsx` — Role, geometry, density, consent, audit completeness, workflow policy, and mobile authority tests.
- `apps/admin/src/app/admin-shell.css` — Exact 8/4 composition, E2/E1 hierarchy, full lower-workspace density, progressive row detail, reflow, and existing forced-color/reduced-motion support.

## Decisions Made

- Used a closed `ADMIN_ROLE_FOCAL_ROUTE` record so role priority is authored and reviewable rather than an incidental consequence of route-array order.
- Kept machine evidence immutable and technically exact, but required a fail-closed localized presentation function before action, role, or result reaches ordinary chrome.
- Enforced the 960px boundary twice: React omits high-risk controls from mobile semantics, while the existing CSS and workflow policy remain defense in depth.
- Reused the established `ResponsiveDataTable` and Cobalt materials instead of adding a parallel component vocabulary, new token, or card wall.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Test bug] Corrected the responsive-table selector to the canonical shared class**

- **Found during:** Task 1 GREEN
- **Issue:** The initial RED assertion named a non-existent `.lb-responsive-table` class instead of the established `.lb-web-table-region` emitted by `ResponsiveDataTable`.
- **Fix:** Bound the geometry assertion to the actual public component contract without weakening the responsive-detail requirement.
- **Files modified:** `apps/admin/src/features/admin-preview.test.tsx`
- **Verification:** Filtered role/workspace/queue/audit/table suite passed 14/14.
- **Committed in:** `8ef2006`

---

**Total deviations:** 1 auto-fixed (1 Rule 1 test bug)
**Impact on plan:** The correction aligned the test with the existing shared component contract; scope, security, and visual requirements were unchanged.

## Issues Encountered

- Direct runtime importing of the client TSX composition was incompatible with this package's Vitest `jsx: preserve` transform path. Task 2 retained executable policy and authority tests while using source-contract assertions for responsive DOM composition, matching the established suite pattern.
- A strict TypeScript check required an explicit fail-closed fallback for an unknown audit role string before localized projection; unknown roles now display localized unavailable authority instead of becoming raw UI.

## TDD Gate Compliance

- Task 1 RED `2ec675b` failed on the three planned missing workspace contracts before GREEN `8ef2006` passed the filtered 14-test gate and TypeScript check.
- Task 2 RED `981c424` failed on semantic mobile authority presence before GREEN `f2eb53c` passed all 23 preview tests and TypeScript check.
- Both RED commits precede their corresponding GREEN commits.

## Known Stubs

None. The modified files contain no TODO/FIXME, placeholder UI, empty data wiring, or goal-blocking provisional behavior. Null workflow state and empty safe-draft defaults are intentional closed state-machine inputs.

## Verification

- `rtk pnpm --filter @liiiraa/admin exec vitest run src/features/admin-preview.test.tsx -t "role|workspace|queue|audit|table"` — 14/14 selected tests passed.
- `rtk pnpm --filter @liiiraa/admin exec vitest run src/features/admin-preview.test.tsx` — 23/23 tests passed.
- `rtk pnpm --filter @liiiraa/admin exec vitest run` — 55/55 admin tests passed.
- `rtk pnpm --filter @liiiraa/web-evidence exec vitest run src/security-boundaries.test.ts` — 8/8 security tests passed.
- `rtk pnpm --filter @liiiraa/admin run check` — strict TypeScript passed.
- `rtk pnpm --filter @liiiraa/admin run build` — optimized Next.js production build passed.
- Impeccable detector on the modified admin TSX/CSS — zero findings.

## Acceptance Criteria

- **PASS — Every role has a credible next decision and useful operational density:** exact support, operations, security, and audit focal routes plus a full-width assigned queue are asserted.
- **PASS — Tables and timelines reflow semantically:** event/task identity remains essential and full row details remain available through native disclosure.
- **PASS — No raw fixture status or invented metric appears:** audit and diagnostic status values are localized; deterministic identifiers remain only as technical evidence.
- **PASS — Consent, audit, and high-risk contracts remain complete:** purpose, exact fields, expiration, actor, immutable reference, impact, reauthentication policy, confirmation, redaction, correlation, and no-change receipt gates pass.
- **PASS — Mobile semantics exclude high-risk controls:** React omits the control below 960px and the workflow plus CSS retain fail-closed defense in depth.

## Threat Review

- **T-03-60-01 Elevation of Privilege:** mitigated by the closed role matrix, explicit role focal routes, disconnected authority, semantic mobile omission, and workflow desktop gate.
- **T-03-60-02 Information Disclosure:** mitigated by exact consent purpose/field/expiration/actor/audit matching, redacted targets, and bounded progressive detail.
- **T-03-60-03 Repudiation:** mitigated by immutable validated actor, role, localized action, redacted target, reason, consent, time, result, correlation, and receipt evidence.
- No new endpoint, authentication path, file-access boundary, schema, dependency, or external runtime surface was introduced.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness

- Plan 03-61 can capture admin wide, mobile, reflow, forced-colors, focus, and qualitative browser evidence against the finished operator workspaces.
- Human visual approval remains pending and was not inferred from automated checks.

## Self-Check: PASSED

- All three modified implementation/test files and this summary exist on disk.
- TDD commits `2ec675b`, `8ef2006`, `981c424`, and `f2eb53c` resolve in Git history.

---

_Phase: 03-complete-web-experience_
_Completed: 2026-08-01_
