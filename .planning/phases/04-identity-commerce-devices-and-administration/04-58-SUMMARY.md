---
phase: 04-identity-commerce-devices-and-administration
plan: '58'
subsystem: admin-ui
tags: [admin, governance, approvals, postgres, contracts, accessibility, responsive, storybook, tdd]
requires:
  - phase: 04-62
    provides: Typed production Admin authority, generated projections, and invalidation-only live delivery
  - phase: 04-52
    provides: Least-privilege governance and approval APIs
provides:
  - Authority-connected People and access-governance workspace backed by canonical PostgreSQL projections
  - Administrative team invitations, active functions, permission impact, approvals, delegation, reviews, offboarding, simulation, and break-glass
  - Explicit actor, beneficiary, approver, expiry, affected-data, conflict, and session-revocation evidence
  - Twenty-eight responsive and accessible governance Storybook states through 320px and 200-percent text
affects: [04-59, 04-60, 04-61, admin-people, admin-navigation, access-governance, ui-verification]
tech-stack:
  added: []
  patterns:
    [
      authority-projected-governance,
      explicit-operational-reasons,
      independent-approval-review,
      server-clock-command-windows,
      read-only-function-simulation,
      fixture-only-stories,
    ]
key-files:
  created:
    - apps/admin/src/features/admin-access-governance.tsx
    - apps/admin/src/features/admin-access-governance.module.css
    - apps/admin/src/features/admin-access-governance.stories.tsx
  modified:
    - apps/admin/src/admin-authority.ts
    - apps/api/src/modules/admin/governance-routes.ts
    - apps/api/src/modules/admin/approval-routes.ts
    - apps/api/src/staging/runtime.ts
    - packages/contracts-source/src/control-plane.tsp
key-decisions:
  - 'Governance queries admit only generated canonical Admin documents; malformed or non-authoritative records fail closed.'
  - 'Every governed action uses the admitted session actor and active function plus explicit operator-entered reason, idempotency, version, etag, step-up, and target metadata.'
  - 'Risk is presented as routine, sensitive, critical, or irreversible while retaining the generated transport risk vocabulary.'
  - 'Mutation expiry and execution windows derive from server-observed authority timestamps instead of the browser clock.'
requirements-completed: [WEB-06, IDEN-03]
duration: 1h
completed: 2026-08-07
status: complete
---

# Phase 04 Plan 58: People and Access Governance Summary

**Administrative membership, permissions, independent approvals, reviews, simulation, and emergency access now operate through one typed PostgreSQL-backed authority with explicit evidence and no production fixture fallback**

## Performance

- **Duration:** 1h
- **Completed:** 2026-08-07
- **Tasks:** 2
- **Files modified:** 17

## Accomplishments

- Added deterministic access-governance policy for function switching, before/after permission impact, compatible independent approvers, delegation, inactivity, recertification, offboarding, simulation isolation, masked history, conflict preservation, and break-glass boundaries.
- Built the bilingual People workspace with administrative invitations separate from beta access, member list/detail, function and permission editors, approval review, impact evidence, lifecycle controls, and emergency-access review.
- Connected team and approval reads plus every governance mutation to real typed Admin authority and canonical API/PostgreSQL projections.
- Added canonical team-member and permission-impact contracts and regenerated TypeScript, Rust, OpenAPI, and JSON Schema artifacts.
- Added 28 deterministic Storybook scenarios spanning risk, approval lifecycle, authority state, locale, long content, desktop, tablet, mobile, 320px, 200-percent text, forced colors, reduced motion, and focus restoration.

## Task Commits

1. **Task 04-58-01: Project governance transitions and permission impact**
   - `13e9561` — failing governance policy tests establishing the RED gate
   - `c62cda3` — deterministic access-governance presentation policy
2. **Task 04-58-02: Render People, functions, approvals, reviews, and break-glass**
   - `a6ce385` — authority-connected workspace, canonical API projections, generated contracts, runtime queries, and state stories

## Decisions Made

