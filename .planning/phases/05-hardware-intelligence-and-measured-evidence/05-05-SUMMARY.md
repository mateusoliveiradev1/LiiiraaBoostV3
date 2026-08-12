---
phase: 05-hardware-intelligence-and-measured-evidence
plan: '05'
subsystem: measurement
tags: [rust, windows, qpc, telemetry, evidence, sqlite, backpressure]
requires:
  - phase: 05-02
    provides: Transactional evidence store and immutable chunk lifecycle
  - phase: 05-03
    provides: Privacy-safe Windows inventory evidence
  - phase: 05-04
    provides: Fail-closed evidence admission policy
provides:
  - Bounded baseline and supported-session capture state machine
  - Native Windows QPC clock and CPU/memory counter adapter
  - Event-driven frame aggregation with FPS, frame-time, percentile, and 1% low summaries
  - Honest degraded, invalid, cancelled, incomplete, and completed evidence states
  - Atomic incomplete-to-completed persistence through EvidenceStore
affects: [05-06, 05-07, 05-08, 05-09, desktop-overview]
tech-stack:
  added: [Win32-System-Performance, Win32-System-Threading]
  patterns: [monotonic-capture, bounded-polling, nonnumeric-unreliable-metrics, atomic-evidence]
key-files:
  created:
    - apps/desktop/src-tauri/src/measurement.rs
    - apps/desktop/src-tauri/tests/measurement.rs
    - apps/desktop/src-tauri/tests/fixtures/measurement/reference-traces.json
  modified:
    - apps/desktop/src-tauri/Cargo.toml
    - apps/desktop/src-tauri/src/main.rs
key-decisions:
  - 'Frame evidence is admitted event-by-event while every non-frame metric is limited to at most one accepted sample per second.'
  - 'Permission loss, invalid counter status, missing values, and source loss remain nonnumeric and degrade the capture instead of inventing estimates.'
  - 'A monotonic clock discontinuity invalidates the capture and removes all comparison chunks.'
  - 'Native Windows collection uses QPC for ordering and documented Win32 system counters without injection or elevation.'
requirements-completed: [DIAG-07, MEAS-01, MEAS-02, MEAS-04]
duration: 16 min
completed: 2026-08-12
status: complete
---

# Phase 05 Plan 05: Bounded Windows Measurement Summary

**The desktop now has a real, resource-bounded measurement foundation instead of decorative telemetry: Windows-native timing and counters feed durable evidence whose reliability is explicit.**

## Accomplishments

- Added deterministic frame aggregation for average frame time, average FPS, p95, and 1% low.
- Added a scheduler that keeps frames event-driven while enforcing the one-hertz ceiling for
  CPU, GPU, memory, thermal, and latency observations.
- Added a capture state machine with source deadlines, monotonic ordering, cancellation,
  backpressure, bounded buffers, coverage, methodology, overhead, and quality evidence.
- Added native Windows QPC timing, CPU utilization from `GetSystemTimes`, and memory usage from
  `GlobalMemoryStatusEx` without broad privileges.
- Kept unsupported frame sources explicitly unavailable; no FPS or GPU value is synthesized.
- Connected incomplete and completed captures to the transactional SQLite evidence store.

## Task Commits

1. `95008db` — add failing measurement trace corpus.
2. `25ae4a4` — implement bounded Windows measurement capture.

## Verification

- Measurement suite: 8/8 passed, including a native Windows QPC/memory smoke test.
- Measurement plus evidence-store integration: 15/15 passed.
- `cargo check -p liiiraa-desktop` passed with zero errors.
- The reference corpus reproduces the declared FPS, p95 frame time, and 1% low values.

## Safety Boundaries Preserved

- Polling cannot exceed the declared resource budget.
- Invalid or unavailable sources never produce numeric evidence.
- Clock jumps and backpressure are visible rather than silently reordered or discarded.
- Cancellation is idempotent and acknowledged within the bounded test budget.
- No Docker, injection, generic remote execution, or administrator-wide UI is involved.

## Self-Check: PASSED

---

_Phase: 05-hardware-intelligence-and-measured-evidence_
_Completed: 2026-08-12_
