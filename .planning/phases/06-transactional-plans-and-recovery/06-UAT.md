# Phase 6 Physical Promotion UAT

## Clean Windows VM — BLOCKED

- **Stage:** `clean-windows-vm`
- **Operation version:** `managed-power-scheme-v1`
- **Immutable build ID:** `phase6-plan20-build`
- **Immutable build commit:** `a334a68f037fa198f9df5fc5228a3ca7fda0d64b`
- **Packaged harness artifact:** `apps/desktop/tests/packaged/transactional-plans.ts`
- **Packaged harness SHA-256:** `751803993672ad7a716946e08f785f425b0bcd220d95cd2d9b2467405838ceba`
- **Required VM:** `LiiiraaBoost-W11-25H2-Clean`
- **Required clean checkpoint:** `Clean-Windows-Ready`
- **Attempt recorded at:** `2026-08-13T18:36:22.1614169Z`
- **Result:** `BLOCKED-ELEVATION-REQUIRED`
- **Human review:** `not-required` — no physical run package exists to review.

### Pre-run checks

| Check | Result | Evidence |
| --- | --- | --- |
| Deterministic admission | PASS | `rtk pnpm phase6:verify -- --mode planned` returned `ok: true`, highest admitted stage `deterministic-simulation`, with no diagnostics. |
| Immutable harness bytes | PASS | Live SHA-256 exactly matched `751803993672ad7a716946e08f785f425b0bcd220d95cd2d9b2467405838ceba`. |
| Persisted lab identity | PASS as historical context only | `C:\Users\Liiiraa\VM-Lab\Evidence\20260812-213313-audit.json`, SHA-256 `adb2de9dbf40f3bf0b4e951f4e0b19248345511ff01ea55541c0d487a18bca6d`, names the exact VM and checkpoint. It is not relabeled as the current physical run. |
| Current elevated session | BLOCKED | Current identity `DESKTOP-F0V8OL0\Liiiraa` is not elevated. Exact-target `Get-VM` and `Get-VMSnapshot` checks were denied by Hyper-V authorization. |
| Fresh exact-target lab audit | BLOCKED | The plan-authorized audit stopped before VM access with `Abra este script em um PowerShell elevado. Nenhuma alteração foi aplicada.` |

### Immutable blocker evidence

- **Audit command:** `Run-LabElevated.ps1 -Action Audit -LabRoot C:\Users\Liiiraa\VM-Lab -VmName LiiiraaBoost-W11-25H2-Clean -CheckpointName Clean-Windows-Ready`
- **Audit console record:** `C:\Users\Liiiraa\VM-Lab\Evidence\20260813-153559-audit-console.log`
- **Audit console SHA-256:** `7ae80d71737f407e30f7673f3bf21d1afb6fecc3529d40ddf34ab6a06dfdd53d`
- **Mutation status:** none; the elevated-session guard failed before any VM, checkpoint, install, broker, power-scheme, or recovery mutation.

### Required matrix status

The install, installed checkpoint, prepare/apply/observe/verify/restart/boot-reconcile/restore/verify cycle, GUID lifecycle, legitimate and adversarial IPC cases, crash/disk-full/drift/conflict cases, System Restore variants, and Narrator/keyboard PT-BR/English at 150%/200% were **not run**. No PASS, GUID, dispatch-count, accessibility, journal, receipt, or physical harness evidence is claimed.

The fail-closed evaluator was run after persistence. Both the plan command and the explicit canonical-stage form `rtk pnpm phase6:verify -- --mode final --require-run-evidence clean-windows-vm` exited nonzero with `ok: false`, `runReadyForReview: false`, and diagnostics including `RUN_EVIDENCE_NOT_PASSED` plus the individual unexecuted cycle, IPC, fault, accessibility, journal, receipt, and later-stage blockers.

### Escalation

This operation version is blocked from clean-VM admission and all later stages. Per the plan, a correction must run from a new operation version beginning again at deterministic simulation, from an elevated session that can validate the exact VM and `Clean-Windows-Ready` checkpoint before any physical mutation.

---

## Corrected operation `managed-power-scheme-v2` — BLOCKED AT SIMULATION ADMISSION

- **Supersedes without rewriting:** the immutable `managed-power-scheme-v1` attempt in commit `99148fdf28d5aec81833665299f944bbb2aef7c1`
- **Restart policy:** re-executed from deterministic simulation as explicitly selected by the owner
- **Attempt recorded at:** `2026-08-13T18:47:29.8358907Z`
- **Result:** `BLOCKED-MISSING-EXACT-PHYSICAL-RUNNER`
- **Physical mutation status:** none
- **Human review:** `not-required` — no physical run package exists to review

### Deterministic restart evidence

| Check | Result | Evidence |
| --- | --- | --- |
| Packaged harness suite | PASS | `rtk pnpm --filter @liiiraa/desktop exec vitest --run tests/packaged/transactional-plans.test.ts` passed 12/12 on 2026-08-13. |
| New operation-version construction | PASS, partial only | The live harness accepted `managed-power-scheme-v2`, emitted `phase6-deterministic-simulation-managed-power-scheme-v2`, rejected replay/same-user spoof/wrong-session/remote client before a second dispatch, and produced redacted evidence hash `sha256:27795a62d128bf7eccfabfc8bb55dd0e1e0a86e8b3df2a331f9f6caeaa78a3b0`. |
| Full version-bound simulation admission | BLOCKED | No canonical runner exists that emits the required `managed-power-scheme-v2` journal, receipt, prepare/apply/restart/restore, revocation, and accessibility artifacts. The checked-in test still hard-codes `managed-power-scheme-v1`; relabeling those bytes as v2 would fabricate exact-version evidence. |

### Elevated clean-VM preflight

The Hyper-V audit was executed through an elevated `Start-Process powershell.exe -Verb RunAs` helper. The non-elevated Codex process did not invoke Hyper-V mutation commands directly.

| Check | Result | Evidence |
| --- | --- | --- |
| Exact VM | PASS | `LiiiraaBoost-W11-25H2-Clean`, Generation 2, Running, 4 vCPU, dynamic 4–12 GiB memory |
| Security baseline | PASS | Secure Boot On and virtual TPM enabled |
| Exact clean checkpoint | PASS | One checkpoint named `Clean-Windows-Ready` |
| Hyper-V services/integration | PASS | `vmms` and `vmcompute` running; Guest Service, Heartbeat, KVP, Shutdown, Time Sync, and VSS report OK |
| Elevated audit record | PASS | `C:\Users\Liiiraa\VM-Lab\Evidence\20260813-154633-audit.json`, SHA-256 `5756e237171f8c71873b632ef6320d1bd69387c251cba0e13502e38d05b2a1f8` |
| Elevated console record | PASS | `C:\Users\Liiiraa\VM-Lab\Evidence\20260813-154630-audit-console.log`, SHA-256 `f3726c4aa4fac844ae5019e9ce0c552d286c13fe6248a580e1310846c78d81df` |

### Blocking implementation evidence

- The immutable build authority still identifies commit `a334a68f037fa198f9df5fc5228a3ca7fda0d64b` and source artifact `apps/desktop/tests/packaged/transactional-plans.ts` with SHA-256 `751803993672ad7a716946e08f785f425b0bcd220d95cd2d9b2467405838ceba`.
- That commit contains no tracked `.exe` or `.msi` package. The local NSIS installer predates the immutable commit and therefore cannot be relabeled as the exact build.
- The harness exposes `executePhysicalMutation` only as a callback gate; it contains no VM installer, guest executor, broker client, evidence writer, or physical operation implementation.
- The exact immutable service entrypoint states: `actual dispatcher is wired by the later physical-operation plan`. It starts and stops the Windows service but does not dispatch the admitted power-scheme operation.
- Implementing and packaging that dispatcher, guest runner, service installation, crash/reboot resumption, fault injection, and evidence collection is a structural privileged-boundary change. It is not safe to improvise inside this evidence-only plan.

### Matrix not executed

No install, installed checkpoint, real prepare/apply/observe/verify/restart/boot-reconcile/restore, GUID lifecycle, physical broker dispatch, physical fault injection, System Restore mutation, or Narrator/keyboard walkthrough was executed. No physical PASS, GUID, dispatch count, journal, receipt, accessibility result, or reviewer verdict is claimed.

### Escalation and exact resume point

Plan 06-26 remains blocked before clean-VM Task 1 mutation. A new implementation plan must first produce and verify an immutable installable build plus a real physical runner wired to the allowlisted optimizer-service dispatcher. After that correction, mint `managed-power-scheme-v3` (or a later never-used version), restart at deterministic simulation, re-audit the clean checkpoint through the elevated helper, and then resume Task 1. Task 2 must not be presented and `06-26-SUMMARY.md` must not be created for this attempt.

### Fail-closed evaluator result

Both the plan-authored command `rtk pnpm phase6:verify -- --mode final --stage clean-vm --require-run-evidence` and the evaluator's canonical stage form `rtk pnpm phase6:verify -- --mode final --require-run-evidence clean-windows-vm` exited nonzero. The result was `ok: false`, `runReadyForReview: false`, `highestAdmittedStage: null`, with all four stages pending. Diagnostics explicitly include `RUN_EVIDENCE_NOT_PASSED`, every incomplete lifecycle step, missing journal/receipt hashes, blocked accessibility/revocation/consent, and `PHYSICAL_RUN_EVIDENCE_MISSING`. This is the required fail-closed outcome; it is not a PASS package.

---

## Operation `managed-power-scheme-v41` — DETERMINISTIC SIMULATION ADMITTED

- **Physical provenance:** not claimed
- **Human review:** not claimed
- **Owner/friends consent:** not claimed
- **Physical PASS:** not claimed
- **Command:** `rtk pnpm phase6:simulate -- --artifact-manifest-from-summary .planning/phases/06-transactional-plans-and-recovery/06-31-SUMMARY.md --minimum-version managed-power-scheme-v3`
- **Artifact manifest SHA-256:** `8789c54ca0a73e2f496fedb7710dae6eac4b1b4bad10864e0284b7591d607784`
- **Run evidence SHA-256:** `626b9793c70f1271d28eff8f3a3e4bba37956c9138b08c345b72e2b22f7f02b7`
- **Evidence manifest SHA-256:** `ead808d8fb26a01183d6522b0698f785daa0d25cbe9d7337bb662c13b53c5f7a`

### Exact command output

```json
{
  "operationVersion": "managed-power-scheme-v41",
  "buildId": "physical-8d162575a964ec77-managed-power-scheme-v41",
  "artifactManifestSha256": "8789c54ca0a73e2f496fedb7710dae6eac4b1b4bad10864e0284b7591d607784",
  "runEvidenceSha256": "626b9793c70f1271d28eff8f3a3e4bba37956c9138b08c345b72e2b22f7f02b7",
  "evidenceManifestSha256": "ead808d8fb26a01183d6522b0698f785daa0d25cbe9d7337bb662c13b53c5f7a",
  "highestAdmittedStage": "deterministic-simulation",
  "requirementsCoverage": [
    "PLAN-01",
    "PLAN-02",
    "PLAN-03",
    "PLAN-04",
    "PLAN-05",
    "PLAN-06",
    "PLAN-07",
    "PLAN-08"
  ]
}
```



---

## Operation `managed-power-scheme-v54` — READ-ONLY AUDIT PASSED, CLEAN VM BLOCKED

- **Audit:** PASSED, read-only; exact clean checkpoint `a918f5c0-ade0-4bac-bca3-baa91686777e`
- **Audit log:** `C:\Users\Liiiraa\VM-Lab\Evidence\20260815-163324-phase6audit-console.log`
- **Audit SHA-256 / size:** `c801207ff3eea54352e475b28abb105b732403c9511ae087a0233f92f1d2e6f4` / `1067` bytes
- **Physical result:** BLOCKED at `installed-ready`
- **Runner:** exit `2`, code `BLOCKED:installed-custody`
- **Immutable blocker:** `C:\Users\Liiiraa\VM-Lab\Evidence\phase6\20260815-163519-clean-vm-BLOCKED.json`
- **Blocker SHA-256 / size:** `efe706f91cba362930f1c546e13916d13b26695d16b6fbae3c6bbf9a80ffef8a` / `1106` bytes
- **Tracked blocker mirror:** `.planning/phases/06-transactional-plans-and-recovery/06-26-v54-BLOCKED.json`
- **Completed boundaries:** artifact verification, deterministic admission, Hyper-V prestart audit, clean restore, integration health, exact staging, and guest ACL provisioning/verification
- **MSI status:** install completed; `installerDiagnostic` is null because the failure occurred in installed-custody verification, not in MSI
- **APPLY prompt / installed checkpoint / reboot / ingestion / review:** not reached
- **Cleanup log:** `C:\Users\Liiiraa\VM-Lab\Evidence\20260815-163557-phase6observationcleanup-console.log`
- **Cleanup SHA-256 / size:** `fed4b585c4bb98369b4821107ec20b04390e035a9e3bef20ec1d3f5aa70dc2f9` / `2755` bytes
- **Final VM state:** `Off`; clean checkpoint unchanged

