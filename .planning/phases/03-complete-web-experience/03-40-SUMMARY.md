---
phase: 03-complete-web-experience
plan: "40"
subsystem: admin-web-security
tags: [nextjs, proxy, origin-isolation, localization, accessibility, tdd]

requires:
  - phase: 03-complete-web-experience
    plan: "39"
    provides: Completed account workspace while preserving independent account/admin origins
provides:
  - Dedicated `admin.localhost:3002` development launch and canonical localized admin entries
  - Exact request-host admission that remains fail-closed before React
  - Localized static HTML denial for browser navigation and bounded JSON denial for programmatic clients
affects: [03-41, admin-goldens, admin-accessibility, web-evidence]

tech-stack:
  added: []
  patterns:
    - Request intent requires navigation metadata plus HTML acceptance before returning an authored document
    - Administrative admission compares the normalized request Host and protocol to one configured exact origin
    - Rejection responses share one no-store, nonce-bearing, frame-closed security header contract

key-files:
  created: []
  modified:
    - apps/admin/package.json
    - apps/admin/proxy.ts
    - apps/admin/src/admin-runtime.ts
    - apps/admin/src/admin-security.test.ts

key-decisions:
  - "Bind ordinary local admin development to http://admin.localhost:3002 and publish only /pt-BR/admin and /en/admin as UAT entries."
  - "Classify an HTML denial only when navigation metadata and text/html acceptance agree; ambiguous or programmatic requests retain bounded JSON."
  - "Use the normalized Host header plus request protocol for exact admission because Next can normalize nextUrl.origin to the bound server hostname."
  - "Keep browser denial copy generic and localized while preserving only an already-present, syntax-bounded request identifier."

patterns-established:
  - "Fail-closed document denial: static semantic HTML with localized recovery, no React execution, no preview data, and a CSP nonce."
  - "Host-aware proxy admission: malformed or non-canonical Host values terminate before NextResponse.next()."

requirements-completed: [WEB-08]
duration: 14min
completed: 2026-07-31
status: complete
---

# Phase 03 Plan 40: Isolated Admin Admission and Browser Denial Summary

**Exact-host admin admission now launches at `admin.localhost:3002`, reaches canonical localized entries, and returns accessible bilingual HTML to rejected navigation without weakening bounded JSON or pre-React fail-closed behavior.**

## Performance

- **Duration:** 14 min
- **Started:** 2026-08-01T00:23:58Z
- **Completed:** 2026-08-01T00:37:42Z
- **Tasks:** 2
- **Files modified:** 4

## Accomplishments

- Aligned the ordinary admin development command and bounded local runtime default on the exact `http://admin.localhost:3002` origin, while retaining explicit HTTPS production-origin validation and rejecting generic, suffix, and wildcard lookalikes.
- Published immutable `/pt-BR/admin` and `/en/admin` entry identities so a bare locale path cannot hide an earlier admission failure.
- Added static PT-BR and English denial documents with semantic headings, readable recovery, keyboard-visible focus, forced-colors support, no application data, and nonce-compatible inline styling.
- Kept non-navigation denials as bounded JSON with equivalent reason semantics and proved origin, cross-surface cookie, unsafe-context, and unknown-role rejection branches never call `NextResponse.next()`.
- Verified the real Next development launch: canonical admin navigation returns `200 text/html`, generic-localhost document navigation returns `403 text/html`, and generic-localhost programmatic access returns `403 application/json`.

## Task Commits

Each TDD gate and implementation was committed atomically:

1. **Task 1 RED: Align the dedicated admin origin and canonical entry** - `f78100e` (test)
2. **Task 1 GREEN: Align the dedicated admin origin and canonical entry** - `b4e2597` (feat)
3. **Task 2 RED: Return safe localized browser denial without forwarding** - `0f403b5` (test)
4. **Task 2 GREEN: Return safe localized browser denial without forwarding** - `45cdd8b` (feat)
5. **Rule 1 RED: Reproduce normalized Host bypass** - `8bc6a37` (test)
6. **Rule 1 GREEN: Enforce request Host admission** - `e3a6e6e` (fix)

## Files Created/Modified

- `apps/admin/package.json` - Binds the approved Next webpack development mode to `admin.localhost:3002`.
- `apps/admin/proxy.ts` - Enforces host-aware exact-origin admission and emits request-intent-aware localized HTML or bounded JSON denials.
- `apps/admin/src/admin-runtime.ts` - Owns the bounded local origin, canonical localized entries, and frozen denial copy.
- `apps/admin/src/admin-security.test.ts` - Covers launcher alignment, origin lookalikes, canonical paths, localization, escaping, response shape, headers, and non-forwarding.
- `apps/admin/src/proxy.ts` - Verified unchanged as the thin Next proxy delegator.

## Decisions Made

- Kept the local default on a dedicated `.localhost` hostname instead of weakening admission to generic localhost or a suffix rule.
- Required both browser-navigation metadata and HTML acceptance before serving a document, preventing programmatic requests that merely advertise `text/html` from receiving browser-oriented output.
- Used a generic bilingual denial explanation for every rejection category; detailed reason codes remain only in bounded JSON, and no role, fixture, cookie, unsafe URL, or application state enters browser output.
- Compared the request Host header and protocol to the configured origin because live Next 16 development normalized `nextUrl.origin` to the bound host even when the incoming Host was generic localhost.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Security Bug] Closed normalized Host admission bypass**

- **Found during:** Overall live verification after Task 2
- **Issue:** Next 16 normalized `request.nextUrl.origin` to `admin.localhost:3002`, so a live request carrying `Host: localhost:3002` incorrectly reached React with HTTP 200 despite the exact-origin unit contract.
- **Fix:** Derived a validated request origin from the normalized Host header and request protocol, rejected malformed values, and supplied it explicitly to the admission boundary.
- **Files modified:** `apps/admin/proxy.ts`, `apps/admin/src/admin-security.test.ts`
- **Verification:** Regression test passes; live canonical host returns 200 while generic localhost returns HTML/JSON 403 according to request intent.
- **Committed in:** `8bc6a37`, `e3a6e6e`

---

**Total deviations:** 1 auto-fixed (1 Rule 1 security bug)
**Impact on plan:** The fix is required by the plan's exact-origin threat mitigation and narrows admission without changing architecture or visual-redesign scope.

## Issues Encountered

- A type-check launched concurrently with `next build` briefly observed Next regenerating `.next/types`; sequential verification passed cleanly. No source change was required.

## Known Stubs

None. No placeholder, TODO, empty UI data source, or deferred denial behavior was introduced in the modified files.

## User Setup Required

None - the dedicated local hostname uses the standard `.localhost` loopback convention and the package command supplies the approved host and port.

## Next Phase Readiness

- Plan 03-41 can redesign the admitted admin shell and refresh visual evidence without revisiting routing or weakening origin isolation.
- Human visual approval remains intentionally outstanding for Plan 03-41; this plan captured or promoted no visual baseline.
- No blockers remain for the admin visual redesign.

## TDD Gate Compliance

- RED commits: `f78100e`, `0f403b5`, `8bc6a37`
- GREEN commits: `b4e2597`, `45cdd8b`, `e3a6e6e`

## Self-Check: PASSED

- Summary file exists at the required phase path.
- All six TDD, implementation, and deviation commits exist in repository history.
- All four modified implementation files exist; the thin `apps/admin/src/proxy.ts` delegator remains present and unchanged.

---
*Phase: 03-complete-web-experience*
*Completed: 2026-07-31*
