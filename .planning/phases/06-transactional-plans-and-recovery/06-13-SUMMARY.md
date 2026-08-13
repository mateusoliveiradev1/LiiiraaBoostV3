---
phase: 06-transactional-plans-and-recovery
plan: '13'
subsystem: security
tags: [rust, windows-service, named-pipe, sqlite, hmac, replay-protection]
requires:
  - phase: 06-transactional-plans-and-recovery
    provides: Generated broker request/response validation, pure plan-engine boundary, and approved windows-service identity from Plans 06-01, 06-02, and 06-04
provides:
  - Minimal Windows service adapter with explicit local named-pipe DACL policy and remote-client rejection
  - Generated-valid authenticated broker boundary with client token/session/process identity gates and canonical HMAC messages
  - FULL-durable SQLite request reservation, terminal replay, crash observation, nonce/counter authority, and bounded retention
affects: [06-15, 06-16, 06-18, 06-26, 06-27, 06-28, privileged-broker]
tech-stack:
  added: [windows-service 0.8.1]
  patterns: [reserve-before-dispatch, durable-idempotency, observation-before-retry, closed-operation-registry, service-custodied-replay-state]
key-files:
  created:
    - apps/optimizer-service/Cargo.toml
    - apps/optimizer-service/src/main.rs
    - apps/optimizer-service/src/ipc.rs
    - apps/optimizer-service/src/dedup_store.rs
    - apps/optimizer-service/tests/ipc_protocol.rs
  modified:
    - Cargo.toml
    - Cargo.lock
    - architecture/module-boundaries.json
key-decisions:
  - 'Bind privileged dependency admission to the exact reviewed windows-service 0.8.1 registry checksum and Mullvad source identity.'
  - 'Authenticate a verified local native host before issuing a session secret, then bind canonical messages to a server nonce, durable counter, one-time nonce, transaction, step, and operation version.'
  - 'Mark an admitted identity unknown before dispatch so every crash boundary returns observation-required and can never redispatch blindly.'
patterns-established:
  - 'Exact terminal duplicates return the original durable result; conflicting bytes, stale counters, and reused nonces fail closed.'
  - 'Only compiled generated-valid operation variants cross the broker boundary; generic script, file, registry, service, remote, and Extreme authority remains absent.'
requirements-completed: [PLAN-05, PLAN-06]
duration: 15 min
completed: 2026-08-13
status: complete
---

# Phase 06 Plan 13: Privileged Broker and Durable IPC Summary

**An exact-approved `windows-service 0.8.1` adapter now guards a local-only named-pipe broker with generated validation, verified client identity, canonical HMAC authentication, and restart-durable SQLite deduplication.**

## Performance

- **Duration:** 15 min
- **Started:** 2026-08-13T08:25:47Z
- **Completed:** 2026-08-13T08:41:01Z
- **Tasks:** 3
- **Files modified:** 8

## Accomplishments

- Revalidated the APPROVED supply-chain record before mutation, then resolved only `windows-service 0.8.1` from crates.io with checksum `857224b3b211c6f3616921f081ee54721ee3ad2ace2fac6a6337e032f7b4dcf2` and exact manifest requirement `=0.8.1`.
- Added an optimizer-owned production adapter and Windows service lifecycle accepting Stop, Shutdown, and Preshutdown without elevating the desktop UI.
- Defined an explicit protected DACL for SYSTEM, Administrators, the service SID, and the verified interactive logon SID, plus `PIPE_REJECT_REMOTE_CLIENTS` on the local named-pipe server.
- Authenticated local machine, impersonation, token, interactive session, logon SID, nonzero process, and exact native-host image hash before session establishment.
- Validated every request through the generated `TransactionalRecoveryDocument` schema and converted it only into one of five compiled allowlisted operations.
- Persisted `(transaction_id, step_id)` reservations, request hashes, operation versions, closed states, canonical results, durable counters, and one-time nonces under WAL plus `synchronous=FULL`.
- Proved exact terminal replay, clean restart, repeated reopen, crash-after-reserve, crash-after-dispatch, preshutdown, retention, timeout, malformed MAC, remote, spoofed-process, wrong-session, and generic-authority behavior with 14 adversarial tests.

## TDD Execution

### RED

- Added the complete adversarial protocol contract before implementation.
- The test binary compiled successfully and failed 8/8 assertions on empty pipe policy, unavailable authentication, missing custody enforcement, and absent durable broker behavior rather than workspace or import errors.
- Commit: `bd39061f`.

### GREEN

- Implemented the service entrypoint, named-pipe security adapter, generated validation, canonical HMAC sessions, strict allowlist, reserve-before-dispatch database, terminal outcome custody, and fail-closed error mapping.
- The initial suite passed 8/8 and the architecture suite passed 51/51.
- Commit: `e3917b3a`.

### REFACTOR

- Moved monotonic counter and one-time request-nonce authority into the same durable reservation transaction, capped pruning at the 180-day replay horizon, and expanded restart/preshutdown/retention/timeout/redaction proofs.
- The final focused suite passed 14/14 under both plan commands.
- Commit: `cc2d16f9`.

