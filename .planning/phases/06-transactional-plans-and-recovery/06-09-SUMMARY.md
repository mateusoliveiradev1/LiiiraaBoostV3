---
phase: 06-transactional-plans-and-recovery
plan: '09'
subsystem: database
tags: [sqlite, hmac-sha256, windows-credential-manager, recovery, fault-injection]

requires:
  - phase: 06-01
    provides: Generated transactional recovery contracts and Rust validation
  - phase: 06-03
    provides: Immutable plan admission and recovery execution interfaces
provides:
  - FULL-durable append-only SQLite authority for plans, approvals, transactions, checkpoints, journal events, receipts, and promotions
  - Domain-separated HMAC-SHA-256 chain with per-install key epochs and a Windows Credential Manager external head anchor
  - Read-only recovery and deterministic diagnostics when key or anchor custody is unavailable or inconsistent
  - Fault evidence for BUSY, FULL, IOERR, commit/anchor interruption, whole-history rewrite, restart, and projection rebuild
affects: [06-14, 06-18, 06-21, 06-26, recovery-executor, optimizer-service]

tech-stack:
  added: []
  patterns:
    - Global keyed integrity journal with append-only domain projections
    - SQLite commit and protected-anchor CAS before external dispatch
    - Credential-custodied key epochs with explicit read-only failure states

key-files:
  created:
    - apps/desktop/src-tauri/src/recovery_store/mod.rs
    - apps/desktop/src-tauri/src/recovery_store/migrations.rs
    - apps/desktop/src-tauri/src/recovery_store/integrity_anchor.rs
    - apps/desktop/src-tauri/tests/recovery_store.rs
  modified: []

key-decisions:
  - "Authenticate every authoritative recovery document through one global HMAC journal while retaining STRICT purpose-specific tables for query and foreign-key authority."
  - "Recover only an exact single newest non-rotation anchor lag; rotation interruption, multi-event lag, rollback, ahead state, or database identity mismatch remains read-only."
  - "Bind immutable receipts to the latest verified or restored contract event before append."
  - "Implement RFC 4231-compatible HMAC-SHA-256 over the approved sha2 0.10.9 pin because hmac 0.13 and the direct sha2 pin use incompatible digest major versions."

patterns-established:
  - "Durable intent boundary: validate -> verify full keyed chain -> commit prepared event -> CAS protected head -> release storage -> dispatch."
  - "Recovery availability: exact canonical history and redacted diagnostics remain readable even when mutation authority fails closed."
  - "Append-only versioning: repeated plan revisions and apply/restore transactions create new records and never rewrite prior authority."

requirements-completed: [PLAN-06, PLAN-07]

duration: 15min
completed: 2026-08-13
---

# Phase 6 Plan 09: Append-Only Recovery Authority Summary

**FULL-durable SQLite recovery authority with generated-contract admission, keyed HMAC history, Windows-protected external head custody, immutable receipts, and restart-safe fault recovery**

## Performance

- **Duration:** 15 min
- **Started:** 2026-08-13T07:34:30Z
- **Completed:** 2026-08-13T07:49:38Z
- **Tasks:** 3
- **Files modified:** 4

## Accomplishments

- Created nine STRICT SQLite tables with foreign keys, bounded sequences, FULL synchronous WAL policy, ordered migrations, append-only triggers, and a rebuildable executor projection.
- Authenticated the complete authority history with domain-separated HMAC-SHA-256 using random 256-bit epoch keys and an external `{database_id, epoch, sequence, head_mac}` anchor under a Phase 6-specific Windows Credential Manager namespace.
- Preserved exact history and deterministic redacted diagnostics while denying every new mutation on missing key/anchor custody, tamper, rollback, ahead state, multi-event lag, rotation interruption, BUSY, FULL, or IOERR.
- Proved that a prepared event and protected head commit precede the dispatch closure and that post-effect storage failure retains enough immutable evidence for restart recovery.

## TDD Cycle

- **RED:** 14 compiling behavioral tests failed on storage assertions while specifying schema, durability, append-only, dispatch ordering, keyed tamper, custody, anchor, rotation, fault, restart, projection, and migration behavior.
- **GREEN:** Implemented migrated storage, canonical contract admission, keyed append/CAS, Windows custody adapter, read-only failure modes, and deterministic fault injection; all 14 original tests passed.
- **REFACTOR:** Added receipt-head binding, multi-revision identity, redacted diagnostics, RFC 4231 HMAC proof, both migration origins, and all-domain append evidence; 19 focused tests and 162 desktop tests passed.

## Task Commits

Each TDD gate was committed atomically:

1. **Task 1 RED: Specify durable append-only recovery storage** - `25098de9` (test)
2. **Task 2 GREEN: Persist FULL-durable exact intent and evidence** - `40393d3e` (feat)
3. **Task 3 REFACTOR: Prove restart and corruption behavior** - `d605175e` (refactor)

