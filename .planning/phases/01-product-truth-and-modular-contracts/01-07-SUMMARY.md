---
phase: 01-product-truth-and-modular-contracts
plan: '07'
subsystem: contracts
tags:
  - golden-corpus
  - provenance
  - json-schema
  - deterministic-validation
requires:
  - phase: 01-product-truth-and-modular-contracts
    plan: '14'
    provides: Deterministic generated desktop diagnostic-value schema
provides:
  - Versioned shared corpus with five canonical provenance vectors
  - Six stable rejection classes shared by future TypeScript and Rust validators
  - Zero-side-effect corpus integrity checker with deterministic mutation proofs
affects:
  - 01-18-runtime-contract-validation
tech-stack:
  added: []
  patterns:
    - Manifest pins schema identity, repository path, SHA-256 digest, and exact vector counts
    - Valid and invalid matrices carry stable IDs, schema IDs, payloads, expected verdicts, and reasons
    - Synthetic payload sentinels and a frozen 2000-01-01 clock prevent real-machine fixture leakage
key-files:
  created:
    - contracts/corpus/manifest.json
    - contracts/corpus/valid/provenance-vectors.json
    - contracts/corpus/invalid/rejection-vectors.json
    - tooling/contract-generation/src/check-corpus.mjs
  modified:
    - tooling/contract-generation/package.json
key-decisions:
  - 'Pin the generated diagnostic schema by stable ID, repository path, and SHA-256 while leaving runtime verdict parity to Plan 01-18.'
  - 'Keep one compact valid matrix and one compact invalid matrix with every required class represented exactly once.'
  - 'Require uppercase synthetic sentinels, synthetic-only values, and a frozen clock for every corpus payload.'
requirements-completed:
  - FOUND-01
  - FOUND-03
duration: 10min
completed: 2026-07-27
---

# Phase 01 Plan 07: Shared Provenance Golden Corpus Summary

**A schema-pinned synthetic corpus now gives TypeScript and Rust validators the same five acceptance cases and six deterministic rejection cases without exposing or fabricating machine data.**

## Performance

- **Duration:** 10 min
- **Started:** 2026-07-27T04:33:00Z
- **Completed:** 2026-07-27T04:43:00Z
- **Tasks:** 2
- **Files modified:** 5

## Accomplishments

- Added canonical fixture, observed, measured, modeled, and unavailable vectors with complete per-kind metadata.
- Added exactly one vector for unknown schema version, unknown kind, missing metadata, combined metadata, extra field, and bounds violation.
- Added a read-only integrity checker that rejects missing, duplicate, unlisted, unsafe, reasonless, non-synthetic, count-tampered, and schema-tampered corpus state.
- Connected corpus integrity to the contract-generation package test so the root verification pipeline enforces it.

## Task Commits

1. **Task 01-07-01: Author the synthetic provenance corpus (RED)** - `a59ad0e`
2. **Task 01-07-02: Enforce corpus integrity (GREEN)** - `0a292cd`

## Files Created/Modified

- `contracts/corpus/manifest.json` - Versioned schema catalog, matrix inventory, required classes, and exact counts.
- `contracts/corpus/valid/provenance-vectors.json` - Five canonical valid provenance cases.
- `contracts/corpus/invalid/rejection-vectors.json` - Six stable invalid provenance cases.
- `tooling/contract-generation/src/check-corpus.mjs` - Deterministic integrity gate and eight in-memory mutation proofs.
- `tooling/contract-generation/package.json` - Runs corpus integrity with the existing bounded generation test.

## Decisions Made

- The corpus checker verifies schema identity and digest but does not perform language-runtime payload validation; validator parity remains owned by Plan 01-18.
- Unknown schema version is represented by an unregistered schema ID, allowing both future validators to fail closed before payload validation.
- Every payload must contain an uppercase synthetic marker; diagnostic `value` fields are sentinel strings and all provenance timestamps use one frozen clock.

## Deviations from Plan

### Rule 2 - Missing Critical Functionality

- Added `tooling/contract-generation/package.json` to the task scope so the new checker is executed by package and root verification instead of remaining an unenforced standalone script.

## Issues Encountered

- The first root verification run exposed ESLint violations for two unused helpers and the unavailable `structuredClone` global. Replaced the clone with a deterministic JSON clone and removed the unused code; the complete gate then passed.

## TDD Gate Compliance

- **RED:** `a59ad0e` committed the corpus evidence while the planned checker command failed with `MODULE_NOT_FOUND`.
- **GREEN:** `0a292cd` implemented the integrity checker and wired it into the package test.
- **REFACTOR:** No separate refactor commit was needed after lint-directed cleanup within GREEN.

## Verification

- `pnpm --filter @liiiraa/contracts-source exec tsp compile .` - passed.
- `node tooling/contract-generation/src/check-corpus.mjs` - passed with 5 valid, 6 invalid, 11 total vectors.
- `node tooling/contract-generation/src/check-corpus.mjs --self-test-mutations` - passed 8 deterministic rejection proofs.
- `pnpm --filter @liiiraa/contract-generation test` - passed.
- `pnpm verify` - passed complete workspace generation, architecture, type, lint, format, test, and build gates.

## Next Phase Readiness

- Plan 01-18 can load both matrix files from the manifest and assert the same verdicts through public TypeScript and Rust validators.
- No blockers remain.

## Self-Check: PASSED

- Both task commits are present.
- All five valid kinds and six invalid classes are represented exactly once.
- Generated schema digest and exact vector counts are enforced.
- Root verification passes with corpus integrity included.

---

_Phase: 01-product-truth-and-modular-contracts_
_Completed: 2026-07-27_
