---
status: verifying
trigger: 'Owner activated the Operations function in the published Admin after completing TOTP, but the active function remained Security and the UI showed no useful rejection.'
created: 2026-08-11T21:56:16.7164631Z
updated: 2026-08-11T23:10:47.7625674Z
---

## Current Focus

hypothesis: Confirmed third root cause. The function switch now persists, but the client refetches the People governance projection under Operations even though that function does not have membership or approval capabilities.
test: Redirect a successful switch to the canonical Overview route and remove People from the Operations navigation projection.
expecting: Security to Operations lands on Overview, the sidebar immediately reflects Operations, and no governance team or approval request is issued under the new function.
next_action: Run focused Admin regressions, publish the revision, verify the official domain, and ask for one focused owner retest.

## Symptoms

expected: After selecting Operations, entering an operational reason, confirming TOTP, and activating the function, the Admin changes to Operations and refreshes its admitted navigation and projections.
actual: TOTP completes, but no visible function change occurs and the real session remains Security.
errors: The first published attempt returned HTTP 400. After correcting the actor/session command target, the official-domain retry returned HTTP 403 and no mutation record was committed.
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

- timestamp: 2026-08-11T22:54:49.8522273Z
  checked: Official-domain Vercel runtime logs and the Neon staging authority for the owner account
  found: TOTP step-up returned 200 and function switch returned 403. The current admin identity sessions created on 10-11 August have no active `admin_function_sessions` row; the only governed row belongs to the 6 August session.
  implication: The corrected command now targets the current session, but the application repository cannot load it and returns `ADMIN_SESSION_NOT_FOUND` before persistence.

- timestamp: 2026-08-11T23:10:47.7625674Z
  checked: Official-domain owner retest, Admin navigation projection, and API governance capabilities
  found: The active function changed to Operations, then the still-mounted People screen requested governance team and approval projections. Operations intentionally lacks `admin-membership:manage` and `admin-approval:manage`, so the API concealed those resources with HTTP 404.
  implication: Persistence is fixed; the remaining failure is a client route-transition and navigation-admission defect after the successful mutation.

## Eliminated

- hypothesis: The UI was stale after a successful mutation.
  evidence: The API returned HTTP 400 and the active function remained Security.

- hypothesis: TOTP failed.
  evidence: The strong-auth request completed before the switch request reached the route.

- hypothesis: The PostgreSQL event outbox rejected a non-UUID session reference.
  evidence: Identity session IDs are UUID values, so the outbox aggregate constraint admits the current reference.

## Resolution

root_cause: Three consecutive defects existed. First, the client targeted the actor identity rather than the protected session. Second, renewed admin identity sessions were admitted through a fallback role without materializing their governed-session row. Third, a successful switch kept the People workspace mounted and advertised to Operations even though the API correctly denies its governance projections.
fix: Keep the prior opaque-session and governed-session fixes, navigate successful switches to the canonical Overview route, and project the Operations sidebar without the inaccessible People destination.
verification: The renewed-session regression passes, the complete API suite passes 247/247, the focused PostgreSQL adapter suite passes 5/5, and the complete Admin gate passes 194/194 tests, TypeScript, and its production build. Changed files pass ESLint and `git diff --check` is clean. Publication and official owner verification remain pending. The workspace-wide TypeScript check is separately blocked by the pre-existing `recipient: undefined` fixture in `resend-invitation-delivery.test.ts`.
files_changed: [apps/api/src/modules/admin/routes.ts, apps/api/src/staging/runtime.ts, apps/api/src/staging/real-admin.test.ts, apps/admin/src/admin-authority.ts, apps/admin/src/admin-authority.test.ts, apps/admin/src/admin-shell.ts, apps/admin/src/admin-shell.test.ts, apps/admin/src/features/admin-access-governance.tsx, apps/admin/src/features/admin-access-governance-feedback.ts, apps/admin/src/features/admin-access-governance-feedback.test.ts, apps/admin/src/features/admin-workspace-registry.test.tsx]
