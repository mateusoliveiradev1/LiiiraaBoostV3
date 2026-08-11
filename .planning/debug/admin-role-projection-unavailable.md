---
status: resolved
trigger: 'Authenticated Admin overview reports "Autoridade administrativa indisponível" while the protected session and freshness channel are live.'
created: 2026-08-11T00:00:00-03:00
updated: 2026-08-11T15:09:00-03:00
---

## Current Focus

hypothesis: Confirmed and fixed. The client projected domain and utility access from an overbroad local role map, then mounted Operations query clients and freshness subscriptions for non-Operations functions.
test: The role/route regression matrix covers the seven domains, Operations-only utilities, native non-Operations authority projections, surface-specific Support loading, bounded activity history, and localized session states.
expecting: The Security function exposes only Overview, People, and Security; all three destinations load inside the stable shell; and the activity view presents only the eight newest admitted records with their true state.
next_action: Continue Phase 4 from the recovered, published Admin baseline.

## Symptoms

expected: After a successful protected Admin login, `/pt-BR/admin/overview` renders the role briefing with an admitted projection or a valid empty state.
actual: The shell reports `Ao vivo`, the active session is `Segurança`, and the projection scope is `Atualizado`, but the content panel reports `Autoridade administrativa indisponível`.
errors: The UI collapses denied and unavailable collection results into the same warning state.
reproduction: Sign in to the custom Admin origin with the Security owner account and open the localized overview.
started: Observed after the 2026-08-11 custom-domain/API promotion.

### Owner UAT rejection — 2026-08-11

expected: The authenticated Admin behaves as one polished product: every visible navigation destination is admitted by the active function, route changes preserve the shell, and loading/empty/degraded states retain a complete task-oriented composition.
actual: The Security session advertises Pessoas, Atendimento, Segurança, Sistema, Caixa de entrada and Atividade. Atendimento stalls in loading; Segurança, Sistema, Caixa de entrada and Atividade return safe `unauthorized` states; the shell repeatedly reports `Reconectando`; and the visual hierarchy reads as disconnected technical placeholders rather than the approved Calm Briefing / Mission Control experience.
reproduction: Sign in at `https://admin.liiiraaboost.com.br/pt-BR/admin/overview` as the owner with Security active, then follow every destination visible in the sidebar and header.

## Evidence

- timestamp: 2026-08-11T00:00:00-03:00
  checked: `apps/admin/src/features/admin-authority.tsx`
  found: `collectionFor('admin-role')` falls through to `audit-events` regardless of the server-admitted role.
  implication: Every non-Audit role can enter the landing route but may immediately request a projection outside its active-function boundary.

- timestamp: 2026-08-11T00:00:00-03:00
  checked: `packages/control-plane-domain/src/admin/authorization.ts`
  found: Security admits only `session` and `diagnostic-metadata`; Audit alone admits `audit-event`.
  implication: The API correctly hides the mistaken Security request with 404, which the client reports as unavailable.

- timestamp: 2026-08-11T14:35:00-03:00
  checked: Authenticated custom-origin browser route sweep
  found: `/overview` and `/people` render; `/support` remains loading; `/security`, `/system`, `/inbox`, and `/activity` render `unauthorized`; all visited routes expose shell freshness as `Reconectando` without console errors.
  implication: This is a deterministic client/server authority mismatch, not a browser login failure or a JavaScript crash.

- timestamp: 2026-08-11T14:38:00-03:00
  checked: `apps/admin/src/admin-shell.ts`, `apps/admin/src/features/admin-workspace-registry.tsx`, `apps/admin/src/features/admin-authority.tsx`, and `apps/api/src/modules/admin/operations-routes.ts`
  found: Security navigation includes Support and System, utilities are unconditional, canonical Security delegates to the Operations query client, and the provider opens/prefetches Operations-only resources for every active function. The API intentionally admits those query routes only when `activeFunction === 'operations'`.
  implication: Several visible Security-session routes cannot succeed by construction; the global reconnecting state is also produced by opening an authority channel that this function cannot own.

## Resolution

root_cause: The first landing defect was an incorrect role-to-collection fallback. The remaining product failure came from a second, broader mismatch: Security and Audit were shown domains they could not load, all functions received Operations-only search/inbox/activity affordances, canonical Security mounted an Operations query client, Support requested Operations resources, and every function opened the Operations freshness channel.
fix: Projected navigation and utilities from the admitted function, gated queue workspaces to Operations, composed Security/Audit/Support from their native authority collections, stopped non-Operations prefetch/freshness requests, added a visible active-function context and management path, authored role-specific landing copy, removed detail links that had no authoritative destination, limited the session history to eight recent records, and localized active/revoked/expired state presentation.
verification: The complete Admin suite passes 190/190, TypeScript and focused ESLint pass, Prettier is clean, and the optimized Next.js production build completes successfully. Deployment `dpl_FZVupVek7JVwGqmJqmU2LZv5brC6` is Ready and aliased to `admin.liiiraaboost.com.br`. Authenticated custom-origin UAT confirmed `/pt-BR/admin/overview`, `/pt-BR/admin/people`, and `/pt-BR/admin/security` load successfully with a live Security session, stable role-scoped navigation, bounded recent activity, and matching localized states including revoked sessions.
files_changed: [apps/admin/src/admin-shell.ts, apps/admin/src/admin-navigation.tsx, apps/admin/src/app/admin-shell.css, apps/admin/src/features/admin-authority.tsx, apps/admin/src/features/admin-revenue-support.tsx, apps/admin/src/features/admin-workspace-registry.tsx, apps/admin/src/features/admin-workspace-registry-model.ts, apps/admin/src/admin-shell.test.ts, apps/admin/src/features/admin-authority.test.tsx, apps/admin/src/features/admin-workspace-registry.test.tsx]