The service successfully created the bounded admission record after static-CRT startup, but the
single service-only SDDL was also applied to the custody directories and admission record. The
interactive runner therefore could neither traverse those directories nor read the bounded record.
RED `6401f1e` and GREEN `be5319a` separate the ACLs: only traverse (`GX`) for interactive users
on the custody directories, only read (`GR`) on the admission record, and no interactive grant on
the database or secret. The runner now maps all eight typed custody failures to stable allowlisted
codes without exporting detail, raw path, user, SID, or secret data. Gates passed: optimizer
100/1 ignored, builder 30/30, Windows check 0 errors, architecture 51/51, keylinks 11/11, and
bridge 25/25. The immutable v54 attempt was not reused.

---

## Operation `managed-power-scheme-v42` — BLOCKED AT PORTABLE CUSTODY

- **Recorded at:** `2026-08-14T15:52:26.5614342Z`
- **Source commit:** `db45babed3f8887f8d0848df765d19de1c6c9511`
- **Build ID:** `physical-9c4fe0de5a7a01c9-managed-power-scheme-v42`
- **Artifact manifest SHA-256:** `a11f177f84f41ec8e3043422a632072365178510b88699e3d917a2a46153713a`
- **MSI version:** `0.1.42`
- **Lifecycle result:** `PASSED` for install, repair/update, rollback-failure drill, downgrade refusal, uninstall, recovery preservation, and residue cleanup
- **Custody result:** `BLOCKED-ACL-INVALID`
- **Simulation/admission:** not run
- **Hyper-V/physical mutation:** not run

The create-once v42 bytes and CMS evidence remain historical and unchanged. The 06-35 verifier rejected the published root because its owner was the interactive user and its DACL inherited writable entries instead of being protected with the minimal portable-root policy. Lifecycle PASS is not relabeled as artifact custody PASS, deterministic admission, or physical evidence. This version is permanently excluded from simulation and promotion; the approved correction starts from a new monotonic operation version after the publisher proves native ACL custody before final rename.

---

## Operation `managed-power-scheme-v43` — DETERMINISTIC SIMULATION ADMITTED

- **Physical provenance:** not claimed
- **Human review:** not claimed
- **Owner/friends consent:** not claimed
- **Physical PASS:** not claimed
- **Command:** `rtk pnpm phase6:simulate -- --artifact-manifest-from-summary .planning/phases/06-transactional-plans-and-recovery/06-31-SUMMARY.md --minimum-version managed-power-scheme-v43`
- **Artifact manifest SHA-256:** `a94f83e0605b9ab7c501ec2c3d79c15a1a5b79a24f828c980bf2d4987fc163fa`
- **Run evidence SHA-256:** `dee8f3c8f6dc117a1d14ee60aa3dfd50e943e9cb2e960c9aaa4e8e62422e44bd`
- **Evidence manifest SHA-256:** `89c029cbe96f3a7822b0c842668e1bb27bbb22576ca5f017cef0598ddc55ca48`

### Exact command output

```json
{
  "operationVersion": "managed-power-scheme-v43",
  "buildId": "physical-3eec8d7e3665a7f3-managed-power-scheme-v43",
  "artifactManifestSha256": "a94f83e0605b9ab7c501ec2c3d79c15a1a5b79a24f828c980bf2d4987fc163fa",
  "runEvidenceSha256": "dee8f3c8f6dc117a1d14ee60aa3dfd50e943e9cb2e960c9aaa4e8e62422e44bd",
  "evidenceManifestSha256": "89c029cbe96f3a7822b0c842668e1bb27bbb22576ca5f017cef0598ddc55ca48",
  "highestAdmittedStage": "deterministic-simulation",
  "requirementsCoverage": [
    "PLAN-01",
    "PLAN-02",
    "PLAN-03",
    "PLAN-04",
    "PLAN-05",
    "PLAN-06",
    "PLAN-07",
    "PLAN-08"
  ]
}
```


---

## Operation `managed-power-scheme-v43` — CLEAN WINDOWS VM BLOCKED

- **Recorded at:** `2026-08-14T22:12:11.2674205Z`
- **Required VM:** `LiiiraaBoost-W11-25H2-Clean`
- **Required clean checkpoint:** `Clean-Windows-Ready`
- **Build ID:** `physical-3eec8d7e3665a7f3-managed-power-scheme-v43`
- **Artifact manifest SHA-256:** `a94f83e0605b9ab7c501ec2c3d79c15a1a5b79a24f828c980bf2d4987fc163fa`
- **Result:** `BLOCKED-HYPERV-INTEGRATION-SERVICES-UNHEALTHY`
- **Physical mutation status:** none
- **Human review:** not presented; Task 2 remains closed

The exact elevated `RunCleanVm` bridge was invoked once. It re-verified the immutable artifact and the fresh deterministic admission, then failed the live Hyper-V audit because the required integration services were not healthy. The failure occurred before the clean checkpoint restore, VM start, artifact copy, guest runner, installed checkpoint, apply approval, restart, bounded-evidence copy, or `physical-writer` ingestion.

The immutable blocker record is `C:\Users\Liiiraa\VM-Lab\Evidence\phase6\20260814-191211-clean-vm-BLOCKED.json`, SHA-256 `fc7f2fe875daf0f7ad6c5b33fbeaa9c53c2a7b3dcd09690a5836fa216db0c5a0`. Its completed boundaries are exactly `artifact-verifier-pass` and `simulation-admission-pass`, and its reason is `BLOCKED: Hyper-V integration services are not healthy.`

The plan verifier `rtk pnpm phase6:verify -- --mode planned --require-run-evidence clean-windows-vm` exited nonzero as required, with `ok: false`, `runReadyForReview: false`, highest admitted stage `deterministic-simulation`, and diagnostic `PHYSICAL_RUN_EVIDENCE_MISSING`. No physical PASS, reviewer approval, or replacement operation version is claimed. Resume only after the exact VM integration services are healthy; do not reuse this attempt as physical evidence.

### Single retry after the Off-state audit correction — BLOCKED

- **Recorded at:** `2026-08-14T22:27:40.6634655Z`
- **Result:** `BLOCKED-OBSERVATION-FIRST-CONTINUATION-UNAVAILABLE`
- **Immutable blocker record:** `C:\Users\Liiiraa\VM-Lab\Evidence\phase6\20260814-192740-clean-vm-BLOCKED.json`
- **Blocker record SHA-256:** `dcdc9a9dcf01930e403f697c070bb49b83f31db799856304dc3b6fdd5347395c`
- **Final VM state:** not asserted by the blocker record; no follow-up elevated action was run
- **Human review:** not presented; Task 2 remains closed

The authorized one-time retry used the same `managed-power-scheme-v43` artifact and deterministic admission. The corrected pre-start audit accepted the legitimate Off state only after checking the exact VM/checkpoint, SecureBoot, TPM, host services, and exactly six enabled integration services. The bridge then restored `Clean-Windows-Ready` and started the VM sequence, but PowerShell Direct did not become available within the fixed 60-second observation-first timeout.

The completed boundaries are exactly `artifact-verifier-pass`, `simulation-admission-pass`, `hyper-v-prestart-audit-pass`, and `clean-checkpoint-restored`. The failure occurred before integration-health admission, artifact copy, guest runner, installed checkpoint, apply approval, restart, evidence copy, or `physical-writer` ingestion. The persisted reason is `BLOCKED: exact VM did not become available for observation-first continuation.` This retry is append-only evidence and must not be relabeled as a physical PASS.

### Clean checkpoint prepared for a future operation version

- **Recorded at:** `2026-08-14T23:33:21.2808515Z`
- **VM state before/after:** `Off` / `Off`
- **Checkpoint type:** `Standard`
- **Security:** Generation 2, SecureBoot `On`, TPM enabled
- **Immutable backup:** `Clean-Windows-Ready-PreLabAccount-v43`
- **Backup ID:** `ebccd5f3-5645-4089-b469-fa4d851fc6ef`
- **Backup creation time:** `2026-08-13T00:32:47.7334670Z`
- **New clean checkpoint:** `Clean-Windows-Ready`
- **New clean checkpoint ID:** `ab2bc9c7-e0f7-49a7-84d7-5fb6a486f075`
- **New clean checkpoint creation time:** `2026-08-14T23:33:22.8856440Z`
- **`LiiiraaBoost-Installed`:** absent before and after
- **Evidence:** `C:\Users\Liiiraa\VM-Lab\Evidence\phase6\20260814-203321-clean-checkpoint-rotation.json`
- **Evidence SHA-256:** `f4de5d2d73ae9f28a04f14db7cf9b1d4d93a19d61d90ea14795f674c1e223b63`

The prior clean checkpoint was renamed create-once and was not deleted. A distinct clean checkpoint was then created after the owner manually validated the local `LiiiraaLab` account. This is environment preparation only: it is not physical run evidence, does not unblock `managed-power-scheme-v43`, and does not authorize `RunCleanVm`. The next physical attempt requires a new monotonic operation version beginning again at deterministic simulation.

---

## Operation `managed-power-scheme-v44` — DETERMINISTIC SIMULATION ADMITTED

- **Physical provenance:** not claimed
- **Human review:** not claimed
- **Owner/friends consent:** not claimed
- **Physical PASS:** not claimed
- **Command:** `rtk pnpm phase6:simulate -- --artifact-manifest-from-summary .planning/phases/06-transactional-plans-and-recovery/06-31-SUMMARY.md --minimum-version managed-power-scheme-v44`
- **Artifact manifest SHA-256:** `71274d04fbdffc1e2444a7c8771c5f767b8ce1f04c6fa1f6988f23a192b63e6f`
- **Run evidence SHA-256:** `a4a906c3e350a5d1c1d98a936ca350b67c76deb3b96b69646ae285d195852a9e`
- **Evidence manifest SHA-256:** `da004988b19b58dc423894138919de9577d340322ebbaeb02ae3f7db2393e026`

### Exact command output

```json
{
  "operationVersion": "managed-power-scheme-v44",
  "buildId": "physical-68bb4f974e23ee26-managed-power-scheme-v44",
  "artifactManifestSha256": "71274d04fbdffc1e2444a7c8771c5f767b8ce1f04c6fa1f6988f23a192b63e6f",
  "runEvidenceSha256": "a4a906c3e350a5d1c1d98a936ca350b67c76deb3b96b69646ae285d195852a9e",
  "evidenceManifestSha256": "da004988b19b58dc423894138919de9577d340322ebbaeb02ae3f7db2393e026",
  "highestAdmittedStage": "deterministic-simulation",
  "requirementsCoverage": [
    "PLAN-01",
    "PLAN-02",
    "PLAN-03",
    "PLAN-04",
    "PLAN-05",
    "PLAN-06",
    "PLAN-07",
    "PLAN-08"
  ]
}
```

### Read-only Hyper-V Audit for v44 — PASSED

- **Recorded at:** `2026-08-14T23:59:27Z`
- **Action:** `Audit` only
- **VM before/after:** `Off` / `Off`
- **Clean checkpoint:** `Clean-Windows-Ready`, ID `ab2bc9c7-e0f7-49a7-84d7-5fb6a486f075`
- **Preserved backup:** `Clean-Windows-Ready-PreLabAccount-v43`, ID `ebccd5f3-5645-4089-b469-fa4d851fc6ef`
- **`LiiiraaBoost-Installed`:** absent
- **Audit log:** `C:\Users\Liiiraa\VM-Lab\Evidence\20260814-205903-phase6audit-console.log`
- **Audit log SHA-256:** `0d05dc9125b175de33943ede394dd211a9f7773d16ed41bec1f282c7548862ee`
- **Completed boundaries:** `artifact-verifier-pass`, `simulation-admission-pass`, `hyper-v-prestart-audit-pass`, `integration-services-healthy`, `audit-vm-state-restored`, `hyper-v-audit-pass`

This is environment and authority readiness evidence only. It is not clean-VM run evidence,
does not satisfy 06-26 Task 1, and creates no physical PASS or human review. `RunCleanVm`, the
guest runner, MSI installation, checkpoint restore/create, and optimization were not executed.
The v43 BLOCKED records above remain unchanged and cannot be relaunched or reactivated.

### Clean Windows VM RunCleanVm for v44 — BLOCKED

