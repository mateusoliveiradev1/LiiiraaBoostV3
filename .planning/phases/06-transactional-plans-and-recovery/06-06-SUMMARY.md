---
phase: 06-transactional-plans-and-recovery
plan: '06'
subsystem: plan-engine
tags: [rust, tdd, risk-policy, strong-auth, recovery, approval-fingerprint]
requires:
  - phase: 06-transactional-plans-and-recovery
    provides: Immutable plan-engine authority interfaces and device/evidence-bound plan revisions from Plans 06-03 and 06-05
provides:
  - Closed proportional risk admission for Verified, Advanced, Experimental, and locked Extreme operation versions
  - Exact current/review/proof fingerprint binding across plan, evidence, recovery, device, hardware, security posture, risk, and operation-version set
  - One-use action-scoped strong-auth proof admission with expiry, replay, and mismatch rejection
  - Stable localized-copy-safe denial codes and entitlement-independent local recovery admission
affects: [06-07, 06-08, 06-14, 06-19, plan-approval, mutation-gate, recovery-center]
tech-stack:
  added: []
  patterns: [closed admission decision table, exact authority fingerprint, one-use action proof, proportional recovery requirements, bounded pairwise property tests]
key-files:
  created:
    - crates/plan-engine/tests/risk_policy.rs
  modified:
    - crates/plan-engine/src/risk.rs
key-decisions:
  - 'Represent successful admission with ExecutableRisk only, making Extreme structurally incapable of reaching mutation.'
  - 'Require exact equality across current authority, reviewed confirmation, and native-verified proof bindings; every changed dimension produces an explicit fresh-review or proof-mismatch blocker.'
  - 'Permit Advanced without a Windows Restore Point only when manifest rollback is proven and second-layer unavailability is explicitly acknowledged; Experimental always requires the complementary restore layer to be ready.'
patterns-established:
  - 'Proportional admission is derived from the immutable maximum registered risk, never from renderer risk claims or a user-requested downgrade.'
  - 'Every denial exposes a stable unique reason code suitable for localized aria-describedby copy.'
requirements-completed: [PLAN-04, PLAN-05]
duration: 11 min
completed: 2026-08-13
status: complete
---

# Phase 06 Plan 06: Proportional Risk and Exact Approval Admission Summary

**Native Rust policy now admits only exact, freshly reviewed non-Extreme plans whose immutable risk, evidence, recovery, device preference, confirmation, and one-use strong-auth proof all match the current operation set.**

## Performance

- **Duration:** 11 min
- **Started:** 2026-08-13T14:44:33Z
- **Completed:** 2026-08-13T14:55:16Z
- **Tasks:** 3
- **Files modified:** 2

## Accomplishments

- Added a closed admission decision that computes mixed-plan risk from immutable registered operation versions and has no executable Extreme representation.
- Bound Advanced preference, user review, proportional confirmation, recovery readiness, and native proof to exact device, hardware, security posture, plan, evidence, recovery, risk, and operation-version authority.
- Rejected missing/degraded/contradictory/incompatible/unknown evidence, stale or boundary-expired proofs, wrong actions, consumed proofs, and every exact binding mismatch.
- Preserved Advanced operation-manifest rollback with explicit second-layer-unavailable acknowledgement while requiring a ready complementary restore layer for Experimental admission.
- Added deterministic bounded property coverage for risk maxima, authority drift, proof dimensions, and the pairwise risk/recovery/proof matrix while proving local recovery remains callable without auth or subscription input.

## TDD Gate Compliance

| Gate | Commit | Evidence |
| --- | --- | --- |
| RED | `20e85cef` | The new behavior suite failed at compile time solely because the proportional admission decisions and proof-binding types did not yet exist. |
| GREEN | `a03378d9` | The minimal closed policy made all 13 initial focused cases pass. |
| REFACTOR | `efc0392c` | The consolidated risk requirement table and expanded pairwise properties pass all 18 focused cases. |

## Task Commits

Each TDD gate was committed atomically:

1. **Task 1 RED: Specify proportional risk gates** - `20e85cef` (test)
2. **Task 2 GREEN: Enforce risk ceiling and exact approval fingerprint** - `a03378d9` (feat)
3. **Task 3 REFACTOR: Exhaust the admission matrix** - `efc0392c` (refactor)

## Files Created/Modified

- `crates/plan-engine/tests/risk_policy.rs` - Named D-09 through D-16 cases plus deterministic bounded risk, recovery, and proof properties.
- `crates/plan-engine/src/risk.rs` - Immutable operation risk, exact authority fingerprints, preference/recovery projections, one-use proofs, proportional requirements, closed decisions, and stable denial codes.

## Decisions Made

- `RiskCeiling` remains only a maximum: it never selects operations and cannot lower the maximum immutable risk already present in the explicit selection.
- Verified needs review and one confirmation but no strong-auth proof; Advanced adds a bound device-local preference, detailed review, manifest rollback, proportional restore handling, and fresh one-use proof; Experimental additionally requires beta visibility, exact per-version/per-apply consent, a localized exact phrase, and a ready complementary restore point.
- Preference enable/revoke persistence and authentication remain outside this pure policy; this plan consumes only an authoritative device-local projection.
- Typed phrases and credentials do not appear in the successful admission. Only a bounded proof reference may cross into later mutation-gate work.

## Verification

- `rtk cargo test -p liiiraa-plan-engine --test risk_policy` passed 18/18 tests.
- `rtk cargo test -p liiiraa-plan-engine` passed 31/31 tests across four suites.
- `rtk cargo fmt -p liiiraa-plan-engine -- --check` passed.
- `rtk cargo check -p liiiraa-plan-engine` passed with only pre-existing interface dead-code warnings.
- `rtk cargo clippy -p liiiraa-plan-engine --tests` passed with only pre-existing generated/interface warnings.
- `rtk pnpm test:architecture` passed both live adapters and 51/51 architecture tests.
- Git history contains the required RED -> GREEN -> REFACTOR sequence.
- Focused source scans found no stub markers, renderer authority booleans, persisted typed phrases/credentials, wildcard allow branch, or executable Extreme construction.

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered

- The plan's Task 3 command `rtk cargo test -p liiiraa-plan-engine risk_policy` is a test-name filter and reports the integration tests as filtered. The exact integration target command was run separately and passed all 18 cases; the complete package suite also passed all 31 cases.

## User Setup Required

None - no external service configuration required.

## Known Stubs

None.

## Threat Flags

None. The changed files implement the plan's declared renderer/session-to-mutation trust boundary and introduce no network endpoint, file access, schema, or new external trust surface.

## Next Phase Readiness

- Mutation-gate and execution plans can consume a closed admission that cannot represent Extreme and that preserves exact proof reference custody without renderer authority.
- Approval UI and recovery flows have stable blocker codes for accessible localized explanations and exact fresh-review diffs.
- No blocker remains for downstream Phase 6 approval, execution, and recovery integration.

## Self-Check: PASSED

- Both key files exist.
- RED commit `20e85cef`, GREEN commit `a03378d9`, and REFACTOR commit `efc0392c` exist in the required order.
- All task acceptance criteria and plan-level verification gates pass.

---

_Phase: 06-transactional-plans-and-recovery_
_Completed: 2026-08-13_
