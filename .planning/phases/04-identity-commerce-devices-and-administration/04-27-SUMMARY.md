---
phase: 04-identity-commerce-devices-and-administration
plan: "27"
subsystem: identity-entitlements
tags: [ed25519, offline-entitlement, fastify, exact-byte, postgres-authority, tdd]

requires:
  - phase: 04-03
    provides: Generated OfflineEntitlementEnvelope TypeScript and Rust transports
  - phase: 04-04
    provides: PostgreSQL subscription, premium-entitlement, device-binding, audit, and outbox schema
  - phase: 04-07
    provides: Exact-byte TypeScript/Rust Ed25519 verifier and fourteen-case corpus
  - phase: 04-13
    provides: Provider-reconciled subscription and Premium entitlement authority
  - phase: 04-14
    provides: Versioned singular active-device transaction boundary
provides:
  - Opaque-byte EntitlementSigningPort with public-only current and previous verification data
  - Transactional issue, silent-renewal, rotation, and revocation use cases
  - Authenticated Fastify issuance, renewal, revocation, version, and verification-key routes
  - Daemon-free exact-byte witness identical to the Rust-verified Plan 04-07 corpus
affects: [04-21, 04-28, 04-35, desktop-premium-authority, account-sync]

tech-stack:
  added: []
  patterns:
    - Opaque KeyObject custody behind an application signing port
    - Canonical JSON bytes shared by issuer and verifier before Ed25519 signing
    - Idempotency-before-version-arbitration inside one entitlement transaction

key-files:
  created:
    - packages/control-plane-application/src/ports/entitlement-signing.ts
    - packages/control-plane-application/src/use-cases/issue-offline-entitlement.ts
    - packages/control-plane-adapters/src/crypto/staging-entitlement-signer.ts
    - apps/api/src/modules/entitlements/routes.ts
    - apps/api/src/modules/entitlements/issuance.test.ts
  modified:
    - packages/contracts-ts/src/offline-entitlement.ts
    - packages/contracts-ts/src/offline-entitlement.test.ts
    - packages/contracts-ts/src/index.ts
    - packages/control-plane-application/src/index.ts
    - packages/control-plane-adapters/src/index.ts
    - apps/api/scripts/run-tests.mjs

key-decisions:
  - "Advance the entitlement aggregate version before encoding each issued or renewed envelope so stale retries cannot mint fresh authority."
  - "Publish bounded previous public keys during rotation while requiring the actual signing key to be the singular current key."
  - "Keep staging private material only as an injected non-exported Node KeyObject handle; DTOs, tables, logs, and responses contain public data only."

patterns-established:
  - "Exact-byte authority: encode canonical claims once, sign those opaque bytes, validate the generated envelope, then persist evidence atomically."
  - "Fail-closed entitlement admission: reconciled active subscription, active entitlement, exact active device, and both expected versions are mandatory."

requirements-completed: [IDEN-04, IDEN-06, IDEN-09]

duration: 18min
completed: 2026-08-05
status: complete
---

# Phase 04 Plan 27: Signed Offline Entitlement Lifecycle Summary

**Provider-reconciled Premium and singular active-device state now mint revocable Ed25519 envelopes whose canonical bytes are identical to the seven-day TypeScript/Rust corpus.**

## Performance

- **Duration:** 18 min
- **Started:** 2026-08-05T05:08:00Z
- **Completed:** 2026-08-05T05:26:28Z
- **Tasks:** 1 TDD task
- **Files modified:** 11

## Accomplishments

- Added issue and silent-renewal flows that lock subscription, entitlement, and device truth; reject pending, stale, disputed, revoked, revalidating, wrong-device, or unavailable-custody states; and persist version, audit, outbox, and idempotency evidence atomically.
- Added revocation that advances the entitlement version and revokes the active device in the same transaction, making the next online renewal fail closed.
- Added an Ed25519 staging signer that accepts only a protected `KeyObject` handle, returns detached signatures and bounded public verification keys, and preserves previous public keys across rotation.
- Proved the server envelope equals the Plan 04-07 canonical fixture byte-for-byte and remains accepted by both TypeScript and Rust verifier suites for exactly 604800 seconds.
- Exposed authenticated issuance, renewal, revocation, aggregate-version, and verification-key routes with provider-neutral failure responses.

## TDD Gates

- **RED:** `cc7325e` — the collected integration suite failed because `./routes.js` and the entitlement authority did not exist.
- **GREEN:** `5e135fe` — the minimal signing port, use cases, staging custody adapter, and routes made all focused witnesses pass.
- **REFACTOR:** `779a282` — issuer and verifier now share one canonical encoder; current-key windows, authenticated failure semantics, and reason-bearing audit evidence remain green.

## Task Commits

Each task phase was committed atomically:

1. **RED — entitlement issuance witnesses** — `cc7325e` (test)
2. **GREEN — signed entitlement lifecycle** — `5e135fe` (feat)
3. **REFACTOR — canonical byte encoder** — `779a282` (refactor)
4. **Rotation hardening** — `c925ce0` (fix)
5. **Architecture-safe corpus witness** — `061f024` (fix)

## Files Created/Modified

