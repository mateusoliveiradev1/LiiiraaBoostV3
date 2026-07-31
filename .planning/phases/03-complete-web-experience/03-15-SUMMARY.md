---
phase: 03-complete-web-experience
plan: "15"
subsystem: public-web-shell
tags: [nextjs, next-intl, csp, sitemap, robots, accessibility, static-rendering]
requires:
  - phase: 03-complete-web-experience
    provides: canonical route projections, bilingual locale authority, web evidence gates
provides:
  - Static-first bilingual public shell with explicit public-origin boundary
  - Rendering-aware CSP, security headers, and production probe result
  - Manifest-derived sitemap, robots policy, and localized authored 404
affects: [03-18, 03-20, 03-21, 03-22, 03-30, 03-32]
tech-stack:
  added: [vitest app runner, workspace design-token CSS, self-hosted Manrope and JetBrains Mono]
  patterns:
    - Static locale rendering uses generateStaticParams and setRequestLocale without request APIs
    - Route projections are audited before navigation, sitemap, or robots output
    - Strict CSP remains report-only until production bootstrap violations reach zero
key-files:
  created:
    - apps/web/proxy.ts
    - apps/web/src/public-boundary.ts
    - apps/web/src/public-indexing.ts
    - apps/web/src/public-not-found.ts
    - apps/web/src/app/[locale]/layout.tsx
    - apps/web/src/app/[locale]/not-found.tsx
    - apps/web/src/app/robots.ts
    - apps/web/src/app/sitemap.ts
    - apps/web/src/app/public-shell.css
  modified:
    - apps/web/next.config.ts
    - apps/web/package.json
    - pnpm-lock.yaml
key-decisions:
  - "Keep nonce-free public rendering static: enforce compatible structural CSP while strict script/style directives remain report-only with an observed blocker."
  - "Publish only concrete canonical sitemap URLs; account for unresolved dynamic route families without emitting bracket placeholders."
  - "Build the public app with Next's supported webpack path and a NodeNext extension alias until Turbopack resolves workspace .js-to-TypeScript specifiers."
patterns-established:
  - "Public boundary: locale negotiation may inspect requests in proxy.ts, but localized page rendering must not call headers() or cookies()."
  - "Indexing boundary: every supplied projection is audited against web-core before output; private, preview, obsolete, error, and internal-search routes fail closed."
requirements-completed: [WEB-01, WEB-02, WEB-03, WEB-08]
metrics:
  duration: 22min
  completed: 2026-07-31
  tasks: 2
  files: 16
status: complete
---

# Phase 3 Plan 15: Static Public Shell and Indexing Boundary Summary

**Bilingual static public shell with manifest-owned navigation, rendering-aware CSP, concrete-only sitemap output, closed robots policy, and an explicit localized 404.**

## Performance

- **Duration:** 22 minutes
- **Started:** 2026-07-31T05:00:45.851Z
- **Completed:** 2026-07-31T05:22:53.549Z
- **Tasks:** 2
- **Files modified:** 16

## Accomplishments

- Built the PT-BR/English public shell with canonical route navigation, skip link, main-landmark handoff, full-screen mobile disclosure, locale/search/release controls, origin-boundary notice, safe account transition, footer, self-hosted fonts, reduced-motion, forced-colors, and responsive reflow behavior.
- Added public-origin headers that prohibit third-party origins, framing, objects, unused permissions, and external form actions while keeping the stricter inline-free policy measurable in report-only mode.
- Generated static `robots.txt` and `sitemap.xml` from audited web-core projections, rejected missing/extra/private mutations, omitted unresolved content templates instead of publishing invalid URLs, and authored an explicit bilingual focus-managed 404.

## Task Commits

Each task was committed atomically:

1. **Task 1: Implement the static public security and locale boundary** — `5b16789` (feat)
2. **Task 2 RED: Specify route/indexing and 404 behavior** — `cd43e8b` (test)
3. **Task 2 GREEN: Project indexing and authored public failure navigation** — `e435631` (feat)

## Files Created/Modified

- `apps/web/next.config.ts` — Static public header contract, report-only CSP probe, and workspace-compatible webpack resolution.
- `apps/web/proxy.ts` — Cookie-free, locale-prefixed next-intl request boundary.
- `apps/web/src/public-boundary.ts` — Canonical locale, navigation, and cross-origin link projection.
- `apps/web/src/app/[locale]/layout.tsx` — Static localized public shell and metadata.
- `apps/web/src/app/public-shell.css` — Locked Pre-Dawn shell, mobile menu, focus, forced-colors, and error-state styling.
- `apps/web/src/public-indexing.ts` — Audited sitemap/robots projection with concrete-route readiness accounting.
- `apps/web/src/app/sitemap.ts` — Next metadata sitemap with bilingual alternates.
- `apps/web/src/app/robots.ts` — Next metadata robots policy.
- `apps/web/src/public-not-found.ts` — Localized redacted 404 model and focus-managed composition.
- `apps/web/src/app/[locale]/not-found.tsx` — Locale-preserving authored 404 route boundary.
- `apps/web/src/public-shell.test.ts` — Public shell and CSP contract tests.
- `apps/web/src/public-indexing.test.tsx` — TDD sitemap, robots, mutation, and 404 tests.
- `apps/web/public/fonts/*` — Local Manrope and JetBrains Mono variable assets.
- `apps/web/package.json`, `pnpm-lock.yaml` — App-local approved test/token dependencies and deterministic lifecycle.

