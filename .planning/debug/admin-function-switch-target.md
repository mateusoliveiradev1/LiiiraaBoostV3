---
status: verifying
trigger: 'Owner activated the Operations function in the published Admin after completing TOTP, but the active function remained Security and the UI showed no useful rejection.'
created: 2026-08-11T21:56:16.7164631Z
updated: 2026-08-11T22:03:39.7952969Z
---

## Current Focus

hypothesis: Confirmed and fixed locally. The Admin command targeted the actor identity while the API correctly required the protected administrative session reference.
test: Publish the exact Admin/API revision and repeat the owner switch from Security to Operations with TOTP.
expecting: The switch returns success, the provider reloads the authoritative session immediately, Operations navigation appears without F5, and any rejection renders a bounded notice.
next_action: Commit, publish Admin and API, verify deployment identity, then request the focused owner retest.

## Symptoms

expected: After selecting Operations, entering an operational reason, confirming TOTP, and activating the function, the Admin changes to Operations and refreshes its admitted navigation and projections.
actual: TOTP completes, but no visible function change occurs and the real session remains Security.
errors: Published runtime evidence records `POST /v1/admin/governance/functions/switch` returning HTTP 400; the UI does not explain the rejection.
reproduction: Open People, inspect the owner member, exit simulation, select Operations, enter a valid reason, activate the function, and complete TOTP.
started: Observed during Phase 4 real-authority owner UAT on 2026-08-11.

## Evidence

- timestamp: 2026-08-11T21:56:16.7164631Z
  checked: Published Vercel runtime logs and the strong-auth flow
  found: The step-up request completed and the following function-switch request returned HTTP 400.
  implication: Authentication succeeded; the switch command was rejected before mutation.

- timestamp: 2026-08-11T21:56:16.7164631Z
  checked: `apps/admin/src/features/admin-access-governance.tsx`, `apps/admin/src/admin-authority.ts`, and `apps/api/src/modules/admin/governance-routes.ts`
  found: The UI supplies `session.actorId` as `targetId`, the command builder places it in `targetReferences`, and the API requires `session.sessionId` to be present.
  implication: The deterministic actor/session target mismatch produces `REQUEST_INVALID` and HTTP 400.

## Eliminated

- hypothesis: The UI was stale after a successful mutation.
  evidence: The API returned HTTP 400 and the active function remained Security.

- hypothesis: TOTP failed.
  evidence: The strong-auth request completed before the switch request reached the route.

## Resolution

root_cause: The Admin session projection omitted `sessionId`; the governed command builder therefore selected `actorId`, but `/v1/admin/governance/functions/switch` validates that `targetReferences` contains the exact protected administrative session ID.
fix: Expose the opaque session reference from `/v1/admin/session`, admit it in the Admin authority client, force switch-function commands to target that session, refresh the React authority session after success, and render rejected mutations as explicit no-change notices.
verification: Local TDD regressions passed; Admin 194/194 and API 246/246 tests passed; focused ESLint and Admin TypeScript passed; the optimized Admin production build completed successfully. Published owner verification remains pending.
files_changed: [apps/api/src/modules/admin/routes.ts, apps/api/src/staging/real-admin.test.ts, apps/admin/src/admin-authority.ts, apps/admin/src/admin-authority.test.ts, apps/admin/src/features/admin-access-governance.tsx, apps/admin/src/features/admin-access-governance-feedback.ts, apps/admin/src/features/admin-access-governance-feedback.test.ts]
