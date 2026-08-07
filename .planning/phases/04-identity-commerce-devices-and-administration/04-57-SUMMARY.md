---
phase: 04-identity-commerce-devices-and-administration
plan: '57'
subsystem: admin-ui
tags: [admin, invitations, postgres, contracts, jobs, accessibility, responsive, storybook, tdd]
requires:
  - phase: 04-62
    provides: Typed production Admin authority, generated projections, and invalidation-only live delivery
  - phase: 04-51
    provides: Governed invitation API, acceptance boundary, and durable invitation jobs
provides:
  - Authority-connected private-beta invitation list, capacity, queue, preflight, detail, timeline, retention, and jobs
  - Safe individual and CSV issuance, resend, revoke, conflict, partial-job, and receipt workflows
  - Masked and contract-validated invitation projections backed by real PostgreSQL runtime queries
  - Thirty-three responsive and accessible invitation Storybook states through 320px and 200-percent text
affects: [04-58, 04-61, admin-people, admin-navigation, invitation-operations, ui-verification]
tech-stack:
  added: []
  patterns:
    [
      authority-projected-invitations,
      fail-closed-preflight,
      masked-operational-timeline,
      capacity-and-job-coquery,
      durable-batch-receipts,
      fixture-only-stories,
    ]
key-files:
  created:
    - apps/admin/src/features/admin-invitations.tsx
    - apps/admin/src/features/admin-invitations.module.css
    - apps/admin/src/features/admin-invitations.stories.tsx
  modified:
    - apps/admin/src/features/admin-invitations-model.ts
    - apps/admin/src/admin-authority.ts
    - apps/api/src/modules/admin/invitation-routes.ts
    - apps/api/src/staging/runtime.ts
    - packages/contracts-source/src/control-plane.tsp
key-decisions:
  - 'Invitation list, capacity, and durable jobs are fetched from one canonical Admin authority instead of assembling fixture-backed production state.'
  - 'Preflight is a bounded typed decision result, while persisted invitations, capacity, and jobs remain generated Admin documents.'
  - 'Detail timelines and retention are projected server-side with recipient masking and no raw invitation secret exposure.'
  - 'CSV issuance processes every valid preflight recipient and reports partial outcomes through durable jobs and receipts.'
requirements-completed: [WEB-06, IDEN-01, IDEN-03]
duration: 1h
completed: 2026-08-07
status: complete
---

# Phase 04 Plan 57: Authority-Connected Invitation Operations Summary

**Private-beta invitation creation, preflight, capacity, queue, delivery, resend, revocation, audit, retention, and durable jobs now operate through one typed PostgreSQL-backed Admin authority with no production fixture fallback**

## Performance

- **Duration:** 1h
- **Started:** 2026-08-07T04:07:44-03:00
- **Completed:** 2026-08-07T05:07:52-03:00
- **Tasks:** 2
- **Files modified:** 16

## Accomplishments

- Added a deterministic invitation presentation policy for individual and CSV preflight, 25-slot capacity projection, queue promotion, resend expiry choices, immutable recipients, revoke impact, reminders, conflicts, retention, and partial jobs.
- Built the complete bilingual invitation workspace with official views, responsive table-to-list behavior, capacity and queue statements, individual/CSV review, inspector, masked timeline, retention/legal hold, batch actions, jobs, failures, and receipts.
- Connected every production query and mutation to the typed Admin authority, including real invitation detail, preflight, issue, resend, revoke, batch, capacity, and job projections.
- Corrected the API and generated contracts so real PostgreSQL invitation records validate as complete Admin documents without inventing campaign, owner, expiry, or delivery data.
- Added 33 deterministic Storybook scenarios spanning lifecycle, authority, locale, long content, desktop, tablet, mobile, 320px, 200-percent text, forced colors, and reduced motion.

## Task Commits

1. **Task 04-57-01: Model invitation preflight, capacity, and risk review**
   - `2ad69f1` — failing invitation policy tests establishing the RED gate
   - `534d960` — deterministic invitation safety, retention, conflict, and job model
2. **Task 04-57-02: Compose invitation lists, forms, detail, timeline, and jobs**
   - `fced561` — authority-connected workspace, real API projections, generated contracts, runtime queries, and state stories

## Decisions Made