## Files Created/Modified

- `apps/desktop/src-tauri/src/recovery_store/mod.rs` - Contract validation, canonical append/read helpers, keyed chain verification, fault mapping, receipt binding, restart recovery, and diagnostic projection.
- `apps/desktop/src-tauri/src/recovery_store/migrations.rs` - Ordered STRICT schema, constraints, indexes, executor projection, and append-only triggers.
- `apps/desktop/src-tauri/src/recovery_store/integrity_anchor.rs` - Injectable integrity port plus Phase 6-specific Windows Credential Manager key/head adapter.
- `apps/desktop/src-tauri/tests/recovery_store.rs` - Migration, tamper, custody, anchor, rotation, BUSY/FULL/IOERR, dispatch, restart, and projection evidence.

## Decisions Made

- Used a single keyed journal as the tamper authority for every purpose-specific recovery table so a whole-database rewrite cannot regain authority by recomputing unkeyed content hashes.
- Kept unkeyed SHA-256 only as a canonical content identifier; all mutation admission depends on the HMAC chain and protected external head.
- Allowed automatic anchor repair only when the protected head is exactly one newest non-rotation event behind and the complete keyed chain validates.
- Kept keys outside SQLite and retained prior epochs in credential custody solely to verify old history after rotation.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] Added compile-only RED API scaffolding**
- **Found during:** Task 1 RED
- **Issue:** The planned recovery module did not yet exist, so importing it directly would have failed as missing test infrastructure rather than on storage behavior.
- **Fix:** Added signature-only source scaffolding that compiled and returned closed storage failures; the RED run then failed all 14 tests on behavior assertions.
- **Files modified:** recovery store source files and test file
- **Verification:** `rtk cargo test -p liiiraa-desktop --test recovery_store` compiled and reported 14 storage-behavior failures.
- **Committed in:** `25098de9`

**2. [Rule 3 - Blocking] Resolved pinned digest-version incompatibility without dependency drift**
- **Found during:** Task 2 GREEN
- **Issue:** `hmac` 0.13 consumes digest/sha2 0.11 traits while the approved direct `sha2` pin is 0.10.9, so `Hmac<Sha256>` could not compile without changing manifests and the lockfile.
- **Fix:** Implemented the standard RFC HMAC construction over the approved SHA-256 implementation and added an RFC 4231 known-answer test.
- **Files modified:** `apps/desktop/src-tauri/src/recovery_store/mod.rs`
- **Verification:** RFC vector passes; focused and full desktop suites pass without Cargo manifest or lockfile changes.
- **Committed in:** `40393d3e`, strengthened in `d605175e`

**3. [Rule 1 - Bug] Corrected rollback evidence to distinguish permitted single-event lag**
- **Found during:** Task 2 GREEN
- **Issue:** The original rollback assertion replayed the exact one-event-lag state that the plan explicitly permits recovery to advance.
- **Fix:** Advanced one additional committed event before replaying the old head, making the rollback a true multi-event lag while retaining a separate exact single-lag recovery assertion.
- **Files modified:** `apps/desktop/src-tauri/tests/recovery_store.rs`
- **Verification:** Single lag recovers; multi-lag rollback and ahead anchors remain read-only.
- **Committed in:** `40393d3e`

---

**Total deviations:** 3 auto-fixed (1 bug, 2 blocking issues).  
**Impact on plan:** All fixes were required to preserve valid TDD evidence and the approved dependency boundary; no package or architectural scope was added.

## Issues Encountered

- The approved `hmac` and direct `sha2` pins expose incompatible digest trait versions. The implementation retained exact HMAC-SHA-256 behavior without modifying dependency authority, with an independent RFC known-answer test.

## Known Stubs

None.

## Verification

- `rtk cargo test -p liiiraa-desktop --test recovery_store` - 19 passed.
- `rtk cargo test -p liiiraa-desktop recovery_store` - 1 targeted internal HMAC test passed; 161 unrelated tests filtered.
- `rtk cargo test -p liiiraa-desktop` - 162 passed across 16 suites.
- `rtk rustfmt --edition 2024 --check ...` - passed for all four plan files.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness

- Plans 06-14, 06-18, 06-21, and 06-26 can consume a prepared-before-dispatch, restart-verifiable recovery authority.
- Real Windows credential and physical power-loss exercises remain assigned to later packaged/VM promotion plans; deterministic mutation admission is fail-closed now.

## Self-Check: PASSED

- All four declared artifacts exist.
- RED, GREEN, and REFACTOR commits exist in order.
- Focused recovery-store and full desktop verification pass.
- No known stubs, untracked generated files, or undeclared threat surfaces remain.

---
*Phase: 06-transactional-plans-and-recovery*
*Completed: 2026-08-13*
