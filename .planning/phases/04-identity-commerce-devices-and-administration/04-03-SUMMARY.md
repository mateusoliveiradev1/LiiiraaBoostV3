---
phase: 04-identity-commerce-devices-and-administration
plan: "03"
subsystem: contracts
tags: [typespec, json-schema, openapi, rust, typescript, ajv, oasdiff]
requires:
  - phase: 01-product-truth-and-modular-contracts
    provides: Canonical TypeSpec generation, cross-language transports, runtime validation, and immutable compatibility baseline
  - phase: 03-global-web-experience
    provides: Byte-stable FutureAuthorityCommand, NoChangeReceipt, and AdminAuditEvent fixture contracts
  - phase: 04-identity-commerce-devices-and-administration
    provides: Wave 0 control-plane workspace boundaries and deterministic database harness seams from Plan 04-02
provides:
  - Closed bounded Phase 4 projections, commands, receipts, errors, events, consent, and offline entitlement transports
  - Isolated production control-plane JSON Schema with generated TypeScript and Rust consumers
  - Checksummed oasdiff 1.26.0 compatibility execution for the first additive HTTP operations
affects: [04-04, 04-05, 04-06, 04-07, 04-08, 04-09, 04-18, 04-19, 04-21, 04-27]
tech-stack:
  added: []
  patterns:
    - TypeSpec operations and closed models remain the only editable transport authority
    - Production and fixture documents compile to separate standalone validators
    - External compatibility binaries are official-release, version, checksum, and archive-path verified before execution
key-files:
  created:
    - packages/contracts-source/src/control-plane.tsp
    - contracts/generated/control-plane/v1/control-plane-document.schema.json
    - tooling/contract-compat/oasdiff.lock.json
    - tooling/contract-compat/src/check-openapi.ts
  modified:
    - packages/contracts-source/src/main.tsp
    - tooling/contract-generation/src/generate.ts
    - tooling/contract-generation/src/check-drift.ts
    - packages/contracts-ts/scripts/generate-standalone.mjs
    - packages/contracts-ts/src/generated/index.ts
    - packages/contracts-ts/src/generated/models.ts
    - packages/contracts-ts/src/generated/standalone-validators.js
    - packages/contracts-ts/src/generated/standalone-validators.d.ts
    - crates/contracts-rust/src/generated.rs
    - crates/contracts-rust/src/validation.rs
    - contracts/generated/http/openapi.json
    - tooling/contract-compat/src/check-compat.ts
key-decisions:
  - "Emit control-plane documents into an isolated schema so every Phase 3 desktop and web fixture schema remains byte-stable."
  - "Represent offline entitlement claims as opaque signed bytes plus an exact 604800-second envelope marker; parsing never grants unverified authority."
  - "Download oasdiff only from its official 1.26.0 release and verify the locked archive checksum and reported executable version before every compatibility comparison."
patterns-established:
  - "Authority provenance is a closed production-only union that structurally excludes fixture provenance and simulated no-change fields."
  - "Mutation commands require expectedVersion and correlationId; receipts return aggregateVersion, etag, auditReference, and bounded outcomes."
  - "Rust transports may normalize unsupported type-generation keywords in memory, while the canonical runtime schema retains uniqueItems and pattern enforcement before deserialization."
requirements-completed: [WEB-04, WEB-05, WEB-06, WEB-07, IDEN-01, IDEN-02, IDEN-03, IDEN-04, IDEN-05, IDEN-06, IDEN-07, IDEN-08, IDEN-09]
metrics:
  duration: 26 min
  completed: 2026-08-04
  tasks: 2
  files: 16
status: complete
---

# Phase 04 Plan 03: Control-Plane Transport Contract Summary

**Closed TypeSpec authority now generates isolated TypeScript/Rust control-plane transports, runtime validators, additive HTTP operations, and a checksum-pinned oasdiff 1.26.0 compatibility gate without changing Phase 3 fixture schemas.**

## Performance

- **Duration:** 26 min
- **Started:** 2026-08-04T20:34:16Z
- **Completed:** 2026-08-04T21:00:24Z
- **Tasks:** 2
- **Files modified:** 16

## Accomplishments

