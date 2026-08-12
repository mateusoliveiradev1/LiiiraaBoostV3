---
phase: 05-hardware-intelligence-and-measured-evidence
plan: '10'
subsystem: phase-evidence-admission
tags: [windows, tauri, rust, evidence, physical-probe, release-gate]
requires:
  - phase: 05-09
    provides: Native measurement experience and production evidence authority
provides:
  - Machine-verifiable deterministic and physical evidence distinction
  - Packaged Rust authority probe with privacy-safe hardware summaries
  - Automated Phase 5 final admission command
  - Honest current-PC resource evidence and external matrix ledger
affects: [phase-6-plans, release-readiness, physical-matrix]
key-files:
  created:
    - tooling/phase5-evidence/src/evaluate.ts
    - tooling/phase5-evidence/src/windows-probe.ps1
    - tooling/phase5-evidence/evidence-manifest.schema.json
    - apps/desktop/src-tauri/src/phase5_probe.rs
    - .planning/phases/05-hardware-intelligence-and-measured-evidence/05-UAT.md
  modified:
    - apps/desktop/src-tauri/src/main.rs
    - package.json
key-decisions:
  - 'A deterministic run can satisfy automated gates but can never satisfy a packaged physical requirement.'
  - 'The packaged probe enters before Tauri creates a WebView, executes the same native EvidenceAuthority used by the app, and emits no raw hardware values.'
  - 'Phase 5 implementation can close with one admitted current PC while external matrix cells remain explicit and keep public release readiness false.'
requirements-completed: [DIAG-01, DIAG-02, DIAG-03, DIAG-04, DIAG-05, DIAG-06, DIAG-07, MEAS-01, MEAS-02, MEAS-03, MEAS-04, MEAS-05, MEAS-06]
completed: 2026-08-12
status: complete
---

# Phase 05 Plan 10: Evidence Admission Summary

**Phase 5 now has a fail-closed admission barrier that distinguishes deterministic coverage from real packaged Windows evidence and names every remaining physical release gap.**

## Accomplishments

- Added a strict manifest schema and evaluator for artifact provenance, OS/build identity, all twelve hardware classes, source coverage, resource budgets, cancellation, privacy and report integrity.
- Added eleven evaluator tests covering spoofed physical evidence, missing sources, over-budget processes, raw identifier leakage, hash tampering and Phase 4 gap isolation.
- Added `pnpm phase5:verify -- --mode final` as the repeatable no-Docker phase gate.
- Added `--phase5-probe` to the packaged executable. It executes the shipping Rust authority before opening a window, refreshes the real native inventory, starts and cancels a capture, emits only state/source summaries and remains alive for the physical resource sample.
- Admitted the current Windows 11 build for five minutes at 12.363 MB peak working set, 0% measured idle CPU, 0 Hz background polling and 100 ms cancellation acknowledgement.
- Preserved the Windows 10/notebook/Intel/storage/network/game/Narrator matrix and Phase 4 signing/recovery gaps as pending rather than simulated PASS.

## Task Commits

1. `3fc2be0` — add failing evidence admission matrix.
2. `05147e4` — automate deterministic and packaged evidence admission.
3. `7227e9f` — preserve the packaged probe process receipt.

## Verification

- `pnpm phase5:verify -- --mode final`: passed.
- Evaluator: 11/11 passed.
- Contract drift: 12 artifacts passed.
- Desktop client: 20/20 passed.
- Feature shell: 91/91 passed.
- Targeted Playwright: 5/5 passed.
- Production Vite build: passed.
- Packaged Windows physical evaluator: `ok=true`, `automatedOk=true`, `currentPcAdmitted=true`, zero diagnostics.
- Public release readiness remains intentionally false while the named external matrix and Phase 4 release gates are pending.

## Deviations

- Added a narrow packaged-executable probe because terminating the desktop process would measure process shutdown, not the native capture authority's cancellation contract.
- Kept unobserved hardware classes unavailable instead of filling them from parallel PowerShell values; only the shipping Rust boundary decides inventory truth.

## Self-Check: PASSED

---

_Phase: 05-hardware-intelligence-and-measured-evidence_
_Completed: 2026-08-12_