- **Recorded at:** `2026-08-15T00:08:06.9390745Z`
- **Operation version:** `managed-power-scheme-v44`
- **Build ID:** `physical-68bb4f974e23ee26-managed-power-scheme-v44`
- **Artifact manifest SHA-256:** `71274d04fbdffc1e2444a7c8771c5f767b8ce1f04c6fa1f6988f23a192b63e6f`
- **Clean config SHA-256:** `dd41f2154e3a28f2a67b14f86598f7bc425520f315d3e4ef1e9c3f70a564c597`
- **Simulation run SHA-256:** `a4a906c3e350a5d1c1d98a936ca350b67c76deb3b96b69646ae285d195852a9e`
- **Result:** `BLOCKED-GUEST-RUNNER-FAILED-BEFORE-INSTALLED-READY`
- **Human review:** not presented; Task 2 remains closed

The single authorized v44 `RunCleanVm` attempt verified the artifact and deterministic admission, validated the exact prepared checkpoint topology, restored `Clean-Windows-Ready`, reached six healthy integration services, staged only the eleven manifest-bound files, and invoked the exact signed guest runner/config once. The runner exited nonzero before `InstalledReady`; no installed checkpoint, apply approval, reboot continuation, bounded evidence copy, or `physical-writer` ingestion followed.

The immutable blocker record is `C:\Users\Liiiraa\VM-Lab\Evidence\phase6\20260814-210806-clean-vm-BLOCKED.json`, SHA-256 `6b597bec6d4c14d04574720f20918919b0d8d2728172d84c60167c8a13a99c30`. Its completed boundaries are exactly `artifact-verifier-pass`, `simulation-admission-pass`, `hyper-v-prestart-audit-pass`, `clean-checkpoint-restored`, `integration-services-healthy`, and `exact-artifact-staged`. Its persisted reason is `BLOCKED: exact guest runner failed; no later mutation is authorized.`

The authorized cleanup-only action then returned the VM from `Running` to `Off` without restore, checkpoint creation, credential use, or guest execution. Cleanup evidence is `C:\Users\Liiiraa\VM-Lab\Evidence\20260814-210919-phase6observationcleanup-console.log`, SHA-256 `96860830f089b5504e8c6d4861f122712408bc9bca8bb36613c8e65e351bb11a`, and confirms `Clean-Windows-Ready` ID `ab2bc9c7-e0f7-49a7-84d7-5fb6a486f075` remained present. This v44 attempt is permanently BLOCKED and must not be relaunched or relabeled as physical evidence.

---

## Operation `managed-power-scheme-v45` — DETERMINISTIC SIMULATION ADMITTED

- **Physical provenance:** not claimed
- **Human review:** not claimed
- **Owner/friends consent:** not claimed
- **Physical PASS:** not claimed
- **Command:** `rtk pnpm phase6:simulate -- --artifact-manifest-from-summary .planning/phases/06-transactional-plans-and-recovery/06-31-SUMMARY.md --minimum-version managed-power-scheme-v45`
- **Artifact manifest SHA-256:** `9c80d1f216eacf0416731fb859a951e766cc4214150d39de8cbf34e1f2a7bc40`
- **Run evidence SHA-256:** `0eb8f328e9a007d3247c3095c5805011268430be1f936d0520e2e60db36c8f1e`
- **Evidence manifest SHA-256:** `4293127293aadc9e7a006c61673953b6cacd37fe4e74809de9d6c7f06e8fbca6`

### Exact command output

```json
{
  "operationVersion": "managed-power-scheme-v45",
  "buildId": "physical-68bb4f974e23ee26-managed-power-scheme-v45",
  "artifactManifestSha256": "9c80d1f216eacf0416731fb859a951e766cc4214150d39de8cbf34e1f2a7bc40",
  "runEvidenceSha256": "0eb8f328e9a007d3247c3095c5805011268430be1f936d0520e2e60db36c8f1e",
  "evidenceManifestSha256": "4293127293aadc9e7a006c61673953b6cacd37fe4e74809de9d6c7f06e8fbca6",
  "highestAdmittedStage": "deterministic-simulation",
  "requirementsCoverage": [
    "PLAN-01",
    "PLAN-02",
    "PLAN-03",
    "PLAN-04",
    "PLAN-05",
    "PLAN-06",
    "PLAN-07",
    "PLAN-08"
  ]
}
```

---

## Operation `managed-power-scheme-v45` — READ-ONLY AUDIT PASSED

- **Physical provenance:** not claimed
- **Human review:** not claimed
- **Owner/friends consent:** not claimed
- **Physical PASS:** not claimed
- **Build ID:** `physical-68bb4f974e23ee26-managed-power-scheme-v45`
- **Artifact manifest SHA-256:** `9c80d1f216eacf0416731fb859a951e766cc4214150d39de8cbf34e1f2a7bc40`
- **Clean config SHA-256:** `b760a88bdb909df5431e829db0fcedd72bbbe5ddffb8248b94317a180984e79a`
- **Simulation run SHA-256:** `0eb8f328e9a007d3247c3095c5805011268430be1f936d0520e2e60db36c8f1e`
- **Evidence manifest SHA-256:** `4293127293aadc9e7a006c61673953b6cacd37fe4e74809de9d6c7f06e8fbca6`
- **Clean checkpoint:** `Clean-Windows-Ready`, ID `ab2bc9c7-e0f7-49a7-84d7-5fb6a486f075`
- **Preserved backup:** `Clean-Windows-Ready-PreLabAccount-v43`, ID `ebccd5f3-5645-4089-b469-fa4d851fc6ef`
- **Installed checkpoint:** `LiiiraaBoost-Installed` absent
- **Audit log:** `C:\Users\Liiiraa\VM-Lab\Evidence\20260814-215636-phase6audit-console.log`
- **Audit log SHA-256:** `f66211a08104d3165e91aa099cb8def2964385f0ca3972aac0c233b27d4cae1e`
- **Audit result:** `PASSED`
- **Completed boundaries:** `artifact-verifier-pass`, `simulation-admission-pass`, `hyper-v-prestart-audit-pass`, `integration-services-healthy`, `audit-vm-state-restored`, `hyper-v-audit-pass`
- **Final VM state:** `Off`

The elevated action was only `Audit`. It did not restore or create a checkpoint, stage guest
bytes, invoke PowerShell Direct, run the guest runner, install the MSI, mutate a power scheme,
or call `RunCleanVm`. The v43 and v44 BLOCKED records and the entire prior UAT prefix remain
immutable. This v45 tuple is ready for the separately authorized 06-26 clean-VM workflow.

---

## Operation `managed-power-scheme-v45` — CLEAN WINDOWS VM BLOCKED

- **Recorded at:** `2026-08-15T01:10:38.5327060Z`
- **Operation version:** `managed-power-scheme-v45`
- **Build ID:** `physical-68bb4f974e23ee26-managed-power-scheme-v45`
- **Artifact manifest SHA-256:** `9c80d1f216eacf0416731fb859a951e766cc4214150d39de8cbf34e1f2a7bc40`
- **Clean config SHA-256:** `b760a88bdb909df5431e829db0fcedd72bbbe5ddffb8248b94317a180984e79a`
- **Runner SHA-256:** `93c0b2d9f80d974bac436e097149de9a540db04dbade2633bf1aff4690a1c6e7`
- **Simulation run SHA-256:** `0eb8f328e9a007d3247c3095c5805011268430be1f936d0520e2e60db36c8f1e`
- **Result:** `BLOCKED-GUEST-RUN-CONFIG-CANONICAL`
- **Runner exit code:** `2`
- **Allowlisted runner failure code:** `BLOCKED:run-config-canonical`
- **Human review:** not presented; Task 2 remains closed

The single authorized v45 `RunCleanVm` attempt reverified the exact artifact and deterministic
admission, restored checkpoint `Clean-Windows-Ready` ID
`ab2bc9c7-e0f7-49a7-84d7-5fb6a486f075`, reached six healthy integration services, staged
exactly the eleven manifest-bound files, and invoked the signed runner/config once. The runner
failed closed at the `installed-ready` boundary before emitting `InstalledReady`. The bridge
persisted only bounded diagnostics: `runnerExitCode: 2`, the allowlisted code
`BLOCKED:run-config-canonical`, and reason `runner-failure`; no raw runner output was retained.

Completed boundaries are exactly `artifact-verifier-pass`, `simulation-admission-pass`,
`hyper-v-prestart-audit-pass`, `clean-checkpoint-restored`, `integration-services-healthy`, and
`exact-artifact-staged`. No installed checkpoint, apply confirmation, VM reboot, continuation,
bounded run-envelope copy, physical-writer ingestion, physical PASS, or reviewer record followed.
The evidence manifest therefore remains the exact deterministic-only v45 authority at SHA-256
`4293127293aadc9e7a006c61673953b6cacd37fe4e74809de9d6c7f06e8fbca6`.

The immutable blocker record is
`C:\Users\Liiiraa\VM-Lab\Evidence\phase6\20260814-221038-clean-vm-BLOCKED.json`, SHA-256
`50285e3d8d39cc2c3e3d2de02da8175ce19dbd1f0ac18978367cd8d0aae121a6`.

The cleanup-only action then returned the VM from `Running` to `Off` without checkpoint restore,
checkpoint creation, credential reuse, or guest execution. Cleanup evidence is
`C:\Users\Liiiraa\VM-Lab\Evidence\20260814-221237-phase6observationcleanup-console.log`, SHA-256
`96860830f089b5504e8c6d4861f122712408bc9bca8bb36613c8e65e351bb11a`, and confirms the exact
clean checkpoint ID remained present. This v45 attempt is permanently BLOCKED and must not be
relaunched, relabeled as physical evidence, or advanced to Task 2/Task 3. No v46 was minted.

---

## Operation `managed-power-scheme-v46` — DETERMINISTIC SIMULATION ADMITTED

- **Physical provenance:** not claimed
- **Human review:** not claimed
- **Owner/friends consent:** not claimed
- **Physical PASS:** not claimed
- **Command:** `rtk pnpm phase6:simulate -- --artifact-manifest-from-summary .planning/phases/06-transactional-plans-and-recovery/06-31-SUMMARY.md --minimum-version managed-power-scheme-v46`
- **Artifact manifest SHA-256:** `a2be09354be854fe9d010a6108d7199341593876779517bb6976a02c5255e4da`
- **Run evidence SHA-256:** `ab98b0858a82d4436b032b6427560c20d8dfca673b03c53dcf1e74e62b786229`
- **Evidence manifest SHA-256:** `d2091f8cc9d7a827bdc8c857799f391ee4840d3ea15740e6034450fa162546da`

### Exact command output

```json
{
  "operationVersion": "managed-power-scheme-v46",
  "buildId": "physical-c714ca4c5ad147f4-managed-power-scheme-v46",
  "artifactManifestSha256": "a2be09354be854fe9d010a6108d7199341593876779517bb6976a02c5255e4da",
  "runEvidenceSha256": "ab98b0858a82d4436b032b6427560c20d8dfca673b03c53dcf1e74e62b786229",
  "evidenceManifestSha256": "d2091f8cc9d7a827bdc8c857799f391ee4840d3ea15740e6034450fa162546da",
  "highestAdmittedStage": "deterministic-simulation",
  "requirementsCoverage": [
    "PLAN-01",
    "PLAN-02",
    "PLAN-03",
    "PLAN-04",
    "PLAN-05",
    "PLAN-06",
    "PLAN-07",
    "PLAN-08"
  ]
}
```

---

## Operation `managed-power-scheme-v46` — READ-ONLY AUDIT INVOCATION BLOCKED

- **Recorded at:** `2026-08-15T01:39:46Z`
- **Operation version:** `managed-power-scheme-v46`
- **Build ID:** `physical-c714ca4c5ad147f4-managed-power-scheme-v46`
- **Artifact manifest SHA-256:** `a2be09354be854fe9d010a6108d7199341593876779517bb6976a02c5255e4da`
- **Simulation run SHA-256:** `ab98b0858a82d4436b032b6427560c20d8dfca673b03c53dcf1e74e62b786229`
- **Evidence manifest SHA-256:** `d2091f8cc9d7a827bdc8c857799f391ee4840d3ea15740e6034450fa162546da`
- **Clean checkpoint authority:** `Clean-Windows-Ready`, expected ID `ab2bc9c7-e0f7-49a7-84d7-5fb6a486f075`
- **Requested action:** elevated `Phase6Audit`, which delegates only to bridge action `Audit`
- **Result:** `BLOCKED-AUDIT-PROCESS-INVOCATION`
- **Elevated child exit code:** `-196608`
- **Durable Audit log:** none created
- **Final VM state:** not asserted; the non-elevated read-only `Get-VM` verification was denied by Hyper-V authorization
- **Physical mutation status:** none observed or claimed
- **Human review:** not presented; Task 2 remains closed

