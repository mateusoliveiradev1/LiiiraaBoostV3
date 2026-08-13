---
phase: 06-transactional-plans-and-recovery
plan: '18'
subsystem: desktop-native
tags: [rust, tauri, sqlite, hmac, recovery, broker, capabilities]
requires:
  - phase: 06-transactional-plans-and-recovery
    provides: Pure transaction executor, HMAC-anchored recovery store, native proof custody, authenticated broker protocol, power-scheme adapter, and restore-point adapter from Plans 06-09/11/12/13/14/15/16
provides:
  - Native PlanExecutor owning recovery-first admission, serialized mutation state, authoritative progress snapshots, and shutdown continuity
  - Generated-valid HMAC-authenticated broker client with bounded messages, native-only session material, monotonic counters, and closed response mapping
  - Exact Tauri plan command protocol, ordered Channel snapshots, app-owned diagnostic exports, and trusted-main-webview capabilities
affects: [06-20, 06-21, 06-24, 06-26, 06-27, 06-28, desktop-client, packaged-windows]
tech-stack:
  added: [liiiraa-plan-engine desktop dependency, Tauri app command ACL manifest]
  patterns: [recovery-first startup, native-owned executor, generated transport validation, authenticated broker boundary, exact webview capability]
key-files:
  created:
    - apps/desktop/src-tauri/src/plan_commands.rs
    - apps/desktop/src-tauri/src/plan_executor.rs
    - apps/desktop/src-tauri/tests/recovery_executor.rs
    - apps/desktop/src-tauri/tests/broker_protocol.rs
    - apps/desktop/src-tauri/capabilities/main.json
    - apps/desktop/src-tauri/permissions/.gitignore
  modified:
    - apps/desktop/src-tauri/src/main.rs
    - apps/desktop/src-tauri/Cargo.toml
    - apps/desktop/src-tauri/build.rs
    - apps/desktop/src-tauri/tests/shell_contract.rs
    - Cargo.lock
key-decisions:
  - 'Reconcile the HMAC-anchored journal during Tauri setup before managing the executor or exposing plan commands; unresolved or unverifiable state closes new mutation admission.'
  - 'Keep broker session keys, nonces, and monotonic counters in the native authenticated client and validate both request and response as generated transactional documents before mapping.'
  - 'Bind custom Tauri commands to an explicit app ACL manifest and the trusted main window/webview; expose no shell, script, registry, service, file-write, or generic native permission.'
  - 'Treat renderer documents only as validated intents; physical mutation remains fail-closed until native authority can recompute an exact admitted execution request and establish an authenticated packaged broker session.'
patterns-established:
  - 'Renderer reconnect reads one native authoritative snapshot; a sequence gap requires refetch and never replays a mutation.'
  - 'Diagnostic export is app-owned and create-new only, after consent matches the exact redacted preview fingerprint.'
requirements-completed: [PLAN-01, PLAN-02, PLAN-05, PLAN-06, PLAN-07, PLAN-08]
duration: 18 min
completed: 2026-08-13
---

# Phase 06 Plan 18: Native Transaction Authority Integration Summary

**The unprivileged Tauri host now starts from durable recovery truth, retains execution across renderer/tray interruption, validates a closed plan-command protocol, and crosses privilege only through an authenticated, bounded broker client.**

## Performance

- **Duration:** 18 min
- **Started:** 2026-08-13T17:02:22Z
- **Completed:** 2026-08-13T17:20:35Z
- **Tasks:** 2
- **Files modified:** 12

## Accomplishments

- Added a native `PlanExecutor` that owns the pure deterministic executor, durable recovery priority, authoritative progress, shutdown admission, and diagnostic custody independently of the renderer window.
- Adapted the HMAC-anchored SQLite `RecoveryStore` to the pure journal port so every prepared intent, event, checkpoint, and receipt remains generated-valid and durable before it can authorize progress.
- Added an authenticated broker client that retains and zeroizes session material in Rust, signs canonical envelopes, advances counters monotonically, bounds messages, and rejects unknown request/response kinds before or after transport.
- Registered the exact desktop-client plan command identities with Tauri Channels and generated custom-command ACL permissions scoped to the trusted `main` window/webview.
- Preserved the existing close-to-tray path and stopped new admission on process exit so prepared or unresolved work is reconciled from the journal on the next boot.
- Added recovery, reconnect, command-identity, diagnostic-consent, raw-message, malformed-response, session-redaction, lifecycle-order, and capability assertions.

