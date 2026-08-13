---
phase: 06-transactional-plans-and-recovery
plan: '07'
subsystem: plan-engine
tags: [rust, tdd, dependency-dag, scoped-rollback, recovery, proptest]
requires:
  - phase: 06-transactional-plans-and-recovery
    provides: Immutable dependency recovery interfaces and exact applied/restore state wrappers from Plan 06-03
provides:
  - Canonical fail-closed dependency DAG validation with deterministic group and operation apply order
  - Verified dependency-ancestry rollback in reverse topological order without widening to independent groups
  - Explicit safe-boundary cancellation and restore-failure mutation blocking decisions
  - Bounded deterministic properties for permutations, sparse/dense DAGs, disconnected groups, and malformed truth
affects: [06-08, 06-14, recovery-executor, mutation-gate, recovery-center]
tech-stack:
  added: []
  patterns: [canonical Kahn topological order, verified affected-closure rollback, explicit mutation-blocking verdict, fixed-seed bounded properties]
key-files:
  created:
    - crates/plan-engine/tests/dependency_rollback.rs
  modified:
    - crates/plan-engine/src/dependency.rs
key-decisions:
  - 'Define the affected rollback scope as the failed operation group plus its complete dependency ancestry, never the full plan or downstream independent groups.'
  - 'Filter restore actions through verified applied truth and emit them in reverse canonical operation order while preserving exact applied and restore states.'
  - 'Represent cancellation and restore failure as closed blocking decisions with no automatic mutation retry outcome.'
patterns-established:
  - 'Dependency input is sorted and validated before Kahn traversal; missing truth, self-dependencies, duplicates, and cycles fail before recovery planning.'
  - 'Property suites use bounded cases, a fixed reproducible seed, named D-17 assertions, and no generated regression-file side effects.'
requirements-completed: [PLAN-07, PLAN-08]
duration: 6 min
completed: 2026-08-13
status: complete
---

# Phase 06 Plan 07: Dependency-Scoped Rollback Summary

**The plan engine now restores only verified operations in a failed dependency ancestry, in deterministic reverse topological order, while preserving independent verified groups and failing closed on incomplete graph or recovery truth.**

## Performance

- **Duration:** 6 min
- **Started:** 2026-08-13T14:58:25Z
- **Completed:** 2026-08-13T15:04:37Z
- **Tasks:** 3
- **Files modified:** 2

## Accomplishments

- Canonicalized generated dependency groups and produced stable group/operation apply order independent of input permutation.
- Rejected empty groups, duplicate groups or operations, missing dependencies, self-dependencies, cycles, unknown operations, duplicate applied truth, and operation/group mismatches before emitting restore authority.
- Computed the failed group's dependency ancestry and restored only verified applied operations in reverse topological order with their exact expected-applied and prior restore states.
- Preserved disconnected verified operations explicitly and rejected the unsafe flat undo-all behavior.
- Stopped new operations at cancellation boundaries, allowed only the current atomic operation to finish, and converted restore failure into guided-recovery mutation blocking without a retry decision.
- Proved the behavior through 12 focused cases using deterministic permutations and bounded sparse/dense graph properties.

## TDD Gate Compliance

| Gate | Commit | Evidence |
| --- | --- | --- |
| RED | `670da98e` | Seven focused behavior/property cases compiled and failed through intended dependency-policy assertion failures. |
| GREEN | `a802bd90` | Minimal canonical DAG and scoped rollback policy made all seven initial cases pass. |
| REFACTOR | `736c7262` | Shared closure traversal plus five additional sparse, dense, disconnected, cancellation, malformed-truth, and cycle invariants pass. |

## Task Commits

Each TDD gate was committed atomically:

1. **Task 1 RED: Specify affected closure and restore order** - `670da98e` (test)
2. **Task 2 GREEN: Compute deterministic rollback plans** - `a802bd90` (feat)
3. **Task 3 REFACTOR: Stress dependency invariants** - `736c7262` (refactor)

## Files Created/Modified

