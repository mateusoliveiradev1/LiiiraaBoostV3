---
phase: 04-identity-commerce-devices-and-administration
plan: '52'
subsystem: api
tags: [admin, governance, approvals, step-up, break-glass, tdd]
requires:
  - phase: 04-48
    provides: PostgreSQL governance membership, approval, audit, receipt, and concurrency authority
provides:
  - Least-privilege team, function, delegation, review, offboarding, and simulation HTTP boundaries
  - Server-owned permission impact and independent approval endpoints
  - Delayed alerted solo-critical break-glass admission
affects: [04-53, 04-58, 04-62, admin-governance, admin-approvals]
tech-stack:
  added: []
  patterns:
    [authorize-before-query, server-owned-impact, action-bound-step-up, simulation-read-only]
key-files:
  created:
    - apps/api/src/modules/admin/governance-routes.ts
    - apps/api/src/modules/admin/governance-routes.test.ts
    - apps/api/src/modules/admin/approval-routes.ts
    - apps/api/src/modules/admin/approval-routes.test.ts
key-decisions:
  - 'Use the active server session as actor, function, capability, scope, and simulation authority; URL/body role claims grant nothing.'
  - 'Accept permission proposals from clients but compute before/after impact, approval eligibility, and break-glass risk from trusted server state.'
  - 'Keep administrative-team invitations on a dedicated governed port and reject beta or ordinary-account promotion before persistence.'
requirements-completed: [WEB-06, IDEN-03]
duration: 14 min
completed: 2026-08-07
status: complete
---

# Phase 04 Plan 52: Governance and Approval API Summary

**Least-privilege administrative governance with server-filtered projections, independent approvals, scoped fresh step-up, and no super-admin shortcut**

## Performance

- **Duration:** 14 min
- **Started:** 2026-08-07T01:03:00-03:00
- **Completed:** 2026-08-07T01:17:00-03:00
- **Tasks:** 2
- **Files modified:** 4

## Accomplishments

- Added masked bounded team list/detail/history routes that authorize exact origin, session function, governance capability, and scope before any query.
- Added administrative-team invite, activate, function switch, delegation, atomic offboarding, access review, and simulation routes with generated command validation and CSRF.
- Kept simulations projection-only with `canAuthorizeAction: false`; simulated sessions fail every mutation before an application/repository call.
- Added server-owned permission impact previews, approval request/approve/cancel/reassign commands, five-minute step-up freshness, and bounded rate limits.
- Added break-glass admission from trusted server context: one administrator, critical non-mass action, strong factor, safety delay, prior alerts, and at most a fifteen-minute window.

## Task Commits

1. **Task 04-52-01: Implement team/access governance endpoints**
   - `5ce8a53` — RED governance route contracts
   - `45d5252` — GREEN least-privilege governance routes
   - `2912b4d` — RED separate administrative invitation contract
   - `4ad21b7` — GREEN administrative-team invitation boundary
2. **Task 04-52-02: Implement impact and approval endpoints**
   - `3d5b427` — RED approval and break-glass contracts
   - `f8bd148` — GREEN impact, approval, cancellation, reassignment, and break-glass routes

## Decisions Made

- Route authorization is evaluated again on every request, so a function switch immediately changes returned navigation/data/actions.
- Browser-provided before/after impact, eligibility, author, beneficiary, mass-action, and risk claims are ignored; trusted application/repository or server context owns them.
- Mutation commands require exact admin origin, HMAC CSRF, a non-simulated session, generated `admin-operation-command`, actor/function binding, one target, reason, and bounded version.
- Approval mutations additionally require server-resolved step-up bound to actor/context and fresh for no more than five minutes; the application use case remains the exact action/resource/target verifier.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 2 - Missing Critical] Added the distinct administrative-team invitation boundary**

- **Found during:** Final Task 04-52-01 must-have audit
- **Issue:** Activation existed, but the explicit invite operation was not yet reachable and could be confused with beta invitation authority.
- **Fix:** Added a dedicated `administrative-team` route/port that rejects beta and ordinary promotion before calling persistence.
- **Verification:** RED/GREEN route contract proves separation and response redaction.
- **Committed in:** `4ad21b7`

**2. [Rule 2 - Missing Critical] Enforced step-up freshness at the HTTP edge**

- **Found during:** Task 04-52-02 boundary design
- **Issue:** Application authority verifies exact action/resource/target, but stale evidence should also be rejected before mutation dispatch.
- **Fix:** Bound evidence to the active actor/context, validity window, and a maximum five-minute age before invoking approval or break-glass authority.
- **Verification:** Stale evidence test fails before the operation mock is called.
- **Committed in:** `f8bd148`

---

**Total deviations:** 2 auto-fixed missing security/lifecycle requirements. **Impact on plan:** Required to satisfy the written invite and step-up contracts; no scope expansion.

## Issues Encountered

- None requiring user setup. No Docker or staging database was used.

## User Setup Required

None.

## Next Phase Readiness

- Plan 04-53 can compose these route registrars with the PostgreSQL governance repository and production session/step-up resolvers.
- Plans 04-58/62 can consume masked governance projections and commands without client-side authority reconstruction.

## Self-Check: PASSED

- Focused governance/approval suites: 8/8.
- Full API: 204/204.
- API typecheck and changed-file lint: passed.
- Architecture: 46/46.
- Contract generation: 12 artifacts without drift.
- Rust workspace: 85/85.

---

_Phase: 04-identity-commerce-devices-and-administration_
_Completed: 2026-08-07_
