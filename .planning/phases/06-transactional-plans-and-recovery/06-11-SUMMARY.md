---
phase: 06-transactional-plans-and-recovery
plan: '11'
subsystem: desktop-client
tags: [typescript, tauri-ipc, ajv, immutable-projection, recovery, tdd]
requires:
  - phase: 06-transactional-plans-and-recovery
    provides: Generated transactional recovery schema and TypeScript validator from Plan 06-01
provides:
  - Renderer-safe PlanAuthority with eleven named plan, recovery, progress, and diagnostic commands
  - Native and deterministic adapter conformance with generated validation and immutable projections
  - Contiguous progress reduction with stale marking and deduplicated authoritative snapshot reads
  - Fail-closed fixture refusal, bounded errors, recovery access, and post-dispatch cancellation ambiguity
affects: [06-17, 06-19, 06-20, feature-shell, tauri-plan-commands, recovery-center]
tech-stack:
  added: []
  patterns: [validate-before-project, closed-intent-registry, monotonic-event-reduction, deduplicated-refetch-gate]
key-files:
  created:
    - packages/desktop-client/src/plans.ts
    - packages/desktop-client/src/plans.test.ts
  modified:
    - packages/desktop-client/src/index.ts
key-decisions:
  - 'Treat cancellation after mutation dispatch as unknown and stale; never invent a transaction identity or retry the mutation.'
  - 'Validate exact command-to-transaction intent in addition to the generated document kind.'
  - 'Deduplicate authoritative execution reads per transaction while serializing a different transaction behind an in-flight read.'
patterns-established:
  - 'React expresses bounded intent and references only; compatibility, authentication, risk, and success authority remain native-owned.'
  - 'Progress events update renderer truth only when transaction and sequence are contiguous; every gap requires one authoritative snapshot.'
requirements-completed: [PLAN-01, PLAN-02, PLAN-03, PLAN-04, PLAN-05, PLAN-07, PLAN-08]
duration: 14 min
completed: 2026-08-13
status: complete
---

# Phase 06 Plan 11: Renderer-Safe Plan Authority Summary

**A generated-validator-backed PlanAuthority now gives React immutable native plan/recovery truth through eleven named intents, with fixture refusal, monotonic progress, deduplicated reconciliation, and no mutation retry.**

## Performance

- **Duration:** 14 min
- **Started:** 2026-08-13T07:48:00Z
- **Completed:** 2026-08-13T08:02:12Z
- **Tasks:** 3
- **Files modified:** 3

## Accomplishments

- Added the closed `PLAN_COMMANDS` registry and public `PlanAuthority` port for compose, revise, approve, apply, three restore scopes, execution reads/subscriptions, and diagnostic preview/export.
- Validated every unknown native/deterministic document with the generated transactional validator before deep-cloning and freezing renderer projections.
- Refused recursive fixture/scenario markers in production, rejected renderer-owned authority claims before invoke, and preserved only bounded error paths/keywords.
- Reduced only contiguous progress events and placed gaps, reloads, and tray reopens behind one deduplicated authoritative `readExecution` gate with zero mutation replay.
- Kept recovery callable without entitlement or strong-auth claims and distinguished pre-dispatch cancel requests from unknown post-dispatch mutation outcomes.

## TDD Cycle

- **RED:** Added 16 adapter-conformance cases covering the complete command surface and truth/lifecycle invariants; the suite failed because `./plans.js` did not exist.
- **GREEN:** Implemented the generated-validator-backed authority and barrel exports; focused tests passed 16/16 with strict TypeScript checking.
- **REFACTOR:** Consolidated recursive boundary scans and native detacher registration, bound exact transaction intent, and added bounded-error plus reconnect-race cases; focused tests now pass 19/19.

## Task Commits

1. **Task 1 RED: Specify PlanAuthority conformance** - `aff232f5` (test)
2. **Task 2 GREEN: Implement closed validated authority adapters** - `015867d7` (feat)
3. **Task 3 REFACTOR: Harden client lifecycle** - `2ff013b2` (refactor)

## Files Created/Modified

- `packages/desktop-client/src/plans.ts` - Closed authority port, adapters, generated validation, immutable projections, cancellation, event reduction, and refetch lifecycle.
- `packages/desktop-client/src/plans.test.ts` - Shared adapter conformance, production-truth, recovery, sequence, reconnect, cancellation, and bounded-error tests.
- `packages/desktop-client/src/index.ts` - Public PlanAuthority factories, command registry, inputs, snapshots, and closed error exports.

## Decisions Made

- A post-dispatch abort cannot safely claim cancellation. The client returns `UNKNOWN_AFTER_DISPATCH`, marks the projection stale, and waits for an authoritative transaction reference rather than fabricating one.
- A generated-valid `plan-transaction` is insufficient by itself: its intent must match the named command (`apply`, `restore-operation`, `restore-plan`, or `restore-checkpoint`).
- Native event subscriptions own idempotent detachers, and disposal becomes authoritative before detachers run so synchronous callbacks cannot publish after shutdown.

## Verification

- `rtk pnpm --filter @liiiraa/desktop-client exec vitest --run src/plans.test.ts` - 19/19 tests passed.
- `rtk pnpm --filter @liiiraa/desktop-client test -- --run` - 40/40 tests passed across five suites.
- `rtk pnpm --filter @liiiraa/desktop-client check` - strict TypeScript check passed.
- TDD gate order passed: `aff232f5` RED -> `015867d7` GREEN -> `2ff013b2` REFACTOR.
- Catch-path scan confirmed command/subscription failures return closed errors and never fixtures or fabricated success.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Corrected two RED race assumptions before GREEN acceptance**
- **Found during:** Task 2 (GREEN implementation)
- **Issue:** The first gap test started from sequence 3 but expected event 2 to be contiguous, and the cancellation test expected automatic reconciliation without possessing an authoritative transaction identity.
- **Fix:** Started the gap scenario at sequence 1 and required post-dispatch cancellation to remain unknown/stale without inventing an ID or issuing a mutation/read retry.
- **Files modified:** `packages/desktop-client/src/plans.test.ts`
- **Verification:** Focused sequence and cancellation cases plus the full desktop-client suite pass.
- **Committed in:** `015867d7`

---

**Total deviations:** 1 auto-fixed bug.
**Impact on plan:** The correction strengthened the no-fabricated-authority and no-blind-retry guarantees without expanding scope.

## Issues Encountered

- The package root exports transactional transport types but not the runtime transactional validator. The implementation uses the existing explicit `@liiiraa/contracts-ts/generated` entrypoint, matching the contract package's own transactional tests.

## User Setup Required

None - no external service configuration required.

## Known Stubs

None.

## Next Phase Readiness

- Tauri plan commands and feature-shell recovery surfaces can consume one renderer-safe authority without receiving native secrets or privileged primitives.
- Plans 06-17, 06-19, and 06-20 can rely on stale/gap reconciliation, bounded errors, and truthful unknown-after-dispatch semantics.
- No blocker remains for dependent Phase 6 work.

## Self-Check: PASSED

- All three owned source/test files exist.
- RED, GREEN, and REFACTOR commits exist in the required order.
- The complete desktop-client suite and strict TypeScript gate pass after the final commit.

---

_Phase: 06-transactional-plans-and-recovery_
_Completed: 2026-08-13_