- Beta invitations and administrative-team invitations remain separate capabilities; the beta workspace links to team governance but never shares actions or authority.
- Production composition accepts only validated no-store server projections. Deterministic records are restricted to Storybook and tests.
- Preflight cannot be mistaken for persisted state: it has its own bounded typed authority result and must be refreshed whenever recipients change.
- Recipient data stays masked in list/detail/timeline projections, and raw invitation secrets are never returned or rendered.
- Batch issuance iterates over all valid preflight recipients and exposes mixed outcomes as partial durable work rather than collapsing them into a false success.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 2 - Missing Critical] Completed the real API-to-Admin invitation projection boundary**

- **Found during:** Task 04-57-02 authority integration
- **Issue:** The existing invitation routes returned domain records that did not satisfy the generated Admin document contract, and capacity/jobs were not supplied from the same runtime authority.
- **Fix:** Added validated invitation, capacity, detail, timeline, retention, preflight, and job projections; wired PostgreSQL capacity/job queries; and regenerated TypeScript, Rust, OpenAPI, and JSON Schema artifacts.
- **Files modified:** `apps/api/src/modules/admin/invitation-routes.ts`, `apps/api/src/staging/runtime.ts`, `apps/admin/src/admin-authority.ts`, and generated contract artifacts.
- **Verification:** API 212/212, contracts TypeScript 71/71, Rust 11 tests, drift and compatibility gates passed.
- **Committed in:** `fced561`

**2. [Rule 1 - Bug] Made CSV issuance preserve every valid preflight recipient**

- **Found during:** Task 04-57-02 workflow verification
- **Issue:** A single-recipient mutation path could not truthfully issue all valid rows from a CSV preflight or report mixed outcomes.
- **Fix:** Executed the bounded valid recipient set, collected each governed result, projected partial completion, refreshed canonical authority, and cleared stale preflight state.
- **Files modified:** `apps/admin/src/features/admin-invitations.tsx`
- **Verification:** Admin invitation tests 17/17, TypeScript, ESLint, Storybook build, and 33-story browser matrix passed.
- **Committed in:** `fced561`

---

**Total deviations:** 2 auto-fixed (1 missing critical, 1 bug). **Impact:** Both fixes were required to satisfy the plan's explicit real-authority and complete-CSV requirements; no production mock or unrelated feature was added.

## Browser Runtime Verification

- State matrix: 33/33 stories loaded with meaningful content and no console error, framework overlay, blank root, or document overflow.
- Desktop live: 1600x1000 rendered the complete invitation ledger, capacity statement, batch review, and durable jobs.
- Tablet and mobile: 1024px and 390px compositions retained equivalent actions and evidence.
- Mobile 320px plus 200-percent text: `viewport=320`, `scrollWidth=320`; content preserved reading order and remained reachable without horizontal page scrolling.
- Reduced motion: the story rendered under `prefers-reduced-motion: reduce` with no runtime failure.
- Forced colors: the Windows high-contrast capture rendered system black text, system links, controls, borders, and focus-visible structure correctly. Axe's color-contrast rule reported original CSS colors against the forced white canvas, a known mismatch with browser color substitution; visual evidence confirmed the substituted result.

## Issues Encountered

- The complete Admin suite has five pre-existing assertions in `admin-preview.test.tsx` that require `@media (width <= 960px)` while the existing shell CSS uses `@media (width <= 959px)`. The 118 remaining Admin tests pass, and the 04-57-specific 17 tests pass. This unrelated breakpoint contract was not changed.
- Storybook retains its isolated catalog chunk-size warning; the static build and all invitation stories complete successfully.

## User Setup Required

None.

## Next Phase Readiness

- Plan 04-58 can build People and access governance beside a complete, real-authority invitation workspace.
- Plan 04-61 can register invitations in the final Admin route matrix and reuse the verified 320px, 200-percent text, forced-colors, and reduced-motion evidence.

## Self-Check: PASSED

- Invitation policy and authority tests: 17/17.
- Invitation API tests: 4/4; complete API suite: 212/212.
- Admin and API TypeScript: passed.
- ESLint and Prettier for plan files: passed.
- Contract drift and compatibility: passed.
- Contracts TypeScript: 71/71; contracts Rust: 11 tests.
- Admin Storybook static build: passed.
- Browser state matrix: 33/33; 320px and 200-percent text overflow checks passed.
- Production fixture fallback: absent.

---

_Phase: 04-identity-commerce-devices-and-administration_
_Completed: 2026-08-07_
