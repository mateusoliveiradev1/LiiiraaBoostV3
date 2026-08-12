# Phase 5: Hardware Intelligence and Measured Evidence - Research

**Researched:** 2026-08-12  
**Scope:** Native Windows inventory, bounded measurement, SQLite evidence authority, comparison admission, and desktop integration

## Executive Summary

Phase 5 should be implemented as a local evidence pipeline, not as a collection of UI-specific queries. The reliable shape is: narrow native sources produce typed observations; a bounded scheduler records health and overhead; append-oriented SQLite transactions preserve normalized snapshots and sample chunks; pure policy engines derive lifecycle, capability, quality, comparison, and claim verdicts; one desktop authority projects those records into the already-authored inventory and Measure routes.

The existing fixture UI is valuable and should remain the visual baseline. The main architectural work is replacing fixture authority while retaining explicit provenance, unavailable states, keyboard semantics, and the production ban on fixture evidence. No Docker service is required.

## Recommended Architecture

```text
documented Windows APIs / ETW / counters
                 |
       source-specific collectors
                 |
  deadline + cancellation + health + budget
                 |
     validated generated transport types
                 |
 append-oriented SQLite evidence authority
                 |
 lifecycle / capability / quality / comparison policies
                 |
      one desktop evidence projection
                 |
 inventory + baseline + capture + compare + report UI
```

### Trust boundaries

- Keep raw stable hardware identifiers inside Rust and derive purpose-bound references before persistence or projection.
- Keep the React process non-elevated. A privileged broker is justified only for an individual source that cannot be collected safely otherwise.
- Validate generated contract types before storage and again when reopening persisted or exported evidence.
- Treat collector availability and permission as evidence. Never turn a missing source into a numeric estimate.

## Windows Collection Sources

| Evidence class        | Preferred source                                                               | Fallback / note                                                                                       |
| --------------------- | ------------------------------------------------------------------------------ | ----------------------------------------------------------------------------------------------------- |
| CPU, memory, OS build | documented Win32 system APIs and bounded CIM/WMI queries                       | WMI is useful for static inventory, not for high-frequency sampling                                   |
| GPU and display       | SetupAPI/Configuration Manager plus display APIs                               | `Win32_VideoController` can be incomplete or inaccurate on modern WDDM systems; record source quality |
| Storage               | SetupAPI/Configuration Manager and storage device APIs                         | WMI may supplement readable model/media properties                                                    |
| Network adapters      | `GetAdaptersAddresses` and adapter properties                                  | protect MAC/stable adapter identifiers before crossing the native boundary                            |
| Audio endpoints       | Core Audio MMDevice enumeration and device property store                      | model active/unavailable endpoints explicitly                                                         |
| USB and drivers       | SetupAPI/Configuration Manager device properties                               | never expose raw serials to React, logs, reports, or cloud surfaces                                   |
| Security state        | documented Windows Security Center / Defender status surfaces                  | unknown or unavailable must fail closed; Phase 5 performs no mutation                                 |
| Utilization           | PDH counters with `CStatus` validation                                         | localize counter lookup correctly and record counter/source identity                                  |
| Frame presentation    | ETW-based supported collector, with PresentMon as the reference implementation | reliability and permission must be declared per workload/metric                                       |
| Duration and ordering | `QueryPerformanceCounter`                                                      | wall clock is presentation metadata only                                                              |

### Source constraints

- PDH consumers must validate returned counter status before using formatted values.
- ETW frame capture is event-driven and can require additional privilege for complete process information; permission denial is a first-class unavailable state.
- PresentMon documents limitations for some frame metrics and applications. Admit only metrics whose collector reports reliable coverage.
- WMI classes are appropriate for bounded static discovery but are not authoritative for every modern driver/display detail.
- Windows lifecycle classification belongs in a versioned local policy table keyed by edition, build, servicing channel, and evidence dates. It must not depend on a live web call or display-name matching.

## Persistence Model

Use `rusqlite` plus `rusqlite_migration` with WAL, foreign keys, explicit busy/transaction timeouts, and startup integrity checks. Suggested authority tables:

