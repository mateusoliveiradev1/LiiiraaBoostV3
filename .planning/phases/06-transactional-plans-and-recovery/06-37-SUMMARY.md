---
phase: 06-transactional-plans-and-recovery
plan: '37'
subsystem: desktop-privileged-ipc
tags: [rust, tauri, windows-named-pipe, authenticated-ipc, recovery, tdd]
requires:
  - phase: 06-30
    provides: authenticated local-only broker handshake, fixed named-pipe endpoint, and durable service dispatch
  - phase: 06-36
    provides: token-bound interactive-user PowrProf execution with verified cleanup
provides:
  - Physical-only Tauri apply and restore routing through the installed optimizer named pipe
  - Fixed authenticated 64 KiB framing with verified server identity and bounded Win32 I/O
  - Observation-first response-loss, startup, and tray-resume reconciliation without mutation redispatch
affects: [06-33, 06-38, physical-windows-promotion, desktop-installer]
tech-stack:
  added: []
  patterns:
    - Compile physical mutation authority only behind the phase6-physical Cargo feature
    - Keep one serialized executor and authenticated broker client outside renderer lifetime
    - Rebind durable observation artifacts to exact broker-observed Windows state before verdict projection
key-files:
  created: []
  modified:
    - apps/desktop/src-tauri/Cargo.toml
    - apps/desktop/src-tauri/src/main.rs
    - apps/desktop/src-tauri/src/plan_executor.rs
    - apps/desktop/src-tauri/tests/broker_protocol.rs
    - apps/desktop/src-tauri/tests/recovery_executor.rs
    - crates/plan-engine/src/executor.rs
    - crates/plan-engine/tests/executor.rs
key-decisions:
  - 'Compile and construct the real broker authority only for phase6-physical; ordinary builds retain explicit BrokerUnavailable mutation behavior.'
  - 'Treat every post-dispatch transport failure as observation-required unknown until a new authenticated session observes Windows state; never redispatch automatically.'
  - 'Derive observed journal and receipt state from the validated broker observation rather than from the requested target.'
patterns-established:
  - 'Physical command order: validate renderer intent -> recompute native plan state -> durable prepare -> authenticated broker dispatch -> exact observation -> durable verdict.'
  - 'Recovery order: load pending journal -> reconnect/authenticate -> observe once -> rebase event chain -> reconcile, with no mutable broker dispatch path.'
requirements-completed: [PLAN-01, PLAN-05, PLAN-06, PLAN-07, PLAN-08]
duration: 29 min
completed: 2026-08-14
---

# Phase 06 Plan 37: Installed Desktop Named-Pipe Execution Summary

**Physical Tauri apply and restore commands now cross one authenticated, bounded Windows named pipe into the installed optimizer service, while response loss and restart recover only through fresh observation and never blind redispatch.**

## Performance

- **Duration:** 29 min
- **Started:** 2026-08-14T00:37:57Z
- **Completed:** 2026-08-14T01:06:32Z
- **Tasks:** 1 TDD task
- **Files modified:** 7

## Accomplishments

- Added `WindowsNamedPipeBrokerTransport` for the single fixed `\\.\pipe\LiiiraaBoost\optimizer-v1` endpoint with exact big-endian framing, 64 KiB bounds, authenticated generated handshake, server PID/image verification, and finite connect/read/write deadlines.
- Added `NativePhysicalExecutionAuthority`, which owns the durable executor plus authenticated broker client under the existing Tauri mutex and is constructed only for `phase6-physical` builds.
- Routed apply, restore operation, restore plan, and restore checkpoint intents through native recomputation and `PlanExecutor::execute`; the behavioral proof shows exactly one mutation dispatch for each of the four paths.
- Kept ordinary builds on explicit `BrokerUnavailable` and proved the physical path has no fixture, callback, TCP, shell, arbitrary endpoint, or renderer-supplied authority fallback.
- Made response loss close execution as `Unknown`, then reconnect and reconcile startup or tray resume from one fresh Windows observation with zero mutation redispatch.
- Extended the plan-engine artifact model so a missing dispatch response uses a chain directly after durable prepare and every verdict binds to the exact validated observation.

## TDD Execution

### RED

