---
status: verifying
trigger: 'Owner activated the Operations function in the published Admin after completing TOTP, but the active function remained Security and the UI showed no useful rejection.'
created: 2026-08-11T21:56:16.7164631Z
updated: 2026-08-12T04:56:00.0000000Z
---

## Current Focus

hypothesis: Confirmed fifth root cause. The strong-auth receipt bound the raw protected session ID, but the application compared it with an invented `session:` prefix and rejected the otherwise valid Operations-to-Security transition.
test: Keep the raw session reference identical through client, route, receipt consumption and application admission; also reopen the function dialog with a visible error whenever the final mutation fails.
expecting: The focused application and Admin shell regressions pass, then the published Operations-to-Security UAT redirects to Overview with Security restored.
next_action: Commit and publish the verified API and Admin revision, then repeat the exact owner round-trip once.

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

- timestamp: 2026-08-11T23:42:00.0000000Z
  checked: Published Operations session, Admin account menu, governance route authorization, and application use-case authorization
  found: Operations correctly hides People, but People owns the only switch UI. Both the route and use case also require `admin-membership:manage`, which Operations intentionally lacks.
  implication: The successful least-privilege transition creates an authorization dead end. Self-switching must be a separate capability available to every admitted administrative function.

- timestamp: 2026-08-12T04:56:00.0000000Z
  checked: Published Operations-to-Security owner retry, client mutation payload, API step-up receipt consumption and application step-up admission
  found: The client, route and consumed receipt use the raw protected session ID, while `switchAdminFunction` required `session:<id>`. The six-digit challenge completed, but `reauthenticated` became false and the sensitive transition was denied. The shell then closed the only error surface.
  implication: The strong credential was valid; an internal target-format mismatch rejected it and the UI hid the result.

## Eliminated

- hypothesis: The UI was stale after a successful mutation.
  evidence: The API returned HTTP 400 and the active function remained Security.

- hypothesis: TOTP failed.
  evidence: The strong-auth request completed before the switch request reached the route.

- hypothesis: The PostgreSQL event outbox rejected a non-UUID session reference.
  evidence: Identity session IDs are UUID values, so the outbox aggregate constraint admits the current reference.

## Resolution

root_cause: Five consecutive defects existed. First, the client targeted the actor identity rather than the protected session. Second, renewed admin identity sessions were admitted through a fallback role without materializing their governed-session row. Third, a successful switch kept the People workspace mounted and advertised to Operations even though the API correctly denies its governance projections. Fourth, the only return control and authorization were coupled to membership management, creating a dead end after a least-privilege switch. Fifth, sensitive return transitions compared the valid raw step-up target with an invented prefixed form, then hid the denial after closing the selector.
fix: Preserve the first four fixes; compare the exact protected session reference already validated by the route and strong-auth authority, and reopen the selector with a visible error if the final mutation is denied or throws.
verification: Focused application and Admin shell regressions failed before the fifth fix and pass after it. The complete application suite passes 28/28, Admin passes 196/196, API passes 247/247, Admin and application TypeScript pass, changed-file ESLint and Prettier pass, `git diff --check` is clean, and the Admin production build succeeds. API TypeScript retains the known unrelated exact-optional fixture error in `resend-invitation-delivery.test.ts:105`. Published owner round-trip UAT remains pending.
files_changed: [apps/api/src/modules/admin/governance-routes.ts, apps/api/src/modules/admin/governance-routes.test.ts, apps/api/src/modules/admin/routes.ts, apps/api/src/staging/runtime.ts, apps/api/src/staging/real-admin.test.ts, apps/api/src/staging/strong-auth.ts, apps/admin/src/admin-authority.ts, apps/admin/src/admin-authority.test.ts, apps/admin/src/admin-shell.test.ts, apps/admin/src/features/admin-authority.tsx, apps/admin/src/features/admin-authority.test.tsx, packages/control-plane-application/src/ports/admin-governance.ts, packages/control-plane-application/src/use-cases/manage-admin-access.ts, packages/control-plane-application/src/use-cases/manage-admin-access.test.ts]
