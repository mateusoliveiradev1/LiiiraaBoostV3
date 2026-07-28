---
phase: 02-complete-desktop-experience
plan: "08"
subsystem: desktop-ui
tags: [react, xstate, accessibility, command-center, activity, deterministic-scenarios]
requires:
  - phase: 02-complete-desktop-experience
    provides: Calibration machine, design-system components, and deterministic interaction policy
provides:
  - Seven-step guided calibration workspace with complete authored operational states
  - Fixed three-region contextual Home with honest progressive evidence and limited mode
  - Keyboard command center, bounded favorites, durable Activity, and policy-controlled feedback
  - Shell feature semantic and accessibility evidence across scenario and appearance axes
affects: [desktop-composition, story-catalog, visual-regression, packaged-e2e, accessibility-review]
tech-stack:
  added: []
  patterns:
    - XState actor snapshots remain the calibration source of truth while scenario props select authored presentation states
    - Risky command results navigate to complete review and never execute inside search
    - Favorites, Activity, receipts, and notification output project the deterministic policy kernel
key-files:
  created:
    - packages/feature-shell/src/features/calibration.tsx
    - packages/feature-shell/src/features/home.tsx
    - packages/feature-shell/src/features/command-center.tsx
    - packages/feature-shell/src/features/favorites.tsx
    - packages/feature-shell/src/features/activity.tsx
    - packages/feature-shell/src/features/shell-features.test.tsx
  modified: []
key-decisions:
  - "Keep all Plan 02-08 work free and add no dependency, account, secret, or external service."
  - "Use the guarded calibration machine for workflow truth and render absent evidence explicitly instead of fabricating observations."
  - "Keep command selection navigation-only; review-required entries always route to the full review surface."
  - "Render Windows notification candidates only from redacted interaction-policy output, never from sensitive event detail."
patterns-established:
  - "Honest shell state: every scenario surface carries a persistent scenario marker, reason, status pattern, source, and safe next action."
  - "Accessible overlay state: listbox focus stays on the combobox, Escape unwinds preview before dialog, and focus returns to the trigger."
requirements-completed: [UX-02, UX-03, UX-05, UX-06, UX-07, UX-08, UX-09, UX-10, UX-11, UX-12]
duration: 23min
completed: 2026-07-28
status: complete
---

# Phase 02 Plan 08: Core Shell Feature Surfaces Summary

**Guided calibration, contextual Home, keyboard command search, bounded favorites, durable Activity, and redacted feedback now project the locked D-01–D-08 and D-15/D-16 policies.**

## Performance

- **Duration:** 23 min
- **Started:** 2026-07-28T05:44:00Z
- **Completed:** 2026-07-28T06:07:16Z
- **Tasks:** 3
- **Files modified:** 6

## Accomplishments

- Composed a seven-step calibration workspace around the tested XState actor, including new, running, slow, paused, resumed, offline, permission, partial, unsupported, empty, cancelled, failure, limited, dependency-blocked, revalidation, and completed presentations.
- Built Home with the immutable Next Action, selected game, and system ledger order; trusted, stale, and unavailable claims remain distinguishable and limited mode suppresses recommendations.
- Added Ctrl+K command search with grouped listbox results, safe review routing, layered Escape behavior, contextual preview, and actionable phase-boundary demonstrations.
- Added favorite limits and keyboard reorder/removal, plus Activity filtering, correlation IDs, acknowledgement/resolution gates, scenario no-change receipts, and redacted notification feedback.
- Added 12 shell-feature tests covering 61 total package assertions across operational states, locales, scenario families, keyboard policy, reduced motion, forced colors, scale, announcements, and semantic accessibility.

## Task Commits

Each task was committed atomically:

1. **Task 1: Compose calibration and contextual Home** — `fe57a82` (feat)
2. **Task 2: Compose command center, favorites, and Activity** — `c3c2dca` (feat)
3. **Task 3: Prove shell feature semantics and operational states** — `7fe7b61` (test)

## Files Created/Modified

- `packages/feature-shell/src/features/calibration.tsx` — actor-backed calibration workspace, connected consent, return intent, and partial revalidation explanation.
- `packages/feature-shell/src/features/home.tsx` — twelve honest Home variants and the fixed three-region hierarchy.
- `packages/feature-shell/src/features/command-center.tsx` — Ctrl+K dialog, grouped search, listbox keyboard model, safe review routing, and D-16 explanation.
- `packages/feature-shell/src/features/favorites.tsx` — bounded safe favorites with keyboard management and immutable Home priorities.
- `packages/feature-shell/src/features/activity.tsx` — grouped durable Activity, critical-event gates, no-change receipts, and redacted feedback channels.
- `packages/feature-shell/src/features/shell-features.test.tsx` — scenario, policy, state, locale, keyboard, and semantic accessibility evidence.