## Package Approval Evidence

- Pre-mutation command `rtk node tooling/supply-chain/phase6-windows-service-approval.mjs validate-approved` exited zero and reported `Validated APPROVED evidence for windows-service 0.8.1.`
- Approved source: Mullvad `windows-service-rs` tag `v0.8.1`, immutable commit `aab40570b50c05b8e6f3c375171727e666ee42a0`.
- Approved license: `MIT OR Apache-2.0`.
- `Cargo.toml` requires exactly `windows-service = "=0.8.1"`.
- `Cargo.lock` resolves exactly version `0.8.1`, crates.io registry source, and approved checksum `857224b3b211c6f3616921f081ee54721ee3ad2ace2fac6a6337e032f7b4dcf2`.
- The approval validator is intentionally a pre-install guard: after exact consumption it rejects dependency presence by design, so the recorded zero-exit preflight and post-resolution lock comparison are the two applicable gates.

## Task Commits

1. **Task 1 RED: Preflight the approval and specify restart-durable authenticated IPC** - `bd39061f` (test)
2. **Task 2 GREEN: Authenticate requests and persist dedup outcomes under service custody** - `e3917b3a` (feat)
3. **Task 3 REFACTOR: Prove shutdown, restart, retention, and protocol errors** - `cc2d16f9` (refactor)

## Files Created/Modified

- `Cargo.toml` - Registers the isolated service workspace member.
- `Cargo.lock` - Records the exact approved dependency identity and service graph.
- `architecture/module-boundaries.json` - Registers the optimizer-owned production adapter.
- `apps/optimizer-service/Cargo.toml` - Declares only generated contracts, persistence/crypto support, Windows APIs, and exact `windows-service` authority.
- `apps/optimizer-service/src/main.rs` - Defines the Windows service lifecycle and bounded preshutdown handling.
- `apps/optimizer-service/src/ipc.rs` - Owns local pipe policy, identity authentication, canonical MAC, generated validation, replay gates, and closed dispatch.
- `apps/optimizer-service/src/dedup_store.rs` - Owns migrations, FULL-durable reservation/outcome state, counter/nonce replay authority, and safe retention.
- `apps/optimizer-service/tests/ipc_protocol.rs` - Proves legitimate, adversarial, restart, crash, preshutdown, timeout, retention, and redaction behavior.

## Decisions Made

- Session secrets are derived only after service-owned identity verification and are never logged or projected to React.
- Exact completed replay is safe and returns prior authority, while reserved or unknown identity returns observation-required without dispatch.
- A new identity advances counter and nonce replay state atomically with reservation, so service restart cannot reset replay authority.
- The operation dispatcher accepts only five compiled variants after generated schema validation; it exposes no generic JSON, path, command, registry, file, service, script, remote host, or risk override branch.

## Verification

- `rtk cargo test -p liiiraa-optimizer-service --test ipc_protocol` - 14/14 passed.
- `rtk cargo test -p liiiraa-optimizer-service ipc` - 14/14 passed across two suites.
- `rtk cargo fmt -p liiiraa-optimizer-service -- --check` - passed.
- `rtk cargo clippy -p liiiraa-optimizer-service --bin liiiraa-optimizer-service --no-deps -- -D warnings` - passed with no issues.
- `rtk pnpm test:architecture` - 51/51 passed; workspace and Cargo adapters each executed once.
- Exact lock scan confirmed the approved version, crates.io source, and checksum.

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered

- A workspace-local dependency clippy run surfaced pre-existing `large_enum_variant` warnings in generated Phase 5/contract code. The service-only no-dependency clippy gate passes; unrelated generated contracts were not modified.
- The approval tool's `validate-approved` mode intentionally includes a dependency-absent pre-install guard. It passed immediately before mutation and cannot be rerun after legitimate consumption; exact post-install identity was instead mechanically compared in `Cargo.toml` and `Cargo.lock`.

## Authentication Gates

None.

## User Setup Required

None - no external service configuration required.

## Known Stubs

None. `OperationDispatcher` is the deliberate closed physical-effect port required by this plan; it admits no operation until a later physical-operation adapter implements one of the compiled variants.

## Next Phase Readiness

- Plans 06-15, 06-16, and 06-18 can bind exact physical operations and recovery orchestration to this broker without widening its protocol.
- Plans 06-26 through 06-28 can exercise packaged Windows identity, DACL, crash, reboot, and physical promotion evidence.
- No replay, generic-authority, dependency-identity, or architecture blocker remains in this plan.

## Self-Check: PASSED

- All five created key files and all three modified key files exist.
- RED `bd39061f`, GREEN `e3917b3a`, and REFACTOR `cc2d16f9` exist in repository history in the required order.
- Every task acceptance criterion and plan-level verification gate passes.

---

_Phase: 06-transactional-plans-and-recovery_
_Completed: 2026-08-13_
