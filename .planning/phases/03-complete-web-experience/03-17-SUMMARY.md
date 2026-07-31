---
phase: 03-complete-web-experience
plan: "17"
subsystem: admin-ui-security
tags: [nextjs, csp, nonce, admin, accessibility, noindex, role-scope]
requires:
  - phase: 03-11
    provides: web workspace dependencies and independent application lifecycle
  - phase: 03-12
    provides: canonical admin routes and safe route generation
  - phase: 03-14
    provides: WEB-08 security evidence acceptance policy
provides:
  - Strict per-request nonce CSP and isolated admin origin/cookie boundary
  - Role-scoped localized operational shell with persistent fixture provenance
  - Mobile-safe viewport gate and authored redacted 403/404/500 recovery states
affects: [03-18, 03-28, 03-30, 03-32, admin-workflows, web-verification]
tech-stack:
  added: [vitest]
  patterns:
    - Testable root admin policy with src-level Next.js proxy runtime adapter
    - Canonical web-core route projection filtered by support, operations, security, and audit role
    - Client-only design-system provenance and route-focus handoff boundaries
key-files:
  created:
    - apps/admin/proxy.ts
    - apps/admin/src/proxy.ts
    - apps/admin/src/admin-runtime.ts
    - apps/admin/src/admin-errors.ts
    - apps/admin/src/admin-failure-view.tsx
    - apps/admin/src/admin-focus-handoff.tsx
    - apps/admin/src/admin-preview-provenance.tsx
    - apps/admin/src/admin-shell.ts
    - apps/admin/src/admin-security.test.ts
    - apps/admin/src/admin-shell.test.ts
    - apps/admin/src/app/admin-shell.css
    - apps/admin/src/app/[locale]/layout.tsx
    - apps/admin/src/app/[locale]/not-found.tsx
    - apps/admin/src/app/[locale]/error.tsx
    - apps/admin/src/app/[locale]/errors/403/page.tsx
    - apps/admin/src/app/[locale]/errors/404/page.tsx
    - apps/admin/src/app/[locale]/errors/500/page.tsx
  modified:
    - apps/admin/next.config.ts
    - apps/admin/package.json
    - apps/admin/src/index.ts
    - pnpm-lock.yaml
key-decisions:
  - "Admin accepts only a closed deterministic role preview and always reports authoritativeAccessConnected false."
  - "Support is the only roleless published-preview default; explicit unknown roles, foreign origins, cross-surface cookies, and return context fail closed."
  - "Admin navigation is projected from canonical web-core routes per role, never through one omnipotent route set."
patterns-established:
  - "Admin boundary: exact configured origin + random nonce CSP + noindex + no cross-surface cookie/context."
  - "Admin responsive policy: safe review remains available below 960px while high-risk regions are semantically announced and hidden."
requirements-completed: [WEB-08]
status: complete
duration: 16min
completed: 2026-07-31
---

# Phase 3 Plan 17: Isolated Admin Security and Operational Shell Summary

**A separately deployable admin preview with random-nonce CSP, closed role scope, persistent disconnected provenance, viewport-aware safety, and localized redacted failure recovery**

## Performance

- **Duration:** 16 min
- **Started:** 2026-07-31T05:52:19Z
- **Completed:** 2026-07-31T06:07:27Z
- **Tasks:** 2
- **Files modified:** 21

## Accomplishments

- Added the strictest web-surface policy: dedicated configurable admin origin, 144-bit per-request nonce, `strict-dynamic` CSP, frame/object/base denial, same-origin isolation, denied unused permissions, no-referrer, noindex/noarchive, and no response cookie or redirect authority.
- Added `AdminAccessBoundary`, which admits only support, operations, security, and audit fixture roles while always returning `authoritativeAccessConnected:false`; foreign origins, public/account cookies, unsafe return context, and unknown roles fail closed.
- Built a localized dense AdminShell with skip navigation, client route-heading focus handoff, persistent role/provenance rail, canonical role-filtered navigation, one main landmark, and no ordinary public/account link.
- Added a semantic 960px viewport gate that preserves safe mobile review while blocking high-risk action regions, plus reduced-motion, forced-colors, target-size, and reflow behavior.
- Authored localized 403, 404, and 500 states with explicit affected capability, safe-state language, canonical admin-only recovery, reset support, and correlation IDs that reject diagnostic or personal-data leakage.
- Verified the independent production build and live server: safe request returned HTTP 200 with nonce CSP/noindex/disconnected-role headers and no cookie; an account-cookie request returned HTTP 403.

