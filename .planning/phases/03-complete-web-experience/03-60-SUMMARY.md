---
phase: 03-complete-web-experience
plan: '60'
subsystem: admin-ui
tags:
  [
    react,
    responsive-table,
    accessibility,
    consent,
    audit,
    xstate,
    tdd,
    i18n,
    mobile-semantics,
    architecture,
  ]

requires:
  - phase: 03-complete-web-experience
    provides: Cobalt product vocabulary, isolated admin shell, closed role admission, and guarded preview authority from Plans 03-54 and 03-59
provides:
  - Explicit role-specific focal decisions in an exact 8/4 administrative workspace
  - Dense responsive task queues and immutable audit rows with progressive detail
  - Localized human audit presentation with exact consent and no-change provenance
  - Semantic removal of high-risk admin authority below the 960px desktop boundary
  - Direct bilingual outcome copy with no visible internal Phase 3 or Phase 4 implementation prose
  - Server-owned admin layout consuming ProductLockup through the public design-system boundary
affects: [03-61-browser-proof, admin-visual-evidence, admin-accessibility, admin-security]

tech-stack:
  added: []
  patterns:
    - Closed role-to-focal-route projection with E2 decision and E1 context regions
    - Transport-to-human audit projection before ordinary UI rendering
    - Presentation-level mobile authority omission backed by workflow viewport rejection
    - App-owned client bridge between server layouts and client-heavy public UI barrels

key-files:
  created:
    - apps/admin/src/admin-product-lockup.tsx
  modified:
    - apps/admin/src/content/admin.en.json
    - apps/admin/src/content/admin.pt-BR.json
    - apps/admin/src/features/admin-preview.tsx
    - apps/admin/src/features/admin-preview.test.tsx
    - apps/admin/src/app/admin-shell.css
    - apps/admin/src/app/[locale]/layout.tsx
    - apps/admin/src/admin-shell.test.ts
    - tooling/architecture-tests/src/check-workspace.test.ts

key-decisions:
  - 'Give support, operations, security, and audit an explicit focal route instead of inferring the next task from route order.'
  - 'Keep immutable raw audit values inside validated records while projecting action, role, and result into localized human copy at render time.'
  - 'Omit critical admin and diagnostic controls from mobile DOM semantics below 960px while retaining safe review and unavailable-authority explanation.'
  - 'Project localized audit target and reason copy by immutable event identity while leaving the validated transport records frozen and unchanged.'
  - 'Render a reason-only mobile authority notice below 960px; retain the constrained disabled authority control only in the desktop branch.'
  - 'Keep the admin locale layout server-owned and isolate the public design-system ProductLockup behind one narrow app-owned client bridge.'

patterns-established:
  - 'Role landing composition uses one exact 8/4 focal/context region followed by a full-width responsive queue.'
  - 'Event identity remains the essential reflow column while complete immutable audit detail stays available through row disclosure.'

requirements-completed: [WEB-08]

duration: 26min
completed: 2026-08-01
status: complete
---

# Phase 03 Plan 60: Focal Admin Decision Workspaces Summary

**Role-specific 8/4 operator workspaces with localized audit evidence, direct bilingual outcomes, and semantically absent mobile high-risk authority**

## Performance

- **Original plan duration:** 11 min
- **03-65 rejection correction:** 9 min
- **03-66 architecture correction:** 6 min
- **Total duration:** 26 min
- **Started:** 2026-08-01T18:08:11Z
- **Correction completed:** 2026-08-02T03:18:00Z
- **Tasks:** 2 planned tasks plus 2 corrective passes
- **Files modified:** 9

## Accomplishments

- Assigned each admitted admin role a distinct next decision and composed it as a decisive E2 focal region beside calm E1 role/status context.
- Replaced the plain role queue with a dense responsive table that retains task identity and exposes complete row detail without clipped mobile columns or generic card reflow.
- Translated audit action, role, result, and diagnostic readiness into localized human meaning while preserving validated immutable transport records, redacted targets, consent references, timestamps, and correlations.
- Kept safe mobile review and no-authority explanation available while removing critical administrative and diagnostic controls from DOM semantics below 960px.
- Closed the Plan 03-65 rejection by replacing visible Phase 3/Phase 4 prose with direct localized outcomes in W14-W16 and G07.
- Localized W15's target and reason in PT-BR while retaining the original validated English transport values internally.
- Removed W16's disabled publication control from the mobile DOM branch and retained the review context plus a concise authority reason.
- Closed the final Plan 03-66 admin architecture blocker by replacing the private design-system source traversal with an admin-owned client bridge to the public package export.