- Administrative-team invitations remain visibly and operationally separate from private-beta invitations.
- Approval cards expose request author, beneficiary, eligible approver, risk, expiry, impacted references, and an operator-entered reason before enabling any command.
- Permission impact exposes gained/lost capabilities, functions and scopes, affected data, conflicts, and every session requiring revocation.
- Simulation remains read-only and never enables commands or inherits secrets; active-function changes continue through the governed mutation boundary.
- Browser time does not authorize governance windows. Commands derive expiry and execution timestamps from admitted server freshness.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 2 - Missing Critical] Completed the canonical governance API boundary**

- **Found during:** Task 04-58-02 authority integration
- **Issue:** Team responses were not canonical Admin documents, approvals pointed to the operations queue, approval GET was absent, and governance mutations did not carry the required nested command or canonical response document.
- **Fix:** Added generated team/impact documents, real PostgreSQL projection queries, approval GET, governed command construction, session actor/function metadata, and canonical mutation responses.
- **Verification:** API 9/9, Admin 21/21, contract TypeScript 71/71, Rust 11 tests, drift and compatibility gates passed.
- **Committed in:** `a6ce385`

**2. [Rule 1 - Bug] Corrected review-clock semantics and duplicate history identities**

- **Found during:** Chromium rendering of the permission-impact inspector
- **Issue:** `nextReviewAt` was treated as `lastReviewedAt`, causing a future recertification date to crash the inspector; simultaneous governance events also produced duplicate React keys.
- **Fix:** Derived review age from observed authority evidence, kept next review as its own fact, and made ordered masked-history keys unique.
- **Verification:** Permission-impact story rendered without error and focus-return story completed without console failure.
- **Committed in:** `a6ce385`

**3. [Rule 2 - Missing Critical] Required explicit reasons for governed UI commands**

- **Found during:** React and security-boundary review
- **Issue:** Several lifecycle and approval buttons supplied fixed internal reason strings rather than collecting the operator's actual justification.
- **Fix:** Added bounded reason fields and disabled approval, reassignment, cancellation, function switch, review, delegation, offboarding, and break-glass until a valid reason exists.
- **Verification:** TypeScript, ESLint, Storybook build, and responsive Chromium rendering passed.
- **Committed in:** `a6ce385`

---

**Total deviations:** 3 auto-fixed (2 missing critical, 1 bug). **Impact:** All fixes were necessary to preserve authoritative audit evidence, render valid server data, and keep governed actions fail-closed.

## Browser Runtime Verification

- Desktop live at 1440px rendered the full team, four risk levels, approval evidence, explicit reasons, and break-glass boundary without console errors.
- Desktop inspector at 1600px rendered function controls, complete permission impact, lifecycle actions, and masked history after correcting review-clock semantics.
- Mobile at 320px retained single-column reading order and reachable controls; the 200-percent-text witness reflowed invitation and team headers without horizontal clipping.
- Tablet focus-return story at 1024px opened and closed the inspector and returned focus to the originating member trigger without a Storybook play error.
- The final static Storybook build completed with all 28 governance stories included.

## Issues Encountered

- The `agent-browser` executable described by the browser skill was not installed on PATH. Verification used the workspace's installed Playwright Chromium headless shell and direct screenshot/console inspection instead.
- Storybook retains its existing isolated catalog chunk-size warning; the static build and governance stories complete successfully.

## User Setup Required

None.

## Next Phase Readiness

- Plan 04-59 can build Revenue and Support against the same canonical Admin authority and state vocabulary.
- Plan 04-61 can register the People/access workspace in the final production route matrix and reuse its responsive, focus, locale, and authority evidence.

## Self-Check: PASSED

- Governance policy and authority tests: 21/21.
- Governance and approval API tests: 9/9.
- Admin and API TypeScript: passed.
- Scoped ESLint and Prettier: passed.
- Contract drift and compatibility: passed.
- Contracts TypeScript: 71/71; contracts Rust: 11 tests.
- Admin Storybook static build: passed.
- Desktop, inspector, 1024px focus-return, 320px, and 200-percent-text browser witnesses: passed.
- Production fixture fallback: absent.

---

_Phase: 04-identity-commerce-devices-and-administration_
_Completed: 2026-08-07_
