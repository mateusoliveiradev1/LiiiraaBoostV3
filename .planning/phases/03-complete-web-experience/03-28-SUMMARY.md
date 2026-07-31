---
phase: 03-complete-web-experience
plan: '28'
subsystem: admin-ui
tags: [nextjs, react, xstate, accessibility, localization, consent, audit, no-change-adapter]

requires:
  - phase: 03-17
    provides: isolated bilingual admin shell, strict origin boundary, and closed role navigation
  - phase: 03-26
    provides: shared preview workflow machine, accessible review UI, and FutureAuthorityPort contract
provides:
  - Complete bilingual role-specific support, operations, security, diagnostics, and audit workspaces
  - Exact scoped and expiring diagnostic consent with immutable generated-contract audit events
  - Proportional no-change action reviews plus a semantic and machine-enforced 960px viewport boundary
affects: [03-30, 03-32, phase-04-admin-authority, admin-e2e]

tech-stack:
  added: []
  patterns:
    - Canonical admin-origin route matching with a closed role-to-route access matrix
    - Generated-contract audit records deep-frozen after runtime validation
    - Dual CSS and workflow-machine enforcement for high-risk viewport policy

key-files:
  created:
    - apps/admin/src/app/[locale]/[[...workspace]]/page.tsx
    - apps/admin/src/features/admin-preview.tsx
    - apps/admin/src/features/admin-preview.test.tsx
    - apps/admin/src/content/admin.en.json
    - apps/admin/src/content/admin.pt-BR.json
  modified: []

key-decisions:
  - 'Project each admin role from one closed route-access matrix and render a localized 403 for every cross-role route attempt.'
  - 'Admit diagnostic consent only when purpose, exact field set, expiration, actor, and immutable audit reference all match the requested synthetic object.'
  - 'Enforce the 960px high-risk boundary twice: remove confirmation controls semantically through responsive CSS and reject undersized workflow inputs in the preview machine.'

patterns-established:
  - 'Admin audit: validate the generated AdminAuditEvent union, deep-freeze the event and receipt, redact every target, and preserve exact correlation.'
  - 'Admin recovery: retain only explicitly safe synthetic identifiers; discard response and diagnostic fields across degraded states.'

requirements-completed: [WEB-08]

duration: 14min
completed: 2026-07-31
status: complete
---

# Phase 3 Plan 28: Isolated Role-Specific Admin Preview Summary

**Bilingual support, operations, security, diagnostics, and audit workspaces with exact consent scope, immutable redacted events, and closed Phase 4 no-change authority**

## Performance

- **Duration:** 14 min
- **Started:** 2026-07-31T09:59:10Z
- **Completed:** 2026-07-31T10:12:48Z
- **Tasks:** 2
- **Files modified:** 5

## Accomplishments

- Added canonical role landing, support case, operations review, security review, consent-scoped diagnostics, audit timeline, and correlated event detail routes in PT-BR and English.
- Kept support, operations, security, and audit permissions mutually distinct; every cross-role request renders the authored admin 403 without exposing credentials, customer identity, or another role's records.
- Validated and froze complete generated `AdminAuditEvent` records containing actor, role, action, redacted target, reason, consent reference, timestamp, result, correlation, and schema-valid no-change receipt.
- Enforced W15 consent negatives and W16 mobile policy while preserving safe review, explicit provenance, keyboard/focus semantics, responsive row details, reduced motion, and forced-color behavior inherited from the shell.
- Routed support, diagnostic, and critical administrative reviews through the shared preview machine and deterministic adapter so cancellation or a validated Phase 4 no-change receipt is the only terminal outcome.

## Task Commits

Each task was committed atomically:

1. **Task 1: Build role-scoped support, operations, security, and audit workspaces** - `62efb5a` (feat)
2. **Task 2: Enforce consent, proportional review, no-change, and viewport safety** - `b636f74` (feat)
3. **Quality-gate correction** - `88c840b` (fix)

## Files Created/Modified

- `apps/admin/src/app/[locale]/[[...workspace]]/page.tsx` - Canonical admin-origin catch-all resolver, localized metadata, and cross-role 403 composition.
- `apps/admin/src/features/admin-preview.tsx` - Complete role workspaces, consent guard, responsive critical reviews, shared machine integration, and immutable audit timeline.
- `apps/admin/src/features/admin-preview.test.tsx` - Role matrix, locale parity, W14-W16, consent, viewport, recovery, mutation-channel, and receipt verification.
- `apps/admin/src/content/admin.en.json` - English operational, consent, audit, recovery, and no-change copy.
- `apps/admin/src/content/admin.pt-BR.json` - PT-BR content with exact structural parity.

