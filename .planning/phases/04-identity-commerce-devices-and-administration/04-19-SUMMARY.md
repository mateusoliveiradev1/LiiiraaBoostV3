---
phase: 04-identity-commerce-devices-and-administration
plan: "19"
subsystem: admin-auth
tags: [react, nextjs, fastify, generated-contracts, rbac, consent, playwright]

requires:
  - phase: 04-16
    provides: Administrative authorization and audited command authority
  - phase: 04-34
    provides: Shared workflow interruption and authority contract foundations
provides:
  - Production admin adapter backed by generated contracts and server-derived singular roles
  - Step-up, reason, impact-review, confirmation, redaction, receipt, and consent-clear UI gates
  - Browser evidence for role isolation and cross-origin diagnostic-consent revocation
affects: [admin, identity, support-diagnostics, audit, web-evidence]

tech-stack:
  added: ["@liiiraa/contracts-ts as an apps/admin runtime dependency"]
  patterns: [server-authorized projections, explicit preview-production composition, abortable consent views]

key-files:
  created:
    - apps/admin/src/admin-authority.ts
    - apps/admin/src/admin-runtime-server.ts
    - apps/admin/src/features/admin-authority.tsx
    - apps/admin/src/features/admin-authority.test.tsx
  modified:
    - apps/admin/src/admin-runtime.ts
    - apps/admin/src/admin-preview-model.ts
    - apps/api/src/modules/admin/routes.ts
    - tooling/web-evidence/tests/admin-authority.spec.ts
    - tooling/web-evidence/tests/admin-consent-revocation.spec.ts

key-decisions:
  - "Only the server session role admits admin routes and records; role-like URL state remains navigation-only."
  - "Production and preview composition are selected explicitly, preserving Phase 3 fixtures without importing fixture authority into production."
  - "Diagnostic consent is treated as a live capability: no-store projections are cleared and requests aborted on revoke or expiry while audit evidence remains."

patterns-established:
  - "Authorize before projection: deny a role-route combination before loading privileged records."
  - "Critical admin commands require action-scoped strong step-up, a reason, impact review, explicit confirmation, and an immutable receipt."

requirements-completed: [WEB-06, WEB-07, IDEN-03]

duration: 26min
completed: 2026-08-05
status: complete
---

# Phase 04 Plan 19: Least-Privilege Admin Authority Summary

**Generated-contract admin authority with singular server roles, gated critical commands, consent-bound diagnostics, immutable receipts, and cross-origin browser proof**

## Performance

- **Duration:** 26 min
- **Started:** 2026-08-05T07:09:53Z
- **Completed:** 2026-08-05T07:35:43Z
- **Tasks:** 2
- **Files modified:** 15

## Accomplishments

- Activated the isolated production admin app with a generated-contract adapter and a server-derived singular role that cannot be widened through URL state.
- Added strong step-up, reason, impact review, confirmation, redacted break-glass metadata, immutable receipts, and continuous consent abort/clear behavior.
- Proved role denial, handoff, critical-action gates, live cross-origin consent revocation, expiry clearing, no durable diagnostic URLs, and retained audit witnesses in Playwright.
- Preserved the deterministic Phase 3 preview fixture and its visual/accessibility evidence behind explicit preview composition.

## Task Commits

Each task was committed atomically:

1. **Task 1 RED: Add failing admin authority contract** - `f65bada` (test)
2. **Task 1 GREEN: Bind admin UI to server-authorized projections and receipts** - `03e8385` (feat)
3. **Task 2: Prove role isolation and live consent revocation** - `a0232d4` (test)

**Plan metadata:** recorded in the closeout documentation commits.

## Files Created/Modified

- `apps/admin/src/admin-authority.ts` - Generated-contract HTTP adapter for session roles, projections, commands, redacted metadata, and consent-bound diagnostics.
- `apps/admin/src/admin-runtime-server.ts` - Server-only production/preview runtime selection.
- `apps/admin/src/admin-runtime.ts` - Runtime contracts and centralized role-to-route admission map.
- `apps/admin/src/features/admin-authority.tsx` - Production authority UI with route denial, critical-action gates, receipts, and diagnostic lifecycle handling.
- `apps/admin/src/features/admin-authority.test.tsx` - Focused authority, step-up, consent, redaction, receipt, and fixture-isolation tests.
- `apps/admin/src/app/[locale]/[[...workspace]]/page.tsx` - Production authority page composition.
- `apps/admin/src/app/[locale]/layout.tsx` - Runtime-class projection for the isolated admin document.
- `apps/admin/src/admin-preview-model.ts` - Preview fixtures now reuse the canonical route-admission policy.
- `apps/admin/src/index.ts` - Production authority exports.
- `apps/admin/package.json` and `pnpm-lock.yaml` - Generated contracts promoted to runtime use; preview fixtures remain development-only.
- `apps/api/src/modules/admin/routes.ts` - No-store administrative session projection endpoint.
- `tooling/web-evidence/playwright.config.ts` - Production admin runtime selection for authority suites and account/admin startup for consent evidence.
- `tooling/web-evidence/tests/admin-authority.spec.ts` - Browser role, route, handoff, step-up, command, receipt, and redaction evidence.
- `tooling/web-evidence/tests/admin-consent-revocation.spec.ts` - Cross-origin revoke/expiry clearing and immutable audit evidence.

