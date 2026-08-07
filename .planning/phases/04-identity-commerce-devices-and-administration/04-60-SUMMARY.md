---
phase: 04-identity-commerce-devices-and-administration
plan: '60'
subsystem: admin-ui
tags: [admin, operations, security, system, postgres, contracts, storybook, accessibility]
requires:
  - phase: 04-62
    provides: Typed production Admin authority, canonical projections, mutations, and invalidation-only live delivery
  - phase: 04-53
    provides: Durable PostgreSQL operations, receipts, workers, incidents, configuration, privacy, and emergency authority
provides:
  - PostgreSQL-backed Operation, Security, and System workspaces with surface-specific authority queries
  - Bounded job, recovery, configuration, privacy, and emergency transitions with canonical receipts
  - Canonical capacity, environment, audit, alert, export, incident, and job projections validated before rendering
  - Responsive bilingual Storybook coverage for operational lifecycle, degraded, conflict, receipt, and accessibility states
affects: [04-61, admin-operations, admin-security, admin-system, operational-authority, ui-verification]
tech-stack:
  added: []
  patterns:
    [
      canonical-postgres-projections,
      surface-specific-authority-query,
      bounded-versioned-admin-command,
      fail-closed-live-mutation,
      focus-restoring-inspector,
      fixture-only-stories,
    ]
key-files:
  created:
    - apps/admin/src/features/admin-operations-system.tsx
    - apps/admin/src/features/admin-operations-system.module.css
    - apps/admin/src/features/admin-operations-system.stories.tsx
  modified:
    - apps/admin/src/features/admin-operations-system-model.ts
    - apps/admin/src/features/admin-operations-system-model.test.ts
    - apps/admin/src/admin-authority.ts
    - apps/admin/src/features/admin-authority.tsx
    - apps/api/src/staging/runtime.ts
    - apps/api/src/modules/admin/operations-routes.ts
    - packages/contracts-source/src/control-plane.tsp
    - packages/control-plane-application/src/use-cases/manage-admin-operations.ts
key-decisions:
  - 'Operational rows are projected into canonical generated documents and validated before leaving PostgreSQL authority; raw database rows never become Admin UI truth.'
  - 'Operation, Security, and System query only their own required families, and uncertain or incomplete authority disables mutation instead of creating hidden work.'
  - 'Sensitive recovery, configuration, privacy, export, and emergency actions carry bounded command identity, version, environment, reason, validation, and receipt evidence rather than arbitrary command text.'
  - 'Desktop uses a docked inspector, tablet uses a sheet, and mobile retains a full-width route while focus enters the inspector and returns to its exact trigger.'
requirements-completed: [WEB-06, WEB-07, IDEN-03]
duration: 45 min
completed: 2026-08-07
status: complete
---

# Phase 04 Plan 60: Operation, Security, and System Workspaces Summary

**Durable operational control now renders from canonical PostgreSQL authority through bounded, versioned commands, explicit live state, responsive inspectors, and zero production fixture fallback**

## Performance

- **Duration:** 45 min
- **Started:** 2026-08-07T09:49:29Z
- **Completed:** 2026-08-07T10:34:00Z
- **Tasks:** 2
- **Files modified:** 25

## Accomplishments

- Added deterministic policy for job transitions, partial failure, incident recovery, capacity forecasts, configuration rollout/rollback, environment isolation, privacy execution, and capability-scoped emergency restoration.
- Extended canonical TypeSpec projections and the generated TypeScript/Rust/OpenAPI/JSON Schema artifacts for jobs, incidents, exports, configuration, capacity, environments, audit, alerts, privacy, emergency stops, commands, and receipts.
- Corrected real PostgreSQL operational queries to the durable migration schema, projected all twelve persisted operation families, validated every projection, and kept sensitive reasons inside authority.
- Built bilingual Operation, Security, and System workspaces with dense ledgers, protected exports, capacity evidence, audit history, safe alerts, focus-restoring inspectors, explicit freshness, conflicts, receipts, and fail-closed controls.
- Added Storybook witnesses for live, loading, empty, reconnecting, degraded/stale, error, conflict, success receipt, partial job, long content, PT-BR/English, desktop, tablet, 390px, 320px, 200-percent text, forced colors, and reduced motion.

## Task Commits

1. **Task 04-60-01: Project operational risk, lifecycle, and environment state**
   - `11c2a5f` — failing operational system policy tests establishing the RED gate
   - `00a3d30` — deterministic operational lifecycle, risk, environment, and recovery policy
2. **Task 04-60-02: Compose Operation, Security, and System route families**
   - `fdcad35` — canonical authority projections, bounded mutations, responsive workspaces, and complete stories

## Decisions Made