- `inventory_snapshots` and `inventory_observations`
- `collector_runs` and `collector_health_events`
- `capture_sessions` and `sample_chunks`
- `comparisons` and `comparison_blockers`
- `report_artifacts`
- `claim_admissions` and `claim_revocations`
- `retention_leases` for evidence referenced by a comparison/report

Dense time series should be chunked by bounded sample count or duration. Each chunk carries schema version, metric identity, unit, monotonic start/offsets, coverage, collector version, compression/encoding identifier, byte length, and content hash. Session completion is a separate transactional transition; interrupted sessions remain `incomplete`.

WAL improves concurrent read/write behavior but does not replace application integrity rules. Run `PRAGMA foreign_keys=ON`, verify the migration version, and use `quick_check` on normal startup with a deeper `integrity_check` in diagnostics/recovery tooling.

## Package Legitimacy Audit

| Package              | Pin                              | Registry/source evidence                                                                                                                                             | Status   | Reason                                                                  |
| -------------------- | -------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------- | ----------------------------------------------------------------------- |
| `rusqlite`           | `=0.40.1` compatibility baseline | official [crates.io](https://crates.io/crates/rusqlite) package; current registry patch checked during research                                                      | VERIFIED | established SQLite binding selected by the approved stack               |
| `rusqlite_migration` | `=2.6.0`                         | official [crates.io](https://crates.io/crates/rusqlite_migration) package and [docs.rs](https://docs.rs/rusqlite_migration/latest/rusqlite_migration/) documentation | VERIFIED | explicit migration runner selected by the approved stack                |
| `windows`            | existing `=0.62.2`               | official Microsoft crate already pinned in `apps/desktop/src-tauri/Cargo.toml`                                                                                       | VERIFIED | extend feature flags only; do not replace the established Win32 binding |
| `sha2`               | existing `=0.10.9`               | existing audited workspace dependency                                                                                                                                | VERIFIED | reuse for canonical content hashes; no additional hash dependency       |

No npm package installation, Docker image, hosted collector, or unreviewed binary dependency is required by the plan.

## Domain Engines

Implement these as pure Rust decision modules with generated transport inputs and table/property-driven tests:

1. Lifecycle classifier: `supported-windows-11 | windows-10-ltsc-esu | unsupported-windows-10-consumer | unknown`.
2. Freshness and contradiction evaluator: returns exact reason codes and evidence references.
3. Capability eligibility engine: evaluates predicates, never marketing names.
4. Metric quality engine: derives coverage, discontinuity, health, and reliability verdicts.
5. Comparison admission: evaluates all required dimensions and returns every blocker in stable order.
6. Claim admission: requires an immutable approved comparison and carries explicit limitations.

Decision outputs must be stable, localized through message keys rather than localized inside Rust, and navigable back to redacted evidence.

## Scheduler and Resource Budgets

- Inventory sources run on demand or on an explicit slow refresh policy, never continuously by default.
- Frame evidence is event-driven for a user-started supported capture.
- Hardware polling uses a token/budget scheduler and is capped at 1 Hz while a game capture is active.
- Every source has deadline, cancellation token, concurrency cap, bounded queue, and a health result.
- Record collector CPU, memory, dropped samples, queue depth, deadline misses, and cancellation latency with each run.
- The packaged verification gate measures the actual service against the 25 MB memory and five-minute idle CPU budgets. Simulated CI results are never labeled physical evidence.

## Desktop Integration

Preserve `MeasureSurface`, the existing routes, and design-system evidence components. Introduce a typed authority/provider that supplies route projections and commands:

- refresh inventory
- start/cancel baseline
- start/cancel supported capture
- list/open sessions
- request comparison admission
- export accepted report
- inspect source health and overhead

Production composition rejects fixture provenance exactly as it does today. Explicit test/Storybook composition keeps deterministic traces. Loading should retain the prior admitted snapshot rather than blanking the page; stale data must be visibly stale and non-actionable where policy requires.

## Report Strategy

Create one canonical comparison projection, then render both self-contained accessible HTML and schema-versioned JSON from it. Hash the canonical JSON payload and embed the comparison ID, schema version, methodology, evidence references, provenance, quality, and limitations in both representations. Reports reopen offline and never contain raw stable identifiers.

## Pitfalls to Avoid

- Treating WMI output as universally authoritative.
- Polling every sensor at UI refresh frequency.
- Mixing wall-clock timestamps into duration or ordering.
- Recomputing summary, diff, timeline, and export separately.
- Deleting evidence that is still referenced by a report or admitted claim.
- Displaying `0`, `--`, or a fabricated estimate for unavailable metrics without semantic status.
- Allowing a collector timeout to block app startup, capture cancellation, game exit, or Windows shutdown.
- Making live internet availability a prerequisite for local inventory or lifecycle verdicts.

## Validation Architecture

### Fast feedback layers

| Layer                  | Framework                                           | Target                                                           |
| ---------------------- | --------------------------------------------------- | ---------------------------------------------------------------- |
| Contract/source drift  | TypeSpec generation and checked artifacts           | every contract task                                              |
| Pure policy engines    | Rust unit + property tests                          | lifecycle, freshness, quality, comparison, claims                |
| SQLite authority       | Rust integration tests in temporary local databases | migration, restart, interruption, tamper, retention              |
| Native source adapters | Rust fixture/fault tests behind source traits       | status mapping, timeout, cancellation, redaction                 |
| Desktop authority      | Vitest conformance tests                            | real and deterministic adapters share projections                |
| UI/accessibility       | Vitest + Playwright + axe                           | real-data states, keyboard, zoom, reduced motion, bilingual copy |
| Reference traces       | checked deterministic ETW/PDH-derived corpora       | aggregation tolerance and degraded coverage                      |
| Packaged Windows       | Tauri/WebDriver and measurement scripts             | physical availability, privacy, CPU, memory, cancellation        |

### Sampling policy

- Run the owning Rust or TypeScript package test after each task.
- Run contract generation drift and full Rust/desktop suites after each wave.
- Keep deterministic CI under roughly two minutes per wave by separating physical resource measurements.
- Physical Windows 10/11 evidence is a release gate recorded with exact build and hardware identity, not an excuse to block all local implementation.

### Required fault corpus

Permission denial, source absent, source timeout, collector crash, cancellation, queue saturation, sample gap, clock discontinuity, counter invalid status, database busy, interrupted transaction, corrupted chunk, stale lifecycle policy, contradictory capabilities, unsupported workload, report tamper, and retention pressure.

## Official References

- [Microsoft: Acquiring high-resolution time stamps](https://learn.microsoft.com/en-us/windows/win32/sysinfo/acquiring-high-resolution-time-stamps)
- [Microsoft: Using PDH functions to consume counter data](https://learn.microsoft.com/en-us/windows/win32/perfctrs/using-the-pdh-functions-to-consume-counter-data)
- [Microsoft: GetAdaptersAddresses](https://learn.microsoft.com/en-us/windows/win32/api/iphlpapi/nf-iphlpapi-getadaptersaddresses)
- [Microsoft: Enumerating audio devices](https://learn.microsoft.com/en-us/windows/win32/coreaudio/enumerating-audio-devices)
- [Microsoft: Core Audio device properties](https://learn.microsoft.com/en-us/windows/win32/coreaudio/device-properties)
- [Microsoft: SetupAPI and Configuration Manager device properties](https://learn.microsoft.com/en-us/windows-hardware/drivers/install/using-setupapi-and-configuration-manager-to-access-device-properties)
- [Microsoft: Win32_VideoController](https://learn.microsoft.com/en-us/windows/win32/cimwin32prov/win32-videocontroller)
- [Microsoft: Event Tracing for Windows](https://learn.microsoft.com/en-us/windows-hardware/test/wpt/event-tracing-for-windows)
- [GameTechDev: PresentMon](https://github.com/GameTechDev/PresentMon)
- [Microsoft: Windows release information](https://learn.microsoft.com/en-us/windows/release-health/release-information)
- [Microsoft: Extended Security Updates FAQ](https://learn.microsoft.com/en-us/lifecycle/faq/extended-security-updates)
- [SQLite: Write-Ahead Logging](https://www.sqlite.org/wal.html)
- [SQLite: integrity_check](https://www.sqlite.org/pragma.html#pragma_integrity_check)
- [rusqlite_migration documentation](https://docs.rs/rusqlite_migration/latest/rusqlite_migration/)

---

_Research complete: 2026-08-12_
