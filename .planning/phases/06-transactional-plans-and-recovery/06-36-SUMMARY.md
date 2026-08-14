---
phase: 06-transactional-plans-and-recovery
plan: '36'
subsystem: windows-privileged-effects
tags: [rust, windows, impersonation, powrprof, raii, token-custody]
requires:
  - phase: 06-29
    provides: closed physical dispatcher and opaque effect-lease requirement
  - phase: 06-30
    provides: authenticated restricted primary token owned by the named-pipe session
provides:
  - Lifetime-bound borrowed token authority for one dedicated interactive-user effect worker
  - Effective TokenUser SID and TokenSessionId verification before every PowrProf call
  - RAII RevertToSelf cleanup across success, error, panic, timeout drain, disconnect, and shutdown custody
  - Windows proof of bounded token/thread handle lifetime without LocalSystem substitution
affects: [06-37, physical-windows-promotion, optimizer-service]
tech-stack:
  added: []
  patterns:
    - Borrow native token custody into a non-cloneable effect lease; never expose the raw handle
    - Drain and join a timed-out dedicated worker before returning observation-required uncertainty
key-files:
  created:
    - apps/optimizer-service/tests/physical_user_context.rs
  modified:
    - apps/optimizer-service/src/dispatcher.rs
    - apps/optimizer-service/src/ipc.rs
    - apps/optimizer-service/src/operations/power_scheme.rs
    - apps/optimizer-service/src/windows_pipe.rs
    - apps/optimizer-service/tests/physical_dispatcher.rs
key-decisions:
  - 'Bind the effect lease lifetime to the session-owned OwnedHandle so token custody cannot outlive authentication or be cloned into renderer/domain authority.'
  - 'Treat timeout as unknown only after draining and joining the dedicated worker through verified RevertToSelf cleanup.'
  - 'Verify TokenUser SID and TokenSessionId from the active thread token immediately before invoking any PowrProf port method.'
patterns-established:
  - 'Effect order: authenticate token -> borrow lease -> dedicated worker -> impersonate -> verify effective identity -> closed PowrProf calls -> RevertToSelf -> join.'
  - 'Cleanup failure outranks an effect result and blocks further service work; broker return never proves Windows success.'
requirements-completed: [PLAN-05, PLAN-06, PLAN-07, PLAN-08]
duration: 14 min
completed: 2026-08-13
---

# Phase 06 Plan 36: Bounded Interactive-User PowrProf Impersonation Summary

**Every allowlisted PowrProf observation and mutation now executes under the exact authenticated interactive-user token, verifies its effective SID/session, and returns to service identity before the worker can finish or another request can proceed.**

## Performance

- **Duration:** 14 min
- **Started:** 2026-08-14T00:14:36Z
- **Completed:** 2026-08-14T00:27:59Z
- **Tasks:** 1 TDD task
- **Files modified:** 6

## Accomplishments

- Replaced the metadata-only effect lease with a lifetime-bound borrow of the session-owned restricted token; no raw handle, renderer DTO, generic RPC, or domain object receives token authority.
- Added one dedicated bounded effect worker that calls `ImpersonateLoggedOnUser`, verifies effective `TokenUser` SID plus `TokenSessionId`, executes the complete closed PowrProf sequence, and performs verified `RevertToSelf` cleanup.
- Made error, Rust panic/unwind, timeout, disconnect, shutdown, and normal completion converge on cleanup; timeout drains and joins the worker before returning `Timeout`/unknown state.
- Proved on Windows that wrong session and attempted LocalSystem substitution make zero effect calls, the caller returns to process/service identity, and 16 mixed cycles stay within a fixed two-handle tolerance.

## TDD Execution

### RED

- Added `physical_user_context.rs` first with effective SID/session, wrong-binding zero-call, LocalSystem-substitution, error, unwind, timeout-drain, service-identity restoration, and handle-count cases.
- Extended the fake physical dispatcher to count every port call so metadata-only and mismatched leases must remain exactly at zero.
- The RED run failed for the intended reason: five missing guard/token diagnostic and controlled-token APIs.
- Commit: `06a0b42` (`test(06-36): add failing interactive user effect proof`).

