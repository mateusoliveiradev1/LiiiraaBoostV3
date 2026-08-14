---
phase: 06-transactional-plans-and-recovery
plan: '31'
subsystem: windows-installer
tags: [msi, wix, authenticode, cms, named-pipe, service-sid, lifecycle]

requires:
  - phase: 06-33
    provides: Self-contained physical runner and continuation authority
  - phase: 06-35
    provides: Compiled-SPKI CMS and Authenticode verification
  - phase: 06-37
    provides: Physical Tauri named-pipe transport and observation-first reconnect
provides:
  - Immutable signed MSI 0.1.41 and detached-CMS artifact root for managed-power-scheme-v41
  - Restricted-service startup without WTS and connection-owned authenticated client effect leases
  - Real install, repair, rollback-failure, downgrade-rejection, and uninstall lifecycle evidence
affects: [06-38, 06-34, 06-27, 06-28]

tech-stack:
  added: []
  patterns:
    - Windows Installer tables only, with exact installed-versus-portable role custody
    - Named-pipe impersonation creates one connection-lifetime token lease after peer authentication
    - Protected installed-manifest proof is composed without broadening administrator authority

key-files:
  created:
    - apps/desktop/src-tauri/tauri.phase6-physical.conf.json
    - apps/desktop/src-tauri/installer/optimizer-service.wxs
    - tooling/phase6-physical/build-artifact.mjs
    - tooling/phase6-physical/build-artifact.test.mjs
    - tooling/phase6-physical/lifecycle-smoke.ps1
  modified:
    - apps/optimizer-service/src/windows_pipe.rs
    - apps/optimizer-service/src/dispatcher.rs
    - apps/optimizer-service/src/operations/power_scheme.rs
    - apps/optimizer-service/src/installation_manifest.rs
    - apps/desktop/src-tauri/src/plan_executor.rs

key-decisions:
  - "Preserve restricted ServiceSid and protected ACLs; derive effect authority only from the authenticated connected named-pipe peer, with no WTS fallback."
  - "Prove protected installed custody by administrator read denial plus artifact CMS/bytes, direct installed-binary identity checks, restricted service startup, and real pipe probes."
  - "Use a distinct 0.0.1 downgrade package in the same UpgradeCode family and require real FindRelatedProducts plus LaunchConditions refusal."

patterns-established:
  - "Physical publication is fail-closed: immutable bytes are published only after the complete elevated lifecycle returns PASSED."
  - "MSI log evidence uses bounded exact parsers, coordinated lock markers, and post-action custody/service assertions."

requirements-completed: [PLAN-01, PLAN-05, PLAN-06, PLAN-07, PLAN-08]

duration: 11h25m
completed: 2026-08-14
---

# Phase 06 Plan 31: Signed Physical MSI and Lifecycle Summary

**A create-once Authenticode/CMS-bound MSI artifact passed a real restricted-service Windows lifecycle, including client-bound broker probes, coherent rollback, genuine downgrade refusal, recovery preservation, and residue-free uninstall.**

## Performance

- **Duration:** 11h25m, including explicit physical checkpoints
- **Started:** 2026-08-14T02:00:45Z
- **Completed:** 2026-08-14T13:24:34Z
- **Tasks:** 2
- **Files modified:** 38 source, test, contract, and planning files across the complete plan history

## Accomplishments

- Built and published MSI `0.1.41` for `managed-power-scheme-v41` from source commit `994994ec4e61b45013930a7f650aaf0b46918d68`, with zero MSI CustomActions and exact desktop/service/runner installed roles.
- Kept `tauri-driver` and `msedgedriver` portable-only while binding every MSI, manifest, config, runner, and driver byte into one detached-CMS-authenticated artifact manifest.
- Proved restricted service startup without WTS, four real authenticated pipe connections, one connection-owned effect lease, response-loss/reconnect durability, and fail-closed mismatch/disconnect/timeout behavior.
- Passed the real install -> service/custody inspection -> repair -> coordinated rollback-failure -> downgrade rejection -> uninstall lifecycle while preserving ProgramData recovery custody.

## Task Commits

Each implementation slice was committed atomically with RED before GREEN.