## Decisions Made

- Server session state is the sole role authority; query parameters can request navigation but never assume or widen a role.
- Preview and production are explicit runtime compositions, allowing deterministic visual fixtures without leaking fixture authority into the production bundle.
- Authorization occurs before record projection, and sensitive diagnostic data is held only while consent remains active.
- The existing administrative authorization service remains authoritative; the new session route exposes its bounded projection with `Cache-Control: no-store, private` rather than duplicating identity logic.

## Verification

- `rtk pnpm --filter @liiiraa/admin test -- --run admin-authority` - 81 tests passed.
- `rtk pnpm --filter @liiiraa/admin check` - strict TypeScript passed.
- `rtk pnpm --filter @liiiraa/web-evidence check` - Playwright TypeScript passed.
- `rtk pnpm --filter @liiiraa/api test -- --run admin-authorization` - 4 tests passed.
- `rtk pnpm --filter @liiiraa/admin build` - production Next.js build passed.
- Admin authority Playwright suite - 4 passed, 32 axis skips.
- Consent revocation Playwright suite - 2 passed, 16 axis skips.
- Existing admin fixture regression - 8 passed, 64 axis skips.
- W18 admin accessibility gate - 4 passed, 32 axis skips across reflow, 200% text, reduced motion, and forced colors.
- Production import isolation - no `@liiiraa/web-preview` import in authority/runtime/view production sources; the package remains an intentional dev dependency.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 2 - Missing Critical] Added production composition and a no-store session projection**
- **Found during:** Task 1 (Bind admin UI to server-authorized projections and receipts)
- **Issue:** The planned adapter could not establish server-derived role authority without a production page/runtime selector and a bounded session projection.
- **Fix:** Added server runtime resolution, production page/layout composition, exports, and `GET /v1/admin/session` backed by the existing authorization service with private no-store caching.
- **Files modified:** `apps/admin/src/admin-runtime-server.ts`, `apps/admin/src/app/[locale]/[[...workspace]]/page.tsx`, `apps/admin/src/app/[locale]/layout.tsx`, `apps/admin/src/index.ts`, `apps/api/src/modules/admin/routes.ts`
- **Verification:** 81 focused tests, 4 API authorization tests, and the production build passed.
- **Committed in:** `03e8385`

**2. [Rule 3 - Blocking] Promoted generated contracts to an admin runtime dependency**
- **Found during:** Task 1 (Bind admin UI to server-authorized projections and receipts)
- **Issue:** The production adapter imports generated DTOs at runtime, while the admin package did not declare the contracts package as a runtime dependency.
- **Fix:** Declared `@liiiraa/contracts-ts` for runtime use and kept `@liiiraa/web-preview` development-only; refreshed the lockfile.
- **Files modified:** `apps/admin/package.json`, `pnpm-lock.yaml`
- **Verification:** Admin typecheck and production build passed; production source isolation found no preview import.
- **Committed in:** `03e8385`

**3. [Rule 1 - Bug] Disambiguated the browser denial witness**
- **Found during:** Task 2 (Prove role isolation and live consent revocation)
- **Issue:** The initial Playwright locator matched multiple alert regions containing denial copy, making the evidence ambiguous.
- **Fix:** Scoped the assertion to the alert containing the expected route-denial text.
- **Files modified:** `tooling/web-evidence/tests/admin-authority.spec.ts`
- **Verification:** The full authority suite passed with 4 canonical-axis tests.
- **Committed in:** `a0232d4`

---

**Total deviations:** 3 auto-fixed (1 missing critical, 1 blocking, 1 bug)
**Impact on plan:** The additions were required to activate and prove the planned security boundary; no unrelated feature scope was added.

## Issues Encountered

- The first browser denial assertion was ambiguous; it was scoped to the intended alert and the suite passed on rerun.
- The Windows environment lacks a standalone `grep` binary, so the read-only production isolation check was rerun successfully with ripgrep.
- No Docker, Docker Desktop, or Testcontainers interaction occurred.
- Protected untracked paths `.impeccable/` and `apps/desktop/src-tauri/gen/` were left untouched and unstaged.

## Known Stubs

None. Empty collections and nullable session/receipt values found by the scan are intentional loading, denial, or test-fixture states and do not block the plan goal.

## Threat Surface Review

The new `/v1/admin/session` route remains inside the plan's isolated-admin-to-privileged-API trust boundary. It returns only the bounded server-derived role projection, uses private no-store caching, and introduces no unmodeled network, file, schema, or remote-execution surface.

## TDD Gate Compliance

- RED gate: `f65bada` introduced the missing-authority witness and failed for the expected absent module.
- GREEN gate: `03e8385` followed RED and passed the focused authority suite.
- Task 2 evidence was committed separately as `a0232d4` after its browser gates passed.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness

- WEB-06, WEB-07, and IDEN-03 now have production UI and browser evidence for least-privilege administrative authority.
- Downstream admin operations can reuse the generated adapter, centralized route-admission map, critical-action gate, and consent lifecycle pattern.
- No blockers remain.

## Self-Check: PASSED

- All four files recorded as created by this plan exist on disk.
- Task commits `f65bada`, `03e8385`, and `a0232d4` exist in git history.
- The canonical summary exists at the required phase path.

---
*Phase: 04-identity-commerce-devices-and-administration*
*Completed: 2026-08-05*
