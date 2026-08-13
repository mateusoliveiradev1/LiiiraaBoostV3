---
phase: 06-transactional-plans-and-recovery
plan: '12'
subsystem: identity-security
tags: [strong-auth, totp, tauri, winhttp, credential-manager, replay-protection]
requires:
  - phase: 04-identity-commerce-devices-and-administration
    provides: Real TOTP step-up receipts, API-owned desktop sessions, and Windows credential custody
  - phase: 06-transactional-plans-and-recovery
    provides: Closed transactional plan, recovery, and Advanced preference contracts from Plan 06-01
provides:
  - One-use cloud proof consumption for transactional apply and Advanced preference enable/revoke
  - Native action-discriminated approval values bound to device and exact target fingerprints
  - Offline-failing high-risk admission with unconditional local recovery availability
affects: [06-14, 06-18, 06-19, plan-engine, desktop-executor, advanced-preference]
tech-stack:
  added: []
  patterns: [canonical-scope-fingerprint, one-use-proof-consumption, native-secret-custody, closed-action-proofs]
key-files:
  created:
    - apps/api/src/modules/identity/strong-auth-routes.test.ts
    - apps/desktop/src-tauri/src/plan_auth.rs
    - apps/desktop/src-tauri/tests/plan_auth.rs
  modified:
    - apps/api/src/modules/identity/strong-auth-routes.ts
    - apps/desktop/src-tauri/src/main.rs
key-decisions:
  - 'Bind transactional apply proof to device, plan fingerprint, and the canonical sorted operation-version set.'
  - 'Bind Advanced preference enable and revoke independently to device, hardware fingerprint, and security-posture fingerprint.'
  - 'Return only closed consumed-proof values from native admission; reusable receipts and the account bearer credential never cross to the renderer or SQLite.'
patterns-established:
  - 'Cloud strong-auth issuance and consumption use the same SHA-256 canonical target fingerprint and reject unknown fields.'
  - 'Local recovery has a separate unconditional admission type and performs no credential or network access.'
requirements-completed: [PLAN-05]
duration: 15 min
completed: 2026-08-13
status: complete
---

# Phase 06 Plan 12: Strong-Auth Native Plan Admission Summary

**Action-scoped cloud proofs now authorize exactly one transactional apply or device-local Advanced preference transition through Windows credential custody, while local recovery remains unconditional and offline.**

## Performance

- **Duration:** 15 min
- **Started:** 2026-08-13T08:07:35Z
- **Completed:** 2026-08-13T08:22:18Z
- **Tasks:** 3 TDD gates
- **Files modified:** 5

## Accomplishments

- Extended the existing strong-auth authority rather than creating another identity system, with closed apply, enable, and revoke actions and exact request shapes.
- Canonicalized and hashed every proof target: apply binds the device, plan fingerprint, and sorted operation-version set; preference transitions bind the device plus hardware/security-posture fingerprints.
- Added atomic single-use consumption with account/session/action/resource/target/expiry enforcement, including concurrent replay rejection.
- Added native WinHTTP verification using the existing Windows Credential Manager session slot and returned distinct, non-interchangeable consumed proof types.
- Kept reusable receipt material, bearer credentials, TOTP/passkey material, and proof-validity claims out of renderer state and plaintext SQLite; local recovery performs no authentication or network work.

## Task Commits

1. **Task 1 RED: Specify one-use plan and Advanced-preference proofs** - `eec66692` (test)
2. **Task 2 GREEN: Issue, verify, and consume exact scoped proofs** - `9d548333` (feat)
3. **Task 3 REFACTOR: Harden proof lifecycle** - `bbe9a7f7` (refactor)

## Files Created/Modified

- `apps/api/src/modules/identity/strong-auth-routes.ts` - Closed plan-proof scope parsing, canonical target hashing, and one-use consumption projection.
- `apps/api/src/modules/identity/strong-auth-routes.test.ts` - API issue/consume, mismatch, replay, concurrency, expiry-boundary, sign-out, and renderer-claim witnesses.
- `apps/desktop/src-tauri/src/plan_auth.rs` - Native request construction, WinHTTP verification, credential custody, strict freshness/match validation, closed consumed proofs, and local recovery admission.
- `apps/desktop/src-tauri/tests/plan_auth.rs` - Native apply/preference, cross-action, offline, sign-out, stale, posture-change, redaction, and recovery witnesses.
- `apps/desktop/src-tauri/src/main.rs` - Registers the native plan-auth module without exposing a renderer command.

## Decisions Made

