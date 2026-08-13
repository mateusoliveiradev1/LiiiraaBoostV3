---
phase: 06-transactional-plans-and-recovery
plan: '14'
subsystem: plan-engine
tags: [rust, tdd, transaction-executor, fault-injection, recovery, receipts]
requires:
  - phase: 06-transactional-plans-and-recovery
    provides: Immutable plan revisions, proportional risk admission, dependency rollback, observation-first reconciliation, durable recovery storage, revocation, and strong-auth authority from Plans 06-03/05/06/07/08/09/10/12
provides:
  - Prepared-before-mutation deterministic executor with serialized typed effects and bounded read-only retries
  - Observation-derived apply/restore verdicts with exact immutable receipt admission
  - Startup reconciliation, protected restart checkpoints, safe-boundary cancellation, and no blind redispatch
  - Dependency-scoped automatic restore that preserves independent verified nodes and blocks globally on restore uncertainty
  - Fault-injection and generated-sequence properties across durable and external interruption boundaries
affects: [06-15, 06-18, 06-19, 06-20, 06-21, recovery-center, optimizer-service]
tech-stack:
  added: []
  patterns: [prepare-effect-observe-reconcile, native admission recomputation, observation-only verdict authority, immutable receipt binding, dependency-scoped restore]
key-files:
  created:
    - crates/plan-engine/tests/executor.rs
  modified:
    - crates/plan-engine/src/executor.rs
key-decisions:
  - 'Mint prepared mutation authority inside the executor only after the journal adapter confirms the prepared event committed; adapters cannot manufacture prepared identity.'
  - 'Treat every broker result as diagnostic and derive final truth only from bounded exact-state observation followed by a matching durable verdict and receipt.'
  - 'Give pending recovery and restart verification priority over every new mutation, with no renderer, subscription, or automatic redispatch input.'
  - 'Execute dependency rollback only from verified restore targets in policy order, preserving independent evidence and stopping globally on the first uncertain restore.'
patterns-established:
  - 'Live execution and boot recovery share one observation finalizer so verified, restored, unknown, drift, conflict, and receipt rules cannot diverge.'
  - 'Generated journal artifacts are identity-, state-, hash-, and sequence-checked before mutation; exact receipts bind the final verified journal head.'
requirements-completed: [PLAN-05, PLAN-06, PLAN-07, PLAN-08]
duration: 16 min
completed: 2026-08-13
status: complete
---

# Phase 06 Plan 14: Deterministic Transaction and Recovery Executor Summary

**A prepared-before-mutation Rust executor now serializes typed effects, observes exact Windows truth before every verdict, issues receipts only after verified durable evidence, and recovers interruption or dependency failure without blind redispatch.**

## Performance

- **Duration:** 16 min
- **Started:** 2026-08-13T16:13:39Z
- **Completed:** 2026-08-13T16:29:39Z
- **Tasks:** 3 TDD gates
- **Files modified:** 2

## Accomplishments

- Added a native-owned admission seam that is recomputed before preparation and blocks stale approval, wrong-action proof, evidence/risk/recovery drift, and revocation without journaling or mutation.
- Enforced the exact order `observe prior -> append prepared -> dispatch once -> observe -> append verdict -> store exact receipt`, with generated identity, state, sequence, and hash-chain validation throughout.
- Added bounded automatic retry for observations only; broker timeout, response loss, crash, cancellation, shutdown, and renderer loss never redispatch a mutation automatically.
- Added boot-time reconciliation of pending durable intent with zero mutation calls, plus protected restart checkpoints that require next-boot verification and expose no forced-reboot authority.
- Added explicit new transactions for restore and retry-after-observation, and dependency-scoped rollback that preserves independent verified operations and blocks globally on restore uncertainty.
- Proved failure behavior through 21 focused cases, including three 96-case property suites for dispatch singularity, receipt-backed success, recovery priority, and monotonic journal sequences.

## TDD Gate Compliance

| Gate | Commit | Evidence |
| --- | --- | --- |
| RED | `8d473201` | The compiling fault-injection suite failed 11 intended orchestration assertions while the callable executor remained fail-closed. |
| GREEN | `08c3d980` | Minimal prepared-before-dispatch orchestration, boot reconciliation, restart, receipt, and scoped rollback behavior passed 15 focused and 84 full-crate tests. |
| REFACTOR | `3480982a` | Shared observation finalization plus generated failure histories and restore/retry hardening passed 21 focused and 90 full-crate tests. |

## Task Commits

1. **Task 1 RED: Specify every durable and external failure boundary** - `8d473201` (test)
2. **Task 2 GREEN: Orchestrate prepare-effect-observe-reconcile** - `08c3d980` (feat)
3. **Task 3 REFACTOR: Prove state-machine safety properties** - `3480982a` (refactor)

## Files Created/Modified