The first and only elevated v46 Audit launch used a relative wrapper path. The elevated child
opened outside the repository working directory and exited before `Run-LabElevated.ps1` could
create its per-action Evidence log or delegate to `Invoke-Phase6Physical.ps1`. The Evidence
directory remained unchanged, so no artifact verifier, simulation admission, Hyper-V audit,
checkpoint action, guest staging, guest runner, MSI, power-scheme operation, or `RunCleanVm`
boundary is claimed for this launch.

Per the fail-closed instruction, the Audit was not relaunched. The exact v46 artifact and
deterministic admission remain valid, but 06-26 is BLOCKED before its physical attempt until a
new explicit authorization permits the corrected absolute-path Audit launch. No v47 was minted.

---

## Operation `managed-power-scheme-v46` — READ-ONLY AUDIT PASSED

- **Recorded at:** `2026-08-15T01:42:32Z`
- **Operation version:** `managed-power-scheme-v46`
- **Build ID:** `physical-c714ca4c5ad147f4-managed-power-scheme-v46`
- **Artifact manifest SHA-256:** `a2be09354be854fe9d010a6108d7199341593876779517bb6976a02c5255e4da`
- **Simulation run SHA-256:** `ab98b0858a82d4436b032b6427560c20d8dfca673b03c53dcf1e74e62b786229`
- **Clean checkpoint:** `Clean-Windows-Ready`, ID `ab2bc9c7-e0f7-49a7-84d7-5fb6a486f075`
- **Preserved backup:** `Clean-Windows-Ready-PreLabAccount-v43`, ID `ebccd5f3-5645-4089-b469-fa4d851fc6ef`
- **Installed checkpoint:** `LiiiraaBoost-Installed` absent
- **Audit log:** `C:\Users\Liiiraa\VM-Lab\Evidence\20260814-224214-phase6audit-console.log`
- **Audit log SHA-256:** `4ccf5602685d78a466891d1aefaf5492c3bee2370b34f1308828ba85e22026a3`
- **Audit result:** `PASSED`, read-only
- **Completed boundaries:** `artifact-verifier-pass`, `simulation-admission-pass`, `hyper-v-prestart-audit-pass`, `integration-services-healthy`, `audit-vm-state-restored`, `hyper-v-audit-pass`
- **Final VM state:** `Off`, established by the successful `audit-vm-state-restored` boundary

The newly authorized one-time launch used the absolute wrapper path and absolute repository
working directory. The elevated action was only `Phase6Audit`, delegating only to bridge action
`Audit`. It did not restore or create a checkpoint, stage guest bytes, invoke PowerShell Direct,
run the guest runner, install the MSI, mutate a power scheme, or call `RunCleanVm`.

The earlier relative-path invocation blocker remains append-only history. The exact v46 tuple is
now Audit-ready for the separately authorized single 06-26 physical attempt; no such physical
attempt was executed here and no v47 was minted.

---

## Operation `managed-power-scheme-v46` — CLEAN WINDOWS VM BLOCKED

- **Recorded at:** `2026-08-15T01:50:35.3005257Z`
- **Operation version:** `managed-power-scheme-v46`
- **Build ID:** `physical-c714ca4c5ad147f4-managed-power-scheme-v46`
- **Source commit:** `1a1dc18ce40beaef2f83cdb3e070386e4d639021`
- **Artifact manifest SHA-256:** `a2be09354be854fe9d010a6108d7199341593876779517bb6976a02c5255e4da`
- **Clean config SHA-256:** `1e90866dbd21404606bcca716279f09b46b41be54fbf52c81d6f713242ae2942`
- **Runner SHA-256:** `d42c7499539cc43942d8b14ff4c0b854cd77e1d1929ea3ffea5b27cebfaf511f`
- **Simulation run SHA-256:** `ab98b0858a82d4436b032b6427560c20d8dfca673b03c53dcf1e74e62b786229`
- **Evidence manifest SHA-256:** `d2091f8cc9d7a827bdc8c857799f391ee4840d3ea15740e6034450fa162546da`
- **Result:** `BLOCKED-GUEST-ARTIFACT-CUSTODY`
- **Runner stage:** `installed-ready`
- **Runner exit code:** `2`
- **Allowlisted runner failure code:** `BLOCKED:artifact-custody`
- **Guest credential username form:** bare local username `LiiiraaLab`; no password was persisted
- **Human review:** not presented; Task 2 remains closed

The single authorized v46 `RunCleanVm` attempt reverified the exact artifact and deterministic
admission, restored checkpoint `Clean-Windows-Ready` ID
`ab2bc9c7-e0f7-49a7-84d7-5fb6a486f075`, reached all six healthy integration services, and
staged exactly the eleven manifest-bound files. The signed runner then failed closed at the
`installed-ready` boundary with the bounded allowlisted diagnostic `BLOCKED:artifact-custody`.
No `InstalledReady` record or `LiiiraaBoost-Installed` checkpoint was created, and the APPLY
confirmation phrase was never requested.

Completed boundaries are exactly `artifact-verifier-pass`, `simulation-admission-pass`,
`hyper-v-prestart-audit-pass`, `clean-checkpoint-restored`, `integration-services-healthy`, and
`exact-artifact-staged`. No apply, power-scheme mutation, reboot, continuation, raw-envelope
copy, physical-writer ingestion, physical PASS, reviewer record, Task 2, or Task 3 followed.
The evidence manifest therefore remains the exact deterministic-only v46 authority at SHA-256
`d2091f8cc9d7a827bdc8c857799f391ee4840d3ea15740e6034450fa162546da`.

The immutable blocker record is
`C:\Users\Liiiraa\VM-Lab\Evidence\phase6\20260814-225035-clean-vm-BLOCKED.json`, SHA-256
`b2e54c0df4c1572178d51e1f713a9f5af508977c4986bbde31e95ade3bee3eb7`.

The cleanup-only action returned the VM from `Running` to `Off` without runner execution,
credential reuse, checkpoint restore, or checkpoint creation. Cleanup evidence is
`C:\Users\Liiiraa\VM-Lab\Evidence\20260814-225134-phase6observationcleanup-console.log`, SHA-256
`96860830f089b5504e8c6d4861f122712408bc9bca8bb36613c8e65e351bb11a`, and confirms the exact
clean checkpoint ID remained `ab2bc9c7-e0f7-49a7-84d7-5fb6a486f075` with final VM state `Off`.
This v46 attempt is permanently BLOCKED and must not be relaunched, relabeled as physical
evidence, or advanced to Task 2/Task 3. No v47 was minted.

---

## Operation `managed-power-scheme-v47` — DETERMINISTIC SIMULATION ADMITTED

- **Physical provenance:** not claimed
- **Human review:** not claimed
- **Owner/friends consent:** not claimed
- **Physical PASS:** not claimed
- **Command:** `rtk pnpm phase6:simulate -- --artifact-manifest-from-summary .planning/phases/06-transactional-plans-and-recovery/06-31-SUMMARY.md --minimum-version managed-power-scheme-v47`
- **Artifact manifest SHA-256:** `31a039f7a4e3d1a4ca6c431aace3778edb6d018e6a00db6e7f35f77eebf60a7b`
- **Run evidence SHA-256:** `b9d29c44b13dd23b113413c5c64315783b2b176d3dfaa72ec76b096e163608f6`
- **Evidence manifest SHA-256:** `b15aaf5068bc0f248bc426252afa6fb3b53d8ddf5ade3482abf2076f5d9675c8`

### Exact command output

```json
{
  "operationVersion": "managed-power-scheme-v47",
  "buildId": "physical-50796b7236b2889c-managed-power-scheme-v47",
  "artifactManifestSha256": "31a039f7a4e3d1a4ca6c431aace3778edb6d018e6a00db6e7f35f77eebf60a7b",
  "runEvidenceSha256": "b9d29c44b13dd23b113413c5c64315783b2b176d3dfaa72ec76b096e163608f6",
  "evidenceManifestSha256": "b15aaf5068bc0f248bc426252afa6fb3b53d8ddf5ade3482abf2076f5d9675c8",
  "highestAdmittedStage": "deterministic-simulation",
  "requirementsCoverage": [
    "PLAN-01",
    "PLAN-02",
    "PLAN-03",
    "PLAN-04",
    "PLAN-05",
    "PLAN-06",
    "PLAN-07",
    "PLAN-08"
  ]
}
```

---

## Operation `managed-power-scheme-v47` — AUDIT LAUNCH BLOCKED

- **Artifact authority:** verified, manifest SHA-256 `31a039f7a4e3d1a4ca6c431aace3778edb6d018e6a00db6e7f35f77eebf60a7b`
- **Deterministic authority:** admitted, run SHA-256 `b9d29c44b13dd23b113413c5c64315783b2b176d3dfaa72ec76b096e163608f6`
- **Bridge:** 19/19 PASS and exact v47 dry-run PASS
- **Requested action:** one absolute-wrapper `Phase6Audit`
- **Result:** `BLOCKED-AUDIT-COMMAND-PARSE`
- **Wrapper/bridge execution:** not started
- **Durable v47 Audit log:** none created
- **VM state:** not asserted; non-elevated Hyper-V read access was denied
- **Physical mutation:** none observed or claimed

The outer PowerShell parser rejected the fixed `Start-Process` argument list before opening UAC
or executing `Run-LabElevated.ps1`. The fail-closed rule forbids a retry in this preparation.
No `RunCleanVm`, checkpoint restore/create, guest staging, runner, MSI, apply, reboot, or physical
evidence boundary executed. The deterministic-only v47 evidence manifest remains unchanged at
SHA-256 `b15aaf5068bc0f248bc426252afa6fb3b53d8ddf5ade3482abf2076f5d9675c8`.

---

## Operation `managed-power-scheme-v47` — READ-ONLY AUDIT BLOCKED BY HOST MEMORY

- **Audit log:** `C:\Users\Liiiraa\VM-Lab\Evidence\20260815-000927-phase6audit-console.log`
- **Audit log size:** `1256` bytes
- **Audit log SHA-256:** `cf17d3d425de203551b774a4be315e125b2292c40de1ea5eec3a9164f6773c62`
- **Requested action:** one elevated `Phase6Audit`, delegating only to bridge action `Audit`
- **Result:** `BLOCKED-AUDIT-HOST-MEMORY`
- **Failure:** Hyper-V `Start-VM` returned `0x8007000E` because the configured `8192` MiB startup memory was unavailable
- **VM mutation:** none; the Audit did not restore/create/rename a checkpoint or change VM memory/configuration
- **Physical mutation:** none; no `RunCleanVm`, guest staging, runner, MSI, apply, reboot, or evidence ingestion ran

The audit authenticated the existing fixed route far enough to reach the read-only integration
health start. `Start-VM` failed before the VM entered a started state. The v47 artifact and
deterministic evidence were not reminted, and the exact clean checkpoint remained the bridge
authority at ID `ab2bc9c7-e0f7-49a7-84d7-5fb6a486f075`.

---

## Operation `managed-power-scheme-v47` — 4 GiB PREPARATION ELEVATION CANCELED

- **Approved intent:** restore the existing clean checkpoint while Off, preserve it as `Clean-Windows-Ready-Pre4GiB-v47`, set dynamic memory to `4`/`4`/`12` GiB, and create a new Standard `Clean-Windows-Ready`
- **Safety TDD:** RED `70c5604`, GREEN `4fc00b0`; 20/20 bridge and preparation policy tests passed
- **Result:** `BLOCKED-PREPARATION-UAC-CANCELED`
- **Elevated child:** not started; Windows returned `A operação foi cancelada pelo usuário`
- **External preparation evidence:** none created because the fixed elevated script did not execute
- **VM/checkpoint/memory mutation:** none executed by this launch
- **Bridge rebind:** not performed
- **v47 Audit after preparation:** not performed

The fail-closed no-retry rule stopped the workflow at the canceled UAC boundary. No second
elevation was requested, no v48 was minted, and the deterministic-only v47 authority remains
unchanged. VM `Off` is the last established state from the failed 8 GiB Audit path; no later
operation started or mutated the VM.

---

## Operation `managed-power-scheme-v47` — 4 GiB CLEAN CHECKPOINT PREPARATION PASSED