- Proof targets use a byte-stable canonical string hashed with SHA-256 on both cloud and native sides, preventing order changes or partial target matching from widening authority.
- Apply, enable, and revoke are separate discriminators. A consumed plan proof and a consumed Advanced preference proof are distinct Rust types, and enable/revoke remain distinct enum values.
- The native boundary validates server time fields, enforces a five-minute maximum proof lifetime, rejects at the exact expiry boundary, and allows only a small future-clock tolerance for transport timing.
- Recovery is deliberately not represented as another proof action; `LocalRecoveryAdmission` requires neither an account credential nor a network client.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 2 - Missing Critical] Registered the native proof module in the desktop binary**
- **Found during:** Task 2 GREEN verification
- **Issue:** An integration-test-only `#[path]` module would prove isolated behavior but leave the production desktop binary unable to compile or consume the native authority.
- **Fix:** Registered `plan_auth` in `apps/desktop/src-tauri/src/main.rs` while intentionally adding no renderer-facing Tauri command.
- **Files modified:** `apps/desktop/src-tauri/src/main.rs`
- **Verification:** `cargo check -p liiiraa-desktop` and the full 168-test desktop suite pass.
- **Committed in:** `9d548333`

**2. [Rule 2 - Missing Critical] Added canonical scope hashing on both sides of the boundary**
- **Found during:** Task 2 GREEN security review
- **Issue:** The existing generic `redactedTarget` field could not prove the exact plan operation-version set or current hardware/security posture without caller-controlled ambiguity.
- **Fix:** Added strict closed binding objects, sorted unique operation versions, unknown-field rejection, and matching SHA-256 target fingerprints in TypeScript and Rust.
- **Files modified:** `apps/api/src/modules/identity/strong-auth-routes.ts`, `apps/desktop/src-tauri/src/plan_auth.rs`, focused tests
- **Verification:** Wrong device, account, session, action, resource, plan fingerprint, operation version, posture fingerprint, expiry, and replay all reject.
- **Committed in:** `9d548333`, `bbe9a7f7`

---

**Total deviations:** 2 auto-fixed (2 missing critical security/integration seams).
**Impact on plan:** Both changes are required for real production composition and exact proof binding; neither widens renderer, credential, recovery, or mutation authority.

## Issues Encountered

- The broad API TypeScript command reaches an unrelated pre-existing `apps/api/src/staging/resend-invitation-delivery.test.ts` exact-optional-property error. All plan-owned TypeScript errors were corrected; focused Vitest, ESLint, Prettier, existing strong-auth regressions, Cargo, and architecture gates pass. The unrelated file was not modified.

## Verification

- API plan proof route: **PASS** - 8/8 tests.
- Existing API strong-auth regressions: **PASS** - 11/11 tests.
- Native plan-auth integration: **PASS** - 6/6 tests.
- Full desktop Rust suite: **PASS** - 168/168 tests across 17 suites.
- Desktop compile: **PASS** - `cargo check -p liiiraa-desktop`.
- TypeScript lint/format: **PASS** - plan-owned route and test files.
- Architecture: **PASS** - workspace and Cargo adapters executed; 51/51 tests.
- Source scans: **PASS** - no renderer strong-auth Boolean, renderer proof bridge, plaintext SQLite proof store, or secret logging path.

## TDD Gate Compliance

- **RED:** `eec66692` compiled both suites and failed because structured issue/consume behavior and native admission were absent.
- **GREEN:** `9d548333` turned the exact action, scope, custody, freshness, offline, and recovery behavior green.
- **REFACTOR:** `bbe9a7f7` consolidated native exact-proof matching and added concurrency, clock-boundary, sign-out, posture-change, and redaction coverage while all gates stayed green.

## Authentication Gates

None.

## User Setup Required

None - no external service configuration or new credentials are required.

## Known Stubs

None.

## Threat Flags

| Flag | File | Description |
|------|------|-------------|
| threat_flag: authenticated-proof-endpoint | `apps/api/src/modules/identity/strong-auth-routes.ts` | New authenticated HTTPS consume surface for one-use action-scoped approval receipts; covered by T-06-12A/B and focused replay, scope, freshness, and disclosure tests. |

## Next Phase Readiness

- Plans 06-14, 06-18, and 06-19 can consume the closed native approval types without accepting renderer-declared authority.
- Advanced/Experimental apply and Advanced preference transitions fail closed offline; local recovery remains available independently.
- No PLAN-05 blocker remains in this plan.

## Self-Check: PASSED

- All three created files and both modified files exist.
- RED `eec66692`, GREEN `9d548333`, and REFACTOR `bbe9a7f7` exist in the required order.
- All plan-level focused suites, full desktop suite, lint/format, compile, and architecture acceptance gates pass.
- The three user-owned `.gitignore` modifications remain untouched and unstaged.

---

_Phase: 06-transactional-plans-and-recovery_
_Completed: 2026-08-13_
