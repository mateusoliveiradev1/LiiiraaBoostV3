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

## Append-only authority update: v43

The immutable v41 publication above remains the historical predecessor. Its later 06-35
revalidation exposed native-version policy incompatibilities, while v42 was recorded BLOCKED
after its publication ACL failed closed. Neither identity was overwritten or relabeled.

The single monotonic v43 lifecycle publication passed native ACL custody and the corrected
06-35 CMS/SPKI/live-byte verifier. This block is the latest complete artifact authority for
deterministic admission; all earlier bytes and audit history remain preserved above.

- **Root:** `target/phase6-physical/41e8c18e0318bdb1fbd317360e1f4e775c838a70/physical-3eec8d7e3665a7f3-managed-power-scheme-v43`
- **Build ID:** `physical-3eec8d7e3665a7f3-managed-power-scheme-v43`
- **Operation version:** `managed-power-scheme-v43`
- **Source commit:** `41e8c18e0318bdb1fbd317360e1f4e775c838a70`

| File | SHA-256 | Bytes |
|---|---|---:|
| `artifact-manifest.json` | `a94f83e0605b9ab7c501ec2c3d79c15a1a5b79a24f828c980bf2d4987fc163fa` | 3241 |

## Append-only authority update: v44

The v43 artifact and deterministic admission remain immutable history. Its clean-VM attempt is
BLOCKED by the recorded PowerShell Direct environment timeout and must never be relaunched. The
prepared `LiiiraaLab` account and replacement `Clean-Windows-Ready` checkpoint authorize only a
new monotonic chain beginning again at deterministic simulation; the backup checkpoint remains
`Clean-Windows-Ready-PreLabAccount-v43`.

The single v44 `build-and-smoke` publication passed signed five-role assembly, protected ACL
custody, install, downgrade rejection, rollback-failure drill, repair/update, broker client
binding, uninstall, and residual cleanup. The real 06-35 verifier then returned `verified` for
the same live bytes. This is the latest complete artifact authority for deterministic admission.

- **Root:** `target/phase6-physical/5f29bb71d1eba1425be2c6b549c40f8dbef41cf1/physical-68bb4f974e23ee26-managed-power-scheme-v44`
- **Build ID:** `physical-68bb4f974e23ee26-managed-power-scheme-v44`
- **Operation version:** `managed-power-scheme-v44`
- **Source commit:** `5f29bb71d1eba1425be2c6b549c40f8dbef41cf1`

| File | SHA-256 | Bytes |
|---|---|---:|
| `artifact-manifest.json` | `71274d04fbdffc1e2444a7c8771c5f767b8ce1f04c6fa1f6988f23a192b63e6f` | 3241 |
| `artifact-manifest.json.p7s` | `d193b89117d10004308bf9456bc97b39ada6d4966d9724e901de6f58cff10020` | 1609 |
| `liiiraa-boost.msi` | `933a04af345224833f25eea8bddbbfcf8141762d44bcf510a1289ef66f4a11bf` | 15675392 |
| `phase6-physical-runner.exe` | `d166cb941f78563be76ed6582e27ff7e4696c85b61864dcf7703d2060b4f62a3` | 6992168 |
| `tauri-driver.exe` | `a361947741da6ff184d04a1c589c1bac02b4bc80e2ea3626414441e446af92cf` | 1531176 |
| `msedgedriver.exe` | `be51c3d0c4cda2b3fe67ef528f14e2877e3f2a530a8f0b03ddcedcbf7231dbb2` | 41818920 |
| `elevated-lifecycle-result.json` | `8edb951ef0c2b6446dad8243c7bb72a5c12381236f5d6b2e63449928d540d601` | 1324 |

## Append-only authority update: v45

The v44 artifact, deterministic admission, Audit PASS, and later guest-runner BLOCKED record
remain immutable history. The v44 operation must never be relaunched. The bounded diagnostic
correction was committed before a single new monotonic publication; no v44 byte or evidence
record was overwritten.

The single v45 `build-and-smoke` publication passed signed five-role assembly, protected ACL
custody, install, downgrade rejection, rollback-failure drill, repair/update, broker client
binding, uninstall, and residual cleanup. The real 06-35 verifier then returned `verified` for
the same live bytes. This is the latest complete artifact authority for deterministic admission.

- **Root:** `target/phase6-physical/7c3525b12ce76619f711ff6f6183ec884c60764f/physical-68bb4f974e23ee26-managed-power-scheme-v45`
- **Build ID:** `physical-68bb4f974e23ee26-managed-power-scheme-v45`
- **Operation version:** `managed-power-scheme-v45`
- **Source commit:** `7c3525b12ce76619f711ff6f6183ec884c60764f`

| File | SHA-256 | Bytes |
|---|---|---:|
| `artifact-manifest.json` | `9c80d1f216eacf0416731fb859a951e766cc4214150d39de8cbf34e1f2a7bc40` | 3241 |
| `artifact-manifest.json.p7s` | `6ce86b40c0c063df31bb037b3c7be59d8977c12dd262b748ddc73a1dee254d16` | 1609 |
| `liiiraa-boost.msi` | `76cdaa7a6a5a95cfedd14035f12129eab3e170a9b8c82bb584eec80804b3de04` | 15675392 |
| `phase6-physical-runner.exe` | `93c0b2d9f80d974bac436e097149de9a540db04dbade2633bf1aff4690a1c6e7` | 6992168 |
| `tauri-driver.exe` | `a361947741da6ff184d04a1c589c1bac02b4bc80e2ea3626414441e446af92cf` | 1531176 |
| `msedgedriver.exe` | `be51c3d0c4cda2b3fe67ef528f14e2877e3f2a530a8f0b03ddcedcbf7231dbb2` | 41818920 |
| `elevated-lifecycle-result.json` | `b377d8a93552b5cc4732a01f5febc6cdc1d4de1d047f4032ba88af5c35c87b59` | 1324 |

