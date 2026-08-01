---
phase: 03-complete-web-experience
plan: "43"
subsystem: account-web-evidence
tags: [playwright, visual-regression, accessibility, responsive, account]

requires:
  - phase: 03-complete-web-experience
    plan: "37"
    provides: Neutral-focus capture helper and manifest-bound visual matrix
  - phase: 03-complete-web-experience
    plan: "39"
    provides: Redesigned account workspace, navigation, Overview, and Profile compositions
provides:
  - Current neutral-focus W10-W13 and W18 account goldens
  - Wide and mobile G03-G05 qualitative-review goldens for Overview and Profile
  - Bilingual surface-aware skip-link validation and readable restricted-state evidence
affects: [03-45, account-visual-review, phase-03-publication]

tech-stack:
  added: []
  patterns:
    - Accessibility and focus assertions precede neutral-focus visual capture
    - Qualitative account captures reuse deterministic no-authority routes and declared viewport projects

key-files:
  created:
    - tooling/web-evidence/tests/__screenshots__/accessibility-responsive.spec.ts/G03-account-final-mobile-390.png
    - tooling/web-evidence/tests/__screenshots__/accessibility-responsive.spec.ts/G04-account-final-wide-1440.png
    - tooling/web-evidence/tests/__screenshots__/accessibility-responsive.spec.ts/G05-account-final-mobile-390.png
  modified:
    - apps/account/src/app/account-shell.css
    - tooling/web-evidence/tests/accessibility-responsive.spec.ts
    - tooling/web-evidence/tests/__screenshots__/accessibility-responsive.spec.ts/W10-account-final-desktop-960.png
    - tooling/web-evidence/tests/__screenshots__/accessibility-responsive.spec.ts/W11-account-final-wide-1440.png
    - tooling/web-evidence/tests/__screenshots__/accessibility-responsive.spec.ts/W12-account-final-wide-1280.png
    - tooling/web-evidence/tests/__screenshots__/accessibility-responsive.spec.ts/W13-account-final-wide-1280.png
    - tooling/web-evidence/tests/__screenshots__/accessibility-responsive.spec.ts/W18-account-final-reflow-320.png

key-decisions:
  - "Rebaseline account evidence from the authored post-03-39 workspace; do not preserve the rejected sparse wireframe merely because it was pixel-stable."
  - "Treat public, account, and administrative skip-link labels as one bilingual accessibility contract while retaining surface-specific accessible names."
  - "Keep G03-G05 as qualitative-review inputs only; Plan 03-45 retains ownership of named human approval and publication decisions."

patterns-established:
  - "Account evidence spans wide, 960px, 390px, and 320px layouts with the same Axe, focus, locale, overflow, and no-authority gates."

requirements-completed: [WEB-08]
duration: 67min
completed: 2026-07-31
status: complete
---

# Phase 03 Plan 43: Account Visual Rebaseline Summary

**Eight current account goldens now capture the authored Overview and Profile workspace across wide, desktop, mobile, and 320px reflow layouts with neutral focus, Axe coverage, bilingual navigation, and truthful no-authority states.**

## Performance

- **Duration:** 67 min
- **Started:** 2026-08-01T01:52:58Z
- **Completed:** 2026-08-01T02:59:35Z
- **Tasks:** 2
- **Files modified:** 10

## Accomplishments

- Replaced W10-W13 with the current post-03-39 account workspace instead of retaining the rejected sparse wireframe composition.
- Replaced W18 and added G03-G05 to cover Overview and Profile at 1440px, 390px, and 320px alongside the existing 960px and 1280px evidence.
- Inspected the captures under the Impeccable product register for constrained measure, useful density, bounded controls, responsive hierarchy, consistent affordances, and status communication that does not rely on color alone.
- Preserved deterministic preview truth, disabled remote authority, localized recovery, synthetic account data, and neutral focus in every representative capture.
- Extended the shared focus contract across public, account, and administrative bilingual skip-link names and corrected the Profile restricted-status contrast exposed by Axe.

## Task Commits

1. **Task 1: Replace account W10-W13 baselines** - `416c863`
2. **Task 2: Replace W18, add G03-G05, and replay all account evidence** - `eef1472`

## Decisions Made

- Visual inspection remains authoritative over blind snapshot preservation: W11 records the authored post-03-39 workspace, not the rejected sparse predecessor.
- G03-G05 intentionally reuse the executable Playwright naming contract (`account-final-*`) rather than the non-executable descriptive names in PLAN frontmatter.
- Qualitative captures remain review inputs only. No human approval, publication approval, connected authority, or remote state change is claimed.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Completed the bilingual, multi-surface skip-link matcher**

