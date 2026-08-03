---
phase: 03-complete-web-experience
plan: "67"
subsystem: web-experience
tags: [nextjs, i18n, pricing, routes, account, admin]
requires:
  - phase: 03-complete-web-experience
    provides: canonical web surfaces, disconnected authority, and deterministic route contracts
provides:
  - Complete customer route and degraded-state ownership matrix
  - Final bilingual Free Essential and Premium Competitive commercial contract
  - Canonical Results, Download, login, register, onboarding, and safe desktop-analysis routes
affects: [03-68, 03-69, 03-70, 03-71, 03-72, public-web, account-web, admin-web]
tech-stack:
  added: []
  patterns: [customer-language-first copy, canonical route-derived navigation, structured disconnected authority]
key-files:
  created:
    - .planning/phases/03-complete-web-experience/03-ROUTE-EXPERIENCE-MATRIX.md
  modified:
    - packages/web-core/src/routes.ts
    - apps/web/src/content/public/catalog.pt-BR.json
    - apps/web/src/content/public/catalog.en.json
    - apps/account/src/content/account.pt-BR.json
    - apps/admin/src/content/admin.pt-BR.json
key-decisions:
  - "Free is a permanent Essential Mode with real safe optimizations, no card, no trial, no ads, and no daily limits."
  - "Premium is Competitive Mode at R$ 29,90/month or R$ 249,90/year and US$ 6.99/month or US$ 59.99/year, with one active PC and 30-day transfer/offline rules."
  - "Primary public navigation is Product, Results, Compatibility, Plans, and Download; docs, support, status, and releases remain contextual destinations."
patterns-established:
  - "Ordinary UX uses customer outcomes; phase, fixture, adapter, illustrative-price, and simulated-preview language stays outside customer copy."
  - "Remote authority remains machine-testable through disconnected metadata while terminal copy explains the human outcome."
requirements-completed: [WEB-01, WEB-02, WEB-03, WEB-08]
duration: 20min
completed: 2026-08-03
status: complete
---

# Phase 03 Plan 67: Final Route and Commercial Contract Summary

**Launch-ready bilingual route, pricing, entitlement, device, lifecycle, support, and authority contracts now drive the public, account, and admin web surfaces.**

## Performance

- **Duration:** 20 min
- **Started:** 2026-08-03T01:36:29Z
- **Completed:** 2026-08-03T01:55:51Z
- **Tasks:** 2
- **Files modified:** 23

## Accomplishments

- Assigned every canonical public, service, account, admin, degraded, and error destination to a final customer goal and owning implementation plan.
- Replaced the single illustrative Premium offer with permanent Free Essential and paid Premium Competitive contracts, including exact prices, payments, refund, cancellation, support, device, and offline terms.
- Removed implementation chronology and test-fixture language from the eight final bilingual catalogs while preserving disconnected identity, commerce, device, support, and admin authority.
- Changed the acquisition path to Results and Download, with canonical `/login`, `/register`, `/onboarding`, and data-free `liiiraaboost://analyze` destinations.

## Task Commits

Each task was committed atomically:

1. **Task 1: Build the complete customer route and state matrix** - `51548d7`
2. **Task 2: Author final bilingual commercial and lifecycle copy contracts** - `9e9fb01`

## Files Created/Modified

- `.planning/phases/03-complete-web-experience/03-ROUTE-EXPERIENCE-MATRIX.md` - Complete canonical route, state, locale, breakpoint, authority, and ownership inventory.
- `packages/web-core/src/routes.ts` - Final public/auth routes and safe desktop analyze deep link.
- `apps/web/src/content/public/catalog.{pt-BR,en}.json` - Exact Free/Premium commercial and support contract.
- `apps/web/src/content/public/home.{pt-BR,en}.json` - Outcome-led Home story and Results route.
- `apps/account/src/content/account.{pt-BR,en}.json` - Final account, subscription, device, privacy, and support language.
- `apps/admin/src/content/admin.{pt-BR,en}.json` - Human operational copy with redacted, disconnected authority.
- `apps/web/src/features/public-catalog.tsx` - Two-plan rendering and canonical Results/Download behavior.
- Public, account, and admin regression tests - Exact route, price, lifecycle, locale, and no-internal-copy assertions.

## Decisions Made

- Free is useful forever and is not a trial: safe basic optimizations, manual apply, one game profile, diagnostics/benchmark, process/startup/power work, and full history/restoration.
- Premium sells Competitive Mode without miracle claims: hardware calibration, advanced optimization, unlimited profiles, automatic activation, comparisons, assistance, priority support, and evidence-scoped outcomes.
- One Premium subscription activates one protected PC identity; raw HWID is never stored, reset/transfer is available every 30 days, and history/restoration never become paywalled.
- The web explains PC analysis and may launch `liiiraaboost://analyze`, but the machine analysis and game/objective onboarding stay on desktop.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 2 - Missing Critical] Updated direct consumers and regressions for the final contract**

- **Found during:** Task 2
- **Issue:** Public navigation, catalog rendering, client boundary helpers, and account/admin shell copy still consumed legacy Evidence, sign-in, single-plan, and preview wording.
- **Fix:** Updated the smallest owning consumers and tests so the new catalogs and canonical routes are executable immediately.
- **Files modified:** Public catalog/navigation/boundary files, account/admin locale layouts, and focused tests.
- **Verification:** Web 97/97, account 57/57, admin 59/59, and web-core routes 19/19 pass.
- **Committed in:** `9e9fb01`

---

**Total deviations:** 1 auto-fixed (missing critical consumer alignment). **Impact:** Required for the final contract to be rendered and tested; no remote authority, charge, session, device mutation, or admin mutation was introduced.

## Issues Encountered

- A first large catalog patch from the interrupted session had failed atomically because the English file context had diverged. The catalogs were applied independently and validated as JSON before testing.

## User Setup Required

None - no external service configuration required.

## Verification

- `@liiiraa/web-core` routes: 19/19 passed.
- `@liiiraa/web`: 97/97 passed.
- `@liiiraa/account`: 57/57 passed.
- `@liiiraa/admin`: 59/59 passed.
- Recursive value inspection across all eight catalogs found zero forbidden customer-copy matches.

## Next Phase Readiness

- Plan 03-68 can redesign Home and acquisition pages against one locked route and commercial source of truth.
- Real authentication, billing, device binding/reset, support submission, distribution, and administration remain intentionally disconnected.

---

*Phase: 03-complete-web-experience*
*Completed: 2026-08-03*