## Append-only authority update: v46

The v45 artifact, deterministic admission, read-only Audit PASS, and later
`BLOCKED:run-config-canonical` guest-runner record remain immutable history. The v45 operation
must never be relaunched. The Windows normal-versus-extended canonical-path correction was
committed through RED/GREEN before one new monotonic publication; no v45 artifact, evidence, or
UAT byte was overwritten.

The single v46 `build-and-smoke` publication passed signed five-role assembly, protected ACL
custody, install, downgrade rejection, rollback-failure drill, repair/update, broker client
binding, uninstall, and residual cleanup. The real 06-35 inspection-only verifier then returned
`verified` for the same live bytes. This is the latest complete artifact authority for
deterministic admission.

- **Root:** `target/phase6-physical/1a1dc18ce40beaef2f83cdb3e070386e4d639021/physical-c714ca4c5ad147f4-managed-power-scheme-v46`
- **Build ID:** `physical-c714ca4c5ad147f4-managed-power-scheme-v46`
- **Operation version:** `managed-power-scheme-v46`
- **Source commit:** `1a1dc18ce40beaef2f83cdb3e070386e4d639021`

| File | SHA-256 | Bytes |
|---|---|---:|
| `artifact-manifest.json` | `a2be09354be854fe9d010a6108d7199341593876779517bb6976a02c5255e4da` | 3241 |
| `artifact-manifest.json.p7s` | `7e9c8e03b10c310417ca90bbd089e546d2cd06c0c9c9322ee1d4606e9bee638b` | 1609 |
| `liiiraa-boost.msi` | `f4c24a9608a4931963c0dd457203788e4d8c7fbac48a68149a1cb42fad76b89c` | 15675392 |
| `phase6-physical-runner.exe` | `d42c7499539cc43942d8b14ff4c0b854cd77e1d1929ea3ffea5b27cebfaf511f` | 6993192 |
| `tauri-driver.exe` | `a361947741da6ff184d04a1c589c1bac02b4bc80e2ea3626414441e446af92cf` | 1531176 |
| `msedgedriver.exe` | `be51c3d0c4cda2b3fe67ef528f14e2877e3f2a530a8f0b03ddcedcbf7231dbb2` | 41818920 |
| `elevated-lifecycle-result.json` | `b6015372ba06bee0555e16bc9622f3659359c7bbff019bfe57b694895baac70a` | 1324 |

## Append-only authority update: v47

The v46 artifact, deterministic admission, read-only Audit PASS, and later
`BLOCKED:artifact-custody` guest-runner record remain immutable history. The v46 operation must
never be relaunched. The bounded staging-guest ACL custody and granular safe custody diagnostics
were committed through RED/GREEN before one new monotonic publication; no v46 artifact,
evidence, or UAT byte was overwritten.

The single v47 `build-and-smoke` publication passed signed five-role assembly, protected ACL
custody, install, downgrade rejection, rollback-failure drill, repair/update, broker client
binding, uninstall, and residual cleanup. The real 06-35 inspection-only verifier then returned
`verified` for the same live bytes and manifest hash
`sha256:31a039f7a4e3d1a4ca6c431aace3778edb6d018e6a00db6e7f35f77eebf60a7b`. This is the latest
complete artifact authority for deterministic admission.

- **Root:** `target/phase6-physical/29827368ebfe92abce6135807af82d58c5b1326a/physical-50796b7236b2889c-managed-power-scheme-v47`
- **Build ID:** `physical-50796b7236b2889c-managed-power-scheme-v47`
- **Operation version:** `managed-power-scheme-v47`
- **Source commit:** `29827368ebfe92abce6135807af82d58c5b1326a`
- **Input tree:** `sha256:50796b7236b2889c18e847f3a65b2701af7473506c7a3acbf71ad4414eb7cfa7`

| File | SHA-256 | Bytes |
|---|---|---:|
| `artifact-manifest.json` | `31a039f7a4e3d1a4ca6c431aace3778edb6d018e6a00db6e7f35f77eebf60a7b` | 3241 |
| `artifact-manifest.json.p7s` | `bb7d88a4ea03505b9839f180fd51071e7084b8bba7015368de992dd9ee7959d4` | 1609 |
| `liiiraa-boost.msi` | `a1cccae45f82bf480f585f1476d22399b1e4662a5cf50617e37500d4acecd0db` | 15679488 |
| `phase6-physical-runner.exe` | `669130f220471a90132e2225a4ee523edb55baa7b7465bf60819fb33d5b80545` | 6994728 |
| `tauri-driver.exe` | `a361947741da6ff184d04a1c589c1bac02b4bc80e2ea3626414441e446af92cf` | 1531176 |
| `msedgedriver.exe` | `be51c3d0c4cda2b3fe67ef528f14e2877e3f2a530a8f0b03ddcedcbf7231dbb2` | 41818920 |
| `elevated-lifecycle-result.json` | `8caec763f3e4658755ce5855dcb91a127f5932a5d0f09300a499b8e78b48b3a0` | 1324 |

