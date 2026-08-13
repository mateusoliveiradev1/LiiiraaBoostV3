---
phase: 06-transactional-plans-and-recovery
plan: '29'
subsystem: privileged-windows-dispatch
tags: [rust, ipc, powrprof, system-restore, capability-security, tdd]
requires:
  - phase: 06-13
    provides: authenticated generated IPC, durable deduplication, and unknown-before-dispatch semantics
  - phase: 06-15
    provides: allowlisted PowrProf port with exact GUID, drift, and ownership semantics
  - phase: 06-16
    provides: observation-based complementary System Restore preparation
provides:
  - Request-preserving broker seam over the five generated privileged request variants
  - Opaque interactive-user effect lease required before any physical Windows port call
  - Closed PowrProf and restore-point dispatcher with redacted audit metadata and observation-required results
affects: [06-30, 06-31, 06-33, 06-34, 06-36, 06-37, physical-windows-promotion]
tech-stack:
  added: []
  patterns:
    - Generated request payloads remain intact through IPC validation and dispatch
    - Public identity metadata cannot substitute for an opaque effect capability
    - Physical mutation returns accepted diagnostics, never verified success or a receipt
key-files:
  created:
    - apps/optimizer-service/src/dispatcher.rs
    - apps/optimizer-service/tests/physical_dispatcher.rs
  modified:
    - apps/optimizer-service/src/ipc.rs
    - apps/optimizer-service/src/main.rs
    - apps/optimizer-service/src/operations/mod.rs
    - apps/optimizer-service/tests/ipc_protocol.rs
key-decisions:
  - 'Keep the generated PrivilegedBrokerRequest intact through durable reservation and dispatch instead of collapsing it to a payload-free operation enum.'
  - 'Treat session, SID, PID, and image hash as audit metadata only; physical effects additionally require an opaque InteractiveUserEffectLease bound to the verified session and SID.'
  - 'Return generated accepted/rejected/unavailable diagnostics from physical dispatch while reserving verified success and receipts for independent post-effect observation.'
patterns-established:
  - 'Closed physical dispatch: exhaustive matching over the generated five-variant request union, with no string command registry or generic execution primitive.'
  - 'Zero-call fail closed: missing lease, mismatched lease identity, wrong operation version, drift, conflict, and forbidden shapes cannot reach mutation methods.'
requirements-completed: [PLAN-05, PLAN-06, PLAN-07, PLAN-08]
duration: 15 min
completed: 2026-08-13
---

# Phase 06 Plan 29: Closed Physical Dispatcher Summary

**Generated broker requests now retain their exact payload through a capability-gated dispatcher that can invoke only the allowlisted PowrProf or restore-point ports and never equates transport acceptance with verified Windows success.**

## Performance

- **Duration:** 15 min
- **Started:** 2026-08-13T22:20:00Z
- **Completed:** 2026-08-13T22:35:22Z
- **Tasks:** 1 TDD task
- **Files modified:** 7

## Accomplishments

- Replaced the lossy `AllowedOperation` conversion with an exhaustive `PrivilegedBrokerRequest` dispatch seam while retaining transaction, step, operation-version, counter, nonce, device-binding, and operation-specific request fields.
- Added an opaque `InteractiveUserEffectLease`; metadata-only or identity-mismatched contexts fail authentication before any PowrProf or System Restore call.
- Mapped observe, duplicate, activate, delete, and restore-point preparation to existing narrow ports with exact GUID parsing, precondition checks, managed-target ownership checks, state-hash checks, and closed drift/conflict responses.
- Kept dispatcher results diagnostic: successful effects return generated-valid `accepted` documents requiring later observation, while drift/conflict and unavailable states remain explicit and cannot mint receipts.
- Proved malformed generic, script, PowerShell, registry, remote-host, and Extreme-shaped documents are structurally rejected and produce zero physical calls.

## TDD Execution

### RED

- Added the final dispatcher contract first with fake PowrProf and restore-point ports.
- `rtk cargo test -p liiiraa-optimizer-service --test physical_dispatcher` failed as intended with `E0432`: `service::dispatcher` did not exist.
- Commit: `5a64c82` (`test(06-29): add failing physical dispatcher contract`).

### GREEN

- Implemented the closed dispatcher, capability context, request-preserving IPC seam, exact preconditions, generated diagnostics, and compatibility update for the existing IPC spy.
- The focused dispatcher suite passed 3/3 and the durable IPC suite passed 14/14.
- Commit: `c64726c` (`feat(06-29): connect allowlisted physical dispatcher`).

### REFACTOR

- No separate refactor commit was needed. The GREEN implementation already separates generated transport validation, closed request selection, and operation-specific Windows effects, and all lint/format gates passed without cleanup changes.

## Task Commits

1. **Task 1 RED: failing physical dispatcher contract** - `5a64c82` (test)
2. **Task 1 GREEN: allowlisted physical dispatcher** - `c64726c` (feat)

## Files Created/Modified

