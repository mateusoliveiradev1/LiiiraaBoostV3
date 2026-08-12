---
phase: 05-hardware-intelligence-and-measured-evidence
plan: '03'
subsystem: windows-inventory
tags: [rust, windows, inventory, privacy, lifecycle, sha256, read-only]
requires:
  - phase: 05-01
    provides: Generated hardware evidence contracts and validators
  - phase: 05-02
    provides: Immutable SQLite evidence authority
provides:
  - Unprivileged read-only Windows inventory orchestration
  - Native CPU, memory, GPU, display, storage, and Windows version evidence
  - Complete-or-explicitly-unavailable projections for every required hardware class
  - Versioned Windows lifecycle classification that fails closed
  - Purpose-bound stable identifiers without raw serial, MAC, or instance IDs
affects: [05-05, 05-06, 05-07, 05-08, 05-09]
tech-stack:
  added: []
  patterns: [native-readonly-boundary, complete-or-unavailable, purpose-bound-derived-id]
key-files:
  created:
    - apps/desktop/src-tauri/src/hardware_inventory.rs
    - apps/desktop/src-tauri/src/windows_lifecycle.rs
  modified:
    - apps/desktop/src-tauri/Cargo.toml
    - apps/desktop/src-tauri/src/main.rs
    - apps/desktop/src-tauri/tests/hardware_inventory.rs
key-decisions:
  - 'Native inventory remains unprivileged and read-only; unavailable evidence is explicit instead of fabricated.'
  - 'Windows support classification uses version, build, edition, channel, and policy date rather than marketing names.'
  - 'Protected hardware identifiers are purpose-bound SHA-256 derivations and never cross the native boundary raw.'
  - 'Cancellation bypasses native collection and every accepted snapshot is contract-validated before optional immutable persistence.'
requirements-completed: [DIAG-01, DIAG-02, DIAG-07]
duration: 18 min
completed: 2026-08-12
status: complete
---

# Phase 05 Plan 03: Privacy-Safe Windows Inventory Summary

**The desktop now has a real read-only Windows inventory boundary with native hardware evidence, explicit failure states, lifecycle policy, and immutable persistence support.**

## Accomplishments

- Added a bounded collector that emits all twelve required hardware classes as either observed or
  explicitly unavailable and validates the complete generated evidence contract.
- Added native Windows collection for CPU brand, physical memory, active GPU, current display mode,
  system-volume capacity, and authoritative OS build/edition evidence.
- Added a versioned lifecycle classifier for supported Windows 11, Windows 10 LTSC/ESU,
  unsupported consumer Windows 10, and unknown/contradictory evidence.
- Added purpose-bound derived hardware references while blocking raw serial numbers, MAC addresses,
  instance IDs, contradictory source values, and protected values embedded in display text.
- Linked accepted inventory snapshots to the existing immutable SQLite evidence store.

## Task Commits

1. `a52d958` — add failing hardware category, lifecycle, timeout, cancellation, and privacy matrices.
2. `5514b5b` — implement the native Windows inventory, lifecycle policy, redaction, validation, and persistence boundary.

## Verification

- Hardware inventory suite: 7/7 passed, including the platform-gated Windows smoke test.
- Desktop compilation: passed with no collector errors.
- Contract validation: every synthetic and native snapshot accepted.
- Privacy sentinel matrix: raw serial, MAC, PCI instance ID, and contradictory values absent.

## Known Baseline Gates Outside This Plan

- The full desktop suite still contains an older shell-contract assertion expecting five registered
  commands while the application already registers nine; the inventory module adds no command.
- Strict Clippy reaches two pre-existing `large_enum_variant` findings in generated contract code.

## Safety Boundaries Preserved

- No Docker, PowerShell inventory, generic registry RPC, elevation, or arbitrary command execution.
- Cancellation does not enter the native source boundary.
- Missing native sources remain visible and cannot silently become positive hardware claims.
- Raw protected identifiers are never persisted, serialized, or projected to React.

## Self-Check: PASSED

---

_Phase: 05-hardware-intelligence-and-measured-evidence_
_Completed: 2026-08-12_
