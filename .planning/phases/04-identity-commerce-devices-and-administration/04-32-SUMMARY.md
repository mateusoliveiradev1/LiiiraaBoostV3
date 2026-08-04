---
phase: 04-identity-commerce-devices-and-administration
plan: "32"
subsystem: api-validation
tags: [vitest, postgresql, identity, devices, account, administration]
requires:
  - phase: 04-identity-commerce-devices-and-administration
    provides: Wave 0 API, deterministic source, and PostgreSQL harness scaffolding from Plan 04-02
  - phase: 04-identity-commerce-devices-and-administration
    provides: Generated control-plane account, device, and administration contracts from Plan 04-03
provides:
  - Owner-bound RED witnesses for account version conflicts and truthful projections
  - A 20-way one-active-PC race and replacement-cooldown RED witness
  - Exact launch identity, rejection, desktop PKCE, session, recovery, and MFA RED witnesses
  - Singular-role, resource-action, and scoped step-up administration RED witnesses
affects: [04-11, 04-12, 04-14, 04-16, 04-17]
tech-stack:
  added: []
  patterns:
    - Stable EXPECTED_RED owner markers distinguish missing API authority from collection, type, database-admission, and harness failures
    - Pre-implementation matrices enumerate security-positive and fail-closed negative behavior before routes or use cases exist
key-files:
  created:
    - apps/api/src/modules/account/account-projection.test.ts
    - apps/api/src/modules/devices/device-concurrency.test.ts
    - apps/api/src/modules/identity/identity-conformance.test.ts
    - apps/api/src/modules/identity/recovery.test.ts
    - apps/api/src/modules/admin/admin-authorization.test.ts
  modified: []
key-decisions:
  - "Bind every intentional API failure to its downstream owner task through EXPECTED_RED[owner][case], so collection, type, database-admission, and harness failures cannot masquerade as missing behavior."
  - "Enumerate the complete launch identity and rejection matrix from Plan 04-11, including invitation, origin, replay, desktop PKCE, and independent session authority."
  - "Use the Vitest 4.1.10 `list` subcommand for collection because the planned `--list` option is not supported by the installed CLI."
requirements-completed: [WEB-04, WEB-05, WEB-06, IDEN-01, IDEN-02, IDEN-03, IDEN-04]
metrics:
  duration: 8 min
  completed: 2026-08-04
  tasks: 1
  files: 5
status: complete
---

# Phase 04 Plan 32: API and PostgreSQL RED Witnesses Summary

**Twenty-six collected owner-bound RED cases now preserve account version truth, one-PC concurrency, launch identity, reviewed recovery, and scoped administrative authority for Plans 04-11, 04-12, 04-14, 04-16, and 04-17.**

## Performance

- **Duration:** 8 min
- **Started:** 2026-08-04T21:15:00Z
- **Completed:** 2026-08-04T21:23:02Z
- **Tasks:** 1
- **Files modified:** 5

## Accomplishments

- Collected 26 stable Vitest cases across all five declared API paths with no configuration, transform, import, type, database-admission, or harness failures.
- Covered the exact verified email/password, Google, Discord, and passkey launch set plus Microsoft, invitation, identity-state, replay, origin, and public-registration rejections.
- Preserved desktop one-shot PKCE/state/issuer/callback custody, independent session revocation, reviewed recovery, approved MFA factors, 24-hour hold behavior, contest, and session revocation as explicit pre-implementation obligations.
- Bound the 20-way serializable device race, replacement cooldown, singular least-privilege role, resource-action authorization, and scoped recent step-up to their concrete downstream owners.
- Proved every executable case reaches only its named `EXPECTED_RED` sentinel; no production route, use case, schema, or persistence behavior was implemented.

## Task Commits

1. **Task 04-32-01: Collect account, identity, device, and admin RED witnesses** — `7af8c26` (`test`)

## Files Created/Modified