## Decisions Made

- Reused the proxy-projected closed role instead of accepting role or state inside the page component; ordinary requests cannot select scenarios, authority, or degraded states.
- Allowed operations and security to inspect only audit events owned by their exact role while the dedicated audit role receives the complete synthetic timeline.
- Required exact consent field-set equality, not a permissive subset, so extra or missing diagnostic fields both fail closed.
- Preserved the support case identifier as the only safe workflow draft; response content and diagnostic fields are never retained across cancellation, offline, stale, expired-session, permission, or partial-failure states.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] Adapted admin tests to the existing JSX-preserve Vitest setup**

- **Found during:** Task 1 focused verification
- **Issue:** The admin package intentionally has no JSX-transforming Vitest plugin, so importing the TSX client feature directly failed Vite import analysis.
- **Fix:** Followed the established account-app pattern: tests inspect authored TSX sources and bilingual records while executing canonical routes, scenarios, generated validation, and the live no-change adapter directly.
- **Files modified:** `apps/admin/src/features/admin-preview.test.tsx`
- **Verification:** `pnpm --filter @liiiraa/admin test -- --run` - 21/21 tests pass.
- **Committed in:** `62efb5a`

**2. [Rule 1 - Bug] Corrected lint and deterministic formatting defects**

- **Found during:** Final focused quality gate
- **Issue:** Newly authored callbacks returned `void` expressions ambiguously, two type assertions were unnecessary, and three source files were not Prettier-clean.
- **Fix:** Converted callbacks to explicit blocks, removed redundant assertions, and formatted all authored TypeScript/TSX sources.
- **Files modified:** `apps/admin/src/features/admin-preview.tsx`, `apps/admin/src/features/admin-preview.test.tsx`, `apps/admin/src/app/[locale]/[[...workspace]]/page.tsx`
- **Verification:** focused ESLint, Prettier, strict TypeScript, 21 admin tests, and optimized Next.js build all pass.
- **Committed in:** `88c840b`

---

**Total deviations:** 2 auto-fixed (1 blocking issue, 1 bug)
**Impact on plan:** Both fixes preserve the planned role, authority, dependency, and security boundaries. No package, network surface, or authoritative capability was added.

## Issues Encountered

- `pnpm web:verify:quick -- --requirement WEB-08 --grep "admin|W14|W15|W16"` passed all 20 workspace check/test tasks, then stopped at the intentional Plan 03-32 readiness boundary for final public/account/admin standalone roots and `security-boundaries.json` / `preview-boundaries.json`. The admin package's strict check, 21 tests, security/cookie suite, lint, formatting, Impeccable detector, and production build pass. No final evidence was fabricated in this plan.

## Known Stubs

None. Every operational value is a populated synthetic fixture, and every future-authority action deliberately ends at cancellation or a schema-valid Phase 4 no-change receipt.

## Threat Flags

No unmodeled threat surface was introduced. The new catch-all resolves only predeclared admin-origin routes behind the existing nonce/CSP/cookie proxy, exposes no network or upload channel, and implements the plan's role/consent boundary.

## Verification

- `pnpm --filter @liiiraa/admin test -- --run` - PASS, 21 tests.
- `pnpm --filter @liiiraa/admin check` - PASS, strict TypeScript.
- `pnpm --filter @liiiraa/admin build` - PASS, optimized Next.js 16 standalone artifact with the canonical dynamic admin route.
- Focused ESLint and Prettier checks - PASS with zero findings.
- Impeccable detector over the new route and feature - PASS with zero anti-pattern findings.
- `pnpm web:verify:quick -- --requirement WEB-08 --grep "admin|W14|W15|W16"` - all implementation checks/tests PASS; final evidence promotion remains intentionally pending Plan 03-32.
- Stub, mutation-channel, and threat-surface scans - PASS; no placeholder, network, upload, cookie, browser-storage, or authoritative mutation channel found.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness

- Plan 03-30 can exercise the isolated public/account/admin applications in the complete cross-origin E2E matrix.
- Plan 03-32 can promote WEB-08 only after all three standalone builds and final security/preview evidence are present.

## Self-Check: PASSED

- All five implementation/content/test files and this summary exist on disk.
- Task commits `62efb5a`, `b636f74`, and `88c840b` exist in git history.
- Verification claims, role/consent boundaries, requirement mapping, and the intentional Plan 03-32 readiness deferral were confirmed against the working tree.

---

_Phase: 03-complete-web-experience_
_Completed: 2026-07-31_