- `apps/optimizer-service/src/dispatcher.rs` - Owns the opaque effect lease, dispatch context, redacted audit, exhaustive generated-request match, exact preconditions, and generated diagnostic responses.
- `apps/optimizer-service/tests/physical_dispatcher.rs` - Proves all five variants, exact-field flow, capability gating, drift/conflict behavior, wrong-version rejection, and forbidden-shape zero dispatch.
- `apps/optimizer-service/src/ipc.rs` - Preserves the generated request and verified client metadata through durable reservation into `OperationDispatcher`.
- `apps/optimizer-service/src/operations/mod.rs` - Supplies closed, stable audit names for the four power operations.
- `apps/optimizer-service/src/main.rs` - Registers the physical dispatcher module in the optimizer service crate.
- `apps/optimizer-service/tests/ipc_protocol.rs` - Updates the existing spy to accept generated requests plus dispatch context without weakening durable replay behavior.

## Decisions Made

- The IPC broker reserves and marks a request unknown before dispatch exactly as before, but it now passes the validated generated enum itself. This preserves every field without adding a second DTO or string registry.
- `DispatchContext::metadata_only` exists for nonphysical/protocol dispatch, but `PhysicalOperationDispatcher` always rejects it. Only a matching opaque lease admits a physical port call.
- The lease's production constructor remains crate-private and dormant for the authenticated Windows pipe host owned by Plan 06-30; test leases compile only with debug assertions.
- Exact operation versions are closed to `power-scheme-v1` and `restore-point-v1`; mismatched or Extreme-shaped version strings fail before port access.
- Delete authority requires the exact managed presentation identity and the exact expected canonical settings hash, and refuses to delete the active scheme.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] Registered the dispatcher module and adapted the existing IPC protocol spy**

- **Found during:** Task 1 GREEN
- **Issue:** The plan's primary file list did not include `src/main.rs` or `tests/ipc_protocol.rs`, but the new module had to be registered and the required existing suite had to implement the request-preserving trait signature to compile.
- **Fix:** Added `pub mod dispatcher` and updated only the test spy's typed match; no protocol expectations or replay semantics changed.
- **Files modified:** `apps/optimizer-service/src/main.rs`, `apps/optimizer-service/tests/ipc_protocol.rs`
- **Verification:** `ipc_protocol` passed 14/14, full optimizer-service passed 42/42, and architecture passed 51/51.
- **Committed in:** `c64726c`

---

**Total deviations:** 1 auto-fixed (Rule 3 blocking issue)
**Impact on plan:** Required integration glue only; no authority, dependency, or scope expansion.

## Issues Encountered

- The restore-point API and observer require distinct mutable references. The initial generic used one object for both roles and Rust correctly rejected the double borrow; the implementation was corrected to accept separate narrow ports before GREEN was committed.
- Initial test GUID/hash fixtures violated generated contract patterns. They were replaced with RFC-compatible version/variant GUIDs and exact 71-character `sha256:` hashes before GREEN.

## Verification

- `rtk cargo test -p liiiraa-optimizer-service --test physical_dispatcher` - 3 passed, 0 failed.
- `rtk cargo test -p liiiraa-optimizer-service --test ipc_protocol` - 14 passed, 0 failed.
- `rtk cargo test -p liiiraa-optimizer-service` - 42 passed across 5 suites, 0 failed.
- `rtk cargo fmt -p liiiraa-optimizer-service -- --check` - passed.
- `rtk cargo clippy -p liiiraa-optimizer-service --bin liiiraa-optimizer-service --no-deps -- -D warnings` - passed with no issues.
- `rtk pnpm test:architecture` - 51 passed; workspace and Cargo adapters each executed once.
- Production-source scan found no command process, shell, PowerShell, WMI, generic registry/file/service operation, remote-host dispatch, or Extreme branch in the dispatcher.

## Known Stubs

None. The authenticated Windows host's construction of the opaque lease is an explicit Plan 06-30 dependency, not fixture fallback or executable placeholder; until then metadata-only broker contexts fail closed.

## Threat Flags

None. The only new trust surface is the plan-declared generated-request-to-dispatcher and dispatcher-to-PowrProf/System Restore boundary, covered by T-06-29A/B/C mitigations and zero-call tests.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness

- Plan 06-30 can bind verified named-pipe client/token custody to the crate-private lease constructor without changing the dispatcher vocabulary.
- Plan 06-36 can implement bounded user impersonation around each already-scoped effect.
- Plan 06-37 can transport the exact physical request and observation flow without fixture fallback.
- No deterministic dispatcher, IPC replay, formatting, lint, or architecture blocker remains.

## Self-Check: PASSED

- Both created files and all four modified source/test files exist.
- RED `5a64c82` precedes GREEN `c64726c` in git history.
- Focused dispatcher, IPC, full optimizer-service, format, clippy, and architecture gates all pass.
- Requirements `[PLAN-05, PLAN-06, PLAN-07, PLAN-08]` exactly match the plan frontmatter.
- No generated file was edited and no generic or Extreme execution authority was introduced.

---

*Phase: 06-transactional-plans-and-recovery*
*Completed: 2026-08-13*
