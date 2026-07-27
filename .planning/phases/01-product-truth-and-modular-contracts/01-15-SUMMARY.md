---
phase: 01-product-truth-and-modular-contracts
plan: "15"
subsystem: contracts
tags:
  - typescript
  - rust
  - typify
  - json-schema-to-typescript
  - deterministic-generation
requires:
  - phase: 01-product-truth-and-modular-contracts
    plan: "13"
    provides: Spike-proven deterministic Typify generation and semantic normalization
  - phase: 01-product-truth-and-modular-contracts
    plan: "14"
    provides: Canonical production schema-generation orchestrator and normalized runtime artifacts
provides:
  - One production command that generates TypeScript and Rust transports
  - Explicit generated-only TypeScript package export
  - Public Rust transport crate generated without handwritten DTO repair
  - Deterministic schema-to-language staging with atomic owned writes
affects:
  - 01-16-contract-compatibility
  - 01-18-runtime-contract-validation
tech-stack:
  added:
    - json-schema-to-typescript 15.0.4
    - typify 0.7.0 production generator
  patterns:
    - One cached canonical TypeSpec compilation feeds ordered schema, TypeScript, and Rust stages
    - Language transports carry normalized read-only provenance headers
    - Rust transport generation uses a temporary canonical schema and captures formatted stdout before atomic commit
key-files:
  created:
    - packages/contracts-ts/package.json
    - packages/contracts-ts/src/generated/index.ts
    - packages/contracts-ts/src/generated/models.ts
    - tooling/contract-generation-rust/Cargo.toml
    - tooling/contract-generation-rust/src/main.rs
    - crates/contracts-rust/Cargo.toml
    - crates/contracts-rust/src/lib.rs
    - crates/contracts-rust/src/generated.rs
  modified:
    - tooling/contract-generation/src/generate.ts
    - tooling/contract-generation/src/node-shim.d.ts
    - tooling/contract-generation/package.json
    - architecture/module-boundaries.json
    - Cargo.toml
    - Cargo.lock
    - pnpm-lock.yaml
key-decisions:
  - "Expose TypeScript transports only through the explicit ./generated package entry; validator exports remain reserved for Plan 01-18."
  - "Keep date-time semantics in canonical JSON Schema while representing Rust transport fields as strings; Plan 01-18 runtime validation remains the enforcement boundary."
  - "Generate schemas, TypeScript, then Rust in one failure-propagating command and atomically replace only the exact owned outputs."
requirements-completed:
  - FOUND-01
  - FOUND-03
duration: 12 min
completed: 2026-07-27
---

# Phase 01 Plan 15: Production Transport Generation Summary

**A single deterministic command now emits compiling TypeScript and Rust transports from the canonical TypeSpec artifacts, with generated-only public boundaries and no handwritten DTO repair.**

## Performance

- **Duration:** 12 min
- **Started:** 2026-07-27T01:46:00-03:00
- **Completed:** 2026-07-27T01:58:00-03:00
- **Tasks:** 3
- **Files modified:** 15

## Accomplishments

- Added `json-schema-to-typescript` to the production generator and exposed immutable-by-policy generated transports through `@liiiraa/contracts-ts/generated`.
- Promoted the spike-proven Typify normalization flow into a production Rust generator and public `liiiraa-contracts-rust` crate.
- Wired schema, TypeScript, and Rust stages into the root `pnpm contracts:generate` command with deterministic ordering, failure propagation, temporary staging, and atomic owned writes.
- Proved repeated generation is byte-stable and passed the complete JavaScript/TypeScript and Cargo workspace gates.

## Task Commits

1. **Task 01-15-01: Generate and expose TypeScript transports** — `2b9cab1`
2. **Task 01-15-02: Implement and expose Rust transport generation** — `1dcf719`
3. **Task 01-15-03: Wire both languages into one production command** — `ad273ee`
4. **Verification fix: Satisfy generator lint gate** — `6888e4f`

## Files Created/Modified

