---
phase: 06-transactional-plans-and-recovery
plan: '23'
subsystem: database
tags: [sqlite, hmac-sha256, strong-auth, device-binding, recovery]
requires:
  - phase: 06-01
    provides: Closed generated Advanced preference event and projection contracts
  - phase: 06-09
    provides: FULL-durable SQLite recovery authority and externally anchored keyed journal
  - phase: 06-12
    provides: Consumed one-use enable and revoke proofs bound to exact device posture
provides:
  - Device-local append-only Advanced preference enable, revoke, and invalidation authority
  - Restart projection rebuilt only from validated immutable events
  - Automatic hardware and security-posture invalidation with fresh re-enable proof requirement
  - Recovery availability independent of preference, authentication, subscription, or connectivity
affects: [06-24, 06-25, advanced-ui, plan-admission, recovery-center]
tech-stack:
  added: []
  patterns:
    - Action-discriminated consumed proof authorization at the durable mutation boundary
    - Rebuildable projection over append-only events in the globally anchored recovery journal
    - Automatic fail-closed posture invalidation before Advanced admission
key-files:
  created:
    - apps/desktop/src-tauri/src/recovery_store/advanced_preference.rs
    - apps/desktop/src-tauri/tests/advanced_preference.rs
  modified:
    - apps/desktop/src-tauri/src/recovery_store/migrations.rs
    - apps/desktop/src-tauri/src/recovery_store/mod.rs
    - apps/desktop/src-tauri/src/plan_auth.rs
    - apps/desktop/src-tauri/tests/recovery_store.rs
key-decisions:
  - 'Store Advanced preference transitions in the existing globally HMAC-anchored recovery journal and derive current authority only by reducing validated immutable events.'
  - 'Use distinct consumed enable and revoke proof actions bound to the exact device, hardware fingerprint, and security-posture fingerprint; store only the opaque evidence reference.'
  - 'Represent hardware or security-posture drift as an automatic invalidation event that preserves history and recovery while requiring a fresh enable proof.'
patterns-established:
  - 'Preference projection caches are disposable: open and rebuild ignore cached state and reduce authenticated append-only history.'
  - 'Proof validation, FULL-durable append, projection update, and external anchor advancement form one fail-closed preference transition boundary.'
requirements-completed: [PLAN-04, PLAN-05, PLAN-06]
duration: 14 min
completed: 2026-08-13
status: complete
---

# Phase 06 Plan 23: Device-Local Advanced Preference Authority Summary

**Advanced preference enablement is now a per-PC, append-audited SQLite authority with separate one-use enable/revoke proofs, automatic posture invalidation, and restart-safe projection rebuild under the existing keyed recovery anchor.**

## Performance

- **Duration:** 14 min
- **Started:** 2026-08-13T15:55:44Z
- **Completed:** 2026-08-13T16:09:58Z
- **Tasks:** 3 TDD gates
- **Files modified:** 6

## Accomplishments

- Added schema v3 with STRICT append-only `advanced_preference_events`, a disposable projection cache, proof uniqueness, monotonic preference sequences, and links into the existing externally anchored recovery journal.
- Required an exact consumed `enable-advanced-preference` or `revoke-advanced-preference` proof before the corresponding transition, including action, device, hardware, posture, freshness, and replay checks.
- Rebuilt current preference state exclusively from generated-contract-valid immutable events and rejected journal/projection metadata tamper instead of fabricating enabled state.
- Appended automatic invalidation when trusted hardware or security posture changes and required a fresh proof against the new binding before re-enabling.
- Preserved unconditional local recovery across disabled, revoked, invalidated, and offline states without adding account sync, renderer, Tauri Store, localStorage, or cloud preference authority.

## TDD Cycle

- **RED:** 11 compiling lifecycle tests produced 9 intended storage/lifecycle failures against a closed compile-only scaffold; baseline recovery and forbidden-surface checks passed.
- **GREEN:** Implemented schema v3, anchored event append, exact consumed-proof authorization, restart reduction, invalidation, fault handling, and production module registration; 11/11 focused tests passed.
- **REFACTOR:** Added the complete state/action table, repeated reopen and corrupt-cache reconstruction, posture oscillation, proof/timestamp tamper, and real concurrent writer serialization; 16/16 focused tests and 184/184 desktop tests passed.

## Task Commits

1. **Task 1 RED: Specify the durable Advanced preference lifecycle** - `6acb735c` (test)
2. **Task 2 GREEN: Persist append-audited enable, revoke, and invalidation** - `97d483d4` (feat)
3. **Task 3 REFACTOR: Exhaust restart, proof, posture, and corruption transitions** - `74adf6b0` (refactor)

## Files Created/Modified

