---
phase: 04-identity-commerce-devices-and-administration
plan: '12'
subsystem: identity-security
tags: [mfa, step-up, recovery, contest, session-revocation, outbox]
requires:
  - phase: 04-04
    provides: PostgreSQL security-factor, session, recovery-hold, audit, and outbox schema
  - phase: 04-05
    provides: Approved Better Auth provider boundary and D-03 through D-06 factor/recovery policy
  - phase: 04-10
    provides: Immutable audit append authority
  - phase: 04-11
    provides: Owner-scoped session issuance and revocation authority
  - phase: 04-31
    provides: Owner-bound domain recovery RED witnesses
  - phase: 04-32
    provides: Owner-bound API recovery and MFA RED witnesses
provides:
  - Approved-factor enrollment and disable with recent action-scoped step-up
  - Reviewed total-factor-loss recovery with atomic session revocation and a minimum 24-hour critical-action hold
  - Trusted-session recovery/contest notifications, reviewer risk extension, audit evidence, and hashed one-use recovery-code redemption
  - Owner-bound HTTP operations for security methods, authorization, recovery request, review, contest, and risk extension
affects: [04-16, 04-17, 04-20, 04-28, account-security, admin-recovery]
tech-stack:
  added: []
  patterns:
    - Account-serialized recovery transition with session revocation before restored basic authority
    - Provider-verified scoped step-up mapped into a shared SensitiveAction policy
    - Trusted email-evidence verifier and provider-neutral notification outbox boundary
key-files:
  created:
    - packages/control-plane-domain/src/identity/recovery.ts
    - packages/control-plane-application/src/use-cases/security-methods.ts
    - packages/control-plane-application/src/use-cases/recover-account.ts
    - apps/api/src/modules/identity/security-routes.ts
  modified:
    - packages/control-plane-domain/src/identity/recovery.test.ts
    - apps/api/src/modules/identity/recovery.test.ts
    - packages/control-plane-domain/src/index.ts
    - packages/control-plane-application/src/index.ts
    - packages/control-plane-domain/package.json
    - packages/control-plane-application/tsconfig.json
key-decisions:
  - 'Accept verified-email recovery evidence only through an injected trusted verifier; request bodies cannot self-assert verification.'
  - 'Serialize recovery mutations per account and revoke affected sessions before saving the approved hold or projecting restored basic access.'
  - 'Store and compare only injected hashes for one-use recovery codes, with atomic consumption inside the recovery transaction.'
  - 'Keep recovery and contest notifications provider-neutral in the outbox so Plan 04-28 can deliver redacted templates idempotently.'
patterns-established:
  - 'Recovery approval order: review authorization -> account transaction -> revoke sessions -> save hold -> audit -> trusted-session outbox -> basic-access result.'
  - 'Sensitive actions require an approved, unexpired, exact-action step-up receipt and remain denied throughout active or contested holds.'
requirements-completed: [IDEN-02]
duration: 20 min
completed: 2026-08-05
status: complete
---

# Phase 04 Plan 12: MFA and Reviewed Recovery Authority Summary

**Approved TOTP/passkey/recovery-code step-up with reviewed total-factor-loss recovery, atomic session revocation, contested 24-hour holds, and trusted-session notification evidence**

## Performance

- **Duration:** 20 min
- **Started:** 2026-08-05T02:48:13Z
- **Completed:** 2026-08-05T03:08:23Z
- **Tasks:** 1
- **Files modified:** 10

## Accomplishments

- Replaced all four domain and five API owner-bound RED sentinels with executable policy, HTTP, and serializable transaction assertions, then turned every case green without weakening case identity or coverage.
- Restricted enrollment, disable, and sensitive actions to recent exact-action TOTP, passkey, or one-use recovery-code step-up; SMS, email, stale, wrong-action, and hold-bound evidence fail closed.
- Routed total factor loss to security review, rejected caller-controlled verified-email claims, revoked affected sessions before restoring basic access, and imposed a minimum 24-hour critical-action hold.
- Added contest and reviewer risk-extension transitions with immutable audit inputs and provider-neutral trusted-session outbox jobs while ordinary account access remains available.
- Proved twelve concurrent redemptions of one hashed recovery code yield exactly one success inside an account-serialized transaction.

## Task Commits

Each TDD gate was committed atomically:

1. **RED: Recovery authority witnesses** - `85668e4` (test)
2. **GREEN: Reviewed recovery authority** - `e3f0f84` (feat)
3. **REFACTOR: Strict recovery route typing** - `bf1585f` (refactor)

## Files Created/Modified

- `packages/control-plane-domain/src/identity/recovery.ts` - Pure recovery state machine, minimum hold, contest/risk extension, approved factors, and shared SensitiveAction authorization.
- `packages/control-plane-domain/src/identity/recovery.test.ts` - D-03 through D-06 evidence, review, hold, scoped step-up, and contest tables.
- `packages/control-plane-application/src/use-cases/security-methods.ts` - Provider-backed enrollment/disable and exact-scope recent-auth enforcement with audit input.
- `packages/control-plane-application/src/use-cases/recover-account.ts` - Account-serialized recovery-code consumption, review, session revocation, hold, audit, and outbox orchestration.
- `apps/api/src/modules/identity/security-routes.ts` - Owner/reviewer-bound HTTP operations with trusted email-evidence verification and generic failure responses.
- `apps/api/src/modules/identity/recovery.test.ts` - Five retained IDEN-02 owner cases using Fastify injection and a daemon-free serializable repository.
- `packages/control-plane-domain/src/index.ts` - Public recovery and SensitiveAction exports.
- `packages/control-plane-application/src/index.ts` - Public security-method and recovery use-case exports.
- `packages/control-plane-domain/package.json` - Domain test gate collects device and identity suites while preserving future paid-action RED ownership.
- `packages/control-plane-application/tsconfig.json` - Strict typecheck now includes all application ports and use cases.

