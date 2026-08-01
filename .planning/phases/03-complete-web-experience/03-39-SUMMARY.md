---
phase: 03-complete-web-experience
plan: "39"
subsystem: account-web
tags: [nextjs, react, localization, accessibility, visual-design, deterministic-preview]

requires:
  - phase: 03-complete-web-experience
    plan: "37"
    provides: Exact ProductLockup primitive and owner-bound visual scale gate
  - phase: 03-complete-web-experience
    plan: "38"
    provides: Approved cross-surface visual direction and resolved public composition
provides:
  - Constrained account workspace with exact identity and pathname-aware current navigation
  - Authored bilingual overview and Profile responsibility compositions
  - One quiet persistent deterministic-preview boundary with contextual sensitive-route boundaries
affects: [03-43, account-goldens, account-accessibility, web-evidence]

tech-stack:
  added: []
  patterns:
    - Server-rendered account shell with a narrow pathname-aware client navigation boundary
    - Responsibility-first account composition driven only by immutable localized fixtures
    - Persistent global preview truth separated from contextual sensitive-action boundaries

key-files:
  created:
    - apps/account/src/account-navigation.tsx
  modified:
    - apps/account/src/app/[locale]/layout.tsx
    - apps/account/src/app/account-shell.css
    - apps/account/src/account-shell.test.ts
    - apps/account/src/features/account-preview.tsx
    - apps/account/src/features/account-preview.test.tsx
    - apps/account/src/content/account.en.json
    - apps/account/src/content/account.pt-BR.json
    - packages/web-features/src/components.test.tsx

key-decisions:
  - "Keep pathname awareness inside one small client component while the account layout, locale resolution, route projection, and scenario content remain server-owned."
  - "Render the global deterministic-preview boundary once in the shell; ordinary route headers carry task context while sensitive workflows retain distinct consequence boundaries."
  - "Use a focused overview action region plus a compact responsibility list, and separate Profile editing from read-only facts without adding account mutation authority."
  - "Retain resolved Plan 03-39 token entries as immutable audit history while excluding them from active migration debt."

requirements-completed: [WEB-08]
duration: 11min
completed: 2026-07-31
status: complete
---

# Phase 03 Plan 39: Account Workspace and Responsibility Composition Summary

**Exact product identity, current-route navigation, and dense bilingual account responsibilities now sit inside a calm bounded preview workspace with no remote authority.**

## Performance

- **Duration:** 11 min
- **Started:** 2026-08-01T00:06:46Z
- **Completed:** 2026-08-01T00:17:26Z
- **Tasks:** 2
- **Files modified:** 9

## Accomplishments

- Replaced the placeholder account mark with the exact shared Liiiraa Boost lockup and kept the broad design-system client barrel out of the Server Component layout.
- Added locale-aware pathname navigation that emits exactly one aria-current="page" state for canonical account responsibilities.
- Bounded the wide account workspace at 1280px, removed horizontal mobile navigation, and preserved skip navigation, forced colors, reduced motion, 44px targets, and 320px reflow.
- Consolidated persistent preview truth into one quiet shell boundary by removing duplicate origin, footer, field, and generic route-header provenance.
- Rebuilt Overview around a primary next-action region, compact subscription/device/support summaries, and one explicit limitations boundary.
- Rebuilt Profile around a bounded 448px control region, grouped account facts, a visible unavailable remote-save state, and an enabled no-change review path.
- Preserved deterministic W11/W12/W13 scenario behavior, immutable fixture consumption, no-change receipts, safe draft rules, error recovery, and PT-BR/English structural parity.

## Task Commits

Each task was committed through its TDD gates:

1. **Task 1 RED: constrained shell and current-route contract** - 1625112 (test)
2. **Task 1 GREEN: exact identity and responsive account shell** - 162c5d8 (feat)
3. **Task 2 RED: authored Overview/Profile contract** - a2b987a (test)
4. **Task 2 GREEN: dense account responsibility compositions** - 5ca7e51 (feat)

## Files Created/Modified

