---
phase: 06-transactional-plans-and-recovery
plan: '30'
subsystem: windows-privileged-ipc
tags: [rust, windows-service, named-pipe, impersonation, dpapi, sqlite, deduplication]
requires:
  - phase: 06-29
    provides: authenticated broker protocol, durable deduplication, and physical operation dispatcher
  - phase: 06-35
    provides: canonical installed manifest, CMS/SPKI, live-byte, ACL, and monotonic-version verification
provides:
  - Local-only authenticated named-pipe service host for the physical optimizer dispatcher
  - Opaque restricted primary-token custody bound to the admitted client SID and session
  - Fail-closed installed startup gate and DPAPI-protected service storage
  - Bounded framing, serialized mutation admission, and stop/restart lifecycle handling
affects: [06-31, 06-32, 06-33, 06-34, 06-36, physical-windows-promotion]
tech-stack:
  added: []
  patterns:
    - Verify canonical installed custody and create the first secured pipe before reporting SCM Running
    - Impersonate only long enough to query identity and duplicate a restricted primary token, then immediately restore the service token
    - Hold client effect authority as a non-cloneable owned token whose Drop closes the native handle
key-files:
  created:
    - apps/optimizer-service/src/windows_pipe.rs
    - apps/optimizer-service/tests/windows_service_host.rs
  modified:
    - apps/optimizer-service/Cargo.toml
    - apps/optimizer-service/src/main.rs
    - apps/optimizer-service/src/ipc.rs
    - apps/optimizer-service/tests/ipc_protocol.rs
key-decisions:
  - 'Production broker sessions require an owned restricted primary token bound to the authenticated SID/session; metadata-only authentication remains debug-test-only.'
  - 'Store the install secret as machine-DPAPI ciphertext under an explicit protected service-only ACL and atomically persist monotonic admission identity with write-through replacement.'
  - 'Use one nonblocking local byte pipe with fixed framing and short polling so Stop, Shutdown, and Preshutdown close admission without a remote or network fallback.'
patterns-established:
  - 'Startup order: installed schema/CMS/SPKI/live hashes/ACL/version -> protected storage -> broker/dedup open -> secured pipe -> SCM Running.'
  - 'Connection order: bounded handshake -> pipe impersonation -> PID/image/session/logon-SID verification -> token duplication -> RevertToSelf -> serial generated request dispatch.'
requirements-completed: [PLAN-05, PLAN-06, PLAN-07, PLAN-08]
duration: 13 min
completed: 2026-08-13
---

# Phase 06 Plan 30: Authenticated Windows Service Pipe Host Summary

**The installed optimizer service now exposes one local-only bounded named pipe whose authenticated native client token authorizes serialized physical dispatch while durable deduplication prevents blind redispatch after interruption.**

## Performance

- **Duration:** 13 min
- **Started:** 2026-08-13T23:25:54Z
- **Completed:** 2026-08-13T23:38:01Z
- **Tasks:** 1 TDD task
- **Files modified:** 6

## Accomplishments

- Replaced the inert service wait loop with an SCM-aware host that verifies installed custody, prepares protected service state, creates the secured pipe, and only then reports `Running`.
- Added exact local byte-pipe framing with a 64 KiB maximum, five-second read/write/request limits, remote-client rejection, explicit DACL, serial admission, and bounded stop polling.
- Implemented Win32 pipe impersonation, client PID/image SHA-256/session/logon-SID verification, restricted primary-token duplication, unconditional `RevertToSelf`, opaque token custody, and handle release on rejection, disconnect, stop, error, or restart.
- Wired the authenticated token lease through the existing durable broker to `PhysicalOperationDispatcher`; renderer-supplied SID/session metadata cannot construct effect authority.
- Added machine-DPAPI install-secret custody, protected ProgramData directory/file ACLs, hardened SQLite custody, and atomic write-through monotonic installation admission records.
- Preserved reservation-first and observation-required restart semantics and made repeated test databases collision-free across rapid Windows process-ID reuse.

