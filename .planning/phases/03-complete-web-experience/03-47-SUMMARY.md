---
phase: 03-complete-web-experience
plan: "47"
subsystem: web-security
tags: [nextjs, turbopack, csp, nonce, tdd]

requires:
  - phase: 03-44
    provides: Stable public, account, and admin visual-review surfaces with isolated security boundaries
provides:
  - Exact-development CSP compatibility for React and Next.js Turbopack on all three web surfaces
  - Production/test no-eval regression proof for public, account, and admin
  - Strict no-eval authored admin denials with preserved nonce and origin isolation
affects: [WEB-08, web-publication, visual-review, security-boundaries]

tech-stack:
  added: []
  patterns:
    - Pure runtime-mode CSP builders with exact development capability selection
    - One nonce-bearing header contract reused across request and response propagation

key-files:
  created:
    - .planning/phases/03-complete-web-experience/03-47-SUMMARY.md
  modified:
    - apps/web/next.config.ts
    - apps/web/src/public-shell.test.ts
    - apps/account/proxy.ts
    - apps/account/src/account-security.test.ts
    - apps/admin/proxy.ts
    - apps/admin/src/admin-security.test.ts
    - .planning/debug/phase-03-development-csp-turbopack.md

key-decisions:
  - "Grant unsafe-eval only when the explicit runtime mode is exactly development; unknown, production, and test modes remain strict."
  - "Keep authored admin denial responses on the strict production contract even during local development."

patterns-established:
  - "Mode-aware CSP: tests pass runtime mode directly to pure builders and never mutate ambient NODE_ENV."
  - "Denial hardening: rejected admin requests never inherit development-only script capability."

requirements-completed: [WEB-08]

duration: 9 min
completed: 2026-08-01
status: complete
---

# Phase 03 Plan 47: Development CSP Turbopack Compatibility Summary

**Exact-development `unsafe-eval` support for React/Turbopack across public, account, and admin, with production, test, report-only, and admin denial policies remaining no-eval.**

## Performance

- **Duration:** 9 min
- **Started:** 2026-08-01T04:24:40Z
- **Completed:** 2026-08-01T04:33:20Z
- **Tasks:** 3
- **Files modified:** 8

## Accomplishments

- Added independent explicit runtime-mode CSP construction for public, account, and admin surfaces.
- Proved every development policy contains `unsafe-eval` exactly once while production and test omit it.
- Preserved public static/report-only behavior, account nonce and safe-context boundaries, and admin exact-origin, role, cookie, redaction, and authored denial behavior.
- Resolved the recorded React/Next.js 16.2.12 Turbopack development CSP debug session.

## TDD Execution

### RED

- Public development mode failed because no pure mode-aware public header builder existed.
- Account development mode failed because its nonce policy omitted the required eval capability.
- Admin development mode failed because its admitted nonce policy omitted the required eval capability.

### GREEN

- Public now constructs static headers through `buildPublicHeaderContract(runtimeMode)`.
- Account and admin header contracts accept explicit runtime modes while their proxies pass the actual environment.
- Admin denials deliberately select the strict production contract and admitted responses reuse one selected nonce contract.

### REFACTOR

- No separate refactor commit was needed; the GREEN implementations remained minimal and all focused suites passed.

## Task Commits

Each TDD gate was committed atomically:

1. **Task 1 RED: Public CSP mode proof** - `8787558` (test)
2. **Task 1 GREEN: Public CSP mode split** - `d08c0c0` (feat)
3. **Task 2 RED: Account CSP mode proof** - `61735f4` (test)
4. **Task 2 GREEN: Account CSP mode split** - `18d5a1a` (feat)
5. **Task 3 RED: Admin CSP mode proof** - `0c91b05` (test)
6. **Task 3 GREEN: Admin CSP mode split** - `e46b271` (feat)

## Files Created/Modified

- `apps/web/next.config.ts` - Builds public CSP/header contracts from an explicit runtime mode.
- `apps/web/src/public-shell.test.ts` - Proves public development inclusion and production/test/report-only exclusion.
- `apps/account/proxy.ts` - Adds exact-development eval to the nonce CSP and passes the runtime mode explicitly.
- `apps/account/src/account-security.test.ts` - Proves account mode behavior while retaining nonce, cache, indexing, framing, cookie, and redirect constraints.
- `apps/admin/proxy.ts` - Adds admitted-development eval, reuses selected contracts, and keeps denials strict.
- `apps/admin/src/admin-security.test.ts` - Proves admin mode behavior and retains exact-origin, role, cookie, bounded JSON, localized HTML, and redaction coverage.
- `.planning/debug/phase-03-development-csp-turbopack.md` - Records the confirmed root cause, fix, and successful verification.

## Verification

- `rtk pnpm --filter @liiiraa/web exec vitest run src/public-shell.test.ts -t "public CSP"` - PASS, 4 assertions.
- `rtk pnpm --filter @liiiraa/account exec vitest run src/account-security.test.ts` - PASS, 7 assertions.
- `rtk pnpm --filter @liiiraa/admin exec vitest run src/admin-security.test.ts` - PASS, 16 assertions.
- `rtk pnpm --filter @liiiraa/web build` - PASS, optimized Next.js 16.2.12 production build.
- `rtk pnpm --filter @liiiraa/account build` - PASS, optimized Next.js 16.2.12 production build.
- `rtk pnpm --filter @liiiraa/admin build` - PASS, optimized Next.js 16.2.12 production build.

## Decisions Made

- Exact string equality with `development` is the only capability grant; all other values fail closed.
- Admin denial documents and JSON denials always use the strict production CSP because rejected origins must never receive development execution capability.

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered

None.

## Known Stubs

None.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness

- CSP compatibility gap is closed with independent RED/GREEN proof on all three surfaces.
- Production publication and visual-review gates can consume the strict no-eval builds without a CSP exception.
- No package, origin, cookie, session, or authority identity was introduced.

## Self-Check: PASSED

- All seven implementation/debug files and this summary exist on disk.
- All six RED/GREEN commits are present in repository history in the required test-before-feature order.
- All task acceptance criteria and plan-level verification commands passed.

---
*Phase: 03-complete-web-experience*
*Completed: 2026-08-01*
