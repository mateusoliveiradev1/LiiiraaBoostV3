---
phase: 04-identity-commerce-devices-and-administration
plan: "31"
subsystem: domain-validation
tags: [vitest, rust, identity-recovery, device-privacy, offline-entitlement, paid-action-policy]
requires:
  - phase: 04-identity-commerce-devices-and-administration
    provides: Wave 0 control-plane domain and desktop test scaffolds from Plan 04-02
  - phase: 04-identity-commerce-devices-and-administration
    provides: Generated TypeScript and Rust OfflineEntitlementEnvelope transports from Plan 04-03
provides:
  - Owner-bound RED witnesses for identity recovery review, critical-action holds, and contests
  - Owner-bound RED witnesses for tolerant protected device scoring and raw hardware privacy
  - Matching TypeScript and Rust exact-byte offline entitlement rejection identities
  - Owner-bound RED witnesses for new paid work, in-flight continuity, and retained safety access
affects: [04-06, 04-07, 04-12, 04-21]
tech-stack:
  added: []
  patterns:
    - Stable EXPECTED_RED owner markers distinguish missing policy behavior from harness failures
    - Cross-runtime entitlement witnesses retain matching case identities before fixture promotion
key-files:
  created:
    - packages/control-plane-domain/src/identity/recovery.test.ts
    - packages/control-plane-domain/src/devices/device-evidence.test.ts
    - packages/control-plane-domain/src/entitlements/paid-action-policy.test.ts
    - packages/contracts-ts/src/offline-entitlement.test.ts
    - apps/desktop/src-tauri/tests/offline_entitlement.rs
  modified: []
key-decisions:
  - "Bind every intentional failure to its downstream owner task through EXPECTED_RED[owner][case], so collection and harness failures cannot masquerade as policy RED."
  - "Mirror the 14 offline-entitlement case identities in TypeScript and Rust until Plan 04-07 promotes them into the shared hashed corpus."
  - "Use the Vitest 4.1.10 `list` subcommand for collection because the planned `--list` option is not supported by the installed CLI."
requirements-completed: [IDEN-02, IDEN-05, IDEN-06, IDEN-07, IDEN-08]
metrics:
  duration: 6 min
  completed: 2026-08-04
  tasks: 1
  files: 5
status: complete
---

# Phase 04 Plan 31: Domain and Cross-Runtime RED Witnesses Summary

**Forty collected owner-bound RED cases now preserve the recovery, protected-device, exact-byte offline entitlement, and post-Premium safety behaviors that Plans 04-06, 04-07, 04-12, and 04-21 must turn green.**

## Performance

- **Duration:** 6 min
- **Started:** 2026-08-04T21:07:10Z
- **Completed:** 2026-08-04T21:13:03Z
- **Tasks:** 1
- **Files modified:** 5

## Accomplishments

- Collected 12 domain witnesses covering D-03–D-06 recovery, resolved device scoring and privacy, and the exact new-paid-action versus in-flight/safety boundary.
- Collected a 14-case TypeScript exact-byte entitlement matrix for valid seven-day bytes plus tamper, reserialization, key, binding, audience, version, expiry, future-time, and rollback rejection.
- Collected the same 14 case identities as Rust integration tests so cross-runtime parity is visible before the verifier implementation exists.
- Proved every executable witness fails only through a stable `EXPECTED_RED` message naming its downstream owner task, with no collection, transform, type, compile, or harness error.

## Task Commits

1. **Task 04-31-01: Collect domain and crypto RED witnesses** — `d1b120b` (`test`)

## Files Created/Modified

- `packages/control-plane-domain/src/identity/recovery.test.ts` — four D-03–D-06 recovery evidence, review, hold, and contest witnesses owned by 04-12-01.
- `packages/control-plane-domain/src/devices/device-evidence.test.ts` — four resolved scoring, revalidation, raw-sentinel privacy, and unlinkability witnesses owned by 04-06-01.
- `packages/control-plane-domain/src/entitlements/paid-action-policy.test.ts` — four IDEN-07/08 new-action, in-flight, retained-access, and restoration witnesses owned by 04-21-01.
- `packages/contracts-ts/src/offline-entitlement.test.ts` — typed canonical envelope plus 14 exact-byte verdict identities owned by 04-07-01.
- `apps/desktop/src-tauri/tests/offline_entitlement.rs` — 14 matching Rust integration-test identities owned by 04-07-01.

