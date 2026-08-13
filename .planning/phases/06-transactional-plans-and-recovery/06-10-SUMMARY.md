---
phase: 06-transactional-plans-and-recovery
plan: '10'
subsystem: plan-engine
tags: [rust, tdd, exact-version-promotion, signed-revocation, redacted-diagnostics]
requires:
  - phase: 06-transactional-plans-and-recovery
    provides: Immutable promotion, revocation, diagnostic, and recovery interfaces from Plan 06-03
  - phase: 06-transactional-plans-and-recovery
    provides: Device- and evidence-bound immutable operation versions from Plan 06-05
  - phase: 06-transactional-plans-and-recovery
    provides: Entitlement-independent local recovery admission from Plan 06-06
provides:
  - Sequential simulation, clean-VM, owner-PC, and friends-PC admission for one exact immutable operation version and build
  - Complete recovery-cycle and exact evidence ID/hash binding at every promotion stage
  - Permanent per-version failure and signed revocation blockers with no override, remote rollback, or remote execution authority
  - Local redacted preview-first diagnostic projection with exact consent binding and no automatic transport
affects: [06-21, 06-26, 06-27, 06-28, phase-7-catalog-promotion]
tech-stack:
  added: []
  patterns: [append-only exact-version promotion ledger, exact evidence tuple binding, bounded signed revocation effects, preview-bound diagnostic consent]
key-files:
  created:
    - crates/plan-engine/tests/promotion.rs
  modified:
    - crates/plan-engine/src/promotion.rs
key-decisions:
  - 'Bind every promotion to operation version, immutable build, exact stage, predecessor promotion, and exact evidence ID/hash tuple; no one dimension may drift.'
  - 'Treat a failed or validly revoked operation version as permanently blocked for new applications while keeping local recovery available without online, auth, or Premium inputs.'
  - 'Expose friends diagnostics only as a local redacted preview whose exact fingerprint and user-selected action require explicit consent; no automatic transport exists.'
patterns-established:
  - 'Promotion authority is an append-only in-memory policy ledger with no public override or reset operation; corrections require a distinct version beginning at simulation.'
  - 'Bounded physical evidence always retains explicit coverage gaps and structurally returns false for universal-support claims.'
requirements-completed: [PLAN-01, PLAN-07, PLAN-08]
duration: 10 min
completed: 2026-08-13
status: complete
---

# Phase 06 Plan 10: Exact-Version Promotion and Safe Revocation Summary

**Rust policy now advances only an exact immutable operation version and build through four ordered complete recovery cycles, permanently blocks failed or revoked versions, preserves local recovery, and keeps friends diagnostics redacted, previewed, consent-bound, and local by default.**

## Performance

- **Duration:** 10 min
- **Started:** 2026-08-13T15:17:50Z
- **Completed:** 2026-08-13T15:27:48Z
- **Tasks:** 3
- **Files modified:** 2

## Accomplishments

- Added a sequential exact-version ledger for deterministic simulation, clean Windows VM, owner PC, and friends PCs with exact predecessor identity and no stage-skip path.
- Required recovery preparation, apply, post-apply verification, required restart completion, restore, and post-restore verification together with exact operation version, immutable build, stage, evidence IDs, and evidence hashes.
- Made failure permanent for that version while allowing a corrected new version to restart only at deterministic simulation; no manual override or reset API exists.
- Verified signed revocations through an injected verifier port and limited admitted effects to blocking new applications, alerting affected users, and preserving local recovery.
- Added redacted local diagnostic previews whose SHA-256 fingerprint must match explicit export/send consent and which expose no automatic transport, raw identifier, or secret path.
- Preserved explicit physical hardware coverage gaps at every accepted stage and structurally prohibited universal-support claims.

## TDD Gate Compliance

| Gate | Commit | Evidence |
| --- | --- | --- |
| RED | `10a83c20` | The 642-line behavior suite failed at the intentionally absent concrete promotion, revocation, and diagnostic policy boundary. |
| GREEN | `5eca82ac` | The minimal exact-version ledger, bounded revocation disposition, and local diagnostic policy made all 9 initial cases pass. |
| REFACTOR | `be499ca6` | Exact evidence hashes, duplicate rejection, immutable-build drift, malformed-failure resistance, arbitrary histories, redaction properties, and all-stage coverage gaps pass 12 focused cases. |

## Task Commits

Each TDD gate was committed atomically:

