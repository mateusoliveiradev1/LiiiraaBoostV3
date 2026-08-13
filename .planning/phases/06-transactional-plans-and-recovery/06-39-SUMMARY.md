---
phase: 06-transactional-plans-and-recovery
plan: '39'
subsystem: generated-contracts
tags: [typespec, json-schema, typescript, rust, ajv, physical-custody, recovery]
requires:
  - phase: 06-21
    provides: complete transactional plan contract and generated cross-runtime validation baseline
provides:
  - Closed generated installation and portable artifact custody documents with distinct fixed role sets
  - Purpose-bound pseudonymous friends roster with independent participant and machine-slot uniqueness
  - Three fixed physical run configurations and an observation-first six-state continuation chain
affects: [06-31, 06-32, 06-33, 06-34, 06-35, 06-37, 06-38, physical-windows-promotion]
tech-stack:
  added: []
  patterns:
    - TypeSpec remains the sole source for privileged physical custody and lifecycle transports
    - Generated JSON Schema extension keywords share semantic validation across AJV and Rust
key-files:
  created: []
  modified:
    - packages/contracts-source/src/transactional-plans.tsp
    - contracts/generated/desktop/v1/transactional-recovery.schema.json
    - packages/contracts-ts/src/generated/models.ts
    - crates/contracts-rust/src/generated.rs
    - packages/contracts-ts/src/fixtures/transactional-plans/valid.json
    - packages/contracts-ts/src/fixtures/transactional-plans/invalid.json
key-decisions:
  - 'Represent installed and portable custody as distinct fixed-key file sets so missing, duplicate, swapped, or driver-as-installed roles are structurally invalid.'
  - 'Keep artifact and roster CMS signatures outside the signed documents; only the installation manifest records signer identity as evidence, never as caller-provided trust authority.'
  - 'Encode the six continuation steps as separate generated variants with exact sequence and predecessor literals, including observationRequired true and mutationAuthorized false after reboot.'
  - 'Emit roster binding uniqueness from TypeSpec as a generated schema keyword and enforce it equivalently in standalone AJV and the Rust public validator.'
patterns-established:
  - 'Closed custody: canonical relative paths and exact roles are schema literals, not configurable strings or arrays.'
  - 'Observation-first continuation: reboot resumption cannot authorize mutation before a distinct resumed-observation record.'
requirements-completed: [PLAN-01, PLAN-05, PLAN-06, PLAN-07, PLAN-08]
duration: 15 min
completed: 2026-08-13
---

# Phase 06 Plan 39: Generated Physical Custody and Continuation Summary

**One TypeSpec authority now generates sealed installation, portable artifact, friends-roster, stage-config, and restart-safe continuation transports with equivalent Schema, TypeScript, and Rust rejection behavior.**

## Performance

- **Duration:** 15 min
- **Started:** 2026-08-13T22:38:21Z
- **Completed:** 2026-08-13T22:53:11Z
- **Tasks:** 1 TDD task
- **Files modified:** 13

## Accomplishments

- Added five generated physical document families to `TransactionalRecoveryDocument`, with installed roles limited to desktop/service/runner and portable roles fixed to MSI, installation manifest/signature, three configs, runner, tauri-driver, and msedgedriver.
- Sealed the friends roster to purpose-bound hashes and pseudonymous slots, external detached CMS custody, fixed artifact/config bindings, and independent participant/slot uniqueness in both runtime validators.
- Generated stage-discriminated configs for exactly clean Windows VM, owner PC, and friends PC with literal paths, complete fixed scenario and Tauri-command maps, and no executable, argument, host, script, credential, output-root, signer, or trust input.
- Generated an exact installed-ready through restored-complete continuation chain with fixed predecessor/sequence pairs, hash-bound authority tuples, and fail-closed observation-before-mutation semantics.

## TDD Execution

### RED

- Extended the shared JSON corpus with installation/artifact manifests, one- and multi-participant rosters, all three stage configs, all six lifecycle states, and 32 physical authority mutations.
- TypeScript failed exactly 13 new valid cases while 72 prior cases stayed green; Rust rejected the first new installation manifest because the generated union did not yet contain it.
- Commit: `eb1ac623` (`test(06-39): add failing physical custody contract corpus`).