## Append-only authority update: v48 build blocked

The final consolidated v48 TDD correction was committed at source
`28d7579fc9fb8934fa9a05650844dc4bb7e2a115`, with input tree
`sha256:487e3c326b5066a01dc88a1b91262ce965b89219eddb75097e4c2c9853cd26d7`.
Its single `build-and-smoke` invocation failed closed before MSI assembly because the required
exact official Edge-matched `msedgedriver 151.0.4129.86` was unavailable. The canonical blocker
is `target/phase6-physical/_blocked/BLOCKED-1786772146291-10488.json`, `599` bytes, SHA-256
`13ba55c7e8e4bc6433e58fcbc8b5876731232131eb1d8a66e82c1ed97f7ae45b`, with a tracked mirror at
`.planning/phases/06-transactional-plans-and-recovery/06-26-v48-BLOCKED.json`.

No v48 MSI, lifecycle record, artifact manifest, signature, or artifact root was published.
Therefore the exact v47 tuple above remains the latest complete artifact authority. There is no
v48 retry and no v49.

## Append-only authority update: v49

The terminal v48 build blocker was resolved without changing the host Edge: the exact official
Microsoft download for `msedgedriver 151.0.4129.86` was staged create-once after validating
version output, file version, Microsoft Authenticode, and live SHA-256
`05ed38890b3a0739369beb2dc9136ef8c3d7bfd9c083d215a1bd072b9a59b3e1`. The downloaded official
ZIP was `20657590` bytes with SHA-256
`e3408fc15fae8f8a02a0c6034335a66a556085b144e00d1cad1e42a49491763b`.

The single monotonic v49 `build-and-smoke` publication passed signed five-role assembly,
protected ACL custody, install, downgrade rejection, rollback-failure drill, repair/update,
broker client binding, uninstall, and residual cleanup. The real 06-35 inspection-only verifier
returned `verified` for the same live bytes and manifest hash
`sha256:e3c904651333c0ac22b0706ffed4fc932a0ac18db76a87f02e863693ae78be09`.
This is the latest complete artifact authority for deterministic admission.

- **Root:** `target/phase6-physical/75a0bc0a8f020a292dd1e9c04fbdb6853ef4169a/physical-487e3c326b5066a0-managed-power-scheme-v49`
- **Build ID:** `physical-487e3c326b5066a0-managed-power-scheme-v49`
- **Operation version:** `managed-power-scheme-v49`
- **Source commit:** `75a0bc0a8f020a292dd1e9c04fbdb6853ef4169a`
- **Input tree:** `sha256:487e3c326b5066a01dc88a1b91262ce965b89219eddb75097e4c2c9853cd26d7`

| File | SHA-256 | Bytes |
|---|---|---:|
| `artifact-manifest.json` | `e3c904651333c0ac22b0706ffed4fc932a0ac18db76a87f02e863693ae78be09` | 3241 |
| `artifact-manifest.json.p7s` | `fc96bce90f6fe62a7a352647e4a7505d090600ac08762f7afbead29eae7ede13` | 1609 |
| `liiiraa-boost.msi` | `7403205ac8a7d183529852296af93704eb0450b030c498e3f203c8eb5cb7c2ce` | 15679488 |
| `installation-manifest.json` | `7d8e5ac3c15ede842f1e3bac1a76ba03031c619b6e9e3d2e469cd51d3a1b377a` | 1675 |
| `installation-manifest.json.p7s` | `12eb00da84cef5db50f701e35774a4f2c757f3edbb3cd70aff7a947b8bc3bae9` | 1609 |
| `configs/clean-windows-vm.run-config.json` | `abfd6098a0c269855ea9477a42d3b34d97ae37e5e9a4a7833f379addeaf3465d` | 1593 |
| `configs/owner-pc.run-config.json` | `fcd9300fe9fce6ba71896f49a2c75909cbca97d63885b74afa310eb41628bc29` | 1529 |
| `configs/friends-pc.run-config.json` | `9fcceec5ef79cbae0690366362cf913c6339cd7fc4de46dc871cb499a3888493` | 1658 |
| `phase6-physical-runner.exe` | `2639a4cf4387e4ecc41bd6920dc2426a8ef905179da4f16276d55f0bdde17b51` | 7003944 |
| `tauri-driver.exe` | `a361947741da6ff184d04a1c589c1bac02b4bc80e2ea3626414441e446af92cf` | 1531176 |
| `msedgedriver.exe` | `d5c91ea1e04575ea23fc0aa3a1bef2f2803a94bd9703c4378f82df480530a8ab` | 41818920 |

| `elevated-lifecycle-result.json` | `790ba83b94bbcb5cf71ebfaf35308bb2b73086fc1077f6977374b05419366715` | 1324 |
| `lifecycle-report.json` | `f510e998c67895aa59e6bc69dc67513c9ec2c874c9baad737863b37900c7088c` | 2252 |

## Append-only authority update: v50