## Task Commits

Each TDD task was committed through RED then GREEN:

1. **Task 1: Compose role-specific focal decision workspaces**
   - `2ec675b` — RED role, density, geometry, reflow, and localization contracts
   - `8ef2006` — GREEN 8/4 role workspaces and responsive human audit presentation
2. **Task 2: Keep consent, audit, and high-risk authority fail closed**
   - `981c424` — RED mobile semantics, audit detail, and workflow-policy contracts
   - `f2eb53c` — GREEN semantic viewport gate with preserved consent and no-change evidence
3. **Plan 03-65 rejection correction**
   - `c415227` — RED internal-prose, W15 localization, and W16 mobile-semantic rejection contracts
   - `57a8608` — GREEN bilingual outcome projection and responsive authority-control omission
4. **Plan 03-66 architecture correction**
   - `cac2d9b` — Public ProductLockup bridge, private-import regression, and live dependency-parity alignment

## Files Created/Modified

- `apps/admin/src/features/admin-preview.tsx` — Explicit role focal projection, responsive queues, localized audit presentation, and semantic high-risk viewport gating.
- `apps/admin/src/features/admin-preview.test.tsx` — Role, geometry, density, consent, audit completeness, workflow policy, and mobile authority tests.
- `apps/admin/src/app/admin-shell.css` — Exact 8/4 composition, E2/E1 hierarchy, full lower-workspace density, progressive row detail, reflow, and existing forced-color/reduced-motion support.
- `apps/admin/src/content/admin.en.json` — Direct human outcome, availability, and no-change receipt copy plus immutable-event presentation strings.
- `apps/admin/src/content/admin.pt-BR.json` — Equivalent PT-BR outcome copy and localized audit target/reason projection.
- `apps/admin/src/app/[locale]/layout.tsx` — Retains authoritative server composition while importing the app-local ProductLockup bridge.
- `apps/admin/src/admin-product-lockup.tsx` — Narrow `'use client'` bridge to the public `@liiiraa/design-system` ProductLockup export.
- `apps/admin/src/admin-shell.test.ts` — Rejects private design-system traversal and verifies the exact bridge and lockup semantics.
- `tooling/architecture-tests/src/check-workspace.test.ts` — Aligns the live web manifest-parity expectation with the already-declared public design-system dependency.

## Decisions Made

- Used a closed `ADMIN_ROLE_FOCAL_ROUTE` record so role priority is authored and reviewable rather than an incidental consequence of route-array order.
- Kept machine evidence immutable and technically exact, but required a fail-closed localized presentation function before action, role, or result reaches ordinary chrome.
- Enforced the 960px boundary twice: React omits high-risk controls from mobile semantics, while the existing CSS and workflow policy remain defense in depth.
- Reused the established `ResponsiveDataTable` and Cobalt materials instead of adding a parallel component vocabulary, new token, or card wall.
- Extended the localized presentation boundary to target and reason; event identity selects approved human copy while raw validated records remain unchanged.
- Split disconnected authority presentation by viewport so desktop retains the disabled publication control and mobile receives the same reason without any button semantics.
- Preserved the admin layout as a Server Component; only the narrow ProductLockup bridge is client-marked, matching the validated public and account shell pattern.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Test bug] Corrected the responsive-table selector to the canonical shared class**

- **Found during:** Task 1 GREEN
- **Issue:** The initial RED assertion named a non-existent `.lb-responsive-table` class instead of the established `.lb-web-table-region` emitted by `ResponsiveDataTable`.
- **Fix:** Bound the geometry assertion to the actual public component contract without weakening the responsive-detail requirement.
- **Files modified:** `apps/admin/src/features/admin-preview.test.tsx`
- **Verification:** Filtered role/workspace/queue/audit/table suite passed 14/14.
- **Committed in:** `8ef2006`

