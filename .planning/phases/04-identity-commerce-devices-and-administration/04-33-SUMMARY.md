---
phase: 04-identity-commerce-devices-and-administration
plan: '33'
subsystem: security-testing
tags: [vitest, better-auth, stripe, consent, red-witnesses]
requires:
  - phase: 04-identity-commerce-devices-and-administration
    provides: Wave 0 control-plane package, deterministic test, and API Vitest scaffolding from Plan 04-02
  - phase: 04-identity-commerce-devices-and-administration
    provides: Generated identity, provider-event, diagnostic-consent, and audit boundary contracts from Plan 04-03
provides:
  - A collected D-01 through D-10 terminating Better Auth adapter matrix
  - Raw-signature admission plus duplicate, delayed, replayed, and reordered Stripe delivery witnesses
  - In-flight diagnostic consent revoke/expiry, no-store, disposal, and immutable-audit witnesses
affects: [04-05, 04-08, 04-09]
tech-stack:
  added: []
  patterns:
    - Stable EXPECTED_RED owner and case markers distinguish absent provider behavior from collection, type, and harness failures
    - Generated contract types constrain pre-implementation matrices without importing nonexistent provider adapters
key-files:
  created:
    - packages/control-plane-adapters/src/identity/better-auth.spike.test.ts
    - packages/control-plane-adapters/src/commerce/stripe-webhook.permutation.test.ts
    - apps/api/src/modules/support/consent-stream.test.ts
  modified: []
key-decisions:
  - 'Bind every intentional external-boundary failure to its downstream owner task and stable case identity.'
  - 'Keep provider behavior absent while type-binding the matrices to generated control-plane contracts.'
  - "Use Vitest 4.1.10's list subcommand for collection because the planned --list option is unsupported."
patterns-established:
  - 'Identity verdict rows remain visible as D-01 through D-10 until Plan 04-05 replaces each sentinel with executable adapter evidence.'
  - 'Webhook and consent witnesses preserve adversarial delivery and live-revocation obligations before implementation begins.'
requirements-completed: [WEB-07, IDEN-01, IDEN-02, IDEN-03, IDEN-09]
metrics:
  duration: 5 min
  completed: 2026-08-04
  tasks: 1
  files: 3
status: complete
---

# Phase 04 Plan 33: External-Boundary RED Witnesses Summary

**Twenty-three collected, type-safe RED cases now preserve the terminating identity verdict, adversarial Stripe reconciliation, and live diagnostic-consent revocation obligations for Plans 04-05, 04-08, and 04-09.**

## Performance

- **Duration:** 5 min
- **Started:** 2026-08-04T21:29:15Z
- **Completed:** 2026-08-04T21:34:42Z
- **Tasks:** 1
- **Files modified:** 3

## Accomplishments

- Collected ten stable Better Auth verdict rows covering every locked D-01 through D-10 identity decision without installing or approving provider behavior.
- Collected three signature-before-parse cases and four duplicate/delay/replay/reorder delivery cases that require convergence on retrieved provider truth.
- Collected six diagnostic-consent lifecycle cases for in-flight revoke/expiry abort, private no-store delivery, temporary-data disposal, immutable access receipts, and audit preservation.
- Proved all 23 cases typecheck and collect before failing exclusively through `EXPECTED_RED[04-05-01]`, `EXPECTED_RED[04-08-01]`, or `EXPECTED_RED[04-09-01]` markers.

## Task Commits

1. **Task 04-33-01: Collect identity, webhook, and consent RED matrices** — `e391fda` (`test`)

## Collected RED Cases

- **Identity (10):** D-01 launch methods; D-02 verified registration/passkey offer; D-03 cross-method scoped step-up; D-04 approved factors; D-05 reviewed recovery; D-06 recovery hold/contest; D-07 independent sessions; D-08 separated roles; D-09 audited non-production role assumption; D-10 Windows system-browser PKCE.
- **Stripe (7):** missing, invalid, and stale raw signatures; duplicate, delayed, replayed, and reordered delivery.
- **Consent (6):** in-flight revoke and expiry abort; private no-store response; temporary-buffer disposal; immutable access audit; revocation-preserved audit.

