---
phase: 04-identity-commerce-devices-and-administration
plan: "07"
subsystem: identity
tags: [ed25519, offline-entitlement, rust, typescript, exact-byte, clock-rollback]

requires:
  - phase: 04-03
    provides: Generated OfflineEntitlementEnvelope contracts and validators
  - phase: 04-06
    provides: Protected device-binding evidence
  - phase: 04-31
    provides: Acknowledged 14-case TypeScript and Rust RED witnesses
provides:
  - Exact-byte Ed25519 verification before payload parsing in TypeScript and Rust
  - Deterministically hashed shared 14-case entitlement fixture corpus and raw public-key ring
  - Seven-day expiry, binding, key rotation, entitlement-version, and monotonic-clock enforcement
affects: [04-23, 04-27, desktop-identity, entitlement-issuance, release-gates]

tech-stack:
  added: [ed25519-dalek 3.0.0, base64 0.22.1]
  patterns: [signature-before-schema-validation, injected-monotonic-time-store, cross-language-fixture-parity]

key-files:
  created:
    - packages/contracts-ts/src/offline-entitlement.ts
    - packages/contracts-ts/src/fixtures/offline-entitlement/manifest.json
    - packages/contracts-ts/src/fixtures/offline-entitlement/valid.json
    - packages/contracts-ts/src/fixtures/offline-entitlement/invalid.json
    - apps/desktop/src-tauri/src/offline_entitlement.rs
  modified:
    - packages/contracts-ts/src/offline-entitlement.test.ts
    - apps/desktop/src-tauri/tests/offline_entitlement.rs
    - apps/desktop/src-tauri/Cargo.toml
    - Cargo.lock

key-decisions:
  - "Verify the decoded opaque payload bytes before generated envelope validation or claim deserialization."
  - "Keep raw 32-byte Ed25519 public keys in the shared manifest; TypeScript derives SPKI locally while Rust consumes the same bytes directly."
  - "Accept previous signing keys only when both issuance and verification time are inside the declared rotation window."
  - "Advance the injected trusted clock only after every cryptographic, schema, binding, version, and time check succeeds."

patterns-established:
  - "Offline authority failures collapse to the non-accusatory online-verification-required verdict."
  - "Cross-runtime crypto fixtures carry exact payload bytes, deterministic signatures, stable IDs, and SHA-256 file identities."

requirements-completed: [IDEN-06]

duration: 18 min
completed: 2026-08-05
status: complete
---

# Phase 04 Plan 07: Exact-Byte Offline Entitlement Summary

**Exact-byte Ed25519 parity now limits Premium offline authority to seven days and fails closed on tamper, binding, rotation, expiry, version, or clock contradictions.**

## Performance

- **Duration:** 18 min
- **Started:** 2026-08-04T23:48:00Z
- **Completed:** 2026-08-05T00:05:51Z
- **Tasks:** 1 TDD feature
- **Files modified:** 13

## Accomplishments

- Turned all 14 acknowledged `EXPECTED_RED[04-07-01]` witnesses green in TypeScript and Rust without deleting, skipping, weakening, or reclassifying a case.
- Authenticated the exact decoded payload bytes with Ed25519 before generated schema validation and JSON claim parsing.
- Enforced exactly 604800 seconds, inclusive verification at the expiry boundary, account/device/audience/version binding, key lifecycle and rotation windows, future issuance, expiry, and monotonic trusted time.
- Proved deterministic fixture integrity with SHA-256 identities and regenerated every synthetic signature with Node built-in crypto from fixed test seeds.

## TDD Gates

### RED

- `362704a` — `test(04-07): preserve exact-byte entitlement RED corpus`
- TypeScript: 14/14 owner-tagged failures after corpus integrity, generated admission, and deterministic signature checks passed.
- Rust: 14/14 matching owner-tagged failures from the same raw fixture files and public-key identities.

### GREEN

- `d568daf` — `feat(04-07): verify seven-day offline entitlements`
- TypeScript focused gate: 14/14 passed; 56 ms test time, 862 ms total runtime.
- Rust focused gate: 15 passed in 0.05 s (14 parity cases plus canonical UTC/seven-day arithmetic).
- Desktop build: passed in 0.58 s.
- Cargo/root supply-chain gate: passed; 72 exact dependency pins verified in 22.2 s.

### REFACTOR

- No separate refactor commit was necessary; format and type gates passed on the minimal GREEN implementation.

## Task Commits

