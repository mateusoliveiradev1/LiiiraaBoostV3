---
phase: 03-complete-web-experience
plan: "73"
subsystem: public-web-acquisition
tags: [nextjs, react, i18n, responsive, accessibility, conversion, evidence]

requires:
  - phase: 03-72
    provides: Final route matrix, checksum-admitted desktop capture, and fail-closed download journey
provides:
  - Bilingual D-102 Home narrative from product proof through acquisition
  - Visually dominant Competitive Mode chapter and transparent Free/Premium decision
  - Explicit four-width responsive contract with no fabricated commercial proof
affects: [03-76-route-matrix, 03-81-candidate-capture, phase-04-control-plane]

tech-stack:
  added: []
  patterns:
    - Repository-owned bilingual conversion movements drive the Home composition
    - Acquisition actions route through canonical public boundaries while real PC analysis remains desktop-owned
    - Product methodology and checksum-admitted captures replace unsupported social or benchmark proof

key-files:
  created: []
  modified:
    - apps/web/src/features/home.tsx
    - apps/web/src/styles/home.css
    - apps/web/src/content/public/home.pt-BR.json
    - apps/web/src/content/public/home.en.json
    - apps/web/src/home.test.tsx

key-decisions:
  - "Keep the existing compatibility metadata contract while adding a dedicated acquisition contract whose primary action reaches the fail-closed download route."
  - "Make Competitive Mode a standalone editorial focal chapter before methodology and plan comparison instead of treating it as only a larger pricing panel."
  - "Use repository-authored product evidence, measurement methodology, and transparent limits instead of testimonials, benchmark gains, customer counts, scores, or certifications."

patterns-established:
  - "Conversion content parity: PT-BR and English expose the same ordered movement IDs, FAQ structure, and action intents."
  - "Responsive Home contract: benefit copy precedes the proof object and explicit 1440/960/390/320 CSS paths preserve containment."

requirements-completed: [WEB-01, WEB-03]

duration: 8min
completed: 2026-08-03
status: complete
---

# Phase 03 Plan 73: Flagship Home Conversion Journey Summary

**A bilingual product-led Home now moves from real desktop proof through Competitive Mode, defensible methodology, plan choice, restoration, and fail-closed acquisition without fabricated performance or social claims.**

## Performance

- **Duration:** 8 min
- **Started:** 2026-08-03T07:50:31Z
- **Completed:** 2026-08-03T07:58:53Z
- **Tasks:** 1
- **Files modified:** 5

## Accomplishments

- Moved the complete D-102 conversion story into structurally equivalent PT-BR and English repository content, including the exact `Baixar e analisar meu PC` / `Download and analyze my PC` and real-results intents.
- Rebuilt the post-hero rhythm around player pain, Analyze → Optimize → Prove, a standalone Competitive Mode focal chapter, evidence methodology, Free/Premium choice, safety, FAQ, and repeated acquisition.
- Preserved the checksum-admitted desktop image as the largest proof object and kept download routing behind the existing public distribution decision.
- Added deterministic regression coverage for forbidden proof classes and the 1440/960/390/320 reading, capture-access, CTA-hierarchy, and horizontal-containment contract.

## Task Commits

1. **RED: Add failing Home conversion contract** — `69227f1` (test)
2. **GREEN: Deliver flagship Home journey** — `c422ba4` (feat)

## Files Created/Modified

- `apps/web/src/features/home.tsx` — Renders localized conversion movements, checksum proof, Competitive Mode, methodology, pricing, restoration, FAQ, and gated acquisition.
- `apps/web/src/styles/home.css` — Establishes the editorial rhythm, Competitive focal composition, responsive widths, reduced motion, and forced-colors fallback.
- `apps/web/src/content/public/home.pt-BR.json` — Reviewed PT-BR D-102 narrative and acquisition intent.
- `apps/web/src/content/public/home.en.json` — Semantically equivalent English D-102 narrative and acquisition intent.
- `apps/web/src/home.test.tsx` — TDD coverage for journey parity, proof integrity, ordering, and responsive containment.

## Decisions Made

- Kept the older compatibility metadata intact for existing content consumers and introduced a dedicated acquisition contract for the new download-first CTA; the destination remains the canonical fail-closed download route.
- Separated Competitive Mode from the plan comparison so its session preparation, measured-claim limit, and automatic restoration story receives clear visual priority.
- Stored commercial narrative in the localized content files rather than a component-local copy object, making parity review and future editorial validation explicit.

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered

None.

## TDD Gate Compliance

- RED commit `69227f1` produced four expected failures for the missing D-102 journey, proof policy, Competitive chapter, and responsive-width contract.
- GREEN commit `c422ba4` passed all 25 targeted Home tests without weakening the checksum or distribution gates.

## Verification

- `rtk pnpm --filter @liiiraa/web exec vitest run src/home-content.test.ts src/home.test.tsx` — 25 passed.
- `rtk pnpm --filter @liiiraa/web run check` — strict TypeScript passed.
- `rtk pnpm --filter @liiiraa/web run build` — optimized Next.js production build passed.
- `rtk pnpm exec prettier --check ...` — all five owned files passed.
- `rtk git diff --check` — passed.
- Impeccable detector — zero findings in the Home component and stylesheet.

## User Setup Required

None.

## Next Phase Readiness

- Plan 03-76 can replay the complete route matrix against the final Home content and structure.
- Plan 03-81 can capture the new Home candidates; human and publication approval remain false and owned by their existing gates.
- Real identity, billing, device, support, administrative, and trusted-distribution authority remains deferred to the locked Phase 4/10 boundaries.

## Self-Check: PASSED

- All five implementation/test files and the canonical summary exist.
- RED `69227f1` and GREEN `c422ba4` are present in repository history.
- Targeted tests, strict types, production build, formatting, diff hygiene, and Impeccable detection passed.

---
*Phase: 03-complete-web-experience*
*Completed: 2026-08-03*