## Decisions Made

- No new package was needed; all work uses the already approved React, XState, design-system, and Vitest runtime.
- Calibration presentation overrides exist only to select deterministic scenario states. Workflow context and evidence still come from the guarded actor, and missing evidence renders as missing.
- Search results never execute an operation. Safe results navigate, while review-required results route to `/plans/review`.
- Critical Activity entries remain durable until both acknowledged and resolved; dismissal moves an event to history rather than deleting its audit identity.
- Windows notification content is rendered only from `mapFeedbackChannels`, whose output contains generic issue copy and safe action without sensitive hardware detail.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 2 - Missing Critical] Added deterministic initial command query**

- **Found during:** Task 3 scenario-state verification
- **Issue:** The no-result and grouped-result surfaces were reachable interactively but could not be selected deterministically by scenario-driven previews or static semantic tests.
- **Fix:** Added the optional `initialQuery` scenario input while keeping user editing and search behavior unchanged.
- **Files modified:** `packages/feature-shell/src/features/command-center.tsx`
- **Verification:** Grouped and exact no-result component tests pass.
- **Committed in:** `7fe7b61`

**2. [Rule 1 - Bug] Removed an invalid empty-result ARIA relationship**

- **Found during:** Task 3 semantic accessibility audit
- **Issue:** The combobox referenced `global-command-results` when the no-result state did not render that listbox.
- **Fix:** `aria-controls` is now present only while the referenced result list exists.
- **Files modified:** `packages/feature-shell/src/features/command-center.tsx`
- **Verification:** Zero missing ARIA relationships in the representative shell catalog.
- **Committed in:** `7fe7b61`

**3. [Rule 1 - Bug] Added explicit Activity filter values**

- **Found during:** Task 3 filter coverage
- **Issue:** Radio selection worked through closures, but serialized form semantics did not expose the canonical filter identity.
- **Fix:** Each filter radio now carries its `ActivityFilter` value.
- **Files modified:** `packages/feature-shell/src/features/activity.tsx`
- **Verification:** All six filters are present with stable values and the package suite passes.
- **Committed in:** `7fe7b61`

---

**Total deviations:** 3 auto-fixed (2 bugs, 1 missing critical deterministic state input).  
**Impact:** Accessibility and deterministic preview coverage improved without changing architecture or adding dependencies.

## Verification

- `rtk pnpm --filter @liiiraa/feature-shell test -- --run -t "UX-02|UX-03"` — PASS, 61/61.
- `rtk pnpm --filter @liiiraa/feature-shell test -- --run -t "UX-05|UX-06|UX-08|UX-09"` — PASS, 61/61.
- `rtk pnpm --filter @liiiraa/feature-shell test -- --run -t "shell states|accessibility"` — PASS, 61/61.
- `rtk pnpm --filter @liiiraa/feature-shell test` — PASS, 61/61.
- `rtk pnpm --filter @liiiraa/feature-shell check` — PASS.
- `rtk pnpm --filter @liiiraa/feature-shell build` — PASS.
- Targeted ESLint for all six feature files — PASS with zero warnings.
- `rtk pnpm --filter @liiiraa/desktop test:stories -- --pass-with-no-tests` — PASS configuration smoke; the Storybook Playwright project has no story tests yet.

## Known Stubs

None. Empty `receipts` and `boundaries` defaults are intentional optional inputs; every rendered control has a policy-bound action.

## Threat Model

- **T-02-15:** Limited Home suppresses recommendations, command actions remain navigation-only, and risky results route to review.
- **T-02-16:** Activity and receipts preserve stable scenario/correlation IDs and explicitly state that no real change occurred.
- No new network, authentication, file-access, or privileged execution surface was introduced.

## Issues Encountered

- The Storybook Playwright project currently reports `No tests found` without `--pass-with-no-tests`. Its configuration smoke passes, while this plan's component interaction and semantic axe-admission evidence lives in `shell-features.test.tsx`. No out-of-scope story file was added.

## User Setup Required

None — no account, secret, paid library, service, or manual configuration is required.

## Next Phase Readiness

- Desktop composition can import the five authored surfaces and bind them to deterministic scenario adapters.
- Story catalog and packaged journeys can reuse the scenario-selectable command and shell state inputs.
- No blocker remains for subsequent Phase 02 plans.

## Self-Check: PASSED

- All six key files exist.
- All three task commits are present in git history.
- All task acceptance criteria and plan-level package gates pass.
- No dependency or paid service was introduced.

---

*Phase: 02-complete-desktop-experience*  
*Completed: 2026-07-28*
