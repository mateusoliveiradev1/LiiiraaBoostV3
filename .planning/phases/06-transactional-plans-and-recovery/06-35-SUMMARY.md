---
phase: 06-transactional-plans-and-recovery
plan: '35'
subsystem: windows-artifact-custody
tags: [rust, windows, cms, spki, authenticode, acl, artifact-manifest, friends-roster]
requires:
  - phase: 06-39
    provides: generated installation, artifact, physical-config, and friends-roster contracts
  - phase: 02
    provides: reviewed Authenticode development certificate embedded in the staged desktop executable
provides:
  - Fail-closed installed custody for the fixed desktop, service, and runner role set
  - Portable artifact custody for MSI, both installation-manifest bytes, three configs, runner, and two drivers
  - Fixed-path friends-roster verification bound to already verified artifact and config identities
  - Inspection-only host verifier with one absolute artifact-manifest argument
affects: [06-30, 06-31, 06-32, 06-33, 06-34, physical-windows-promotion]
tech-stack:
  added: []
  patterns:
    - Generated schema validation precedes semantic interpretation of every mutable custody document
    - Detached CMS signs canonical JSON while live files are independently re-read and authenticated
    - One compiled DER-SPKI SHA-256 pin anchors installed, portable, and roster trust
key-files:
  created:
    - apps/optimizer-service/src/installation_manifest.rs
    - apps/optimizer-service/src/artifact_manifest.rs
    - apps/optimizer-service/src/bin/phase6-artifact-verifier.rs
    - apps/optimizer-service/tests/installation_manifest.rs
    - apps/optimizer-service/tests/artifact_manifest.rs
  modified:
    - apps/optimizer-service/Cargo.toml
    - apps/optimizer-service/src/main.rs
key-decisions:
  - 'Compile the SHA-256 of the DER SubjectPublicKeyInfo from the reviewed Phase 2 signed desktop executable; mutable documents may repeat it only as evidence, never as trust authority.'
  - 'Resolve installed custody only from Windows known folders and portable roster custody only from generated literal config paths; no environment, renderer, or CLI trust/path override is accepted.'
  - 'Read the monotonic last-admitted installation identity only from a fixed ACL-protected ProgramData record and reject product drift, downgrade, or same-version hash replay.'
  - 'Keep drivers portable-only: installed schema admits desktop/service/runner, while artifact schema requires both tauri-driver and msedgedriver.'
patterns-established:
  - 'Custody order: generated schema -> canonical detached CMS -> compiled SPKI -> live bytes -> executable version/signature -> root policy.'
  - 'Host verifier diagnostics expose bounded stable codes and never echo attacker-controlled arguments or certificate material.'
requirements-completed: [PLAN-05, PLAN-06, PLAN-07]
duration: 19 min
completed: 2026-08-13
---

# Phase 06 Plan 35: Signed Windows Custody Verification Summary

**Installed, portable, and friends-roster custody now fail closed on generated contracts, canonical detached CMS, one compiled SPKI pin, and independently verified live Windows bytes.**

## Performance

- **Duration:** 19 min
- **Started:** 2026-08-13T23:00:30Z
- **Completed:** 2026-08-13T23:19:53Z
- **Tasks:** 1 TDD task
- **Files modified:** 7

## Accomplishments

- Added installed verification rooted at the canonical `%ProgramFiles%\Liiiraa Boost` known-folder path, limited to desktop/service/runner, with detached CMS, live size/SHA-256, Authenticode/SPKI/publisher/certificate, file-version, protected owner/DACL/service-SID, reparse, and monotonic admission checks.
- Added portable verification for the exact nine-role generated artifact manifest, including MSI, installation manifest plus signature, all three physical configs, runner, tauri-driver, and msedgedriver, with canonical root confinement and independent live-byte authentication.
- Added friends-roster verification whose two paths come only from the already validated generated friends config and whose signed body binds the verified artifact hash, config hash, operation, build, source, purpose, participants, and unique machine slots.
- Added a fixed inspection-only `phase6-artifact-verifier` binary accepting exactly `--artifact-manifest <absolute-path>` and returning only bounded JSON verdicts without installing, launching, or ingesting referenced bytes.
- Enabled and compiled the exact Win32 cryptography, WinTrust, known-folder, MSI-version, file-security, and reparse APIs needed by the verifier.