### GREEN

- Defined the five families in TypeSpec, regenerated all canonical outputs, and added equivalent property-level roster uniqueness enforcement to AJV standalone and Rust validation.
- The final full contract gate passed generation drift for 12 artifacts, compatibility, TypeScript 167/167, and every Rust contract suite; the focused Rust corpus passed 2/2.
- Commit: `9ba21799` (`feat(06-39): generate physical custody and continuation contracts`).

### REFACTOR

- No separate refactor commit was needed. The GREEN source already separates custody identities, fixed stage variants, semantic uniqueness, and lifecycle variants while drift and the complete corpus remain green.

## Task Commits

1. **Task 1 RED: failing physical custody contract corpus** - `eb1ac623` (test)
2. **Task 1 GREEN: generated physical custody and continuation contracts** - `9ba21799` (feat)

## Files Created/Modified

- `packages/contracts-source/src/transactional-plans.tsp` - Canonical physical custody, roster, config, and continuation TypeSpec authority.
- `contracts/generated/desktop/v1/transactional-recovery.schema.json` - Runtime JSON Schema with all five physical families and the roster uniqueness keyword.
- `contracts/generated/http/openapi.json` - Canonical all-definition OpenAPI output regenerated by the bounded generation pipeline.
- `packages/contracts-ts/src/generated/models.ts` - Generated TypeScript transports for every physical document variant.
- `packages/contracts-ts/src/generated/standalone-validators.js` - Generated AJV runtime validator including roster participant/slot uniqueness.
- `packages/contracts-ts/src/transactional-plans.test.ts` - Shared mutation materialization and expanded root-kind coverage.
- `packages/contracts-ts/src/fixtures/transactional-plans/valid.json` - Valid custody, roster, config, and lifecycle corpus.
- `packages/contracts-ts/src/fixtures/transactional-plans/invalid.json` - Adversarial role, path, trust, roster, config, and continuation corpus.
- `packages/contracts-ts/scripts/generate-standalone.mjs` - Standalone-safe generated schema keyword implementation.
- `crates/contracts-rust/src/generated.rs` - Generated Rust transports for the closed physical authority.
- `crates/contracts-rust/src/validation.rs` - Rust parity enforcement for unique participant and machine-slot bindings.
- `crates/contracts-rust/tests/transactional_plans_corpus.rs` - Shared valid/invalid mutation materialization and required physical attack witnesses.
- `tooling/contract-generation/src/generate.ts` - Keeps the schema-only custom uniqueness keyword outside typify input while preserving it in runtime Schema/AJV.

## Decisions Made

- Fixed-key objects represent role completeness more strongly than caller-ordered arrays: every required role occurs exactly once and each key resolves only its canonical role/path identity.
- Artifact-manifest detached CMS and friends-roster detached CMS remain adjacent external bytes. The documents contain hashes and identity bindings but no signature bytes, signer selection, or mutable trust pin.
- Friends configs contain only the two literal roster paths; roster hashes and participant selection are deliberately deferred to the separately signed create-once roster.
- Lifecycle shape itself enforces ordering: every post-initial variant has one exact predecessor and numeric sequence, while resumed observation hard-codes `observationRequired: true` and `mutationAuthorized: false`.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Preserved integer sequence parity in generated Rust**

- **Found during:** Task 1 GREEN
- **Issue:** Direct numeric TypeSpec literals generated floating-point Rust values, so a valid continuation round trip changed JSON `0` to `0.0`.
- **Fix:** Replaced the six literals with exact min/max-bounded `uint32` scalars while retaining the same JSON Schema constants.
- **Files modified:** `packages/contracts-source/src/transactional-plans.tsp`, generated Schema/TypeScript/Rust artifacts
- **Verification:** Focused Rust corpus round-trips every lifecycle state byte-equivalently and passes 2/2.
- **Committed in:** `9ba21799`

