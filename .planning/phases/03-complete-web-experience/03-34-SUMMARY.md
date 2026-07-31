---
phase: 03-complete-web-experience
plan: '34'
subsystem: admin-ui
tags: [nextjs, react, localization, accessibility, security-boundary, tdd]

requires:
  - phase: 03-17
    provides: isolated admin origin, authored 403/404/500 failures, strict CSP, and closed role shell
  - phase: 03-28
    provides: canonical role-specific admin workflow routes and no-change authority boundary
  - phase: 03-32
    provides: final WEB-08 evidence baseline and gap identification
provides:
  - Closed bilingual 403/404/410/500 admin failure contract
  - Disjoint canonical admin error-route and role-workspace classification
  - Manifest-aware catch-all dispatch for localized canonical admin 410 outcomes
affects: [03-36, WEB-08, admin-e2e, phase-04-admin-authority]

tech-stack:
  added: []
  patterns:
    - Resolve canonical admin error identities before role-workspace authorization
    - Derive noindex failure metadata from the same localized closed failure model as the rendered view

key-files:
  created: []
  modified:
    - apps/admin/src/admin-errors.ts
    - apps/admin/src/admin-preview-model.ts
    - apps/admin/src/app/[locale]/[[...workspace]]/page.tsx
    - apps/admin/src/admin-shell.test.ts

key-decisions:
  - 'Classify canonical admin error routes before applying the unchanged role-workspace access matrix.'
  - 'Recover every authored admin 410 only to the localized canonical admin-role route without carrying role, return, credential, or diagnostic context.'
  - 'Keep the 410 outcome non-authoritative and derive its noindex metadata from the same bilingual redacted copy contract.'

patterns-established:
  - 'Admin error routing: canonical error IDs form a closed disjoint union and map exhaustively to the authored failure kinds.'
  - 'Admin recovery: historical outcomes preserve context in static copy while exposing no operational data or mutation channel.'

requirements-completed: [WEB-08]

duration: 10min
completed: 2026-07-31
status: complete
---

# Phase 3 Plan 34: Canonical Admin 410 Gap Closure Summary

**Localized PT-BR and English admin 410 outcomes now resolve through a closed redacted failure contract before workspace admission, without changing 403/404/500, role, origin, CSP, cookie, or authority behavior**

## Performance

- **Duration:** 10 min
- **Started:** 2026-07-31T16:56:00Z
- **Completed:** 2026-07-31T17:06:21Z
- **Tasks:** 2
- **Files modified:** 4

## Accomplishments

- Extended the admin failure model to an exhaustive bilingual 403/404/410/500 set with bounded opaque correlations and unique historical 410 semantics.
- Added a canonical error-route union and exact route-to-failure mapping that cannot enter the unchanged role-workspace access matrix.
- Refactored the admin catch-all into discriminated workflow/error resolution so `/pt-BR/errors/410` and `/en/errors/410` render before headers and role admission, with localized noindex metadata and canonical same-origin recovery.
- Preserved unknown-route HTTP 404, cross-role 403, canonical 403/404/500, strict nonce CSP, disconnected authority, cookie rejection, viewport, consent, audit, and no-change behavior.

## Task Commits

Each task was committed atomically:

1. **Task 1 RED: Specify complete admin error routing** - `1b2a9b5` (test)
2. **Task 1 GREEN: Close the admin error contract** - `0296955` (feat)
3. **Task 1 quality correction: Format the error contract** - `da5489a` (style)
4. **Task 2: Render canonical admin gone outcome** - `afd2496` (feat)

## Files Created/Modified

- `apps/admin/src/admin-errors.ts` - Closed bilingual 403/404/410/500 copy, recovery, and opaque correlation model.
- `apps/admin/src/admin-preview-model.ts` - Disjoint canonical admin workflow/error route unions and exhaustive failure-kind mapping.
- `apps/admin/src/app/[locale]/[[...workspace]]/page.tsx` - Admin-origin workflow/error resolution, localized noindex metadata, and pre-role failure dispatch.
- `apps/admin/src/admin-shell.test.ts` - RED/GREEN coverage for exhaustive route identity, locale parity, recovery, redaction, role isolation, and mutation-channel absence.

