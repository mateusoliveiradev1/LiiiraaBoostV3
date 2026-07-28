---
phase: 02-complete-desktop-experience
plan: '15'
subsystem: desktop-tooling
tags: [typescript, vite, tauri, turbo, verification, fail-closed]
requires:
  - phase: 02-complete-desktop-experience
    provides: Approved frozen Phase 2 dependency graph from Plan 02-31
provides:
  - Strict declaration-build configuration for all four desktop packages
  - Root-reachable bounded desktop verification lifecycle
  - Empty DesktopCompositionBootstrap public composition contract
affects: [desktop-ui, browser-wave-zero, packaged-wave-zero, phase-02-evidence]
tech-stack:
  added: []
  patterns:
    - Every desktop lifecycle subprocess has a 120-second hard timeout
    - Missing owner artifacts fail with stable plan-directed diagnostics
key-files:
  created:
    - apps/desktop/scripts/desktop-lifecycle.mjs
    - apps/desktop/src/index.ts
    - apps/desktop/vite.config.ts
    - apps/desktop/tsconfig.json
  modified:
    - package.json
    - apps/desktop/package.json
    - tooling/ci/verify-required-artifacts.mjs
key-decisions:
  - 'Delegate root verify commands to one bounded desktop lifecycle while retaining named foundation graphs for static evidence reachability.'
  - 'Treat absent future browser, packaged, localization, scenario, or final-evidence artifacts as explicit failures rather than empty passing suites.'
patterns-established:
  - 'Lifecycle delegation: root command -> desktop dispatcher -> named foundation graph plus owned focused suites.'
  - 'Static acceptance verifiers supplement delegated runtime graphs only when root scripts match the exact approved desktop links.'
requirements-completed:
  [UX-01, UX-02, UX-03, UX-04, UX-05, UX-06, UX-07, UX-08, UX-09, UX-10, UX-11, UX-12]
duration: 23min
completed: 2026-07-28
status: complete
---

# Phase 02 Plan 15: Desktop Verification Lifecycle Summary

**Strict TypeScript/Vite package configuration now feeds a root-reachable, 120-second-bounded desktop lifecycle that fails closed until each future evidence owner exists.**

## Performance

- **Duration:** 23 min
- **Started:** 2026-07-28T01:51:00Z
- **Completed:** 2026-07-28T02:14:03Z
- **Tasks:** 2
- **Files modified:** 16

## Accomplishments

- Added strict declaration-build configs to design tokens, design system, feature shell, and desktop composition packages.
- Configured a static relative-base Tauri renderer with loopback-only deterministic Vite development ports.
- Exposed bounded unit, Storybook, browser, packaged, scenario, localization, evidence, quick, final, and Wave 0 entrypoints.
- Preserved all Phase 1 foundation/evidence reachability while delegating root verification through the desktop package.
- Exported only the intentionally minimal `DesktopCompositionBootstrap` contract from the desktop public root.

## Task Commits

Each task was committed atomically:

1. **Task 1: Configure strict package builds and terminating desktop commands** - `34ab9dc` (chore)
2. **Task 2: Wire root lifecycle and the empty composition contract** - `1c0b47d` (feat)

## Files Created/Modified

- `apps/desktop/scripts/desktop-lifecycle.mjs` - Cross-platform dispatcher, focused selectors, timeouts, and missing-artifact diagnostics.
- `apps/desktop/vite.config.ts` - Static SPA/Tauri renderer boundary with loopback-only fixed ports.
- `apps/desktop/src/index.ts` - Sole public `DesktopCompositionBootstrap` export.
- `apps/desktop/tsconfig.json` - Strict desktop declaration configuration.
- `packages/design-{tokens,system}/tsconfig.json` and `packages/feature-shell/tsconfig.json` - Strict package-local declaration builds.
- Root and package manifests - Turbo-visible build/check/test commands and root lifecycle links.
- `tooling/ci/verify-required-artifacts.mjs` and acceptance policy - Delegated graph reachability without weakening omission checks.
- `eslint.config.mjs` - Narrow type-aware default project allowance for the Vite config.

## Decisions Made

