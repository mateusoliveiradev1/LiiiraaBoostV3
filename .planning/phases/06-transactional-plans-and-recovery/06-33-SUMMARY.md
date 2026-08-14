---
phase: 06-transactional-plans-and-recovery
plan: '33'
subsystem: desktop-physical-runner
tags: [rust, tauri, windows, webdriver, custody, recovery, consent]

requires:
  - phase: 06-32
    provides: Host-side physical evidence writer and consent contract
  - phase: 06-35
    provides: CMS/SPKI artifact, installation, and friends-roster custody verifiers
  - phase: 06-37
    provides: Physical Tauri-to-named-pipe broker execution authority
  - phase: 06-39
    provides: Generated physical config, continuation, installation, artifact, and roster contracts
provides:
  - Self-contained Windows Rust runner with exact one-config CLI grammar
  - Signed-custody install, WebDriver, checkpoint, reboot, restore, and friends-consent lifecycle
  - Closed guest observation envelope separated from host-derived evidence and promotion authority
affects: [06-31, 06-34, phase6-physical-evidence]

tech-stack:
  added: []
  patterns: [artifact-bound process launch, observation-first reboot resume, host-derived evidence metadata]

key-files:
  created:
    - apps/desktop/src-tauri/src/physical_runner.rs
    - apps/desktop/src-tauri/src/bin/phase6-physical-runner.rs
  modified:
    - apps/desktop/src-tauri/Cargo.toml
    - apps/desktop/src-tauri/tests/physical_runner.rs
    - tooling/phase6-evidence/src/physical-writer.ts
    - tooling/phase6-evidence/tests/physical-writer.test.ts

key-decisions:
  - "Guest runner emits only measurements it directly observed; the 06-32 host writer derives predecessor and custody metadata."
  - "Unmeasured physical drills are explicit coverage gaps recorded as a non-promotable FAIL attempt, never synthesized PASS evidence."
  - "Physical apply and friends export each require an exact local confirmation phrase; neither path auto-approves consent."

patterns-established:
  - "Physical observation boundary: guest data cannot declare predecessor, review, promotion, or unmeasured gate success."
  - "Manifest path plus live path/hash: copied runner bytes outside the authenticated runner role fail closed."

requirements-completed: [PLAN-01, PLAN-02, PLAN-03, PLAN-04, PLAN-05, PLAN-06, PLAN-07, PLAN-08]

duration: 21min
completed: 2026-08-14
---

# Phase 06 Plan 33: Self-Contained Physical Runner Summary

**Artifact-bound Windows runner with real loopback WebDriver, broker-backed apply/restore, reboot-safe custody, explicit local consent, and non-promotable raw observations for every unmeasured gate**

## Performance

- **Duration:** 21 min
- **Started:** 2026-08-14T01:26:30Z
- **Completed:** 2026-08-14T01:46:59Z
- **Tasks:** 1
- **Files modified:** 6

## Accomplishments

- Built `phase6-physical-runner.exe` as a standalone Windows binary accepting only `--run-config <absolute-json-path>`.
- Bound config, MSI, installed manifest, runner, Tauri driver, Edge driver, and friends roster to the 06-35 detached-CMS/compiled-SPKI custody chain before launch.
- Implemented fixed `msiexec`, Windows System Restore checkpointing, loopback WinHTTP WebDriver session creation, named Tauri commands, no-forced-reboot continuation, observation-first restore, and exact prior-scheme verification.
- Required explicit local phrases for plan apply and friends export, with preview/roster hashes bound before raw export.
- Separated guest observations from host evidence authority: unmeasured security, fault, and accessibility drills become explicit non-promotable `FAIL` attempt records rather than fabricated `PASS` claims.

## Release Runner

- **Path:** `target/x86_64-pc-windows-msvc/release/phase6-physical-runner.exe`
- **Version:** `0.0.1`
- **Size:** 6,952,960 bytes
- **SHA-256:** `c016c120c1fb17e2408223827a4dd7a915687974791dd1898e74ff7171cf3a30`
- **Runtime claim:** Build/test artifact only. No Authenticode signature, physical machine run, participant consent, physical evidence, review, or promotion was created by this plan execution.

## Verification Gates

- `cargo test -p liiiraa-desktop --test physical_runner`: 13 passed.
- `cargo test -p liiiraa-desktop --test broker_protocol --test recovery_executor`: 23 passed across 2 suites.
- `pnpm --filter @liiiraa/phase6-evidence test -- --run`: 85 passed across 2 files.
- Windows runner release build (`x86_64-pc-windows-msvc`): passed, 0 errors.
- Windows desktop physical-feature release build (`x86_64-pc-windows-msvc`): passed, 0 errors.
- `verify.key-links`: 5/5 verified.

## Task Commits

1. **RED: failing self-contained physical runner contract** - `9f9287b2` (test)
2. **GREEN: self-contained physical runner and observation boundary** - `2ac94a4` (feat)

## Files Created/Modified