- **New explicit authorization:** one replacement attempt after the earlier canceled UAC
- **Preparation evidence:** `C:\Users\Liiiraa\VM-Lab\Evidence\phase6\20260815-044525-503-phase6-pre4gib-v47.json`
- **Evidence size:** `7519` bytes
- **Evidence SHA-256:** `ec8110d2b9e5ae540ff19bb62b59ebde44f96b67a1d6770f627f8bd76d141c0e`
- **Result:** `PASSED`
- **VM:** `LiiiraaBoost-W11-25H2-Clean`, ID `107680b1-d9cc-411a-843a-ab72019469cd`, Generation 2, final state `Off`
- **Memory:** dynamic enabled; startup `4294967296`, minimum `4294967296`, maximum `12884901888` bytes
- **New clean checkpoint:** `Clean-Windows-Ready`, Standard, ID `a918f5c0-ade0-4bac-bca3-baa91686777e`
- **Preserved restored checkpoint:** `Clean-Windows-Ready-Pre4GiB-v47`, ID `ab2bc9c7-e0f7-49a7-84d7-5fb6a486f075`
- **Preserved pre-account backup:** `Clean-Windows-Ready-PreLabAccount-v43`, ID `ebccd5f3-5645-4089-b469-fa4d851fc6ef`
- **Installed checkpoint:** `LiiiraaBoost-Installed` absent

The create-once operation verified the exact Off/Generation 2/processor/security/storage/DVD/
network/integration topology, restored the old clean checkpoint to discard staged diagnostic
residue, preserved both backups, applied only the approved 4/4/12 GiB dynamic-memory envelope,
and created one new Standard clean checkpoint. It never started the VM or deleted a checkpoint.

---

## Operation `managed-power-scheme-v47` — REBOUND READ-ONLY AUDIT PASSED

- **Checkpoint-rebind TDD:** RED `bb09e34`, GREEN `c3564b0`
- **Bridge policy suite:** 20/20 PASS
- **Dry-run:** PASS with clean checkpoint ID `a918f5c0-ade0-4bac-bca3-baa91686777e`
- **Planned evaluator:** `ok: true`, highest admitted stage `deterministic-simulation`
- **Architecture/key-link gate:** 51/51 PASS
- **Audit log:** `C:\Users\Liiiraa\VM-Lab\Evidence\20260815-014943-phase6audit-console.log`
- **Audit log size:** `1127` bytes
- **Audit log SHA-256:** `89ee4e56c77087c642660e5f0404d212f4872e2dc3444e1ca154347d73d4b87c`
- **Audit result:** `PASSED`, read-only
- **Completed boundaries:** `artifact-verifier-pass`, `simulation-admission-pass`, `hyper-v-prestart-audit-pass`, `integration-services-healthy`, `audit-vm-state-restored`, `hyper-v-audit-pass`
- **Final VM state:** `Off`, established by `audit-vm-state-restored`

Exactly one newly authorized `Phase6Audit` ran through the absolute wrapper and repository
working directory. It retained the exact v47 artifact/simulation tuple, started the VM only for
read-only integration health observation at 4 GiB, and returned it to `Off`. No `RunCleanVm`,
guest staging, guest runner, MSI, apply, checkpoint mutation, physical evidence ingestion, or
v48 mint occurred.

---

## Operation `managed-power-scheme-v47` — CLEAN WINDOWS VM BLOCKED

- **Recorded at:** `2026-08-15T04:59:40.3565897Z`
- **Operation version:** `managed-power-scheme-v47`
- **Build ID:** `physical-50796b7236b2889c-managed-power-scheme-v47`
- **Source commit:** `29827368ebfe92abce6135807af82d58c5b1326a`
- **Artifact manifest SHA-256:** `31a039f7a4e3d1a4ca6c431aace3778edb6d018e6a00db6e7f35f77eebf60a7b`
- **Clean config SHA-256:** `6b3388b917e2710bdd7606944df93149637eb5d84fb4af78cf8a6b6463d56cd5`
- **Runner SHA-256:** `669130f220471a90132e2225a4ee523edb55baa7b7465bf60819fb33d5b80545`
- **Simulation run SHA-256:** `b9d29c44b13dd23b113413c5c64315783b2b176d3dfaa72ec76b096e163608f6`
- **Pre-attempt evidence manifest SHA-256:** `b15aaf5068bc0f248bc426252afa6fb3b53d8ddf5ade3482abf2076f5d9675c8`
- **Result:** `BLOCKED-GUEST-INSTALLER-EXIT`
- **Runner stage:** `installed-ready`
- **Runner exit code:** `2`
- **Allowlisted runner failure code:** `BLOCKED:installer-exit`
- **Guest credential username form:** bare local username `LiiiraaLab`; no password was persisted
- **Human review:** not presented; Task 2 and Task 3 remain closed

The single authorized v47 `RunCleanVm` attempt reverified the exact artifact and deterministic
admission, restored `Clean-Windows-Ready` ID `a918f5c0-ade0-4bac-bca3-baa91686777e`, reached
all six healthy integration services, staged exactly the eleven manifest-bound files, and
provisioned plus independently verified the protected guest artifact ACL. The signed Rust runner
then failed closed during `installed-ready` with bounded diagnostic `BLOCKED:installer-exit`.

Completed boundaries are exactly `artifact-verifier-pass`, `simulation-admission-pass`,
`hyper-v-prestart-audit-pass`, `clean-checkpoint-restored`, `integration-services-healthy`,
`exact-artifact-staged`, `guest-artifact-acl-provisioned`, and
`guest-artifact-acl-verified`. No `InstalledReady` record, installed checkpoint, APPLY approval
prompt, power-scheme mutation, reboot, continuation, raw-envelope copy, physical-writer ingestion,
physical PASS, reviewer record, Task 2, or Task 3 followed. The evidence manifest remained
byte-identical at SHA-256 `b15aaf5068bc0f248bc426252afa6fb3b53d8ddf5ade3482abf2076f5d9675c8`.

The immutable blocker record is
`C:\Users\Liiiraa\VM-Lab\Evidence\phase6\20260815-015940-clean-vm-BLOCKED.json`, SHA-256
`a8ae718771f2cba630fa0180a55444ddf20e238300916881febe79c844db2642`.
The bounded elevated console transcript is
`C:\Users\Liiiraa\VM-Lab\Evidence\20260815-015847-phase6runcleanvm-v47-console.log`, SHA-256
`42492a21c26562d4542dc4b2747469f15abada690950234916e87d975cf5024c`.

The cleanup-only action then returned the VM from `Running` to `Off` without runner execution,
credential reuse, checkpoint restore, or checkpoint creation. Cleanup evidence is
`C:\Users\Liiiraa\VM-Lab\Evidence\20260815-020032-phase6observationcleanup-console.log`,
SHA-256 `fed4b585c4bb98369b4821107ec20b04390e035a9e3bef20ec1d3f5aa70dc2f9`, and confirms the exact
clean checkpoint ID remained `a918f5c0-ade0-4bac-bca3-baa91686777e` with final VM state `Off`.
This v47 attempt is permanently BLOCKED and must not be relaunched, relabeled as physical
evidence, advanced to human review, or followed by a v48 remint in this execution.

---

## Operation `managed-power-scheme-v48` — FINAL BUILD BLOCKED

- **Recorded at:** `2026-08-15T05:35:46.291Z`
- **Result:** `BLOCKED-BUILD-MISSING-EXACT-EDGE-DRIVER`
- **Operation version:** `managed-power-scheme-v48`
- **Build ID:** `physical-487e3c326b5066a0-managed-power-scheme-v48`
- **Source commit:** `28d7579fc9fb8934fa9a05650844dc4bb7e2a115`
- **Input tree:** `sha256:487e3c326b5066a01dc88a1b91262ce965b89219eddb75097e4c2c9853cd26d7`
- **Reason:** exact official Edge-matched `msedgedriver 151.0.4129.86` was unavailable
- **Artifact published:** `false`
- **MSI built:** `false`
- **Lifecycle verified:** `false`
- **Canonical blocker:** `target/phase6-physical/_blocked/BLOCKED-1786772146291-10488.json`, `599` bytes, SHA-256 `13ba55c7e8e4bc6433e58fcbc8b5876731232131eb1d8a66e82c1ed97f7ae45b`
- **Tracked blocker mirror:** `.planning/phases/06-transactional-plans-and-recovery/06-26-v48-BLOCKED.json`
- **TDD:** RED `17432cc7`, GREEN `28d7579f`
- **Focused verification:** physical runner 20/20 PASS; bridge 22/22 PASS
- **Broad verification:** artifact builder 27/27, desktop crate 233, optimizer service 86 with 1 ignored, architecture 51/51, key-links 06-31 4/4, 06-34 2/2, 06-35 3/3, and 06-38 2/2 all PASS
- **MSI diagnostic summary:** unavailable/not applicable; the build stopped before an MSI or fixed guest MSI log existed, so there is no installer exit, MSI-log hash/size, or `Return value 3` action to report
- **Raw MSI log exported:** no
- **v48 simulation/admission/Audit/RunCleanVm:** not executed because no v48 artifact authority existed
- **Human review:** not presented; Task 2 and Task 3 remain closed

The final consolidated correction preserves the canonical custody/live-hash path while deriving
a narrowly validated DOS/UNC-compatible path only for `msiexec`. It also reserves one protected
fixed `/l*vx!` guest log, preserves allowlisted numeric installer exit taxonomy, and exports
only a bounded redacted failure summary. Tests cover normal/verbatim DOS and UNC paths,
relative/dot/device rejection, reboot exits, unknown exits, oversized logs, and raw secret,
SID, username, and path non-disclosure.

Exactly one v48 `build-and-smoke` was started. It failed closed before MSI assembly because the
required exact browser-matched driver was not staged. No v48 artifact directory was published,
no 06-35 verifier or deterministic simulation could consume v48, and the existing v47 artifact
and deterministic evidence remain unchanged. There is no retry and no v49.

The cleanup-only action then verified VM `LiiiraaBoost-W11-25H2-Clean` was and remained `Off`.
Cleanup evidence is
`C:\Users\Liiiraa\VM-Lab\Evidence\20260815-023717-phase6observationcleanup-console.log`,
`2751` bytes, SHA-256
`08a112e23bd09ef83449318a8672c061bed4627fb1797b0c035444b5fa7f77c3`. It confirms the exact
`Clean-Windows-Ready` checkpoint ID remained `a918f5c0-ade0-4bac-bca3-baa91686777e` and the
final VM state is `Off`. This is the terminal v48 handoff: do not retry, mint v49, run
`RunCleanVm`, or advance to human review from this record.

---

## Operation `managed-power-scheme-v49` — DETERMINISTIC SIMULATION ADMITTED

- **Physical provenance:** not claimed
- **Human review:** not claimed
- **Owner/friends consent:** not claimed
- **Physical PASS:** not claimed
- **Command:** `rtk pnpm phase6:simulate -- --artifact-manifest-from-summary .planning/phases/06-transactional-plans-and-recovery/06-31-SUMMARY.md --minimum-version managed-power-scheme-v49`
- **Artifact manifest SHA-256:** `e3c904651333c0ac22b0706ffed4fc932a0ac18db76a87f02e863693ae78be09`
- **Run evidence SHA-256:** `5fa130be15b8cc0e3da89b2825e791fd2d5e725f3bc2f296341f4a54d4daf92d`
- **Evidence manifest SHA-256:** `2f197d2be921e8c46ca7913c7c76f8b6b2a5acc31f36968cbf1a6188d07fbd24`

### Exact command output

```json
{
  "operationVersion": "managed-power-scheme-v49",
  "buildId": "physical-487e3c326b5066a0-managed-power-scheme-v49",
  "artifactManifestSha256": "e3c904651333c0ac22b0706ffed4fc932a0ac18db76a87f02e863693ae78be09",
  "runEvidenceSha256": "5fa130be15b8cc0e3da89b2825e791fd2d5e725f3bc2f296341f4a54d4daf92d",
  "evidenceManifestSha256": "2f197d2be921e8c46ca7913c7c76f8b6b2a5acc31f36968cbf1a6188d07fbd24",
  "highestAdmittedStage": "deterministic-simulation",
  "requirementsCoverage": [
    "PLAN-01",
    "PLAN-02",
    "PLAN-03",
    "PLAN-04",
    "PLAN-05",
    "PLAN-06",
    "PLAN-07",
    "PLAN-08"
  ]
}
```

---

## Operation `managed-power-scheme-v49` — CLEAN WINDOWS VM BLOCKED