## Decisions Made

- Applied `adminRoleCanAccess` only after the route has proven to be a workflow route; error identities render static non-authoritative failures and never participate in role authorization.
- Kept 410 recovery at the canonical localized `admin-role` URL without copying the current preview role or accepting a return destination.
- Reused `AdminFailureView` and the existing strict admin shell so focus semantics, screen-reader status, forced-color behavior, CSP, noindex, and origin provenance remain consistent.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Quality] Formatted the Task 1 contract files**

- **Found during:** Task 2 final formatting gate
- **Issue:** Prettier reported wrapping drift in the new English 410 detail and failure-route helper signature after the GREEN commit.
- **Fix:** Applied the repository formatter to the two Task 1 contract files in a dedicated style-only commit.
- **Files modified:** `apps/admin/src/admin-errors.ts`, `apps/admin/src/admin-preview-model.ts`
- **Verification:** Focused tests, Prettier check, strict TypeScript, full admin tests, and optimized build all pass.
- **Committed in:** `da5489a`

---

**Total deviations:** 1 auto-fixed (1 quality correction).
**Impact on plan:** Mechanical formatting only; behavior, authority, route ownership, and dependencies were unchanged.

## Issues Encountered

- The first live request sweep used a production build compiled for the default HTTPS admin origin, so the origin boundary correctly returned redacted HTTP 403 responses. The live verification was rerun with the dedicated `http://admin.localhost:33134` development origin and hostname, matching the approved Phase 3 test pattern; the complete route/header matrix then passed.

## Known Stubs

None. The 410 outcome is fully authored in both locales and resolves from the canonical route manifest; it does not depend on mock operational data.

## Threat Flags

No unmodeled threat surface was introduced. The catch-all admits only existing canonical admin-origin route IDs, performs no fetch, upload, credential, cookie, storage, redirect, or mutation operation, and exposes only bounded static failure data.

## Verification

- RED focused test - PASS as an intentional failure: 410 route authority was undefined and the 410 copy lookup was absent while existing tests remained green.
- `rtk pnpm --filter @liiiraa/admin test -- --run src/admin-shell.test.ts` - PASS, 25 tests across 3 discovered files.
- `rtk pnpm --filter @liiiraa/admin verify` - PASS: strict TypeScript, 25 tests, and optimized Next.js 16 webpack build.
- Optimized route table - PASS: dynamic `/[locale]/[[...workspace]]` catch-all retained with existing 403/404/500 routes and proxy middleware.
- Live dedicated-origin matrix - PASS: PT-BR/en 410 HTTP 200 with unique H1/code/copy/recovery; unknown and canonical 404 HTTP 404; cross-role/canonical 403 preserved; canonical 500 preserved.
- Live security headers - PASS: strict-dynamic nonce CSP, `noindex,nofollow,noarchive`, disconnected authority provenance, no `Set-Cookie`; account-cookie request rejected with redacted HTTP 403 JSON.
- Source scans - PASS: no new fetch, upload, credential parsing, cross-surface cookie acceptance, storage, redirect, placeholder, or authority channel.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness

- Plan 03-36 can exercise the now-complete public/account/admin 410 matrix through the dedicated live origins.
- WEB-08 admin failure routing is complete without introducing Phase 4 authority or Phase 10 distribution behavior.
- No blockers remain from Plan 03-34.

## Self-Check: PASSED

- All four modified implementation/test files and this summary exist on disk.
- RED `1b2a9b5`, GREEN `0296955`, style correction `da5489a`, and catch-all `afd2496` commits exist in git history in order.
- Focused tests, formatting, strict TypeScript, full admin tests, optimized build, live route matrix, and security header claims were reverified against the committed tree.

---

_Phase: 03-complete-web-experience_
_Completed: 2026-07-31_
