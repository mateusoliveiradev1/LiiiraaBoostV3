# Phase 5: Hardware Intelligence and Measured Evidence - Context

**Gathered:** 2026-08-12
**Status:** Ready for planning

<domain>
## Phase Boundary

Phase 5 replaces deterministic desktop diagnostic and measurement fixtures with a local, read-only Windows authority. It delivers typed hardware inventory, lifecycle and capability decisions, resource-bounded collection, append-oriented evidence, defensible comparison admission, and consistent offline reports without applying any optimization to the PC.

</domain>

<spec_lock>

## Requirements (locked via SPEC.md)

**13 requirements are locked.** See `05-SPEC.md` for full requirements, boundaries, and acceptance criteria.

Downstream agents MUST read `05-SPEC.md` before planning or implementing. Requirements are not duplicated here.

**In scope (from SPEC.md):** canonical TypeSpec contracts and generated TypeScript/Rust transports; read-only Windows inventory and measurement collectors; bounded scheduling; local SQLite evidence persistence; lifecycle, capability, freshness, quality, comparison, and claim decision engines; connection of existing desktop routes to native authority; bilingual accessible real-data states; deterministic CI traces and packaged Windows verification.

**Out of scope (from SPEC.md):** applying or reverting optimization changes; shipping the optimization catalog; broad launcher/game lifecycle automation; kernel drivers, injection, anti-cheat interference, firmware mutation, or arbitrary scripts; cloud-first raw telemetry storage; public performance marketing without separately approved evidence; Docker-based local infrastructure.

</spec_lock>

<decisions>
## Implementation Decisions

### Native collector boundary

- **D-01:** Start with an unprivileged read-only native collector. Introduce a narrowly authenticated privileged broker only for an individual source that proves elevation is required; do not run the desktop UI or the entire collector elevated.
- **D-02:** Every source has a typed capability declaration, deadline, cancellation path, health result, and explicit unavailable reason. Shell scripts and generic registry/file/service RPC methods are forbidden.
- **D-03:** Raw serials and other protected identifiers remain inside the native trust boundary. UI and persistence receive only redacted display values or stable derived identifiers appropriate to the stated purpose.

### Evidence persistence and retention

- **D-04:** SQLite is the sole local authority for inventory snapshots, capture sessions, sample chunks, comparisons, report metadata, and claim admission. Records are append-oriented; corrections produce new records rather than rewriting evidence history.
- **D-05:** Session metadata and integrity state commit transactionally. Interrupted captures remain `incomplete` and can be inspected or deleted, but never admitted to comparison.
- **D-06:** Dense samples are stored in bounded, versioned chunks with monotonic offsets, units, coverage, collector identity, and content hashes. Retention is enforced by explicit policy and never deletes evidence referenced by a retained comparison or report.

### Measurement scheduling and sources

- **D-07:** Use event-driven frame evidence where a supported collector can declare it reliable. Use bounded polling for utilization, thermals, and other hardware observations.
- **D-08:** During an active game, non-frame hardware polling is capped at 1 Hz. Every source has concurrency limits, deadlines, cancellation, backpressure, and measured CPU/memory overhead.
- **D-09:** Wall-clock timestamps are presentation metadata; durations and sample ordering use a monotonic clock. Clock discontinuities degrade quality and block affected comparisons rather than being smoothed or estimated.
- **D-10:** Unsupported workloads and unreliable metrics remain non-numeric `unavailable` evidence. The product must never synthesize FPS, thermals, latency, or quality values.

### Desktop authority transition

- **D-11:** Preserve the existing Measure routes and authored design-system components. Replace deterministic fixtures behind a typed desktop authority/provider instead of rewriting the complete UI.
- **D-12:** A production projection may contain observed/measured/unavailable values, but never fixture values. Fixture adapters remain available only in explicit development, Storybook, and deterministic test modes.
- **D-13:** Inventory, recommendation, baseline, capture, history, comparison, timeline, report, overhead, and degraded-coverage screens share stable evidence references so the user can inspect how each conclusion was formed.

### Comparison and report authority

- **D-14:** One pure comparison validator evaluates workload identity, environment fingerprint, methodology, duration, coverage, collector health, and evidence quality. It returns either an accepted immutable comparison or all blocking mismatch reason codes.
- **D-15:** One authoritative comparison projection feeds summary, detailed diff, timeline, accessible offline HTML, and schema-versioned JSON. Every representation carries the same comparison ID, values, provenance, limitations, and content hash.
- **D-16:** Claim admission references immutable, quality-approved comparison IDs. Revoked or degraded evidence immediately removes the claim from eligible product/export projections without deleting its audit history.

### Verification matrix

- **D-17:** CI owns contract regeneration drift, Rust/TypeScript conformance, SQLite migrations, decision-engine property tests, reference traces, fault injection, UI integration, accessibility, report schema/tamper checks, and deterministic resource-budget harnesses.
- **D-18:** Packaged physical Windows 10/11 runs remain an explicit release gate for real memory, idle CPU, cancellation, polling, source availability, and driver/edition coverage. CI simulations cannot be recorded as physical PASS evidence.
- **D-19:** Phase 5 may be planned and implemented while the remaining Phase 4 physical UAT is tracked, but Phase 5 cannot be declared release-complete by silently inheriting unverified Phase 4 physical gates.