- **Operation version:** `managed-power-scheme-v49`
- **Build ID:** `physical-487e3c326b5066a0-managed-power-scheme-v49`
- **Artifact manifest SHA-256:** `e3c904651333c0ac22b0706ffed4fc932a0ac18db76a87f02e863693ae78be09`
- **Simulation run SHA-256:** `5fa130be15b8cc0e3da89b2825e791fd2d5e725f3bc2f296341f4a54d4daf92d`
- **Result:** `BLOCKED:guest-acl-cardinality`
- **Stage:** `preflight`
- **Completed boundaries:** `artifact-verifier-pass`, `simulation-admission-pass`, `hyper-v-prestart-audit-pass`, `clean-checkpoint-restored`, `integration-services-healthy`, `exact-artifact-staged`
- **Runner/MSI/apply:** not started
- **Blocker record:** `C:\Users\Liiiraa\VM-Lab\Evidence\phase6\20260815-031038-clean-vm-BLOCKED.json`, `964` bytes, SHA-256 `257ac884ed7f3b93ef3c93f255d980c83e7625103d67f38c7a659d6b2d5e0f61`
- **Cleanup evidence:** `C:\Users\Liiiraa\VM-Lab\Evidence\20260815-031127-phase6observationcleanup-console.log`, `2755` bytes, SHA-256 `fed4b585c4bb98369b4821107ec20b04390e035a9e3bef20ec1d3f5aa70dc2f9`
- **Cleanup result:** `PASSED`, VM `Off`, exact clean checkpoint ID `a918f5c0-ade0-4bac-bca3-baa91686777e`

The one v49 physical attempt failed before ACL provisioning because the two closed guest-custody
functions still named the prior v47 staging root while the authenticated copy correctly staged
v49. No runner, MSI, installed checkpoint, approval phrase, power mutation, reboot, evidence
ingestion, or human review followed. The cleanup-only action returned the running VM to `Off`.

The causal correction was completed through RED `7d842e2` and GREEN `ab5edd8`: both custody
boundaries now receive only the bridge-derived closed guest root and independently compare it to
the exact bound build literal before ACL inspection or mutation. The full bridge suite remains
22/22 PASS. v49 is permanently BLOCKED and will not be relaunched.

---

## Operation `managed-power-scheme-v50` — DETERMINISTIC SIMULATION ADMITTED

- **Physical provenance:** not claimed
- **Human review:** not claimed
- **Owner/friends consent:** not claimed
- **Physical PASS:** not claimed
- **Command:** `rtk pnpm phase6:simulate -- --artifact-manifest-from-summary .planning/phases/06-transactional-plans-and-recovery/06-31-SUMMARY.md --minimum-version managed-power-scheme-v50`
- **Artifact manifest SHA-256:** `c02d0310205662e0d9e3a8fc9b5240bd954d82b4e28924f4a9c30c10c8b5516b`
- **Run evidence SHA-256:** `ceba27bb8e17dd0bf333300e29bbdab9bfbcf2b3bdf45854f2d7bd6cc95ac36b`
- **Evidence manifest SHA-256:** `41260143ac410eeef9133a7a7b79ec5354e1278d2491c6c2a036eacfe727735c`

### Exact command output

```json
{
  "operationVersion": "managed-power-scheme-v50",
  "buildId": "physical-487e3c326b5066a0-managed-power-scheme-v50",
  "artifactManifestSha256": "c02d0310205662e0d9e3a8fc9b5240bd954d82b4e28924f4a9c30c10c8b5516b",
  "runEvidenceSha256": "ceba27bb8e17dd0bf333300e29bbdab9bfbcf2b3bdf45854f2d7bd6cc95ac36b",
  "evidenceManifestSha256": "41260143ac410eeef9133a7a7b79ec5354e1278d2491c6c2a036eacfe727735c",
  "highestAdmittedStage": "deterministic-simulation",
  "requirementsCoverage": [
    "PLAN-01",
    "PLAN-02",
    "PLAN-03",
    "PLAN-04",
    "PLAN-05",
    "PLAN-06",
    "PLAN-07",
    "PLAN-08"
  ]
}
```

---

## Operation `managed-power-scheme-v50` — FINAL CLEAN WINDOWS VM BLOCKED

- **Operation version:** `managed-power-scheme-v50`
- **Build ID:** `physical-487e3c326b5066a0-managed-power-scheme-v50`
- **Artifact manifest SHA-256:** `c02d0310205662e0d9e3a8fc9b5240bd954d82b4e28924f4a9c30c10c8b5516b`
- **Simulation run SHA-256:** `ceba27bb8e17dd0bf333300e29bbdab9bfbcf2b3bdf45854f2d7bd6cc95ac36b`
- **Evidence manifest SHA-256 before physical run:** `41260143ac410eeef9133a7a7b79ec5354e1278d2491c6c2a036eacfe727735c`
- **Audit:** `PASSED`, read-only; log `C:\Users\Liiiraa\VM-Lab\Evidence\20260815-032307-phase6audit-console.log`, `1127` bytes, SHA-256 `acec533e814b01854a37e72152a7970e5ea2e3f72f553f1c10cebb4cc06050e8`
- **Result:** `BLOCKED:fixed-runner-config-path-mismatch`
- **Stage:** `installed-ready`
- **Completed boundaries:** `artifact-verifier-pass`, `simulation-admission-pass`, `hyper-v-prestart-audit-pass`, `clean-checkpoint-restored`, `integration-services-healthy`, `exact-artifact-staged`, `guest-artifact-acl-provisioned`, `guest-artifact-acl-verified`
- **Runner exit/failure code:** unavailable; the runner process did not start
- **MSI diagnostic:** unavailable/not applicable; no MSI invocation or guest MSI log occurred
- **Raw runner/MSI output exported:** no
- **Canonical blocker:** `C:\Users\Liiiraa\VM-Lab\Evidence\phase6\20260815-032451-clean-vm-BLOCKED.json`, `1105` bytes, SHA-256 `08863181745d88b5fa385ae5c4252ed733331f6cf97951fbcbbabe88cadeb0e8`
- **Tracked blocker mirror:** `.planning/phases/06-transactional-plans-and-recovery/06-26-v50-BLOCKED.json`
- **Cleanup:** `PASSED`; log `C:\Users\Liiiraa\VM-Lab\Evidence\20260815-032525-phase6observationcleanup-console.log`, `2755` bytes, SHA-256 `fed4b585c4bb98369b4821107ec20b04390e035a9e3bef20ec1d3f5aa70dc2f9`
- **Final VM state:** `Off`; exact clean checkpoint ID `a918f5c0-ade0-4bac-bca3-baa91686777e`
- **Installed checkpoint/apply/reboot/ingestion:** not reached
- **Human review:** not presented; Task 2 and Task 3 remain closed

The final v50 bridge authenticated the exact eight-entry deterministic chain, restored the clean
checkpoint, staged only the manifest-bound artifact, and both provisioned and independently
verified the protected guest ACL. It then failed closed before spawning the runner because the
runner/config pair assertion still contained the historical v47 literal. No MSI, installed-ready
record, installed checkpoint, approval phrase, optimization, reboot, raw-envelope collection,
physical-writer ingestion, physical PASS, or review followed.

The cleanup-only action returned the running VM to `Off` and preserved the exact clean checkpoint.
This is the terminal Phase 6 physical blocker: v50 is not reusable, no v51 is authorized, and
the workflow must not advance to Task 2 or Task 3 from this evidence.

---

## Operation `managed-power-scheme-v52` — DETERMINISTIC SIMULATION ADMITTED

- **Physical provenance:** not claimed
- **Human review:** not claimed
- **Owner/friends consent:** not claimed
- **Physical PASS:** not claimed
- **Command:** `rtk pnpm phase6:simulate -- --artifact-manifest-from-summary .planning/phases/06-transactional-plans-and-recovery/06-31-SUMMARY.md --minimum-version managed-power-scheme-v52`
- **Artifact manifest SHA-256:** `e11d36a6285af09417d397681692e9e65bce959ff87047686d435401c52b66b3`
- **Run evidence SHA-256:** `1dfaa8be4dac42e9f5c45cba7dea0ffc08606d9828948112cf07ac9df6301644`
- **Evidence manifest SHA-256:** `9c98b29b9d42539963944bd26e34106e95314ca3ccc26ac856a3ae175720b598`

### Exact command output

```json
{
  "operationVersion": "managed-power-scheme-v52",
  "buildId": "physical-487e3c326b5066a0-managed-power-scheme-v52",
  "artifactManifestSha256": "e11d36a6285af09417d397681692e9e65bce959ff87047686d435401c52b66b3",
  "runEvidenceSha256": "1dfaa8be4dac42e9f5c45cba7dea0ffc08606d9828948112cf07ac9df6301644",
  "evidenceManifestSha256": "9c98b29b9d42539963944bd26e34106e95314ca3ccc26ac856a3ae175720b598",
  "highestAdmittedStage": "deterministic-simulation",
  "requirementsCoverage": [
    "PLAN-01",
    "PLAN-02",
    "PLAN-03",
    "PLAN-04",
    "PLAN-05",
    "PLAN-06",
    "PLAN-07",
    "PLAN-08"
  ]
}
```

---

## Operation `managed-power-scheme-v52` — CLEAN VM BLOCKED

- **Physical result:** BLOCKED at `installed-ready`
- **Runner:** exit `2`, code `BLOCKED:installer-exit-1603`
- **Immutable blocker:** `C:\Users\Liiiraa\VM-Lab\Evidence\phase6\20260815-035332-clean-vm-BLOCKED.json`
- **Blocker SHA-256 / size:** `e87d5a439b112fb143e8324babb0ebe113c21cf84d639bd992d6567a6aa17c29` / `1110` bytes
- **Audit log SHA-256 / size:** `006bec91ac2bd208904bee1f0c6b00008699579d5c97b5e74d996e93cae8bcb5` / `1127` bytes
- **Cleanup log SHA-256 / size:** `08a112e23bd09ef83449318a8672c061bed4627fb1797b0c035444b5fa7f77c3` / `2751` bytes
- **Final VM state:** `Off`
- **Human review:** not presented; Task 2 and Task 3 remain closed

The sole v52 `RunCleanVm` passed artifact verification, deterministic admission, Hyper-V audit,
clean restore, integration health, exact staging, and protected ACL provisioning/verification.
The runner then returned MSI exit `1603` before any apply, reboot, installed checkpoint, evidence
ingestion, or review. The blocker truthfully retained `installerDiagnostic: null`: the bridge
attempted to fetch the MSI log through a second PowerShell Direct session after the failed runner,
but that session did not reopen. The read-only diagnostic attempt exported no raw log and cleanup
restored the VM to `Off`.

RED `9d62fce` and GREEN `5c649f5` replace that cross-session dependency with a fixed create-once,
bounded safe sidecar produced by the runner and collected before the original guest session
returns. The sidecar exposes only numeric exit, log presence/hash/size, an allowlisted final
`Return value 3` action, and its own hash/size; malformed, missing, or unwritable diagnostics
remain explicit bounded codes and never export raw log, path, user, SID, or secret material.

---

## Operation `managed-power-scheme-v53` — DETERMINISTIC SIMULATION ADMITTED

- **Physical provenance:** not claimed
- **Human review:** not claimed
- **Owner/friends consent:** not claimed
- **Physical PASS:** not claimed
- **Command:** `rtk pnpm phase6:simulate -- --artifact-manifest-from-summary .planning/phases/06-transactional-plans-and-recovery/06-31-SUMMARY.md --minimum-version managed-power-scheme-v53`
- **Artifact manifest SHA-256:** `6d2e76a71014ea056c4fd0027d46f5fe26c500616885e1153b326d9dbf024271`
- **Run evidence SHA-256:** `01666800658d5aac14e99b46a14e0a23497c937710f38168e9559e92d2bee7ba`
- **Evidence manifest SHA-256:** `513ce2511f826316a2851c109bd7d433d5ade7b2c003d07d48b74cfd497a5833`

### Exact command output

```json
{
  "operationVersion": "managed-power-scheme-v53",
  "buildId": "physical-468a05974898514d-managed-power-scheme-v53",
  "artifactManifestSha256": "6d2e76a71014ea056c4fd0027d46f5fe26c500616885e1153b326d9dbf024271",
  "runEvidenceSha256": "01666800658d5aac14e99b46a14e0a23497c937710f38168e9559e92d2bee7ba",
  "evidenceManifestSha256": "513ce2511f826316a2851c109bd7d433d5ade7b2c003d07d48b74cfd497a5833",
  "highestAdmittedStage": "deterministic-simulation",
  "requirementsCoverage": [
    "PLAN-01",
    "PLAN-02",
    "PLAN-03",
    "PLAN-04",
    "PLAN-05",
    "PLAN-06",
    "PLAN-07",
    "PLAN-08"
  ]
}
```

---

## Operation `managed-power-scheme-v53` — CLEAN VM BLOCKED, ROOT CAUSE CONFIRMED