## Decisions Made

- Verified-email recovery evidence is established by a trusted verifier port; a body boolean or email address alone never grants recovery authority.
- The recovery repository owns singular account transaction serialization, recovery-code consumption, session revocation, hold state, audit input, and outbox enqueue ordering.
- Approved exceptional recovery restores basic account access only after affected-session revocation and never bypasses the active/contested critical-action hold.
- Contest and risk-extension notices remain provider-neutral outbox records so email delivery can be added by Plan 04-28 without coupling the identity domain to a provider.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] Replaced live PostgreSQL execution with deterministic serializable transaction proof**

- **Found during:** Task 04-12-01 RED design
- **Issue:** The plan acceptance text requested real PostgreSQL while the execution contract explicitly prohibited Docker, Testcontainers, and live PostgreSQL.
- **Fix:** Used the established Phase 4 daemon-free serializable repository pattern with per-account promise arbitration, rollback snapshots, atomic recovery-code consumption, ordered session revocation, and observable audit/outbox effects against the existing PostgreSQL schema contract.
- **Files modified:** `apps/api/src/modules/identity/recovery.test.ts`
- **Verification:** Twelve concurrent code redemptions produce one success; review revokes sessions before saving the hold; all five API witnesses pass.
- **Committed in:** `e3f0f84`

**2. [Rule 2 - Missing Critical] Added narrow package exports and identity test/typecheck collection seams**

- **Found during:** Task 04-12-01 RED scaffold and GREEN verification
- **Issue:** Plan-declared authorities were unreachable through package public entries, the application typecheck omitted use cases, and the domain package test gate collected only device tests.
- **Fix:** Added explicit public exports, included all application sources in strict typecheck, and expanded the domain gate to device plus identity tests without collecting future Plan 04-21 RED witnesses.
- **Files modified:** `packages/control-plane-domain/src/index.ts`, `packages/control-plane-application/src/index.ts`, `packages/control-plane-application/tsconfig.json`, `packages/control-plane-domain/package.json`
- **Verification:** Domain/application/API typechecks pass; the domain gate passes 25/25; architecture passes 46/46.
- **Committed in:** `85668e4`, `e3f0f84`

---

**Total deviations:** 2 auto-fixed (1 blocking, 1 missing critical).
**Impact on plan:** The daemon-free proof preserves transaction, concurrency, and ordering coverage without provisioning infrastructure; the public and gate seams are narrowly scoped and preserve future owner-bound RED tests.

## Issues Encountered

- The plan's `test -- --run <name>` form uses the repository's known extra argument separator behavior. Verification used the Vitest 4.1.10 focused form `exec vitest --run <file>` so only 04-12 owner cases ran; unrelated future owner RED witnesses remained untouched.
- Expanding the domain package gate to all `src` tests initially collected Plan 04-21 paid-action RED witnesses. The gate was narrowed to `src/devices` and `src/identity`, preserving both current coverage and downstream RED ownership.

## Verification

- `pnpm --filter @liiiraa/control-plane-domain exec vitest --run src/identity/recovery.test.ts` - PASS (1 file, 4 tests).
- `pnpm --filter @liiiraa/api exec vitest --run src/modules/identity/recovery.test.ts` - PASS (1 file, 5 tests).
- `pnpm --filter @liiiraa/control-plane-domain test` - PASS (4 files, 25 tests).
- Domain, application, and API TypeScript project checks - PASS.
- Changed-file ESLint and Prettier checks - PASS.
- `pnpm test:architecture` - PASS (2 files, 46 tests; workspace and Cargo adapters executed).

## TDD Gate Compliance

- **RED:** `85668e4` replaced all nine owner-bound sentinels with real assertions; 4/4 domain decisions failed on unimplemented policy and 5/5 API cases failed on explicit 501 responses.
- **GREEN:** `e3f0f84` turned every 04-12 owner case green with approved factor, scoped step-up, reviewed recovery, hold, contest/risk extension, session revocation, audit, outbox, and one-use code behavior.
- **REFACTOR:** `bf1585f` removed overload-derived `any` and tightened actor checks while all five API cases and strict lint remained green.

## Known Stubs

None.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness

- Plans 04-16, 04-17, and 04-20 can consume the shared SensitiveAction and recovery-hold authority for critical administrative/account operations.
- Plan 04-28 can deliver the provider-neutral recovery and contest outbox jobs using redacted email templates.
- Persistent PostgreSQL repository wiring can implement the tested transaction port against the already-migrated schema without changing domain policy.

## Self-Check: PASSED

- All four created implementation files and six modified integration/test files exist.
- RED, GREEN, and REFACTOR commits exist in git history in the required order.
- All four domain and five API 04-12 owner-bound witnesses pass, with no remaining 04-12 sentinel or implementation stub.

---

_Phase: 04-identity-commerce-devices-and-administration_
_Completed: 2026-08-05_
