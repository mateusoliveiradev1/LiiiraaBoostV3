---
phase: 05-hardware-intelligence-and-measured-evidence
plan: '01'
subsystem: contracts
tags: [typespec, json-schema, typescript, rust, hardware, measurement, evidence]
requires:
  - phase: 01-product-truth-and-modular-contracts
    provides: Canonical TypeSpec generation and cross-language validation pipeline
provides:
  - Closed inventory evidence contract with all required hardware categories
  - Typed collector lifecycle, health, overhead, baseline, chunk, and session states
  - Mutually exclusive accepted and rejected comparison documents
  - Versioned report and claim admission documents with hashes, provenance, and limitations
  - Generated TypeScript and Rust transports plus standalone runtime validation
affects: [05-02, 05-03, 05-04, 05-05, 05-06, 05-07, 05-08, 05-09, 05-10]
tech-stack:
  added: []
  patterns: [closed-evidence-unions, typed-unavailability, generated-cross-language-transports]
key-files:
  created:
    - packages/contracts-source/src/hardware-evidence.tsp
    - packages/contracts-ts/src/hardware-evidence.test.ts
    - contracts/generated/desktop/v1/hardware-evidence.schema.json
  modified:
    - tooling/contract-generation/src/generate.ts
    - packages/contracts-ts/scripts/generate-standalone.mjs
    - packages/contracts-ts/src/generated/models.ts
    - crates/contracts-rust/src/generated.rs
key-decisions:
  - 'Every inventory class remains structurally required; absence is represented by a typed unavailable fact instead of deleting a category or inserting a numeric placeholder.'
  - 'Production hardware evidence admits observed and unavailable facts only; fixture provenance and raw identifier fields are absent from the contract.'
  - 'Completed, degraded, incomplete, and invalid measurement sessions use closed mutually exclusive shapes.'
  - 'Accepted comparisons contain one immutable result while rejected comparisons contain blocker codes, never both.'
requirements-completed: []
duration: 8 min
completed: 2026-08-12
status: complete
---

# Phase 05 Plan 01: Hardware Evidence Contracts Summary

**Phase 5 now has one generated, runtime-validated evidence language shared by TypeScript and Rust before any Windows collector or diagnostic UI is implemented.**

## Accomplishments

- Defined bounded TypeSpec contracts for inventory, collector execution, health, overhead,
  measurement baselines, metric chunks, lifecycle-specific sessions, comparisons, reports, and
  claim admissions.
- Made CPU, GPU, memory, storage, network, display, audio, USB, Windows, drivers, security, and
  games mandatory inventory categories while preserving honest typed unavailability.
- Excluded raw serial, hardware ID, and fixture-shaped production evidence from the canonical
  boundary.
- Added an owned standalone JSON Schema and validator, plus generated TypeScript and Rust models.
- Added compatibility mutation checks that fail if a category/document family disappears or a raw
  hardware identifier is introduced.

## Task Commits

1. `4718571` — add the failing hardware evidence contract corpus.
2. `33d13b2` — define the TypeSpec contract and generate TypeScript/Rust artifacts.
3. `92dc5b1` — guard hardware evidence generation and privacy drift.

## Verification

- Focused hardware evidence corpus: 11/11 tests passed.
- Full TypeScript contract suite: 82/82 tests passed.
- Rust contract suites: 11/11 tests passed across unit, corpus, provenance, and shell coverage.
- Contract compatibility baseline passed.
- Contract drift check passed for 12 owned artifacts.
- Contract generation ran twice consecutively; the second run produced no owned-file diff.

## Deviations

- The plan's initial file list did not name the generator registry, standalone-validator generator,
  emitted schema, declarations, generated index, or OpenAPI artifact. They were updated because the
  existing bounded generation pipeline refuses partial/unowned outputs and downstream transports
  must continue to be generated rather than handwritten.

## Safety Boundaries Preserved

- No Docker dependency or service was introduced.
- No raw stable machine identifier is transportable by this contract.
- Missing hardware and failed collection remain explicit states, never fabricated numbers.
- Runtime validators reject unknown fields, empty metric chunks, mixed comparison outcomes, and
  reports or claims without durable evidence references.

## Self-Check: PASSED

---

_Phase: 05-hardware-intelligence-and-measured-evidence_
_Completed: 2026-08-12_
