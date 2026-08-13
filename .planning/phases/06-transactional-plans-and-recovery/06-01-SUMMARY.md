---
phase: 06-transactional-plans-and-recovery
plan: '01'
subsystem: generated-contracts
tags: [typespec, json-schema, ajv, rust, recovery, transactions]
requires:
  - phase: 05-hardware-intelligence-and-measured-evidence
    provides: Runtime-validated hardware evidence, evidence hashes, and quality provenance
provides:
  - Closed language-neutral transactional plan and recovery document family
  - Generated Draft 2020-12 runtime schema plus TypeScript and Rust transports
  - Cross-runtime accepted/rejected corpus for authority, disclosure, progress, promotion, and receipt boundaries
affects: [06-02, 06-03, 06-09, 06-11, 06-12, 06-13, plan-engine, recovery-store, privileged-broker]
tech-stack:
  added: []
  patterns: [immutable-plan-revision, explicit-lifecycle-unions, narrow-broker-contracts, shared-cross-runtime-corpus]
key-files:
  created:
    - packages/contracts-source/src/transactional-plans.tsp
    - contracts/generated/desktop/v1/transactional-recovery.schema.json
    - packages/contracts-ts/src/transactional-plans.test.ts
    - crates/contracts-rust/tests/transactional_plans_corpus.rs
  modified:
    - packages/contracts-source/src/main.tsp
    - tooling/contract-generation/src/generate.ts
    - crates/contracts-rust/src/validation.rs
key-decisions:
  - 'Represent transaction and recovery truth as closed discriminated documents rather than optional status fields.'
  - 'Publish TransactionalRecoveryDocument as a first-class generated schema with Ajv and Rust runtime validation entrypoints.'
  - 'Use uint32 for bounded event sequences and replay counters so TypeScript and Rust consume identical numeric JSON.'
patterns-established:
  - 'Every mutation boundary carries exact prior, requested, and observed state plus immutable audit identity.'
  - 'Privileged broker transports expose only exact managed-power-scheme and restore-point operations.'
requirements-completed: [PLAN-01, PLAN-02, PLAN-03, PLAN-04, PLAN-05, PLAN-06, PLAN-07, PLAN-08]
duration: 11 min
completed: 2026-08-13
status: complete
---

# Phase 06 Plan 01: Transactional Contract Authority Summary

**TypeSpec now generates one closed transactional recovery authority for plans, approvals, durable journal truth, receipts, promotion, revocation, local Advanced preference, and narrow privileged broker messages with identical TypeScript and Rust validation.**

## Performance

- **Duration:** 11 min
- **Started:** 2026-08-13T06:06:52Z
- **Completed:** 2026-08-13T06:17:20Z
- **Tasks:** 2
- **Files modified:** 17

## Accomplishments

- Defined immutable plan revisions with every PLAN-03 field, evidence/device fingerprints, dependency groups, risk ceilings, approvals, recovery checkpoints, transactions, verified receipts, and ordered progress.
- Modeled prepared, dispatch-returned, observed, verified, not-applied, unknown, drift, conflict, restore-prepared, and restored journal truth as mutually exclusive documents.
- Kept Extremo non-executable and excluded generic command, script, PowerShell, registry, file, service, and remote rollback authority from broker transports.
- Bound device-local Advanced preference intents, events, and projections to hardware/security posture fingerprints, action-scoped proof references, sequences, and audit identity.
- Added a generated standalone recovery schema, Ajv validator, Rust jsonschema/deserialization entrypoint, and byte-stable accepted/rejected corpus shared by both runtimes.

## Task Commits

1. **Task 1: Define the closed transactional document family** - `8eb9dfe5` (feat)
2. **Task 2: Prove generated TypeScript and Rust parity** - `44cee96f` (test)

## Files Created/Modified

