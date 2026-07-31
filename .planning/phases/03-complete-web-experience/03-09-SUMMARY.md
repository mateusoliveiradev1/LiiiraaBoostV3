---
phase: 03-complete-web-experience
plan: "09"
subsystem: contract-generation
tags: [typespec, json-schema, openapi, typescript, rust, compatibility]
requires:
  - phase: 01-product-truth-and-modular-contracts
    provides: Deterministic TypeSpec generation, compatibility baselines, and generated TS/Rust transports
  - phase: 03-complete-web-experience
    provides: Canonical bounded web contract models from Plan 03-03
provides:
  - Standalone sealed JSON Schema 2020-12 web document bundle
  - Additive OpenAPI 3.1 web components with no HTTP paths
  - Matching generated TypeScript and Rust web transport models
  - Exact owned-artifact drift and components-only compatibility proofs
affects: [03-10, 03-11, 03-12, 03-13, 03-14, apps-web, apps-account, apps-admin]
tech-stack:
  added: []
  patterns:
    - Reachability-based standalone schema definition closure
    - Desktop/web generated-definition isolation
    - Additive components-only compatibility proof with oasdiff retained for operations
key-files:
  created:
    - contracts/generated/web/v1/web-document.schema.json
  modified:
    - tooling/contract-generation/src/generate.ts
    - tooling/contract-generation/src/check-drift.ts
    - tooling/contract-compat/src/check-compat.ts
    - tooling/contract-compat/src/check-compat.test.ts
    - contracts/generated/http/openapi.json
    - packages/contracts-ts/src/generated/models.ts
    - crates/contracts-rust/src/generated.rs
key-decisions:
  - "Filter web-owned definitions out of desktop runtime schemas so all four desktop schema hashes remain byte-identical."
  - "Generate MessageEnvelope and WebDocument aliases from one reachable TypeScript root object so both model families are emitted without widening either alias."
  - "Accept only additive component schemas locally while empty paths remain proven; any HTTP operation still requires pinned oasdiff 1.26.0."
patterns-established:
  - "Owned-output drift checks enumerate exact artifacts instead of sweeping unrelated generated directories."
  - "Standalone schema bundles recursively close over every referenced TypeSpec definition."
requirements-completed: [WEB-01, WEB-02, WEB-03, WEB-08]
duration: 18min
completed: 2026-07-31
status: complete
---

# Phase 03 Plan 09: Deterministic Web Contract Generation Summary

**Sealed standalone web validation schema, additive OpenAPI components, and matching generated TypeScript/Rust transports with byte-stable desktop contracts.**

## Performance

- **Duration:** 18 min
- **Started:** 2026-07-31T02:26:00Z
- **Completed:** 2026-07-31T02:44:04Z
- **Tasks:** 1
- **Files modified:** 8

## Accomplishments

- Added `webDocument` to the bounded nine-artifact generation registry and emitted a standalone JSON Schema 2020-12 bundle containing every Plan 03-03 web model plus its transitive dependencies.
- Added web contracts as OpenAPI 3.1 components while retaining an empty `paths` object and advancing the additive contract-set version to 1.1.0.
- Generated all nine web document models for TypeScript and Rust while preserving the exact SHA-256 hashes of every desktop runtime schema.
- Strengthened drift and compatibility gates so unrelated generated validators do not masquerade as owned output and components-only changes receive deterministic internal proof.

## Task Commits

Each task was committed atomically:

1. **Task 1: Extend bounded generation and emit exact web artifacts** - `65fb8c7` (feat)

## Files Created/Modified

- `contracts/generated/web/v1/web-document.schema.json` - Standalone sealed web document validator source.
- `contracts/generated/http/openapi.json` - Additive web schemas under OpenAPI components with no paths.
- `packages/contracts-ts/src/generated/models.ts` - Generated web records, evidence documents, receipts, and audit transports.
- `crates/contracts-rust/src/generated.rs` - Generated Rust equivalents for every web transport.
- `tooling/contract-generation/src/generate.ts` - Exact output registry, definition partitioning, standalone closure, and TS/Rust generation roots.
- `tooling/contract-generation/src/check-drift.ts` - Exact nine-artifact drift allowlist.
- `tooling/contract-compat/src/check-compat.ts` - Safe components-only compatibility proof while preserving oasdiff for operations.
- `tooling/contract-compat/src/check-compat.test.ts` - Additive, mutation, and invented-path gate coverage.

## Decisions Made

- Desktop schemas use all pre-web definitions and explicitly exclude only web-owned declarations, preserving their bytes while allowing shared primitives in the web bundle.
- TypeScript generation uses a reachable `GeneratedContractRoots` object and derives exact `MessageEnvelope` and `WebDocument` aliases rather than broadening desktop transport semantics.
- Empty-path OpenAPI changes can bypass unavailable oasdiff only when every existing component remains identical and all other document fields are unchanged except `info.version`.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] Narrowed drift inspection to the generator's exact owned artifacts**

- **Found during:** Task 1 drift verification
- **Issue:** The existing drift reader swept entire generated directories and classified two separately owned standalone validator artifacts as extras.
- **Fix:** Replaced directory traversal with the same exact nine-artifact ownership set enforced by generation.
- **Files modified:** `tooling/contract-generation/src/check-drift.ts`
- **Verification:** `pnpm contracts:check` reports nine byte-identical artifacts.
- **Commit:** `65fb8c7`

**2. [Rule 3 - Blocking] Added deterministic components-only OpenAPI compatibility proof**

- **Found during:** Task 1 compatibility verification
- **Issue:** The gate required an unavailable oasdiff binary for any OpenAPI byte change, including additive schemas with both baseline and candidate paths empty.
- **Fix:** Added a fail-closed local comparison that permits only new component schemas and `info.version`; changed or removed existing schemas fail, and any operation still routes to pinned oasdiff.
- **Files modified:** `tooling/contract-compat/src/check-compat.ts`, `tooling/contract-compat/src/check-compat.test.ts`
- **Verification:** Compatibility baseline and fixture tests pass; invented paths continue delegating to oasdiff.
- **Commit:** `65fb8c7`

**Total deviations:** 2 auto-fixed blocking issues.

**Impact:** Both changes tighten ownership and compatibility enforcement without adding dependencies, network behavior, or HTTP operations.

## Issues Encountered

- `json-schema-to-typescript` 15.0.4 did not emit unreachable web `$defs`; generation now makes both transport families structurally reachable and derives exact public aliases.

## Threat Review

- T-03-02 is mitigated by exact output allowlisting, atomic writes, standalone Ajv compilation, and byte drift checks.
- T-03-08 is mitigated because web records appear only as components and OpenAPI `paths` remains empty.
- T-03-SC is mitigated because no dependency was added or installed for this plan.
- No new network endpoint, authentication path, file-access boundary, or remote execution surface was introduced.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness

- Plans 03-10 through 03-14 can consume generated web documents from TypeScript and Rust without handwritten transport duplication.
- HTTP operations remain intentionally absent and still require the pinned oasdiff gate when introduced by a future owning plan.

## Known Stubs

None.

## Self-Check: PASSED

- All eight created or modified implementation artifacts exist on disk.
- Task commit `65fb8c7` exists in repository history and contains no tracked-file deletion.
- Generation, nine-artifact drift, approved-baseline compatibility, TypeScript compilation, Rust compilation, compatibility fixtures, standalone Ajv compilation, empty OpenAPI paths, and four desktop schema hashes all pass.

---

_Phase: 03-complete-web-experience_
_Completed: 2026-07-31_
