---
phase: 01-product-truth-and-modular-contracts
plan: '14'
subsystem: contracts
tags:
  - typespec
  - json-schema
  - openapi
  - deterministic-generation
requires:
  - phase: 01-product-truth-and-modular-contracts
    plan: '05'
    provides: Canonical desktop envelope, provenance, and inspection TypeSpec source
provides:
  - Deterministic bounded production contract-generation orchestrator
  - Versioned standalone desktop JSON Schema runtime artifacts
  - OpenAPI 3.1 component vocabulary without invented HTTP routes
affects:
  - 01-07-contract-corpus
  - 01-15-generated-language-transports
  - 01-16-contract-compatibility
  - 01-18-runtime-contract-validation
tech-stack:
  added:
    - '@typespec/http 1.14.0'
    - '@typespec/openapi3 1.14.0'
  patterns:
    - Canonical TypeSpec compiles once into an isolated temporary bundle
    - Generated JSON is recursively key-sorted and newline-normalized
    - Writes are atomic and restricted to an exact owned output allowlist
key-files:
  created:
    - tooling/contract-generation/package.json
    - tooling/contract-generation/tsconfig.json
    - tooling/contract-generation/src/node-shim.d.ts
    - tooling/contract-generation/src/generate.ts
    - contracts/generated/desktop/v1/message-envelope.schema.json
    - contracts/generated/desktop/v1/diagnostic-value.schema.json
    - contracts/generated/desktop/v1/inspect-system.schema.json
    - contracts/generated/http/openapi.json
  modified:
    - package.json
    - pnpm-lock.yaml
key-decisions:
  - 'Bundle the emitted TypeSpec definitions into each standalone runtime schema so every persisted validator artifact resolves without sibling files.'
  - 'Publish OpenAPI 3.1 shared components with an empty paths object until canonical TypeSpec defines real HTTP operations.'
  - 'Keep generation as an ordered stage registry so language generators can join the same root command in Plan 01-15.'
requirements-completed:
  - FOUND-01
  - FOUND-03
duration: 10min
completed: 2026-07-27
status: complete
---

# Phase 01 Plan 14: Deterministic Production Contract Generation Summary

**Canonical TypeSpec now produces four byte-stable, generated-only runtime and OpenAPI artifacts through one bounded root command.**

## Performance

- **Duration:** 10 min
- **Started:** 2026-07-27T04:22:00Z
- **Completed:** 2026-07-27T04:32:34Z
- **Tasks:** 2
- **Files:** 10

## Accomplishments

- Added a stage-oriented `@liiiraa/contract-generation` package that compiles the canonical TypeSpec entry in an isolated temporary directory.
- Restricted persistent writes to four exact generated paths, verified the path policy before compilation, and atomically replaced each normalized artifact.
- Emitted versioned closed desktop schemas with the complete five-kind provenance vocabulary and exact inspection request/result discriminators.
- Emitted OpenAPI 3.1 shared component schemas with no fabricated paths or operations.
- Proved repeated clean generation produces identical SHA-256 hashes and passed the complete root verification pipeline.

## Task Commits

1. **Task 01-14-01: Build the bounded schema generator** - `5ccf7ad`
2. **Task 01-14-02: Commit normalized runtime and HTTP artifacts** - `c57be19`

## Files Created/Modified

- `tooling/contract-generation/src/generate.ts` - Bounded, deterministic, stage-oriented generator.
- `tooling/contract-generation/package.json` - Exact TypeSpec generation dependencies and lifecycle commands.
- `tooling/contract-generation/tsconfig.json` - Strict workspace TypeScript configuration.
- `tooling/contract-generation/src/node-shim.d.ts` - Minimal Node declarations for dependency-free typechecking.
- `contracts/generated/desktop/v1/message-envelope.schema.json` - Closed version 1.0 desktop message vocabulary.
- `contracts/generated/desktop/v1/diagnostic-value.schema.json` - Standalone five-way provenance runtime schema.
- `contracts/generated/desktop/v1/inspect-system.schema.json` - Exact request/result inspection boundary.
- `contracts/generated/http/openapi.json` - OpenAPI 3.1 shared component vocabulary.
- `package.json` - Root `contracts:generate` command.
- `pnpm-lock.yaml` - Exact approved TypeSpec HTTP/OpenAPI dependency graph.

## Decisions Made

- Bundled all TypeSpec-emitted definitions into every standalone runtime artifact. This keeps each validator input independently resolvable while preserving TypeSpec as the only editable semantics.
- Kept OpenAPI `paths` empty. The current canonical source defines desktop messages, not HTTP operations, so routes would be fabricated contract authority.
- Exposed generation as an ordered stage registry. Plan 01-15 can add TypeScript and Rust stages without creating a competing command or orchestration path.

## Deviations from Plan

### Rule 3 - Blocking

- Added the root `contracts:generate` script, package TypeScript configuration, minimal Node declarations, and lockfile changes required to make the planned verification command and workspace lifecycle executable.

## Issues Encountered

None.

## User Setup Required

None.

## Verification

- `pnpm --filter @liiiraa/contract-generation exec tsc --noEmit` - passed.
- `pnpm --filter @liiiraa/contract-generation test` - bounded output policy passed.
- `pnpm contracts:generate` - emitted exactly four normalized artifacts.
- Generated twice and compared SHA-256 hashes - all four artifacts were byte-identical.
- `pnpm --filter @liiiraa/contracts-source exec tsp compile .` - passed.
- `pnpm verify` - passed workspace toolchain, architecture, generation, type, lint, format, test, and build gates.

## Next Phase Readiness

- Plan 01-15 can extend the single generator with TypeScript and Rust transport stages.
- Plans 01-07, 01-16, and 01-18 can consume stable runtime schemas and the OpenAPI component artifact.
- No blockers remain.

## Self-Check: PASSED

- All four declared generated artifacts exist and carry generated headers.
- Runtime objects remain closed and diagnostic provenance remains exhaustive.
- OpenAPI contains shared components and no invented routes.
- Both task commits are present.
- Root verification passes from a clean worktree.

---

_Phase: 01-product-truth-and-modular-contracts_
_Completed: 2026-07-27_