- **Physical result:** BLOCKED at `installed-ready`
- **Runner:** exit `2`, code `BLOCKED:installer-exit-1603`
- **Immutable blocker:** `C:\Users\Liiiraa\VM-Lab\Evidence\phase6\20260815-042855-clean-vm-BLOCKED.json`
- **Blocker SHA-256 / size:** `fc859dd361e2b1ad46b8c06940b97ab9269f206a4d4e88472ca3cf0d1e3359c4` / `1832` bytes
- **Tracked blocker mirror:** `.planning/phases/06-transactional-plans-and-recovery/06-26-v53-BLOCKED.json`
- **MSI log identity:** SHA-256 `bca766b5884f090ffb35756e64343165c6e22e568dafcdceac12604bb238b073`, `138200` bytes, UTF-16LE BOM
- **Bounded failure:** exit `1603`; `Return value 3` action `INSTALL`; MSI error `1920`; SCM event `7000`; Win32 code `1053`; no service-specific `63101`–`63109` event
- **Final sanitized summary:** `20260815-161152-506-v53-msi-sanitized-fixture.json`, SHA-256 `c300485b66a4d6fe9639a9ec95f41c3de310be760afae1bba625b1a6e8c0e5f8`, `409` bytes
- **Raw MSI log exported:** no
- **APPLY prompt / installed checkpoint / reboot / ingestion / review:** not reached
- **Final VM state:** `Off`

The exact root cause was a missing Microsoft C/C++ runtime on the clean guest: the v53 service
imported `VCRUNTIME140.dll` plus `api-ms-win-crt-*`, while no broker-specific event was emitted.
RED `b35b674` and GREEN `8900122` make only the service release build use static CRT and reject
dynamic CRT imports before signing or packaging. The v53 attempt remains immutable and was not
reused.

---

## Operation `managed-power-scheme-v54` — DETERMINISTIC SIMULATION ADMITTED

- **Physical provenance:** not claimed
- **Human review:** not claimed
- **Owner/friends consent:** not claimed
- **Physical PASS:** not claimed
- **Command:** `rtk pnpm phase6:simulate -- --artifact-manifest-from-summary .planning/phases/06-transactional-plans-and-recovery/06-31-SUMMARY.md --minimum-version managed-power-scheme-v54`
- **Artifact manifest SHA-256:** `07e2e082d865bc3ccd22f167108f14e9ce9eb1b517ce624a79e64481b0687c40`
- **Run evidence SHA-256:** `bc06bea9da9baa679e10c82703d4cf9588220fc8f0e976082fd438e8e5914965`
- **Evidence manifest SHA-256:** `681e2c64cc0ee154149753e07fe4d78398d3eac79237b371b87a0d4d5da21e63`

### Exact command output

```json
{
  "operationVersion": "managed-power-scheme-v54",
  "buildId": "physical-0fb27dbbc1f09383-managed-power-scheme-v54",
  "artifactManifestSha256": "07e2e082d865bc3ccd22f167108f14e9ce9eb1b517ce624a79e64481b0687c40",
  "runEvidenceSha256": "bc06bea9da9baa679e10c82703d4cf9588220fc8f0e976082fd438e8e5914965",
  "evidenceManifestSha256": "681e2c64cc0ee154149753e07fe4d78398d3eac79237b371b87a0d4d5da21e63",
  "highestAdmittedStage": "deterministic-simulation",
  "requirementsCoverage": [
    "PLAN-01",
    "PLAN-02",
    "PLAN-03",
    "PLAN-04",
    "PLAN-05",
    "PLAN-06",
    "PLAN-07",
    "PLAN-08"
  ]
}
```

---

## Operation `managed-power-scheme-v55` — DETERMINISTIC SIMULATION ADMITTED

- **Physical provenance:** not claimed
- **Human review:** not claimed
- **Owner/friends consent:** not claimed
- **Physical PASS:** not claimed
- **Command:** `rtk pnpm phase6:simulate -- --artifact-manifest-from-summary .planning/phases/06-transactional-plans-and-recovery/06-31-SUMMARY.md --minimum-version managed-power-scheme-v55`
- **Artifact manifest SHA-256:** `e38830867effd2f71562a7732a12ab1645a6b88cc8c3f4ad36a44abd0197fb7a`
- **Run evidence SHA-256:** `a5d3de5a10249b0f7c7bf7cf922668eea3073e31fc2862ab31e9c667c0b5d3cb`
- **Evidence manifest SHA-256:** `eed0d494cae1778f4099a3ee90e97e22b81235b5fdc8ddc18876ce17cc75f8d8`

### Exact command output

```json
{
  "operationVersion": "managed-power-scheme-v55",
  "buildId": "physical-4c88acfffc6c9dc2-managed-power-scheme-v55",
  "artifactManifestSha256": "e38830867effd2f71562a7732a12ab1645a6b88cc8c3f4ad36a44abd0197fb7a",
  "runEvidenceSha256": "a5d3de5a10249b0f7c7bf7cf922668eea3073e31fc2862ab31e9c667c0b5d3cb",
  "evidenceManifestSha256": "eed0d494cae1778f4099a3ee90e97e22b81235b5fdc8ddc18876ce17cc75f8d8",
  "highestAdmittedStage": "deterministic-simulation",
  "requirementsCoverage": [
    "PLAN-01",
    "PLAN-02",
    "PLAN-03",
    "PLAN-04",
    "PLAN-05",
    "PLAN-06",
    "PLAN-07",
    "PLAN-08"
  ]
}
```
---

## Operation `managed-power-scheme-v55` — AUDIT PASSED, CLEAN VM BLOCKED

- **Audit:** PASSED, read-only; log `C:\Users\Liiiraa\VM-Lab\Evidence\20260815-170051-phase6audit-console.log`, SHA-256 `e564af9b75bf252a7bbc8dd31c8fb64d9b4a9565522da48db5b1a9fd6699b395`, `1127` bytes
- **Physical result:** BLOCKED at `installed-ready`
- **Runner:** exit `2`, code `BLOCKED:installed-custody-canonical-path-invalid`
- **Immutable blocker:** `C:\Users\Liiiraa\VM-Lab\Evidence\phase6\20260815-170231-clean-vm-BLOCKED.json`, SHA-256 `1c533e9d1d8501aed20b02732be7bf417ec1b5e3bcb9d9a80a758bc85d0393a0`, `1129` bytes
- **Tracked blocker mirror:** `.planning/phases/06-transactional-plans-and-recovery/06-26-v55-BLOCKED.json`
- **MSI status:** completed; `installerDiagnostic` is null because the failure occurred in installed-custody canonicalization
- **APPLY prompt / installed checkpoint / reboot / ingestion / review:** not reached
- **Cleanup:** PASSED; log `C:\Users\Liiiraa\VM-Lab\Evidence\20260815-170259-phase6observationcleanup-console.log`, SHA-256 `fed4b585c4bb98369b4821107ec20b04390e035a9e3bef20ec1d3f5aa70dc2f9`, `2755` bytes
- **Final VM state:** `Off`; clean checkpoint unchanged

The v54 ACL repair proved the admission record was now reachable, and the typed v55 failure isolated
the next exact boundary: Rust canonicalization requires `FILE_READ_ATTRIBUTES` on each protected
directory, while the prior interactive ACE granted only traverse. RED `6df924f` and GREEN
`5937be4` replace it with the minimum `SYNCHRONIZE | FILE_READ_ATTRIBUTES | FILE_TRAVERSE` mask
(`0x001000A0`), without directory listing, DB/secret read, or write. Full gates passed before any
subsequent reservation. The immutable v55 attempt was not reused.

---

## Operation `managed-power-scheme-v56` — DETERMINISTIC SIMULATION ADMITTED

- **Physical provenance:** not claimed
- **Human review:** not claimed
- **Owner/friends consent:** not claimed
- **Physical PASS:** not claimed
- **Command:** `rtk pnpm phase6:simulate -- --artifact-manifest-from-summary .planning/phases/06-transactional-plans-and-recovery/06-31-SUMMARY.md --minimum-version managed-power-scheme-v56`
- **Artifact manifest SHA-256:** `4bffc051607994b34a29f96afd2ac12f173815f84519ab1855090ff89fcb060f`
- **Run evidence SHA-256:** `858c24f08a246793aff101183a0e6876fdb4189d3bae4ad48d30cf74d2b65940`
- **Evidence manifest SHA-256:** `29d024104cc942ef34e5d5dd8ae0bb906b9375341818587e9e102320fd359be4`

### Exact command output

```json
{
  "operationVersion": "managed-power-scheme-v56",
  "buildId": "physical-c013840c872b6f81-managed-power-scheme-v56",
  "artifactManifestSha256": "4bffc051607994b34a29f96afd2ac12f173815f84519ab1855090ff89fcb060f",
  "runEvidenceSha256": "858c24f08a246793aff101183a0e6876fdb4189d3bae4ad48d30cf74d2b65940",
  "evidenceManifestSha256": "29d024104cc942ef34e5d5dd8ae0bb906b9375341818587e9e102320fd359be4",
  "highestAdmittedStage": "deterministic-simulation",
  "requirementsCoverage": [
    "PLAN-01",
    "PLAN-02",
    "PLAN-03",
    "PLAN-04",
    "PLAN-05",
    "PLAN-06",
    "PLAN-07",
    "PLAN-08"
  ]
}
```

---

## Operation `managed-power-scheme-v57` — DETERMINISTIC SIMULATION ADMITTED

- **Physical provenance:** not claimed
- **Human review:** not claimed
- **Owner/friends consent:** not claimed
- **Physical PASS:** not claimed
- **Command:** `rtk pnpm phase6:simulate -- --artifact-manifest-from-summary .planning/phases/06-transactional-plans-and-recovery/06-31-SUMMARY.md --minimum-version managed-power-scheme-v57`
- **Artifact manifest SHA-256:** `4f291830874f31250147726467a1ce66e500d6657e0f4229124f280f1abd0cb3`
- **Run evidence SHA-256:** `62aa6c83e3bd32022d238e75121f93ef2664712c707ed9ba29929b92cc59f762`
- **Evidence manifest SHA-256:** `0f1deb2d1fa9e15044fa11f30cee8143a464dc896068de7117146d2480f5d0a1`

### Exact command output

```json
{
  "operationVersion": "managed-power-scheme-v57",
  "buildId": "physical-9f5464923978c943-managed-power-scheme-v57",
  "artifactManifestSha256": "4f291830874f31250147726467a1ce66e500d6657e0f4229124f280f1abd0cb3",
  "runEvidenceSha256": "62aa6c83e3bd32022d238e75121f93ef2664712c707ed9ba29929b92cc59f762",
  "evidenceManifestSha256": "0f1deb2d1fa9e15044fa11f30cee8143a464dc896068de7117146d2480f5d0a1",
  "highestAdmittedStage": "deterministic-simulation",
  "requirementsCoverage": [
    "PLAN-01",
    "PLAN-02",
    "PLAN-03",
    "PLAN-04",
    "PLAN-05",
    "PLAN-06",
    "PLAN-07",
    "PLAN-08"
  ]
}
```

---

## Operation `managed-power-scheme-v57` — CLEAN VM BLOCKED BEFORE APPLY

- **First run:** reached `installed-ready-verified`; the create-once installed checkpoint became
  visible 132 ms after the immediate lookup failed closed.
- **First blocker:** `C:\Users\Liiiraa\VM-Lab\Evidence\phase6\20260816-015122-clean-vm-BLOCKED.json`,
  SHA-256 `23765fcf6356c426c09810b0c0283f0fc87dfcebff47ffadcc6e7b81d88ce319`, 1261 bytes.
- **Recovery run:** exact blocker/checkpoint binding passed, but PowerShell Direct did not become
  ready within the former 60-second boundary after restoring and starting the installed snapshot.
- **Recovery blocker:** `C:\Users\Liiiraa\VM-Lab\Evidence\phase6\20260816-115722-clean-vm-BLOCKED.json`,
  SHA-256 `1a7c6377b12149c8767a1b482518de0429491024835cd419d63c6208e541c271`, 870 bytes.
- **APPLY prompt:** never reached; no `managed-power-scheme-v57-APPLY-PROMPT-READY.json` exists.
- **Cleanup:** exact VM verified `Off`; clean checkpoint GUID
  `a918f5c0-ade0-4bac-bca3-baa91686777e` and installed checkpoint GUID
  `52bf64b5-dfd4-4fd4-9d0b-d859ee411528` were preserved.
- **Correction:** RED `14522428`, GREEN `ed529a1c`; PowerShell Direct now polls for a bounded 180
  seconds, reports credential rejection separately, and always restores the exact VM to `Off`.

The blocked v57 operation was not retried. Its immutable artifact, deterministic admission, and
both physical blockers remain historical evidence; only the next monotonic version may proceed.

---

## Operation `managed-power-scheme-v58` — DETERMINISTIC SIMULATION ADMITTED