1. **Task 1 RED: Specify sequential promotion and revocation** - `10a83c20` (test)
2. **Task 2 GREEN: Enforce exact-version evidence progression** - `5eca82ac` (feat)
3. **Task 3 REFACTOR: Prove no bypass or universal claim** - `be499ca6` (refactor)

## Files Created/Modified

- `crates/plan-engine/tests/promotion.rs` - Exact stage, recovery-cycle, failure, version/build drift, revocation, privacy, redaction, consent, and coverage-gap behavior/property tests.
- `crates/plan-engine/src/promotion.rs` - Append-only exact-version promotion ledger, immutable evidence binding, signed revocation port/effects, and redacted preview-first diagnostic release policy.

## Decisions Made

- Promotion evidence identity is the exact evidence ID plus SHA-256 hash, not merely an evidence label; duplicates and hash swaps fail closed.
- The immutable build identity must remain equal across every stage for one operation version; changing the build cannot borrow an earlier stage's authority.
- Failed evidence is validated before it can poison the version ledger; malformed or mismatched failure input is rejected without creating a permanent denial-of-service blocker.
- Revocation authority has no mutation command, rollback instruction, script, generic action, or remote transport surface. Recovery is an unconditional local safety query.
- A diagnostic preview fingerprint binds the exact reviewed redacted bytes to one explicit export or support-send intent; consent for another preview or absent consent is rejected.

## Verification

- `rtk cargo test -p liiiraa-plan-engine --test promotion` passed 12/12 tests.
- `rtk cargo test -p liiiraa-plan-engine` passed 69/69 tests across seven suites.
- `rtk cargo fmt -p liiiraa-plan-engine -- --check` passed.
- `rtk cargo clippy -p liiiraa-plan-engine --tests` passed with zero errors; 18 pre-existing generated/interface warnings remain.
- `rtk pnpm test:architecture` passed both live adapters and 51/51 architecture tests.
- Git history contains RED -> GREEN -> REFACTOR commits in the required order.
- Focused source and behavior scans prove no public override/reset path, remote rollback/execution authority, automatic upload, raw diagnostic projection, or universal support claim.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Rejected malformed failure evidence before permanent version blocking**

- **Found during:** Task 3 (Prove no bypass or universal claim)
- **Issue:** The initial GREEN ordering could record a failed verdict before proving that the evidence ID/hash tuple belonged to the exact candidate, allowing edited input to poison a version ledger.
- **Fix:** Moved complete-cycle and exact evidence tuple validation ahead of permanent failure recording and added a regression test proving the valid exact version can still start after malformed failure input is rejected.
- **Files modified:** `crates/plan-engine/src/promotion.rs`, `crates/plan-engine/tests/promotion.rs`
- **Verification:** Focused 12-case promotion suite and full 69-case package suite pass.
- **Committed in:** `be499ca6`

---

**Total deviations:** 1 auto-fixed (1 bug).
**Impact on plan:** The fix closes a tampering-driven denial-of-service path at the declared promotion trust boundary without adding scope or authority.

## Issues Encountered

- The plan's Task 3 command `rtk cargo test -p liiiraa-plan-engine promotion` is a name filter and reports most integration tests as filtered. The exact integration target command was run separately and passed all 12 promotion cases; the complete package suite passed 69 cases.

## User Setup Required

None - no external service configuration required.

## Known Stubs

None.

## Threat Flags

None. The implementation covers the plan-declared promotion evidence, revocation, and diagnostic trust boundaries and adds no network endpoint, file access, schema, or remote execution surface.

## Next Phase Readiness

- Plan 06-21 can evaluate exact-version promotion evidence and privacy omissions against a concrete fail-closed policy.
- Plans 06-26 through 06-28 can persist and review clean-VM, owner-PC, and friends-PC evidence without authorizing stage or build drift.
- Phase 7 catalog promotion can consume a fully promoted exact version while retaining explicit unsupported physical hardware coverage.

## Self-Check: PASSED

- Both key files exist.
- RED commit `10a83c20`, GREEN commit `5eca82ac`, and REFACTOR commit `be499ca6` exist in order.
- All task acceptance criteria, plan-level verification, package, formatting, lint, and architecture gates pass.
- The unrelated user changes in `apps/account/.gitignore`, `apps/admin/.gitignore`, and `apps/web/.gitignore` remain unstaged and untouched.

---

_Phase: 06-transactional-plans-and-recovery_
_Completed: 2026-08-13_
