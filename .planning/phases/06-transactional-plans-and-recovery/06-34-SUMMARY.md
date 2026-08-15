---
phase: 06-transactional-plans-and-recovery
plan: '34'
subsystem: windows-hyperv-physical-evidence
tags: [hyper-v, powershell, cms, artifact-custody, deterministic-simulation, tdd]
requires:
  - phase: 06-31
    provides: immutable CMS-signed physical artifact authority
  - phase: 06-33
    provides: exact physical runner lifecycle and bounded evidence contract
  - phase: 06-38
    provides: deterministic simulation admission and physical-writer boundary
provides:
  - exact-target elevated Audit/RunCleanVm bridge for the active v43 authority
  - append-only v41 to v43 deterministic admission supersession
  - real read-only Hyper-V Audit PASS with exact VM restored to Off
affects: [06-26, 06-35, 06-38, clean-windows-vm, physical-promotion]
tech-stack:
  added: []
  patterns: [closed-action Hyper-V orchestration, authenticated Cargo receipt policy, append-only evidence supersession, cleanup-only VM authority]
key-files:
  created:
    - tooling/phase6-evidence/records/superseded/managed-power-scheme-v41-evidence-manifest.json
    - .planning/phases/06-transactional-plans-and-recovery/06-34-SUMMARY.md
  modified:
    - tooling/hyperv-lab/Invoke-Phase6Physical.ps1
    - tooling/hyperv-lab/Run-LabElevated.ps1
    - tooling/hyperv-lab/phase6-physical.test.mjs
    - tooling/phase6-evidence/evidence-manifest.json
    - tooling/phase6-evidence/src/simulation-writer.ts
    - tooling/phase6-physical/build-artifact.mjs
    - apps/optimizer-service/src/artifact_manifest.rs
key-decisions:
  - "v43 is the single active deterministic authority; v41 remains immutable and superseded, while blocked v42 stays outside the chain."
  - "Portable tauri-driver version authority is its CMS-authenticated Cargo receipt; native installed roles retain native file-version policies."
  - "Audit observation may start only the exact VM and must return it to Off; cleanup is a separate closed action and cannot run Audit or guest code."
patterns-established:
  - "Physical bridge authority is literal and manifest-bound: no caller executable, config, command, script, argument, target, or trust override."
  - "Deterministic admissions advance through a linear append-only predecessor hash chain with exactly one active record."
requirements-completed: [PLAN-01, PLAN-05, PLAN-06, PLAN-07, PLAN-08]
duration: 7h48m
completed: 2026-08-14
---

# Phase 06 Plan 34: Exact Hyper-V Physical Bridge Summary

**A closed CMS/SPKI/live-byte verified bridge now audits the exact v43 artifact and clean Hyper-V target, with v41 preserved as immutable predecessor and the VM returned to its original Off state.**

## Performance

- **Duration:** 7h48m
- **Started:** 2026-08-14T14:12:53Z
- **Completed:** 2026-08-14T22:00:00Z
- **Tasks:** 1 TDD task with Rule 4 repairs
- **Files modified:** 36

## Accomplishments

- Added a dedicated bridge exposing only `Audit` and `RunCleanVm`, bound to VM `LiiiraaBoost-W11-25H2-Clean`, clean checkpoint `Clean-Windows-Ready`, installed checkpoint `LiiiraaBoost-Installed`, signed runner/config roles, v43 artifact identity, and the active deterministic admission.
- Revalidated CMS/SPKI, live artifact bytes, physical artifact verifier output, simulation predecessor chain, fixed guest runner/config, and physical-writer ingestion before any physical mutation authority.
- Preserved v41 bytes as the immutable superseded predecessor, left rejected v42 outside the evidence chain, and admitted v43 as the sole active deterministic simulation authority.
- Completed a real elevated read-only Audit: six integration services were `OK`, artifact/simulation/Hyper-V boundaries passed, and the exact VM returned to `Off` with the same clean checkpoint ID.
- Kept `RunCleanVm`, guest runner, PowerShell Direct, checkpoint restore/create/delete, host power mutation, and guest staging unexecuted.

## Authority and Evidence