## TDD Execution

### RED

- Added tests defining the exact endpoint, frame bounds, malformed/partial/oversized rejection, serialized lifecycle, preshutdown admission closure, token SID/session binding, handle release, forbidden authority scan, and Windows API compile witnesses.
- The RED run failed because `windows_pipe.rs` and `service::windows_pipe` did not exist.
- Commit: `77b580e` (`test(06-30): add failing service host lifecycle`).

### GREEN

- Implemented the platform-neutral frame/lifecycle/token core, the real Win32 pipe/identity/custody host, broker token ownership, SCM status wiring, durable admission persistence, and the minimum required Windows IO feature binding.
- Added disconnect/preshutdown/wrong-binding token-release tests and repaired timestamp uniqueness in SQLite test paths after repeated full-suite execution exposed Windows PID-reuse collisions.
- Commit: `3fd68fe` (`feat(06-30): host authenticated optimizer pipe`).

### REFACTOR

- No separate behavior refactor was needed. Before the GREEN commit, admission-record replacement became atomic/write-through, client image resolution switched to Win32 paths, malformed connections were isolated without stopping the service, and new unsafe/native imports were cleaned.
- A supplemental ignored elevated installed-host start/stop/restart witness was committed as `9fab9af`; it compiles in normal CI and runs only where signed canonical installed custody and elevation exist.

## Task Commits

1. **Task 1 RED: failing service host lifecycle contract** - `77b580e` (test)
2. **Task 1 GREEN: authenticated optimizer named-pipe host** - `3fd68fe` (feat)
3. **Task 1 physical smoke witness** - `9fab9af` (test)

## Files Created/Modified

- `apps/optimizer-service/src/windows_pipe.rs` - Bounded host core, opaque token custody, installed startup gate, Win32 named pipe, impersonation, DPAPI storage, and dispatch loop.
- `apps/optimizer-service/tests/windows_service_host.rs` - Deterministic framing/lifecycle/token tests, source boundary audit, and gated elevated installed smoke witness.
- `apps/optimizer-service/src/main.rs` - SCM StartPending/Running/StopPending/Stopped integration around `WindowsPipeHost`.
- `apps/optimizer-service/src/ipc.rs` - Serializable broker envelopes, production token-backed sessions, effect-lease dispatch context, and deterministic session cleanup.
- `apps/optimizer-service/tests/ipc_protocol.rs` - Collision-resistant isolated SQLite paths for repeated restart/dedup verification.
- `apps/optimizer-service/Cargo.toml` - Enables the pinned Windows IO bindings needed by named-pipe cancellation and framed reads/writes.

## Decisions Made

- The service session secret is emitted only after successful local pipe impersonation and exact process/session/SID/hash admission; every earlier failure disconnects without a ticket or dispatch.
- The duplicated token requests only query, duplicate, and primary-assignment rights. Its raw handle is never public, cloneable, serializable, logged, or accepted from a caller.
- Pipe requests remain serial within a single-instance listener. A malformed, timed-out, or disconnected client loses only its connection; the service recreates the same secured local listener unless shutdown has begun.
- ProgramData secret and dedup custody are hardened before broker open. The secret is machine-DPAPI protected, and the monotonic admission file is replaced atomically with write-through semantics.
- Restore-point observation remains fail closed when the existing service host has no independently verified post-call observation; broker return alone never becomes success authority.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] Enabled the pinned Windows IO feature**

- **Found during:** Task 1 GREEN compilation
- **Issue:** `CreateNamedPipeW`, `ConnectNamedPipe`, `ReadFile`, `WriteFile`, and `CancelIoEx` in windows-rs 0.62.2 require the `Win32_System_IO` feature in addition to the already pinned pipe and filesystem bindings.
- **Fix:** Enabled only `Win32_System_IO` on the existing exact `windows = 0.62.2` dependency.
- **Files modified:** `apps/optimizer-service/Cargo.toml`
- **Verification:** Windows target compilation completes with zero errors.
- **Committed in:** `3fd68fe`

