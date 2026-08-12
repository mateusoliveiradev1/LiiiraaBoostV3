---
phase: 05-hardware-intelligence-and-measured-evidence
plan: '11'
subsystem: native-live-telemetry
tags: [windows, tauri, rust, telemetry, evidence, desktop]
requires:
  - phase: 05-10
    provides: Packaged Windows evidence admission and final phase gate
provides:
  - Native bounded CPU and memory telemetry from the current Windows PC
  - Real hardware authority on the production desktop overview
  - Capture polling through the same audited evidence boundary
  - Honest unavailable states for sources that are not yet admitted
affects: [phase-6-plans, desktop-overview, measurement-capture]
key-files:
  created:
    - apps/desktop/src/native/live-telemetry.ts
    - apps/desktop/src-tauri/src/live_telemetry.rs
  modified:
    - apps/desktop/src-tauri/src/main.rs
    - apps/desktop/src-tauri/src/evidence_commands.rs
    - packages/desktop-client/src/evidence.ts
    - packages/feature-shell/src/features/measure.tsx
    - apps/desktop/src/surfaces/premium-operations-production.tsx
    - apps/desktop/src/surfaces/premium-operations.tsx
key-decisions:
  - 'The production desktop may display only readings returned by the native Windows authority; scenario and fixture payloads are rejected.'
  - 'Live sampling is bounded below one hertz and stops with the capture lifecycle.'
  - 'GPU utilization remains explicitly unavailable until a native source is admitted; no estimate or decorative number is substituted.'
requirements-completed: [DIAG-03, DIAG-04, DIAG-06, MEAS-01, MEAS-02, MEAS-03]
completed: 2026-08-12
status: complete
---

# Phase 05 Plan 11: Native Live Telemetry Closure Summary

**The desktop overview and measurement capture now read the current Windows PC through a strict native authority instead of displaying demonstration telemetry.**

## Accomplishments

- Added exact Tauri commands for live telemetry reads and measurement samples, with strict TypeScript validation that rejects fixtures, scenarios and unknown fields.
- Added native Windows CPU sampling through `GetSystemTimes` and memory sampling through `GlobalMemoryStatusEx`, including a truthful warm-up state for the first CPU interval.
- Routed capture polling through the audited evidence command boundary at approximately 0.91 Hz, with immediate cancellation when capture stops or the view unmounts.
- Replaced hard-coded production hardware and telemetry values on both desktop overview surfaces with refreshed native evidence.
- Kept GPU utilization explicitly unavailable because no admitted native utilization collector exists yet.
- Rebuilt the production Vite application and the Windows NSIS installer with the native authority included.

## Task Commits

1. `03bb9a6` — expose the missing native telemetry authority through failing tests.
2. `1f4afb8` — connect native Windows live telemetry to the desktop and capture flow.
3. `bd1fb91` — admit bounded live capture polling in the packaged browser flow.

## Verification

- `pnpm phase5:verify -- --mode final`: passed.
- Final evaluator: `ok=true`, `automatedOk=true`, `currentPcAdmitted=true`, zero diagnostics.
- Desktop application: 155/155 tests passed.
- Desktop client: 20/20 tests passed.
- Feature shell: 91/91 tests passed.
- Rust desktop authority: 130/130 tests passed, including physical CPU and memory reads from this Windows PC.
- Measurement Playwright flow: 5/5 passed.
- Production Vite builds and packaged Tauri/NSIS artifacts: passed.
- Five-minute physical probe: 12.277 MB peak working set, 0% idle CPU, 0 Hz idle polling, 100 ms cancellation acknowledgement and no raw hardware identifiers crossing the boundary.

## Release Boundary

- Phase 5 implementation is complete and Phase 6 may begin.
- `releaseReady=false` remains intentional until the named Windows 10/notebook/Intel/storage/network physical matrix and Phase 4 public signing gates are collected.
- This status prevents unsupported public compatibility claims; it does not replace or invalidate the admitted current-PC implementation.

## Self-Check: PASSED

---

_Phase: 05-hardware-intelligence-and-measured-evidence_
_Completed: 2026-08-12_
