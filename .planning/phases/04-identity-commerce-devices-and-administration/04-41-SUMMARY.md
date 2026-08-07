---
phase: 04-identity-commerce-devices-and-administration
plan: '41'
subsystem: contracts
tags: [typespec, json-schema, openapi, rust, typescript, admin-routing]
requires:
  - phase: 04-identity-commerce-devices-and-administration
    provides: persisted administrative authority and isolated Admin origin
provides:
  - Closed generated Admin contracts for access, invitations, governance, jobs, incidents, configuration, privacy, receipts, and partial failures
  - TypeScript and Rust validation parity for the complete Admin control-plane family
  - Canonical isolated Admin route tree with seven stable domains and safe shareable URL state
affects: [admin-shell, invitations, governance, operations, support, security, system]
tech-stack:
  added: []
  patterns:
    [control-plane-only schema registration, closed generated admin projections, allowlisted admin URL state]
key-files:
  created: []
  modified:
    - packages/contracts-source/src/control-plane.tsp
    - packages/contracts-ts/src/validation.test.ts
    - crates/contracts-rust/src/validation.rs
    - packages/web-core/src/routes.ts
    - packages/web-core/src/routes.test.ts
    - tooling/contract-generation/src/generate.ts
key-decisions:
  - 'Keep every redesigned Admin network record in the canonical TypeSpec control plane and generate both TypeScript and Rust representations from that source.'
  - 'Allow only bounded non-sensitive navigation state in Admin URLs; personal data, secrets, drafts, reasons, tokens, and arbitrary keys fail closed.'
  - 'Preserve legacy Admin route identifiers as compatibility aliases while establishing the seven-domain canonical hierarchy.'
patterns-established:
  - 'Admin transport boundary: closed versioned projections, commands, and receipts are generated from TypeSpec and validated identically in TypeScript and Rust.'
  - 'Admin URL boundary: only filters, sort, cursor, tab, saved view, density, locale, and opaque identifiers may round-trip.'
requirements-completed: [WEB-06, WEB-07, IDEN-03]
duration: 16 min
completed: 2026-08-06
status: complete
---

# Phase 04 Plan 41: Admin Contracts and Routes Summary

**The redesigned Admin now has one generated TypeSpec contract family, TypeScript/Rust validation parity, and an isolated seven-domain route tree whose shareable URL state rejects secrets and personal data.**

## Performance

- **Duration:** 16 min
- **Completed:** 2026-08-06
- **Tasks:** 2
- **Files modified:** 11

## Accomplishments

- Added bounded generated projections for access context, roles, capabilities, saved views, inbox, invitations, governance, approvals, delegations, reviews, jobs, incidents, configurations, privacy, conflicts, partial failures, commands, and receipts.
- Proved the same admission and rejection matrix in TypeScript and Rust, including unknown states, unmasked sensitive values, oversized collections, missing versions, and unsafe URL state.
- Registered overview, people, revenue, operation, support, security, and system domains plus search, inbox, saved views, activity, detail routes, and compatible legacy aliases.
- Added a fail-closed URL codec that round-trips only bounded navigation fields and opaque identifiers.

## Task Commits

1. **Task 04-41-01 RED: generated Admin contract admission** - `9dc292a` (test)
2. **Task 04-41-01 GREEN: complete generated Admin contract family** - `47293c5` (feat)
3. **Task 04-41-02 RED: canonical Admin route grammar** - `48bf85e` (test)
4. **Task 04-41-02 GREEN: isolated Admin route tree** - `75ba150` (feat)

## Files Created/Modified

- `packages/contracts-source/src/control-plane.tsp` - Canonical Admin projection, command, result, and state vocabulary.
- `packages/contracts-ts/src/validation.test.ts` - TypeScript admission and rejection corpus for all Admin families.
- `crates/contracts-rust/src/generated.rs` - Generated Rust transport representations.
- `crates/contracts-rust/src/validation.rs` - Rust parity witnesses for the Admin validation matrix.
- `contracts/generated/v1/control-plane-document.schema.json` - Generated standalone control-plane JSON Schema.
- `contracts/generated/http/openapi.json` - Generated OpenAPI component definitions.
- `packages/contracts-ts/src/generated/models.ts` - Generated TypeScript Admin models.
- `packages/contracts-ts/src/generated/standalone-validators.js` - Regenerated standalone validators.
- `tooling/contract-generation/src/generate.ts` - Explicit control-plane-only schema ownership.
- `packages/web-core/src/routes.ts` - Canonical Admin route registry and safe URL codec.
- `packages/web-core/src/routes.test.ts` - Route isolation, compatibility, and URL-state tests.

## Decisions Made

- Administrative schemas that do not belong to desktop documents are explicitly registered as control-plane-only during generation.
- The safe Admin URL grammar is an allowlist, not a sanitizer: unknown or sensitive keys invalidate the state instead of being silently retained.
- Compatibility aliases resolve existing links without weakening the new canonical domain hierarchy.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] Prevented Admin-only definitions from leaking into desktop schemas**

- **Found during:** Task 04-41-01 contract generation
- **Issue:** Standalone generation attempted to include the new control-plane Admin definitions in desktop schema families.
- **Fix:** Extended the generator's control-plane-only registry so every Admin definition remains owned by its intended boundary.
- **Files modified:** `tooling/contract-generation/src/generate.ts`
- **Verification:** Full contract generation, drift, compatibility, TypeScript, and Rust suites passed.
- **Committed in:** `47293c5`

**2. [Rule 2 - Missing Critical] Added Rust witnesses for the complete Admin validation matrix**

- **Found during:** Task 04-41-01 parity verification
- **Issue:** TypeScript admission tests alone could not prove both generated runtimes accept and reject the same Admin documents.
- **Fix:** Expanded Rust validation tests to cover the same valid and invalid Admin families.
- **Files modified:** `crates/contracts-rust/src/validation.rs`
- **Verification:** Rust schema validation and transport deserialization passed together with the TypeScript corpus.
- **Committed in:** `47293c5`

**3. [Rule 3 - Blocking] Replaced an incompatible focused test invocation with the canonical contract gate**

- **Found during:** Task 04-41-01 verification
- **Issue:** The plan command `pnpm test:contracts -- --run validation` forwarded `--run` to Cargo, which rejects that option.
- **Fix:** Ran the complete canonical `pnpm test:contracts` gate instead of weakening or bypassing the Rust portion.
- **Files modified:** None.
- **Verification:** 71 TypeScript tests, Rust validation/deserialization, compatibility, and drift checks all passed.
- **Committed in:** N/A (verification command correction only)

---

**Total deviations:** 3 auto-fixed (1 missing critical, 2 blocking).
**Impact on plan:** All deviations were required to preserve contract ownership and runtime parity; no product scope was added.

## Issues Encountered

- The literal focused verification syntax in the plan is incompatible with the mixed TypeScript/Cargo root runner. The broader canonical gate passed and provides stronger evidence.

## Verification

- `rtk pnpm test:contracts` passed: 71 TypeScript tests plus Rust validation/deserialization, compatibility, and drift gates.
- `rtk pnpm --filter @liiiraa/web-core test -- --run routes` passed: 115 tests.
- `rtk pnpm --filter @liiiraa/web-core check` passed.
- `rtk git diff --check` passed.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness

- Plan 04-42 can implement deterministic invitation lifecycle policy without inventing transport shapes or route identifiers.
- Admin shell and downstream workflow plans can consume one closed generated contract and one canonical isolated route tree.

---

_Phase: 04-identity-commerce-devices-and-administration_
_Completed: 2026-08-06_