- Kept every missing future suite or evidence artifact as a hard error with its owning plan named in the diagnostic.
- Retained foundation verification as explicit `verify:foundation:*` scripts; the desktop dispatcher invokes them in ordinary quick/final mode while lifecycle-only smoke validates wiring without claiming future evidence.
- Resolved pnpm on Windows through the active `pnpm.cjs` discovered from `PATH`, avoiding shell execution and argument-injection risk.
- Added no dependency, paid service, infrastructure, or distribution claim.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 2 - Missing Critical] Added the bounded lifecycle dispatcher and package task scripts**

- **Found during:** Task 1
- **Issue:** Manifest-only direct CLI commands could not enforce a shared 120-second ceiling, focused flag routing, or stable fail-closed diagnostics; the three design/feature manifests also had no Turbo tasks.
- **Fix:** Added one desktop-owned dispatcher and build/check/test scripts to all four manifests.
- **Files modified:** `apps/desktop/scripts/desktop-lifecycle.mjs`, four package manifests
- **Verification:** Desktop script listing and lifecycle smoke passed.
- **Committed in:** `34ab9dc`, `1c0b47d`

**2. [Rule 3 - Blocking] Made pnpm subprocess execution safe on Windows**

- **Found during:** Task 2 root smoke
- **Issue:** Node 24 rejects direct `spawnSync` of `pnpm.cmd` with `EINVAL`.
- **Fix:** Resolve the installed `pnpm.cjs` from `PATH` and execute it with the current Node binary, without a shell.
- **Files modified:** `apps/desktop/scripts/desktop-lifecycle.mjs`
- **Verification:** Exact root lifecycle smoke passed.
- **Committed in:** `1c0b47d`

**3. [Rule 2 - Missing Critical] Preserved static foundation evidence reachability**

- **Found during:** Task 2 fail-closed verification
- **Issue:** Existing Phase 1 static verifiers understood only a direct root script graph and would reject or lose evidence reachability after the approved root-to-desktop delegation.
- **Fix:** Require exact root links, supplement only the named foundation graphs, and mutation-test compatibility omission.
- **Files modified:** `tooling/ci/verify-required-artifacts.mjs`, its test, acceptance policy, `eslint.config.mjs`
- **Verification:** Required-artifact verifier passed 40 artifacts/11 negative proofs; Node omission tests passed 6/6; acceptance-policy tests passed 50/50.
- **Committed in:** `1c0b47d`

---

**Total deviations:** 3 auto-fixed (2 missing critical, 1 blocking)
**Impact on plan:** Required for bounded cross-platform execution and preservation of existing fail-closed evidence guarantees. No product feature or dependency scope was added.

## Issues Encountered

- A deliberately missing Playwright config produced the expected stable failure naming Browser Wave 0/Plan 02-04; it did not report a false pass.
- A direct root Vitest invocation used the wrong package cwd for acceptance fixtures; the canonical package-owned command passed 50/50 and no unrelated test logic was changed.

## Known Stubs

- `apps/desktop/src/index.ts` intentionally contains only the composition lifecycle contract. Concrete React route composition is owned by Plan 02-21 and native bridge selection by Plan 02-25.

## Authentication Gates

None.

## User Setup Required

None - all tooling is local and free; no external service or paid infrastructure was configured.

## Verification

- `rtk pnpm --filter @liiiraa/desktop run` - passed.
- `rtk pnpm --filter @liiiraa/desktop check` - passed.
- `rtk pnpm verify:quick -- --smoke lifecycle` - passed; Turbo discovered 16 packages.
- `rtk pnpm test:architecture` - passed; 34 tests.
- `rtk node --test tooling/ci/verify-required-artifacts.test.mjs` - passed; 6 tests.
- `rtk pnpm verify:artifacts` - passed; 40 artifacts and 11 negative proofs.
- `rtk pnpm test:acceptance-policy -- --mode planned` - passed; 50 tests.
- Focused ESLint and Prettier checks - passed.

## Next Phase Readiness

- Plans 02-04 and 02-16 can now fill the browser and packaged Wave 0 artifacts behind stable focused commands.
- All later implementation plans can use package-local unit/scenario/localization filters without watch mode.
- Default quick/final commands correctly remain red until their owning test and evidence artifacts are produced.

## Self-Check: PASSED

- All created files exist.
- Task commits `34ab9dc` and `1c0b47d` exist in repository history.
- No unexpected deletion or untracked generated output exists.

---

_Phase: 02-complete-desktop-experience_
_Completed: 2026-07-28_