- **Physical provenance:** not claimed
- **Human review:** not claimed
- **Owner/friends consent:** not claimed
- **Physical PASS:** not claimed
- **Command:** `rtk pnpm phase6:simulate -- --artifact-manifest-from-summary .planning/phases/06-transactional-plans-and-recovery/06-31-SUMMARY.md --minimum-version managed-power-scheme-v58`
- **Artifact manifest SHA-256:** `2f407cc28495c09fdc8513c4dfd670749ba7b429d6133713af384f603e8aa888`
- **Run evidence SHA-256:** `ee3f5275a39982715f5e38a731ed9a1617de9163f05963e68a0a5a23c1ff0e5f`
- **Evidence manifest SHA-256:** `c74c3dd1bbe10949597fa938f4330856f6e6b3e18515468bf8ee4c84c772d90e`

### Exact command output

```json
{
  "operationVersion": "managed-power-scheme-v58",
  "buildId": "physical-9f5464923978c943-managed-power-scheme-v58",
  "artifactManifestSha256": "2f407cc28495c09fdc8513c4dfd670749ba7b429d6133713af384f603e8aa888",
  "runEvidenceSha256": "ee3f5275a39982715f5e38a731ed9a1617de9163f05963e68a0a5a23c1ff0e5f",
  "evidenceManifestSha256": "c74c3dd1bbe10949597fa938f4330856f6e6b3e18515468bf8ee4c84c772d90e",
  "highestAdmittedStage": "deterministic-simulation",
  "requirementsCoverage": [
    "PLAN-01",
    "PLAN-02",
    "PLAN-03",
    "PLAN-04",
    "PLAN-05",
    "PLAN-06",
    "PLAN-07",
    "PLAN-08"
  ]
}
```

---

## Operation `managed-power-scheme-v65` — DETERMINISTIC SIMULATION ADMITTED

- **Physical provenance:** not claimed
- **Human review:** not claimed
- **Owner/friends consent:** not claimed
- **Physical PASS:** not claimed
- **Command:** `rtk pnpm phase6:simulate -- --artifact-manifest-from-summary .planning/phases/06-transactional-plans-and-recovery/06-31-SUMMARY.md --minimum-version managed-power-scheme-v65`
- **Artifact manifest SHA-256:** `d1001ae367af98ab67ac022d0170dc1bbed8c351eb998a087ef2f06a016af7f0`
- **Run evidence SHA-256:** `0aa34013eb5d3314ba31daa9382f439442d7c85df3337230c648e8190689a649`
- **Evidence manifest SHA-256:** `788f6b5392365829659c008755c909903d50f99179f934d59e4fa12937f4432a`

### Exact command output

```json
{
  "operationVersion": "managed-power-scheme-v65",
  "buildId": "physical-7304c595be0d094e-managed-power-scheme-v65",
  "artifactManifestSha256": "d1001ae367af98ab67ac022d0170dc1bbed8c351eb998a087ef2f06a016af7f0",
  "runEvidenceSha256": "0aa34013eb5d3314ba31daa9382f439442d7c85df3337230c648e8190689a649",
  "evidenceManifestSha256": "788f6b5392365829659c008755c909903d50f99179f934d59e4fa12937f4432a",
  "highestAdmittedStage": "deterministic-simulation",
  "requirementsCoverage": [
    "PLAN-01",
    "PLAN-02",
    "PLAN-03",
    "PLAN-04",
    "PLAN-05",
    "PLAN-06",
    "PLAN-07",
    "PLAN-08"
  ]
}
```

---

## Operation `managed-power-scheme-v66` — DETERMINISTIC SIMULATION ADMITTED

- **Physical provenance:** not claimed
- **Human review:** not claimed
- **Owner/friends consent:** not claimed
- **Physical PASS:** not claimed
- **Command:** `rtk pnpm phase6:simulate -- --artifact-manifest-from-summary .planning/phases/06-transactional-plans-and-recovery/06-31-SUMMARY.md --minimum-version managed-power-scheme-v66`
- **Artifact manifest SHA-256:** `f5093c1e464ea8dd563197283a2bdb7cfac4c68f7f30d398f5e3d5dc76137f4f`
- **Run evidence SHA-256:** `faefe1cdfae5f546982ac31cdae3a627150d6a755e4de9d9b8a7fb1dd299bc64`
- **Evidence manifest SHA-256:** `d76fb46767e525647df47f2c03efc8cefe42dec5a20832b554e98d72d96f6584`

### Exact command output

```json
{
  "operationVersion": "managed-power-scheme-v66",
  "buildId": "physical-7304c595be0d094e-managed-power-scheme-v66",
  "artifactManifestSha256": "f5093c1e464ea8dd563197283a2bdb7cfac4c68f7f30d398f5e3d5dc76137f4f",
  "runEvidenceSha256": "faefe1cdfae5f546982ac31cdae3a627150d6a755e4de9d9b8a7fb1dd299bc64",
  "evidenceManifestSha256": "d76fb46767e525647df47f2c03efc8cefe42dec5a20832b554e98d72d96f6584",
  "highestAdmittedStage": "deterministic-simulation",
  "requirementsCoverage": [
    "PLAN-01",
    "PLAN-02",
    "PLAN-03",
    "PLAN-04",
    "PLAN-05",
    "PLAN-06",
    "PLAN-07",
    "PLAN-08"
  ]
}
```

---

## Operation `managed-power-scheme-v67` — DETERMINISTIC SIMULATION ADMITTED

- **Physical provenance:** not claimed
- **Human review:** not claimed
- **Owner/friends consent:** not claimed
- **Physical PASS:** not claimed
- **Command:** `rtk pnpm phase6:simulate -- --artifact-manifest-from-summary .planning/phases/06-transactional-plans-and-recovery/06-31-SUMMARY.md --minimum-version managed-power-scheme-v67`
- **Artifact manifest SHA-256:** `e2689db3ef625a3ef4b1d1bd3f7ad22278a0dc868d0eaedebd053fb0fc55984f`
- **Run evidence SHA-256:** `7e93a708b039cb5caaa8a4417ac6fe59189a274eb179afe75a3700995b481ce0`
- **Evidence manifest SHA-256:** `bfa8ddc06bab183857e653b1f44b0106c0e4707bc7e74a3752e89277340f92f4`

### Exact command output

```json
{
  "operationVersion": "managed-power-scheme-v67",
  "buildId": "physical-7304c595be0d094e-managed-power-scheme-v67",
  "artifactManifestSha256": "e2689db3ef625a3ef4b1d1bd3f7ad22278a0dc868d0eaedebd053fb0fc55984f",
  "runEvidenceSha256": "7e93a708b039cb5caaa8a4417ac6fe59189a274eb179afe75a3700995b481ce0",
  "evidenceManifestSha256": "bfa8ddc06bab183857e653b1f44b0106c0e4707bc7e74a3752e89277340f92f4",
  "highestAdmittedStage": "deterministic-simulation",
  "requirementsCoverage": [
    "PLAN-01",
    "PLAN-02",
    "PLAN-03",
    "PLAN-04",
    "PLAN-05",
    "PLAN-06",
    "PLAN-07",
    "PLAN-08"
  ]
}
```

### Physical execution disposition — BLOCKED

- The sole v67 physical attempt durably accepted the exact APPLY phrase, then timed out in the bounded `reboot-pending` guest-runner stage before any continuation or raw envelope existed.
- Immutable blocker: `C:\Users\Liiiraa\VM-Lab\Evidence\phase6\20260816-221445-clean-vm-BLOCKED.json`, SHA-256 `d7114726d3f4c14c4627d59e792323a87a4436e58b9761f414a93579ca115790`, reason `BLOCKED:guest-runner-total-deadline`.
- Cleanup-only evidence proves the exact VM returned to `Off`; installed checkpoint GUID `84b8d3b0-90d0-4850-8806-f373a28a38e9` and all evidence remain preserved. v67 is terminal and must not be retried.
- Safe read-only diagnosis observed no requested power-scheme mutation and localized the missing visibility to the inner `apply_until_reboot` call sequence. RED `b2bdc31e` / GREEN `b9aad639` introduce a bounded raw-free inner heartbeat for the next monotonic artifact.

---

## Operation `managed-power-scheme-v68` — DETERMINISTIC SIMULATION ADMITTED

- **Physical provenance:** not claimed
- **Human review:** not claimed
- **Owner/friends consent:** not claimed
- **Physical PASS:** not claimed
- **Command:** `rtk pnpm phase6:simulate -- --artifact-manifest-from-summary .planning/phases/06-transactional-plans-and-recovery/06-31-SUMMARY.md --minimum-version managed-power-scheme-v68`
- **Artifact manifest SHA-256:** `64f1cecd68757befba141cf3ff5179f6c6f693a9a1f6c29d9a9df9b094c25c9c`
- **Run evidence SHA-256:** `20b8feea9edb5d64fa26b04fa235f5ea2115b038df5e17381d078b5a859172ce`
- **Evidence manifest SHA-256:** `f4af847c37850010c0f3c4b024d2533a4e69efee2b837e4f579b478e2a3c0b9b`

### Exact command output

```json
{
  "operationVersion": "managed-power-scheme-v68",
  "buildId": "physical-9f82fde77bf2940f-managed-power-scheme-v68",
  "artifactManifestSha256": "64f1cecd68757befba141cf3ff5179f6c6f693a9a1f6c29d9a9df9b094c25c9c",
  "runEvidenceSha256": "20b8feea9edb5d64fa26b04fa235f5ea2115b038df5e17381d078b5a859172ce",
  "evidenceManifestSha256": "f4af847c37850010c0f3c4b024d2533a4e69efee2b837e4f579b478e2a3c0b9b",
  "highestAdmittedStage": "deterministic-simulation",
  "requirementsCoverage": [
    "PLAN-01",
    "PLAN-02",
    "PLAN-03",
    "PLAN-04",
    "PLAN-05",
    "PLAN-06",
    "PLAN-07",
    "PLAN-08"
  ]
}
```

### Physical execution disposition — BLOCKED

- The sole v68 physical attempt durably recorded prompt-ready and accepted-before-mutation, then timed out in the bounded `reboot-pending` runner stage.
- Immutable blocker: `C:\Users\Liiiraa\VM-Lab\Evidence\phase6\20260816-225812-clean-vm-BLOCKED.json`, SHA-256 `e7b6c94fbec21f3e51dd7e7cfa589c33448b788ddd8d98551e57a3f606a2661f`, exact reason `BLOCKED:guest-runner-total-deadline`.
- The bounded raw-free heartbeat identifies inner stage `webdriver-launch`; no raw WebDriver output, terminal physical evidence, or review was manufactured.
- Cleanup-only evidence proves VM `Off`; installed checkpoint GUID `84635905-a816-4b4e-9cdd-acb05b3c1dbf` and all evidence remain preserved. v68 is terminal and must not be retried.
- Causal RED `273ff42c` / GREEN `96882498` replace EOF waiting with a strict-cap `PeekNamedPipe` snapshot for the next monotonic artifact.

---

## Operation `managed-power-scheme-v69` — DETERMINISTIC SIMULATION ADMITTED

- **Physical provenance:** not claimed
- **Human review:** not claimed
- **Owner/friends consent:** not claimed
- **Physical PASS:** not claimed
- **Command:** `rtk pnpm phase6:simulate -- --artifact-manifest-from-summary .planning/phases/06-transactional-plans-and-recovery/06-31-SUMMARY.md --minimum-version managed-power-scheme-v69`
- **Artifact manifest SHA-256:** `600d63bf5c593d80200f1957c5f8da8c4712aaf23235ff26b61a761c92bb6596`
- **Run evidence SHA-256:** `8948c5e4380f4038d5fada4b6cc1bbe458372c3d1c5506ea46398de1a157d085`
- **Evidence manifest SHA-256:** `31ef01239e6ffc58a6c2e919764d8ba175191be80c6d692d20eb218782c6a398`

### Exact command output

```json
{
  "operationVersion": "managed-power-scheme-v69",
  "buildId": "physical-5a94c1dc1ae583b7-managed-power-scheme-v69",
  "artifactManifestSha256": "600d63bf5c593d80200f1957c5f8da8c4712aaf23235ff26b61a761c92bb6596",
  "runEvidenceSha256": "8948c5e4380f4038d5fada4b6cc1bbe458372c3d1c5506ea46398de1a157d085",
  "evidenceManifestSha256": "31ef01239e6ffc58a6c2e919764d8ba175191be80c6d692d20eb218782c6a398",
  "highestAdmittedStage": "deterministic-simulation",
  "requirementsCoverage": [
    "PLAN-01",
    "PLAN-02",
    "PLAN-03",
    "PLAN-04",
    "PLAN-05",
    "PLAN-06",
    "PLAN-07",
    "PLAN-08"
  ]
}
```