- **Found during:** Tasks 1 and 2 clean replay
- **Issue:** The shared helper initially recognized only public labels, then account labels, but not the administrative English/PT-BR labels exercised by the broad W18 matrix.
- **Fix:** Expanded the accessible-name matcher to accept the exact public, account, and administrative skip-link variants in both locales.
- **Files modified:** `tooling/web-evidence/tests/accessibility-responsive.spec.ts`
- **Verification:** Focused W10-W13 and W18/G03-G05 replays plus the 198-combination broad matrix completed without focus assertion failure.
- **Commits:** `416c863`, `eef1472`

**2. [Rule 2 - Missing Critical] Bounded short account controls before accepting W10**

- **Found during:** Task 1 Impeccable baseline inspection
- **Issue:** The sign-in form and short action group could consume unlimited horizontal measure, violating the account visual contract for bounded controls.
- **Fix:** Limited the form to the token-backed 448px measure and gave its action group a wrapping flex layout with consistent gaps.
- **Files modified:** `apps/account/src/app/account-shell.css`
- **Verification:** W10-W13 clean replay passed, account TypeScript passed, and visual inspection confirmed constrained control measure.
- **Commit:** `416c863`

**3. [Rule 1 - Bug] Corrected restricted-status text contrast**

- **Found during:** Task 2 G04/G05 Axe validation
- **Issue:** `Remote save unavailable` in `.lb-web-status > strong` failed the `color-contrast` rule against the Profile surface.
- **Fix:** Applied the primary text token to the restricted Profile status while preserving its explicit unavailable label and no-authority semantics.
- **Files modified:** `apps/account/src/app/account-shell.css`
- **Verification:** Focused G04/G05 replay passed after the correction, followed by the full account evidence replay and account unit/type checks.
- **Commit:** `eef1472`

---

**Total deviations:** 3 auto-fixed (2 bugs, 1 missing critical UX requirement).
**Impact on plan:** All fixes were necessary to make the named visual evidence accessible, bounded, and executable. No authority, endpoint, dependency, schema, release approval, or remote mutation behavior changed.

## Issues Encountered

- The first G04/G05 update exposed the restricted-status contrast failure; the CSS correction passed the focused and broad clean replays.
- The initial broad replay attempt was interrupted externally before completion; the final uninterrupted 198-combination replay completed successfully.
- Next.js emitted its existing standalone-mode advisory while all optimized webpack builds and dedicated test servers started successfully.

## Known Stubs

None. The changed CSS and test helper contain no TODO/FIXME, placeholder rendering, hardcoded empty UI data, or unwired account data source. The screenshots intentionally render deterministic synthetic no-authority fixtures required by Phase 3.

## Verification

- W10-W13 controlled update and clean replay - PASS, 4/4 applicable captures.
- Focused W18/G03-G05 replay across declared account projects - PASS, 5 applicable tests and 19 expected project skips.
- Full prescribed account evidence replay - PASS, 22 applicable tests and 176 expected project skips across the 198-combination matrix.
- Reflow/accessibility axes - PASS for 320px/400% reflow, 200% text, reduced motion, forced colors, Axe, focus visibility, locale, overflow, and no-authority assertions.
- `rtk pnpm --filter @liiiraa/account test -- --run` - PASS, 22/22 tests.
- `rtk pnpm --filter @liiiraa/account check` - PASS.
- `rtk pnpm --filter @liiiraa/web-features exec vitest run src/components.test.tsx` - PASS, 9/9 tests.
- `rtk pnpm --filter @liiiraa/web-evidence check` - PASS.
- Prettier check for the modified CSS and Playwright source - PASS.
- All eight canonical account PNGs exist in the tracked snapshot store.

## Human Approval

Not claimed. Plan 03-45 owns named human review and publication approval for these captures.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness

- Plan 03-44 can produce the admin rebaseline against the corrected bilingual/multi-surface focus helper.
- Plan 03-45 can review W10-W13, W18, and G03-G05 without inheriting the rejected pre-03-39 account composition or an Axe contrast failure.

## Self-Check: PASSED

- All eight canonical account PNGs exist in the tracked snapshot store.
- Commits `416c863` and `eef1472` exist in git history.
- The focused and broad clean replays, strict TypeScript, 22/22 account tests, 9/9 component contract tests, and Prettier check passed after the final fixes.
- The working tree contained only this SUMMARY before its metadata commit.
