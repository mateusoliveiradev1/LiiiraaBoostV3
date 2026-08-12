---
phase: 05-hardware-intelligence-and-measured-evidence
plan: '08'
subsystem: desktop-evidence-authority
tags: [typescript, tauri, evidence, validation, immutable-state, truth-boundary]
requires:
  - phase: 05-07
    provides: Narrow native Tauri evidence commands
provides:
  - One typed immutable evidence authority for native and deterministic composition
  - Generated runtime validation before evidence enters React state
  - Recursive production refusal of fixture provenance
  - Stable stale-data and selection behavior during refresh and cancellation
affects: [05-09, desktop-evidence-ui, measure-routes]
tech-stack:
  added: []
  patterns: [single-authority-projection, generated-boundary-validation, abortable-native-command]
key-files:
  created:
    - packages/desktop-client/src/evidence.ts
    - packages/desktop-client/src/evidence.test.ts
  modified:
    - packages/desktop-client/src/conformance.test.ts
    - packages/desktop-client/src/index.ts
    - packages/contracts-ts/src/index.ts
key-decisions:
  - 'Native and deterministic adapters share one authority implementation and differ only by their explicit origin and injected command transport.'
  - 'Every evidence document is validated by the generated hardware contract before it can replace admitted UI state.'
  - 'Native composition recursively rejects fixture markers at any nested path and never falls back to deterministic evidence.'
requirements-completed: [DIAG-01, DIAG-03, DIAG-04, DIAG-05, DIAG-06, MEAS-01, MEAS-02, MEAS-03, MEAS-04, MEAS-05, MEAS-06]
duration: 14 min
completed: 2026-08-12
status: complete
---

# Phase 05 Plan 08: Desktop Evidence Authority Summary

**The authored desktop experience now has one validated authority for real Windows inventory, measurement, comparison, reporting, and export without any production fixture fallback.**

## Accomplishments

- Added exact typed bindings for all nine native evidence commands from Plan 05-07.
- Reused one immutable projection and subscription model for real Tauri and explicit deterministic test composition.
- Validated every inventory, session, comparison, and report through the generated hardware-evidence validator before admission.
- Preserved the last admitted inventory as visible but non-actionable while refresh is pending or fails.
- Preserved before/after selections during revalidation and ignored late native responses after cancellation.
- Recursively rejected nested fixture provenance in native composition with a stable error code and JSON path.
- Publicly exported the generated hardware validator from the contracts package instead of duplicating DTO validation.

## Task Commits

1. `fa9e351` — add failing evidence adapter conformance.
2. `c550b71` — add typed desktop evidence authority.

## Verification

- Desktop-client TypeScript check passed.
- Desktop-client Vitest suite: 20/20 passed across 4 files.
- Hardware contract TypeScript check passed.
- Hardware evidence contract suite: 11/11 passed.
- `evidence.ts` contains 679 lines, exceeding the 300-line authority artifact requirement.
- `git diff --check` passed.

## Deviations

- Added the missing public value export for `hardwareEvidenceDocumentValidator` in the contracts package. The generated validator already existed; the package root exposed it only as a type, which prevented the required runtime boundary validation.
- Tightened the existing hardware-evidence test fixture literals so the newly public validator remains type-safe under strict TypeScript.

## Self-Check: PASSED

---

_Phase: 05-hardware-intelligence-and-measured-evidence_
_Completed: 2026-08-12_
