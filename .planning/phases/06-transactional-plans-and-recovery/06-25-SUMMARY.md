---
phase: 06-transactional-plans-and-recovery
plan: '25'
subsystem: desktop-ui
tags: [react, accessibility, advanced-preference, strong-auth, recovery]
requires:
  - phase: 06-17
    provides: Accessible transactional design-system primitives
  - phase: 06-19
    provides: Authoritative Improve plan and recovery workspaces
  - phase: 06-22
    provides: Exact-byte approved Phase 6 UI contract
  - phase: 06-24
    provides: Native Advanced preference projection and named enable/revoke authority
provides:
  - Complete device-local Advanced preference lifecycle inside the authoritative Improve workspace
  - Fresh action-specific strong-auth paths for enable, revoke, and posture revalidation
  - Accessible state, focus, scaling, forced-color, reduced-motion, and recovery-continuity evidence
affects: [06-20, 06-26, 06-27, 06-28, desktop-shell, advanced-plan-admission]
tech-stack:
  added: []
  patterns:
    - Action-specific strong auth returns opaque proof fields while native PlanAuthority owns the resulting truth
    - Pending preference transitions clear only after a newer authoritative projection confirms the requested state
    - Preference lifecycle remains adjacent to risk review but independent from the global risk ceiling
key-files:
  created: []
  modified:
    - packages/feature-shell/src/features/improve.tsx
    - packages/feature-shell/src/features/transactional-plans.test.tsx
key-decisions:
  - 'Request fresh enable and revoke proof through one action-discriminated system-browser callback, then invoke only the corresponding named PlanAuthority method.'
  - 'Keep transition UI pending until a newer native projection confirms enabled or revoked; command dispatch and proof completion never toggle renderer state.'
  - 'Block Advanced apply on absent, revoked, invalidated, stale, or unavailable preference authority while keeping local recovery enabled in every state.'
patterns-established:
  - 'D-13 panel: native state, reason, freshness, scope, next action, and recovery continuity render together in the existing plan review workspace.'
  - 'Accessibility matrix: exact-trigger focus return, invalidation-heading focus, bounded assertive announcement, non-color status, and 150%/200% presentation contracts are executable tests.'
requirements-completed: [PLAN-04, PLAN-05]
duration: 10 min
completed: 2026-08-13
status: complete
---

# Phase 06 Plan 25: Accessible Advanced Preference Lifecycle Summary

**The authoritative Improve workspace now explains and operates the complete per-PC Advanced preference lifecycle through fresh action-specific authentication, native-confirmed transitions, posture invalidation, and recovery that remains reachable in every state.**

## Performance

- **Duration:** 10 min
- **Started:** 2026-08-13T17:50:00Z
- **Completed:** 2026-08-13T17:59:25Z
- **Tasks:** 2
- **Files modified:** 2

## Accomplishments

- Rendered `disabled`, `enabled`, `revoked`, `invalidated`, and `unavailable` native projections with device-local persistence, binding freshness, last validation, exact reason, and next safe action.
- Added distinct `enable-advanced-preference` and `revoke-advanced-preference` strong-auth paths that forward only opaque one-use proof fields and never optimistically change renderer authority.
- Made posture invalidation focusable and assertive once, blocked Advanced apply through an adjacent `aria-describedby` reason, and preserved Recovery Center access offline, signed out, revoked, invalidated, or unavailable.
- Proved keyboard reachability, exact-trigger focus return, restart rehydration, bilingual long copy, non-color state, forced colors, reduced motion, 150% app scale, 200% reflow, and structural Extreme exclusion.

## TDD Cycle and Task Commits

1. **Task 1 RED: Specify the Advanced preference lifecycle** - `e20ec76` (test); eight focused cases failed on the absent lifecycle.
2. **Task 1 GREEN: Add the strongly authenticated lifecycle** - `c71c023` (feat); all eight focused cases and strict TypeScript passed.
3. **Task 2: Prove accessibility and recovery continuity** - `be8b052` (test); focused coverage reached 14/14 and the feature-shell suite reached 115/115.

## Files Created/Modified

- `packages/feature-shell/src/features/improve.tsx` - Device-local preference panel, proof handoff, named native transitions, pending/native confirmation, posture invalidation focus, admission blocker, and unconditional recovery.
- `packages/feature-shell/src/features/transactional-plans.test.tsx` - Five-state, bilingual, intent, keyboard, focus, announcement, presentation, recovery, and Extreme regression matrix.