### the agent's Discretion

The agent may choose internal crate/package names, normalized table names, chunk encoding, retention defaults, Windows API source order, and exact component composition as long as the locked requirements, budgets, privacy boundary, generated-contract rule, and decisions above remain satisfied.

</decisions>

<canonical_refs>

## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Scope and requirements

- `.planning/phases/05-hardware-intelligence-and-measured-evidence/05-SPEC.md` — locked Phase 5 requirements, boundaries, constraints, risks, and acceptance criteria.
- `.planning/REQUIREMENTS.md` — authoritative DIAG-01 through DIAG-07 and MEAS-01 through MEAS-06 traceability.
- `.planning/ROADMAP.md` — Phase 5 goal, dependencies, success criteria, and milestone placement.

### Contracts and desktop authority

- `packages/contracts-source/src/main.tsp` — canonical TypeSpec composition point.
- `packages/contracts-source/src/desktop-inspection.tsp` — existing desktop inspection contract precedent.
- `packages/contracts-source/src/provenance.tsp` — provenance vocabulary that real evidence must preserve.
- `packages/desktop-client/src/experience.ts` — current desktop client boundary and fixture qualification types.
- `apps/desktop/src-tauri/src/device_identity.rs` — existing privacy-protected native Windows evidence collector; reuse its boundary principles, not its licensing-only scope.
- `apps/desktop/src-tauri/tests/device_identity.rs` — native collector testing precedent.

### Existing product experience

- `packages/feature-shell/src/features/measure.tsx` — complete fixture-driven measurement routes and states to connect to real authority.
- `packages/design-system/src/evidence.tsx` — shared provenance, freshness, quality, unavailable, and evidence presentation primitives.
- `packages/design-system/src/data.tsx` — accessible telemetry, frame-time, and comparison visualization primitives.
- `packages/design-system/src/design-system.test.tsx` — semantic, accessibility, fixture-marker, and state-admission testing precedent.

</canonical_refs>

<code_context>

## Existing Code Insights

### Reusable Assets

- `MeasureFeature` in `packages/feature-shell/src/features/measure.tsx`: already supplies baseline, capture, history, comparison, diff, timeline, report, overhead, and degraded-coverage compositions; convert its data source rather than discarding the visual work.
- Evidence primitives in `packages/design-system/src/evidence.tsx`: reuse provenance marks, freshness stamps, quality signals, evidence tables, and unavailable states for observed data.
- `FrameTimePlot`, `TelemetryPlot`, and comparison UI in `packages/design-system/src/data.tsx`: retain accessible chart semantics while feeding normalized real series.
- `device_identity.rs`: reuse defensive Windows collection, privacy redaction, and native test patterns while keeping licensing identity separate from diagnostic inventory.

### Established Patterns

- Critical cross-process structures originate in TypeSpec and generate TypeScript/Rust transports; handwritten duplicate DTOs are not allowed.
- Product surfaces explicitly distinguish fixture, observed, measured, modeled, and unavailable provenance.
- Desktop UI stays non-elevated and communicates through narrow Tauri commands with runtime validation.
- Deterministic adapters and real adapters must satisfy the same contract/conformance suite.
- User-facing desktop state is bilingual, keyboard-operable, screen-reader semantic, reduced-motion aware, and fail-closed.

### Integration Points

- Extend `packages/contracts-source` with inventory/evidence domains and generated artifacts.
- Add native collector and persistence modules beneath `apps/desktop/src-tauri`, exposed through operation-specific Tauri commands.
- Add a real authority adapter in `packages/desktop-client` and connect it to `packages/feature-shell` routes.
- Extend the design-system only where existing evidence primitives cannot express real source health, coverage, or inspection links.
- Add deterministic traces and packaged Windows verification to existing Vitest, Rust, Playwright, and Tauri test tooling.

</code_context>

<specifics>
## Specific Ideas

- Treat collection overhead as first-class evidence recorded alongside every baseline and session, not a hidden engineering metric.
- Make every unavailable value explain itself and link to the responsible source/coverage state.
- Keep reports self-contained and useful offline, with human-readable HTML and machine-readable JSON derived from the same projection.
- Preserve the current premium authored visual language; Phase 5 is an authority transition, not another dashboard redesign.
- Do not install or require Docker.

</specifics>

<deferred>
## Deferred Ideas

- Transactional optimization apply/revert and recovery belong to Phase 6.
- Optimization catalogs and capability-gated domain operations belong to Phase 7.
- Broad launcher discovery and automatic game-session lifecycle integration belong to Phase 8.
- Cloud AI interpretation of local evidence belongs to Phase 9 and requires explicit consent.
- Production artifact signing, rollout, and the complete release matrix belong to Phase 10.

</deferred>

---

_Phase: 05-hardware-intelligence-and-measured-evidence_
_Context gathered: 2026-08-12_