## TDD Gate Compliance

- **RED:** `bd698530` introduced the two host integration suites; both failed because `plan_executor.rs` did not exist.
- **GREEN:** `5a8298e6` implemented native executor/store/broker composition and made 9 focused tests pass.
- **Integration:** `6488609d` registered startup, tray/shutdown continuity, named commands, and capabilities.
- **Correction:** `9b98feed` aligned every native command identity with the generated desktop-client protocol and kept reconnect on the Channel path.

## Task Commits

1. **Task 1 RED: Specify recovery executor and broker protocol** - `bd698530` (test)
2. **Task 1 GREEN: Integrate native recovery executor and broker client** - `5a8298e6` (feat)
3. **Task 2: Register recovery-first Tauri lifecycle** - `6488609d` (feat)
4. **Task 2 correction: Align exact command protocol** - `9b98feed` (fix)

## Files Created/Modified

- `apps/desktop/src-tauri/src/plan_executor.rs` - Native execution ownership, recovery-store ports, monotonic progress, diagnostic consent/export, and authenticated broker client.
- `apps/desktop/src-tauri/src/plan_commands.rs` - Closed command names, generated document validation, command-to-intent identity, and bounded export names.
- `apps/desktop/src-tauri/tests/recovery_executor.rs` - Startup recovery, reconnect, progress gaps, three restore targets, diagnostic consent, lifecycle order, and capability evidence.
- `apps/desktop/src-tauri/tests/broker_protocol.rs` - Pre-transport rejection, canonical authenticated exchange, malformed/oversized response rejection, counter monotonicity, and secret redaction.
- `apps/desktop/src-tauri/src/main.rs` - Setup-time recovery initialization, managed executor, named Tauri commands, Channels, app-owned exports, and shutdown admission closure.
- `apps/desktop/src-tauri/Cargo.toml` and `Cargo.lock` - Exact workspace dependency on the pure plan engine.
- `apps/desktop/src-tauri/build.rs` - Tauri custom-command ACL manifest generation.
- `apps/desktop/src-tauri/capabilities/main.json` - Trusted main window/webview allowlist for exact native commands.
- `apps/desktop/src-tauri/permissions/.gitignore` - Ignores Tauri-generated command permission fragments while retaining the reviewed capability.
- `apps/desktop/src-tauri/tests/shell_contract.rs` - Updated bounded command-registration assertion.

## Decisions Made

- Startup journal reconciliation precedes executor management and command registration; pending, corrupt, unavailable, conflict, and restart-verification state never admits new mutation.
- Closing the main window remains a renderer lifecycle action only. The native managed executor and store survive tray hiding, and application exit merely closes new work for next-boot reconciliation.
- Session secrets are never serializable or renderer-visible. Debug output redacts both nonce and key, and key bytes are zeroized on drop.
- The desktop command allowlist uses the exact command strings already published by `packages/desktop-client`; protocol drift is a test failure.
- Renderer-supplied documents can select only a closed intent. They cannot produce fixture success, proof validity, compatibility, entitlement, recovery readiness, or privileged authority.

## Verification

- `rtk cargo test -p liiiraa-desktop --test recovery_executor` - 6/6 passed.
- `rtk cargo test -p liiiraa-desktop --test broker_protocol` - 4/4 passed.
- `rtk cargo test -p liiiraa-desktop` - 197/197 passed across 20 suites.
- `rtk cargo test -p liiiraa-plan-engine --test executor` - 21/21 passed.
- `rtk cargo test -p liiiraa-optimizer-service --test ipc_protocol` - 14/14 passed.
- `rtk cargo check -p liiiraa-desktop` - passed; only existing pure-interface dead-code warnings remain.
- `rtk cargo fmt -p liiiraa-desktop -- --check` - passed.
- `rtk cargo clippy -p liiiraa-desktop --tests --no-deps` - zero errors; existing repository warnings remain.
- `rtk pnpm test:architecture` - 51/51 passed with both live adapters.
- `rtk pnpm verify:foundation` - reached two pre-existing lint failures outside this plan; see Issues Encountered and `deferred-items.md`.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 2 - Missing Critical] Added the Tauri application command manifest**

