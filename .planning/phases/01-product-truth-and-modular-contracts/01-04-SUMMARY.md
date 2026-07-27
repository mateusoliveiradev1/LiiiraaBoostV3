---
phase: 01-product-truth-and-modular-contracts
plan: '04'
subsystem: contracts
tags:
  - typespec
  - json-schema
  - ajv
  - typescript
  - deterministic-generation
requires:
  - phase: 01-product-truth-and-modular-contracts
    provides: Exact-pinned pnpm workspace and approved dependency evidence from Plans 01-01 and 01-02
provides:
  - Deterministic TypeSpec 1.14.0 to JSON Schema 2020-12 generation
  - Byte-stable persisted schema for the Rust parity spike
  - Closed reusable envelope with five literal provenance variants
  - Executable valid and invalid semantic vector matrix
  - Generated TypeScript discriminated-union evidence
affects:
  - 01-13-contract-generation-spike-rust
  - 01-05-production-contract-source
tech-stack:
  added:
    - '@typespec/compiler 1.14.0'
    - '@typespec/json-schema 1.14.0'
    - 'Ajv 8.20.0'
    - 'json-schema-to-typescript 15.0.4'
  patterns:
    - Canonical recursive JSON key ordering with one trailing newline
    - Temporary TypeSpec emission followed by atomic persisted-artifact replacement
    - Persisted-schema validation before downstream language generation
key-files:
  created:
    - tooling/contract-generation-spike/fixtures/spike.tsp
    - tooling/contract-generation-spike/fixtures/valid.json
    - tooling/contract-generation-spike/fixtures/invalid.json
    - tooling/contract-generation-spike/src/run-spike.ts
    - tooling/contract-generation-spike/src/run-spike.test.ts
    - tooling/contract-generation-spike/generated/spike.schema.json
  modified:
    - pnpm-lock.yaml
key-decisions:
  - 'Keep the reusable generic VersionedEnvelope because sealed emission preserved exact version, kind, metadata, payload, bounds, and closure without broadening.'
  - 'Represent provenance as a JSON Schema oneOf whose five members each carry a required literal kind; generated TypeScript retains the discriminated union.'
  - 'Persist one canonical bundled schema at tooling/contract-generation-spike/generated/spike.schema.json for the Rust parity consumer.'
patterns-established:
  - 'Contract spike gate: regenerate, canonicalize, validate vectors, then generate downstream language types.'
  - 'Fail-closed fixtures: invalid vectors are never weakened to accommodate an emitter or generator.'
requirements-completed:
  - FOUND-01
  - FOUND-03
duration: 10 min
completed: 2026-07-27
status: complete
---

# Phase 1 Plan 4: Deterministic TypeSpec Contract Generation Spike Summary

**TypeSpec now emits a byte-stable sealed JSON Schema bundle whose reusable versioned envelope, five provenance variants, bounds, runtime vectors, and generated TypeScript semantics all pass reproducibly.**

## Performance

- **Duration:** 10 min
- **Started:** 2026-07-27T02:47:00Z
- **Completed:** 2026-07-27T02:57:37Z
- **Tasks:** 2
- **Files modified:** 10

## Accomplishments

- Proved that the reusable `VersionedEnvelope<TKind, TPayload>` emits a closed concrete `SpikeEnvelope` without semantic broadening.
- Persisted canonical JSON Schema 2020-12 at the exact path required by the Rust spike, using temporary compilation, sorted keys, one trailing newline, and atomic replacement.
- Preserved all five literal provenance kinds, required metadata, confidence bounds 0–100, and sample cardinality 1–3.
- Executed five accepted vectors and ten rejected vectors against the persisted schema with strict Ajv validation.
- Generated TypeScript from the same bundle and verified its closed envelope, bounded tuple, version literal, message-kind literal, and provenance discriminated union.

## Task Commits

TDD tasks were committed as RED, GREEN, and focused refactor outcomes:

1. **Task 01-04-01 RED: Prove and persist the TypeSpec semantic matrix** — `09a5eb4` (`test`)
2. **Task 01-04-01 GREEN: Emit deterministic TypeSpec schema evidence** — `d36569f` (`feat`)
3. **Task 01-04-02 RED: Prove accepted and rejected TypeScript vectors** — `fdd3928` (`test`)
4. **Task 01-04-02 GREEN: Validate contract vectors and generated types** — `7cf3f89` (`feat`)
5. **Focused refactor: Compact structured spike evidence output** — `863f37e` (`refactor`)

