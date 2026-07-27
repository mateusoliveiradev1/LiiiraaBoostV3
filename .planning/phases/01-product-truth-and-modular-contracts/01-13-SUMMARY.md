---
phase: 01-product-truth-and-modular-contracts
plan: '13'
subsystem: contracts
tags:
  - rust
  - typify
  - json-schema
  - serde
  - deterministic-generation
requires:
  - phase: 01-product-truth-and-modular-contracts
    plan: '04'
    provides: Deterministic TypeSpec JSON Schema spike and shared vector matrix
  - phase: 01-product-truth-and-modular-contracts
    plan: '11'
    provides: Pinned Rust workspace and resolver-3 toolchain contract
provides:
  - Deterministic Typify 0.7.0 Rust generation from the exact persisted TypeSpec schema
  - Compiling generated Rust proof with literal version and provenance rejection
  - Rust runtime validation parity over the unchanged shared accepted/rejected vectors
  - Final ADR for production TypeSpec-to-Rust generation
affects:
  - 01-05-production-contract-source
  - 01-15-production-contract-generation
  - 01-18-runtime-contract-validation
tech-stack:
  added:
    - typify 0.7.0
    - serde 1.0.229
    - serde_json 1.0.151
    - jsonschema 0.49.1
  patterns:
    - Fail-closed in-memory JSON Schema compatibility normalization
    - Pinned rustfmt formatting without persisted generated-code repair
    - Runtime schema validation before generated transport deserialization
key-files:
  created:
    - tooling/contract-generation-spike-rust/Cargo.toml
    - tooling/contract-generation-spike-rust/src/main.rs
    - tooling/contract-generation-spike-rust/tests/generation.rs
    - architecture/decisions/0001-contract-generation-spike.md
  modified:
    - Cargo.toml
    - Cargo.lock
    - .gitignore
    - architecture/module-boundaries.json
key-decisions:
  - 'Approve TypeSpec JSON Schema 2020-12 to Typify 0.7.0 with only verified semantics-preserving in-memory normalization.'
  - 'Translate bundled bare refs, object closure, and string consts before Typify; never patch generated Rust.'
  - 'Require Rust jsonschema validation for numeric and collection bounds Typify transport types do not enforce.'
requirements-completed:
  - FOUND-01
  - FOUND-03
duration: 12 min
completed: 2026-07-27
status: complete
---

# Phase 01 Plan 13: Rust Contract Generation Parity Summary

**Typify now deterministically emits compiling Rust from the exact regenerated TypeSpec schema, preserves critical discriminators, and shares the complete runtime-validation vector matrix.**

## Performance

- **Duration:** 12 min
- **Started:** 2026-07-27T00:49:00-03:00
- **Completed:** 2026-07-27T01:00:36-03:00
- **Tasks:** 2
- **Files created/modified:** 8

## Accomplishments

- Added a pinned Rust generator crate that reads the persisted TypeSpec bundle, rejects unsupported representations, applies three semantics-preserving in-memory mappings, emits Typify output, and formats it with the pinned Rust toolchain.
- Proved byte-stable generation, generated-source compilation, valid round-trip serialization, unknown version rejection, and unknown provenance rejection.
- Added Rust `jsonschema` validation over all five accepted and ten rejected shared TypeSpec vectors.
- Deleted the persisted schema and proved the exact TypeSpec-before-Cargo command recreates identical bytes.
- Closed ADR 0001 with exact versions, representation, semantic matrix, regeneration order, ownership, rejection criteria, and production adoption decision.

## Task Commits

TDD work was committed in RED, GREEN, and focused refactor order:

1. **Task 01-13-01 RED: Add failing Rust generation parity proof** — `a959109` (`test`)
2. **Task 01-13-01 GREEN: Generate deterministic Rust contract types** — `92433f2` (`feat`)
3. **Task 01-13-01 REFACTOR: Prove shared Rust validation vectors** — `e015b4e` (`refactor`)
4. **Task 01-13-02: Close the Rust contract generator decision** — `bc9f6cb` (`docs`)
5. **Verification fix: Register Rust generator spike ownership** — `8b28fc5` (`fix`)

## Files Created/Modified

- `tooling/contract-generation-spike-rust/Cargo.toml` — Exact approved generator, Serde, and runtime-validation dependencies.
- `tooling/contract-generation-spike-rust/src/main.rs` — Fail-closed schema normalization, Typify generation, and deterministic rustfmt stage.
- `tooling/contract-generation-spike-rust/tests/generation.rs` — Determinism, compilation, discriminator, unsupported-keyword, and shared-vector proofs.
- `architecture/decisions/0001-contract-generation-spike.md` — Final evidence-backed generator ADR.
- `Cargo.toml` — Real Rust spike workspace member.
- `Cargo.lock` — Reproducible Rust dependency resolution.
- `.gitignore` — Rust workspace target output exclusion.
- `architecture/module-boundaries.json` — Explicit active tooling ownership for the Rust spike crate.

