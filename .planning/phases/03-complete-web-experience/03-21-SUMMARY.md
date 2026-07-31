---
phase: 03-complete-web-experience
plan: '21'
subsystem: public-web-catalog
tags: [nextjs, react, bilingual-content, search, policies, accessibility]
requires:
  - phase: 03-20
    provides: bilingual public shell and evidence-led Home route
provides:
  - Bilingual product, evidence, compatibility, plans, search, and support catalog
  - Versioned privacy, terms, security, disclosure, status, and incident-history content
  - Canonical localized 403, 410, and 500 recovery experiences
  - Public-only explicit-submit URL search with typed filters
affects: [03-23, 03-29, 03-30, 03-32]
tech-stack:
  added: []
  patterns:
    - Repository-authored bilingual public records admitted through canonical route IDs
    - Explicit GET search state limited to public content and typed filters
    - Shared localized failure presentation outside Next route modules
key-files:
  created:
    - apps/web/src/app/[locale]/(public)/[[...slug]]/page.tsx
    - apps/web/src/app/[locale]/error.tsx
    - apps/web/src/app/[locale]/forbidden/page.tsx
    - apps/web/src/app/[locale]/gone/page.tsx
    - apps/web/src/content/public/catalog.en.json
    - apps/web/src/content/public/catalog.pt-BR.json
    - apps/web/src/content/public/policies.en.json
    - apps/web/src/content/public/policies.pt-BR.json
    - apps/web/src/features/public-catalog.tsx
    - apps/web/src/features/public-failure.tsx
    - apps/web/src/public-catalog.test.tsx
    - apps/web/src/public-failure.test.tsx
  modified:
    - apps/web/src/app/[locale]/layout.tsx
    - apps/web/src/app/public-shell.css
    - apps/web/src/styles/public.css
    - .planning/phases/03-complete-web-experience/deferred-items.md
key-decisions:
  - 'Use the canonical public-policies route at /[locale]/policies for security content rather than inventing an unmanifested /security route.'
  - 'Fold the locale Home into the optional public catch-all because Next.js rejects duplicate /[locale] and /[locale]/[[...slug]] route specificity.'
  - 'Keep public search as an explicit GET submission over repository-admitted public records only.'
  - 'Render a truthful empty incident history instead of fabricating an operational incident.'
  - 'Keep reusable failure UI outside Next route modules because route modules reject arbitrary named exports.'
patterns-established:
  - 'Public catalog resolution: canonical manifest identity selects repository-authored locale records; unknown identities do not enter the public index.'
  - 'Failure recovery: localized route wrappers delegate to one shared component with focus handoff, opaque diagnostics, and safe destinations.'
requirements-completed: [WEB-01]
duration: 40min
completed: 2026-07-31
status: complete
---

# Phase 03 Plan 21: Public Catalog and Trust Routes Summary

**Bilingual evidence-led product catalog, transparent commercial and policy records, public-only URL search, and localized 403/410/500 recovery**

## Performance

- **Duration:** 40 min
- **Started:** 2026-07-31T08:02:00Z
- **Completed:** 2026-07-31T08:42:00Z
- **Tasks:** 3
- **Files modified:** 17

## Accomplishments

- Authored exact-parity PT-BR and English records for product capabilities, evidence, compatibility, plans, support, policies, disclosure, and operational status without invented results, discounts, incidents, or safety paywalls.
- Rendered the complete canonical public route family with responsive matrices, disclosures, version history, explicit URL-backed search, and a public-only indexing boundary.
- Added semantically distinct localized 403, 410, and 500 experiences with visible headings, focus handoff, opaque diagnostics, preserved locale, and safe recovery destinations.
- Verified 14 canonical routes, five 390×844 mobile routes without horizontal overflow, keyboard/focus behavior, forced colors, reduced motion, and zero serious or critical axe violations.

## Task Commits

Each task was committed atomically:

1. **Task 1: Author product, evidence, compatibility, plan, search, and support records** — `58bcece` (feat)
2. **Task 2: Render public catalog, URL-backed search, policies, status, and disclosure** — `0721cd1` (feat)
3. **Task 3: Author explicit 403, 410, and 500 recovery states** — `8eb2614` (feat)

## Files Created/Modified

- `apps/web/src/content/public/catalog.en.json` — English product, evidence, compatibility, plan, search, and support records.
- `apps/web/src/content/public/catalog.pt-BR.json` — Human-reviewed PT-BR parity records.
- `apps/web/src/content/public/policies.en.json` — English legal, privacy, security, disclosure, status, and incident-history records.
- `apps/web/src/content/public/policies.pt-BR.json` — Human-reviewed PT-BR policy and operational-trust parity records.
- `apps/web/src/app/[locale]/(public)/[[...slug]]/page.tsx` — Canonical public route resolution, static parameters, and metadata.
- `apps/web/src/features/public-catalog.tsx` — Catalog layouts, support matrix, plan comparison, GET search, policies, status, and incident timeline.
- `apps/web/src/app/[locale]/error.tsx` — Localized 500 boundary.
- `apps/web/src/app/[locale]/forbidden/page.tsx` — Localized 403 route.
- `apps/web/src/app/[locale]/gone/page.tsx` — Localized 410 route.
- `apps/web/src/features/public-failure.tsx` — Shared accessible failure presentation and focus handoff.
- `apps/web/src/app/[locale]/layout.tsx` — Locale shell integration for failure and catch-all routes.
- `apps/web/src/app/[locale]/page.tsx` — Removed after Home moved into the canonical optional catch-all.
- `apps/web/src/app/public-shell.css` — Forced-colors and accessible-name refinements.
- `apps/web/src/styles/public.css` — Responsive catalog, policy, search, and failure styling.
- `apps/web/src/public-catalog.test.tsx` — Public content, anti-deception, route, and search coverage.
- `apps/web/src/public-failure.test.tsx` — 403/410/500 semantics, redaction, locale, and recovery coverage.
- `.planning/phases/03-complete-web-experience/deferred-items.md` — Plan 03-32 evidence ownership and standalone packaging observations.

