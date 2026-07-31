---
phase: 03-complete-web-experience
plan: "20"
subsystem: public-web-home
tags: [nextjs, react, bilingual-content, evidence, accessibility, responsive-design]
requires:
  - phase: 03-15
    provides: static bilingual public shell and canonical public-origin navigation
  - phase: 03-18
    provides: shared Command Runway, product stage, evidence row, and status primitives
  - phase: 03-19
    provides: repository content validation and public-only admission boundary
provides:
  - Bilingual long-form Prepare-Prove-Restore Home narrative
  - Responsive Command Runway and evidence-led editorial chapters
  - Hash- and sidecar-validated real desktop capture admission gate
  - Production-static Home routes for PT-BR and English
affects: [03-21, 03-29, 03-30, 03-32]
tech-stack:
  added: []
  patterns:
    - Server-owned media provenance with an app-local client boundary for shared UI primitives
    - Content and compatibility action precede optional product media in source and visual order
    - Missing public proof renders an explicit owned evidence state instead of substitute imagery
key-files:
  created:
    - apps/web/src/app/[locale]/page.tsx
    - apps/web/src/features/home.tsx
    - apps/web/src/features/home-web-components.tsx
    - apps/web/src/styles/public.css
    - apps/web/src/content/public/home.pt-BR.json
    - apps/web/src/content/public/home.en.json
    - apps/web/src/home-content.test.ts
    - apps/web/src/home.test.tsx
    - apps/web/vitest.config.ts
    - packages/web-features/src/styles.d.ts
  modified:
    - packages/web-features/src/components.tsx
    - packages/web-features/src/index.ts
    - .planning/phases/03-complete-web-experience/deferred-items.md
key-decisions:
  - "Render the complete Home journey while failing the product stage closed until Plan 03-29 supplies an approved real desktop capture and matching checksum."
  - "Keep filesystem and hash validation in the Home server composition, with an app-local client boundary around shared web UI primitives."
  - "Expose localized evidence metadata and full-screenshot labels through backward-compatible shared component props."
patterns-established:
  - "Evidence-first media gate: image presence alone is insufficient; locale, version, scenario, review state, source commit, capture command, viewport, and checksum must agree."
  - "Editorial evidence chapters: every claim displays source, scope, version, validation state, and the explicit unproven boundary."
requirements-completed: [WEB-01]
duration: 3h23m
completed: 2026-07-31
status: complete
---

# Phase 3 Plan 20: Long-form Public Home Summary

**A cinematic bilingual Command Runway that sells through preparation, proof, compatibility, and recovery while refusing unverified product imagery or performance claims.**

## Performance

- **Duration:** 3h23m
- **Started:** 2026-07-31T04:02:31Z
- **Completed:** 2026-07-31T07:25:34Z
- **Tasks:** 2
- **Files modified:** 13

## Accomplishments

- Authored exact-parity PT-BR and English Home records with the approved promise, compatibility CTA, six intentional chapters, and evidence metadata for every material claim.
- Built an asymmetric near-black Command Runway and long-form Evidence Stage that remains readable and unclipped at 1440px, 390px, and 320px.
- Added a fail-closed desktop capture resolver that accepts only validated provenance plus a matching SHA-256 image checksum and exposes no mockup fallback.
- Preserved content-first rendering, complete mobile navigation, one H1, visible trust boundaries, reduced-motion behavior, forced-color borders, and static Next generation.

## Task Commits

Each task was committed atomically:

1. **Task 1: Author the bilingual Prepare-Prove-Restore editorial narrative** — `3b67a3d` (feat)
2. **Task 2: Compose Command Runway and Evidence Stage responsively** — `f10a124` (feat)

## Files Created/Modified

- `apps/web/src/content/public/home.pt-BR.json` — PT-BR promise, chapters, evidence, boundaries, and gated journey.
- `apps/web/src/content/public/home.en.json` — Human-reviewed English parity record.
- `apps/web/src/features/home.tsx` — Admitted content projection, capture gate, Command Runway, evidence chapters, and compatibility journey.
- `apps/web/src/features/home-web-components.tsx` — Explicit Next client boundary for shared web primitives.
- `apps/web/src/app/[locale]/page.tsx` — Static bilingual route and content-specific metadata.
- `apps/web/src/styles/public.css` — Bespoke public Home composition, reflow, focus, reduced-motion, and forced-color treatment.
- `apps/web/src/home-content.test.ts` — Exact parity, schema, evidence, anti-deception, and missing-asset admission checks.
- `apps/web/src/home.test.tsx` — Layout order and screenshot provenance mutation coverage.
- `apps/web/vitest.config.ts` — Vite 8 Oxc JSX transform for render-oriented tests.
- `packages/web-features/src/components.tsx` — Localized evidence labels and screenshot action/priority props.
- `packages/web-features/src/index.ts` / `styles.d.ts` — Typed package-owned CSS side effect.
- `.planning/phases/03-complete-web-experience/deferred-items.md` — Downstream final-evidence readiness ownership.

## Decisions Made