- `apps/api/src/modules/account/account-projection.test.ts` — two WEB-04 stale-version and cross-client truthful projection witnesses owned by 04-17-01.
- `apps/api/src/modules/devices/device-concurrency.test.ts` — two WEB-05/IDEN-04 20-way one-PC and cooldown witnesses owned by 04-14-01.
- `apps/api/src/modules/identity/identity-conformance.test.ts` — 13 IDEN-01 launch, rejection, desktop PKCE, and bounded-session witnesses owned by 04-11-01.
- `apps/api/src/modules/identity/recovery.test.ts` — five IDEN-02 approved-factor, reviewed recovery, hold, contest, and revocation witnesses owned by 04-12-01.
- `apps/api/src/modules/admin/admin-authorization.test.ts` — four WEB-06/IDEN-03 singular-role, resource-action, and scoped step-up witnesses owned by 04-16-01.

## Decisions Made

- Used explicit owner-bound thrown errors instead of importing nonexistent production routes or use cases. This keeps the witnesses executable and RED for the intended authority absence rather than failing during module resolution.
- Made the full Plan 04-11 positive and negative matrix visible before implementation so later TDD cannot silently narrow authentication or staging-invitation behavior.
- Kept the device test daemon-free at this stage while naming the required serializable PostgreSQL behavior; Plan 04-14 must replace the sentinel with real 20-client transaction assertions through the approved harness.

## Verification Results

- `pnpm --filter @liiiraa/api exec vitest list ...`: **PASS** — collected 26 named cases across the five declared files.
- Focused witness execution: **EXPECTED RED** — 26/26 failed only with `EXPECTED_RED[04-11-01]`, `EXPECTED_RED[04-12-01]`, `EXPECTED_RED[04-14-01]`, `EXPECTED_RED[04-16-01]`, or `EXPECTED_RED[04-17-01]`.
- `pnpm --filter @liiiraa/api exec tsc --noEmit --project tsconfig.json`: **PASS**.
- `pnpm exec prettier --check` for all five witness files: **PASS**.
- Scope audit: **PASS** — task commit contains only the five plan-owned files and no tracked deletions.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] Replaced unsupported Vitest collection option with the installed subcommand**
- **Found during:** Task 04-32-01 verification
- **Issue:** Vitest 4.1.10 rejects `--list` as an unknown option before test collection.
- **Fix:** Used the version-supported `vitest list <filters>` subcommand; the five planned file filters were unchanged.
- **Files modified:** None — verification invocation only.
- **Verification:** The corrected command exited 0 and listed all 26 witness cases.
- **Committed in:** Not applicable — command-only correction.

---

**Total deviations:** 1 auto-fixed (1 blocking verification mismatch).
**Impact on plan:** The supported CLI syntax preserves the intended collection gate with no product or test-scope change.

## Known Stubs

- All five files intentionally contain owner-bound `EXPECTED_RED` sentinels. They are the required output of this pre-implementation plan and must be replaced—not deleted—by Plans 04-11, 04-12, 04-14, 04-16, and 04-17 when those production behaviors turn green.

## Issues Encountered

- The planned Vitest `--list` syntax is incompatible with installed Vitest 4.1.10; the supported `list` subcommand produced the required collection evidence.
- No credential, provider, package-installation, database-admission, harness, or unrelated working-tree issue blocked execution.

## User Setup Required

None - these deterministic RED witnesses require no credentials, provider accounts, database daemon, or network access.

## Next Phase Readiness

- Plans 04-11, 04-12, 04-14, 04-16, and 04-17 can begin TDD from collected owner-mapped behavior instead of creating coverage after implementation.
- Each owner must preserve the named coverage, replace its sentinel with generated-contract and real PostgreSQL/API assertions, and prove GREEN without weakening the negative matrices.

## Self-Check: PASSED

- All five declared witness files exist on disk.
- Task commit `7af8c26` exists in repository history and contains only the five plan-owned files.
- All 26 witnesses collect without syntax, configuration, type, database-admission, or harness errors and fail only at their named owner-bound behavior sentinel.