## Decisions Made

- Used canonical `public-policies` at `/[locale]/policies` for the security document because the route manifest is the authority; no unmanifested `/security` path was added.
- Folded Home into the optional catch-all so `/[locale]` remains valid without conflicting Next.js route specificity.
- Kept search user-initiated and URL-backed through GET parameters, with results restricted to repository-admitted public records.
- Preserved an empty incident history with explicit explanatory copy because no confirmed public incident exists.
- Moved reusable failure components to `apps/web/src/features/public-failure.tsx` to comply with Next.js route-module export rules.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] Folded Home into the public optional catch-all**

- **Found during:** Task 2 production build
- **Issue:** Next.js rejected sibling `/[locale]` and `/[locale]/[[...slug]]` routes because they resolve to duplicate specificity.
- **Fix:** Made the optional catch-all the canonical locale entry and removed the conflicting route module while preserving Home behavior.
- **Files modified:** `apps/web/src/app/[locale]/(public)/[[...slug]]/page.tsx`, `apps/web/src/app/[locale]/page.tsx`
- **Verification:** Webpack production build and live locale Home routes pass.
- **Commit:** `0721cd1`

**2. [Rule 3 - Blocking] Moved shared failure components out of route modules**

- **Found during:** Task 3 production build
- **Issue:** Next.js route modules reject arbitrary named exports used to share the failure presentation.
- **Fix:** Added `apps/web/src/features/public-failure.tsx` and kept each route module limited to supported exports.
- **Files modified:** `apps/web/src/features/public-failure.tsx`, `apps/web/src/app/[locale]/error.tsx`, `apps/web/src/app/[locale]/forbidden/page.tsx`, `apps/web/src/app/[locale]/gone/page.tsx`
- **Verification:** TypeScript, tests, and webpack production build pass.
- **Commit:** `8eb2614`

**3. [Rule 2 - Missing Critical Functionality] Hardened accessibility across catalog and failure states**

- **Found during:** Tasks 2 and 3 browser verification
- **Issue:** CTA contrast, forced-colors text, the mobile brand accessible name, and server-rendered failure focus handoff needed explicit treatment to meet the accessibility contract.
- **Fix:** Adjusted token-backed contrast and forced-color styles, supplied the mobile brand name, and added deterministic client focus handoff for failure headings.
- **Files modified:** `apps/web/src/styles/public.css`, `apps/web/src/app/public-shell.css`, `apps/web/src/features/public-failure.tsx`
- **Verification:** Keyboard/focus checks pass; forced-colors and reduced-motion checks report zero serious or critical axe violations.
- **Commits:** `0721cd1`, `8eb2614`

---

**Total deviations:** 3 auto-fixed (1 missing critical functionality, 2 blocking issues)

## Verification

- Web TypeScript check — PASS.
- All 23 web tests — PASS.
- Scoped ESLint and Prettier — PASS.
- Next.js webpack production build — PASS.
- Browser verification across 14 canonical routes — PASS.
- Five mobile routes at 390×844 with no horizontal overflow — PASS.
- 403/410/500 H1 focus handoff and keyboard reachability — PASS.
- Axe checks, including forced colors and reduced motion — zero serious or critical violations.

## Known Stubs

- `apps/web/src/content/public/policies.en.json:169` — Intentional empty `incidentHistory`; adjacent authored copy states that no confirmed public service incident has been published and defines future disclosure fields.
- `apps/web/src/content/public/policies.pt-BR.json:169` — Intentional PT-BR parity empty state for the same truthful no-incident condition.

These empty arrays represent current operational truth and do not prevent the plan goal.

## Issues Encountered

- `web:verify:quick` completes implementation checks and tests, then stops at public evidence artifacts owned by Plan 03-32. No provisional evidence was fabricated.
- Standalone output omits `ajv/dist/runtime/ucs2length`; the webpack production build passes, and browser QA used the webpack development output. This packaging observation is deferred for its owning plan.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness

- Canonical public routes, content records, public search, and trust states are ready for Plan 03-32 final evidence promotion.
- Plan 03-32 must produce the public route, content-publication, and visual evidence artifacts before the phase-level readiness gate can pass.

## Self-Check: PASSED

- All 16 implementation files represented by commits `58bcece` through `8eb2614` exist in the expected final state; the intentional `apps/web/src/app/[locale]/page.tsx` deletion is documented.
- Task commits `58bcece`, `0721cd1`, and `8eb2614` are present in repository history.
- Required summary and deferred-item planning artifacts are present.

---

_Phase: 03-complete-web-experience_
_Completed: 2026-07-31_
