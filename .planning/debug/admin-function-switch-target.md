---
status: verifying
trigger: 'Owner activated the Operations function in the published Admin after completing TOTP, but the active function remained Security and the UI showed no useful rejection.'
created: 2026-08-11T21:56:16.7164631Z
updated: 2026-08-11T23:53:00.0000000Z
---

## Current Focus

hypothesis: Confirmed and fixed fourth root cause. Self-session function switching now has a dedicated least-privilege capability and a global strongly authenticated control.
test: Publish the API and Admin revision, verify both official-domain deployment revisions, then complete one Operations-to-Security owner UAT from the account menu.
expecting: The operator menu exposes `Trocar função ativa`; selecting Segurança, providing a reason and completing TOTP lands on Overview with the Security navigation restored.
next_action: Ask the owner to complete the focused Operations-to-Security round-trip UAT from the global account menu.

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

## Eliminated

- hypothesis: The UI was stale after a successful mutation.
  evidence: The API returned HTTP 400 and the active function remained Security.

- hypothesis: TOTP failed.
  evidence: The strong-auth request completed before the switch request reached the route.

- hypothesis: The PostgreSQL event outbox rejected a non-UUID session reference.
  evidence: Identity session IDs are UUID values, so the outbox aggregate constraint admits the current reference.

## Resolution

root_cause: Four consecutive defects existed. First, the client targeted the actor identity rather than the protected session. Second, renewed admin identity sessions were admitted through a fallback role without materializing their governed-session row. Third, a successful switch kept the People workspace mounted and advertised to Operations even though the API correctly denies its governance projections. Fourth, the only return control and authorization were coupled to membership management, creating a dead end after a least-privilege switch.
fix: Preserve the first three fixes; add `admin-function:switch-self` to every admitted function, authorize only the current protected session through the existing domain assignment checks, project assigned functions from PostgreSQL, and expose a global account-menu dialog with action-bound TOTP verification.
verification: The focused TDD set passes 84/84, the complete Admin suite passes 196/196, the complete API suite passes 247/247, the application suite passes 28/28, Admin TypeScript and production build pass, changed-file ESLint passes, and `git diff --check` is clean. Admin and API revision `048f4cc2299b599c6b5b28e499e141acf8b268ae` are published on the official staging origins; the API reports `ready: true`. Published owner round-trip UAT remains pending.
files_changed: [apps/api/src/modules/admin/governance-routes.ts, apps/api/src/modules/admin/governance-routes.test.ts, apps/api/src/modules/admin/routes.ts, apps/api/src/staging/runtime.ts, apps/api/src/staging/real-admin.test.ts, apps/api/src/staging/strong-auth.ts, apps/admin/src/admin-authority.ts, apps/admin/src/admin-authority.test.ts, apps/admin/src/admin-shell.test.ts, apps/admin/src/features/admin-authority.tsx, apps/admin/src/features/admin-authority.test.tsx, packages/control-plane-application/src/ports/admin-governance.ts, packages/control-plane-application/src/use-cases/manage-admin-access.ts, packages/control-plane-application/src/use-cases/manage-admin-access.test.ts]