## Task Commits

Each task was committed atomically:

1. **Task 1 RED: Admin security boundary tests** - `1c02428` (test)
2. **Task 1 GREEN: Isolated admin security boundary** - `f90be0f` (feat)
3. **Task 2: Role-scoped operational shell and failures** - `fc0a0a1` (feat)

## Files Created/Modified

- `apps/admin/proxy.ts` - Random nonce header policy and disconnected access-boundary enforcement.
- `apps/admin/src/proxy.ts` - Next.js src-router proxy discovery entry.
- `apps/admin/src/admin-runtime.ts` - Validated dedicated origin and immutable runtime classification.
- `apps/admin/next.config.ts` - Standalone build identity, no powered-by header, and workspace TypeScript resolution.
- `apps/admin/src/admin-shell.ts` - Closed role model and canonical role-specific navigation projection.
- `apps/admin/src/app/[locale]/layout.tsx` - Localized AdminShell, role rail, viewport gate, and main landmark.
- `apps/admin/src/app/admin-shell.css` - Dense operational layout, 960px gate, focus, reduced-motion, and forced-colors behavior.
- `apps/admin/src/admin-errors.ts` - Localized failure models and bounded correlation redaction.
- `apps/admin/src/admin-failure-view.tsx` - Shared semantic 403/404/500 presentation.
- `apps/admin/src/app/[locale]/not-found.tsx` - Authored locale-preserving 404 boundary.
- `apps/admin/src/app/[locale]/error.tsx` - Authored resettable 500 boundary.
- `apps/admin/src/app/[locale]/errors/403/page.tsx` - Canonical role-denied failure route.
- `apps/admin/src/app/[locale]/errors/404/page.tsx` - Canonical no-redirect 404 route.
- `apps/admin/src/app/[locale]/errors/500/page.tsx` - Canonical deterministic 500 preview route.
- `apps/admin/src/admin-preview-provenance.tsx` - Client boundary for public-root design-system provenance.
- `apps/admin/src/admin-focus-handoff.tsx` - Client route-change H1 focus handoff.
- `apps/admin/src/admin-security.test.ts` - Security, origin, CSP, cookie, and access-boundary tests.
- `apps/admin/src/admin-shell.test.ts` - Role scope, viewport, accessibility, and failure-state tests.
- `apps/admin/src/index.ts` - Published disconnected admin composition with support preview default.
- `apps/admin/package.json` and `pnpm-lock.yaml` - Vitest lifecycle and pinned existing workspace dependency.

## Decisions Made

- The admin origin is an exact validated value. HTTPS is mandatory except for an explicitly configured `*.localhost` HTTP development origin; credentials, paths, queries, and fragments are rejected.
- A role query is fixture-only context, not authorization. Missing role selects the one coherent support preview; invalid explicit roles fail closed.
- Role navigation uses canonical admin routes and fixed non-sensitive fixture identifiers only. No public/account route or arbitrary return URL enters the admin shell.
- Failure recovery remains inside the admin origin and never echoes an error message, stack, target identity, credential, or arbitrary digest.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 2 - Missing Critical] Activated the proxy beside the src-based App Router**

- **Found during:** Task 1 implementation
- **Issue:** Next.js discovers the runtime proxy beside `src/app`; a root-only policy module would remain testable but would not protect production requests.
- **Fix:** Added `apps/admin/src/proxy.ts` as the thin runtime entry while retaining the root module as the testable policy authority.
- **Files modified:** `apps/admin/src/proxy.ts`
- **Verification:** Production build reports `ƒ Proxy (Middleware)` and live response carries nonce CSP/noindex headers.
- **Commit:** `f90be0f`