- The real product stage is an evidence boundary, not a decorative slot. Until a capture passes the generated sidecar schema and its bytes match the sidecar checksum, the Home renders `CAPTURE_MISSING` and no image or full-screenshot control.
- The public page remains a server composition for content and filesystem trust decisions. Shared interactive UI stays behind one narrowly scoped app-local client boundary.
- English and PT-BR share identical authored structure, claim identifiers, evidence indexes, metadata keys, route authority, channel, and version while retaining natural locale-specific copy.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 2 - Missing Critical Functionality] Added executable Home content and render verification**

- **Found during:** Task 1 and Task 2 verification
- **Issue:** The planned focused test commands previously matched no Home-owned contract, so they could pass without proving locale parity, anti-deception, media ordering, or capture rejection.
- **Fix:** Added Home content/render tests plus a Vite 8 Oxc JSX configuration; covered exact copy, evidence parity, admission failure, checksum, scenario, review, and capture-command mutations.
- **Files modified:** `apps/web/src/home-content.test.ts`, `apps/web/src/home.test.tsx`, `apps/web/vitest.config.ts`
- **Verification:** 16 web app tests pass, including all Home content and capture gate cases.
- **Commit:** `f10a124`

**2. [Rule 3 - Blocking] Isolated shared client UI from the server-side provenance resolver**

- **Found during:** Task 2 production build
- **Issue:** Importing the shared web-features barrel directly from the server composition pulled React Aria client-only modules into a Server Component.
- **Fix:** Added a small `'use client'` re-export boundary while keeping file reads, sidecar validation, and hashing in the server composition.
- **Files modified:** `apps/web/src/features/home-web-components.tsx`, `apps/web/src/features/home.tsx`
- **Verification:** `next build --webpack` statically generates `/pt-BR` and `/en`.
- **Commit:** `f10a124`

**3. [Rule 2 - Missing Critical Functionality] Localized shared evidence and screenshot labels**

- **Found during:** Task 2 bilingual composition
- **Issue:** Shared evidence and complete-screenshot labels were hardcoded in English, which would leak English metadata into the PT-BR Home.
- **Fix:** Added backward-compatible localized label and unproven-boundary props, plus explicit screenshot action and loading props.
- **Files modified:** `packages/web-features/src/components.tsx`
- **Verification:** web-features tests, app TypeScript, lint, and both locale renders pass.
- **Commit:** `f10a124`

**Total deviations:** 3 auto-fixed (2 missing critical functionality, 1 blocking integration issue).

## Visual and Accessibility Verification

- **1440×900 English:** one H1, no horizontal overflow (`1440/1440`), compatibility CTA resolves to `/en/compatibility`, four major regions, no image while capture evidence is absent.
- **390×844 PT-BR:** no horizontal overflow (`390/390`); visual order is CTA (`582px`) → trust boundary (`710px`) → product evidence stage (`850px`).
- **320×800 English:** no horizontal overflow (`320/320`), no clipped heading/body text, full-screen menu exposes all 10 links, keyboard focus advances into the menu.
- Reduced motion was active for all live captures. Wide and mobile review screenshots were saved outside the repository in the session visualization directory.

## Verification

- `pnpm --filter @liiiraa/web test -- --run -t "Home content contract"` — PASS
- `pnpm --filter @liiiraa/web test -- --run -t "Home"` — PASS
- `pnpm --filter @liiiraa/web-features test` — PASS
- `pnpm web:check` — PASS across all seven web packages
- `pnpm web:test` — PASS across all seven web packages
- `pnpm --filter @liiiraa/web build` — PASS; both locale routes statically generated
- Focused ESLint and Prettier checks — PASS
- `pnpm web:verify:quick -- --requirement WEB-01 --grep "W01|W02|Home"` — implementation checks/tests PASS; final Phase 3 readiness remains intentionally red for the Plan 03-32-owned public build root and evidence reports, recorded in `deferred-items.md`

## Known Stubs

- `apps/web/src/features/home.tsx` intentionally renders an owned `CAPTURE_MISSING` product stage until Plan 03-29 supplies the executable desktop WebP and approved sidecar. The gate is tested to reject absent, unapproved, wrong-scenario, non-desktop, and checksum-mismatched inputs; it does not prevent the truthful current Home journey.
- “Public download is not available yet” is an intentional distribution safety gate, not placeholder copy. No bypass or inactive control is rendered.

## Issues Encountered

- Final `WEB-01` readiness artifacts do not yet exist because Plan 03-32 owns their promotion after all public routes and real captures are complete. No provisional evidence file was created.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness

- Plan 03-21 can extend the same admitted bilingual editorial/content pattern across the public catalog.
- Plan 03-29 has an exact capture handoff: `/public/product/desktop-home.{locale}.webp` plus matching generated `ScreenshotProvenance` sidecar, scenario `S01`, approved review state, and byte checksum.
- Plan 03-32 must promote final route/content/visual evidence after those downstream plans complete.

## Self-Check: PASSED

- All five plan-owned primary artifacts exist.
- Task commits `3b67a3d` and `f10a124` exist in repository history.
- Focused Home tests, full web checks/tests, production build, lint, formatting, and live 1440/390/320 verification passed.

---

_Phase: 03-complete-web-experience_
_Completed: 2026-07-31_
