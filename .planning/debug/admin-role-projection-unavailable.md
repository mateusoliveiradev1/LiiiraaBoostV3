---
status: fixing
trigger: 'Authenticated Admin overview reports "Autoridade administrativa indisponível" while the protected session and freshness channel are live.'
created: 2026-08-11T00:00:00-03:00
updated: 2026-08-11T00:00:00-03:00
---

## Current Focus

hypothesis: Confirmed. The generic `admin-role` landing always requested `audit-events`, although the active Security function is admitted only to `sessions` and `diagnostic-metadata` by the projection boundary.
test: A regression matrix now proves that each active administrative function selects one projection collection admitted to that function.
expecting: Security selects `sessions`; Support selects `support-cases`; Operations selects `entitlements`; Audit selects `audit-events`.
next_action: Publish the passing correction and verify the custom Admin origin at the exact deployed revision.

## Symptoms

expected: After a successful protected Admin login, `/pt-BR/admin/overview` renders the role briefing with an admitted projection or a valid empty state.
actual: The shell reports `Ao vivo`, the active session is `Segurança`, and the projection scope is `Atualizado`, but the content panel reports `Autoridade administrativa indisponível`.
errors: The UI collapses denied and unavailable collection results into the same warning state.
reproduction: Sign in to the custom Admin origin with the Security owner account and open the localized overview.
started: Observed after the 2026-08-11 custom-domain/API promotion.

## Evidence

- timestamp: 2026-08-11T00:00:00-03:00
  checked: `apps/admin/src/features/admin-authority.tsx`
  found: `collectionFor('admin-role')` falls through to `audit-events` regardless of the server-admitted role.
  implication: Every non-Audit role can enter the landing route but may immediately request a projection outside its active-function boundary.

- timestamp: 2026-08-11T00:00:00-03:00
  checked: `packages/control-plane-domain/src/admin/authorization.ts`
  found: Security admits only `session` and `diagnostic-metadata`; Audit alone admits `audit-event`.
  implication: The API correctly hides the mistaken Security request with 404, which the client reports as unavailable.

## Resolution

root_cause: The canonical overview delegates unauthenticated loading to `AdminAuthorityPage` with route `admin-role`. Its `collectionFor` fallback ignored the admitted session role and always selected `audit-events`. The domain boundary correctly denies that resource to Security, Support, and Operations functions, producing the contradictory live-shell/unavailable-content state.
fix: Added one exhaustive role-to-collection authority mapping and used the server-admitted role both after sign-in and during authenticated landing refreshes.
verification: Focused regression first failed for all four roles, then the Admin suite passed 187/187, TypeScript passed, and the optimized Next.js production build completed successfully. Published-origin verification remains pending.
files_changed: [apps/admin/src/admin-authority.ts, apps/admin/src/features/admin-authority.tsx, apps/admin/src/features/admin-authority.test.tsx]
