---
status: resolved
trigger: 'Owner activated the Operations function in the published Admin after completing TOTP, but the active function remained Security and the UI showed no useful rejection.'
created: 2026-08-11T21:56:16.7164631Z
updated: 2026-08-12T16:24:56.9235538Z
---

## Current Focus

hypothesis: Confirmed and resolved. The external Admin-to-API rewrite did not preserve the one-time step-up evidence reliably enough for the API resolver to consume it.
test: The owner repeated the official-domain Operations-to-Security switch with an eight-character reason and a fresh TOTP code after Admin and API both served revision `8408544`.
expecting: The API consumes the matching receipt exactly once, changes the governed session to Security, and the shell re-admits Security navigation without exposing unauthorized routes.
next_action: Closed after successful owner UAT; continue Phase 4 with the next independent test.

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

- timestamp: 2026-08-12T06:36:30.0000000Z
  checked: Published Operations-to-Security retry and the Admin mutation boundary
  found: The dialog accepted `teste` at five characters, but `authority.mutate` rejects reasons below eight characters locally as `invalid-authority`, so no API request was made.
  implication: The latest retry did not exercise the deployed backend fix; the dialog and mutation boundary exposed contradictory validation rules.

- timestamp: 2026-08-12T08:00:00.0000000Z
  checked: Official-domain retry with `teste UAI`, Neon `identity_step_up_receipts`, active identity session, governed function session, and administrative membership
  found: The switch endpoint returned HTTP 403. The new `admin.function.switch` receipt has the correct account, session, context, action, resource and target, remains unconsumed, the session is active, and both Operations and Security are assigned.
  implication: The valid strong credential is minted but never reaches atomic consumption. Account authority and function assignment are not the cause; the remaining boundary is receipt transport/admission at the API resolver.

- timestamp: 2026-08-12T16:24:56.9235538Z
  checked: Official-domain owner UAT after Admin and API deployment revision `8408544`
  found: The active function changed from Operations to Security, the header and account menu both projected Security, the Security overview loaded, and the session reported protected and synchronized.
  implication: The step-up transport fallback, atomic receipt consumption, governed-session mutation, and post-switch navigation admission now complete end to end.

## Eliminated

- hypothesis: The UI was stale after a successful mutation.
  evidence: The API returned HTTP 400 and the active function remained Security.

- hypothesis: TOTP failed.
  evidence: The strong-auth request completed before the switch request reached the route.

- hypothesis: The PostgreSQL event outbox rejected a non-UUID session reference.
  evidence: Identity session IDs are UUID values, so the outbox aggregate constraint admits the current reference.

## Resolution

root_cause: Seven consecutive defects existed. First, the client targeted the actor identity rather than the protected session. Second, renewed admin identity sessions were admitted through a fallback role without materializing their governed-session row. Third, a successful switch kept the People workspace mounted and advertised to Operations even though the API correctly denies its governance projections. Fourth, the only return control and authorization were coupled to membership management, creating a dead end after a least-privilege switch. Fifth, sensitive return transitions compared the valid raw step-up target with an invented prefixed form, then hid the denial after closing the selector. Sixth, the dialog enabled a reason at three characters even though the shared mutation authority requires eight. Seventh, the external Admin-to-API rewrite could lose the one-time step-up headers before API admission, leaving a valid persisted receipt unused.
fix: Preserve the first six fixes and transport a sealed step-up evidence envelope in the JSON body alongside the headers. The API accepts either transport, rejects any disagreement, validates the envelope against the command and session, and retains atomic one-time receipt consumption.
verification: Admin 196/196 tests, API 248/248 tests, Admin typecheck/build, focused lint, immutable API build and protected Render promotion passed. Both official surfaces served revision `8408544`; owner UAT successfully switched Operations to Security and loaded the synchronized Security overview.
files_changed: [apps/api/src/modules/admin/governance-routes.ts, apps/api/src/modules/admin/governance-routes.test.ts, apps/api/src/modules/admin/routes.ts, apps/api/src/staging/runtime.ts, apps/api/src/staging/real-admin.test.ts, apps/api/src/staging/strong-auth.ts, apps/admin/src/admin-authority.ts, apps/admin/src/admin-authority.test.ts, apps/admin/src/admin-shell.test.ts, apps/admin/src/features/admin-authority.tsx, apps/admin/src/features/admin-authority.test.tsx, packages/control-plane-application/src/ports/admin-governance.ts, packages/control-plane-application/src/use-cases/manage-admin-access.ts, packages/control-plane-application/src/use-cases/manage-admin-access.test.ts]