## Files Created/Modified

- `tooling/contract-generation-spike/package.json` — Exact approved TypeSpec, Ajv, and TypeScript generator dependencies plus terminating package tasks.
- `tooling/contract-generation-spike/tsconfig.json` — Strict package project with third-party declaration isolation.
- `tooling/contract-generation-spike/fixtures/spike.tsp` — Reusable versioned envelope, sealed payload, and five provenance variants.
- `tooling/contract-generation-spike/fixtures/valid.json` — One accepted vector per provenance kind, including boundary values.
- `tooling/contract-generation-spike/fixtures/invalid.json` — Rejections for versions, kinds, extra fields, missing metadata, and bounds.
- `tooling/contract-generation-spike/src/run-spike.ts` — Compiler orchestration, canonical output, atomic persistence, Ajv validation, TypeScript generation, and evidence.
- `tooling/contract-generation-spike/src/run-spike.test.ts` — Semantic, determinism, vector, and generated-TypeScript assertions.
- `tooling/contract-generation-spike/src/node-shim.d.ts` — Narrow Node declarations without adding an unapproved direct dependency.
- `tooling/contract-generation-spike/generated/spike.schema.json` — Reviewable byte-stable shared schema for Rust.
- `pnpm-lock.yaml` — Frozen graph for the four exact approved direct dependencies and their transitives.

## Decisions Made

- The reusable envelope passed unchanged; the concrete-only fallback was not needed.
- Provenance uses `@oneOf` plus required literal `kind` properties because TypeSpec 1.14 applies core `@discriminator` to model inheritance, while this union representation preserves the same closed TypeScript discrimination without an inheritance hierarchy.
- JSON Schema is the persisted cross-language evidence. TypeScript output is generated and asserted in memory, avoiding a second committed authority.
- Validation always reads the persisted schema after regeneration, preventing tests from accidentally validating an in-memory substitute.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 2 - Missing Critical] Added package-local strict compiler infrastructure without an unapproved dependency**

- **Found during:** Task 01-04-01
- **Issue:** The plan listed source and fixture artifacts but no package TypeScript project or Node declarations. Root strict checking could not safely type the compiler orchestration without either local declarations or adding unreviewed `@types/node`.
- **Fix:** Added a package `tsconfig.json` and narrow `node-shim.d.ts`. Source remains fully strict; `skipLibCheck` is scoped to third-party declarations because TypeSpec 1.14.0's published declarations conflict with TypeScript 6 exact optional-property checking.
- **Files modified:** `tooling/contract-generation-spike/tsconfig.json`, `tooling/contract-generation-spike/src/node-shim.d.ts`
- **Verification:** Package `check`, root ESLint, package tests, package build, and root `pnpm verify` all pass.
- **Committed in:** `d36569f`

---

**Total deviations:** 1 auto-fixed (1 missing critical functionality)

## Issues Encountered

- TypeSpec 1.14 rejected core `@discriminator` on a union. The spike used JSON Schema `@oneOf` with required literal `kind` members instead; emitted JSON Schema and generated TypeScript both preserve closed discrimination.
- The TypeSpec emitter uses `bundleId` as the exact filename rather than adding the selected file-type extension. Setting `bundleId` to `spike.schema.json` made the output path explicit and deterministic.

## User Setup Required

None — no external service configuration is required.

## Next Phase Readiness

- Plan 01-13 can delete and deterministically regenerate the exact persisted schema before Typify consumes it.
- The production contract-source decision has evidence for closed envelopes, literal provenance, bounds, fixture rejection, and regeneration order.
- No blockers remain.

## Self-Check: PASSED

- All seven key spike and summary artifacts exist on disk.
- All five TDD/refactor commits are present in git history.
- Deleting the generated directory and rerunning the package test recreated the exact committed schema with no byte diff.
- The focused 3-test suite, strict package check, ESLint, package build, and full root `pnpm verify` chain pass.

---

_Phase: 01-product-truth-and-modular-contracts_
_Completed: 2026-07-27_