### GREEN

- Added a non-cloneable `InteractiveUserEffectGuard`, borrowed `InteractiveUserEffectLease`, Win32 effective-token queries, bounded worker execution, exact error mapping, and session-owned token-user custody.
- Routed observe, duplicate, activate, and delete through one `with_interactive_user` closure; restore-point preparation remains outside PowrProf and gains no token primitive.
- Focused suites passed 22/22; the full service passed 67 tests with one pre-existing elevated installed smoke ignored.
- Commit: `4e0169c` (`feat(06-36): bind PowrProf to interactive user token`).

### REFACTOR

- Centralized normal/error/panic result handling and cleanup-error priority in `InteractiveUserEffectGuard::finish_effect`.
- Re-ran the focused suites after cleanup consolidation: 22/22 passed.
- Commit: `2bb65b8` (`refactor(06-36): centralize effect guard cleanup`).

## Task Commits

1. **Task 1 RED: failing interactive-user effect proof** - `06a0b42` (test)
2. **Task 1 GREEN: token-bound PowrProf execution** - `4e0169c` (feat)
3. **Task 1 REFACTOR: centralized cleanup result handling** - `2bb65b8` (refactor)

## Files Created/Modified

- `apps/optimizer-service/tests/physical_user_context.rs` - Windows effective identity, cleanup matrix, LocalSystem rejection, timeout drain, and handle-count proof.
- `apps/optimizer-service/tests/physical_dispatcher.rs` - Exact zero-call assertions for metadata-only or fabricated lease authorization.
- `apps/optimizer-service/src/operations/power_scheme.rs` - Lifetime-bound lease, RAII impersonation guard, dedicated worker, Win32 identity queries, and handle-count test support.
- `apps/optimizer-service/src/dispatcher.rs` - One impersonated closure around each complete PowrProf observation/mutation sequence with fail-closed error mapping.
- `apps/optimizer-service/src/windows_pipe.rs` - TokenUser SID custody plus a borrowed lease tied to the owned restricted primary token.
- `apps/optimizer-service/src/ipc.rs` - Passes the exact configured request deadline into the borrowed effect lease.

## Effective-SID and Cleanup Evidence

| Case | Effective identity/effect | Cleanup evidence |
| --- | --- | --- |
| Success | Thread token SID/session equal authenticated token | Explicit RevertToSelf verified before return |
| PowrProf error | Effect error remains diagnostic | Guard reverts before mapping the error |
| Rust panic | Panic is caught at worker boundary | Guard reverts before `Panicked` is returned |
| Timeout | Result becomes timeout/observation-required uncertainty | Worker completes, reverts, drains, and joins before return |
| Wrong session | Closure not entered | No impersonation and zero PowrProf calls |
| LocalSystem substitution | Effective TokenUser mismatch | Closure not entered; guard reverts and rejects |
| Disconnect/shutdown | Session owns token until dispatch borrow ends | Session clear/drop closes token only after borrowed effect completes |

The repeated Windows matrix executes 16 success/error/panic/timeout cycles and asserts the final process handle count is no more than two handles above its initial sample; the test passed with no unbounded accumulation.

## Decisions Made

- The duplicated primary token remains owned only by `AuthenticatedClientToken`; `InteractiveUserEffectLease<'token>` borrows its handle and therefore cannot outlive the broker session.
- The complete preflight/observe/check/mutate sequence stays within one impersonation scope, eliminating identity changes between TOCTOU preconditions and mutation.
- `RevertToSelf` success is followed by an `OpenThreadToken` absence check. Cleanup uncertainty maps to `ServerStopping`, never accepted or retriable mutation authority.
- Test-only simulated leases preserve deterministic fake-port tests, but they cannot mint native token custody and production metadata-only contexts still fail before any call.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] Passed the broker deadline through IPC into effect execution**