- Added scripted byte-wire tests for the fixed endpoint, handshake bytes, partial framing, 64 KiB rejection, identity checks, timeout/disconnect handling, and forbidden fallback surface.
- Added physical-authority source and recovery tests requiring all four Tauri intents to use one real execution path and pending recovery to be observation-only.
- The RED suite failed because the named-pipe transport, physical authority, feature wiring, and recovery route did not exist.
- Commit: `660a62d6` (`test(06-37): add failing desktop pipe transport path`).

### GREEN

- Implemented the native pipe wire, authenticated broker client integration, physical feature wiring, exact native request/artifact generation, and Tauri command delegation.
- Corrected response-loss semantics so an unavailable post-dispatch observation persists unknown state instead of treating the requested state as observed.
- Added reconnectable startup/tray reconciliation and dynamic observation binding in the plan engine; apply plus all three restore intents dispatch exactly once, while recovery dispatches zero mutations.
- Commit: `ab1968fe` (`feat(06-37): connect desktop to optimizer named pipe`).

### REFACTOR

- Simplified transport cleanup with error inspection that disconnects failed sessions while preserving the original error and removed obsolete mutable test bindings.
- Commit: `b787cb4a` (`refactor(06-37): simplify transport error cleanup`).

## Task Commits

1. **Task 1 RED: failing desktop pipe transport contract** - `660a62d6` (test)
2. **Task 1 GREEN: authenticated desktop-to-service execution** - `ab1968fe` (feat)
3. **Task 1 REFACTOR: transport error cleanup** - `b787cb4a` (refactor)

## Files Created/Modified

- `apps/desktop/src-tauri/Cargo.toml` - Adds the opt-in physical feature and the pinned Windows pipe/COM/I/O feature bindings.
- `apps/desktop/src-tauri/src/main.rs` - Constructs physical authority, routes all four mutation intents, and reconciles on startup and tray/window resume.
- `apps/desktop/src-tauri/src/plan_executor.rs` - Implements fixed pipe transport, authentication, framing, server identity, native request generation, serialized authority, and recovery reconciliation.
- `apps/desktop/src-tauri/tests/broker_protocol.rs` - Proves handshake/framing/bounds/identity/deadline/no-fallback behavior with a scripted byte wire.
- `apps/desktop/src-tauri/tests/recovery_executor.rs` - Proves apply plus three restore paths dispatch once and response-loss/restart recovery never redispatches.
- `crates/plan-engine/src/executor.rs` - Supports a durable uncertainty chain and binds verdict/receipt artifacts to exact observed state.
- `crates/plan-engine/tests/executor.rs` - Keeps the executor fixture explicit about optional uncertainty artifacts.

## Decisions Made

- The physical binary fails startup if it cannot establish the installed authenticated broker session; it never silently substitutes the development adapter.
- The client handle is put in nonblocking named-pipe mode, and bounded loops treat pending I/O as retryable only until the finite deadline; pipe flush does not add an unbounded receiver wait.
- Server identity is accepted only when `GetNamedPipeServerProcessId` resolves to the exact optimizer executable under the Windows Program Files known folder.
- A transport error after durable prepare consumes one dispatch count even without a response. Reconciliation creates a new authenticated session, reads Windows state, and has no mutable broker reference.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Bound uncertain verdicts to unknown or exact observed state**

- **Found during:** Task 1 GREEN behavioral proof
- **Issue:** The interrupted implementation populated the response-loss observation artifact with the requested target, which could imply receipt eligibility and returned `InvalidRequest` instead of observation-required unknown.
- **Fix:** Made the uncertainty chain start directly after durable prepare with unknown state, then dynamically bind observation/verdict/receipt artifacts to whatever the authenticated broker actually observes.
- **Files modified:** `apps/desktop/src-tauri/src/plan_executor.rs`, `crates/plan-engine/src/executor.rs`, `crates/plan-engine/tests/executor.rs`
- **Verification:** The response-loss proof returns `ExecutionState::Unknown`, closes new mutation, and records exactly one dispatch; the plan-engine executor suite passes 21/21.
- **Committed in:** `ab1968fe`

**2. [Rule 2 - Missing Critical] Added executable startup and tray-resume reconciliation**

