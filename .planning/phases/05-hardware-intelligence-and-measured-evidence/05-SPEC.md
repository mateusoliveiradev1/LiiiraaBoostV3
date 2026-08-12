# Phase 5: Hardware Intelligence and Measured Evidence — Specification

**Created:** 2026-08-12
**Ambiguity score:** 0.17 (gate: ≤ 0.20)
**Requirements:** 13 locked

## Goal

Replace the desktop's deterministic hardware and measurement fixtures with a local, read-only Windows authority that inventories the actual PC, captures resource-bounded evidence, rejects invalid comparisons, and exposes provenance, quality, uncertainty, and collector overhead for every displayed result.

## Background

The desktop already has complete routes and visual states for calibration, inventory, baseline, capture, session history, comparison, diff, timeline, report preview, collector overhead, and degraded coverage. The shared design system already models provenance, freshness, quality, unavailable evidence, frame-time plots, comparison plots, and evidence tables. These surfaces deliberately identify their current values as deterministic fixtures.

Phase 4 added a narrow native Windows collector for privacy-preserving device binding. It admits only a small set of protected component classes and is not a user-visible hardware inventory or performance-measurement engine. No canonical Phase 5 contracts, SQLite evidence store, full Windows inventory authority, bounded game-session collector, comparison validator, or export authority exists yet.

## Requirements

1. **Complete local inventory (DIAG-01)**: The desktop inventories CPU, GPU, memory, storage, network, display, audio, USB, Windows build, drivers, security state, and installed games through read-only native collectors.
   - Current: UI routes and fixtures exist; the native device-binding collector exposes only a privacy-safe subset for licensing.
   - Target: Each inventory class produces typed observations with source, collection time, support status, quality, and redacted identifiers, persisted locally in SQLite.
   - Acceptance: On supported Windows fixtures and physical test PCs, every required class is either populated from a named native source or explicitly marked unavailable with a reason; no class silently disappears.

2. **Windows lifecycle classification (DIAG-02)**: Every inventory snapshot classifies the OS as supported Windows 11, Windows 10 LTSC/ESU, unsupported consumer Windows 10, or unknown.
   - Current: Scenario fixtures distinguish only generic Windows 10 and Windows 11 platforms.
   - Target: Classification uses edition, build, servicing channel, and lifecycle evidence rather than display-name matching.
   - Acceptance: Contract fixtures for all four states return the expected classification and dates; missing or contradictory lifecycle evidence returns `unknown`, never `supported`.

3. **Pre-recommendation warning gate (DIAG-03)**: Unsupported or unverified environments receive an explicit lifecycle/compatibility warning before any recommendation is shown as actionable.
   - Current: Warning components exist, but real inventory does not drive recommendation admission.
   - Target: The recommendation projection consumes the current inventory verdict and suppresses actionable recommendations until the warning is acknowledged and required evidence is valid.
   - Acceptance: Unsupported, unknown, stale, and contradictory environment fixtures expose the correct warning and zero actionable recommendations; a verified supported environment admits eligible recommendations.

4. **Capability-derived eligibility (DIAG-04)**: Recommendation eligibility is derived from typed capabilities and evidence freshness, never from CPU/GPU/PC marketing names or static model recipes.
   - Current: Phase 2 recommendation states are deterministic scenario data.
   - Target: A pure decision engine evaluates declared capability predicates against a versioned evidence snapshot and returns the supporting and blocking evidence references.
   - Acceptance: Renaming a device without changing capabilities cannot change eligibility, while changing a required capability or freshness state deterministically changes the verdict.

5. **Fail-closed evidence authority (DIAG-05)**: Unknown, stale, contradictory, corrupt, or unavailable evidence cannot become a compatible recommendation or accepted comparison.
   - Current: UI types represent these states, but no real authority enforces them across collection, persistence, and projection.
   - Target: Runtime validation and domain rules reject invalid evidence at every boundary and retain a bounded diagnostic reason.
   - Acceptance: Property and fault-injection tests prove that every invalid state produces a non-actionable verdict and no fallback estimate or optimistic success.