The physically BLOCKED v49 attempt was not relaunched. Its exact guest-root custody defect was
corrected through RED `7d842e2` and GREEN `ab5edd8` before the single final v50 publication.
The v50 `build-and-smoke` passed the complete signed lifecycle, and the real 06-35
inspection-only verifier returned `verified` for manifest SHA-256
`c02d0310205662e0d9e3a8fc9b5240bd954d82b4e28924f4a9c30c10c8b5516b`.

- **Root:** `target/phase6-physical/a46b88f8af85b4621dc19922488d064eb2315267/physical-487e3c326b5066a0-managed-power-scheme-v50`
- **Build ID:** `physical-487e3c326b5066a0-managed-power-scheme-v50`
- **Operation version:** `managed-power-scheme-v50`
- **Source commit:** `a46b88f8af85b4621dc19922488d064eb2315267`
- **Input tree:** `sha256:487e3c326b5066a01dc88a1b91262ce965b89219eddb75097e4c2c9853cd26d7`

| File | SHA-256 | Bytes |
|---|---|---:|
| `artifact-manifest.json` | `c02d0310205662e0d9e3a8fc9b5240bd954d82b4e28924f4a9c30c10c8b5516b` | 3241 |
| `artifact-manifest.json.p7s` | `8266773c432415574edfb465815088c5e45c919020e118cf891432cad94ff922` | 1609 |
| `liiiraa-boost.msi` | `64c146d8070dcb15d265993507a377e90fac89098ed89924b724af3a6c3416a9` | 15679488 |
| `installation-manifest.json` | `e1f22fa1e9482e11f5983afeb4f787736dd577db4ce6ac28ee2aca019bb0a398` | 1675 |
| `installation-manifest.json.p7s` | `aecf575dd5263af28da52fe398a98844535a2a0804ce235abfb68562b790d559` | 1609 |
| `configs/clean-windows-vm.run-config.json` | `f733c5dc38e26ac2c21230a107ce344abf94df5d87892a71764f619f19645d7b` | 1593 |
| `configs/owner-pc.run-config.json` | `99fb9d1b044e78a54032aa269adc3843151a0a1ac71ac1f1bce2bd5e2ef7e22c` | 1529 |
| `configs/friends-pc.run-config.json` | `232d2c4604832cd52314951bc0cddcd3cd330990426bb40db3b92e534a05c135` | 1658 |
| `phase6-physical-runner.exe` | `5a82ca6b90fb1962ef5c1875ad83fea21d390d6b97b490958d13101f28f06701` | 7003944 |
| `tauri-driver.exe` | `a361947741da6ff184d04a1c589c1bac02b4bc80e2ea3626414441e446af92cf` | 1531176 |
| `msedgedriver.exe` | `d5c91ea1e04575ea23fc0aa3a1bef2f2803a94bd9703c4378f82df480530a8ab` | 41818920 |

| `elevated-lifecycle-result.json` | `fcb5da7972670deab16f09d162509a5ac61a467949b9e990ee2e7f738ce0c20e` | 1324 |
| `lifecycle-report.json` | `ffb01def0a248365885f6f9fdac70ed50cb39698cb3481193915639188a98d90` | 2252 |

## Append-only authority update: v51 BLOCKED and v52 PASSED

The single v51 invocation was terminated by the host orchestration wrapper during its first
Cargo child because the wrapper carried an incorrect one-second timeout. The builder failed
closed before MSI assembly and recorded
`target/phase6-physical/_blocked/BLOCKED-1786776040410-14848.json`; its record states
`artifactPublished=false`, `msiBuilt=false`, and `lifecycleVerified=false`. v51 was never
relaunched or reused.

After correcting only the orchestration timeout, the single monotonic v52 `build-and-smoke`
completed the signed lifecycle with install, downgrade rejection, rollback-failure drill,
repair/update, broker-client binding, uninstall, and residual cleanup all PASS. The immutable
publication is:

- **Root:** `target/phase6-physical/9cd80dbda40cf154dee7bbbdd874626f2b978969/physical-487e3c326b5066a0-managed-power-scheme-v52`
- **Build ID:** `physical-487e3c326b5066a0-managed-power-scheme-v52`
- **Operation version:** `managed-power-scheme-v52`
- **Source commit:** `9cd80dbda40cf154dee7bbbdd874626f2b978969`
- **Input tree:** `sha256:487e3c326b5066a01dc88a1b91262ce965b89219eddb75097e4c2c9853cd26d7`
- **Artifact manifest:** `sha256:e11d36a6285af09417d397681692e9e65bce959ff87047686d435401c52b66b3` (`3241` bytes)
- **MSI:** `sha256:dda57a509958c48085f309c0fd1c024b9d22a46c421bfbc4ac0ec321a83a83cc` (`15679488` bytes)
- **Clean-VM config:** `sha256:1caa037270bac1f800a22d215008b06b5ad00834da1e4b110b9adab316095163`
- **Runner:** `sha256:d89b703f1d944808ac8195d477ceb189a5d8c7b6098a4d69f51f9c4527582110`

| File | SHA-256 | Bytes |
|---|---|---:|
| `artifact-manifest.json` | `e11d36a6285af09417d397681692e9e65bce959ff87047686d435401c52b66b3` | 3241 |

## Append-only authority update: v53 PASSED