## Decisions Made

- The renderer asks the approved strong-auth surface for action-scoped opaque proof fields; it does not accept an authority boolean, device posture, reusable credential, or cloud-sync state.
- An enable/revoke request captures the current native sequence after strong auth and stays pending until a newer authoritative projection confirms the corresponding state.
- The global risk ceiling continues to revise plans only. It cannot enable Advanced, and lowering it does not silently revoke the persisted preference.
- React behavior follows the Vercel checklist: the lifecycle component is module-level, hooks are unconditional, authority callbacks are stable, static work is bounded, and focus refs correspond to exact user triggers and state headings.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Corrected newly introduced PT-BR byte corruption**
- **Found during:** Task 2 bilingual verification
- **Issue:** The first edit encoded the newly added Portuguese lifecycle copy as mojibake even though tests initially mirrored the damaged text.
- **Fix:** Replaced every affected new string and assertion with canonical UTF-8 Portuguese before expanding the bilingual matrix.
- **Files modified:** `packages/feature-shell/src/features/improve.tsx`, `packages/feature-shell/src/features/transactional-plans.test.tsx`
- **Verification:** No `Ã` corruption remains in either owned file; focused, full-package, and full-workspace tests pass.
- **Committed in:** `be8b052`

**2. [Rule 3 - Blocking] Aligned transition failure handling with owned ESLint policy**
- **Found during:** Task 2 React/quality review
- **Issue:** Targeted ESLint rejected the initial nullable result expression under `@typescript-eslint/prefer-optional-chain`.
- **Fix:** Used the concise optional-chain result check and reran formatting, lint, typecheck, and tests.
- **Files modified:** `packages/feature-shell/src/features/improve.tsx`
- **Verification:** Targeted ESLint and Prettier pass with zero findings.
- **Committed in:** `be8b052`

---

**Total deviations:** 2 auto-fixed (1 correctness bug, 1 quality-gate blocker).
**Impact on plan:** Both fixes preserve the planned bilingual and React quality contracts; no dependency, new settings surface, cloud authority, or privileged capability was added.

## Issues Encountered

- Static server rendering cannot execute browser focus transitions, so the matrix combines semantic rendered assertions with narrow source-contract checks for the two focus refs and restart rehydration effect. Named native intent calls remain behavior-tested directly.

## Verification

- `rtk pnpm --filter @liiiraa/feature-shell exec vitest --run src/features/transactional-plans.test.tsx -t "Advanced preference"` - **PASS**, 14/14 focused cases.
- `rtk pnpm --filter @liiiraa/feature-shell test -- --run` - **PASS**, 115/115 across seven files.
- `rtk pnpm --filter @liiiraa/feature-shell check` - **PASS**.
- Targeted ESLint and Prettier for both owned TSX files - **PASS**.
- Exact Phase 06-22 UI authority validator - **PASS** with subject `aafe1e0e...` and report `6e9ae150...`.
- `rtk pnpm test` - **PASS**, all 56 workspace tasks completed successfully.
- Source scans - **PASS**: named enable/revoke methods only, no generic settings setter, `localStorage`, renderer authority boolean, reusable proof, or cloud-sync control.

## Authentication Gates

None. Tests use injected action-scoped proof fixtures; no external account action was required.

## User Setup Required

None - no external service configuration required.

## Known Stubs

None. `unavailable` and `Not available` are intentional closed native-authority states covered by the plan, not placeholders.

## Threat Flags

None. The strong-auth handoff, renderer/native preference boundary, and recovery continuity are declared in T-06-25A/B and are covered by positive and negative tests.

## Next Phase Readiness

- Plan 06-20 can drive deterministic browser journeys through every D-13 state and presentation over stable component semantics.
- Physical promotion plans can verify restart persistence, posture invalidation, keyboard/Narrator behavior, and unconditional recovery without changing the renderer authority model.
- No blocker remains.

## Self-Check: PASSED

- Both modified files and this summary exist.
- RED `e20ec76`, GREEN `c71c023`, and accessibility `be8b052` resolve in repository history in order.
- Focused, package, type, lint, format, exact UI authority, and full workspace gates pass.
- The three user-owned `apps/*/.gitignore` modifications remain untouched and unstaged.

---
*Phase: 06-transactional-plans-and-recovery*
*Completed: 2026-08-13*