- apps/account/src/account-navigation.tsx - Narrow client component for normalized pathname matching and current-page semantics.
- apps/account/src/app/[locale]/layout.tsx - Exact ProductLockup, quiet boundary, localized navigation data, and constrained workspace frame.
- apps/account/src/app/account-shell.css - Bounded shell, active navigation, authored Overview/Profile layout, mobile reflow, and canonical visual scale.
- apps/account/src/account-shell.test.ts - Identity, current-route, bounded-measure, mobile, accessibility, and authority contracts.
- apps/account/src/features/account-preview.tsx - Responsibility-led Overview and Profile compositions without generic route provenance.
- apps/account/src/features/account-preview.test.tsx - Density, control-width, boundary, bilingual, deterministic, and no-authority contracts.
- apps/account/src/content/account.en.json - Concise English Overview/Profile task, state, and limitation copy.
- apps/account/src/content/account.pt-BR.json - Meaning-equivalent PT-BR Overview/Profile task, state, and limitation copy.
- packages/web-features/src/components.test.tsx - Resolved Plan 03-39 migration debt while retaining immutable audit history.

## Decisions Made

- Kept navigation current-state logic client-side only because usePathname is the sole browser-specific need; canonical routes, labels, locale admission, metadata, and page content remain server-controlled.
- Used normalized exact-path matching and a currentCount === 1 guard so malformed or non-responsibility routes cannot create multiple selected destinations.
- Applied current state through semantics, a full border, tonal fill, weight, and a shape marker, so selection never relies on cobalt alone.
- Preserved the account origin, CSP, cookie isolation, noindex metadata, generated route contracts, and disconnected authority instead of adding any Phase 4 session, billing, device, or support behavior.
- Removed generic route-level fixture badges because the shell already carries persistent preview truth; sensitive and degraded routes continue to explain their distinct consequence or recovery boundary.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] Reconciled the owner-bound account token gate**

- **Found during:** Task 1 production verification
- **Issue:** Returning the three Plan 03-39-owned account declarations to canonical token expressions made the exact migration ledger stale and failed the shared visual contract.
- **Fix:** Retained the entries in immutable audit history but excluded Plan 03-39 from active admitted debt, matching the established Plan 03-38 resolution pattern.
- **Files modified:** packages/web-features/src/components.test.tsx
- **Verification:** The shared components.test.tsx suite passes 9/9 with only Plan 03-41 admin debt active.
- **Committed in:** 162c5d8

---

**Total deviations:** 1 auto-fixed blocking issue.
**Impact on plan:** The account CSS now satisfies the canonical type and spacing scale and the repository-wide gate remains executable; no package, contract, or runtime authority changed.

## Issues Encountered

- Existing account PNGs still represent the rejected sparse composition. Plan 03-43 intentionally owns the complete account rebaseline and replay.
- Human visual approval remains blocking at the phase-level review; this plan does not claim that approval.

## Known Stubs

None. The scan found only internal empty accumulators, optional workflow state, and intentional initial form values; no rendered placeholder, empty data source, TODO, or disconnected unfinished control was introduced.

## TDD Gate Compliance

- RED commits: 1625112, a2b987a
- GREEN commits: 162c5d8, 5ca7e51
- Both RED runs failed for the intended missing shell/composition contracts before implementation.

## Verification

- rtk pnpm --filter @liiiraa/account exec vitest run src/features/account-preview.test.tsx src/account-shell.test.ts - 18 tests passed.
- rtk pnpm --filter @liiiraa/account test -- --run - all 22 account tests passed.
- rtk pnpm --filter @liiiraa/account check - strict TypeScript passed.
- rtk pnpm --filter @liiiraa/account build - optimized Next.js webpack production build passed.
- rtk pnpm --filter @liiiraa/web-features exec vitest run src/components.test.tsx - 9 shared visual-contract tests passed.
- Prettier check passed for every modified source, style, content, and test file.
- Package manifests, pnpm-lock.yaml, generated contracts, and account screenshot assets have no drift.

## User Setup Required

None.

## Next Phase Readiness

- Plan 03-43 can now replace and replay the complete account golden set, including Overview, Profile, representative responsibility routes, compact viewports, and accessibility states.
- Phase 3 remains open until the named human visual approval gate passes.

## Self-Check: PASSED

All ten expected source/summary files exist and commits 1625112, 162c5d8, a2b987a, and 5ca7e51 are present in git history.

---
*Phase: 03-complete-web-experience*
*Completed: 2026-07-31*
