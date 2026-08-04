---
phase: 04-identity-commerce-devices-and-administration
plan: '34'
subsystem: browser-evidence
tags: [playwright, red-witness, account-authority, admin-authority, consent, entitlement]
dependency_graph:
  requires:
    - Phase 3 account, admin, and desktop accessibility-first browser harnesses
    - Phase 4 canonical account/admin route and entitlement safety contracts
  provides:
    - Owner-bound account and administrative authority browser RED witnesses
    - Cross-origin consent-revocation browser RED witness
    - Desktop entitlement-expiry and post-Premium safety browser RED witnesses
  affects: [04-18, 04-19, 04-21]
tech_stack:
  added: []
  patterns:
    - Accessibility-first Playwright journeys guarded by explicit production-authority RED sentinels
    - Canonical wide-axis web smoke execution with focused tags and owner task IDs
key_files:
  created:
    - tooling/web-evidence/tests/account-authority.spec.ts
    - tooling/web-evidence/tests/admin-authority.spec.ts
    - tooling/web-evidence/tests/admin-consent-revocation.spec.ts
    - apps/desktop/tests/browser/entitlement-expiry.spec.ts
    - apps/desktop/tests/browser/post-premium-safety.spec.ts
  modified: []
decisions:
  - Keep every pre-implementation browser witness RED through an explicit owner-bound production-authority sentinel.
  - Execute web authority witnesses on the canonical wide-1440 axis while retaining normal project collection across the configured matrix.
metrics:
  duration: 6 min
  completed: 2026-08-04
  tasks: 1
  files: 5
status: complete
---

# Phase 04 Plan 34: Browser Authority RED Witnesses Summary

**Ten collected browser journeys now fail only at explicit production-authority sentinels for account, admin, live consent revocation, entitlement expiry, and post-Premium safety.**

## Performance

- **Duration:** 6 min
- **Started:** 2026-08-04T20:21:38Z
- **Completed:** 2026-08-04T20:27:39Z
- **Tasks:** 1
- **Files created:** 5

## Accomplishments

- Collected two account authority journeys for truthful projection/versioned profile mutation and protected device replacement cooldown.
- Collected two isolated-admin authority journeys for a singular server-derived role and scoped critical-action step-up.
- Collected one cross-origin account-to-admin consent revocation journey requiring immediate diagnostic clearing, no durable diagnostic URL, and an immutable audit row.
- Collected two entitlement-boundary journeys distinguishing a new paid action from in-flight Premium work.
- Collected three post-Premium safety journeys preserving diagnostic history, security warnings, and restoration.

## Collected Witnesses and Expected RED Results

| Spec                               | Focused witness                                                      | Owner    | Expected RED                                                                         |
| ---------------------------------- | -------------------------------------------------------------------- | -------- | ------------------------------------------------------------------------------------ |
| `account-authority.spec.ts`        | Projection/profile mutation and device cooldown (`@authority-smoke`) | 04-18-02 | `EXPECTED_RED[04-18-02]: production account authority is not activated`              |
| `admin-authority.spec.ts`          | Singular role and critical step-up (`@authority-smoke`)              | 04-19-02 | `EXPECTED_RED[04-19-02]: production administrative authority is not activated`       |
| `admin-consent-revocation.spec.ts` | Cross-origin live revoke/clear (`@consent-smoke`)                    | 04-19-02 | `EXPECTED_RED[04-19-02]: cross-origin production consent authority is not activated` |
| `entitlement-expiry.spec.ts`       | New-action denial and in-flight continuation (`@entitlement-smoke`)  | 04-21-01 | `EXPECTED_RED[04-21-01]: verified production entitlement authority is not activated` |
| `post-premium-safety.spec.ts`      | History, warnings, and restoration (`@safety-smoke`)                 | 04-21-01 | `EXPECTED_RED[04-21-01]: post-Premium safety capability authority is not activated`  |

## Task Commits

1. **Task 04-34-01: Collect account, admin, consent, and entitlement browser witnesses** — `8e42070` (`test`)

## Files Created