After the v52 clean-VM attempt was retained as immutable BLOCKED evidence, the single monotonic
v53 `build-and-smoke` completed install, downgrade rejection, rollback-failure drill,
repair/update, broker-client binding, uninstall, and residual cleanup with lifecycle `PASSED`.
The immutable publication is:

- **Root:** `target/phase6-physical/29296bbc8c809ec571d3f171edddb1568708f2f6/physical-468a05974898514d-managed-power-scheme-v53`
- **Build ID:** `physical-468a05974898514d-managed-power-scheme-v53`
- **Operation version:** `managed-power-scheme-v53`
- **Source commit:** `29296bbc8c809ec571d3f171edddb1568708f2f6`
- **Input tree:** `sha256:468a05974898514df2d72da21a08e3acb7cf149f0b0f40807fed6a6038dea900`
- **Artifact manifest:** `sha256:6d2e76a71014ea056c4fd0027d46f5fe26c500616885e1153b326d9dbf024271` (`3241` bytes)
- **MSI:** `sha256:6d4218482158e28cab327a121e17752d5e22bd24a98a4484f48f599c492de132` (`15683584` bytes)
- **Clean-VM config:** `sha256:8fe269e5ad445206613df7286f83604f9bcbb87fe9ef67d7aa5e2e32481f7eb8`
- **Runner:** `sha256:7ec7f79339e5c85546dbc465c55723711f19efc02f3ede743b6cb71ef64859d9`

| File | SHA-256 | Bytes |
|---|---|---:|
| `artifact-manifest.json` | `6d2e76a71014ea056c4fd0027d46f5fe26c500616885e1153b326d9dbf024271` | 3241 |

## Append-only authority update: v54 PASSED

The v53 clean-VM failure remains immutable BLOCKED evidence and was not relaunched. Safe guest
diagnostics reduced MSI `1603` to error `1920`, SCM event `7000`, and Win32 service-start code
`1053`. Host PE inspection then proved that the v53 service dynamically imported
`VCRUNTIME140.dll` and `api-ms-win-crt-*`, while the clean VM did not provide that runtime.

RED `b35b674` and GREEN `8900122` make the service-only release build use
`-C target-feature=+crt-static` and add a pre-signing `dumpbin /dependents` gate that rejects
VCRUNTIME, MSVCP, UCRT, and `api-ms-win-crt-*` imports. A non-mint release witness imported only
Windows system DLLs. The single monotonic v54 `build-and-smoke` then completed install,
downgrade rejection, rollback-failure drill, repair/update, broker-client binding, uninstall,
and residual cleanup with lifecycle `PASSED`. The immutable publication is:

- **Root:** `target/phase6-physical/8900122f37ae8c412439de190e3e1f38b232fb2c/physical-0fb27dbbc1f09383-managed-power-scheme-v54`
- **Build ID:** `physical-0fb27dbbc1f09383-managed-power-scheme-v54`
- **Operation version:** `managed-power-scheme-v54`
- **Source commit:** `8900122f37ae8c412439de190e3e1f38b232fb2c`
- **Input tree:** `sha256:0fb27dbbc1f0938303cececdae3641e796e94fc6b7c8517aa6591336a998bb30`

| File | SHA-256 | Bytes |
|---|---|---:|
| `artifact-manifest.json` | `07e2e082d865bc3ccd22f167108f14e9ce9eb1b517ce624a79e64481b0687c40` | 3241 |
| `liiiraa-boost.msi` | `2a338388bb220746df3dcc2ef4690700935fcd77fc598bd1f770380dce3f0a96` | 15761408 |
| `configs/clean-windows-vm.run-config.json` | `684564fc431a3523f95937443925c3c20429f89aab1be6a371309e7e7c6dc730` | 1593 |
| `phase6-physical-runner.exe` | `44d561a01ad17c542fa0aea380ff53b89af45436610db8edc16b23967f1e84d2` | 7016232 |
| `msedgedriver.exe` | `d5c91ea1e04575ea23fc0aa3a1bef2f2803a94bd9703c4378f82df480530a8ab` | 41818920 |

## Append-only authority update: v55 PASSED

The immutable v54 clean-VM failure remained BLOCKED and was not relaunched. RED `6401f1e` and
GREEN `be5319a` separated the service-only database/secret ACL from the minimum interactive
directory-traverse and bounded admission-record read ACLs. Full source, Windows, architecture,
keylink, and bridge gates passed before reservation.

The single monotonic v55 `build-and-smoke` completed install, downgrade rejection,
rollback-failure drill, repair/update, broker-client binding, uninstall, and residual cleanup with
lifecycle `PASSED`. The immutable publication is:

- **Root:** `target/phase6-physical/b3751da5155683a312239e71bafe3ee8969b5446/physical-4c88acfffc6c9dc2-managed-power-scheme-v55`
- **Build ID:** `physical-4c88acfffc6c9dc2-managed-power-scheme-v55`
- **Operation version:** `managed-power-scheme-v55`
- **Source commit:** `b3751da5155683a312239e71bafe3ee8969b5446`
- **Input tree:** `sha256:4c88acfffc6c9dc2546da5318f6365eba4b7b012bce7004bad53ce0c56c6fcd5`

