---
phase: 03-complete-web-experience
plan: "59"
subsystem: admin-ui
tags: [nextjs, react, responsive-shell, accessibility, role-projection, tdd]

requires:
  - phase: 03-complete-web-experience
    provides: Server-owned admin role admission, canonical locale projection, and isolated origin policy from Plan 03-54
provides:
  - Exact 72/60 topbar, 40px preview band, 280px role rail, and max-1320 operational workspace
  - Role-scoped navigation with one canonical current task and route-preserving locale switching
  - Compact 48px mobile disclosure with contextual high-risk unavailability below 960px
affects: [03-61-browser-proof, admin-visual-evidence, admin-accessibility]

tech-stack:
  added: []
  patterns:
    - Server-validated role projection into a narrow pathname-aware client navigation boundary
    - Presentation-level semantic removal paired with the existing workflow viewport rejection gate

key-files:
  created: []
  modified:
    - apps/admin/src/app/[locale]/layout.tsx
    - apps/admin/src/admin-navigation.tsx
    - apps/admin/src/app/admin-shell.css
    - apps/admin/src/admin-shell.test.ts

key-decisions:
  - "Keep one canonical desktop aria-current destination while the mobile disclosure names the same current task without duplicating current-page semantics."
  - "Remove the permanent viewport-policy banner and keep mobile high-risk unavailability beside the affected operational workflow."

patterns-established:
  - "Admin shell geometry: 72px desktop topbar, 60px mobile topbar, 40px preview band, 280px desktop rail, and 1320px maximum frame."
  - "Admin role projection: only server-admitted routes render, and locale switching carries only a validated role."

requirements-completed: [WEB-08]

duration: 7min
completed: 2026-08-01
status: complete
---

# Phase 03 Plan 59: Premium Isolated Admin Shell Summary

**Dense role-scoped operations shell with exact desktop/mobile geometry, explicit disconnected preview provenance, and a fail-closed high-risk viewport boundary**

## Performance

- **Duration:** 7 min
- **Started:** 2026-08-01T17:14:17Z
- **Completed:** 2026-08-01T17:21:27Z
- **Tasks:** 2
- **Files modified:** 4

## Accomplishments

- Composed a task-first administrative frame with exact 72/60 topbar, 40px quiet preview band, 280px role rail, and max-1320 focal workspace.
- Made product identity, Operations context, validated role, current task, dedicated-origin status, flag-plus-language locale control, and preview provenance legible without raw fixture enums.
- Replaced narrow navigation with one exact 48px closed disclosure, preserved 320px reflow, removed high-risk controls from mobile semantics, and retained the workflow-level viewport gate.
- Preserved isolated-origin admission, noindex metadata, role-specific navigation, generic localized denials, strict CSP behavior, forced colors, and reduced motion.

## Task Commits

Each TDD task was committed through RED then GREEN:

1. **Task 1: Compose the exact role-scoped desktop admin shell**
   - `a49d386` — RED geometry and shell identity contract
   - `c4ddb24` — GREEN premium role-scoped shell
2. **Task 2: Enforce compact mobile review and desktop-only high-risk action**
   - `0ad78c2` — RED mobile authority-boundary contract
   - `7768bf2` — GREEN mobile disclosure and viewport boundary

## Files Created/Modified

- `apps/admin/src/app/[locale]/layout.tsx` — Server-owned operational identity, preview provenance, role projection, and locale handoff.
- `apps/admin/src/admin-navigation.tsx` — Current-task resolution, role-scoped rail, and compact mobile disclosure.
- `apps/admin/src/app/admin-shell.css` — Exact shell geometry, selected navigation treatment, reflow, forced-colors, reduced-motion, and high-risk semantic removal.
- `apps/admin/src/admin-shell.test.ts` — TDD contracts for geometry, role/origin/locale integrity, disclosure semantics, and viewport safety.

## Decisions Made

- Kept one canonical desktop `aria-current` anchor while the mobile disclosure states the current task and avoids duplicate current-page semantics in the DOM.
- Removed the full-width viewport policy from ordinary shell chrome; concise unavailability remains at the affected high-risk workflow where it is actionable.
- Used existing neutral surfaces and cobalt action tokens more decisively instead of introducing new colors, effects, cards, or decorative product language.

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered

- The first full TypeScript check raced the concurrent Next.js build while `.next/types` was being regenerated. Running the check sequentially after the successful build passed with no source change.

## TDD Gate Compliance

- RED commits: `a49d386`, `0ad78c2`
- GREEN commits: `c4ddb24`, `7768bf2`
- Gate order verified in git history.

## Verification

- `pnpm --filter @liiiraa/admin exec vitest run` — 50/50 tests passed.
- `pnpm --filter @liiiraa/admin run check` — passed after the production build completed.
- `pnpm --filter @liiiraa/admin run build` — optimized Next.js production build passed.
- `prettier --check` for all four plan-owned files — passed.

## Known Stubs

None. The modified shell files contain no TODO/FIXME, placeholder content, empty data wiring, or goal-blocking provisional behavior.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness

- Plan 03-61 can capture wide, mobile, and reflow browser proof against the exact shell geometry and role/authority contracts.
- No blockers remain for admin shell visual evidence.

## Self-Check: PASSED

- All four plan-owned implementation/test files and `03-59-SUMMARY.md` exist.
- RED/GREEN commits `a49d386`, `c4ddb24`, `0ad78c2`, and `7768bf2` exist in git history.

---
*Phase: 03-complete-web-experience*
*Completed: 2026-08-01*
