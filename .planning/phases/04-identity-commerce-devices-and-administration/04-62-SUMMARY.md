---
phase: 04-identity-commerce-devices-and-administration
plan: '62'
subsystem: admin-ui
tags: [admin, authority, navigation, responsive, accessibility, storybook]
requires:
  - phase: 04-54
    provides: Briefing Focus visual foundation, accessible primitives, and deterministic Storybook fixtures
provides:
  - Typed production Admin query, mutation, and live-refetch authority across every control-plane API family
  - Fail-closed production composition with explicit preview-only fixture injection
  - Stable permission-projected seven-domain information architecture
  - Responsive expanded, compact, tablet, mobile drawer, 320px, and 200-percent shell behavior
affects: [04-55, 04-56, 04-57, 04-58, 04-59, 04-60, 04-61, admin-shell, admin-workspaces]
tech-stack:
  added: []
  patterns:
    [
      generated-contract-authority,
      invalidation-only-live-refetch,
      permission-projected-navigation,
      per-admin-environment-preferences,
      focus-restoring-mobile-drawer,
    ]
key-files:
  created:
    - apps/admin/src/features/admin-shell.stories.tsx
  modified:
    - apps/admin/src/admin-authority.ts
    - apps/admin/src/features/admin-authority.tsx
    - apps/admin/src/admin-navigation.tsx
    - apps/admin/src/admin-shell.ts
    - apps/admin/src/app/admin-shell.css
    - packages/design-system/src/primitives.tsx
key-decisions:
  - 'One extended AdminAuthority client owns generated-contract HTTP reads, mutations, and invalidation-only live freshness; production has no fixture fallback.'
  - 'The seven domain names and order remain stable while server-projected capabilities determine which entries are visible and actionable.'
  - 'Sidebar mode and density persist per administrator and environment only after the matching preference key has been loaded.'
  - 'Mobile navigation uses an accessible React Aria dialog trigger with focus trapping, Escape dismissal, and trigger-focus restoration.'
requirements-completed: [WEB-06, IDEN-03]
duration: 57 min
completed: 2026-08-07
status: complete
---

# Phase 04 Plan 62: Typed Admin Authority and Responsive Seven-Domain Shell Summary

**One fail-closed typed control-plane authority now powers the approved responsive Admin shell without production fixtures, role-demo navigation, or client-widened URL authority**

## Performance

- **Duration:** 57 min
- **Started:** 2026-08-07T02:09:00-03:00
- **Completed:** 2026-08-07T03:06:12-03:00
- **Tasks:** 2
- **Files modified:** 13

## Accomplishments

- Extended the existing `AdminAuthority` seam across briefing, search, invitations, governance, approvals, jobs, incidents, configuration, capacity, audit, privacy, emergency, and freshness APIs with generated validation, credentials, CSRF, idempotency, optimistic concurrency, safe bounded failures, and `no-store` semantics.
- Centralized abortable queries, mutations, live invalidation, cursor reconnect, authoritative HTTP refetch, consent clearing, and explicit production-versus-preview composition in the React authority provider.
- Removed the hard-coded role-demo navigation and delivered the stable Visão geral, Pessoas, Receita, Operação, Atendimento, Segurança, and Sistema taxonomy projected only from server-admitted capabilities.
- Added explicit environment, active-function, and freshness identity plus per-administrator/per-environment density and sidebar persistence without leaking role parameters into production URLs.
- Added responsive expanded, compact, tablet, mobile-drawer, 320px, and 200% text behavior with skip navigation, visible focus, focus trapping, Escape dismissal, focus restoration, reduced motion, forced colors, universal search focus shortcuts, inbox/jobs affordances, and accessible locale switching.
- Added deterministic Storybook witnesses for both locales and densities, long content, live/reconnecting/degraded states, reduced motion, forced colors, 200% text, tablet, mobile, drawer interaction, and 320px layout.

## Task Commits

1. **Task 04-62-01: Extend the typed Admin authority and block production fixture fallback**
   - `a322c9f` — typed query/mutation/live authority, authoritative refetch, and production fixture guard
2. **Task 04-62-02: Replace role-demo navigation with the stable responsive production shell**
   - `1dc0cee` — seven-domain responsive shell, accessible mobile drawer, persisted preferences, and Storybook matrix

## Decisions Made