| File | SHA-256 | Bytes |
|---|---|---:|
| `artifact-manifest.json` | `e38830867effd2f71562a7732a12ab1645a6b88cc8c3f4ad36a44abd0197fb7a` | 3241 |
| `liiiraa-boost.msi` | `d8dca19011c04a3330aec5147eb6110c1dfa6600a55557429144ad30a55606d9` | 15761408 |
| `configs/clean-windows-vm.run-config.json` | `3a63c331bea8033dff93ac7c64c06c5dea25d2e979bdadfe57cdbc9a7dac65b6` | 1593 |
| `phase6-physical-runner.exe` | `92e789474b5af6d55819da5fe14f82c0c93c3f12985cc2addb0424e844490db8` | 7016744 |
| `msedgedriver.exe` | `d5c91ea1e04575ea23fc0aa3a1bef2f2803a94bd9703c4378f82df480530a8ab` | 41818920 |

## Append-only authority update: v56 PASSED

The immutable v55 clean-VM attempt remained BLOCKED and was not relaunched. RED `42114dd`, GREEN
`d4802a3`, and refactor `b6270f1` centralized closed Disk/VerbatimDisk and UNC/VerbatimUNC path
equivalence across installed custody and runner consumers while rejecting relative, dot, device,
and root-drift paths. The minimum directory metadata/traverse ACL from `5937be4` remains enforced.

The single monotonic v56 `build-and-smoke` completed the full lifecycle with status `PASSED`:

- **Root:** `target/phase6-physical/b6270f1b935cc3fd55dfd3d55f1847ffdf988db9/physical-c013840c872b6f81-managed-power-scheme-v56`
- **Build ID:** `physical-c013840c872b6f81-managed-power-scheme-v56`
- **Operation version:** `managed-power-scheme-v56`
- **Source commit:** `b6270f1b935cc3fd55dfd3d55f1847ffdf988db9`
- **Input tree:** `sha256:c013840c872b6f81dd169db0840f5fa49b18d6d6e3cb086e0e99d0ffd59e0c8b`

| File | SHA-256 | Bytes |
|---|---|---:|
| `artifact-manifest.json` | `4bffc051607994b34a29f96afd2ac12f173815f84519ab1855090ff89fcb060f` | 3241 |
| `liiiraa-boost.msi` | `313bf0ded1fe704d22e6c5769bacd50a642fcd790d2b09bb2650360cee8981c7` | 15761408 |
| `configs/clean-windows-vm.run-config.json` | `2632e956ff1f0b145312ad696cdaf2bc7502c7dd17a2aee9bfdea3701017892f` | 1593 |
| `phase6-physical-runner.exe` | `081e7328466fb6c724401a5ad1525b357e0ea1847e786b3990ce01cd62215524` | 7018792 |
| `msedgedriver.exe` | `d5c91ea1e04575ea23fc0aa3a1bef2f2803a94bd9703c4378f82df480530a8ab` | 41818920 |

## Append-only authority update: v57 PASSED

The v56 clean-VM attempt remains immutably BLOCKED and was not relaunched. The first v57 build
attempt stopped before reservation or publication because Windows PowerShell 5.1 inherited an
incompatible PowerShell 7 module path. RED `82a47d0` and GREEN `9e3001c` pinned every signing,
ACL, MSI, and lifecycle helper to the inbox executable and inbox module root. No artifact identity
was minted by that blocked preflight.

The single monotonic v57 `build-and-smoke` then completed the full lifecycle with status `PASSED`:

- **Root:** `target/phase6-physical/9e3001ca2f9f50154696c8aca86c4d7f5284b988/physical-9f5464923978c943-managed-power-scheme-v57`
- **Build ID:** `physical-9f5464923978c943-managed-power-scheme-v57`
- **Operation version:** `managed-power-scheme-v57`
- **Source commit:** `9e3001ca2f9f50154696c8aca86c4d7f5284b988`
- **Input tree:** `sha256:9f5464923978c943039c27b5338f768cd940022806d0153c6c0b307770a9d354`

| File | SHA-256 | Bytes |
|---|---|---:|
| `artifact-manifest.json` | `4f291830874f31250147726467a1ce66e500d6657e0f4229124f280f1abd0cb3` | 3241 |
| `liiiraa-boost.msi` | `89bd2db2d23e9cbda40f6a0c1b69a0c81186079b607293ffd8a5d3194ac4a129` | 15765504 |
| `configs/clean-windows-vm.run-config.json` | `7d89b256c877e5da0799eee4547954abe9d5981e31ad93078ee9af0fe1d99509` | 1593 |
| `phase6-physical-runner.exe` | `5b3f59c43957deec430c8c43002c8729ac7fde2c84500cd76bad4f94bee3f7c7` | 7023912 |
| `msedgedriver.exe` | `d5c91ea1e04575ea23fc0aa3a1bef2f2803a94bd9703c4378f82df480530a8ab` | 41818920 |

## Append-only authority update: v58 PASSED

The v57 clean-VM run and its bounded recovery remain immutably BLOCKED and were not relaunched.
RED `14522428` and GREEN `ed529a1c` extended every PowerShell Direct readiness boundary to a
bounded 180 seconds, separated rejected guest credentials from boot-not-ready failures, and made
the exact VM return to `Off` from every clean-VM exit. The single monotonic v58
`build-and-smoke` then completed the signed lifecycle with status `PASSED`, and the fixed 06-35
inspection-only verifier returned `verified` for the same live bytes.