**2. [Rule 3 - Blocking Issue] Closed the public ProductLockup boundary and live dependency-parity gate**

- **Found during:** Plan 03-66 aggregate architecture replay
- **Issue:** The admin locale layout traversed directly into `packages/design-system/src/product-lockup.tsx`. Once the last deep import was removed, the architecture unit phase exposed a stale web-app dependency expectation that omitted the public design-system dependency already declared by Plan 03-56.
- **Fix:** Added an admin-owned client ProductLockup bridge, switched the server layout to that local boundary, added a private-import regression, and aligned the architecture parity fixture with the live public manifest.
- **Files modified:** `apps/admin/src/admin-product-lockup.tsx`, `apps/admin/src/app/[locale]/layout.tsx`, `apps/admin/src/admin-shell.test.ts`, `tooling/architecture-tests/src/check-workspace.test.ts`
- **Verification:** Focused shell 1/1, shared ProductLockup render 1/1, full admin 58/58, architecture 46/46, strict TypeScript, production build, Prettier, and diff checks passed.
- **Committed in:** `cac2d9b`

---

**Total deviations:** 2 auto-fixed (1 Rule 1 test bug, 1 Rule 3 blocking issue)
**Impact on plan:** Both corrections align tests and imports with established public contracts; scope, security, visual semantics, dependency versions, and runtime authority remain unchanged.

## Issues Encountered

- Direct runtime importing of the client TSX composition was incompatible with this package's Vitest `jsx: preserve` transform path. Task 2 retained executable policy and authority tests while using source-contract assertions for responsive DOM composition, matching the established suite pattern.
- A strict TypeScript check required an explicit fail-closed fallback for an unknown audit role string before localized projection; unknown roles now display localized unavailable authority instead of becoming raw UI.
- The earlier corrective pass recorded a pre-existing 57/58 shell-geometry mismatch. The shared tree resolved that independent issue before this architecture correction; the current complete admin suite passes 58/58.
- Running the first TypeScript check concurrently with `next build` briefly exposed missing generated `.next/types` files while the build recreated them. The required sequential post-build check passed without source changes.
- An overlapping architecture retry briefly scanned another run's temporary mutation directory after it was removed. A single serial replay then passed the live adapters and all 46 architecture tests; no repository artifact was created or deleted.

## TDD Gate Compliance

- Task 1 RED `2ec675b` failed on the three planned missing workspace contracts before GREEN `8ef2006` passed the filtered 14-test gate and TypeScript check.
- Task 2 RED `981c424` failed on semantic mobile authority presence before GREEN `f2eb53c` passed all 23 preview tests and TypeScript check.
- Correction RED `c415227` failed all 3 focused rejection tests on the old Phase copy, absent W15 localization projection, and W16 mobile control presence; GREEN `57a8608` passes those contracts and all 26 preview tests.
- The 03-66 architecture regression was observed RED on the missing admin bridge before implementation, then the regression and source correction were committed atomically in `cac2d9b` following the validated 03-56/03-58 pattern.
- All three RED commits precede their corresponding GREEN commits.

## Known Stubs

None. The modified files contain no TODO/FIXME, placeholder UI, empty data wiring, or goal-blocking provisional behavior. Null workflow state and empty safe-draft defaults are intentional closed state-machine inputs.

## Verification

- `rtk pnpm --filter @liiiraa/admin exec vitest run src/features/admin-preview.test.tsx -t "role|workspace|queue|audit|table"` — 14/14 selected tests passed.
- Correction RED filter — 3/3 selected tests failed for the expected 03-65 findings before implementation.
- `rtk pnpm --filter @liiiraa/admin exec vitest run src/features/admin-preview.test.tsx` — 26/26 tests passed after correction.
- `rtk pnpm --filter @liiiraa/admin exec vitest run` — 58/58 current tests passed.
- `rtk pnpm --filter @liiiraa/web-evidence exec vitest run src/security-boundaries.test.ts` — 8/8 security tests passed.
- `rtk pnpm --filter @liiiraa/admin run check` — strict TypeScript passed.
- `rtk pnpm --filter @liiiraa/admin run build` — optimized Next.js production build passed.
- Prettier check on all four correction files — passed.
- Impeccable detector on the modified admin TSX — zero findings.
- `rtk pnpm --filter @liiiraa/web-evidence exec playwright test tests/accessibility-responsive.spec.ts --project=admin-final-mobile-390 --grep "W16 canonical accessible visual"` — 1/1 passed at 390px with no snapshot update.