1. **Task 1: immutable MSI, signed custody, and artifact builder** — `e06eca86` (RED), `064dbb7b` (GREEN).
2. **Task 2: real lifecycle and security hardening** — restricted storage/broker `d1c91f52..377de5c8`; monotonic identity/reconnect `4b615ccb..10e2cd7e`; composite custody `32649d1c`, `0d5f1839`, `25a25854`; rollback/handle/lock proof `f72abcfd..662324ee`; downgrade identity/table proof `26f9c5e9..4d922c6b`; bounded real-log parser `d584b299`, `994994ec`.

## Published Artifact

- **Root:** `target/phase6-physical/994994ec4e61b45013930a7f650aaf0b46918d68/physical-8d162575a964ec77-managed-power-scheme-v41`
- **Build ID:** `physical-8d162575a964ec77-managed-power-scheme-v41`
- **Operation version:** `managed-power-scheme-v41`
- **Input tree:** `sha256:8d162575a964ec77166a00d9e8c6c17157671596e6613fe8634ebe38fa5dd100`
- **ProductCode:** `{72696290-C079-44DB-9FDD-6E7CC11AA2C2}`
- **PackageCode:** `{8D71FFC0-C12F-4930-BFD5-538200118191}`
- **PackageVersion:** `0.1.41`

| Byte | SHA-256 | Size |
| --- | --- | ---: |
| `artifact-manifest.json` | `8789c54ca0a73e2f496fedb7710dae6eac4b1b4bad10864e0284b7591d607784` | 3005 |
| `artifact-manifest.json.p7s` | `e05bb2163da2ea11a0a94cc250229c41f209f56688a22c256984c4e7b3056296` | 1609 |
| `liiiraa-boost.msi` | `9aa510c183a727608c36101103228bb24a407d9b5e01332a1a60aadfc96c97d5` | 15667200 |
| `installation-manifest.json` | `bd0014dfc57ba30efb761beb8cfd3d40b362bd2f4a58f98117f19fb15df8551e` | 1675 |
| `installation-manifest.json.p7s` | `6bbc2953c53ca20908b733d0a5c30173ddca2bf48a5c567645be623171398c7b` | 1609 |
| `configs/clean-windows-vm.run-config.json` | `4496946960bef7c3caa133f9b4ce876c1ade84682ee71a3b5c20caa3be911b87` | 1593 |
| `configs/owner-pc.run-config.json` | `ad68ef9b2c739fe76f5007dff4d5a78521671ac525fe22a843ae0eb55d969f73` | 1529 |
| `configs/friends-pc.run-config.json` | `c94faf3e51c97fc6d4a64f375bb8dcfd28915c613a7274ea005f5ea16f415a5b` | 1658 |
| `phase6-physical-runner.exe` | `d01a1adac531979b27f46dc1b8f0d395c5dfc201e9d5ae4981d2e3c1f6e155ee` | 6969128 |
| `tauri-driver.exe` | `a361947741da6ff184d04a1c589c1bac02b4bc80e2ea3626414441e446af92cf` | 1531176 |
| `msedgedriver.exe` | `be51c3d0c4cda2b3fe67ef528f14e2877e3f2a530a8f0b03ddcedcbf7231dbb2` | 41818920 |

The fixed friends roster paths remain `friends/friends-roster.json` and `friends/friends-roster.json.p7s`; this plan did not create or broaden that separate authority.

## Installed Binary Custody

| Role | SHA-256 | Version | Size |
| --- | --- | --- | ---: |
| desktop | `23edb083cab871fb5e1924cce2e78cd7bc62a8d378d6163e5ab4b07825c95241` | `0.1.41` | 26947368 |
| service | `dd824b6e774642ef6bcb842e399b26abf5e7692819e90d8b36798a245b0aad44` | `0.1.41.0` | 8468776 |
| runner | `d01a1adac531979b27f46dc1b8f0d395c5dfc201e9d5ae4981d2e3c1f6e155ee` | `0.1.41` | 6969128 |

All three carried the pinned `Liiiraa Boost Local Development` Authenticode identity. The installation document used signer SPKI `sha256:1951cb0610550369bdffafffaec6ed48bb7c5e7ddbf9b99733cfbd288e86fdf2`.

## Lifecycle Evidence

