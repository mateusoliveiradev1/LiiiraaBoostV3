---
phase: 06-transactional-plans-and-recovery
plan: '03'
subsystem: plan-engine
tags: [rust, generated-contracts, recovery, risk, promotion, ports]
requires:
  - phase: 06-transactional-plans-and-recovery
    provides: Generated transactional recovery contracts and the pure plan-engine crate boundary from Plans 06-01 and 06-02
provides:
  - Immutable generated-contract-backed plan revision, evidence admission, risk, approval, and dependency interfaces
  - Observation-first reconciliation and dependency-scoped local recovery contracts
  - Exact-stage promotion, signed revocation, durable journal, broker, strong-auth, progress, restart, and mutation-gate ports
affects: [06-05, 06-06, 06-07, 06-08, 06-09, 06-10, 06-11, 06-12, 06-13, 06-14]
tech-stack:
  added: []
  patterns: [private generated-transport wrappers, prepared-transaction effect authority, observation-first recovery, entitlement-independent recovery]
key-files:
  created:
    - crates/plan-engine/src/domain.rs
    - crates/plan-engine/src/revision.rs
    - crates/plan-engine/src/risk.rs
    - crates/plan-engine/src/dependency.rs
    - crates/plan-engine/src/reconcile.rs
    - crates/plan-engine/src/promotion.rs
    - crates/plan-engine/src/executor.rs
  modified:
    - crates/plan-engine/src/lib.rs
key-decisions:
  - 'Accept only operation selection and a non-Extreme risk ceiling from renderer intent; native policies own evidence, compatibility, risk, approval, and success authority.'
  - 'Make generated authority immutable through private-field wrappers and read-only transport access.'
  - 'Require durable prepared transaction identity and exact prior state at every privileged effect boundary while keeping local recovery independent of entitlement.'
patterns-established:
  - 'A generated document becomes domain authority only through a crate-private constructor after policy validation.'
  - 'Privileged mutation ports accept only allowlisted generated broker commands wrapped with prepared identity and exact state preconditions.'
requirements-completed: [PLAN-01, PLAN-02, PLAN-03, PLAN-04, PLAN-05, PLAN-06, PLAN-07, PLAN-08]
duration: 9 min
completed: 2026-08-13
status: complete
---

# Phase 06 Plan 03: Transaction and Recovery Interface Authority Summary

**One compile-checked Rust interface set now binds immutable plans, proportional risk admission, dependency recovery, promotion, revocation, durable execution, and privileged effects to generated contracts without renderer authority or entitlement-gated recovery.**

## Performance

- **Duration:** 9 min
- **Started:** 2026-08-13T07:22:12Z
- **Completed:** 2026-08-13T07:30:26Z
- **Tasks:** 2
- **Files modified:** 8

## Accomplishments

- Defined renderer intent as operation selection plus a maximum executable risk ceiling, omitting compatibility, technical risk, authentication, approval, and success claims.
- Added immutable wrappers and policy traits for registered operation versions, revisions, evidence admission, proportional approvals, dependency DAG validation, and dependency-scoped rollback.
- Added observation-first reconciliation with explicit applied, not-applied, unknown, drift, and conflict decisions plus entitlement-independent local recovery.
- Added exact four-stage promotion and signed revocation contracts that can only block, alert, and preserve local recovery.
- Added durable journal, narrow broker, strong-auth, ordered progress, cancellation, restart checkpoint, and mutation-gate ports bound to prepared transaction identity and exact prior state.

## Task Commits

Each task was committed atomically:

1. **Task 1: Define immutable plan and admission interfaces** - `fcd2258c` (feat)
2. **Task 2: Define recovery and execution interfaces** - `28c4a96e` (feat)

## Files Created/Modified

- `crates/plan-engine/src/domain.rs` - Shared fail-closed errors, renderer intent, prepared identity, and allowlisted broker command wrappers.
- `crates/plan-engine/src/revision.rs` - Immutable revisions, approvals, operation registry, composition, and approval invalidation interfaces.
- `crates/plan-engine/src/risk.rs` - Explicit evidence non-admission, executable risk ceiling, and proportional approval requirements.
- `crates/plan-engine/src/dependency.rs` - Validated DAG, verified applied operation, restore target, and scoped rollback interfaces.
- `crates/plan-engine/src/reconcile.rs` - Observation-first decisions and entitlement-independent guided recovery requests.
- `crates/plan-engine/src/promotion.rs` - Exact-version promotion sequence, signed revocation disposition, and redacted diagnostic projection.
- `crates/plan-engine/src/executor.rs` - Durable journal, broker, strong-auth, progress reducer, cancellation, restart, and mutation gate ports.
- `crates/plan-engine/src/lib.rs` - Exports the complete interface module family.

## Decisions Made

- Extreme remains visible only as a locked technical risk and denial reason; no risk ceiling, admitted risk, or broker command can execute it.
- Private fields and crate-private constructors prevent external adapters from manufacturing accepted revisions, promotions, strong-auth proofs, restart checkpoints, or mutation admission tokens.
- Recovery APIs contain no account, subscription, Premium, license, online-auth, or entitlement input; a signed revocation cannot request remote rollback.
- The journal prepares transaction authority before external effects, while every subsequent journal or broker effect carries the prepared identity and exact prior-state precondition.

## Verification

- `rtk cargo check -p liiiraa-plan-engine` passed.
- `rtk pnpm test:architecture` passed both adapters and all 51 tests.
- `rtk cargo test -p liiiraa-plan-engine` passed both empty behavior suites; behavior remains owned by downstream TDD plans.
- `rtk cargo fmt -p liiiraa-plan-engine -- --check` passed.
- Focused source scans found no public mutable fields, permissive authority booleans, generic mutation variants, entitlement input on recovery, or stub markers.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] Registered Task 1 modules before its compile gate**

- **Found during:** Task 1 (Define immutable plan and admission interfaces)
- **Issue:** Newly created Rust files are not compiled by Cargo until declared from the crate root, so the requested check initially validated only the old empty root.
- **Fix:** Exported the four Task 1 modules from `lib.rs` before the Task 1 verification, then compiled the real public surface. Task 2 completed the remaining exports.
- **Files modified:** `crates/plan-engine/src/lib.rs`
- **Verification:** Scoped Cargo check and formatting gates compile all eight final source files.
- **Committed in:** `fcd2258c`

---

**Total deviations:** 1 auto-fixed (1 blocking issue).
**Impact on plan:** The adjustment made the specified Task 1 compile gate meaningful and did not widen runtime authority or scope.

## Issues Encountered

- Cargo reports expected dead-code warnings for crate-private constructors that downstream behavior plans will consume. The interface-only crate remains error-free; no warning suppression was added that could hide future unused code.

## User Setup Required

None - no external service configuration required.

## Known Stubs

None. These files intentionally define interfaces only; Plans 06-05 through 06-08 and related adapter plans own their behavior implementations.

## Next Phase Readiness

- Revision, risk, dependency rollback, reconciliation, journal, promotion, strong-auth, and broker plans can implement behavior without redefining shared types.
- Recovery remains structurally available during offline, expired-subscription, revocation, and auth-unavailable states.
- No blocker remains for the downstream Phase 6 TDD plans.

## Self-Check: PASSED

- All eight key files exist.
- Task commits `fcd2258c` and `28c4a96e` exist.
- All task acceptance criteria and plan-level verification commands pass.

---

_Phase: 06-transactional-plans-and-recovery_
_Completed: 2026-08-13_