- Active operation: `managed-power-scheme-v43`
- Active build: `physical-3eec8d7e3665a7f3-managed-power-scheme-v43`
- Artifact manifest SHA-256: `a94f83e0605b9ab7c501ec2c3d79c15a1a5b79a24f828c980bf2d4987fc163fa`
- Simulation run SHA-256: `dee8f3c8f6dc117a1d14ee60aa3dfd50e943e9cb2e960c9aaa4e8e62422e44bd`
- Evidence manifest SHA-256: `89c029cbe96f3a7822b0c842668e1bb27bbb22576ca5f017cef0598ddc55ca48`
- Real Audit log: `C:\Users\Liiiraa\VM-Lab\Evidence\20260814-185519-phase6audit-console.log`
- Real Audit log SHA-256: `413685b1138c3d94894dd80b3e727c3eb8f64def3e11001af86580a41a09b396`
- Observation log SHA-256: `36fcea1ff9cf480da2501e070214e8bc398bc0d374387a20f8fba5e9cc233d80`
- Cleanup log SHA-256: `f2191bbdc3d01e02a08b6393cde432a8cedb6ac3190ad4bd9a99afccf9c8c25e`
- Audit boundaries: `artifact-verifier-pass`, `simulation-admission-pass`, `hyper-v-audit-pass`
- VM before/after: `Off` -> bounded observation -> `Off`
- Clean checkpoint before/after: `Clean-Windows-Ready`, ID `ebccd5f3-5645-4089-b469-fa4d851fc6ef`

## Task Commits

The task was committed through atomic RED/GREEN/REFACTOR and evidence steps:

1. **Exact bridge RED/GREEN/REFACTOR:** `77d031c0`, `36534be0`, `c650579a`, `14fc7e3a`
2. **Authenticated tauri-driver Cargo receipt:** `7eab2eb4`, `db45babe`
3. **Protected artifact publication ACL:** `442448eb`, `bfbd95ea`, `41e8c18e`
4. **Closed native-version and MSI inspection repairs:** `7c46f8b3`, `a57a9d26`, `e1fafc30`, `742ed5fb`, `26e2c940`, `38356fae`
5. **Latest artifact authority and v43 lifecycle:** `d7c2f686`, `2705c318`, `9bfed581`
6. **Linear deterministic supersession:** `5b3f4e49`, `7f2224e4`, `a0ca4314`
7. **Bridge bound to active v43:** `f2d73273`, `ae6dd905`
8. **Durable elevated Audit verdict:** `c9de2dad`, `98770397`, `9b81cf85`, `331f0875`
9. **Bounded observed Audit:** `4d931fbe`, `27edc1bd`
10. **Safe observation cleanup:** `a417d497`, `ea5bd045`

## Files Created/Modified

- `tooling/hyperv-lab/Invoke-Phase6Physical.ps1` - closed v43 bridge with exact artifact/admission/VM/checkpoint authority.
- `tooling/hyperv-lab/Run-LabElevated.ps1` - durable Audit logger plus fixed observed-Audit and cleanup-only actions.
- `tooling/hyperv-lab/phase6-physical.test.mjs` - target, custody, chain, generic-authority, observation, and cleanup mutation tests.
- `tooling/phase6-evidence/evidence-manifest.json` - schema-v3 linear history with v43 active.
- `tooling/phase6-evidence/records/superseded/managed-power-scheme-v41-evidence-manifest.json` - immutable v41 predecessor snapshot.
- `tooling/phase6-physical/build-artifact.mjs` and `protect-artifact-root.ps1` - Cargo receipt policy and protected create-once ACL custody.
- `apps/optimizer-service/src/artifact_manifest.rs` - exact portable receipt, numeric native version, canonical MSI view, and typed read-only MSI verification.
- Generated TypeSpec/TypeScript/Rust schemas - closed receipt and evidence supersession shapes.

## Decisions Made

