---
phase: 02-complete-desktop-experience
plan: "21"
subsystem: desktop-application-shell
tags: [desktop, react, responsive, accessibility, localization, operational-states]

requires:
  - phase: 02-11
    provides: Typed route tree and safe desktop adapter composition
  - phase: 02-20
    provides: Localized catalogs and benign appearance preference providers
provides:
  - Responsive localized desktop shell composed around every real application route
  - Keyboard, focus, live-region, overlay, forced-colors, scale, and reduced-motion behavior
  - Closed operational-state projections with visible reason and safe next action
affects: [02-13, 02-25, 02-26, 02-28, 02-29, phase-02-evidence]

tech-stack:
  added: []
  patterns:
    - Route-aware shell regions preserve exactly one main landmark and one H1
    - Closed operational states always expose a reason and safe next action
    - Responsive behavior is expressed through deterministic shell data attributes and CSS contracts

key-files:
  created:
    - apps/desktop/index.html
    - apps/desktop/src/app.css
    - apps/desktop/src/app.test.tsx
    - apps/desktop/src/app.tsx
    - apps/desktop/src/react-dom-client.d.ts
  modified:
    - apps/desktop/package.json
    - apps/desktop/src/index.ts
    - packages/feature-shell/src/features/activity.tsx
    - packages/feature-shell/src/features/calibration.tsx
    - packages/feature-shell/src/features/home.tsx
    - pnpm-lock.yaml
    - tooling/architecture-tests/src/check-workspace.test.ts

key-decisions:
  - "Keep the shell dependency-free beyond already approved free workspace packages."
  - "Use native Windows decorations while the renderer owns accessible product navigation, overlays, and recovery status."
  - "Represent every operational variant as a closed projection so future adapters can replace fixtures without changing information architecture."

patterns-established:
  - "F6 cycles through stable shell regions and overlays restore focus to their invoking control."
  - "Scenario and provenance markers remain persistent across routes and responsive widths."
  - "Scaling, forced colors, reduced motion, and minimum-width behavior are testable without browser-only layout assertions."

requirements-completed: [UX-02, UX-03, UX-04, UX-05, UX-06, UX-07, UX-08, UX-09, UX-10, UX-11, UX-12]
---

# Phase 02 Plan 21: Responsive Desktop Application Shell Summary

**A complete localized shell now mounts every desktop route with responsive composition, keyboard/focus behavior, visible provenance, and fail-closed operational-state guidance.**

## Performance

- **Duration:** 10 min
- **Started:** 2026-07-28T05:11:58-03:00
- **Completed:** 2026-07-28T05:22:19-03:00
- **Tasks:** 2
- **Files changed:** 12

## Accomplishments

- Composed title bar, critical rail, responsive goal rail, route header, work canvas, inspector, Activity overlay, command center, and typed route outlet.
- Preserved exactly one `main` landmark and one H1 on every real route while keeping scenario and fixture provenance visible.
- Implemented F6 region cycling, application shortcuts, overlay focus restoration, polite/assertive live regions, and safe navigation.
- Covered the locked 1440, 1280, 960, and 760 widths plus 150% app scale, 200% text, forced colors, and reduced motion.
- Closed all 12 operational states with an explicit reason and safe next action.
- Added the missing Vite HTML entrypoint and aligned the architecture ownership gate with the shell's approved workspace dependencies.

## Task Commits

1. **Task 1: Compose shell regions and route outlet** — `a47137b`
2. **Task 2 RED: Add failing semantic and scale contracts** — `7aa1167`
3. **Task 2 GREEN: Prove shell semantics, scaling, and operational states** — `7385328`
4. **Architecture gate alignment** — `a643fb6`

## Verification

- `rtk pnpm --filter @liiiraa/desktop test -- --run` — PASS, 40 tests.
- `rtk pnpm --filter @liiiraa/feature-shell test -- --run` — PASS, 86 tests.
- `rtk pnpm --filter @liiiraa/desktop check` — PASS.
- `rtk pnpm --filter @liiiraa/desktop build` — PASS.
- `rtk pnpm test:architecture` — PASS, 34 tests.
- `rtk pnpm supply-chain:check` — PASS, 59 exact pins.
- Focused `shell semantics|scale smoke` suite — PASS, 6 tests.
- Plan key link `desktopRouteTree|Outlet` — PASS.

## Decisions Made

- The shell consumes only existing free workspace dependencies; no paid service or new external package was introduced.
- Accessibility behavior is part of the shell contract rather than a browser-test-only concern.
- Operational states stay closed and deterministic, preserving honest fixture/unavailable truth until native adapters arrive.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] Added the missing Vite document entrypoint**

- **Found during:** Task 1 verification
- **Issue:** The desktop renderer had no `apps/desktop/index.html`, so the production Vite build could not resolve its entry module.
- **Fix:** Added a minimal localized application document that mounts the existing renderer entry.
- **Files modified:** `apps/desktop/index.html`
- **Verification:** Desktop production build passes.
- **Commit:** `a47137b`

**2. [Rule 3 - Blocking] Added narrow React DOM typing for the existing runtime**

- **Found during:** Task 1 strict TypeScript verification
- **Issue:** The approved manifest intentionally lacked a separate React DOM type dependency, but the renderer entry required a typed `createRoot` boundary.
- **Fix:** Added a narrow local declaration for the already installed React DOM runtime instead of introducing another package.
- **Files modified:** `apps/desktop/src/react-dom-client.d.ts`
- **Verification:** Desktop strict typecheck and tests pass.
- **Commit:** `a47137b`

**3. [Rule 3 - Blocking] Aligned architecture ownership tests with approved shell imports**

- **Found during:** Final architecture verification
- **Issue:** The architecture fixture still described the earlier desktop dependency set and rejected the now-approved design-system and feature-shell composition.
- **Fix:** Updated the ownership fixture to mirror the canonical permitted desktop dependencies.
- **Files modified:** `tooling/architecture-tests/src/check-workspace.test.ts`
- **Verification:** All 34 architecture tests pass.
- **Commit:** `a643fb6`

**Total deviations:** 3 auto-fixed blocking integration issues.
**Impact:** The fixes complete the planned shell without adding paid services, broadening native authority, or introducing an unapproved external dependency.

## Known Stubs

- Browser screenshot and axe matrix execution remains owned by Plan 02-13 after native renderer wiring in Plan 02-25.
- Native Windows lifecycle and packaged human evidence remain deliberately planned/unresolved in Plans 02-25 through 02-29.

## Threat Model

- Persistent scenario and provenance markers prevent simulated state from appearing as measured machine truth.
- Closed operational-state definitions prevent unknown failure modes from silently degrading into optimistic success UI.
- Overlay focus restoration and live-region priority keep safety and recovery actions operable through keyboard and assistive technology.
- No network endpoint, privileged system mutation, paid service, authentication flow, or remote execution capability was introduced.

## Next Phase Readiness

- Plan 02-25 can attach the validated generated native shell protocol to the visible renderer without changing route or shell architecture.
- Plans 02-13 and 02-26 can exercise the locked browser, forced-colors, scaling, keyboard, and human accessibility evidence matrices.

## Self-Check: PASSED

- All four implementation commits exist in repository history.
- All 12 declared changed files exist and are tracked.
- Desktop, feature-shell, architecture, supply-chain, strict TypeScript, and production build gates pass.
- The working tree was clean before creating this summary.
