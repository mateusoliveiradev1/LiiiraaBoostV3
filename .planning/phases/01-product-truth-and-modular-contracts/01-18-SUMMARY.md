---
phase: 01-product-truth-and-modular-contracts
plan: "18"
subsystem: contracts
tags:
  - runtime-validation
  - ajv
  - jsonschema
  - proptest
  - golden-corpus
requires:
  - phase: 01-product-truth-and-modular-contracts
    plan: "07"
    provides: Schema-pinned synthetic provenance golden corpus
  - phase: 01-product-truth-and-modular-contracts
    plan: "15"
    provides: Generated TypeScript and Rust transport packages
provides:
  - Cached public TypeScript Ajv validator with typed success and redacted structural errors
  - Cached public Rust jsonschema validator that deserializes only after schema acceptance
  - Shared-corpus verdict parity and provenance property coverage across both runtimes
  - Root test:contracts gate covering drift, compatibility, parity, and Rust properties
affects:
  - 01-19-desktop-contract-adapter
  - 02-desktop-visual-foundation
tech-stack:
  added:
    - ajv 8.20.0 runtime dependency in @liiiraa/contracts-ts
    - jsonschema 0.49.1 runtime dependency in liiiraa-contracts-rust
    - proptest 1.11.0 Rust validator property tests
  patterns:
    - Compile canonical schemas once per process and validate unknown input before typed mapping
    - Return bounded path and keyword metadata without retaining payload values in errors
    - Exercise runtime validators only through package and crate public roots
key-files:
  created:
    - packages/contracts-ts/src/index.ts
    - packages/contracts-ts/src/validation.ts
    - packages/contracts-ts/src/validation.test.ts
    - packages/contracts-ts/tsconfig.json
    - crates/contracts-rust/src/validation.rs
    - crates/contracts-rust/tests/golden_corpus.rs
    - crates/contracts-rust/tests/provenance_properties.rs
  modified:
    - packages/contracts-ts/package.json
    - crates/contracts-rust/Cargo.toml
    - crates/contracts-rust/src/lib.rs
    - crates/contracts-rust/src/generated.rs
    - tooling/contract-generation-rust/src/main.rs
    - package.json
    - pnpm-lock.yaml
    - Cargo.lock
key-decisions:
  - "Expose only structural validation paths and keywords, capped at eight issues; never echo unsupported schema IDs or payload values."
  - "Return generated transport types only after canonical schema validation succeeds in both runtimes."
  - "Normalize TypeSpec anyOf string-constant unions to one Rust enum before Typify generation."
requirements-completed:
  - FOUND-01
  - FOUND-03
duration: 12 min
completed: 2026-07-27
---

# Phase 01 Plan 18: Cross-Language Runtime Validation Summary

**Cached Ajv and jsonschema boundaries now accept and reject the same schema-pinned provenance corpus through public TypeScript and Rust entrypoints without leaking payload values.**

## Performance

- **Duration:** 12 min
- **Started:** 2026-07-27T05:19:00Z
- **Completed:** 2026-07-27T05:31:00Z
- **Tasks:** 2
- **Files modified:** 15

## Accomplishments

- Added the `@liiiraa/contracts-ts` package root with a once-compiled Ajv Draft 2020-12 validator, generated transport exports, typed results, and bounded structural diagnostics.
- Added the `liiiraa_contracts_rust` public validator with a once-compiled `jsonschema` validator, validation-before-deserialization ordering, and value-free error records.
- Verified all five valid and six invalid shared corpus vectors in both languages through public consumer imports.
- Added Rust properties proving illegal cross-kind provenance combinations fail closed and valid generated transports survive validation/serialization round trips.
- Added a terminating root `test:contracts` command covering generation drift, approved compatibility, TypeScript parity, Rust parity, and property tests.

## Task Commits

1. **Task 01-18-01 RED: Define public TypeScript validator behavior** — `e568daf`
2. **Task 01-18-01 GREEN: Expose cached TypeScript contract validator** — `6ca8ad8`
3. **Task 01-18-02 RED: Define Rust validator parity properties** — `eb83687`
4. **Task 01-18-02 GREEN: Enforce Rust contract validation parity** — `523a987`

## Files Created/Modified

