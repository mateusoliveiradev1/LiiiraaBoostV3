---
phase: 03-complete-web-experience
plan: "16"
subsystem: account-ui-security
tags: [nextjs, csp, nonce, account, accessibility, noindex]
requires:
  - phase: 03-11
    provides: web workspace dependencies and independent app lifecycle
  - phase: 03-12
    provides: canonical routes and safe cross-origin context
  - phase: 03-14
    provides: web evidence and acceptance policy
provides:
  - Dynamic nonce CSP and private indexing policy for the account origin
  - Responsibility-led localized account shell with persistent disconnected-preview provenance
  - Authored localized and redacted account 404/500 recovery boundaries
affects: [03-17, 03-18, 03-27, account-workflows, web-verification]
tech-stack:
  added: [vitest]
  patterns:
    - Testable root account policy with a src-level Next.js proxy runtime adapter
    - Canonical web-core route projection for all account navigation and recovery links
    - Client-only design-system provenance isolated behind a local boundary component
key-files:
  created:
    - apps/account/proxy.ts
    - apps/account/src/proxy.ts
    - apps/account/src/account-errors.ts
    - apps/account/src/account-preview-provenance.tsx
    - apps/account/src/account-security.test.ts
    - apps/account/src/account-shell.test.ts
    - apps/account/src/app/account-shell.css
    - apps/account/src/app/[locale]/layout.tsx
    - apps/account/src/app/[locale]/not-found.tsx
    - apps/account/src/app/[locale]/error.tsx
    - apps/account/src/app/[locale]/errors/404/page.tsx
  modified:
    - apps/account/next.config.ts
    - apps/account/package.json
    - pnpm-lock.yaml
key-decisions:
  - "The account origin accepts only web-core-validated destination and return-route context and never creates session authority."
  - "The canonical account 404 route is the first executable App Router surface so the shell and proxy are verifiable before Plan 03-27 adds account workflows."
  - "The design-system provenance mark is rendered through a client boundary so the public package root remains compatible with the server layout."
patterns-established:
  - "Account security policy: random request nonce, strict-dynamic CSP, exact noindex headers, no cookies, and no redirects."
  - "Account navigation: every responsibility comes from canonical account route IDs with full text at every viewport."
requirements-completed: [WEB-08]
duration: 20min
completed: 2026-07-31
status: complete
---

# Phase 03 Plan 16: Account Security Shell Summary

**Dynamic nonce CSP and a responsibility-led localized account shell with persistent disconnected authority, canonical navigation, and redacted authored recovery states.**

## Performance

- **Duration:** 20 min
- **Started:** 2026-07-31T05:25:00Z
- **Completed:** 2026-07-31T05:45:20Z
- **Tasks:** 2
- **Files modified:** 14

## Accomplishments

- Enforced an account-only request boundary with cryptographically random nonces, `strict-dynamic`, frame/object/base denial, exact noindex policy, private caching, and no session or redirect issuance.
- Built a bilingual responsibility shell with one focusable main landmark, canonical Overview through Support links, explicit cross-origin notices, full-label mobile reflow, and an always-visible deterministic-preview rail.
- Added explicit localized 404 and 500 states with safe recovery, preserved non-sensitive-work language, and correlation IDs that reject diagnostic or personal-data leakage.
- Verified the policy against two live requests: distinct CSP nonces, no cookies or redirects, noindex/noarchive, `strict-dynamic`, and frame denial.

## Task Commits

Each task was committed atomically:

1. **Task 1 RED: Account security boundary tests** - `5fab439` (test)
2. **Task 1 GREEN: Account security boundary** - `8ab0600` (feat)
3. **Task 2: Account shell and authored failures** - `cbcf24a` (feat)
4. **Runtime activation deviation fix** - `4cbb17f` (fix)

## Files Created/Modified