## Files Created/Modified

- `packages/control-plane-adapters/src/identity/better-auth.spike.test.ts` — D-01 through D-10 terminating identity matrix owned by 04-05-01.
- `packages/control-plane-adapters/src/commerce/stripe-webhook.permutation.test.ts` — signature admission and adversarial delivery matrix owned by 04-08-01.
- `apps/api/src/modules/support/consent-stream.test.ts` — live consent abort, no-store, disposal, and immutable-audit matrix owned by 04-09-01.

## Decisions Made

- Each intentional failure includes both the exact downstream owner task and a stable case identity, so missing imports, transforms, database admission, or harness setup cannot masquerade as the planned RED state.
- Type-only imports from `@liiiraa/contracts-ts` bind identity strength/session state, provider event types, and diagnostic consent state to generated authority contracts while keeping provider implementations absent.
- The unsupported planned `vitest --run --list` form was replaced by the installed Vitest 4.1.10 `vitest list` subcommand without changing file filters or collection scope.

## Verification Results

- Adapter collection: **PASS** — 17 cases listed across the Better Auth and Stripe files.
- API collection: **PASS** — 6 cases listed in the diagnostic consent file.
- Focused adapter execution: **EXPECTED RED** — 17/17 failures contain only 04-05-01 or 04-08-01 owner markers.
- Focused API execution: **EXPECTED RED** — 6/6 failures contain only 04-09-01 owner markers.
- API strict TypeScript check: **PASS**.
- Standalone strict TypeScript check for both adapter files: **PASS**.
- Prettier check for all three files: **PASS**.
- Scope and deletion audit: **PASS** — task commit contains only the three plan-owned files and no tracked deletions.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] Used the installed Vitest collection subcommand**

- **Found during:** Task 04-33-01 verification
- **Issue:** Vitest 4.1.10 does not support the planned `--list` option.
- **Fix:** Used `vitest list` with the exact same three file filters.
- **Files modified:** None — verification invocation only.
- **Verification:** All 23 cases collected with exit code 0.
- **Committed in:** Not applicable — command-only correction.

---

**Total deviations:** 1 auto-fixed (1 blocking verification mismatch).
**Impact on plan:** The supported CLI syntax preserves the intended collection gate with no product, provider, or test-scope change.

## Known Stubs

- All three test files intentionally contain downstream-owner `EXPECTED_RED` sentinels. These are the required product of Plan 04-33 and must be replaced—not removed or weakened—by Plans 04-05, 04-08, and 04-09 when their real adapters turn the matrices green.

## Issues Encountered

- The planned collection option is unsupported by the installed Vitest version; the supported subcommand produced equivalent collection evidence.
- No package installation, credential, provider account, database daemon, harness, or unrelated working-tree issue blocked execution.

## Authentication Gates

None.

## User Setup Required

None - these deterministic RED witnesses require no provider credentials, external accounts, network access, or database daemon.

## Next Phase Readiness

- Plan 04-05 can expand the preserved D-01 through D-10 matrix through `IdentityProviderPort` and issue a binary Better Auth PASS/REJECT verdict.
- Plan 04-08 can replace the Stripe sentinels with raw-signature admission, durable unique inbox, provider retrieval, and reconciliation assertions.
- Plan 04-09 can replace the consent sentinels with continuously authorized streaming, abort/disposal evidence, no-store delivery, and immutable audit receipts.

## Self-Check: PASSED

- All three declared witness files exist on disk.
- Task commit `e391fda` exists in repository history and contains only the three plan-owned files.
- All 23 cases collect without syntax, transform, import, type, configuration, database-admission, or harness failures.
- Every executable failure reaches only its explicit Plan 04-05-01, 04-08-01, or 04-09-01 owner marker.

---

_Phase: 04-identity-commerce-devices-and-administration_
_Completed: 2026-08-04_
