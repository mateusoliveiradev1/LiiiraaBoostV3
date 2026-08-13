---
phase: 06-transactional-plans-and-recovery
plan: '15'
subsystem: windows-operations
tags: [rust, windows, powrprof, power-scheme, tdd, recovery, drift]
requires:
  - phase: 06-transactional-plans-and-recovery
    provides: Observation-first reconciliation, authenticated broker context, and prepared transaction execution from Plans 06-08, 06-13, and 06-14
provides:
  - Closed four-operation registry for observe, duplicate-managed, activate-managed, and delete-owned power actions
  - Exact-state apply and restore lifecycle for the journaled Liiiraa Verificado scheme
  - Typed Windows PowrProf adapter with canonical metadata and complete AC/DC setting fingerprint observation
  - Generated lifecycle, drift, ownership, error-boundary, and observation-purity proofs
affects: [06-18, 06-26, 06-27, 06-28, optimizer-service, recovery-executor]
tech-stack:
  added: []
  patterns: [journaled-guid-identity, observe-before-effect, exact-owned-cleanup, typed-powrprof-only]
key-files:
  created:
    - apps/optimizer-service/src/operations/mod.rs
    - apps/optimizer-service/src/operations/power_scheme.rs
    - apps/optimizer-service/tests/power_scheme.rs
  modified:
    - apps/optimizer-service/Cargo.toml
    - apps/optimizer-service/src/main.rs
key-decisions:
  - 'Treat a nonzero journaled GUID as the only managed destination identity; the friendly name is exact presentation metadata and never ownership authority.'
  - 'Define canonical scheme state as exact GUID, friendly name, description, and a sorted SHA-256 fingerprint of every enumerated AC/DC setting value.'
  - 'Restore and cleanup only after exact prior/target observation; any third state, changed metadata/settings, or uncertain ownership returns conflict without delete authority.'
patterns-established:
  - 'PowrProf calls require a verified interactive client context and use only typed observe, duplicate-managed, activate-managed, and delete-owned ports.'
  - 'API return codes are intermediate evidence; success requires exact post-effect observation of the active GUID and canonical state.'
requirements-completed: [PLAN-03, PLAN-06, PLAN-07]
duration: 8 min
completed: 2026-08-13
status: complete
---

# Phase 06 Plan 15: Exact Managed Power-Scheme Operation Summary

**The optimizer service now duplicates the exact active Windows power scheme into a journaled `Liiiraa Verificado` GUID, verifies and activates it through typed PowrProf calls, then restores the exact prior scheme and deletes only an unchanged owned target.**

## Performance

- **Duration:** 8 min
- **Started:** 2026-08-13T16:35:17Z
- **Completed:** 2026-08-13T16:42:48Z
- **Tasks:** 3 TDD gates
- **Files modified:** 5

## Accomplishments

- Added the only admitted Phase 6 power-operation registry: observe, duplicate managed, activate managed, and delete owned, with no generic/Extreme operation surface.
- Implemented exact preflight, prior observation, deterministic destination handling, UTF-16 `Liiiraa Verificado` naming, created-state verification, activation, active-state re-observation, exact restoration, and ownership-checked cleanup.
- Preserved the prior power scheme unchanged and rejected prior drift, unowned duplicate GUIDs, third-state conflicts, changed prior state, changed target state, and access denial without widening mutation authority.
- Added a Windows adapter using `PowerGetActiveScheme`, `PowerDuplicateScheme`, `PowerWriteFriendlyName`, `PowerWriteDescription`, `PowerSetActiveScheme`, `PowerDeleteScheme`, `PowerSettingAccessCheckEx`, and typed enumeration/read APIs from `windows` 0.62.2.
- Proved observation purity and ownership behavior across 128 repeated-observation cases, 96 complete arbitrary-GUID lifecycles, 96 externally changed targets, and injected port-error boundaries.

## TDD Gate Compliance

| Gate | Commit | Evidence |
| --- | --- | --- |
| RED | `7b26a62a` | The focused suite compiled and failed 8 intended lifecycle assertions while the callable seam remained fail closed. |
| GREEN | `e9686420` | Exact apply/restore behavior and the typed Windows adapter made all initial 10 tests pass. |
| REFACTOR | `4d26900d` | Generated state/error properties and consolidated PowrProf GUID cleanup pass 14/14 focused tests. |

## Task Commits

1. **Task 1 RED: Specify exact power-scheme lifecycle** - `7b26a62a` (test)
2. **Task 2 GREEN: Apply and exactly restore Liiiraa Verificado** - `e9686420` (feat)
3. **Task 3 REFACTOR: Prove idempotent observation and ownership** - `4d26900d` (refactor)

## Files Created/Modified

- `apps/optimizer-service/src/operations/mod.rs` - Closed four-entry physical power-operation registry.
- `apps/optimizer-service/src/operations/power_scheme.rs` - Exact lifecycle policy, verified client context, narrow port, and typed PowrProf implementation.
- `apps/optimizer-service/tests/power_scheme.rs` - Deterministic fake PowrProf lifecycle, drift, ownership, error, and generated-sequence proofs.
- `apps/optimizer-service/src/main.rs` - Registers the operations module in the service crate.
- `apps/optimizer-service/Cargo.toml` - Enables only the `windows` Power and Registry type features required to compile documented PowrProf APIs; no dependency was added.