6. **Explainable compatibility verdicts (DIAG-06)**: Every operation projection states `compatible`, `unsupported`, `hidden`, or `experimental` and identifies the exact evidence and policy reason.
   - Current: The UI can render risk and evidence labels from fixtures.
   - Target: Each verdict includes stable reason codes, localized explanation, evidence references, freshness, and the policy tier that admitted or excluded it.
   - Acceptance: Tests cover all four verdicts and verify that the UI can navigate from the verdict to the referenced inventory evidence without exposing raw protected identifiers.

7. **Bounded read-only collection (DIAG-07)**: Inventory and sensor collection remain read-only, cancellable, and within explicit performance budgets, with non-frame sensor sampling reduced during active games.
   - Current: No production measurement scheduler or resource-budget enforcement exists.
   - Target: Collection has per-source deadlines, cancellation, concurrency limits, and measured overhead; the native background service remains at or below 25 MB RAM, averages at most 0.5% CPU while idle over five minutes, and non-frame hardware polling is capped at 1 Hz during an active game.
   - Acceptance: Automated budget tests plus packaged Windows measurements fail the build when memory, idle CPU, polling rate, deadline, or cancellation limits are exceeded.

8. **Reproducible system baseline (MEAS-01)**: A user can capture a baseline containing methodology version, timestamps, monotonic duration, environment identity, inventory snapshot reference, sample window, collector versions, quality, missing coverage, and measured overhead.
   - Current: The baseline route renders fixture metadata only.
   - Target: Starting a baseline creates an append-oriented local record only after all required metadata and integrity checks succeed.
   - Acceptance: A completed baseline reloads from SQLite with identical metadata and content hash; interrupted or invalid captures remain explicitly incomplete and cannot be comparison inputs.

9. **Reliable supported-session capture (MEAS-02)**: For explicitly supported local workloads, the product captures FPS, 1% lows, frame time, utilization, thermals, and latency-related evidence only when the responsible collector declares the metric reliable.
   - Current: Charts use deterministic fixture series and no native session collector exists.
   - Target: Event-driven frame evidence and bounded hardware samples are normalized into typed metric series with clock source, units, coverage, quality, and collector health.
   - Acceptance: Reference traces reproduce expected aggregates within documented tolerance; unavailable or unreliable metrics are marked unavailable rather than synthesized.

10. **Comparison admission (MEAS-03)**: Before/after comparison is accepted only when workload identity, environment fingerprint, methodology version, duration/sample requirements, collector health, and evidence quality are comparable.
    - Current: Valid and rejected comparison screens exist, but use predetermined fixture outcomes.
    - Target: A deterministic comparison validator returns either an accepted comparison with matched dimensions or a rejection containing every blocking mismatch.
    - Acceptance: Pairwise fixtures cover each rejection reason and prove that changing any required comparison dimension blocks the comparison while equivalent sessions remain accepted.

11. **Honest degraded coverage (MEAS-04)**: Every session and comparison exposes uncertainty, missing coverage, degraded capture, unsupported workload, clock discontinuity, and collector failure without fabricated estimates.
    - Current: Degraded and unavailable visual states exist but are fixture-driven.
    - Target: Quality is calculated from recorded coverage and health evidence; unavailable values contain no numeric placeholder that can be mistaken for a measurement.
    - Acceptance: Fault-injection tests for permission denial, source loss, thermal-source absence, clock jump, sample gap, and collector termination render bounded non-numeric states and reject affected comparisons when required.

12. **Inspectable comparison and export (MEAS-05)**: Accepted sessions can be reviewed through summary, detailed diff, timeline, and a portable technical report containing the same authoritative values and provenance.
    - Current: All four UI views exist as deterministic previews; there is no export authority.
    - Target: One comparison projection feeds every view and exports human-readable HTML plus machine-readable JSON with schema version and content hash.
    - Acceptance: Summary, diff, timeline, HTML, and JSON resolve to the same comparison ID and metrics; generated reports reopen offline and pass schema, accessibility, and tamper-detection checks.

