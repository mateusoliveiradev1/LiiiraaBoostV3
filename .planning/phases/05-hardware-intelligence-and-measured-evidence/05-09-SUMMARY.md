---
phase: 05-hardware-intelligence-and-measured-evidence
plan: '09'
subsystem: desktop-measurement-experience
tags: [react, tauri, evidence, accessibility, playwright, responsive-ui]
requires:
  - phase: 05-08
    provides: Typed immutable desktop evidence authority
provides:
  - Production desktop routes backed by native evidence authority
  - Honest observed, unavailable, stale, capture, cancellation, and completion states
  - Responsive and keyboard-accessible Phase 5 evidence workspace
affects: [05-10, desktop-measurement, phase-6-plans]
tech-stack:
  added: []
  patterns: [authority-driven-surface, explicit-finish-vs-cancel, retained-truth-on-refresh]
key-files:
  created:
    - apps/desktop/tests/browser/measurement-authority.spec.ts
  modified:
    - packages/feature-shell/src/features/measure.tsx
    - packages/desktop-client/src/evidence.ts
    - apps/desktop/src/app.tsx
    - apps/desktop/src/index.ts
    - apps/desktop/src/routes-approved.css
key-decisions:
  - 'Production measurement routes receive only the native Tauri evidence authority; deterministic evidence requires an explicit browser-test composition marker.'
  - 'Completing a capture persists a finalized session while cancellation only interrupts and clears the active capture.'
  - 'Unavailable hardware facts never receive placeholder numbers and a failed refresh retains the last admitted snapshot as stale and non-actionable.'
requirements-completed: [DIAG-01, DIAG-02, DIAG-03, DIAG-04, DIAG-05, DIAG-06, MEAS-01, MEAS-02, MEAS-03, MEAS-04, MEAS-05, MEAS-06]
duration: 24 min
completed: 2026-08-12
status: complete
---

# Phase 05 Plan 09: Native Measurement Experience Summary

**The desktop now exposes real Windows inventory and measurement authority through the authored Phase 5 routes, with explicit completion, cancellation, stale-data, and unavailable-evidence behavior.**

## Accomplishments

- Connected the shipping desktop entrypoint and Measure routes to the typed Tauri evidence authority.
- Added a visible Measurements goal to the primary desktop navigation.
- Preserved deterministic evidence only behind the explicit browser-test composition marker and kept its DEMO provenance visible.
- Rendered all twelve inventory classes as observed or honestly unavailable without numeric placeholders.
- Kept the last truthful inventory visible but non-actionable when refresh fails.
- Added separate actions for finishing and saving a capture versus cancelling collection.
- Preserved capture form inputs through refresh, start, finish, and cancellation.
- Added bounded responsive layouts, keyboard focus, live status, 150% app scale, 200% text, narrow viewport, PT-BR, reduced-motion, forced-color, axe, and screenshot coverage.

## Task Commits

1. `43d3839` — add failing native measurement UI truth.
2. `12dba49` — connect desktop measurement authority.

## Verification

- Feature-shell TypeScript check passed.
- Feature-shell Vitest suite: 91/91 passed across 6 files.
- Desktop-client Vitest suite: 20/20 passed across 4 files.
- Desktop app TypeScript check passed.
- Desktop app and production-entrypoint tests: 16/16 passed.
- Targeted Playwright authority matrix: 5/5 passed with axe and screenshot assertions.
- Production Vite build passed.
- Targeted Rust evidence tests: 8 passed.
- `git diff --check` passed.

## Deviations

- Added the desktop-client package as a direct desktop dependency because the production entrypoint now owns the native evidence authority.
- Corrected the capture lifecycle during verification: the previous single stop action cancelled collection, so the final UI now exposes distinct finish-and-save and cancel actions.

## Self-Check: PASSED

---

_Phase: 05-hardware-intelligence-and-measured-evidence_
_Completed: 2026-08-12_
