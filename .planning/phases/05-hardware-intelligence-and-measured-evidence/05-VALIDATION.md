---
phase: 5
slug: hardware-intelligence-and-measured-evidence
status: approved
nyquist_compliant: true
wave_0_complete: false
created: 2026-08-12
---

# Phase 5 - Validation Strategy

> Feedback contract for native inventory, bounded capture, evidence persistence, comparison admission, and desktop presentation.

## Test Infrastructure

| Property                 | Value                                                                   |
| ------------------------ | ----------------------------------------------------------------------- |
| Frameworks               | Cargo test/nextest, Vitest, Playwright + axe, Tauri/WebDriver           |
| Rust workspace           | `Cargo.toml` and `apps/desktop/src-tauri/Cargo.toml`                    |
| TypeScript workspace     | `pnpm-workspace.yaml`, package-local Vitest configs                     |
| Browser E2E              | `apps/desktop/tests/browser`                                            |
| Quick run                | owning package `pnpm --filter ... test` or `cargo test -p ... <module>` |
| Full deterministic suite | `pnpm check` plus workspace Rust tests and desktop browser gates        |
| Physical suite           | packaged Windows 10/11 collector and resource-budget matrix             |

## Sampling Rate

- After every task: run the narrow owning package/module suite.
- After every plan: run all affected Rust and TypeScript packages plus contract drift.
- After every wave: run full deterministic desktop checks.
- Before phase verification: deterministic suite green and physical-gate record explicit.
- Maximum normal feedback latency: 120 seconds; longer physical checks run as separate named gates.

## Per-Plan Verification Map

| Plan  | Requirements                           | Threat focus                                    | Automated evidence                                             |
| ----- | -------------------------------------- | ----------------------------------------------- | -------------------------------------------------------------- |
| 05-01 | DIAG-01..07, MEAS-01..06               | malformed/cross-boundary evidence               | TypeSpec drift, TS/Rust conformance, invalid corpus            |
| 05-02 | DIAG-05, MEAS-01, MEAS-03..06          | corruption, tamper, unsafe retention            | migration/restart/interruption/hash/retention tests            |
| 05-03 | DIAG-01, DIAG-02, DIAG-07              | raw identifier disclosure, unbounded collection | source trait, redaction, timeout, lifecycle fixtures           |
| 05-04 | DIAG-03..06, MEAS-03, MEAS-04, MEAS-06 | optimistic fallback and policy bypass           | unit, table, property, contradiction/freshness corpus          |
| 05-05 | DIAG-07, MEAS-01, MEAS-02, MEAS-04     | resource exhaustion and unreliable metrics      | scheduler/fault/reference-trace/budget harness tests           |
| 05-06 | MEAS-03..06                            | divergent exports and claim laundering          | projection equivalence, schema, accessibility, tamper tests    |
| 05-07 | DIAG-01..07, MEAS-01..06               | fixture leakage and unsafe UI admission         | adapter conformance, UI integration, axe, visual, locale tests |
| 05-08 | all                                    | false physical evidence and release bypass      | packaged probes, privacy scan, matrix evidence audit           |

## Wave 0 Requirements

- [ ] Add checked reference traces and failure corpus without raw user hardware identifiers.
- [ ] Add temporary SQLite authority test helpers and migration fixtures.
- [ ] Add deterministic clock, cancellation, and resource-meter fakes.
- [ ] Add production composition tests proving fixture provenance is refused.
- [ ] Add packaged Windows evidence manifest format recording OS build, hardware class, collector version, and whether evidence is simulated or physical.

## Required Fault Injection

- Permission denied and source unavailable.
- Deadline, cancellation, collector crash, and queue saturation.
- Invalid PDH status, missing metric, sample gap, and clock discontinuity.
- Stale/contradictory inventory and unknown lifecycle.
- Database busy, interrupted commit, corrupted chunk, and hash mismatch.
- Unsupported workload and unreliable frame source.
- Report tamper and retained-reference deletion attempt.

## Manual-Only Verifications

| Behavior                                            | Requirement                        | Why manual/physical                                          | Instructions                                                                                                                |
| --------------------------------------------------- | ---------------------------------- | ------------------------------------------------------------ | --------------------------------------------------------------------------------------------------------------------------- |
| Actual source coverage on Windows 10/11 hardware    | DIAG-01, DIAG-02                   | driver/hardware matrix cannot be faithfully simulated        | run packaged collector, record exact OS/build/device classes, confirm every category is populated or explicitly unavailable |
| Five-minute idle CPU and service memory             | DIAG-07                            | requires packaged process on physical Windows                | record process CPU average and peak/steady memory using the signed evidence harness                                         |
| Active-game polling cap and frame collection impact | DIAG-07, MEAS-02                   | scheduler interaction with a real supported workload         | capture a supported local workload, verify non-frame polling <=1 Hz and record collector overhead                           |
| Assistive technology walkthrough                    | DIAG-03, DIAG-06, MEAS-04, MEAS-05 | automated semantics do not prove screen-reader comprehension | keyboard and Narrator walkthrough in PT-BR and English at 150%/200% scaling                                                 |

These gates remain explicit and cannot be converted into automated PASS by fixture output.

## Validation Sign-Off

- [x] Every planned requirement has deterministic automated coverage.
- [x] No three consecutive implementation tasks may omit an automated check.
- [x] Missing infrastructure is named as Wave 0 work.
- [x] Commands are non-watch and bounded.
- [x] Physical-only gates are isolated and cannot be confused with CI evidence.
- [x] `nyquist_compliant: true` is set.

**Approval:** approved 2026-08-12