13. **Evidence-gated claims (MEAS-06)**: Performance claims can reference only reproducible, quality-approved comparisons with immutable evidence references and explicit limitations.
    - Current: No claim-admission authority connects product copy to measured evidence.
    - Target: A claim registry rejects unapproved, non-reproducible, degraded, stale, or missing comparison evidence and stores the admitted methodology and limitation text.
    - Acceptance: Tests prove that only approved comparison IDs can create a claim projection and that revoking evidence quality removes the claim from eligible in-product and export projections.

## Boundaries

**In scope:**

- Canonical TypeSpec contracts and generated TypeScript/Rust transports for inventory, evidence, baselines, sessions, comparisons, reports, quality, and collector health.
- Read-only Windows collectors and a bounded scheduler for the inventory and measurement classes named by DIAG-01 and MEAS-02.
- Local SQLite migrations, integrity checks, bounded retention, and append-oriented persistence for snapshots, sessions, samples, comparisons, and report metadata.
- Pure capability, lifecycle, freshness, quality, comparison-admission, and claim-admission decision engines.
- Connecting the existing desktop inventory and Measure routes to real native authority with complete loading, permission, unsupported, stale, contradictory, partial, and recovery states.
- PT-BR and English presentation, keyboard operation, screen-reader semantics, reduced motion, scalable layouts, and WCAG 2.2 AA verification for the real data paths.
- Deterministic adapters and reference traces for CI, plus packaged Windows 10/11 verification on the supported matrix.

**Out of scope:**

- Applying, reverting, or scheduling optimization changes — Phase 6 owns transactional plans and recovery.
- Shipping the optimization catalog or claiming performance gains for an operation — Phase 7 owns verified optimization promotion.
- Broad launcher discovery, automatic game activation, profile composition, or anti-cheat integration — the Games and Profiles phase owns those behaviors; Phase 5 captures only explicitly supported workloads.
- Cloud telemetry upload, remote diagnostics, or cross-user benchmarking — local evidence is the authority in this phase and cloud sharing remains consent-bound future work.
- Kernel drivers, code injection, game-file modification, overlays inside game processes, or anti-cheat interference — prohibited by the project security boundary.
- Public marketing publication of claims — this phase builds claim admission and evidence references, not a public campaign surface.

## Constraints

- Windows 10 and Windows 11 only; unsupported consumer Windows 10 must remain inspectable but fail closed for recommendations.
- Native collection uses documented Windows APIs, ETW/performance counters, WMI/CIM only where bounded, and vendor-neutral sources where possible; arbitrary PowerShell or generic remote scripts are prohibited.
- Raw stable hardware identifiers remain inside the native Windows boundary. React, cloud APIs, logs, reports, and exports receive only user-readable properties or protected/redacted references.
- SQLite is the local source of truth for evidence. Tauri Store, browser storage, flat mutable JSON, PostgreSQL, and Valkey cannot substitute for local transactional evidence.
- All untrusted or persisted documents are runtime-validated against generated contracts before use.
- The background service target is at most 25 MB RAM with near-zero idle work; the executable UI retains the existing startup and memory budgets.
- Frame evidence must use a monotonic clock. Wall-clock changes cannot alter sample ordering or comparison duration.
- Collection is read-only and cancellation-safe; a collector timeout or crash cannot block app startup, game exit, restoration, or Windows shutdown.
- No Docker dependency is introduced for development or verification.

## Acceptance Criteria