- The third-party portable `tauri-driver.exe` is authenticated through the exact Cargo package receipt (`tauri-driver` `2.0.6`) embedded in the CMS-authenticated artifact manifest, not by executing or patching the binary.
- Native version equality permits only numeric segments with insignificant trailing zero equivalence; the Cargo receipt path remains separate.
- Artifact publication applies and verifies protected Administrators/SYSTEM custody in staging before the create-once rename.
- Simulation history uses a schema-v3 linear chain: unique identities, exact predecessor evidence hash, one active record, no fork/reactivation/downgrade.
- Starting the VM for Audit observation is explicit temporary authority. Cleanup is independently closed and returns only the exact VM to `Off` without guest execution.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 4 - Architectural] Portable driver lacked trustworthy native file-version metadata**
- Added a bounded CMS-authenticated Cargo receipt policy limited to portable `tauri-driver` 2.0.6.
- Rejected installed-role use, msedgedriver use, missing/mutated receipts, version mismatch, and live-byte drift.

**2. [Rule 4 - Blocking] Published artifact custody was not verifier-compatible**
- Applied protected owner/DACL custody in staging and verified it before create-once publication; recorded v42 as blocked without mutating history.

**3. [Rule 4 - Blocking] Windows version/MSI APIs exposed representation mismatches**
- Centralized closed trailing-zero numeric equivalence, derived a strictly local canonical-to-DOS view only for MSI API input, and used typed `MSIDBOPEN_READONLY`.

**4. [Rule 4 - Architectural] Evidence writer supported only one admission**
- Introduced append-only linear supersession, preserving v41 and making v43 the sole active record.

**5. [Rule 3 - Blocking] Elevated process verdict was not observable by the parent shell**
- Added a fixed logger that persists exact stdout/stderr and child exit code without generic command authority.

**6. [Rule 3 - Blocking] Hyper-V reports integration health only while the VM runs**
- Added bounded exact-VM observation: start, wait for six `OK` services, Audit, and cleanup in `finally`.

**7. [Rule 1 - Bug] Installed `Stop-VM` does not support `-Shutdown`**
- The first cleanup failed closed after Audit PASS. A TDD repair selected the installed graceful syntax `Stop-VM -Name <exact> -Force`, added cleanup-only authority, and restored the VM to `Off` while preserving the checkpoint.

---

**Total deviations:** 7 auto-fixed (5 blocking/bug, 2 architectural).
**Impact on plan:** Every repair tightened trust, custody, append-only history, or lifecycle cleanup; no generic execution authority or new physical run was introduced.

## Verification

- Hyper-V bridge/mutation suite: 9/9 PASS.
- DryRun exact v43 tuple and schema-v3 mutation corpus: PASS.
- Real artifact verifier 06-35 for v43: PASS.
- Real elevated Audit v43: PASS, read-only, exact three boundaries.
- Planned evidence evaluation: `ok: true`, v43 at `deterministic-simulation`, physical stages pending, no diagnostics.
- Key-links: 2/2 verified.
- Builder, verifier, contracts drift/compat, evidence, desktop, architecture, Cargo, and Windows gates: PASS during the committed TDD sequence.
- Final VM state: `Off`; exact clean checkpoint remains present once.

## Issues Encountered

- v41 failed the portable driver policy and remains immutable historical evidence.
- v42 passed lifecycle build but failed published ACL custody and remains append-only blocked outside the active evidence chain.
- v43 required narrowly scoped verifier/API repairs but its artifact bytes, CMS, manifest, and identity were never changed.
- The initial real Audit while the VM was `Off` failed closed because integration status was unavailable. Explicit observation authority produced a PASS without running guest workloads.

## User Setup Required

None for Audit. Any physical clean-VM run remains a separate operator-authorized action requiring an in-memory `PSCredential`.

## RunCleanVm Authority (Not Executed)

The exact future command is intentionally documented but was **not executed** by this plan:

```powershell
rtk powershell -NoProfile -ExecutionPolicy Bypass -Command "$credential = Get-Credential; & '.\tooling\hyperv-lab\Invoke-Phase6Physical.ps1' -Action RunCleanVm -VmName 'LiiiraaBoost-W11-25H2-Clean' -CheckpointName 'Clean-Windows-Ready' -ArtifactManifestFromSummary '.planning\phases\06-transactional-plans-and-recovery\06-31-SUMMARY.md' -SimulationAdmissionFromSummary '.planning\phases\06-transactional-plans-and-recovery\06-38-SUMMARY.md' -GuestCredential $credential"
```