## Compiled Pin Provenance

- `TRUSTED_INSTALLER_SPKI_SHA256` is `sha256:e94302afbf0433f90fe4fd7dcf7433d65fea3b65d721fd37d9ec5848fc098890`.
- The value is the SHA-256 digest of the DER SubjectPublicKeyInfo extracted from the reviewed Authenticode certificate embedded in `quality/evidence/phase-02/staged/liiiraa-desktop.exe` (`CN=Liiiraa Boost Local Development`).
- No private key, raw certificate, thumbprint override, environment variable, document field, CLI flag, or renderer input can replace this compiled authority.

## TDD Execution

### RED

- Added installed and portable fake-custody backends plus mutation corpora for missing/swapped CMS, wrong SPKI, self-asserted trust, role/path substitution, drivers in the wrong custody domain, live hash/size/version/AuthentiCode mismatch, reparse escape, weak ACL, downgrade/replay, roster binding and uniqueness, and CLI widening.
- Added the typed Windows compile witness importing `CryptQueryObject`, `CertGetCertificateContextProperty`, and `WinVerifyTrust`; the RED run failed because the verifier modules and required Win32 features did not exist.
- Commit: `83cccdf` (`test(06-35): add failing signed custody verifier corpus`).

### GREEN

- Implemented generated-first installed, artifact, config, and roster parsing; deterministic canonical JSON; detached CMS signer extraction; DER-SPKI hashing; live file authentication; ACL/reparse policies; monotonic installation admission; and the fixed host CLI.
- The focused mutation suites passed 12/12, the full optimizer-service crate passed 54/54, the Windows all-target build passed, and all three declared plan key links resolved.
- Commit: `4c1c8a5` (`feat(06-35): verify installed portable and roster custody`).

### REFACTOR

- No separate refactor commit was needed. Before the GREEN commit, Windows unsafe operations were narrowed to explicit blocks, installed and portable ACL policies were separated, generated friends-config path fields became the roster path authority, and rustfmt remained clean.

## Task Commits

1. **Task 1 RED: failing signed custody verifier corpus** - `83cccdf` (test)
2. **Task 1 GREEN: installed, portable, and roster custody verification** - `4c1c8a5` (feat)

## Files Created/Modified

- `apps/optimizer-service/src/installation_manifest.rs` - Installed generated-schema/CMS/SPKI/live-byte/version/ACL/monotonic verifier and narrow Windows backend.
- `apps/optimizer-service/src/artifact_manifest.rs` - Exact portable role/config verifier and fixed-path signed friends-roster verifier.
- `apps/optimizer-service/src/bin/phase6-artifact-verifier.rs` - Bounded inspection-only host verifier.
- `apps/optimizer-service/tests/installation_manifest.rs` - Installed signature, byte, role, ACL, reparse, downgrade, and replay mutation corpus.
- `apps/optimizer-service/tests/artifact_manifest.rs` - Portable/config/driver/roster/CLI mutation corpus and typed Win32 compile witness.
- `apps/optimizer-service/Cargo.toml` - Explicit Cryptography, WinTrust, known-folder, and MSI-version Windows bindings.
- `apps/optimizer-service/src/main.rs` - Exposes the two custody modules to the service binary and integration suites.

## Decisions Made