**2. [Rule 1 - Integration Bug] Allowed the canonical roleless support preview**

- **Found during:** Task 2 navigation integration
- **Issue:** Requiring a `role` query on every URL would reject canonical admin links and make the published coherent preview unusable.
- **Fix:** Missing role now selects support; explicit unknown role remains rejected. Non-support fixture navigation preserves only its closed role value.
- **Files modified:** `apps/admin/proxy.ts`, `apps/admin/src/admin-security.test.ts`
- **Verification:** Full admin test suite passes with roleless support, four scoped roles, and unknown-role rejection.
- **Commit:** `fc0a0a1`

**3. [Rule 3 - Blocking Build] Selected the approved webpack build path**

- **Found during:** Task 2 production build
- **Issue:** Next 16 defaults to Turbopack and refuses a configuration containing the established workspace `.js`/`.mjs` extension aliases.
- **Fix:** Matched the public/account lifecycle by running admin dev/build with `--webpack`.
- **Files modified:** `apps/admin/package.json`
- **Verification:** `rtk pnpm --filter @liiiraa/admin verify` completes type-check, 11 tests, and production build.
- **Commit:** `fc0a0a1`

**Total deviations:** 3 auto-fixed (1 missing runtime activation, 1 navigation integration bug, 1 blocking build issue).
**Impact:** All changes were required for the planned security shell to exist in the real Next.js runtime; no Phase 4 credential or administrative authority was introduced.

## Issues Encountered

- Context7 MCP was unavailable and the `ctx7` CLI was not installed. Version-specific behavior was therefore verified against the installed Next.js 16.2.12 runtime, the already verified account/public patterns, focused tests, production build, and live request smoke.
- `pnpm web:verify:quick -- --requirement WEB-08` ran the full web checks/tests successfully, then intentionally failed readiness on missing final `buildRoots` and `security-boundaries.json` / `preview-boundaries.json`. Those artifacts remain assigned to downstream Phase 3 evidence plans; Plan 03-17 does not fabricate them.

## Known Stubs

None. The `case-preview`, `review-preview`, `diagnostic-preview`, and `event-preview` values are bounded deterministic route parameters for fixture-classified navigation, not rendered customer or operational data.

## Verification

- `rtk pnpm --filter @liiiraa/admin test -- --run -t "admin security boundary"` - PASS, 11 tests in the filtered suite.
- `rtk pnpm --filter @liiiraa/admin test -- --run -t "admin shell|403|404|500"` - PASS, 11 tests in the filtered suite.
- `rtk pnpm --filter @liiiraa/admin verify` - PASS: TypeScript, all tests, and independent Next.js webpack production build.
- `rtk pnpm exec prettier --check "apps/admin/**/*.{ts,tsx,css,json}"` - PASS.
- Live admin server smoke - PASS: HTTP 200 safe route, HTTP 403 account-cookie request, random nonce CSP, noindex/noarchive, no-referrer, disconnected role headers, no `Set-Cookie`.
- Cross-surface comparison - PASS: admin origin differs from public/account, admin CSP excludes public `unsafe-inline`, admin denies additional permissions, and shell contains no public/account navigation.
- `rtk pnpm web:verify:quick -- --requirement WEB-08` - staged readiness FAIL only for downstream final build/evidence roots; all current workspace checks and tests passed.

## Next Phase Readiness

- Admin workflow plans can consume the closed role projection, focus handoff, viewport gate, and authored failure models without adding credential/session authority.
- Final WEB-08 evidence plans must record independent build roots and materialize security/preview boundary evidence before phase verification.
- No Plan 03-17 blocker remains.

## Self-Check: PASSED

- All listed key runtime files and this summary exist on disk.
- RED `1c02428`, GREEN `f90be0f`, and shell `fc0a0a1` commits exist in order.
- Task acceptance tests, independent production build, live headers, and formatting checks passed.

---

*Phase: 03-complete-web-experience*
*Completed: 2026-07-31*