It still requires new explicit physical-run authority and must not be inferred from the Audit PASS.

## Next Phase Readiness

- The exact v43 bridge is ready for a separately authorized 06-26 clean-VM physical run.
- Physical stages remain pending; no clean-VM, owner-PC, friends-PC, review, or release-ready PASS was fabricated.
- v41/v42 remain immutable historical records and v43 remains the active deterministic authority.

---
*Phase: 06-transactional-plans-and-recovery*
*Completed: 2026-08-14*

## Append-Only v44 Bridge and Read-Only Audit Addendum

The physically BLOCKED `managed-power-scheme-v43` attempt remains immutable history and was
not relaunched. After the owner prepared the local `LiiiraaLab` account and created a distinct
clean checkpoint, the bridge was rebound to the new monotonic v44 artifact and deterministic
admission. The bridge now validates the exact three-link v41 -> v43 -> v44 deterministic chain,
with v43 permanently superseded and v44 the sole active authority.

- **Operation version:** `managed-power-scheme-v44`
- **Build ID:** `physical-68bb4f974e23ee26-managed-power-scheme-v44`
- **Source commit:** `5f29bb71d1eba1425be2c6b549c40f8dbef41cf1`
- **Artifact manifest SHA-256:** `71274d04fbdffc1e2444a7c8771c5f767b8ce1f04c6fa1f6988f23a192b63e6f`
- **Simulation run SHA-256:** `a4a906c3e350a5d1c1d98a936ca350b67c76deb3b96b69646ae285d195852a9e`
- **Evidence manifest SHA-256:** `da004988b19b58dc423894138919de9577d340322ebbaeb02ae3f7db2393e026`
- **Clean checkpoint:** `Clean-Windows-Ready`, ID `ab2bc9c7-e0f7-49a7-84d7-5fb6a486f075`
- **Preserved backup:** `Clean-Windows-Ready-PreLabAccount-v43`, ID `ebccd5f3-5645-4089-b469-fa4d851fc6ef`
- **Installed checkpoint:** `LiiiraaBoost-Installed` absent
- **Audit log:** `C:\Users\Liiiraa\VM-Lab\Evidence\20260814-205903-phase6audit-console.log`
- **Audit log SHA-256:** `0d05dc9125b175de33943ede394dd211a9f7773d16ed41bec1f282c7548862ee`
- **Audit result:** `PASSED`, boundaries `artifact-verifier-pass`, `simulation-admission-pass`, `hyper-v-prestart-audit-pass`, `integration-services-healthy`, `audit-vm-state-restored`, and `hyper-v-audit-pass`
- **Final VM state:** `Off`

The elevated action was only `Audit`. It did not restore or create a checkpoint, stage guest
bytes, invoke PowerShell Direct, run the guest runner, install the MSI, mutate a power scheme,
or call `RunCleanVm`. The exact v44 tuple is ready for a separately authorized 06-26 run.

Commits: RED `a3cebc7d`, checkpoint-identity RED `d3d1adca`, GREEN `605cd707`.

## Append-Only v45 Bridge and Read-Only Audit Addendum

The v44 guest-runner failure remains append-only BLOCKED history and was not relaunched. Before
the monotonic remint, the bridge gained TDD coverage for bounded runner failure diagnostics:
only exit codes 1–65535 and one exact `BLOCKED:[a-z0-9-]{1,64}` code may be persisted; secret,
oversized, multi-line, or arbitrary output becomes `runner-output-redacted` with no raw content.
The v45 bridge validates the exact four-link v41 -> v43 -> v44 -> v45 deterministic chain.