- `crates/plan-engine/src/executor.rs` - Durable executor ports, exact generated-artifact admission, serialized transaction orchestration, boot reconciliation, restart/cancellation gates, exact receipts, and scoped rollback.
- `crates/plan-engine/tests/executor.rs` - Deterministic adapters, full failure-boundary matrix, recovery/restore/retry witnesses, and bounded generated event-sequence properties.

## Decisions Made

- Durable journal adapters return commit success only; the executor creates `PreparedTransactionIdentity` after that success so an adapter cannot mint mutation authority.
- A broker return, rejection, timeout, or lost response is diagnostic only. Exact post-effect observation selects verified, restored, not-applied, unknown, drift, or conflict truth.
- Receipt storage requires exact transaction, plan, operation, prior, requested, observed, verification, and final journal-head equality. A verdict append or receipt failure remains recovery-pending rather than successful.
- Startup recovery has a separate observation-only path with no admission or mutation call. Explicit retry must carry a new transaction identifier, parent transaction, fresh admission, and new prepared event.
- Restore execution consumes only `RollbackDecision::restore_in_order`; independent verified operation identifiers are retained in the outcome and a failed restore closes the mutation gate.

## Verification

- `rtk cargo test -p liiiraa-plan-engine --test executor` passed 21/21 focused behavior and property tests.
- `rtk cargo test -p liiiraa-plan-engine executor` completed successfully; this command is a name filter, so the exact target command above is the complete executor witness.
- `rtk cargo test -p liiiraa-plan-engine` passed 90/90 tests across eight suites.
- `rtk cargo fmt -p liiiraa-plan-engine -- --check` passed.
- `rtk cargo check -p liiiraa-plan-engine` passed with only existing interface dead-code warnings.
- `rtk cargo clippy -p liiiraa-plan-engine --tests` passed with zero errors; remaining warnings are pre-existing generated/interface warnings outside this plan's behavior.
- `rtk pnpm test:architecture` passed both live adapters and 51/51 architecture tests.
- Git history contains the required RED -> GREEN -> REFACTOR sequence.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] Added a callable fail-closed executor seam during RED**

- **Found during:** Task 1 (Specify every durable and external failure boundary)
- **Issue:** The existing executor file exposed ports and vocabulary only, so an external integration suite could not compile behavioral failure assertions against a concrete reducer.
- **Fix:** Added the smallest public request/outcome/artifact vocabulary and a callable executor that returned a closed journal error until GREEN.
- **Files modified:** `crates/plan-engine/src/executor.rs`, `crates/plan-engine/tests/executor.rs`
- **Verification:** RED compiled and failed 11 intended behavioral assertions rather than import or syntax errors.
- **Committed in:** `8d473201`

**2. [Rule 2 - Missing Critical] Prevented journal adapters from manufacturing prepared mutation identity**

- **Found during:** Task 1 port-adapter design
- **Issue:** Returning `PreparedTransactionIdentity` from `append_prepared` required an external adapter to construct the very authority that proves durable commit, but its constructor is intentionally crate-private.
- **Fix:** Made the port return commit success only; the executor now mints prepared identity internally after success and never before.
- **Files modified:** `crates/plan-engine/src/executor.rs`, `crates/plan-engine/tests/executor.rs`
- **Verification:** Prepare failure tests dispatch zero mutations, while all successful paths record sequence zero before the sole mutation.
- **Committed in:** `8d473201`, implemented in `08c3d980`

---

**Total deviations:** 2 auto-fixed (1 blocking issue, 1 missing critical authority constraint).
**Impact on plan:** Both changes were required for a meaningful behavioral RED gate and an enforceable prepared-before-effect trust boundary; neither widened broker, renderer, network, or generic mutation authority.

## Issues Encountered

- `cargo clippy --tests` reports existing generated large-enum and dormant interface-constructor warnings. The plan-owned executor introduced no clippy error; focused, full-crate, format, compile, and architecture gates all pass.

## User Setup Required

None - no external service configuration required.

## Known Stubs

None.

## Threat Flags

None. The changed files implement the plan-declared journal-to-broker-to-observation boundary and add no network endpoint, credential path, schema, file access, remote execution, or generic mutation surface.

## Next Phase Readiness

- Plans 06-15, 06-18, 06-19, 06-20, and 06-21 can consume one deterministic executor projection whose success is inseparable from exact observation and receipt evidence.
- Restart, crash, cancellation, restore failure, unknown state, drift, and conflict all close mutation admission with deterministic next-safe actions.
- Physical Windows and packaged-service exercises remain assigned to the later clean-VM/owner/friends promotion plans; deterministic executor conformance is complete.

## Self-Check: PASSED

- Both declared key files exist.
- RED commit `8d473201`, GREEN commit `08c3d980`, and REFACTOR commit `3480982a` exist in required order.
- All task acceptance criteria, plan-level verification, full-crate, formatting, lint, and architecture gates pass.
- The unrelated user changes in `apps/account/.gitignore`, `apps/admin/.gitignore`, and `apps/web/.gitignore` remain unstaged and untouched.

---

_Phase: 06-transactional-plans-and-recovery_
_Completed: 2026-08-13_