- Each Admin surface requests only its own authorized families: Operation receives jobs/exports/configuration/capacity, Security receives incidents/alerts/privacy/emergency, and System receives environments/audit/configuration/capacity.
- A surface can mutate only when all required projections are online, freshness is live, and the active server session function matches the surface; reconnecting and degraded states remain marked read-only.
- Operation receipts use their canonical receipt ID, while every other admitted document has a safe explicit reference fallback without assuming fields outside its generated union.
- Critical action forms require an auditable reason, explicit scope/impact/restoration review, current aggregate version, environment identity, and a bounded operation family; no generic script, registry, service, or remote execution field exists.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] Restored deterministic standalone validator generation**

- **Found during:** Task 04-60-02 contract generation
- **Issue:** Ajv standalone generation registered dependent `$defs` before their prerequisites and failed while compiling the expanded canonical operations union.
- **Fix:** Registered definitions in dependency-topological order and regenerated all contract artifacts.
- **Files modified:** `packages/contracts-ts/scripts/generate-standalone.mjs` and generated contract artifacts
- **Verification:** `rtk pnpm contracts:generate`, Admin/API/application TypeScript, and all focused tests passed.
- **Committed in:** `fdcad35`

**2. [Rule 2 - Missing Critical] Completed canonical authority for every persisted operations family**

- **Found during:** Task 04-60-02 production authority integration
- **Issue:** Existing staging queries referenced fields that did not match migration `0006_admin_operations.sql`, several families lacked canonical projections, and successful mutations did not consistently return durable receipt authority.
- **Fix:** Aligned queries to real columns, added generated projections and validation for all twelve families, injected command/correlation/idempotency evidence, and returned canonical operation receipts while retaining sensitive reasons in PostgreSQL.
- **Files modified:** `apps/api/src/staging/runtime.ts`, `apps/api/src/modules/admin/operations-routes.ts`, `apps/admin/src/admin-authority.ts`, `packages/contracts-source/src/control-plane.tsp`, generated artifacts, and focused tests
- **Verification:** API 13/13, Admin 18/18, application 7/7, contract generation, TypeScript, scoped ESLint, and Storybook passed.
- **Committed in:** `fdcad35`

**3. [Rule 1 - Bug] Prevented cross-surface data reuse and completed inspector focus ownership**

- **Found during:** React and browser review of Task 04-60-02
- **Issue:** Querying every family for every surface could block an otherwise valid action on unrelated denied data, a fast surface change could briefly reuse the prior projection set, and the inspector restored focus on close without taking focus on open.
- **Fix:** Added surface-specific query sets, tracked the loaded surface, mapped Security mutations to the Security function, focused the inspector after opening, and restored the exact row trigger after closing.
- **Files modified:** `apps/admin/src/features/admin-operations-system.tsx`, `apps/admin/src/features/admin-authority.tsx`
- **Verification:** Playwright confirmed no horizontal overflow, `ASIDE` focus on open, and exact trigger-button focus on close; Admin TypeScript and focused tests remained green.
- **Committed in:** `fdcad35`

---

**Total deviations:** 3 auto-fixed (1 blocker, 1 missing critical, 1 bug). **Impact:** All fixes were necessary to keep generated authority valid, prevent cross-surface leakage/flicker, and make the critical workflow keyboard-complete; no unrelated product scope was introduced.

## Browser Runtime Verification

- Operation rendered at 1600×1000 with the dense queue, protected export ledger, capacity evidence, and docked inspector without horizontal overflow.
- Security rendered at 390×844 as a readable single-column operational list without squeezed desktop composition or horizontal overflow.
- Opening a row moved focus to the labelled details inspector; closing returned focus to the exact originating row.
- The static Storybook build contains Operation, Security, System, both locales, long content, partial failure, degraded authority, conflict, receipt, viewport, text-scale, forced-color, and reduced-motion witnesses.

## Issues Encountered

- The repository-wide ESLint command still reports 264 pre-existing errors across unrelated account, preview, desktop, and web-evidence configuration files. Scoped ESLint over every file changed by Plan 04-60 passes with zero errors.
- Storybook retains its existing catalog chunk-size warning; all stories compiled successfully.

## User Setup Required

None.

## Next Phase Readiness

- Plan 04-61 can register every redesigned Admin workspace into the production route registry and run the complete browser-to-API-to-PostgreSQL evidence matrix.
- The bounded Operation/Security/System components now expose only typed authority and contain no production fixtures, so integration does not require redesigning their trust boundary.

## Self-Check: PASSED

- Canonical contract generation: passed.
- Admin authority and operational model tests: 18/18.
- API operations and real Admin tests: 13/13.
- Control-plane application operations tests: 7/7.
- Admin TypeScript, scoped ESLint, Prettier, and `git diff --check`: passed.
- Admin Storybook static build: passed.
- Desktop/mobile overflow and inspector focus-open/focus-return browser witnesses: passed.
- Production fixture fallback and arbitrary execution fields: absent.

---

_Phase: 04-identity-commerce-devices-and-administration_
_Completed: 2026-08-07_