- **Found during:** Task 1 GREEN recovery audit
- **Issue:** Startup detected pending durable work but only projected `RecoveryRequired`; it did not reconnect and perform the required broker observation.
- **Fix:** Added pending transaction reconstruction, authenticated reconnect, event-chain rebasing, startup reconciliation, and the same recovery check before tray/window resume.
- **Files modified:** `apps/desktop/src-tauri/src/main.rs`, `apps/desktop/src-tauri/src/plan_executor.rs`, `apps/desktop/src-tauri/tests/recovery_executor.rs`
- **Verification:** A pending prepared transaction performs exactly one observation, reaches verified state, and keeps mutation dispatch count at zero.
- **Committed in:** `ab1968fe`

**3. [Rule 2 - Missing Critical] Enforced finite native pipe I/O instead of relying on blocking file calls**

- **Found during:** Task 1 GREEN threat-model review
- **Issue:** Deadline checks around a blocking client handle could not guarantee that `ReadFile` or `WriteFile` returned before the deadline.
- **Fix:** Put the client handle into `PIPE_NOWAIT`, mapped pending pipe I/O to bounded retries, avoided blocking flush semantics, and enabled only the pinned Windows I/O binding needed by the implementation.
- **Files modified:** `apps/desktop/src-tauri/Cargo.toml`, `apps/desktop/src-tauri/src/plan_executor.rs`
- **Verification:** Scripted timeout/partial/disconnect tests pass and the physical Windows target compiles with zero errors.
- **Committed in:** `ab1968fe`

---

**Total deviations:** 3 auto-fixed (1 Rule 1 bug, 2 Rule 2 missing critical safeguards)
**Impact on plan:** All fixes are required by the registered response-loss, restart, and bounded-I/O threat mitigations; no endpoint, command vocabulary, fallback, or renderer authority was added.

## Issues Encountered

- A strict all-target desktop Clippy probe remains blocked by pre-existing lint findings in unrelated desktop modules such as comparison, hardware inventory, window lifecycle, and identity. The plan's focused tests, format gate, and both required build profiles pass; unrelated lint cleanup was left out of scope.
- The existing plan-engine dead-code warnings remain unchanged in both build profiles and do not affect the zero-error compile result.

## Verification

- `rtk cargo test -p liiiraa-desktop --test broker_protocol --test recovery_executor` - 23 passed across two suites, 0 failed.
- `rtk cargo test -p liiiraa-plan-engine --test executor` - 21 passed, 0 failed.
- `rtk cargo check -p liiiraa-desktop --features phase6-physical --target x86_64-pc-windows-msvc` - passed with zero errors.
- `rtk cargo check -p liiiraa-desktop --target x86_64-pc-windows-msvc` - passed with zero errors and preserves explicit nonphysical unavailability.
- `rtk cargo fmt --all -- --check` - passed.
- `rtk gsd-sdk query verify.key-links .../06-37-PLAN.md` - 3/3 links verified.
- Source and behavioral scans found no fixture, callback, TCP, shell, arbitrary endpoint, or second-transport fallback in the physical path.

## Known Stubs

None. The changed production paths contain no TODO, FIXME, placeholder response, empty authority, or mock data source. Nonphysical `BrokerUnavailable` is an intentional build-profile boundary, not a stub or fallback.

## Threat Flags

None. The named pipe, broker-response, journal, reconnect, and physical command surfaces are the exact T-06-37A/B/C trust boundaries registered by the plan.

## Authentication Gates

None.

## User Setup Required

None - no external service configuration is required. Physical execution still depends on the separately packaged and installed signed optimizer service defined by the phase promotion flow.

## Next Phase Readiness

- The packaged runner can now exercise the exact desktop-to-service route instead of a desktop-side unavailable stub.
- Physical promotion retains its signed/elevated installed-environment gate; deterministic and Windows compile evidence has no remaining pipe, recovery, fallback, or key-link blocker.

## Self-Check: PASSED

- All seven listed modified files exist on disk.
- RED `660a62d6`, GREEN `ab1968fe`, and REFACTOR `b787cb4a` exist in the required order.
- Desktop broker/recovery suites, plan-engine executor suite, both Windows build profiles, rustfmt, and all three key links pass.
- Apply and all three restore intents each prove one dispatch; response loss proves one dispatch followed by unknown, and restart proves one observation with zero redispatch.
- Requirements `[PLAN-01, PLAN-05, PLAN-06, PLAN-07, PLAN-08]` exactly match the plan frontmatter.

---

*Phase: 06-transactional-plans-and-recovery*
*Completed: 2026-08-14*