### 03-66 Architecture Correction

- Focused admin shell regression — 1/1 passed after failing on the missing bridge before implementation.
- `rtk pnpm --filter @liiiraa/design-system exec vitest run src/design-system.test.tsx -t ProductLockup` — exact shared ProductLockup render contract passed 1/1.
- `rtk pnpm --filter @liiiraa/admin exec vitest run` — complete admin suite passed 58/58.
- `rtk pnpm --filter @liiiraa/admin run check` — strict TypeScript passed sequentially after the production build.
- `rtk pnpm --filter @liiiraa/admin run build` — optimized Next.js production build passed with the locale layout still server-owned.
- Focused live manifest-parity regression — 1/1 passed.
- `rtk pnpm test:architecture` — live workspace and Cargo adapters passed; architecture tests passed 46/46 with zero violations.
- Prettier and `git diff --check` passed for the bounded four-file correction; no screenshot, manifest, dependency, or lockfile changed.

## Acceptance Criteria

- **PASS — Every role has a credible next decision and useful operational density:** exact support, operations, security, and audit focal routes plus a full-width assigned queue are asserted.
- **PASS — Tables and timelines reflow semantically:** event/task identity remains essential and full row details remain available through native disclosure.
- **PASS — No raw fixture status or invented metric appears:** audit and diagnostic status values are localized; deterministic identifiers remain only as technical evidence.
- **PASS — Consent, audit, and high-risk contracts remain complete:** purpose, exact fields, expiration, actor, immutable reference, impact, reauthentication policy, confirmation, redaction, correlation, and no-change receipt gates pass.
- **PASS — Localized copy excludes internal delivery prose:** W14-W16 and G07 render direct outcome and authority language without visible Phase 3/Phase 4 references; W15 renders localized PT-BR audit target and reason.
- **PASS — Mobile semantics exclude high-risk controls:** W16's React branch emits a reason-only notice below 960px and no `LbButton`; the desktop branch retains the disabled authority control, while workflow and CSS remain defense in depth.

## Threat Review

- **T-03-60-01 Elevation of Privilege:** mitigated by the closed role matrix, explicit role focal routes, disconnected authority, semantic mobile omission, and workflow desktop gate.
- **T-03-60-02 Information Disclosure:** mitigated by exact consent purpose/field/expiration/actor/audit matching, redacted targets, and bounded progressive detail.
- **T-03-60-03 Repudiation:** mitigated by immutable validated actor, role, localized action, redacted target, reason, consent, time, result, correlation, and receipt evidence.
- No new endpoint, authentication path, file-access boundary, schema, dependency, or external runtime surface was introduced.
- The public package bridge narrows module access without changing ProductLockup markup, browser authority, origin admission, cookies, storage, or network behavior.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness

- Plan 03-61 Task 2 can now rerun browser, motion, and responsive evidence against the corrected operator workspaces before the next bounded Plan 03-62 capture.
- The admin portion of the Plan 03-66 architecture blocker is closed; aggregate replay can rerun with all public, account, and admin ProductLockup imports on the public boundary.
- Human visual approval remains pending and was not inferred from automated checks.

## Self-Check: PASSED

- All three modified implementation/test files and this summary exist on disk.
- Both localized content files exist and retain the same admitted schema shape.
- The admin ProductLockup bridge exists and the locale layout contains no private design-system source traversal.
- TDD and correction commits `2ec675b`, `8ef2006`, `981c424`, `f2eb53c`, `c415227`, `57a8608`, and `cac2d9b` resolve in Git history.

---

_Phase: 03-complete-web-experience_
_Completed: 2026-08-01_
