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
