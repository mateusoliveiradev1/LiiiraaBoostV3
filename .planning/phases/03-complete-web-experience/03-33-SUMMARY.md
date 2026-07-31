---
phase: 03-complete-web-experience
plan: "33"
subsystem: account-ui-errors
tags: [nextjs, account, localization, error-routing, redaction, accessibility]

requires:
  - phase: 03-16
    provides: isolated account shell, security proxy, and original 404/500 recovery models
  - phase: 03-27
    provides: canonical account-origin catch-all and ten responsibility workflows
  - phase: 03-32
    provides: final Phase 3 evidence and the observed D-25 account route gap
provides:
  - Closed bilingual 403/404/410/500 account failure contract
  - Canonical error dispatch separated from account responsibility workflows
  - Localized real-HTTP 404 handling for canonical and unknown account paths
affects: [03-34, 03-36, account-e2e, phase-03-verification]

tech-stack:
  added: []
  patterns:
    - Closed canonical error-route union mapped exhaustively to authored failure kinds
    - Account proxy preserves genuine 404 status while the catch-all renders localized recovery
    - Runtime diagnostics expose only bounded opaque correlation digests or REDACTED

key-files:
  created:
    - apps/account/src/account-failure-view.tsx
  modified:
    - apps/account/src/account-errors.ts
    - apps/account/src/account-preview-model.ts
    - apps/account/src/account-shell.test.ts
    - apps/account/src/app/[locale]/[[...responsibility]]/page.tsx
    - apps/account/src/app/[locale]/layout.tsx
    - apps/account/proxy.ts
  deleted:
    - apps/account/src/app/[locale]/errors/404/page.tsx

key-decisions:
  - "Keep account responsibility and error identities as separate closed unions so authored failures can never enter AccountPreviewPage."
  - "Let the canonical catch-all own account 404 rendering while the proxy preserves HTTP 404 status and the layout supplies localized failure metadata."
  - "Use the canonical current route only for 500 retry; 403, 404, and 410 recover through same-origin Overview and Support destinations."

patterns-established:
  - "Account failure rendering: one semantic H1, affected capability, detail, recovery, safe-work status, same-origin actions, and redacted correlation."
  - "Localized 404 boundary: canonical and unknown valid-locale paths share the authored account model without redirecting or connecting authority."

requirements-completed: [WEB-08]

duration: 24min
completed: 2026-07-31
status: complete
---

# Phase 03 Plan 33: Complete Account Error Routing Summary

**Closed bilingual account 403/404/410/500 routing with semantic recovery views, opaque diagnostic redaction, and genuine localized HTTP 404 handling.**

## Performance

- **Duration:** 24 min
- **Started:** 2026-07-31T16:28:41Z
- **Completed:** 2026-07-31T16:52:54Z
- **Tasks:** 2
- **Files modified:** 8

## Accomplishments

- Added one exhaustive route-to-failure mapping for all four canonical account error identities while leaving the ten account responsibility identities unchanged.
- Authored distinct PT-BR and English affected-capability, detail, safe-work, recovery, and action copy for 403, 404, 410, and 500.
- Rendered canonical failures through a server-safe semantic view with same-origin recovery, persistent disconnected-preview provenance, noindex policy, and bounded redacted correlations.
- Restored the genuine localized 404 boundary for both `/errors/404` and unknown account paths after a live probe exposed Next's generic English fallback.

## Task Commits

Each task was committed atomically:

1. **Task 1 RED: Specify complete account error routing** - `38b1a56` (test)
2. **Task 1 GREEN: Close the account error contract** - `b52d276` (feat)
3. **Task 2: Dispatch canonical account failures** - `339010c` (feat)
4. **Recovery fix: Restore localized account 404 boundary** - `300b1be` (fix)

## Files Created/Modified

- `apps/account/src/account-errors.ts` - Closed bilingual failure models and bounded correlation redaction.
- `apps/account/src/account-preview-model.ts` - Separate canonical error-route union, guard, and exhaustive failure-kind mapping.
- `apps/account/src/account-failure-view.tsx` - Shared server-safe semantic failure presentation.
- `apps/account/src/app/[locale]/[[...responsibility]]/page.tsx` - Workflow/error/unknown dispatch, localized metadata, recovery actions, and 404 rendering.
- `apps/account/src/app/[locale]/layout.tsx` - Localized failure metadata for real HTTP 404 responses.
- `apps/account/proxy.ts` - Canonical/unknown route classification that preserves HTTP 404 without cookies or redirects.
- `apps/account/src/account-shell.test.ts` - Exhaustive route, locale, recovery, redaction, dispatch, and 404-boundary coverage.
- `apps/account/src/app/[locale]/errors/404/page.tsx` - Removed the shadow route that invoked Next's generic fallback instead of the authored account boundary.

## Decisions Made