- `packages/contracts-ts/package.json` — Explicit generated transport package entry and compile gates.
- `packages/contracts-ts/src/generated/index.ts` — Generated-only TypeScript public surface.
- `packages/contracts-ts/src/generated/models.ts` — Generated TypeScript transport declarations.
- `tooling/contract-generation-rust/Cargo.toml` — Exact-pinned production Typify generator crate.
- `tooling/contract-generation-rust/src/main.rs` — Fail-closed schema normalization and deterministic rustfmt generation.
- `crates/contracts-rust/Cargo.toml` — Public generated Rust transport crate.
- `crates/contracts-rust/src/lib.rs` — Generated transport re-exports without domain behavior.
- `crates/contracts-rust/src/generated.rs` — Generated Rust transport declarations.
- `tooling/contract-generation/src/generate.ts` — Ordered cross-language orchestration and atomic output ownership.
- `tooling/contract-generation/src/node-shim.d.ts` — Narrow child-process typing for Rust stage execution.
- `tooling/contract-generation/package.json` — Approved TypeScript generator dependency.
- `Cargo.toml`, `Cargo.lock`, `pnpm-lock.yaml` — Reproducible workspace registration and dependency resolution.
- `architecture/module-boundaries.json` — Active generated-package ownership and Rust generator ownership.

## Decisions Made

- Kept TypeScript validator exports out of this plan; only generated transports are reachable from the package export map.
- Preserved `format: date-time` in canonical JSON Schema while the Rust transport uses a string, matching the established rule that complete constraints are enforced by runtime schema validation before deserialization.
- Used a temporary message-envelope schema for Typify so Rust output is derived from the current in-memory canonical compilation, never a stale checked-in artifact.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 2 - Missing Critical Functionality] Normalize the production date-time representation for Typify**

- **Found during:** Task 01-15-02
- **Issue:** Production contracts include `format: date-time`; Typify generated `chrono` references, but `chrono` is not an approved Phase 1 dependency and transport types do not own full runtime constraint validation.
- **Fix:** Fail closed on unknown formats and normalize only the recognized `date-time` format to a Rust string transport while leaving the canonical schema unchanged.
- **Verification:** Both generator and generated transport crates compile from clean regeneration.
- **Committed in:** `1dcf719`

**2. [Rule 3 - Blocking] Register production Cargo members and architecture ownership**

- **Found during:** Task 01-15-02 and Task 01-15-03 verification
- **Issue:** New production crates were not Cargo workspace members, and the live Cargo architecture adapter rejected the Rust generator as `UNKNOWN_OWNER`.
- **Fix:** Registered both crates, activated generated contract ownership, and added exact Rust generator module ownership.
- **Verification:** Cargo workspace checks and all 23 architecture policy tests pass.
- **Committed in:** `1dcf719`, `ad273ee`

**3. [Rule 1 - Bug] Remove unnecessary TypeScript assertion rejected by lint**

- **Found during:** Root verification
- **Issue:** The generated schema object already satisfied the compiler input type, so the strict lint gate rejected a redundant assertion.
- **Fix:** Passed the schema directly without weakening types.
- **Verification:** Root `pnpm verify` passes.
- **Committed in:** `6888e4f`

---

**Total deviations:** 3 auto-fixed (1 missing critical functionality, 1 blocking issue, 1 bug)

## Issues Encountered

- Typify maps JSON Schema date-time formats to `chrono` types. The production generator now applies one explicit, fail-closed transport normalization and continues to rely on the canonical schema validation boundary planned in 01-18.

## Verification

- `rtk pnpm contracts:generate` — passed; 7 normalized artifacts emitted.
- `rtk pnpm --filter @liiiraa/contracts-ts check` — passed.
- `rtk cargo check -p contract-generation-rust` — passed.
- `rtk cargo check -p liiiraa-contracts-rust` — passed.
- `rtk cargo check --workspace --all-targets` — passed.
- Repeated `rtk pnpm contracts:generate` — passed with no generated diff.
- `rtk pnpm test:architecture` — passed; 23/23 policy tests.
- `rtk pnpm verify` — passed, including generation, checks, tests, and builds.

## Next Phase Readiness

- Plan 01-16 can consume byte-stable canonical and transport outputs for compatibility gates.
- Plan 01-18 can add runtime validators at untrusted boundaries without changing transport ownership.
- No blockers remain.

## Self-Check: PASSED

- All eight declared production transport artifacts exist.
- TypeScript and Rust generated transports compile without handwritten repair.
- One root command regenerates both languages deterministically.
- All implementation commits are present.
- Cargo workspace and root verification gates pass.

---
_Phase: 01-product-truth-and-modular-contracts_
_Completed: 2026-07-27_