- `packages/control-plane-application/src/ports/entitlement-signing.ts` — opaque-byte signing and public verification-data custody contract.
- `packages/control-plane-application/src/use-cases/issue-offline-entitlement.ts` — transactional issue, renew, and revoke authority with version and eligibility locks.
- `packages/control-plane-adapters/src/crypto/staging-entitlement-signer.ts` — Ed25519 `KeyObject` signer with current/previous public key-ring projection.
- `apps/api/src/modules/entitlements/routes.ts` — authenticated issue, renew, revoke, version, and public-key endpoints.
- `apps/api/src/modules/entitlements/issuance.test.ts` — daemon-free integration repository, exact corpus equality, denial matrix, rotation, revocation, route, and custody witnesses.
- `packages/contracts-ts/src/offline-entitlement.ts` — shared canonical claim encoder used by both verifier corpus and issuer.
- `packages/contracts-ts/src/offline-entitlement.test.ts` — corpus assertion that the shared encoder reproduces the frozen payload bytes.
- `apps/api/scripts/run-tests.mjs` — explicit alias for the plan's `entitlement-issuance` verification command.
- Package public roots — export the new application, adapter, and verifier APIs without private deep imports.

## Decisions Made

- Each successful issue or renewal advances the entitlement version before encoding, and retries resolve by command id before expected-version arbitration.
- The custody port never exposes private-key export methods or bytes. Rotation publishes one current public key plus bounded previous/retired public verification records.
- The API response contains only the generated envelope or provider-neutral status; aggregate and device versions remain explicit on revocation/version projections.
- The daemon-free integration witness reads the immutable corpus as test data without creating a private cross-module import edge.

## Verification

- `pnpm --filter @liiiraa/api test -- --run entitlement-issuance`: **PASS** — 12/12 focused issuance, denial, renewal, rotation, revocation, route, and custody tests.
- `pnpm --filter @liiiraa/api test`: **PASS** — 108/108 daemon-free API tests across 14 files.
- `pnpm --filter @liiiraa/contracts-ts test -- --run offline-entitlement`: **PASS** — 51/51 TypeScript contract/corpus tests.
- `cargo test -p liiiraa-desktop offline_entitlement`: **PASS** — 15 Rust exact-byte verifier tests; 30 unrelated tests filtered.
- `pnpm exec tsc --noEmit -p apps/api/tsconfig.json`: **PASS** — strict TypeScript compilation.
- `pnpm run test:architecture`: **PASS** — live workspace/Cargo adapters plus 46 architecture tests.
- Prettier check over all changed source/test files: **PASS**.
- Key-material scans: **PASS** — no private-key bytes, PKCS#8 payloads, private PEM blocks, or key logging in application ports/use cases/routes/tables; the adapter exports only the derived public SPKI bytes.
- Stub and deletion scans: **PASS** — no blocking stubs and no tracked deletions.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] Resolved the planned focused-test alias**
- **Found during:** RED gate
- **Issue:** Vitest treated `entitlement-issuance` as a file filter and collected no files because the planned artifact is `modules/entitlements/issuance.test.ts`.
- **Fix:** Added one explicit alias in the existing API test runner.
- **Files modified:** `apps/api/scripts/run-tests.mjs`
- **Verification:** The exact planned command collects the intended file and now passes 12 tests.
- **Committed in:** `cc7325e`

**2. [Rule 1 - Bug] Made the key-material witness BigInt-safe**
- **Found during:** GREEN gate
- **Issue:** Serializing the in-memory repository for the private-material scan threw on legitimate bigint versions.
- **Fix:** Added a test-only bigint-to-string JSON replacer without changing the scanned authority values.
- **Files modified:** `apps/api/src/modules/entitlements/issuance.test.ts`
- **Verification:** The custody witness and strict typecheck pass.
- **Committed in:** `5e135fe`

**3. [Rule 2 - Missing Critical] Preserved verification continuity across key rotation**
- **Found during:** Refactor review
- **Issue:** Publishing only the new current public key would make still-valid seven-day envelopes unverifiable immediately after rotation.
- **Fix:** Added bounded public-only previous-key records and required the signing key itself to be the singular current key.
- **Files modified:** signing port, staging signer, issuance use case, and integration test.
- **Verification:** Rotation tests expose current plus previous public keys while all exact-byte tests remain green.
- **Committed in:** `c925ce0`

**4. [Rule 1 - Bug] Removed private module deep-import edges from the corpus witness**
- **Found during:** Overall architecture verification
- **Issue:** Static JSON imports from the contracts fixture directory violated the canonical single public-root rule.
- **Fix:** Kept the immutable corpus as runtime test data without a cross-module import edge.
- **Files modified:** `apps/api/src/modules/entitlements/issuance.test.ts`
- **Verification:** `pnpm run test:architecture` passes both live adapters and all 46 architecture tests.
- **Committed in:** `061f024`

---

**Total deviations:** 4 auto-fixed (2 bugs, 1 missing critical security/correctness behavior, 1 blocking harness issue).
**Impact on plan:** All changes were required to execute the specified gate, preserve seven-day rotation continuity, or satisfy existing architecture policy; no product scope was added.

## Issues Encountered

- The planned test alias initially failed before collection and was repaired during RED.
- The first full architecture run caught the private fixture imports; the witness was corrected and the canonical gate rerun to green.

## Known Stubs

None.

## User Setup Required

None - the staging signer receives an injected protected key handle and all verification is daemon-free and local.

## Next Phase Readiness

- Plan 04-21 can consume the exact envelope and silent-renewal semantics through desktop `PremiumAuthority`.
- Plans 04-28 and 04-35 can consume entitlement change outbox/version projections for notification and next-contact synchronization.
- No blocker remains for this plan. Production key-provider composition remains intentionally outside this staging custody adapter.

## Self-Check: PASSED

- All five created artifacts exist.
- RED, GREEN, REFACTOR, rotation-hardening, and architecture-fix commits exist in order.
- Exact API, TypeScript corpus, Rust corpus, strict type, formatting, architecture, key-material, stub, and deletion gates passed.
- `.impeccable/` and `apps/desktop/src-tauri/gen/` remain unmodified and unstaged.

---
*Phase: 04-identity-commerce-devices-and-administration*
*Completed: 2026-08-05*