- `apps/desktop/src-tauri/src/physical_runner.rs` - Closed custody, installation, WebDriver, consent, reboot, observation, and restore state machine.
- `apps/desktop/src-tauri/src/bin/phase6-physical-runner.rs` - Exact-config executable entrypoint.
- `apps/desktop/src-tauri/Cargo.toml` - Runner binary and pinned Windows API feature surface.
- `apps/desktop/src-tauri/tests/physical_runner.rs` - Lifecycle, custody, exact-path, resume, approval, roster, and consent tests.
- `tooling/phase6-evidence/src/physical-writer.ts` - Host-side derivation of predecessor/custody metadata and isolated failed-attempt recording for incomplete observations.
- `tooling/phase6-evidence/tests/physical-writer.test.ts` - Proof that guest observations cannot invent passed drills or contaminate promotion state.

## Decisions Made

- After a blocking contract audit, the user selected option 2: keep 06-32 as the sole host evidence authority and restrict the runner to directly measured observations.
- Failed/incomplete physical observations are stored under stage `attempts/` and are not appended to the promotion manifest.
- Read-only `PowerGetActiveScheme` supplies the real prior/restored GUID; all mutations still traverse the installed Tauri command and authenticated named-pipe broker path.

## Deviations from Plan

### User-Approved Architectural Adjustment

**1. Host derives evidence metadata; guest cannot declare physical success**
- **Found during:** Task 1 GREEN audit
- **Issue:** The partial runner emitted hardcoded `PASS` fields and lacked predecessor/artifact/final consent bindings required by the 06-32 writer.
- **Decision:** User selected option 2 at the architectural checkpoint.
- **Fix:** Added a closed observation envelope and host-side metadata derivation. Unmeasured gates create isolated `FAIL` attempt records with explicit coverage gaps.
- **Files modified:** `physical_runner.rs`, `physical-writer.ts`, and their tests.
- **Verification:** 13 runner tests and 85 writer tests pass; observation attempts do not alter stage promotion runs.
- **Committed in:** `2ac94a4`

### Auto-fixed Issues

**2. [Rule 1 - Bug] Replaced invalid WinHTTP types and non-standard fake endpoint**
- **Found during:** First GREEN compile
- **Issue:** Windows API flags did not compile and the partial implementation addressed a non-existent custom WebDriver route.
- **Fix:** Corrected pinned `windows` crate types and implemented `/status`, `/session`, and `/execute/sync` over loopback WinHTTP.
- **Verification:** Focused tests plus both Windows release builds pass.
- **Committed in:** `2ac94a4`

**3. [Rule 2 - Missing Critical] Removed auto-approval and synthetic physical observations**
- **Found during:** Security/custody audit
- **Issue:** Apply approval, device fingerprints, and the prior power state were synthetic.
- **Fix:** Added exact local approval, local device binding, artifact/config-derived posture, and read-only Windows active-scheme observation.
- **Verification:** Approval-refusal and exact-state lifecycle tests pass; broker/recovery suites remain green.
- **Committed in:** `2ac94a4`

**4. [Rule 2 - Missing Critical] Enforced exact runner/config live paths**
- **Found during:** Resume custody audit
- **Issue:** Matching copied bytes at a different runner path could pass hash-only custody.
- **Fix:** Canonical config path and exact manifest runner path are required in addition to hashes.
- **Verification:** Copied-runner path mutation test fails closed before install or WebDriver.
- **Committed in:** `2ac94a4`

---

**Total deviations:** 1 user-approved architectural adjustment and 3 correctness/security auto-fixes.
**Impact on plan:** The executable and host collection path remain within Phase 6 custody boundaries while removing unsupported physical-success claims.

## TDD Gate Compliance

- RED commit `9f9287b2` precedes GREEN commit `2ac94a4`.
- RED originally failed because the runner module did not exist.
- GREEN passed the focused runner, writer, broker, recovery, Windows build, and key-link gates.
- No separate REFACTOR commit was needed; cleanup completed before the GREEN commit.

## Known Stubs

None in production files. The writer intentionally records declared unmeasured physical gates as coverage gaps and `FAIL`; this is fail-closed behavior, not a stub or success claim.

## Issues Encountered

- `ctx7` was unavailable, so current Windows API behavior was checked against official Microsoft documentation before implementing System Restore and active power-scheme observation.
- Release builds report existing dead-code warnings from shared plan-engine/custody modules; there were no build errors.

## User Setup Required

None for this implementation. A later real physical run still requires the signed artifact bundle, reviewed Windows machine, manifest-bound drivers, elevation where Windows requires it, and actual operator/participant confirmations.

## Next Phase Readiness

- Plan 06-31 can package the produced runner binary and Plan 06-34 can invoke its exact config-only command.
- No physical run, signature, consent record, human review, or promotion is claimed. Physical security/fault/accessibility gaps must be genuinely measured before a run can become promotable evidence.

## Self-Check: PASSED

- Created runner module, binary entrypoint, and this summary all exist.
- RED commit `9f9287b2` and GREEN commit `2ac94a4` are present in repository history.
- Runner SHA-256 was recalculated after the final Windows release build.

---
*Phase: 06-transactional-plans-and-recovery*
*Completed: 2026-08-14*