- **Found during:** Task 1 GREEN
- **Issue:** The plan listed dispatcher/power files, but the existing timeout was checked only before dispatch and could not bound or classify an active impersonated effect.
- **Fix:** Added the configured request timeout to `DispatchContext` when the broker borrows the authenticated token lease.
- **Files modified:** `apps/optimizer-service/src/ipc.rs`
- **Verification:** Timeout test proves the worker drains/joins before returning; IPC and full service suites pass.
- **Committed in:** `4e0169c`

**2. [Rule 2 - Missing Critical] Bound TokenUser SID to token custody**

- **Found during:** Task 1 GREEN
- **Issue:** Plan 06-30 stored the interactive logon SID/session but not the token's user-account SID required for immediate effective `TokenUser` verification.
- **Fix:** Query and retain the token-user SID beside the owned handle during authenticated duplication, without logging or exposing it.
- **Files modified:** `apps/optimizer-service/src/windows_pipe.rs`
- **Verification:** Real Windows effective-SID and LocalSystem-substitution tests pass.
- **Committed in:** `4e0169c`

---

**Total deviations:** 2 auto-fixed (1 Rule 3 blocker, 1 Rule 2 security requirement)
**Impact on plan:** Both changes are necessary to enforce the specified deadline and identity verification at the real effect boundary; no authority or command vocabulary was widened.

## Issues Encountered

- Context7 was unavailable. Exact behavior and signatures were checked against official Microsoft documentation for `DuplicateTokenEx`, `ImpersonateLoggedOnUser`, `RevertToSelf`, token information classes, and `GetProcessHandleCount`, then verified through the pinned `windows` crate compilation.
- `cargo check` continues to report 27 pre-existing dead-code warnings in not-yet-consumed manifest/custody paths. The focused implementation introduced no clippy issue; the bin lint passes with the existing dead-code category explicitly allowed.

## Verification

- `rtk cargo test -p liiiraa-optimizer-service --test physical_user_context --test physical_dispatcher --test power_scheme` - 22 passed, 0 failed.
- `rtk cargo check -p liiiraa-optimizer-service --target x86_64-pc-windows-msvc` - passed with zero errors.
- `rtk cargo test -p liiiraa-optimizer-service` - 67 passed, 0 failed, 1 pre-existing elevated installed smoke ignored.
- `rtk cargo test -p liiiraa-optimizer-service --test windows_service_host --test ipc_protocol` - 22 passed, 1 elevated smoke ignored.
- `rtk cargo clippy -p liiiraa-optimizer-service --bin liiiraa-optimizer-service --no-deps -- -D warnings -A dead-code` - passed with no issues.
- `rtk cargo fmt --all -- --check` - passed.
- `rtk pnpm test:architecture` - 51 passed; workspace and Cargo adapters each executed once.
- `rtk gsd-sdk query verify.key-links .../06-36-PLAN.md` - 2/2 links verified.
- TDD gate log confirms RED `06a0b42` precedes GREEN `4e0169c`, followed by REFACTOR `2bb65b8`.

## Known Stubs

None. No TODO, FIXME, placeholder, empty authority, or native fallback was introduced in the changed Rust source/tests.

## Threat Flags

None. Token impersonation and the effect-worker boundary are the exact T-06-36A/B/C surfaces registered by the plan; no renderer, network, generic RPC, shell, or raw-handle surface was added.

## Authentication Gates

None.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness

- Plan 06-37 can send physical Tauri apply/restore requests through the fixed pipe knowing every PowrProf call is user-token-bound and cleanup-complete before dispatch returns.
- Physical promotion still requires its separately planned installed/elevated environment; deterministic and local Windows verification has no remaining identity, cleanup, handle, key-link, or compile blocker.

## Self-Check: PASSED

- All six created/modified source and test files exist.
- RED `06a0b42`, GREEN `4e0169c`, and REFACTOR `2bb65b8` exist in the required order.
- Focused identity/dispatcher/power suites, full service tests, Windows target check, rustfmt, clippy, architecture, and both key links pass.
- Requirements `[PLAN-05, PLAN-06, PLAN-07, PLAN-08]` exactly match the plan frontmatter.
- Stub and threat-surface scans found no unfinished implementation or unregistered authority.

---

*Phase: 06-transactional-plans-and-recovery*
*Completed: 2026-08-13*