1. **Task 04-07-01 RED: preserve shared hashed corpus** — `362704a` (test)
2. **Task 04-07-01 GREEN: implement exact-byte cross-runtime verification** — `d568daf` (feat)

## Files Created/Modified

- `packages/contracts-ts/src/offline-entitlement.ts` — Node Ed25519 verifier, shared verdicts, key policy, binding/time checks, and trusted-time port.
- `packages/contracts-ts/src/fixtures/offline-entitlement/manifest.json` — corpus hashes, verdict vocabulary, seven-day constant, and raw key ring.
- `packages/contracts-ts/src/fixtures/offline-entitlement/valid.json` — canonical exact-byte entitlement accepted through the seven-day boundary.
- `packages/contracts-ts/src/fixtures/offline-entitlement/invalid.json` — thirteen tamper, key, binding, expiry, version, and rollback rejections.
- `packages/contracts-ts/src/offline-entitlement.test.ts` — fixture signing/integrity proof and executable 14-case TypeScript parity suite.
- `apps/desktop/src-tauri/src/offline_entitlement.rs` — strict Dalek verification, generated contract admission, claim mapping, and monotonic clock enforcement.
- `apps/desktop/src-tauri/tests/offline_entitlement.rs` — executable 14-case Rust parity suite with the same fixture bytes and keys.
- `apps/desktop/src-tauri/Cargo.toml`, `Cargo.lock` — exact `ed25519-dalek` and `base64` pins and resolved transitive graph.
- `packages/contracts-ts/package.json`, `packages/contracts-ts/tsconfig.json`, `pnpm-lock.yaml` — package-local Node built-in type support.
- `apps/desktop/src-tauri/src/main.rs` — compiles the verifier into the desktop host target.

## Decisions Made

- The signed payload is base64url-decoded once and those exact bytes are passed directly to the crypto verifier; parsed or reserialized JSON is never signature input.
- Both runtimes expose only `verified` and `online-verification-required`; cryptographic failures never accuse the user of fraud.
- Current and previous keys are bounded by explicit not-before/not-after timestamps; retired and unknown keys always fail closed.
- Verification at `expiresAt` is valid, while one second later requires online verification.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] Added package-local Node built-in typings**
- **Found during:** Task 04-07-01 GREEN typecheck
- **Issue:** The contracts package explicitly allowed only Vitest types, so the planned Node crypto/fs implementation passed runtime tests but failed strict TypeScript compilation.
- **Fix:** Added the already-approved exact `@types/node` 24.13.3 development pin and enabled the `node` type library locally.
- **Files modified:** `packages/contracts-ts/package.json`, `packages/contracts-ts/tsconfig.json`, `pnpm-lock.yaml`
- **Verification:** `pnpm --filter @liiiraa/contracts-ts check` passed.
- **Committed in:** `d568daf`

**2. [Rule 3 - Blocking] Wired the Rust verifier into the desktop build target**
- **Found during:** Task 04-07-01 GREEN integration
- **Issue:** An unwired source file would compile only through its integration test and would not satisfy the plan-level desktop build gate.
- **Fix:** Registered `offline_entitlement` in the desktop binary module tree.
- **Files modified:** `apps/desktop/src-tauri/src/main.rs`
- **Verification:** `cargo build -p liiiraa-desktop` passed.
- **Committed in:** `d568daf`

---

**Total deviations:** 2 auto-fixed blocking integration issues.
**Impact on plan:** Both changes were narrow correctness seams required to compile the planned implementation; no authority, schema, endpoint, or infrastructure scope was added.

## Issues Encountered

- The generated detached-signature and opaque-byte contracts require base64url rather than standard base64. Fixtures were normalized to the generated contract alphabet before the RED commit, then hashed and consumed unchanged by both runtimes.

## Known Stubs

None.

## Authentication Gates

None.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness

- Plan 04-27 can issue and renew entitlements against the now-executable verifier contract.
- Plan 04-23 can bind internal desktop release/channel behavior to the same fail-closed offline authority.
- No blockers remain for downstream Phase 04 entitlement integration.

## Self-Check: PASSED

- All five created artifacts exist on disk.
- RED commit `362704a` and GREEN commit `d568daf` exist in repository history.
- The focused 14-case TypeScript suite, Rust parity suite, desktop build, formatting, typecheck, and supply-chain gate all pass.
- No goal-blocking stubs or unplanned security surfaces were found.

---
*Phase: 04-identity-commerce-devices-and-administration*
*Completed: 2026-08-05*