- `packages/contracts-source/src/transactional-plans.tsp` - Canonical Phase 6 document family and bounded authority.
- `packages/contracts-source/src/main.tsp` - Imports the transactional source exactly once.
- `contracts/generated/desktop/v1/transactional-recovery.schema.json` - Standalone generated runtime boundary schema.
- `tooling/contract-generation/src/generate.ts` - Registers recovery schema, generated roots, and transport aliases.
- `packages/contracts-ts/scripts/generate-standalone.mjs` - Emits the standalone Ajv recovery validator.
- `packages/contracts-ts/src/fixtures/transactional-plans/valid.json` - Accepted document-kind and durable-verdict corpus.
- `packages/contracts-ts/src/fixtures/transactional-plans/invalid.json` - Rejected authority, disclosure, progress, promotion, and receipt corpus.
- `packages/contracts-ts/src/transactional-plans.test.ts` - TypeScript parity and coverage assertions.
- `crates/contracts-rust/src/validation.rs` - Rust schema validation, deserialization, and contiguous-progress enforcement.
- `crates/contracts-rust/tests/transactional_plans_corpus.rs` - Rust execution of the same JSON corpus.

## Decisions Made

- Transaction lifecycle truth is structural: each durable verdict owns its required fields, so an unknown or conflict result cannot masquerade as verified success.
- Promotion stage progression is structural: later stages require the exact immediately previous stage and promotion identity.
- Progress event continuity is checked at both public runtime entrypoints; a gap requires an authoritative snapshot rather than inferred progress.
- The generator treats transactional recovery as a public root, ensuring generated transport types alone cannot be mistaken for runtime boundary validation.

## Verification

- Canonical regeneration passed with 12 normalized artifacts.
- Contract drift and compatibility gates passed.
- TypeScript contracts: 122/122 tests passed across five suites.
- Rust contracts: all unit, corpus, provenance, shell, and transactional suites passed.
- Dedicated transactional Rust corpus: 2/2 tests passed.
- Source scan confirmed all PLAN-03 metadata, every durable journal verdict, one canonical import, and no generic mutation surface.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 2 - Missing Critical] Published runtime validation for the new contract root**
- **Found during:** Task 2 (Prove generated TypeScript and Rust parity)
- **Issue:** The generator emitted transport types for new TypeSpec definitions but had no first-class recovery schema, Ajv validator, or Rust validation entrypoint.
- **Fix:** Added `TransactionalRecoveryDocument` to the owned artifact registry, generated schema roots, TypeScript exports, standalone Ajv generation, and Rust jsonschema-before-deserialization boundary.
- **Files modified:** `tooling/contract-generation/src/generate.ts`, `packages/contracts-ts/scripts/generate-standalone.mjs`, `crates/contracts-rust/src/validation.rs`, generated artifacts.
- **Verification:** Clean regeneration, drift/compatibility gates, TypeScript suite, and Rust corpus all pass.
- **Committed in:** `44cee96f`

**2. [Rule 1 - Bug] Preserved numeric JSON parity for bounded counters**
- **Found during:** Task 2 parity verification
- **Issue:** TypeSpec `uint64` correctly generated JSON strings in Rust-safe transports while the initial corpus used JSON numbers, causing otherwise-valid cross-runtime vectors to fail.
- **Fix:** Bounded journal/progress sequences and broker replay counters to `uint32`, whose range is sufficient for these per-document counters and whose JSON representation is numeric in both runtimes.
- **Files modified:** `packages/contracts-source/src/transactional-plans.tsp` and generated artifacts.
- **Verification:** The shared TypeScript and Rust corpora pass without runtime-specific fixture variants.
- **Committed in:** `44cee96f`

---

**Total deviations:** 2 auto-fixed (1 missing critical functionality, 1 parity bug).
**Impact on plan:** Both fixes were required to make generated runtime validation and identical cross-runtime semantics real; no unrelated scope was added.

## Issues Encountered

- The plan's `rtk pnpm generate:contracts` command does not exist in the repository. The canonical repository command is `rtk pnpm contracts:generate`, which completed successfully.

## User Setup Required

None - no external service configuration required.

## Known Stubs

None.

## Next Phase Readiness

- Plans 06-02 and 06-03 can now consume generated plan/recovery transports without handwritten DTOs.
- Recovery storage, renderer authority, strong-auth bridge, and privileged broker work can validate every untrusted document against this canonical boundary.
- No blocker remains for the next plan.

## Self-Check: PASSED

- All key created files exist.
- Task commits `8eb9dfe5` and `44cee96f` exist.
- All task acceptance criteria and plan-level verification commands pass.

---

_Phase: 06-transactional-plans-and-recovery_
_Completed: 2026-08-13_