- The compiled pin is based on SPKI rather than a mutable thumbprint or subject string, so installed Authenticode, portable Authenticode, manifest CMS, and roster CMS share one reviewed public-key authority.
- Installed resolution uses `SHGetKnownFolderPath` for Program Files and ProgramData. Portable resolution starts from one caller-supplied absolute artifact-manifest path but derives every child and roster path from generated literal contracts.
- A missing protected last-admitted record is treated as first admission; when present, it must be a non-reparse, ACL-hardened, bounded three-field record before product/version/hash monotonicity is evaluated.
- A development certificate with an untrusted OS root may pass the WinTrust chain result only when its independently extracted SPKI equals the compiled pin; all other WinTrust failures remain blocking.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] Enabled supporting known-folder and MSI-version Win32 bindings**

- **Found during:** Task 1 GREEN
- **Issue:** The two explicitly named Cryptography and WinTrust feature flags do not expose `SHGetKnownFolderPath` or Windows Installer ProductVersion APIs required by the same plan's canonical Program Files and live MSI-version checks.
- **Fix:** Added `Win32_UI_Shell` and `Win32_System_ApplicationInstallationAndServicing` alongside the required Cryptography and WinTrust features.
- **Files modified:** `apps/optimizer-service/Cargo.toml`
- **Verification:** Windows all-target compilation reaches the typed known-folder, MSI, Cryptography, and WinTrust APIs.
- **Committed in:** `4c1c8a5`

---

**Total deviations:** 1 auto-fixed (1 Rule 3 blocker)
**Impact on plan:** The added bindings are the minimum typed Windows APIs needed to implement the planned canonical-path and MSI-version checks; no dependency, generic execution path, or caller-controlled authority was introduced.

## Issues Encountered

- The generated physical contracts use fixed-key role objects, so semantic verification reads their validated JSON representation to apply one shared live-identity routine without duplicating handwritten role DTOs.
- Windows all-target compilation reports existing dead-code warnings caused by integration suites importing the service binary as a module; compilation completes with zero errors, and the new unsafe-operation warnings were eliminated before commit.

## Verification

- `rtk cargo test -p liiiraa-optimizer-service --test installation_manifest --test artifact_manifest` - 12 passed, 0 failed.
- `rtk cargo test -p liiiraa-optimizer-service` - 54 passed across 8 suites, 0 failed.
- `rtk cargo check -p liiiraa-optimizer-service --all-targets --target x86_64-pc-windows-msvc` - passed with zero errors.
- `rtk cargo fmt -p liiiraa-optimizer-service -- --check` - passed.
- `rtk gsd-sdk query verify.key-links .planning/phases/06-transactional-plans-and-recovery/06-35-PLAN.md` - 3/3 links verified.
- CLI source audit found none of `--trust-pin`, `--roster`, `--stage`, `--expected-hash`, or `--executable` in the implementation.

## Known Stubs

None. Stub scanning found no TODO, FIXME, placeholder, coming-soon, or unavailable implementation in the seven source/test files changed by this plan.

## Authentication Gates

None.

## User Setup Required

None - no external service configuration or private signing material is required to compile and test the verifier.

## Next Phase Readiness

- Plan 06-30 can call installed custody before creating the privileged command pipe and persist the returned verified identity into the fixed protected admission record.
- Plans 06-32 and 06-34 can call the fixed artifact verifier before evidence ingestion or Hyper-V staging, then call roster verification only with the verified artifact/config authority.
- No schema, CMS/SPKI, live-byte, driver-role, roster-binding, CLI-widening, Win32 compilation, or key-link blocker remains.

## Self-Check: PASSED

- All seven listed source/test files exist on disk.
- RED `83cccdf` and GREEN `4c1c8a5` exist in git history in the required order.
- Focused mutation tests, full crate tests, Windows all-target compilation, rustfmt, and key-link verification pass.
- Requirements `[PLAN-05, PLAN-06, PLAN-07]` exactly match the plan frontmatter.
- Stub and threat-surface scans found no unfinished implementation or unplanned trust boundary; all new file access is covered by threats T-06-35A/B/C.

---

*Phase: 06-transactional-plans-and-recovery*
*Completed: 2026-08-13*