- `apps/desktop/src-tauri/src/recovery_store/advanced_preference.rs` - Device/posture authority, consumed-proof boundary, keyed event append, event validation, reduction, invalidation, and recovery-independent admission.
- `apps/desktop/src-tauri/tests/advanced_preference.rs` - Enable/revoke/replay/restart/posture/tamper/fault/concurrency/recovery lifecycle evidence.
- `apps/desktop/src-tauri/src/recovery_store/migrations.rs` - Additive schema v3 for immutable preference events and rebuildable projection.
- `apps/desktop/src-tauri/src/recovery_store/mod.rs` - Production registration for the new recovery-store authority.
- `apps/desktop/src-tauri/src/plan_auth.rs` - Private exact-binding authorization method on consumed Advanced preference proofs.
- `apps/desktop/src-tauri/tests/recovery_store.rs` - Existing upgrade regression advanced to the additive schema v3 expectation.

## Decisions Made

- Advanced preference data never becomes a parallel store: its authoritative bytes enter the existing recovery database and global HMAC journal.
- The projection table is explicitly non-authoritative and is overwritten from validated event history on every open or rebuild.
- Revocation and invalidation retain all earlier events and never remove recovery; only a new exact enable proof can restore Advanced authority.
- A wrong-device installation is integrity uncertainty, while hardware/posture change on the same device is an append-audited invalidation.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 2 - Missing Critical] Registered the Advanced preference authority in production**
- **Found during:** Task 2 GREEN
- **Issue:** The declared new module could pass only through the integration test's `#[path]` import unless the production recovery-store module registered it.
- **Fix:** Added the narrowly scoped `pub mod advanced_preference;` registration, guarded during isolated integration-module compilation.
- **Files modified:** `apps/desktop/src-tauri/src/recovery_store/mod.rs`
- **Verification:** `cargo check -p liiiraa-desktop` and the 184-test full desktop suite pass.
- **Committed in:** `97d483d4`

**2. [Rule 1 - Bug] Advanced the existing migration-version regression**
- **Found during:** Task 2 GREEN
- **Issue:** The additive Advanced preference schema correctly creates migration v3, while the pre-existing upgrade test still asserted v2.
- **Fix:** Changed only the final `PRAGMA user_version` expectation from 2 to 3.
- **Files modified:** `apps/desktop/src-tauri/tests/recovery_store.rs`
- **Verification:** All 19 recovery-store tests and the full desktop suite pass.
- **Committed in:** `97d483d4`

---

**Total deviations:** 2 auto-fixed (1 missing critical production seam, 1 migration regression bug).
**Impact on plan:** Both changes are required to compile the real authority and preserve migration evidence; no renderer, sync, cloud, dependency, or architectural scope was added.

## Issues Encountered

- The plan's Task 3 command `cargo test -p liiiraa-desktop advanced_preference` exits successfully but filters the integration test binary by test-name substring. The explicit focused command `cargo test -p liiiraa-desktop --test advanced_preference` ran all 16 cases and passed, and the full desktop suite ran 184 tests.

## Verification

- `rtk cargo test -p liiiraa-desktop --test advanced_preference` - **PASS**, 16/16.
- `rtk cargo test -p liiiraa-desktop advanced_preference` - **PASS**, command exited successfully (184 filtered; supplemented by the explicit focused suite).
- `rtk cargo test -p liiiraa-desktop` - **PASS**, 184/184 across 18 suites.
- `rtk cargo check -p liiiraa-desktop` - **PASS**.
- `rtk rustfmt --edition 2024 --check ...` - **PASS** for all six plan files.
- `rtk pnpm test:architecture` - **PASS**, both adapters executed and 51/51 tests passed.
- Source scans - **PASS**, no TODO/FIXME/placeholder, account-sync, localStorage, Tauri Store, cloud write, credential, or reusable receipt surface exists in the preference authority.

## Authentication Gates

None.

## User Setup Required

None - no external service configuration required.

## Known Stubs

None.

## Next Phase Readiness

- Plans 06-24 and 06-25 can query one honest device-local Advanced authority and block new Advanced work after revoke, posture drift, tamper, or storage uncertainty.
- Advanced UI wiring can request separate strong-auth actions without receiving reusable proof or credential material.
- Local recovery remains available regardless of the current preference projection or network/account state.

## Self-Check: PASSED

- Both created files and all four modified files exist.
- RED `6acb735c`, GREEN `97d483d4`, and REFACTOR `74adf6b0` exist in order.
- Focused, full desktop, compile, format, and architecture gates pass.
- No known stubs or undeclared threat surface remain.
- The three user-owned `.gitignore` modifications remain untouched and unstaged.

---
*Phase: 06-transactional-plans-and-recovery*
*Completed: 2026-08-13*