- **Found during:** Task 2 capability wiring
- **Issue:** A capability file naming custom commands is not enforceable unless `tauri-build` generates an application ACL manifest for those commands.
- **Fix:** Declared every registered application command in `build.rs`, which generates exact allow/deny permission identities consumed by `capabilities/main.json`.
- **Files modified:** `apps/desktop/src-tauri/build.rs`, `apps/desktop/src-tauri/capabilities/main.json`, `apps/desktop/src-tauri/permissions/.gitignore`
- **Verification:** Tauri build/check succeeds; lifecycle/capability test asserts every plan command exists in the manifest and capability and no generic authority is present.
- **Committed in:** `6488609d`

**2. [Rule 1 - Bug] Aligned native command identities with the generated desktop-client protocol**

- **Found during:** Post-Task 2 integration review
- **Issue:** Initial native names such as `restore_operation` and `read_execution` differed from the established client contract (`restore_plan_operation`, `read_plan_execution`, and related names), which would make real renderer calls fail closed for the wrong reason.
- **Fix:** Renamed handler, build-manifest, capability, and test identities to the exact existing `PLAN_COMMANDS` set and exposed authoritative reconnect through `subscribe_plan_execution` Channel delivery.
- **Files modified:** `plan_commands.rs`, `main.rs`, `build.rs`, `capabilities/main.json`, `shell_contract.rs`
- **Verification:** 28 focused integration/shell tests, desktop check, and full 197-test desktop suite pass.
- **Committed in:** `9b98feed`

**3. [Rule 3 - Blocking] Updated the existing shell command-count gate**

- **Found during:** Task 2 full desktop verification
- **Issue:** `shell_contract.rs` correctly failed because its former exact count and allowlist represented the pre-Phase-6 command surface.
- **Fix:** Extended the assertion with only the 11 reviewed plan command identities.
- **Files modified:** `apps/desktop/src-tauri/tests/shell_contract.rs`
- **Verification:** Full desktop suite passes 197/197.
- **Committed in:** `6488609d`, corrected in `9b98feed`

---

**Total deviations:** 3 auto-fixed (1 missing critical security control, 1 integration bug, 1 blocking test contract).
**Impact on plan:** All changes make the native boundary enforceable and interoperable without adding renderer secrets, fixture success, remote execution, or generic privilege.

## Issues Encountered

- `pnpm verify:foundation` is blocked by pre-existing lint failures in `packages/desktop-client/src/plans.ts:1` (`no-import-type-side-effects`) and `tooling/architecture-tests/src/check-cargo.ts:106` (`no-unsafe-assignment`). Neither file was changed by this plan; the findings are recorded in `deferred-items.md`. The plan-owned Rust, Tauri, broker, architecture, formatting, and security gates all pass.

## User Setup Required

None - no external service configuration required.

## Known Stubs

None. Physical mutation remains deliberately fail-closed until the packaged host establishes the verified broker session and later physical-promotion plans admit the exact operation version; no fixture or renderer fallback exists.

## Threat Flags

None. The new file-write surface is the plan-declared diagnostic export only: it is rooted below app data, accepts a bounded safe JSON filename, uses create-new semantics, and requires consent bound to the exact redacted preview fingerprint.

## Next Phase Readiness

- Plans 06-20/21/24 can exercise the exact client/native command set, authoritative reconnect semantics, fault matrix, and capability evidence.
- Plans 06-26 through 06-28 can establish the packaged authenticated broker session and physical promotion evidence without widening the renderer or Tauri privilege boundary.
- The two unrelated foundation lint findings remain deferred to their owning files.

## Self-Check: PASSED

- All declared created/modified files exist.
- RED, GREEN, lifecycle, and correction commits exist in order.
- Required focused and full plan-owned verification commands pass.
- No plan-owned generated files remain untracked, and user-owned `.gitignore` changes remain untouched.

---
*Phase: 06-transactional-plans-and-recovery*
*Completed: 2026-08-13*