## Decisions Made

- Accepted TypeSpec JSON Schema 2020-12 → Typify 0.7.0 as the production Rust transport path.
- Kept the emitted bundled schema unchanged on disk. Bare bundled references, closed-object encoding, and literal constants are normalized only in memory.
- Mapped string constants to singleton enums because Typify otherwise broadened discriminators to `String`.
- Required runtime JSON Schema validation before Rust deserialization for full numeric and collection-bound enforcement.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] Register the Rust crate as a real Cargo workspace member**

- **Found during:** Task 01-13-01 RED setup
- **Issue:** `cargo test -p contract-generation-spike-rust` cannot select a crate outside the workspace; the first real Rust build also produced an unignored root target directory.
- **Fix:** Added the exact crate member to `Cargo.toml`, committed the generated lockfile, and ignored `/target/`.
- **Files modified:** `Cargo.toml`, `Cargo.lock`, `.gitignore`
- **Verification:** Cargo selected the package and the RED suite failed only on unimplemented behavior.
- **Committed in:** `a959109`

**2. [Rule 2 - Missing Critical Functionality] Prove the complete shared vector matrix in Rust**

- **Found during:** Task 01-13-01 GREEN evidence review
- **Issue:** Typify transport types preserve shape and selected constraints but do not enforce all integer bounds and array cardinality, so Serde alone could not prove parity with the unchanged TypeSpec vectors.
- **Fix:** Added exact-pinned `jsonschema` 0.49.1 without network/file resolver features and validated every shared accepted/rejected case.
- **Files modified:** `tooling/contract-generation-spike-rust/Cargo.toml`, `tooling/contract-generation-spike-rust/tests/generation.rs`, `Cargo.lock`
- **Verification:** Four Rust integration tests pass, including all five valid and ten invalid shared cases.
- **Committed in:** `e015b4e`

**3. [Rule 3 - Blocking] Register architecture ownership for the new Rust tooling crate**

- **Found during:** Overall root verification
- **Issue:** The live Cargo architecture adapter correctly rejected `tooling/contract-generation-spike-rust/src/main.rs` as `UNKNOWN_OWNER`.
- **Fix:** Added one active contracts-owned tooling module with the exact crate root and public entry.
- **Files modified:** `architecture/module-boundaries.json`
- **Verification:** Both live architecture adapters, 23 architecture policy tests, and root `pnpm verify` pass.
- **Committed in:** `8b28fc5`

---

**Total deviations:** 3 auto-fixed (1 missing critical functionality, 2 blocking)

## Issues Encountered

- Typify 0.7.0 does not preserve string `const` fields as literal Rust types and consumes schemars 0.8-style references/closure. The generator now rejects unknown representations and applies only the ADR-documented equivalent mappings.
- The bundled schema contains definitions but intentionally has no root validation target. The Rust parity test adds an in-memory `$ref` to `SpikeEnvelope.json` while keeping every emitted definition and vector unchanged.

## Verification

- Exact schema deletion/regeneration sequence — passed; persisted schema recreated with no git diff.
- `pnpm --filter @liiiraa/contract-generation-spike test -- --run` — passed, 3/3.
- `cargo test -p contract-generation-spike-rust` — passed, 4/4 integration tests plus binary suite.
- `pnpm verify` — passed full workspace generation, architecture, type, lint, format, test, and build gates.
- `cargo fmt --all -- --check` — passed.
- `cargo test --workspace` — passed.
- `cargo clippy --workspace --all-targets -- -D warnings` — passed.

## User Setup Required

None — no external service configuration is required.

## Next Phase Readiness

- Plan 01-05 can author the bounded production TypeSpec source under the closed ADR.
- Plan 01-15 can reuse the spike generator flow to emit checked-in production Rust transports without handwritten DTO repair.
- Plan 01-18 must retain runtime schema validation before constructing Rust transport values.
- No blockers remain.

## Self-Check: PASSED

- All four required plan artifacts exist.
- RED, GREEN, refactor, ADR, and architecture-fix commits are present.
- The shared schema deletion/regeneration proof produces no diff.
- Root JavaScript/TypeScript and complete Rust verification gates pass.

---

_Phase: 01-product-truth-and-modular-contracts_
_Completed: 2026-07-27_
