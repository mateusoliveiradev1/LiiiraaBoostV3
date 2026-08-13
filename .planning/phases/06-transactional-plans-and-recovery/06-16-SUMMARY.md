---
phase: 06-transactional-plans-and-recovery
plan: '16'
subsystem: recovery
tags: [rust, windows, system-restore, srclient, tdd, fail-closed]
requires:
  - phase: 06-transactional-plans-and-recovery
    provides: Minimal authenticated privileged broker and compiled PrepareRestorePoint operation from Plan 06-13
provides:
  - Fixed System32-only dynamic SrClient.dll and SRSetRestorePointW boundary
  - Truthful begin, end, API status, sequence, and post-call observation projection
  - Proportional complementary-recovery admission that never replaces the Liiiraa manifest
affects: [06-18, 06-26, 06-27, 06-28, optimizer-service, recovery]
tech-stack:
  added: []
  patterns: [observation-before-success, complementary-only-recovery, thread-bound-dll-ownership]
key-files:
  created:
    - apps/optimizer-service/src/restore_point.rs
    - apps/optimizer-service/tests/restore_point.rs
  modified:
    - apps/optimizer-service/Cargo.toml
    - apps/optimizer-service/src/main.rs
key-decisions:
  - 'Treat SRSetRestorePointW return, status, and sequence as request evidence only; only a matching post-call observation can establish a usable point.'
  - 'Keep the Liiiraa operation manifest primary: Advanced may continue only with explicit second-layer-unavailable acknowledgement, while Experimental requires an observed usable complement.'
  - 'Load only SrClient.dll from System32 and resolve only SRSetRestorePointW; expose no generic loader, registry mutation, PowerShell, or WMI authority.'
patterns-established:
  - 'Restore-point evidence retains requested, begin, end, and observed truth as separate fields.'
  - 'DLL and COM resources are thread-bound and released deterministically on every exit path.'
requirements-completed: [PLAN-05, PLAN-07]
duration: 5 min
completed: 2026-08-13
status: complete
---

# Phase 06 Plan 16: Truthful Windows Restore-Point Preparation Summary

**A fixed `SrClient.dll`/`SRSetRestorePointW` adapter now records begin/end/status/sequence evidence and requires matching observation before Windows System Restore can count as a usable complementary recovery layer.**

## Performance

- **Duration:** 5 min
- **Started:** 2026-08-13T15:35:21Z
- **Completed:** 2026-08-13T15:40:14Z
- **Tasks:** 3
- **Files modified:** 4

## Accomplishments

- Added a narrow Windows adapter that initializes a multithreaded COM apartment, loads only `SrClient.dll` from System32, resolves only `SRSetRestorePointW`, submits bounded begin/end records, and balances library/COM resources.
- Preserved API return, status, sequence, and post-call observation separately so `TRUE` cannot fabricate a new usable point when Windows reuses an existing point or observation is absent.
- Made disabled, safe-mode, policy/access denial, missing DLL/symbol, shutdown, partial begin/end, frequency skip, not-created, and observation failure explicit closed states.
- Enforced D-27 proportional policy while preserving the primary Liiiraa manifest: Verified remains usable with manifest recovery, Advanced requires explicit degraded acknowledgement, Experimental requires observed usable complement, and Extreme remains blocked.

## TDD Execution

### RED

- Added nine executable tests covering the fixed DLL/symbol boundary, COM/readiness failures, exact begin/end sequence, documented failures, frequency reuse, observation truth, proportional risk admission, and manifest primacy.
- The suite compiled and failed 8/9 adapter/policy assertions against the deliberate no-op implementation; the static no-fallback boundary assertion passed.
- Commit: `3ff6dc4`.

### GREEN

- Implemented the pure preparation policy plus the production Windows dynamic adapter and registered the module with exactly the three required Win32 feature families.
- The focused suite passed 9/9; rustfmt and service-only clippy passed.
- Commit: `3c02ae8`.

### REFACTOR

- Restricted DLL lookup to System32, made COM ownership thread-bound, balanced `FreeLibrary`/`CoUninitialize`, and added partial-end, mismatched-sequence, failed-observation, and cleanup guards.
- The final focused suite passed 11/11, the service package passed 25/25, and architecture passed 51/51.
- Commit: `adc6f0a`.

## Task Commits

1. **Task 1 RED: Specify truthful restore-point preparation** - `3ff6dc4` (test)
2. **Task 2 GREEN: Resolve, create, end, and observe restore-point status** - `3c02ae8` (feat)
3. **Task 3 REFACTOR: Harden DLL/resource failure handling** - `adc6f0a` (refactor)

## Files Created/Modified

