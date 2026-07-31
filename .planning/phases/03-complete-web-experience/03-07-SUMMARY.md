---
phase: 03-complete-web-experience
plan: "07"
subsystem: web
tags: [nextjs, next-intl, account, fixture-preview]
requires:
  - phase: 03-01
    provides: Exact approved Next.js and next-intl dependency identities
  - phase: 03-02
    provides: Reserved fixture-classified account composition boundary
  - phase: 03-04
    provides: Shared web-core public contracts
  - phase: 03-05
    provides: Shared web-features public contracts
provides:
  - Independently deployable fixture-classified @liiiraa/account package identity
  - Standalone typed-routes Next.js account preview build baseline
  - Literal disconnected account authority composition marker
affects: [03-11, account-routes, account-preview, web-deployment]
tech-stack:
  added: [next@16.2.12, next-intl@4.13.4, react@19.2.8, react-dom@19.2.8]
  patterns:
    - Exact-pinned account app manifest with workspace-only internal package edges
    - Fixture composition marker at the account public root
key-files:
  created:
    - apps/account/package.json
    - apps/account/tsconfig.json
    - apps/account/next.config.ts
    - apps/account/src/index.ts
  modified: []
key-decisions:
  - "Keep the account application fixture-classified with authorityConnected literal false until Phase 4."
  - "Use an account-preview build ID prefix to keep account artifacts distinct from public and admin builds."
  - "Defer dependency resolution and executable package lifecycle checks to Plan 03-11."
patterns-established:
  - "Account preview composition: runtimeClass fixture, surface account, and authorityConnected false are exported as literal values."
requirements-completed: [WEB-08]
duration: 3min
completed: 2026-07-31
status: complete
---

# Phase 03 Plan 07: Account Preview Application Scaffold Summary

**Exact-pinned standalone Next.js account preview with an explicit fixture identity and a literal disconnected authority boundary**

## Performance

- **Duration:** 3 min
- **Started:** 2026-07-31T02:58:10.988Z
- **Completed:** 2026-07-31T03:00:59.795Z
- **Tasks:** 1
- **Files modified:** 4

## Accomplishments

- Created the private ESM `@liiiraa/account` application with the exact approved Next.js, React, and next-intl versions.
- Declared explicit workspace dependencies on the design, web-core, web-features, and web-preview public roots.
- Configured an independent standalone typed-routes build with an account-specific build ID prefix.
- Exported a frozen-literal account composition marker that is fixture-classified and cannot claim connected authority.

## Task Commits

Each task was committed atomically:

1. **Task 1: Define the account preview build contract** - `aa0db09` (feat)

## Files Created/Modified

- `apps/account/package.json` - Exact approved dependency identities and terminating app lifecycle scripts.
- `apps/account/tsconfig.json` - Strict Next.js TypeScript configuration extending the repository baseline.
- `apps/account/next.config.ts` - Standalone typed-routes configuration with an `account-preview` build ID prefix.
- `apps/account/src/index.ts` - Fixture/account composition marker with literal disconnected authority.

## Decisions Made

- Kept `@liiiraa/web-preview` as an explicit account-only fixture dependency while preserving the production-only direction of `web-core` and `web-features`.
- Used `account-preview-scaffold` as the deterministic scaffold build ID; later installed build behavior remains owned by Plan 03-11.
- Added no authentication, cookie, session, database, billing, support, or server-mutation authority.

## Verification

- Plan automated manifest/config/source assertion: **PASS**.
- Acceptance assertion for fixture classification, account surface identity, and literal `authorityConnected: false`: **PASS**.
- Approved dependency allowlist assertion: **PASS**.
- `rtk git diff --check`: **PASS**.
- Stub and forbidden-authority scan across all four created files: **PASS**.
- Installed TypeScript and Next.js lifecycle checks: intentionally deferred to Plan 03-11 as required by the plan.

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered

None.

## User Setup Required

None - no external service configuration required.

## Known Stubs

None.

## Next Phase Readiness

The account application manifest and build boundary are ready for Plan 03-11 to resolve the approved dependency graph and perform the first installed TypeScript and Next.js lifecycle checks. Authentication, cookies, sessions, commerce, support submission, and all remote mutations remain intentionally unavailable until Phase 4.

## Self-Check: PASSED

- All four key files and this summary exist.
- Task commit `aa0db09` exists in repository history.
- Every task acceptance criterion and plan-level static verification passed.

---

*Phase: 03-complete-web-experience*
*Completed: 2026-07-31*