- `tooling/web-evidence/tests/account-authority.spec.ts` — account projection, versioned mutation, and device cooldown authority journeys.
- `tooling/web-evidence/tests/admin-authority.spec.ts` — singular-role admission and critical step-up journeys.
- `tooling/web-evidence/tests/admin-consent-revocation.spec.ts` — account-origin revocation and admin-view disposal journey.
- `apps/desktop/tests/browser/entitlement-expiry.spec.ts` — precise new-paid-action versus in-flight expiry boundary.
- `apps/desktop/tests/browser/post-premium-safety.spec.ts` — retained history, warning, and restoration capabilities.

## Verification Results

- Web Playwright list: **PASS** — 45 configured project entries across all three specs, with canonical runtime execution restricted to `wide-1440`.
- Desktop Playwright list: **PASS** — five Chromium tests across the two specs.
- Account authority smoke: **EXPECTED RED** — two of two tests reached only the `04-18-02` production-account sentinel; 25.0 seconds including build/startup.
- Admin authority and consent smoke: **EXPECTED RED** — three of three tests reached only the `04-19-02` administrative/consent sentinels; 25.9 seconds including build/startup.
- Desktop entitlement and safety smoke: **EXPECTED RED** — five of five tests reached only the `04-21-01` entitlement/safety sentinels; 9.6 seconds including build/startup.
- `@liiiraa/web-evidence` TypeScript check: **PASS**.
- `@liiiraa/desktop` TypeScript check: **PASS**.
- Prettier check over all five specs: **PASS**.

## Decisions Made

- Used explicit failing assertions with stable `EXPECTED_RED[owner-task]` messages so a missing server, broken route, invalid locator, or configuration error cannot masquerade as the intended RED result.
- Kept fixture/runtime source files unchanged. Plans 04-18, 04-19, and 04-21 must replace only the RED sentinels with deployed/runtime authority assertions while preserving the authored journeys.
- Limited web execution to the canonical `wide-1440` axis inside each witness; project-level listing remains compatible with the established Phase 3 matrix.

## Deviations from Plan

None - plan executed exactly as written.

## Known Stubs

The following assertions are intentional pre-implementation RED sentinels and are the plan's required output, not shippable production stubs:

| File                                                          | Line | Owner    | Resolution                                                                   |
| ------------------------------------------------------------- | ---: | -------- | ---------------------------------------------------------------------------- |
| `tooling/web-evidence/tests/account-authority.spec.ts`        |   20 | 04-18-02 | Replace with production account authority assertions in Plan 04-18.          |
| `tooling/web-evidence/tests/admin-authority.spec.ts`          |   20 | 04-19-02 | Replace with server-derived admin authority assertions in Plan 04-19.        |
| `tooling/web-evidence/tests/admin-consent-revocation.spec.ts` |   27 | 04-19-02 | Replace with the deployed cross-origin revoke/clear assertion in Plan 04-19. |
| `apps/desktop/tests/browser/entitlement-expiry.spec.ts`       |   21 | 04-21-01 | Replace with verified entitlement boundary assertions in Plan 04-21.         |
| `apps/desktop/tests/browser/post-premium-safety.spec.ts`      |   21 | 04-21-01 | Replace with runtime safety-capability assertions in Plan 04-21.             |

## Issues Encountered

- Running workspace package commands refreshed uninstalled Phase 4 workspace importers in `pnpm-lock.yaml`; the command-induced drift was discarded because dependency resolution is outside Plan 04-34 and the lockfile was clean before execution.
- Existing Next.js standalone-output and desktop bundle-size messages remained warnings only and did not affect collection or the intended RED causes.

## Next Phase Readiness

- Plans 04-18, 04-19, and 04-21 have stable tagged browser journeys and exact owner IDs to adopt during RED/GREEN work.
- No blocker remains for downstream implementation; every witness currently fails for its intended missing production-authority reason.

## Self-Check: PASSED

- All five declared browser witness files and this summary exist on disk.
- Task commit `8e42070` exists in repository history.
- All acceptance criteria and plan-level verification commands were rerun with the expected collection and RED outcomes recorded above.