- `apps/optimizer-service/src/restore_point.rs` - Owns the complementary restore-point port, projection, risk admission, and fixed Windows adapter.
- `apps/optimizer-service/tests/restore_point.rs` - Proves deterministic availability, begin/end, frequency, observation, cleanup, and proportional-admission behavior.
- `apps/optimizer-service/Cargo.toml` - Enables only `Win32_System_Com`, `Win32_System_LibraryLoader`, and `Win32_System_Restore` for the documented adapter.
- `apps/optimizer-service/src/main.rs` - Registers the restore-point module in the privileged service crate.

## Decisions Made

- A successful API call is never a usable restore-point verdict by itself; the observed sequence must match the requested begin/end sequence.
- A reused recent sequence is `SkippedFrequency`, not newly created or usable, and the adapter never changes `SystemRestorePointCreationFrequency`.
- The adapter owns no operation-manifest deletion path. Complement failure changes only complementary state and risk admission.
- The production constructor accepts only the service host's process-wide COM callback-security readiness result; deterministic tests prove false readiness remains unavailable, while packaged callback behavior remains assigned to Plan 06-26.

## Verification

- `rtk cargo test -p liiiraa-optimizer-service --test restore_point` - 11/11 passed.
- `rtk cargo test -p liiiraa-optimizer-service restore_point` - command passed; Cargo's name filter selected zero tests, so the explicit integration-test command above is the substantive task gate.
- `rtk cargo test -p liiiraa-optimizer-service` - 25/25 passed across three suites.
- `rtk cargo fmt -p liiiraa-optimizer-service -- --check` - passed.
- `rtk cargo clippy -p liiiraa-optimizer-service --bin liiiraa-optimizer-service --no-deps -- -D warnings` - passed.
- `rtk pnpm test:architecture` - 51/51 passed; workspace and Cargo adapters each executed once.
- TDD history is ordered RED `3ff6dc4` -> GREEN `3c02ae8` -> REFACTOR `adc6f0a`.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] Registered the module and exact Windows feature families**
- **Found during:** Task 2 (GREEN implementation)
- **Issue:** The plan's two declared artifact files could not compile as production service code without registering the module and enabling the existing `windows` crate's COM, LibraryLoader, and Restore generated bindings.
- **Fix:** Added one `pub mod restore_point` declaration and exactly `Win32_System_Com`, `Win32_System_LibraryLoader`, and `Win32_System_Restore`; no dependency or broader authority was added.
- **Files modified:** `apps/optimizer-service/src/main.rs`, `apps/optimizer-service/Cargo.toml`
- **Verification:** Focused tests, package tests, clippy, and architecture suite passed.
- **Committed in:** `3c02ae8`

**2. [Rule 2 - Missing Critical] Restricted DLL resolution to System32**
- **Found during:** Task 3 (resource hardening)
- **Issue:** A bare dynamic DLL search would leave unnecessary DLL-preloading ambiguity at a privileged boundary.
- **Fix:** Used `LoadLibraryExW` with `LOAD_LIBRARY_SEARCH_SYSTEM32` while retaining the exact fixed `SrClient.dll` and `SRSetRestorePointW` contract.
- **Files modified:** `apps/optimizer-service/src/restore_point.rs`, `apps/optimizer-service/tests/restore_point.rs`
- **Verification:** Static boundary guard, focused suite, clippy, package tests, and architecture suite passed.
- **Committed in:** `adc6f0a`

---

**Total deviations:** 2 auto-fixed (1 blocking, 1 missing critical)
**Impact on plan:** Both changes are necessary to compile and safely constrain the documented privileged adapter; neither widens its command surface.

## Issues Encountered

- The literal Task 3 command uses a Cargo test-name filter and selected zero tests. The explicit `--test restore_point` gate was therefore rerun and passed all 11 cases, followed by the complete service and architecture suites.

## Authentication Gates

None.

## User Setup Required

None - no external service configuration required.

## Known Stubs

None. Real clean-VM System Restore availability and callback behavior are intentionally physical evidence owned by Plan 06-26, not a simulated production fallback.

## Threat Flags

None. The privileged System Restore boundary is fully covered by planned threats T-06-16A and T-06-16B; no additional endpoint, generic loader, registry, file, schema, or remote authority was introduced.

## Next Phase Readiness

- Plan 06-18 can consume a closed complementary-recovery projection without confusing API dispatch with observed recovery readiness.
- Plan 06-26 owns clean-VM proof for actual COM callback security, System Restore availability, frequency behavior, and observed point usability; Plans 06-27 and 06-28 retain owner/friends physical evidence.
- No deterministic, TDD-gate, resource-ownership, generic-authority, or architecture blocker remains.

## Self-Check: PASSED

- Both created artifacts and both authorized integration files exist.
- RED `3ff6dc4`, GREEN `3c02ae8`, and REFACTOR `adc6f0a` exist in repository history in the required order.
- All task acceptance criteria and plan-level verification gates pass.
- No tracked files were deleted, no generated/untracked files remain, and the three pre-existing `apps/*/.gitignore` edits remain untouched.

---

_Phase: 06-transactional-plans-and-recovery_
_Completed: 2026-08-13_