- **Operation version:** `managed-power-scheme-v45`
- **Build ID:** `physical-68bb4f974e23ee26-managed-power-scheme-v45`
- **Source commit:** `7c3525b12ce76619f711ff6f6183ec884c60764f`
- **Artifact manifest SHA-256:** `9c80d1f216eacf0416731fb859a951e766cc4214150d39de8cbf34e1f2a7bc40`
- **Simulation run SHA-256:** `0eb8f328e9a007d3247c3095c5805011268430be1f936d0520e2e60db36c8f1e`
- **Evidence manifest SHA-256:** `4293127293aadc9e7a006c61673953b6cacd37fe4e74809de9d6c7f06e8fbca6`
- **Clean checkpoint:** `Clean-Windows-Ready`, ID `ab2bc9c7-e0f7-49a7-84d7-5fb6a486f075`
- **Preserved backup:** `Clean-Windows-Ready-PreLabAccount-v43`, ID `ebccd5f3-5645-4089-b469-fa4d851fc6ef`
- **Installed checkpoint:** `LiiiraaBoost-Installed` absent
- **Audit log:** `C:\Users\Liiiraa\VM-Lab\Evidence\20260814-215636-phase6audit-console.log`
- **Audit log SHA-256:** `f66211a08104d3165e91aa099cb8def2964385f0ca3972aac0c233b27d4cae1e`
- **Audit result:** `PASSED`, boundaries `artifact-verifier-pass`, `simulation-admission-pass`, `hyper-v-prestart-audit-pass`, `integration-services-healthy`, `audit-vm-state-restored`, and `hyper-v-audit-pass`
- **Final VM state:** `Off`

The elevated action was only `Audit`. It did not invoke the guest runner or `RunCleanVm`, stage
guest bytes, install the MSI, create/restore a checkpoint, or optimize the guest. Runner
diagnostic RED `08ace3cd`, GREEN `7c3525b1`; v45 bridge RED `cad519d4`, GREEN `960ff2ea`.

## Append-Only v46 Bridge and Blocked Read-Only Audit Addendum

The v45 `BLOCKED:run-config-canonical` record remains immutable and was not relaunched. The
runner path comparison was corrected through TDD, and the v46 bridge now validates the exact
five-link v41 -> v43 -> v44 -> v45 -> v46 deterministic chain while preserving the exact clean
checkpoint authority.

- **Operation version:** `managed-power-scheme-v46`
- **Build ID:** `physical-c714ca4c5ad147f4-managed-power-scheme-v46`
- **Source commit:** `1a1dc18ce40beaef2f83cdb3e070386e4d639021`
- **Artifact manifest SHA-256:** `a2be09354be854fe9d010a6108d7199341593876779517bb6976a02c5255e4da`
- **Simulation run SHA-256:** `ab98b0858a82d4436b032b6427560c20d8dfca673b03c53dcf1e74e62b786229`
- **Evidence manifest SHA-256:** `d2091f8cc9d7a827bdc8c857799f391ee4840d3ea15740e6034450fa162546da`
- **Clean checkpoint authority:** `Clean-Windows-Ready`, expected ID `ab2bc9c7-e0f7-49a7-84d7-5fb6a486f075`
- **Bridge suite:** 15/15 PASS
- **Bridge dry-run:** PASS with exact v46 tuple; elevation required for live Audit
- **Planned evidence evaluator:** `ok: true`, deterministic simulation admitted, physical stages pending
- **Architecture gate:** 51/51 PASS; runner/config and verifier/runner/writer key-links present
- **Audit launch result:** `BLOCKED-AUDIT-PROCESS-INVOCATION`, elevated child exit `-196608`
- **Durable Audit log:** none created
- **Final VM state:** not asserted because non-elevated Hyper-V access was denied
- **Physical mutation:** none claimed; `RunCleanVm`, guest runner, MSI, and optimization were not executed

The one allowed UAC launch passed the wrapper as a relative path; the elevated process opened
outside the repository and exited before the wrapper or bridge ran. No new Evidence log was
created. The Audit was not relaunched under the fail-closed rule, and no v47 was minted. Bridge
TDD commits: RED `ac9b23a8`, GREEN `27970f33`.

## Append-Only v46 Absolute-Path Audit Readiness Addendum

After a new explicit authorization, exactly one `Phase6Audit` was launched with the absolute
wrapper path and absolute repository working directory. The bridge revalidated the exact v46
artifact, deterministic admission, VM, and checkpoint authority, observed all six integration
services healthy, and returned the initially Off VM to `Off`.