- Kept error identities distinct from responsibility identities so no error path can construct `AccountPreviewPage`.
- Preserved the requested URL for every failure; 500 retries its canonical same-origin URL while 403/404/410 offer Overview and Support.
- Classified canonical and unknown 404 requests in the existing account proxy so they retain HTTP 404 while the catch-all owns the localized authored body.
- Reused the account failure model for 404 metadata at the layout boundary because Next bypasses child metadata when middleware preserves a 404 response status.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Restored the localized account 404 runtime boundary**

- **Found during:** Plan-level live HTTP/content verification after Task 2
- **Issue:** `/pt-BR|en/errors/404` and unknown account paths returned HTTP 404 with Next's generic English fallback instead of the authored localized account failure, despite source-only tests passing.
- **Fix:** Removed the shadow `errors/404` page, routed canonical and unknown 404 rendering through the account catch-all, preserved HTTP 404 in the account proxy, and supplied localized failure metadata from the locale layout.
- **Files modified:** `apps/account/proxy.ts`, `apps/account/src/account-shell.test.ts`, `apps/account/src/app/[locale]/[[...responsibility]]/page.tsx`, `apps/account/src/app/[locale]/layout.tsx`, `apps/account/src/app/[locale]/errors/404/page.tsx`
- **Verification:** Account verify passed; both locales returned localized authored 404 bodies, `LB-A404-REDACTED`, Overview/Support actions, disconnected provenance, and HTTP 404 for canonical and unknown paths.
- **Committed in:** `300b1be`

---

**Total deviations:** 1 auto-fixed bug.
**Impact on plan:** The fix makes the plan's unknown-route and canonical-404 acceptance criteria true in the live Next.js runtime without adding authority, dependencies, cookies, redirects, or a new route contract.

## Issues Encountered

- Context7 MCP and CLI were unavailable, so installed Next.js 16.2.12 behavior was verified directly through focused builds and live HTTP probes.
- Removing the shadow 404 page left stale generated `.next/types` until the production build regenerated the route graph; the subsequent check/test/build sequence passed cleanly.

## TDD Gate Compliance

- RED commit `38b1a56` introduced failing exhaustive route, locale, recovery, and redaction expectations before 403/410 support existed.
- GREEN commit `b52d276` implemented the closed contract and made the focused account test pass.
- Dispatch commit `339010c` connected the contract to executable account routes; recovery commit `300b1be` closed the live-only 404 gap.

## Verification

- `rtk pnpm --filter @liiiraa/account exec vitest run src/account-shell.test.ts` - PASS, 5/5 focused tests.
- `rtk pnpm --filter @liiiraa/account verify` - PASS, TypeScript check, 17/17 tests, and optimized Next.js 16.2.12 webpack build.
- Optimized route table - PASS, one dynamic `/[locale]/[[...responsibility]]` catch-all plus account proxy; canonical 404 no longer shadows the authored dispatcher.
- Live dev probe on `account.localhost:4317` - PASS for PT-BR and English 403/404/410/500 routes; 403/410/500 returned authored HTTP 200 views and 404 returned the authored localized HTTP 404 view.
- Live unknown-route probe - PASS for `/pt-BR/unknown/account/path` and `/en/unknown/account/path`, both HTTP 404 with localized H1, Overview/Support actions, disconnected provenance, and `LB-A404-REDACTED`.
- Security header probe - PASS, strict nonce CSP and `X-Robots-Tag: noindex,nofollow,noarchive`; no `Set-Cookie` header observed.
- Redaction coverage - PASS, stack paths, email-like values, serialized request data, and arbitrary diagnostic text reduce to `LB-A500-REDACTED`.
- Mutation-channel scan and diff check - PASS, no new cookie, fetch, redirect, arbitrary URL, client authority, or whitespace defect.

## Known Stubs

None. Disconnected Phase 4 authority and no-change language are intentional Phase 3 safety contracts, not incomplete implementation.

## Threat Flags

None. The request-path and diagnostic boundaries are the two trust surfaces declared by the plan; no new endpoint, credential, file-access, schema, or mutation boundary was introduced.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness

- Plan 03-34 can close the admin half of D-25 against the same distinct authored-state standard.
- Plan 03-36 can make final Phase 3 evidence depend on executable account/admin error-route proof instead of route-ID counts alone.
- No account-route blocker remains.

## Self-Check: PASSED

- All seven current implementation/test artifacts and this summary exist on disk.
- RED, GREEN, dispatch, and recovery commits are present in git history.
- The shadow 404 page is intentionally absent, and live canonical/unknown 404 requests resolve through the authored catch-all boundary.
- Focused tests, complete account verify, optimized build, security headers, and the ten-request bilingual live matrix passed.

---

*Phase: 03-complete-web-experience*
*Completed: 2026-07-31*