## Decisions Made

- Public pages stay nonce-free and request-API-free so CDN/static eligibility remains intact. The production build currently emits six inline scripts and one inline style block, so inline-free `script-src`/`style-src` remain report-only instead of being misrepresented as enforceable.
- Dynamic manifest route families are covered by the projection audit but do not enter sitemap XML until concrete admitted content paths exist. Publishing literal `[version]`, `[article]`, or similar placeholders would create invalid index targets.
- `next build --webpack` is explicit for this app because the pinned Turbopack path does not resolve the repository's NodeNext `.js` source specifiers. The webpack extension alias preserves canonical workspace imports without rewriting package contracts.

## CSP Production Probe

- Production route manifest contains both `Content-Security-Policy` and `Content-Security-Policy-Report-Only`.
- No `Set-Cookie` header is present.
- Inline-free report-only policy remains blocked by **6 inline scripts** and **1 inline style block** in the generated not-found artifact.
- No directive was silently weakened or promoted; later SRI/hash evidence must reduce these violations to zero before strict script/style enforcement.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 2 - Missing Critical] Materialized the app-local verification and visual support files**

- **Found during:** Task 1
- **Issue:** The planned file list omitted the executable test runner, canonical token dependency, shell stylesheet, pure boundary helper, tests, and self-hosted font assets required by the task's own acceptance criteria.
- **Fix:** Added only already-approved workspace tokens, Vitest 4.1.10, app-local tests/helpers, authored CSS, and existing repository font assets.
- **Files modified:** `apps/web/package.json`, `pnpm-lock.yaml`, `apps/web/src/public-boundary.ts`, `apps/web/src/app/public-shell.css`, `apps/web/src/public-shell.test.ts`, `apps/web/public/fonts/*`
- **Verification:** Focused tests, TypeScript check, and production build pass.
- **Commit:** `5b16789`

**2. [Rule 3 - Blocking] Routed Next builds through workspace-compatible webpack resolution**

- **Found during:** Tasks 1 and 2
- **Issue:** Next 16 Turbopack and metadata-route loading could not resolve NodeNext `.js` specifiers to TypeScript workspace sources, blocking canonical `@liiiraa/web-core` consumption.
- **Fix:** Made the app build use `next build --webpack` and added `.js`/`.mjs` extension aliases in the existing Next config.
- **Files modified:** `apps/web/package.json`, `apps/web/next.config.ts`
- **Verification:** `pnpm --filter @liiiraa/web verify` completes and reports all metadata routes as static.
- **Commits:** `5b16789`, `e435631`

**3. [Rule 1 - Bug] Prevented unresolved route templates from leaking into sitemap XML**

- **Found during:** Task 2 production artifact inspection
- **Issue:** A literal projection of dynamic manifest families produced invalid URLs such as `/docs/[version]/articles/[article]`.
- **Fix:** Audit the complete canonical projection, emit both locales only for concrete routes, and retain explicit unresolved-route accounting for future admitted content expansion.
- **Files modified:** `apps/web/src/public-indexing.ts`, `apps/web/src/public-indexing.test.tsx`
- **Verification:** Production sitemap contains no `[` placeholders; omission/private/extra mutations fail.
- **Commit:** `e435631`

**Total deviations:** 3 auto-fixed (1 missing critical, 1 blocking integration, 1 output bug).

## Issues Encountered

- `pnpm web:verify:quick -- --requirement WEB-08` intentionally remains red for missing account/admin build roots and `security-boundaries.json` / `preview-boundaries.json`. Plan 03-14 defines this as staged downstream readiness owned by Plans 03-26 through 03-32, not a Plan 03-15 failure.

## Known Stubs

None.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness

- Plans 03-18 through 03-25 can compose public content inside a stable localized shell and reuse the canonical public-origin/indexing boundary.
- Plan 03-30 can promote browser/header evidence after account/admin artifacts exist.
- Plan 03-32 must keep strict CSP promotion blocked until the inline production probe is clean or an approved hash/SRI strategy is proven.

## Self-Check: PASSED

- All 10 required implementation and summary files exist.
- Task commits `5b16789`, `cd43e8b`, and `e435631` exist in repository history.
- Focused tests, full app verify, static metadata build, route-manifest header probe, concrete sitemap scan, and robots exclusion scan passed.

---

*Phase: 03-complete-web-experience*
*Completed: 2026-07-31*
