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