**2. [Rule 1 - Bug] Removed repeated-run SQLite fixture collisions**

- **Found during:** Final repeated full optimizer-service test run
- **Issue:** Existing test database names used only process ID plus a per-process counter; rapid Windows PID reuse could reopen stale dedup rows and create false replay failures.
- **Fix:** Added an epoch-nanosecond component to IPC and host test database directories while retaining process and atomic-counter isolation.
- **Files modified:** `apps/optimizer-service/tests/ipc_protocol.rs`, `apps/optimizer-service/tests/windows_service_host.rs`
- **Verification:** Full crate, focused host, and focused IPC suites pass consecutively: 62, 8, and 14 tests respectively.
- **Committed in:** `3fd68fe`

---

**Total deviations:** 2 auto-fixed (1 Rule 3 blocker, 1 Rule 1 bug)
**Impact on plan:** Both changes are limited to required typed Win32 IO exposure and deterministic verification reliability; no package, endpoint, command vocabulary, or trust authority was added.

## Issues Encountered

- Context7 was unavailable in the execution environment. Exact API signatures were verified against the locally installed source for the pinned `windows` 0.62.2 crate before compilation.
- The elevated installed smoke is intentionally ignored in ordinary development because the working tree is not the signed `%ProgramFiles%\Liiiraa Boost` installation. It is compiled on Windows and explicitly gated for the physical installed environment.

## Verification

- `rtk cargo test -p liiiraa-optimizer-service --test windows_service_host` - 8 passed, 1 elevated installed smoke ignored.
- `rtk cargo test -p liiiraa-optimizer-service --test ipc_protocol` - 14 passed, 0 failed.
- `rtk cargo test -p liiiraa-optimizer-service` - 62 passed across 9 suites, 0 failed.
- `rtk cargo check -p liiiraa-optimizer-service --target x86_64-pc-windows-msvc` - passed with zero errors; pre-existing integration-module dead-code warnings remain.
- `rtk cargo fmt --all -- --check` - passed.
- `rtk gsd-sdk query verify.key-links .planning/phases/06-transactional-plans-and-recovery/06-30-PLAN.md` - 3/3 links verified.
- Host source audit and executable tests found no TCP listener, remote pipe, PowerShell, `cmd.exe`, script body, command line, generic operation, or fixture fallback.

## Known Stubs

None. Stub scanning found no TODO, FIXME, placeholder, coming-soon path, empty rendered data, or caller-selected fallback in the changed production files. The restore-point observer's unavailable verdict is an intentional fail-closed safety result, not synthetic success.

## Threat Flags

None. The new pipe, authentication, lifecycle, installed file access, token custody, and protected ProgramData surfaces are the exact trust boundaries registered as T-06-30A through T-06-30E.

## Authentication Gates

None.

## User Setup Required

None - ordinary compilation and deterministic verification require no external service or secret. The ignored physical smoke runs only inside the separately provisioned signed/elevated installed test environment.

## Next Phase Readiness

- Plan 06-36 can consume an authenticated, non-forgeable interactive-user effect lease instead of public SID/session metadata.
- Physical promotion plans can run the gated installed smoke against signed canonical custody and use durable broker evidence to diagnose interruption without redispatch.
- No framing, token-release, custody startup, restart-dedup, Windows compilation, forbidden-authority, or key-link blocker remains.

## Self-Check: PASSED

- All six listed source/test files exist on disk.
- RED `77b580e`, GREEN `3fd68fe`, and supplemental smoke `9fab9af` exist in git history in the documented order.
- Focused host/IPC tests, the full optimizer-service crate, Windows target compilation, rustfmt, and all three key links pass.
- Requirements `[PLAN-05, PLAN-06, PLAN-07, PLAN-08]` exactly match the plan frontmatter.
- Stub and threat-surface scans found no unfinished implementation or unregistered trust boundary.

---

*Phase: 06-transactional-plans-and-recovery*
*Completed: 2026-08-13*