- **Root:** `target/phase6-physical/ed529a1c61d4d1b7d8dc59979db7058815a3814e/physical-9f5464923978c943-managed-power-scheme-v58`
- **Build ID:** `physical-9f5464923978c943-managed-power-scheme-v58`
- **Operation version:** `managed-power-scheme-v58`
- **Source commit:** `ed529a1c61d4d1b7d8dc59979db7058815a3814e`
- **Input tree:** `sha256:9f5464923978c943039c27b5338f768cd940022806d0153c6c0b307770a9d354`

| File | SHA-256 | Bytes |
|---|---|---:|
| `artifact-manifest.json` | `2f407cc28495c09fdc8513c4dfd670749ba7b429d6133713af384f603e8aa888` | 3241 |
| `liiiraa-boost.msi` | `a4e0e4345623cf57c692fece2b09553ccbc2bae5c6a27eb25a063744d36c2130` | 15765504 |
| `configs/clean-windows-vm.run-config.json` | `d381c49499f9afc0c5d479833411e32f12cd879bdc572619cf3530a55c1115fe` | 1593 |
| `phase6-physical-runner.exe` | `2c7bc13c0e71a6b79aba30a674fc82d1313978f1e4d3a8f642a17340f16da33c` | 7023912 |
| `msedgedriver.exe` | `d5c91ea1e04575ea23fc0aa3a1bef2f2803a94bd9703c4378f82df480530a8ab` | 41818920 |

## Append-only authority update: v65 PASSED

The v58 clean-VM blocker and the v59-v64 build blockers remain immutable and were not reused.
The causal TDD sequence closed PowerShell Direct readiness, clean-VM WebDriver diagnostics,
static-CRT dependency custody, isolated runner ordering/path ownership, and finally the exact
Tauri MSI payload binding. RED `bbe30b2` and GREEN `2282109` specifically proved that the signed
static runner must replace the shared target consumed by Tauri and that all three extracted MSI
runtime hashes must equal the signed installation manifest before lifecycle begins.

The single monotonic v65 `build-and-smoke` then completed install, four broker connections,
repair/update, rollback-failure drill, downgrade rejection, uninstall, and residual cleanup with
lifecycle `PASSED`. The fixed inspection-only verifier returned `verified` for the same live bytes.

- **Root:** `target/phase6-physical/22821094de8c0a5fbbaf3b673e69d2b52d7a225a/physical-7304c595be0d094e-managed-power-scheme-v65`
- **Build ID:** `physical-7304c595be0d094e-managed-power-scheme-v65`
- **Operation version:** `managed-power-scheme-v65`
- **Source commit:** `22821094de8c0a5fbbaf3b673e69d2b52d7a225a`
- **Input tree:** `sha256:7304c595be0d094e6684b18db944f52b5778cf23b805d3a133a31d1ea65c29c0`

| File | SHA-256 | Bytes |
|---|---|---:|
| `artifact-manifest.json` | `d1001ae367af98ab67ac022d0170dc1bbed8c351eb998a087ef2f06a016af7f0` | 3240 |
| `liiiraa-boost.msi` | `52c0b99529eb02f4456ad4a20cf3c683c81f9e15fb1ccad42f5a56122a201dcf` | 15826944 |
| `configs/clean-windows-vm.run-config.json` | `618e32025fdf2072e0d48b3f1adb0ddbd3104099d7ce0b0e8d9d2e7e71ae3086` | 1593 |
| `phase6-physical-runner.exe` | `5798f9ed20a16bc7a3189d3d411ad47ad8083d717cd598b27cc3cd29839b49b7` | 7140136 |
| `tauri-driver.exe` | `81966845a635ca45c6c023ce3d8a6a81d068181f384c094cefbd506b00a13b29` | 1627944 |
| `msedgedriver.exe` | `d5c91ea1e04575ea23fc0aa3a1bef2f2803a94bd9703c4378f82df480530a8ab` | 41818920 |

## Append-only authority update: v66 PASSED

The v65 clean-VM recovery blocker `BLOCKED:guest-acl-cardinality` remains immutable. Causal
TDD split portable custody into closed `staged` and `installed-ready` layouts, preserving exact
cardinality and case-sensitive path checks while normalizing the two expected installed-ready
runtime records to the protected ACL contract. RED `922d0203` and GREEN `a34efd18` prove the
recovery path performs protected `Set` then `Assert` before revalidating installed-ready.

The single monotonic v66 `build-and-smoke` completed install, four broker connections,
repair/update, rollback-failure drill, downgrade rejection, uninstall, and residual cleanup with
lifecycle `PASSED`. The fixed inspection-only verifier returned `verified` for the same live bytes.

- **Root:** `target/phase6-physical/a34efd18e38ac38463358ec989af4ed818ab4311/physical-7304c595be0d094e-managed-power-scheme-v66`
- **Build ID:** `physical-7304c595be0d094e-managed-power-scheme-v66`
- **Operation version:** `managed-power-scheme-v66`
- **Source commit:** `a34efd18e38ac38463358ec989af4ed818ab4311`
- **Input tree:** `sha256:7304c595be0d094e6684b18db944f52b5778cf23b805d3a133a31d1ea65c29c0`

