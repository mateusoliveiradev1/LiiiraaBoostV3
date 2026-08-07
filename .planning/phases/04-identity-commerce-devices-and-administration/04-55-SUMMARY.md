---
phase: 04-identity-commerce-devices-and-administration
plan: '55'
subsystem: admin-ui
tags: [admin, overview, briefing, authority, accessibility, responsive, storybook, tdd]
requires:
  - phase: 04-62
    provides: Typed production Admin authority and responsive seven-domain shell
provides:
  - Deterministic authority-preserving projection for prioritized operational work
  - Calm Briefing overview backed by real Admin briefing, approval, job, incident, and capacity queries
  - Explicit loading, first-use, empty, live, reconnecting, stale, degraded, and error states
  - Responsive and accessible PT-BR and English Storybook evidence through 320px and 200-percent text
affects: [04-61, admin-overview, admin-navigation, ui-verification]
tech-stack:
  added: []
  patterns:
    [
      authority-preserving-links,
      deterministic-priority-ledger,
      selective-capability-degradation,
      invalidation-until-authoritative-refetch,
      unavailable-not-fabricated-metrics,
    ]
key-files:
  created:
    - apps/admin/src/features/admin-overview-model.ts
    - apps/admin/src/features/admin-overview-model.test.ts
    - apps/admin/src/features/admin-overview.tsx
    - apps/admin/src/features/admin-overview.module.css
    - apps/admin/src/features/admin-overview.stories.tsx
  modified:
    - apps/admin/src/features/admin-authority.tsx
key-decisions:
  - 'Overview orders authorized work by severity, operational deadline, assignment, and stable record identity without inventing hidden priority data.'
  - 'Operational links preserve locale, active function, view, cursor, record ID, and version while never serializing role authority into the URL.'
  - 'Live invalidation marks projected data stale until an authoritative HTTP refetch succeeds; reconnecting remains visually distinct.'
  - 'Capability degradation removes only affected actions and keeps trustworthy marked reads and unrelated actions available.'
requirements-completed: [WEB-06, WEB-07]
duration: 18 min
completed: 2026-08-07
status: complete
---

# Phase 04 Plan 55: Calm Operational Briefing Summary

**The first Admin screen is now a truthful operational briefing that leads with authorized work, preserves context and record authority, and never fabricates business metrics**

## Performance

- **Duration:** 18 min
- **Started:** 2026-08-07T03:07:00-03:00
- **Completed:** 2026-08-07T03:25:00-03:00
- **Tasks:** 2
- **Files modified:** 6

## Accomplishments

- Added a pure briefing projection that deterministically orders authorized work by severity, deadline, assignment, and stable ID while preserving owner, substitute, escalation, record version, active function, locale, cursor, and view context.
- Made missing measurements explicitly unavailable and invalidated data stale until authoritative refetch, with no zero fallback, fake trend, or hidden-count inference.
- Applied selective capability degradation so only affected actions disappear while trustworthy marked reads and unrelated operations remain available.
- Replaced the placeholder Admin overview with a quiet operational ledger sourced through `useAdminAuthority` from real briefing, approvals, jobs, incidents, governance, and capacity authority.
- Added semantic loading, first-use, empty, live, reconnecting, stale, degraded, and error compositions in PT-BR and English without a KPI-card wall or decorative chart.
- Added responsive behavior and deterministic Storybook evidence for desktop, tablet, mobile, 320px, 200% text, forced colors, reduced motion, long content, and capability-specific degradation.

## Task Commits

1. **Task 04-55-01: Project authorized briefing priorities**
   - `8832854` — failing briefing projection tests establishing the RED gate
   - `e196df9` — authority-preserving deterministic briefing projection
2. **Task 04-55-02: Render the Briefing Focus overview**
   - `0f4293f` — real Calm Briefing composition, states, styles, stories, and governance query

## Decisions Made

- Route state may carry opaque record identity, version, locale, function, view, and cursor, but never a role parameter or client-inferred authorization.
- Queue work stays ahead of operational context on every viewport so the briefing answers what needs attention before presenting supporting conditions.
- Reconnecting and stale are separate states: reconnecting communicates transport recovery, while stale communicates that displayed truth awaits authoritative refresh.
- Capacity context is rendered only when the API provides meaningful values; missing queue counts and worker metrics remain unavailable instead of falling back to zero.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Corrected invalid browser date formatting options**

- **Found during:** Storybook runtime verification
- **Issue:** `Intl.DateTimeFormat` combined `dateStyle` with explicit hour options and threw in the browser.
- **Fix:** Replaced the incompatible option combination with an explicit valid date/time format.
- **Verification:** All four Playwright visual/runtime axes completed without browser exceptions.
- **Committed in:** `0f4293f`

**2. [Rule 1 - Bug] Restored action-first mobile reading order**

- **Found during:** 320px browser verification
- **Issue:** Supporting operational context appeared before the next-action ledger on narrow viewports.
- **Fix:** Adjusted responsive layout ordering so prioritized work remains first.
- **Verification:** Mobile and 200% text browser witnesses show actions before context with no overflow.
- **Committed in:** `0f4293f`

**3. [Rule 1 - Bug] Prevented narrow metadata compression and fabricated capacity zeroes**

- **Found during:** 320px and data-truthfulness review
- **Issue:** Long metadata compressed badly and `queuedCount ?? 0` could present an unavailable measurement as a real zero.
- **Fix:** Added narrow wrapping/layout rules and preserved the unavailable state when capacity metrics are absent.
- **Verification:** `innerWidth` and `scrollWidth` both remain 320; projection tests cover unavailable values.
- **Committed in:** `0f4293f`

**4. [Rule 2 - Missing Critical] Distinguished reconnecting from stale**

- **Found during:** Required state-matrix review
- **Issue:** Reconnecting had no distinct visible presentation from stale data.
- **Fix:** Added explicit reconnecting status treatment while retaining stale-until-refetch semantics.
- **Verification:** Storybook/runtime state coverage and overview tests pass.
- **Committed in:** `0f4293f`

---

**Total deviations:** 4 auto-fixed runtime, responsive, truthfulness, and state-communication issues. **Impact:** Stronger adherence to the approved Calm Briefing contract without production scope expansion.

## Browser Runtime Verification

- Desktop live: `actions=7`, `innerWidth=1440`, `mainVisible=true`, `scrollWidth=1440`.
- Mobile 320px: `actions=6`, `innerWidth=320`, `mainVisible=true`, `scrollWidth=320`.
- Mobile 320px at 200% text: `actions=7`, `innerWidth=320`, `mainVisible=true`, `scrollWidth=320`.
- Selective degradation kept `invitation.delivery` visible and preserved an unrelated available action.

## Issues Encountered

- Storybook retains its testing-catalog chunk-size warning; the catalog is isolated from the deployable Admin bundle.
- No Docker, production fixture import, remote mutation, or fabricated operational metric was used.

## User Setup Required

None.

## Next Phase Readiness

- Plan 04-56 can reuse the typed authority, stable responsive shell, and briefing visual vocabulary to build the dense Queue Canvas.
- Plan 04-61 can register the completed overview as the real Visão geral workspace and include it in the final responsive/accessibility matrix.

## Self-Check: PASSED

- Overview model: 5/5.
- Overview plus Admin authority: 13/13.
- Admin TypeScript: passed.
- ESLint: passed.
- Prettier and `git diff --check`: passed.
- Admin Storybook static build: passed.
- Playwright visual/runtime verification: 4/4.
- Production fixture import boundary: passed.

---

_Phase: 04-identity-commerce-devices-and-administration_
_Completed: 2026-08-07_