**2. [Rule 2 - Missing Critical] Enforced independent roster participant and slot uniqueness**

- **Found during:** Task 1 GREEN
- **Issue:** JSON Schema `uniqueItems` rejects duplicate objects but cannot reject distinct objects that reuse only a participant ID or only a machine slot, which would permit participant substitution or ambiguous membership.
- **Fix:** Emitted `x-liiiraa-unique-roster-bindings` from TypeSpec, compiled it into standalone AJV code, and applied the equivalent bounded semantic check in the Rust public validator. Typify receives the same structural schema with the unsupported annotation removed, while runtime Schema retains it.
- **Files modified:** `packages/contracts-source/src/transactional-plans.tsp`, `packages/contracts-ts/scripts/generate-standalone.mjs`, `tooling/contract-generation/src/generate.ts`, `crates/contracts-rust/src/validation.rs`, generated validators/transports, invalid corpus
- **Verification:** Independent duplicate-participant and duplicate-slot mutations are rejected by both TypeScript and Rust; full contract gate passes.
- **Committed in:** `9ba21799`

**3. [Rule 3 - Blocking] Regenerated the complete bounded artifact set**

- **Found during:** Task 1 GREEN
- **Issue:** The canonical generator owns 12 artifacts atomically, so updating only the plan-listed standalone Schema/TS/Rust files would fail drift and leave OpenAPI definitions inconsistent.
- **Fix:** Ran the existing bounded generator and included its required generated OpenAPI change; no handwritten DTO or output path was added.
- **Files modified:** `contracts/generated/http/openapi.json`
- **Verification:** `pnpm contracts:check` reports all 12 artifacts drift-free and compatibility remains green.
- **Committed in:** `9ba21799`

---

**Total deviations:** 3 auto-fixed (1 Rule 1 bug, 1 Rule 2 missing critical functionality, 1 Rule 3 blocker)
**Impact on plan:** All fixes preserve the planned closed authority and generated-only consumer model; no execution primitive, package, dependency, or trust source was introduced.

## Issues Encountered

- AJV standalone cannot serialize a closure-backed custom validator. The keyword was implemented with AJV code generation so the emitted validator remains self-contained and deterministic.
- The Rust transport generator rejects unknown JSON Schema keywords. The generation adapter now removes only the semantic annotation from typify input; the public Rust validator independently enforces the same rule against the canonical runtime Schema.

## Verification

- `rtk pnpm test:contracts` - drift passed for 12 artifacts, compatibility passed, TypeScript 167/167, all Rust contract suites passed.
- `rtk cargo test -p liiiraa-contracts-rust --test transactional_plans_corpus` - 2 passed, 0 failed.
- Generated-schema acceptance probe confirmed all five root families, the three exact stages, two literal friends-roster paths, six lifecycle states, and generated uniqueness annotation.
- `rtk git diff --check` - passed before GREEN commit.

## Known Stubs

None. All five document families have generated runtime validation and corpus coverage; physical signing, live-byte verification, builders, and runners remain explicit downstream plan responsibilities.

## Authentication Gates

None.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness

- Plans 06-31/06-35 can build and verify installed/portable custody without inventing DTOs, generic paths, or caller trust.
- Plans 06-32/06-33 can freeze the fixed-path signed roster and consume the exact configs/continuation chain with observation-first recovery.
- No contract drift, compatibility, TypeScript, Rust, role/path, roster-uniqueness, or lifecycle blocker remains.

## Self-Check: PASSED

- All six representative source/generated/corpus files exist on disk.
- RED `eb1ac623` and GREEN `9ba21799` exist in git history in the required order.
- Full contract generation/drift/compatibility and focused TypeScript/Rust corpus gates pass.
- Requirements `[PLAN-01, PLAN-05, PLAN-06, PLAN-07, PLAN-08]` exactly match the plan frontmatter.
- Stub scan found no TODO, FIXME, placeholder, coming-soon, or unavailable implementation in modified source/test files.

---

*Phase: 06-transactional-plans-and-recovery*
*Completed: 2026-08-13*