| File | SHA-256 | Bytes |
|---|---|---:|
| `artifact-manifest.json` | `f5093c1e464ea8dd563197283a2bdb7cfac4c68f7f30d398f5e3d5dc76137f4f` | 3240 |
| `liiiraa-boost.msi` | `32e8053ec17cf88e96737544acd8d1867362c0d3bca4e971d0674156fd2f6a2b` | 15826944 |
| `configs/clean-windows-vm.run-config.json` | `1a095cada09fbc5742507d1aab7c2056ef16fe9b002c54daf2d357800e5f4975` | 1593 |
| `phase6-physical-runner.exe` | `7a726e4fd1a02c1116a136aa96ff175bc0751ee738aea4da1f50c39d2ac87226` | 7140136 |
| `tauri-driver.exe` | `9168e5c779341479097ea9e748507af0afd413b737c3d68e08622773769a576c` | 1627944 |
| `msedgedriver.exe` | `d5c91ea1e04575ea23fc0aa3a1bef2f2803a94bd9703c4378f82df480530a8ab` | 41818920 |

## Append-only authority update: v67 PASSED

The accepted v66 clean-VM run remained non-terminal for more than twenty minutes inside an
unbounded guest runner invocation. It was classified once as
`BLOCKED:guest-runner-total-deadline`; the exact elevated host was terminated and cleanup-only
returned the VM to `Off` without restoring or deleting any checkpoint. Causal RED `7aba7716`
and GREEN `a5175995` now enforce a 600-second guest process deadline inside a 660-second
PowerShell Direct job deadline, with create-once `started`, `completed`, or `timeout` boundary
records bounded to 4 KiB and explicitly excluding raw output.

The single monotonic v67 `build-and-smoke` completed install, four broker connections,
repair/update, rollback-failure drill, downgrade rejection, uninstall, and residual cleanup with
lifecycle `PASSED`. The fixed inspection-only verifier returned `verified` for the same live bytes.

- **Root:** `target/phase6-physical/a5175995f82bb1720901f48618551d7d10583766/physical-7304c595be0d094e-managed-power-scheme-v67`
- **Build ID:** `physical-7304c595be0d094e-managed-power-scheme-v67`
- **Operation version:** `managed-power-scheme-v67`
- **Source commit:** `a5175995f82bb1720901f48618551d7d10583766`
- **Input tree:** `sha256:7304c595be0d094e6684b18db944f52b5778cf23b805d3a133a31d1ea65c29c0`

| File | SHA-256 | Bytes |
|---|---|---:|
| `artifact-manifest.json` | `e2689db3ef625a3ef4b1d1bd3f7ad22278a0dc868d0eaedebd053fb0fc55984f` | 3240 |
| `liiiraa-boost.msi` | `06683245793dad9d5e7d38b8ad6d40c7b0b6f906369078cae84b86897b1faca2` | 15826944 |
| `configs/clean-windows-vm.run-config.json` | `41be687ba90a13acc60cd3ee50ac7c5d2e06cc461a3116a00b6ed9aef51c927d` | 1593 |
| `phase6-physical-runner.exe` | `23d2475d36a5dd050011d521773924a1cc18fb324d38789729df8390392c4fe5` | 7140136 |
| `tauri-driver.exe` | `7b750fb913684e24a89b5b6ee4d4e5c07deece8b0cd7e3e9834bab091ae501e6` | 1627944 |
| `msedgedriver.exe` | `d5c91ea1e04575ea23fc0aa3a1bef2f2803a94bd9703c4378f82df480530a8ab` | 41818920 |

## Append-only authority update: v68 PASSED

After v67 terminated with the preserved bounded guest-runner timeout, causal TDD RED `b2bdc31e`
and GREEN `b9aad639` added the atomic raw-free inner-stage heartbeat. The next monotonic v68
`build-and-smoke` completed installation, broker binding, repair/update, rollback-failure and
downgrade drills, uninstall, and residual cleanup with lifecycle `PASSED`. The fixed
inspection-only verifier returned `verified` for the same live bytes.

- **Root:** `target/phase6-physical/f5d161f2d4acca90ed836f7a4ccccab6f514adea/physical-9f82fde77bf2940f-managed-power-scheme-v68`
- **Build ID:** `physical-9f82fde77bf2940f-managed-power-scheme-v68`
- **Operation version:** `managed-power-scheme-v68`
- **Source commit:** `f5d161f2d4acca90ed836f7a4ccccab6f514adea`

| File | SHA-256 | Bytes |
|---|---|---:|
| `artifact-manifest.json` | `64f1cecd68757befba141cf3ff5179f6c6f693a9a1f6c29d9a9df9b094c25c9c` | 3240 |
| `liiiraa-boost.msi` | `2731ce66a735393d213745501c33c32aa15b4311a9a3607c847c6a4533771cf4` | 15826944 |
| `configs/clean-windows-vm.run-config.json` | `731f9400bea79c83db0256bf6ab013269cc80963fd489eef96e05bd393390b62` | 1593 |
| `phase6-physical-runner.exe` | `63e4488c80ad0d0456574f23343122bb7dc6fad0572ef7048f156ef01ede42d5` | 7145256 |
| `tauri-driver.exe` | `bf8cc19f67ff0a446265d02ed03c992aaa53f4c63cf897ff16f0eb4253a71f0b` | 1627944 |
| `msedgedriver.exe` | `d5c91ea1e04575ea23fc0aa3a1bef2f2803a94bd9703c4378f82df480530a8ab` | 41818920 |