- `packages/contracts-ts/src/index.ts` — Public generated transport and validator surface.
- `packages/contracts-ts/src/validation.ts` — Cached Ajv validator and redacted result contract.
- `packages/contracts-ts/src/validation.test.ts` — Public-root golden corpus and disclosure-boundary tests.
- `packages/contracts-ts/tsconfig.json` — Strict package typecheck and lint project coverage.
- `packages/contracts-ts/package.json` — Public root export, tests, and exact validator dependencies.
- `crates/contracts-rust/src/validation.rs` — Cached schema validator and validation-before-deserialization API.
- `crates/contracts-rust/src/lib.rs` — Public validator re-exports.
- `crates/contracts-rust/tests/golden_corpus.rs` — Public API corpus parity and redaction coverage.
- `crates/contracts-rust/tests/provenance_properties.rs` — Illegal provenance and round-trip properties.
- `tooling/contract-generation-rust/src/main.rs` — Safe string-constant union normalization for Typify.
- `crates/contracts-rust/src/generated.rs` — Regenerated usable measurement-quality enum.
- `package.json` — Root `test:contracts` gate.
- `pnpm-lock.yaml`, `Cargo.toml`, `Cargo.lock` — Exact reproducible dependency graph updates.

## Decisions Made

- Validation failures expose only bounded JSON instance paths and schema keywords. Raw Ajv/jsonschema errors are never returned or retained in the public error type.
- Unsupported schema IDs fail before payload validation and are not reflected into errors.
- Runtime validators return the existing generated transport types instead of introducing handwritten DTOs.
- TypeSpec string literal unions are normalized to a single enum representation for Rust generation because Typify's unnormalized flattened representation could not deserialize the valid `"quality"` string.

## Deviations from Plan

### [Rule 3 - Blocking] Add a strict TypeScript package project

- **Found during:** Task 01-18-01
- **Issue:** New public source and consumer tests were outside TypeScript ESLint project-service coverage.
- **Fix:** Added `packages/contracts-ts/tsconfig.json` and routed the package check through it.
- **Files modified:** `packages/contracts-ts/tsconfig.json`, `packages/contracts-ts/package.json`
- **Verification:** Package typecheck, ESLint, tests, and root verify pass.
- **Committed in:** `6ca8ad8`

### [Rule 2 - Missing Critical Functionality] Add the required aggregate contracts gate

- **Found during:** Task 01-18-02
- **Issue:** The planned `pnpm test:contracts` command did not exist, so parity and property evidence had no root entrypoint.
- **Fix:** Added a terminating root command covering drift, compatibility, TypeScript tests, and Rust tests.
- **Files modified:** `package.json`
- **Verification:** `rtk pnpm test:contracts` passes.
- **Committed in:** `523a987`

### [Rule 1 - Bug] Normalize Rust string-literal unions before Typify generation

- **Found during:** Task 01-18-02 GREEN
- **Issue:** Typify generated measurement quality as flattened optional subtype objects, so a schema-valid `"quality": "valid"` payload failed generated-model deserialization.
- **Fix:** Collapsed supported `anyOf` string-constant unions into one equivalent enum during in-memory Rust normalization and regenerated the transport.
- **Files modified:** `tooling/contract-generation-rust/src/main.rs`, `crates/contracts-rust/src/generated.rs`
- **Verification:** Golden corpus parity, round-trip properties, deterministic generation drift, root verify, and Cargo workspace tests pass.
- **Committed in:** `523a987`

**Total deviations:** 3 auto-fixed (1 bug, 1 missing critical functionality, 1 blocking issue).

**Impact:** All changes are within the contract-generation and runtime-validation boundary; no canonical schema or accepted JSON instance set changed.

## Issues Encountered

- The first Rust GREEN run exposed a pre-existing generated transport defect for measurement-quality string unions. The generator normalization fix keeps generated code read-only and makes regeneration preserve runtime deserialization parity.

## TDD Gate Compliance

- **Task 01-18-01 RED:** `e568daf` failed because the package root was not exported.
- **Task 01-18-01 GREEN:** `6ca8ad8` passed all 12 TypeScript consumer tests.
- **Task 01-18-02 RED:** `eb83687` failed because the crate root did not expose validator APIs.
- **Task 01-18-02 GREEN:** `523a987` passed corpus parity and provenance property suites.
- **REFACTOR:** No separate refactor commit was necessary; formatting and strict lint fixes were completed within each GREEN cycle.

## Verification

- `rtk pnpm --filter @liiiraa/contracts-ts test -- --run` — passed, 12 tests.
- `rtk pnpm test:contracts` — passed, drift and compatibility checks plus TypeScript/Rust parity and properties.
- `rtk pnpm verify` — passed all workspace generation, architecture, lint, type, test, and build gates.
- `rtk cargo check --workspace --all-targets` — passed.
- `rtk cargo test --workspace` — passed.
- `rtk cargo fmt --all -- --check` — passed.

## Next Phase Readiness

- Public cross-language validators are ready for the desktop simulated adapter and later IPC consumers.
- No blockers remain for dependent Phase 1 plans.

## Self-Check: PASSED

- All created files exist, four task commits are present, all plan verification commands pass, and both requirements retain executable evidence.

---
_Phase: 01-product-truth-and-modular-contracts_
_Completed: 2026-07-27_