- `crates/plan-engine/src/dependency.rs` - Canonical DAG validation, deterministic topological ordering, affected dependency ancestry, verified restore filtering, independent preservation, cancellation, and restore-failure blocking.
- `crates/plan-engine/tests/dependency_rollback.rs` - D-17 behavior cases and fixed-seed bounded properties for ordering, scope, disconnected groups, cancellation, malformed truth, and cycles.

## Decisions Made

- The failed closure is the failed operation's dependency group plus all transitive prerequisites; dependents and disconnected groups never enter the restore set merely because they exist in the plan.
- Only operations carrying verified applied truth can become restore targets. A missing applied node is not invented, and unknown or group-mismatched truth blocks planning.
- Canonical group identifiers break Kahn-order ties, and sorted operation identifiers make output stable across transport permutations.
- A restore failure identifies the exact failed restore target and changes the verdict to guided recovery required; the API exposes no retry or reapply decision.

## Verification

- `rtk cargo test -p liiiraa-plan-engine --test dependency_rollback` passed 12/12 tests.
- `rtk cargo test -p liiiraa-plan-engine dependency` passed the three name-matching tests; the exact integration target command above exercised all 12 focused cases.
- `rtk cargo test -p liiiraa-plan-engine` passed 43/43 tests across five suites.
- `rtk cargo fmt -p liiiraa-plan-engine -- --check` passed.
- `rtk cargo check -p liiiraa-plan-engine` passed with only pre-existing downstream interface dead-code warnings.
- `rtk cargo clippy -p liiiraa-plan-engine --tests` passed with zero errors and only pre-existing generated/interface warnings.
- `rtk pnpm test:architecture` passed both live adapters and 51/51 architecture tests.
- Git history contains the required RED -> GREEN -> REFACTOR sequence.
- Focused source scans found no stub markers, automatic mutation retry surface, flat undo-all path, or unrelated recovery authority.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] Added a callable closed policy seam in RED**

- **Found during:** Task 1 (Specify affected closure and restore order)
- **Issue:** The Plan 06-03 file exposed only a trait plus crate-private constructors, so an external integration suite could not construct verified applied truth or execute a concrete policy; RED would fail at compilation instead of the plan-required assertion gate.
- **Fix:** Added the smallest public input constructor, result projections, and an intentionally closed concrete policy shell alongside the RED tests. Every behavioral method still returned a fail-closed error until GREEN.
- **Files modified:** `crates/plan-engine/src/dependency.rs`, `crates/plan-engine/tests/dependency_rollback.rs`
- **Verification:** The focused suite compiled and produced seven intended assertion failures before implementation, then passed after GREEN.
- **Committed in:** `670da98e`

---

**Total deviations:** 1 auto-fixed (1 blocking issue).
**Impact on plan:** The adjustment preserved a meaningful assertion-based RED gate without implementing rollback behavior early or widening mutation authority.

## Issues Encountered

- The plan's Task 3 command uses `dependency` as a test-name filter and therefore runs three matching cases. The exact integration target command was also run and passed all 12 focused cases, followed by the complete 43-test package suite.

## User Setup Required

None - no external service configuration required.

## Known Stubs

None.

## Threat Flags

None. The changed files implement the declared dependency-input to recovery-action trust boundary and introduce no network endpoint, file access, schema, credential, or new external trust surface.

## Next Phase Readiness

- Recovery execution can consume deterministic exact restore targets without reconstructing dependency scope or applying a flat rollback.
- Mutation admission can block on guided recovery after any restore failure and can stop safely at the current atomic-operation boundary.
- No blocker remains for Plans 06-08 and 06-14 to integrate observation-first recovery and transactional execution.

## Self-Check: PASSED

- Both key files exist.
- RED commit `670da98e`, GREEN commit `a802bd90`, and REFACTOR commit `736c7262` exist in the required order.
- All task acceptance criteria, plan-level verification, full crate, formatting, lint, and architecture gates pass.

---

_Phase: 06-transactional-plans-and-recovery_
_Completed: 2026-08-13_