- **Audit log:** `C:\Users\Liiiraa\VM-Lab\Evidence\20260814-224214-phase6audit-console.log`
- **Audit log SHA-256:** `4ccf5602685d78a466891d1aefaf5492c3bee2370b34f1308828ba85e22026a3`
- **Audit result:** `PASSED`, `readOnly: true`
- **Clean checkpoint ID:** `ab2bc9c7-e0f7-49a7-84d7-5fb6a486f075`
- **Installed checkpoint present:** `false`
- **Completed boundaries:** `artifact-verifier-pass`, `simulation-admission-pass`, `hyper-v-prestart-audit-pass`, `integration-services-healthy`, `audit-vm-state-restored`, `hyper-v-audit-pass`
- **Final VM state:** `Off`

No build, remint, simulation, `RunCleanVm`, guest runner, checkpoint restore/create, MSI, or
optimization action ran. The earlier relative-path invocation blocker remains append-only. The
v46 tuple is ready for the separately authorized single 06-26 physical attempt.

## Append-Only v47 Bridge and Blocked Audit Launch Addendum

The v46 `BLOCKED:artifact-custody` attempt remains immutable and was not relaunched. The staging
ACL and bounded custody diagnostics were corrected through TDD before the single monotonic v47
publication. The exact six-link v41 -> v43 -> v44 -> v45 -> v46 -> v47 bridge passed all 19
policy tests and its non-elevated dry-run against clean checkpoint
`ab2bc9c7-e0f7-49a7-84d7-5fb6a486f075`.

- **Operation version:** `managed-power-scheme-v47`
- **Build ID:** `physical-50796b7236b2889c-managed-power-scheme-v47`
- **Source commit:** `29827368ebfe92abce6135807af82d58c5b1326a`
- **Artifact manifest SHA-256:** `31a039f7a4e3d1a4ca6c431aace3778edb6d018e6a00db6e7f35f77eebf60a7b`
- **Simulation run SHA-256:** `b9d29c44b13dd23b113413c5c64315783b2b176d3dfaa72ec76b096e163608f6`
- **Evidence manifest SHA-256:** `b15aaf5068bc0f248bc426252afa6fb3b53d8ddf5ade3482abf2076f5d9675c8`
- **Bridge TDD:** RED `46f7c79`, GREEN `0064398`; full suite 19/19 PASS
- **Dry-run:** PASS with the exact v47 tuple, fixed VM, checkpoint, artifact, and deterministic chain
- **Audit launch:** `BLOCKED-AUDIT-COMMAND-PARSE`; PowerShell rejected the fixed argument list before `Start-Process`, UAC, wrapper, or bridge execution
- **New Audit log:** none; the newest pre-existing `phase6audit` log predates the v47 build
- **Final VM state:** not asserted because the non-elevated read-only Hyper-V query was denied

The Audit was not relaunched under the fail-closed instruction. No Hyper-V command, checkpoint
restore/create, guest staging, guest runner, MSI, optimization, or `RunCleanVm` action was
started by the rejected command. v47 remains valid through deterministic admission and bridge
dry-run, but it is BLOCKED before Audit readiness and before any separately authorized 06-26
physical attempt.

## Append-Only v47 Host-Memory and Preparation Blocker Addendum

A later explicitly authorized v47 `Phase6Audit` reached the exact bridge but failed when
Hyper-V could not allocate the configured 8192 MiB startup memory. The immutable log is
`C:\Users\Liiiraa\VM-Lab\Evidence\20260815-000927-phase6audit-console.log`, size `1256` bytes,
SHA-256 `cf17d3d425de203551b774a4be315e125b2292c40de1ea5eec3a9164f6773c62`.
`Start-VM` returned `0x8007000E`; no checkpoint, configuration, guest, MSI, apply, or physical
evidence mutation followed.

The approved fixed 4 GiB preparation was implemented with a TDD safety contract (RED
`70c5604`, GREEN `4fc00b0`; 20/20 PASS). Its sole `Start-Process -Verb RunAs` launch was canceled
at UAC before the elevated child started. Therefore no restore, rename, memory update, new
checkpoint, external preparation evidence, checkpoint-ID rebind, or follow-up Audit occurred.
The no-retry rule stopped the workflow without minting v48. The repository-side fixed operation
remains available for a future separately authorized execution, but the bridge still correctly
binds the last established clean checkpoint ID `ab2bc9c7-e0f7-49a7-84d7-5fb6a486f075`.