- Production and preview use the same shell contract, but only explicit Storybook/test composition may inject deterministic fixture authority.
- Live delivery communicates invalidation and freshness only; current record truth always comes from a validated authoritative HTTP refetch.
- Universal shortcuts may focus search or navigate but never submit a privileged command.
- Account access remains visible at 320px while the language control compresses visually and preserves its full accessible name.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] Made the shared button a valid React Aria dialog trigger**

- **Found during:** Task 04-62-02 browser interaction verification
- **Issue:** The mobile drawer did not open because `DialogTrigger` received a plain HTML button instead of a React Aria-compatible trigger component.
- **Fix:** Extended `LbButton` with `ariaLabel`, `buttonRef`, and `className` support and used it as the drawer trigger.
- **Files modified:** `packages/design-system/src/primitives.tsx`, `packages/design-system/src/design-system.test.tsx`, `apps/admin/src/admin-navigation.tsx`
- **Verification:** Browser interaction proved open, Escape close, and focus restoration; design-system tests passed 25/25.
- **Committed in:** `1dc0cee`

**2. [Rule 1 - Bug] Removed horizontal overflow at the 320px accessibility floor**

- **Found during:** Task 04-62-02 real-browser viewport verification
- **Issue:** The shell measured 387px of content width in a 320px viewport.
- **Fix:** Bounded the menu trigger to 44px, compressed the locale control visually at the narrow breakpoint, and retained the complete accessible name.
- **Files modified:** `apps/admin/src/app/admin-shell.css`, `apps/admin/src/admin-navigation.tsx`
- **Verification:** Browser measurement returned `innerWidth: 320` and `scrollWidth: 320` with account, menu, main content, and locale accessibility preserved, including text at 200%.
- **Committed in:** `1dc0cee`

**3. [Rule 1 - Bug] Prevented preference writes from racing initial storage hydration**

- **Found during:** Task 04-62-02 persistence review
- **Issue:** The write effect could run before the administrator/environment preference key had been read and overwrite a stored choice with the default.
- **Fix:** Added a loaded-key gate so persistence starts only after hydration for the exact active administrator and environment.
- **Files modified:** `apps/admin/src/features/admin-authority.tsx`, `apps/admin/src/features/admin-authority.test.tsx`
- **Verification:** Provider tests prove stored preference hydration and subsequent persistence without an initial overwrite.
- **Committed in:** `1dc0cee`

**4. [Rule 1 - Bug] Updated authority proof to the new stable navigation contract**

- **Found during:** Task 04-62-02 regression verification
- **Issue:** An authority test still asserted the removed role-demo navigation instead of the shared permission-projected shell.
- **Fix:** Updated the test to prove `AdminNavigation`, shared shell composition, freshness, inbox, and search-focus behavior.
- **Files modified:** `apps/admin/src/features/admin-authority.test.tsx`
- **Verification:** Admin authority/provider/shell/security suite passed 63/63.
- **Committed in:** `1dc0cee`

---

**Total deviations:** 4 auto-fixed issues: three runtime/accessibility/persistence bugs and one stale contract proof. **Impact:** Required behavior is now stronger and directly verified in the browser; no architectural or production-authority scope expansion.

## Browser Runtime Verification

- Desktop drawer interaction: opened, Escape closed, focus returned, and `Ctrl/Cmd+K` focused universal search.
- 320px viewport: `innerWidth` and `scrollWidth` both 320; account and menu remained visible; drawer opened; locale retained the accessible name `Mudar idioma para English`.
- 320px plus 200% text: no horizontal overflow; main content and menu remained visible.

## Issues Encountered

- Storybook retains its testing-catalog chunk-size warning. The static catalog is isolated from the deployable Admin bundle and builds successfully.
- No Docker, production data mutation, remote fixture fallback, or destructive Neon operation was used.

## User Setup Required

None.

## Next Phase Readiness

- Plans 04-55 through 04-61 can consume the typed authority and shared stable shell to deliver their production workspaces.
- The responsive shell and its fixture-only Storybook evidence are complete for desktop, tablet, mobile, 320px, 200% text, reduced motion, and forced colors.

## Self-Check: PASSED

- Admin authority/provider/shell/security: 63/63.
- Design system: 25/25.
- Admin TypeScript: passed.
- Design system TypeScript: passed.
- ESLint: passed.
- Prettier and `git diff --check`: passed.
- Admin Storybook 10.5.4 static build: passed.
- Browser drawer/focus/320px/200% runtime verification: passed.

---

_Phase: 04-identity-commerce-devices-and-administration_
_Completed: 2026-08-07_
