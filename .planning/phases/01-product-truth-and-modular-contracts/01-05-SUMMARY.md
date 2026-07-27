---
phase: 01-product-truth-and-modular-contracts
plan: "05"
subsystem: contracts
tags:
  - typespec
  - json-schema
  - desktop-ipc
  - provenance
requires:
  - phase: 01-product-truth-and-modular-contracts
    plan: "13"
    provides: Spike-approved TypeSpec JSON Schema and Rust generation representation
provides:
  - Canonical version 1.0 desktop message envelope source
  - Closed diagnostic value union with five literal provenance variants
  - Narrow InspectSystem request and result proof contracts
affects:
  - 01-14-production-schema-generation
  - 01-15-generated-language-transports
  - 01-18-runtime-contract-validation
  - 01-08-desktop-client-port
tech-stack:
  added: []
  patterns:
    - Hand-authored TypeSpec is the sole editable critical transport source
    - Concrete boundary models alone receive jsonSchema export markers
key-files:
  created:
    - packages/contracts-source/package.json
    - packages/contracts-source/tspconfig.yaml
    - packages/contracts-source/src/envelope.tsp
    - packages/contracts-source/src/provenance.tsp
    - packages/contracts-source/src/desktop-inspection.tsp
  modified:
    - packages/contracts-source/src/main.tsp
    - pnpm-lock.yaml
key-decisions:
  - "Represent every diagnostic value as a closed oneOf over fixture, observed, measured, modeled, and unavailable literal-kind variants."
  - "Keep the proof boundary inspection-only with exact desktop.inspect-system request/result message literals."
patterns-established:
  - "Envelope pattern: schemaVersion 1.0, exact messageType, bounded request/correlation IDs, UTC issue timestamp, and closed payload."
  - "Provenance pattern: available variants require a value and kind-specific evidence metadata; unavailable requires a bounded reason and no value."
requirements-completed:
  - FOUND-01
  - FOUND-03
duration: 12min
completed: 2026-07-27
status: complete
---

# Phase 01 Plan 05: Product Contract Source Summary

**Canonical TypeSpec now defines sealed version 1.0 desktop envelopes, five provenance-bearing diagnostic variants, and the inspection-only adapter proof boundary.**

## Performance

- **Duration:** 12 min
- **Started:** 2026-07-27T04:09:00Z
- **Completed:** 2026-07-27T04:21:35Z
- **Tasks:** 2
- **Files modified:** 7

## Accomplishments

- Added the exact-pinned `@liiiraa/contracts-source` package as the only hand-authored critical transport source.
- Defined bounded request, correlation, provenance, and inspection identifiers with literal version and message discriminators.
- Made diagnostic provenance structurally exhaustive across fixture, observed, measured, modeled, and unavailable variants.
- Exported only the diagnostic vocabulary and narrow `InspectSystem` request/result boundary models for schema generation.

## Task Commits

Each task committed atomically:

1. **Task 01-05-01: Author envelope and provenance primitives** - `0c739c9` (`feat`)
2. **Task 01-05-02: Add the narrow desktop inspection proof contract** - `f61f09a` (`feat`)

## Files Created/Modified

- `packages/contracts-source/package.json` - Exact-pinned TypeSpec source package and terminating workspace tasks.
- `packages/contracts-source/tspconfig.yaml` - Warning-as-error source compilation policy.
- `packages/contracts-source/src/main.tsp` - Canonical contract import/export root.
- `packages/contracts-source/src/envelope.tsp` - Version 1.0 message envelope and bounded transport identifiers.
- `packages/contracts-source/src/provenance.tsp` - Closed five-way diagnostic provenance vocabulary.
- `packages/contracts-source/src/desktop-inspection.tsp` - Inspection-only request and result proof messages.
- `pnpm-lock.yaml` - Workspace importer for the exact approved TypeSpec pins.

## Decisions Made

- Used one closed `@oneOf` diagnostic union so unavailable values cannot accidentally carry a value and available values cannot omit their evidence metadata.
- Kept the inspection payload deliberately small: a fixed summary request and three provenance-bearing system facts, with no mutation, optimizer, Windows, game, auth, billing, cloud, or UI operations.
- Marked only concrete public boundary declarations with `@jsonSchema`; helper scalars and payload models remain referenced implementation vocabulary.

## Deviations from Plan

None - followed plan as specified.

## Issues Encountered

None.

## User Setup Required

None - no external service configuration required.

## Verification

- `pnpm --filter @liiiraa/contracts-source exec tsp compile .` - passed with TypeSpec 1.14.0.
- Bundled JSON Schema inspection confirmed literal version/message discriminators, closed objects, bounded identifiers, and exactly five provenance branches.
- `pnpm verify` - passed workspace toolchain, architecture, generation, type, lint, format, test, and build gates.

## Next Phase Readiness

- Plan 01-14 can now generate deterministic runtime schemas and OpenAPI components from one source.
- No blockers remain.

## Self-Check: PASSED

- All six declared contract-source artifacts exist.
- Both task commits are present.
- Exact plan verification and full root verification pass.

---

_Phase: 01-product-truth-and-modular-contracts_
_Completed: 2026-07-27_