## Decisions Made

- Used explicit owner-bound thrown errors instead of importing nonexistent production modules. This keeps pre-implementation execution RED for the intended policy absence rather than failing on module resolution.
- Kept the generated `OfflineEntitlementEnvelopeJson` as the TypeScript shape authority while leaving signature verification and payload parsing entirely to Plan 04-07.
- Kept restoration and retained history/warnings as independent witnesses rather than placing every Premium capability behind one entitlement boolean.

## Verification Results

- `pnpm --filter @liiiraa/control-plane-domain exec vitest list ...`: **PASS** — collected 12 named recovery, device, and paid-action witnesses.
- `pnpm --filter @liiiraa/contracts-ts exec vitest list src/offline-entitlement.test.ts`: **PASS** — collected 14 named exact-byte cases.
- `cargo test -p liiiraa-desktop --test offline_entitlement -- --list`: **PASS** — collected 14 Rust parity tests with zero compile errors.
- Domain witness execution: **EXPECTED RED** — 12/12 failed only with `EXPECTED_RED[04-06-01]`, `EXPECTED_RED[04-12-01]`, or `EXPECTED_RED[04-21-01]`.
- TypeScript offline entitlement execution: **EXPECTED RED** — 14/14 failed only with `EXPECTED_RED[04-07-01]`.
- Rust offline entitlement execution: **EXPECTED RED** — 14/14 panicked only with `EXPECTED_RED[04-07-01]`.
- `pnpm --filter @liiiraa/contracts-ts check`: **PASS**.
- Focused strict TypeScript compile for the three domain files, Prettier check for all TypeScript witnesses, and `rustfmt --check` for the Rust witness: **PASS**.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] Replaced unsupported Vitest collection option with the installed subcommand**
- **Found during:** Task 04-31-01 verification
- **Issue:** Vitest 4.1.10 rejects `--list` as an unknown option before test collection.
- **Fix:** Used the version-supported `vitest list <filters>` subcommand for the TypeScript collection gates; the planned file filters were unchanged.
- **Files modified:** None — verification invocation only.
- **Verification:** Both focused TypeScript collection commands exited 0 and listed all 26 TypeScript witness cases.
- **Committed in:** Not applicable — command-only correction.

---

**Total deviations:** 1 auto-fixed blocking verification mismatch.
**Impact on plan:** None. The intended collection gate ran against the same files with the installed Vitest CLI's supported syntax.

## Known Stubs

- All five files intentionally contain owner-bound `EXPECTED_RED` sentinels. They are the required artifact of this pre-implementation plan, do not grant production authority, and must be replaced—not deleted—by Plans 04-06, 04-07, 04-12, and 04-21 as those behaviors turn green.

## Issues Encountered

- The planned Vitest `--list` syntax is incompatible with installed Vitest 4.1.10; the supported `list` subcommand produced the required collection evidence.
- No product implementation, package installation, credential, provider, or unrelated worktree issue was encountered.

## User Setup Required

None - these deterministic RED witnesses require no credentials, provider accounts, network access, or local service.

## Next Phase Readiness

- Plans 04-06, 04-07, 04-12, and 04-21 can now begin their RED phases from collected owner-mapped behavior instead of creating coverage after implementation.
- Each owner must preserve the named coverage, replace its sentinel with real assertions, and prove GREEN without weakening the cross-runtime or safety matrix.

## Self-Check: PASSED

- All five declared witness files exist on disk.
- Task commit `d1b120b` exists in repository history and contains only the five plan-owned files.
- All 40 witnesses collect without syntax, configuration, type, compile, or harness errors and fail only at their named owner-bound behavior sentinel.