## Decisions Made

- Destination GUIDs are generated and journaled outside the effect adapter. The adapter accepts only a nonzero typed `PowerSchemeId` and never invents or accepts a generic GUID write operation.
- Canonical state includes exact identity and presentation metadata plus a stable fingerprint over all enumerated subgroup/setting AC and DC indices, so external setting edits revoke cleanup ownership.
- Already-applied and already-restored paths are observation-only. A known target must match the exact recorded snapshot; friendly-name equality alone is insufficient.
- PowrProf-allocated GUID pointers are copied and released through one `LocalFree` helper, including the defensive duplicate-result path.

## Verification

- `rtk cargo test -p liiiraa-optimizer-service --test power_scheme` passed 14/14 focused lifecycle and property tests.
- `rtk cargo test -p liiiraa-optimizer-service power_scheme` exited successfully as the plan-specified name filter; it selected zero tests, so the exact target command above is the complete witness.
- `rtk cargo test -p liiiraa-optimizer-service` passed 39/39 tests across four suites.
- `rtk cargo fmt -p liiiraa-optimizer-service -- --check` passed.
- `rtk cargo check -p liiiraa-optimizer-service` passed.
- `rtk cargo clippy -p liiiraa-optimizer-service --bin liiiraa-optimizer-service --no-deps -- -D warnings` passed with no issues.
- `rtk pnpm test:architecture` passed both live adapters and 51/51 architecture tests.
- Source scans found no shell/subprocess, PowerShell, direct registry mutation, generic operation, Extreme operation, gain claim, TODO, FIXME, placeholder, or unavailable stub.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] Added a callable fail-closed power seam during RED**

- **Found during:** Task 1 (Specify exact power-scheme lifecycle)
- **Issue:** The operations module and power adapter were absent, so an external integration suite could not compile behavioral assertions without a minimal type/port seam.
- **Fix:** Added the closed registry, exact-state vocabulary, verified-context constructor, narrow port, and fail-closed apply/restore functions before implementing lifecycle behavior.
- **Files modified:** `apps/optimizer-service/src/operations/mod.rs`, `apps/optimizer-service/src/operations/power_scheme.rs`, `apps/optimizer-service/tests/power_scheme.rs`
- **Verification:** RED compiled and failed 8 intended behavior assertions rather than import or syntax errors.
- **Committed in:** `7b26a62a`

**2. [Rule 3 - Blocking] Added minimal service module and Windows feature wiring**

- **Found during:** Task 2 (Apply and exactly restore Liiiraa Verificado)
- **Issue:** The new module was not reachable from the service crate, and `windows` gates PowrProf signatures behind its Power and Registry type features.
- **Fix:** Registered `operations` in `main.rs` and enabled only `Win32_System_Power` plus `Win32_System_Registry`; no crate or generic registry API was added.
- **Files modified:** `apps/optimizer-service/src/main.rs`, `apps/optimizer-service/Cargo.toml`
- **Verification:** Windows-target compile, strict service clippy, focused tests, and architecture gates all pass.
- **Committed in:** `e9686420`

---

**Total deviations:** 2 auto-fixed (2 blocking issues).
**Impact on plan:** Both changes were mechanically required to produce a behavioral RED and compile the exact typed PowrProf adapter. They add no new dependency or generic mutation surface.

## Issues Encountered

- Context7 was unavailable on the host, so version-specific signatures were grounded in the installed exact `windows` 0.62.2 generated source and the plan's official Microsoft PowrProf references.
- The plan's Task 3 command is a Rust name filter and selected zero tests because behavior names do not contain `power_scheme`; the exact `--test power_scheme` target was run and passed 14/14, followed by the full 39-test service suite.

## Authentication Gates

None.

## User Setup Required

None - no external service configuration required.

## Known Stubs

None. Physical clean-VM, owner-PC, and friends-PC promotion remains intentionally owned by sequential Plans 06-26 through 06-28.

## Threat Flags

None. The new Windows trust surface is exactly the plan-declared PowrProf boundary, guarded by verified client context, expected-prior checks, exact observation, and owned-target cleanup.

## Next Phase Readiness

- Plan 06-18 can bind the closed broker dispatcher to this exact operation lifecycle without inventing generic GUID, command, registry, service, or script authority.
- Plans 06-26 through 06-28 can prove the user-scoped PowrProf behavior and full apply/restart/restore cycle on the clean VM, owner PC, and consented friends PCs.
- No deterministic lifecycle, drift, ownership, compile, lint, or architecture blocker remains.

## Self-Check: PASSED

- All five declared key files and this summary exist.
- RED `7b26a62a`, GREEN `e9686420`, and REFACTOR `4d26900d` exist in required order.
- All task acceptance criteria and plan-level focused, full-service, format, compile, lint, source-scan, and architecture gates pass.
- The user-owned changes in `apps/account/.gitignore`, `apps/admin/.gitignore`, and `apps/web/.gitignore` remain unstaged and untouched.

---

_Phase: 06-transactional-plans-and-recovery_
_Completed: 2026-08-13_