- [ ] All 13 DIAG/MEAS requirements have generated contracts, runtime validators, domain tests, native integration tests, UI tests, and explicit evidence owners.
- [ ] A packaged build inventories every DIAG-01 class on supported Windows, with unavailable classes shown explicitly rather than omitted.
- [ ] Windows lifecycle fixtures and physical tests distinguish Windows 11, Windows 10 LTSC/ESU, unsupported consumer Windows 10, and unknown.
- [ ] Invalid, stale, contradictory, corrupt, or unavailable evidence never produces an actionable recommendation, accepted comparison, or admitted claim.
- [ ] Baselines and completed sessions survive restart from SQLite with matching schema version, metadata, provenance, and content hash.
- [ ] Supported reference traces produce reproducible FPS, 1% low, frame-time, utilization, thermal, and available latency aggregates within documented tolerances.
- [ ] Every required comparison mismatch is rejected with a complete user-visible reason list; accepted comparisons use one authoritative projection across all views and exports.
- [ ] Permission loss, source loss, clock discontinuity, sample gaps, unsupported workloads, collector crashes, and cancellation produce honest degraded/unavailable states without estimates.
- [ ] HTML and JSON reports reopen offline, share one comparison identity, pass validation and accessibility checks, and detect tampering.
- [ ] Packaged resource measurements meet the 25 MB service memory target, ≤0.5% five-minute idle CPU average, and ≤1 Hz non-frame polling during an active game.
- [ ] PT-BR and English real-data flows pass keyboard, screen-reader, zoom, reduced-motion, contrast, and status-not-by-color gates.
- [ ] Static privacy scans and packaged runtime probes find no raw stable hardware identifier in React, browser storage, logs, exports, network traffic, or cloud persistence.
- [ ] Phase verification records exact Windows/build/hardware identities and never promotes fixture-only or unsupported evidence as a physical measurement.

## Ambiguity Report

| Dimension           |    Score |       Min | Status | Notes                                                                |
| ------------------- | -------: | --------: | :----: | -------------------------------------------------------------------- |
| Goal Clarity        |     0.90 |      0.75 |   ✓    | Roadmap and 13 requirements define observable user outcomes.         |
| Boundary Clarity    |     0.76 |      0.70 |   ✓    | Optimization, broad game integration, and cloud work are excluded.   |
| Constraint Clarity  |     0.78 |      0.65 |   ✓    | Platform, privacy, persistence, clocks, and budgets are explicit.    |
| Acceptance Criteria |     0.86 |      0.70 |   ✓    | Every requirement has a falsifiable authority and failure condition. |
| **Ambiguity**       | **0.17** | **≤0.20** | **✓**  | Weighted clarity passes the specification gate.                      |

Status: ✓ = met minimum, ⚠ = below minimum (planner treats as assumption)

## Interview Log

The user explicitly requested automatic progression, so the workflow used `--auto` decisions grounded in the roadmap, requirements, existing fixture UI, native device-binding collector, and project security/performance constraints.

| Round | Perspective     | Question summary                                    | Decision locked                                                                                |
| ----- | --------------- | --------------------------------------------------- | ---------------------------------------------------------------------------------------------- |
| Auto  | Researcher      | What exists and what is missing?                    | Preserve the finished fixture UI; replace fixture authority with native collection and SQLite. |
| Auto  | Simplifier      | What is the irreducible Phase 5 product?            | Inventory, baseline, supported-session capture, comparison validation, and export.             |
| Auto  | Boundary Keeper | Which adjacent capabilities stay out?               | No optimization execution, catalog promotion, broad game automation, or cloud benchmarking.    |
| Auto  | Failure Analyst | What failures must invalidate evidence?             | Stale/unknown/contradictory data, clock faults, gaps, collector failure, and budget overruns.  |
| Auto  | Seed Closer     | What makes completion objective rather than visual? | Physical Windows evidence, persisted hashes, resource budgets, privacy scans, and E2E gates.   |

---

_Phase: 05-hardware-intelligence-and-measured-evidence_
_Spec created: 2026-08-12_
_Next step: $gsd-discuss-phase 5 — implementation decisions (how to build what is specified above)_