- `lifecycle-report.json`: status `PASSED`, completed `2026-08-14T13:24:34.8579684Z`.
- Install, repair/update, coordinated rollback-failure drill, downgrade rejection, and uninstall all passed.
- Rollback and downgrade probes both returned the intentional MSI `1603`; the downgrade probe was version `0.0.1` with ProductCode `{ED0FEFF6-2B7A-4D21-8369-201AE5027FA6}` and PackageCode `{0265C19F-5BA8-450F-A6D4-802D7E421071}`.
- Administrator read of the installed protected manifest was denied; canonical artifact CMS was verified; three installed binary identities were checked; restricted service startup accepted the protected manifest; four real broker connections passed.
- Installed-set hash: `sha256:5dbffa69c997fdc5b136ba07bc03e0a3133dd1f95ca0f48163d6840e22c2c54e`.
- Recovery-custody hash: `sha256:fd0d5baf834216bf312485ea9c6088db4c5031c3361c1d861abe03a3075b7b45` before and after lifecycle.
- Independent cleanup recheck found service error `1060`, no Program Files/start-menu/uninstall-registry residue, and preserved `C:\ProgramData\Liiiraa Boost` custody.

## Verification

- Builder mutation/parser suite: 25/25, including repeated bounded downgrade-parser execution.
- Optimizer service: 83 passed, 1 ignored, both normal and `--test-threads=1`.
- Desktop: 222/222; plan engine: 90/90; architecture: 51/51.
- Windows checks: optimizer service all targets, physical desktop all targets, and no-default desktop all targets all passed.
- `cargo fmt --all -- --check`, `git diff --check`, and 06-30/31/36/37 key-links (12/12) passed.
- Dry run reserved exactly v41 before the single physical `build-and-smoke`; the physical command exited 0 and published only after lifecycle PASS.

## Decisions Made

- Preserved restricted service SID and ACL custody rather than granting broader administrator or SYSTEM helper access.
- Bound interactive effects to the real authenticated pipe connection and verified token SID/session/PID/image identity before mutation.
- Required the downgrade MSI to have independent product/package identity, same UpgradeCode family, coherent `0.0.1` Upgrade rows, and a real LaunchConditions refusal.

## Deviations from Plan

### Auto-fixed Issues

1. **[Rule 1 - Bug] Closed restricted-service startup and real pipe-token gaps.** Removed WTS startup dependency, made ProgramData storage linkable, and tied the effect lease to authenticated pipe custody without changing ACLs.
2. **[Rule 2 - Missing critical proof] Added composite installed-custody evidence.** Combined administrator read denial, canonical/CMS artifact verification, installed binary identities, restricted startup, and real pipe probes.
3. **[Rule 1 - Bug] Made rollback failure testing truthful and bounded.** Disabled Restart Manager only for the drill, used a coordinated child lock holder, decoded the live shared UTF-16 MSI log, and required complete rollback/service restoration.
4. **[Rule 1 - Bug] Made downgrade testing a real related-product attempt.** Gave the probe fresh identities, atomically replaced keyed Upgrade rows, reopened final bytes, and required real detection/refusal evidence with a bounded MSI prefix parser.

**Total deviations:** 4 grouped correctness/security deviations, each implemented through atomic RED/GREEN commits. No authority or trust boundary was broadened.

## Issues Encountered

Physical versions v17-v40 exposed fail-closed platform gaps before publication: restricted startup storage, real broker connection ownership, PowerShell 5.1 enumeration, Restart Manager lock-holder termination, MSI shared-log decoding, keyed Upgrade-table mutation, downgrade package identity, and strict real-log parsing. Every failed attempt retained a BLOCKED report, was cleaned, and required explicit user approval before the next monotonic version. Only v41 was published.

## Known Stubs

None. The changed physical path contains no plan-blocking placeholder or simulated PASS.

## User Setup Required

None. The local development signing identity and WebView2 runtime used by the physical gate were verified during the run.

## Next Phase Readiness

- Plans 06-38 and 06-34 may consume only the exact v41 artifact root and hashes recorded above.
- Plans 06-27/06-28 may use the generated owner/friends configs without modifying builder-owned bytes.
- No blocker remains in 06-31.

## Self-Check: PASSED

- All published artifact, signature, manifest, config, runner, driver, lifecycle, and log files exist under the exact immutable v41 root.
- RED `d584b299`, GREEN `994994ec`, base Task 1 commits, and all recorded hardening commits exist in git history.
- Independent cleanup and recovery-custody checks agree with the durable lifecycle report.

---
*Phase: 06-transactional-plans-and-recovery*
*Completed: 2026-08-14*