- Defined every planned Phase 4 projection and boundary document with closed states, bounded/redacted identifiers, mandatory optimistic versions, correlations, audit references, and production-only provenance.
- Generated one isolated control-plane schema plus TypeScript and Rust models/validators while retaining byte-identical Phase 3 desktop and web schema artifacts.
- Added the first additive account/admin OpenAPI operations and made the compatibility command execute the official checksummed oasdiff 1.26.0 binary rather than treating a missing tool as success.
- Enforced duplicate collection rejection, missing `expectedVersion`, unknown states, fixture provenance, overlong identifiers, and invalid seven-day entitlement markers in both generated TypeScript admission and Rust runtime validation.

## Task Commits

1. **Task 04-03-01 RED: register failing control-plane contract seam** — `71edecc` (`test`)
2. **Task 04-03-01 GREEN: specify closed control-plane contracts** — `1055ec1` (`feat`)
3. **Task 04-03-02: generate runtimes and enforce compatibility** — `590c2fc` (`feat`)

## Files Created/Modified

- `packages/contracts-source/src/control-plane.tsp` — canonical closed models and TypeSpec operation declarations for identity, sessions, commerce, devices, support, consent, administration, audit, and offline entitlement transport.
- `packages/contracts-source/src/main.tsp` — registers the control-plane source exactly once.
- `contracts/generated/control-plane/v1/control-plane-document.schema.json` — standalone production validator authority, structurally disjoint from Phase 3 fixtures.
- `tooling/contract-generation/src/generate.ts` — isolates legacy, web, and control-plane definitions; derives OpenAPI/TypeScript/Rust outputs and invokes standalone generation.
- `tooling/contract-generation/src/check-drift.ts` — compares all 12 canonical outputs, including the new schema and standalone validators.
- `packages/contracts-ts/scripts/generate-standalone.mjs` — emits separately named production and fixture validators and runs the TypeScript control-plane admission matrix.
- `packages/contracts-ts/src/generated/index.ts` — exposes the production control-plane standalone validator with generated transports.
- `packages/contracts-ts/src/generated/models.ts` — generated TypeScript control-plane types.
- `packages/contracts-ts/src/generated/standalone-validators.js` and `standalone-validators.d.ts` — generated AJV validators and typed declarations.
- `crates/contracts-rust/src/generated.rs` — generated Rust control-plane transports.
- `crates/contracts-rust/src/validation.rs` — validates canonical control-plane JSON Schema before transport deserialization and tests the parity matrix.
- `contracts/generated/http/openapi.json` — additive account projection and administrative command operations with generated component schemas.
- `tooling/contract-compat/oasdiff.lock.json` — official 1.26.0 release assets and SHA-256 checksums for supported platforms.
- `tooling/contract-compat/src/check-openapi.ts` — safe download, checksum, archive, version, and breaking-change runner.
- `tooling/contract-compat/src/check-compat.ts` — delegates non-empty HTTP compatibility to the pinned runner while retaining all baseline rules.

## Decisions Made

- Isolated all new definitions behind `ControlPlaneDocument`; legacy desktop and web roots explicitly exclude the new owned definitions, while the control-plane schema pulls only its dependency closure.
- Kept Phase 3 `FutureAuthorityCommand`, `NoChangeReceipt`, and fixture `AdminAuditEvent` unchanged. Authoritative receipts use positive outcomes and production provenance rather than `remoteStateChanged: false` or `simulated-no-change`.
- Added `validitySeconds: 604800` to the opaque offline envelope so the seven-day policy is contract-visible while later cryptographic code remains responsible for verifying exact bytes, device binding, key, and timestamps before parsing claims.
- Kept oasdiff out of package installation and PATH assumptions: the runner verifies the official locked release in a temporary directory and removes it after each execution.

## Verification Results

