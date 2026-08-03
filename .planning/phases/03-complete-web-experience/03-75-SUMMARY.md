---
phase: 03-complete-web-experience
plan: "75"
subsystem: admin-ui
tags: [nextjs, react, role-scoped-search, operational-queue, accessibility, i18n]

requires:
  - phase: 03-72
    provides: Final isolated admin shell, role admission, locale routing, and visual contract
provides:
  - Role-scoped global admin search with closed URL-state projection
  - One deterministic D-105 operational queue with saved views and bounded filters
  - Localized redacted row detail and complete queue degradation states
affects: [03-76-admin-detail, phase-04-rbac-authority, admin-operations]

tech-stack:
  added: []
  patterns:
    - Role admission occurs before search, filtering, sorting, or rendering
    - Queue state crosses navigation only through closed allowlisted URL projection
    - Dense semantic tables retain one contextual selection without losing queue context

key-files:
  created: []
  modified:
    - apps/admin/src/app/[locale]/layout.tsx
    - apps/admin/src/admin-navigation.tsx
    - apps/admin/src/admin-preview-model.ts
    - apps/admin/src/features/admin-preview.tsx
    - apps/admin/src/app/admin-shell.css
    - apps/admin/src/content/admin.pt-BR.json
    - apps/admin/src/content/admin.en.json
    - apps/admin/src/features/admin-preview.test.tsx
    - apps/admin/src/admin-shell.test.ts

key-decisions:
  - "Filter the deterministic queue by the server-validated role before any query comparison so denied records never enter the searchable projection."
  - "Preserve only query, saved view, bounded filters, and a validated selection across same-origin locale and workspace navigation."
  - "Keep ISO timestamps and correlation identifiers in existing audit detail while ordinary triage uses localized age, SLA, and last-event copy."

patterns-established:
  - "Admin queue projection: role admission -> bounded search -> saved view -> filters -> deterministic priority/SLA/age sort."
  - "Queue selection: one validated row identifier opens redacted context while preserving the current query and filters."

requirements-completed: [WEB-08]

duration: 14min
completed: 2026-08-03
status: complete
---

# Phase 03 Plan 75: Role-Scoped Operational Queue Summary

**Admin now opens on a role-filtered operational queue with bounded global search, deterministic triage fields, saved views, localized events, and redacted contextual selection.**

## Performance

- **Duration:** 14 min
- **Started:** 2026-08-03T08:17:00Z
- **Completed:** 2026-08-03T08:31:17Z
- **Tasks:** 2
- **Files modified:** 9

## Accomplishments

- Replaced the role-explanation-first landing with one dense operational queue exposing priority, SLA, human age, owner, localized last event, and status.
- Added global search, current saved view, SLA alert count, and operator role to the isolated shell while retaining safe locale and role projection.
- Enforced role-first record admission, bounded search input, redacted targets, closed saved views/filters, and fail-closed selection.
- Added loading skeleton, empty guidance, stale, offline, and partial-failure presentations without exposing denied rows or inventing authority.
- Preserved the dedicated admin origin, noindex metadata, protected operator context, forced colors, reduced motion, keyboard focus, and responsive row disclosure.

## Task Commits

1. **TDD RED: role-scoped search and queue contracts** - `e42750a` (test)
2. **Task 1: Put role-scoped global search in the operator shell** - `d67dece` (feat)
3. **Task 1 follow-up: require explicit bounded search queries** - `03822b9` (fix)
4. **Task 2: Build one operational queue with filters and saved views** - `35d8e25` (feat)

## Files Created/Modified

- `apps/admin/src/app/[locale]/layout.tsx` - Supplies localized operational-search shell labels while retaining server-owned role admission.
- `apps/admin/src/admin-navigation.tsx` - Renders bounded global search, saved-view context, SLA alerts, identity/role, and safe navigation projection.
- `apps/admin/src/admin-preview-model.ts` - Owns the closed queue catalog, role-first search, saved views, filters, deterministic sort, and URL-state admission.
- `apps/admin/src/features/admin-preview.tsx` - Renders the semantic D-105 queue, filters, row disclosure, contextual selection, and queue states.
- `apps/admin/src/app/admin-shell.css` - Implements the restrained dense-operations composition, responsive controls, focus, reduced-motion, and forced-color treatment.
- `apps/admin/src/content/admin.pt-BR.json` - Adds complete PT-BR queue, filter, selection, and state copy.
- `apps/admin/src/content/admin.en.json` - Adds complete English queue, filter, selection, and state copy.
- `apps/admin/src/features/admin-preview.test.tsx` - Proves deterministic queue fields, filters, selection, states, and localized rendering contracts.
- `apps/admin/src/admin-shell.test.ts` - Proves role-first search, closed URL projection, locale preservation, and shell content.

## Decisions Made

- Search receives only the already role-admitted record set; a query can never be used to probe another role's identifiers, targets, audit events, or diagnostics.
- Unsafe or oversized query input produces no search result, while unknown saved-view/filter/selection values fall back to closed defaults.
- Ordinary queue rows expose only localized, redacted operational data. Existing audit detail remains the sole place for raw ISO and correlation evidence.
- Standard native forms, selects, anchors, semantic table disclosure, and sticky contextual detail keep the interface familiar and keyboard-operable under the Impeccable product register.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] Made bounded global-search query input explicit**

- **Found during:** Task 2 strict TypeScript verification
- **Issue:** Reusing an optional queue-projection field made the public search helper accept `undefined`, preventing strict compilation.
- **Fix:** Defined the search boundary with a required string query and retained fail-closed admission inside the helper.
- **Files modified:** `apps/admin/src/admin-preview-model.ts`
- **Verification:** Strict TypeScript check and all 67 admin tests pass.
- **Committed in:** `03822b9`

---

**Total deviations:** 1 auto-fixed (1 blocking type-boundary issue)
**Impact on plan:** The fix tightened, rather than broadened, the search trust boundary.

## Issues Encountered

- RTK returned from the production build while the child process completed in the background. Completion was verified by the emitted `.next/BUILD_ID`, finished static-generation diagnostics, and absence of the build lock/process.

## Verification

- Focused Task 1 command: 33 passed, 18 skipped, zero failures.
- Focused Task 2 command: 5 passed, 26 skipped, zero failures.
- Full admin suite: 67/67 tests passed.
- Strict admin TypeScript: passed.
- Admin production Next.js build: passed; fresh `BUILD_ID` emitted and build lock cleared.
- `git diff --check`: passed.
- Stub scan: no goal-blocking stubs introduced; existing workflow null/empty defaults remain intentional safety-state representations.

## User Setup Required

None. Real RBAC, diagnostics authority, administrative mutation, and remote state remain explicitly outside Phase 3.

## Next Phase Readiness

- The role-scoped queue can feed the next admin detail and action plans without changing the origin, admission, or authority boundaries.
- Phase 4 can replace deterministic records behind the same role-first projection only after its RBAC and administrative authority security gates pass.

## Self-Check: PASSED

---
*Phase: 03-complete-web-experience*
*Completed: 2026-08-03*