- `apps/account/proxy.ts` - Testable account nonce, header, and safe-context policy.
- `apps/account/src/proxy.ts` - Next.js src-router runtime entry for the account proxy.
- `apps/account/next.config.ts` - Isolated account origin/build identity and webpack workspace resolution.
- `apps/account/src/app/[locale]/layout.tsx` - Localized AccountShell and persistent preview boundary.
- `apps/account/src/app/account-shell.css` - Product-register shell, responsive, focus, reduced-motion, and forced-colors styling.
- `apps/account/src/account-errors.ts` - Localized failure models and diagnostic redaction.
- `apps/account/src/app/[locale]/not-found.tsx` - Authored account 404 presentation.
- `apps/account/src/app/[locale]/error.tsx` - Authored resettable account 500 boundary.
- `apps/account/src/app/[locale]/errors/404/page.tsx` - Canonical executable 404 route.
- `apps/account/src/account-preview-provenance.tsx` - Client boundary for public-root design-system provenance.
- `apps/account/src/account-security.test.ts` - Nonce, header, context, cookie, and redirect tests.
- `apps/account/src/account-shell.test.ts` - Navigation, accessibility, reflow, forced-colors, and error tests.
- `apps/account/package.json` - Vitest and independent webpack lifecycle commands.
- `pnpm-lock.yaml` - Locked account Vitest importer.

## Decisions Made

- Used Web Crypto entropy for 144-bit base64 nonces so the implementation remains cryptographically random without route, locale, scenario, or clock inputs.
- Kept safe context non-authoritative and admitted it only when `createBoundaryLink` verifies the account destination and public return route.
- Grouped Subscription and Invoices as one visible responsibility while retaining both canonical route IDs.
- Used a dedicated client component for the design-system provenance mark because the package root includes React Aria client modules.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] Aligned account builds with workspace TypeScript extension resolution**

- **Found during:** Task 2 production verification
- **Issue:** Next webpack could not resolve workspace `.js` exports backed by TypeScript source, and Turbopack ignored the established extension alias.
- **Fix:** Added the same `.js`/`.mjs` extension aliases used by the public app and selected webpack for Account build/dev lifecycle scripts.
- **Files modified:** `apps/account/next.config.ts`, `apps/account/package.json`
- **Verification:** `rtk pnpm --filter @liiiraa/account verify`
- **Commit:** `cbcf24a`, completed by `4cbb17f`

**2. [Rule 2 - Missing Critical] Activated the proxy and shell in the src-based App Router**

- **Found during:** Plan-level live header verification
- **Issue:** A root `proxy.ts` is not discovered beside `src/app`, and without a concrete page Next omitted the account proxy/layout from the production route graph.
- **Fix:** Added `src/proxy.ts`, the canonical authored 404 route, and a client-only provenance adapter. This activates the security boundary without inventing Phase 03-27 account content.
- **Files modified:** `apps/account/src/proxy.ts`, `apps/account/src/app/[locale]/errors/404/page.tsx`, `apps/account/src/account-preview-provenance.tsx`, `apps/account/src/app/[locale]/layout.tsx`
- **Verification:** Next build reports `ƒ Proxy (Middleware)`; two live `/en/errors/404` requests returned different CSP nonces with no cookies or redirects.
- **Commit:** `4cbb17f`

**Total deviations:** 2 auto-fixed (1 blocking build issue, 1 missing runtime boundary).

**Impact:** Both fixes are required for the planned security and shell contracts to exist in a real Next.js runtime; no future account authority or workflow content was added.

## Issues Encountered

- Context7 was unavailable, so version-specific proxy placement and request-header behavior were verified against the installed Next.js 16.2.12 documentation and official online documentation.
- `next start` warns for standalone output; the independent live policy check used the webpack development runtime after the standalone build itself passed.

## TDD Gate Compliance

- RED commit: `5fab439` - tests failed because the account proxy did not exist.
- GREEN commit: `8ab0600` - nonce, header, context, cookie, and redirect tests passed.
- Task-level and full Account verification passed after runtime fixes.

## Known Stubs

None. The canonical 404 route intentionally exercises the authored failure boundary; Plan 03-27 will add the account workflow routes without replacing this error contract.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness

- Account workflow plans can render inside a stable localized shell and reuse canonical account/recovery routes.
- Admin isolation work can compare its stricter policy against this account-specific no-session baseline.
- No blockers remain.

## Self-Check: PASSED

- All six key runtime artifacts exist on disk.
- RED, GREEN, shell, and runtime activation commits are present in git history.
- Account verify, live two-request headers, and WEB-08 acceptance policy passed.

---

*Phase: 03-complete-web-experience*
*Completed: 2026-07-31*