- `pnpm test:contracts`: **PASS** — drift check covered 12 artifacts, compatibility passed, 37 TypeScript tests passed, and 11 Rust tests passed across five suites.
- `pnpm contracts:compat`: **PASS** — non-empty OpenAPI comparison executed checksum-verified oasdiff 1.26.0 against the immutable baseline.
- `node tooling/contract-compat/src/check-openapi.ts --oasdiff-version 1.26.0`: **PASS** — checksum and executable version verified.
- `node tooling/contract-compat/src/check-openapi.ts --oasdiff-version 1.26.0 --baseline contracts/generated/http/openapi.json --candidate contracts/generated/http/openapi.json`: **PASS** — pinned CLI comparison executed successfully.
- `pnpm --filter @liiiraa/contract-generation test`: **PASS** — bounded path, corpus integrity, and generic drift mutation tests passed.
- `pnpm --filter @liiiraa/contract-compat test`: **PASS** — two additive fixtures accepted and four breaking fixtures rejected.
- TypeSpec, contract-generation TypeScript, contract-compat TypeScript, contracts-ts TypeScript, ESLint, and `cargo fmt --check`: **PASS**.
- Git byte comparison over all five Phase 3 desktop/web schema artifacts: **PASS**, no differences.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 2 - Missing Critical] Added omitted isolated generation and drift seams**
- **Found during:** Task 04-03-02
- **Issue:** The plan required separate production validators, preserved Phase 3 fixtures, and deterministic drift, but omitted the generator, standalone generator, drift registry, and isolated generated schema/OpenAPI outputs from declared ownership.
- **Fix:** Narrowly extended the existing canonical generator, standalone validator generator, and generic drift path list; emitted the isolated control-plane schema and required OpenAPI artifact through that flow.
- **Files modified:** `tooling/contract-generation/src/generate.ts`, `tooling/contract-generation/src/check-drift.ts`, `packages/contracts-ts/scripts/generate-standalone.mjs`, `contracts/generated/control-plane/v1/control-plane-document.schema.json`, `contracts/generated/http/openapi.json`
- **Verification:** `pnpm contracts:check` reports 12 deterministic artifacts and all Phase 3 schema files remain byte-identical.
- **Committed in:** `590c2fc`

**2. [Rule 2 - Missing Critical] Connected the declared pinned OpenAPI runner to the live compatibility command**
- **Found during:** Task 04-03-02
- **Issue:** Adding `check-openapi.ts` alone could not satisfy the plan because `pnpm contracts:compat` still called a private PATH-only `oasdiff` function in an omitted integration file.
- **Fix:** Delegated only the HTTP comparison from `check-compat.ts` to the checksum-pinned runner, preserving all existing SemVer, baseline hash, and desktop rules.
- **Files modified:** `tooling/contract-compat/src/check-compat.ts`
- **Verification:** Both the direct CLI gate and `pnpm contracts:compat` execute oasdiff 1.26.0 and pass the additive operation comparison.
- **Committed in:** `590c2fc`

**3. [Rule 2 - Missing Critical] Added the omitted Rust runtime validation seam**
- **Found during:** Task 04-03-02
- **Issue:** Generated Rust DTOs alone cannot meet TS/Rust validator parity; the existing public Rust validator module hardcoded only legacy schemas and was omitted from the plan file list.
- **Fix:** Bound and compiled the isolated control-plane schema once, exposed `validate_control_plane_document`, and added the same closed-boundary invalid matrix before generated transport deserialization.
- **Files modified:** `crates/contracts-rust/src/validation.rs`
- **Verification:** The Rust control-plane matrix and all legacy Rust contract suites pass.
- **Committed in:** `590c2fc`

---

**Total deviations:** 3 auto-fixed (3 missing critical functionality).
**Impact on plan:** Each scope expansion was the minimum existing seam required to make the explicit validator, compatibility, drift, and Phase 3 preservation criteria truthful; no package, provider, database, UI, or unrelated application scope was added.

## Known Stubs

None. The generated transports, validators, OpenAPI operations, and compatibility runner are fully wired. Provider behavior and cryptographic entitlement verification remain intentionally owned by later Phase 4 plans rather than represented by placeholders here.

## Issues Encountered

- The plan's focused command `pnpm test:contracts -- --run control-plane-contract` forwards `--run` to Rust's test harness and fails with `Unrecognized option: 'run'`; it does not select a focused contract test. The canonical unfiltered `pnpm test:contracts` command was run repeatedly and passed the complete TypeScript/Rust suite, including the new control-plane matrices.
- Typify's normalization gate does not accept JSON Schema `uniqueItems` or `pattern`. The generator removes only those two keywords from the in-memory Rust type-generation copy; the persisted canonical schema retains both and the Rust runtime validator enforces them before deserialization.

## User Setup Required

None - no credentials, provider accounts, package installation, or external service configuration are required. The compatibility gate provisions its locked temporary binary automatically.

## Next Phase Readiness

- Downstream domain, application, API, account/admin, desktop, and entitlement plans can import generated transports and the separate production validator without fixture authority leakage.
- Better Auth, payment provider, device binding, and cryptographic entitlement behavior remain gated by their dedicated Phase 4 plans; this contract plan grants none of those providers production approval.

## Self-Check: PASSED

- All declared created files and the canonical summary exist on disk.
- Task commits `71edecc`, `1055ec1`, and `590c2fc` exist in repository history.
- The 12-artifact drift gate and pinned OpenAPI compatibility gate pass after summary creation.
