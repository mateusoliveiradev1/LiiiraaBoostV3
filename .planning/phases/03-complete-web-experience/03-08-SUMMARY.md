---
phase: 03-complete-web-experience
plan: '08'
subsystem: web
tags: [nextjs, next-intl, admin, fixture-preview, deployment-isolation]
requires:
  - phase: 03-01
    provides: Exact approved Next.js and next-intl dependency identities
  - phase: 03-02
    provides: Reserved fixture-classified admin composition boundary
  - phase: 03-04
    provides: Shared web-core public contracts
  - phase: 03-05
    provides: Shared web-features public contracts
provides:
  - Independently deployable fixture-classified @liiiraa/admin package identity
  - Standalone typed-routes Next.js admin preview build baseline
  - Literal disconnected admin authority and ordinary-navigation composition marker
affects: [03-11, 03-17, admin-routes, admin-preview, web-deployment]
tech-stack:
  added: [next@16.2.12, next-intl@4.13.4, react@19.2.8, react-dom@19.2.8]
  patterns:
    - Exact-pinned admin app manifest with workspace-only internal package edges
    - Fixture composition marker at the isolated admin public root
key-files:
  created:
    - apps/admin/package.json
    - apps/admin/tsconfig.json
    - apps/admin/next.config.ts
    - apps/admin/src/index.ts
  modified: []
key-decisions:
  - 'Keep the admin application fixture-classified with authorityConnected and ordinaryNavigationLinked literal false until privileged authority is explicitly implemented.'
  - 'Use an admin-preview build ID prefix so the standalone artifact cannot be confused with public or account builds.'
  - 'Defer dependency resolution and executable Next.js lifecycle checks to Plan 03-11.'
patterns-established:
  - 'Admin preview composition: runtimeClass fixture, surface admin, authorityConnected false, and ordinaryNavigationLinked false are exported literal values.'
requirements-completed: [WEB-08]
duration: 4min
completed: 2026-07-31
status: complete
---

# Phase 03 Plan 08: Isolated Administrative Preview Summary

**Exact-pinned standalone Next.js admin preview with a distinct build identity and literal disconnected authority and ordinary-navigation boundaries**

## Performance

- **Duration:** 4 min
- **Started:** 2026-07-31T03:05:08.609Z
- **Completed:** 2026-07-31T03:08:58.747Z
- **Tasks:** 1
- **Files modified:** 4

## Accomplishments

- Created private ESM `@liiiraa/admin` with exact approved Next.js, React, and next-intl identities plus explicit design, web-core, web-features, and web-preview workspace roots.
- Added strict Next.js-oriented TypeScript configuration and an independently deployable standalone typed-routes build with the deterministic `admin-preview-scaffold` identity.
- Exported the closed admin composition marker with fixture provenance and literal `false` authority and ordinary-navigation links.
- Kept authentication, sessions, diagnostics, uploads, customer data, and administrative mutation authority entirely outside the scaffold.

## Task Commits

Each task was committed atomically:

1. **Task 1: Define the admin preview build contract** — `3f9158a` (feat)

## Files Created/Modified

- `apps/admin/package.json` — Private admin app identity, approved exact pins, workspace edges, and terminating lifecycle scripts.
- `apps/admin/tsconfig.json` — Strict Next.js TypeScript compiler and generated-route includes.
- `apps/admin/next.config.ts` — Standalone typed-routes build with an admin-specific build ID prefix.
- `apps/admin/src/index.ts` — Fixture/disconnected admin composition identity.

## Decisions Made

- Kept `@liiiraa/web-preview` explicit only because the admin artifact is fixture-classified; no fixture edge entered the public production application.
- Used `admin-preview-scaffold` as a deterministic build identity distinct from public and account artifacts.
- Added no authentication, cookie, session, diagnostic, upload, database, customer-data, or administrative mutation authority.

## Verification

- Plan automated manifest/config/source assertion: **PASS**.
- Fixture classification, admin surface identity, literal `authorityConnected: false`, and literal `ordinaryNavigationLinked: false`: **PASS**.
- Sensitive dependency scan: **PASS**.
- Local Prettier check across all four created files: **PASS**.
- `git diff --check`: **PASS**.
- Installed TypeScript and Next.js lifecycle checks: intentionally deferred to Plan 03-11 as required by this plan.

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered

A formatting probe invoked the workspace package lifecycle and modified `pnpm-lock.yaml`. The lockfile was restored immediately, formatting was completed through the existing local binary, and no dependency or lockfile change remains.

## User Setup Required

None - no external service configuration required.

## Known Stubs

None.

## Next Phase Readiness

The isolated admin package and build boundary are ready for Plan 03-11 to resolve the approved dependency graph and run the first installed TypeScript/Next.js lifecycle checks. Dedicated CSP and access policy remain correctly assigned to Plan 03-17, while real authentication and privileged administration remain Phase 4 work.

## Self-Check: PASSED

- All four key files exist on disk.
- Task commit `3f9158a` exists in repository history.
- Every task acceptance criterion and plan-level static verification passed.

---

_Phase: 03-complete-web-experience_
_Completed: 2026-07-31_
