---
phase: 03-complete-web-experience
plan: '30'
subsystem: testing
tags: [playwright, vitest, accessibility, visual-regression, csp, nextjs, web-performance]

requires:
  - phase: 03-complete-web-experience
    provides: Canonical W01-W18 scenarios, independently built public/account/admin apps, UI contract, preview adapters, and capture infrastructure
provides:
  - Deterministic W01-W18 public, documentation, release, account, and admin browser journeys
  - Built-artifact origin, CSP, cookie, indexing, fixture, authority, and release leakage proof
  - Eighteen stable golden screenshots derived directly from canonical scenarios
  - Automated accessibility, responsive, forced-colors, reduced-motion, and performance release gates
affects: [03-32-final-evidence, web-release-gates, public-web, account-preview, admin-preview]

tech-stack:
  added: []
  patterns:
    - Canonical scenario-derived Playwright journeys and visual manifests
    - Browser-safe standalone contract validation under strict CSP
    - Independent Vitest and Playwright test discovery boundaries
    - Built-artifact isolation verification across dedicated origins

key-files:
  created:
    - tooling/web-evidence/tests/public.spec.ts
    - tooling/web-evidence/tests/documentation.spec.ts
    - tooling/web-evidence/tests/releases.spec.ts
    - tooling/web-evidence/tests/account.spec.ts
    - tooling/web-evidence/tests/admin.spec.ts
    - tooling/web-evidence/tests/accessibility-responsive.spec.ts
    - tooling/web-evidence/tests/security-artifacts.spec.ts
    - tooling/web-evidence/visual-manifest.json
    - tooling/web-evidence/vitest.config.ts
  modified:
    - tooling/web-evidence/playwright.config.ts
    - packages/contracts-ts/src/web-validation.ts
    - apps/account/src/account-preview-model.ts
    - apps/admin/src/admin-preview-model.ts
    - apps/admin/next.config.ts
    - apps/web/src/styles/public.css

key-decisions:
  - 'Keep Node-side schema compilation out of browser bundles and expose only generated standalone validators at strict-CSP client boundaries.'
  - 'Own account and admin route metadata in server-safe models so page metadata and client experiences share one canonical route projection.'
  - 'Bind every Playwright server to its real .localhost hostname and inject the dedicated admin origin at build time so origin assertions are exact.'
  - 'Derive all eighteen golden records from W01-W18 and isolate Vitest discovery to src/**/*.test.ts so Playwright suites remain runner-owned.'

patterns-established:
  - 'Evidence-axis pattern: each canonical scenario runs one primary axis while non-primary matrix combinations are explicitly skipped and reported.'
  - 'Artifact isolation pattern: build and start each app independently, then verify headers, origins, indexes, authority, fixtures, and development releases from emitted artifacts.'
  - 'Golden contract pattern: every W01-W18 manifest entry hashes its canonical source and resolves to a stable checked-in PNG.'

requirements-completed: [WEB-01, WEB-02, WEB-03, WEB-08]

duration: 1h 49m
completed: 2026-07-31
status: complete
---

# Phase 3 Plan 30: Complete Web Release Evidence Summary

**Canonical W01-W18 journeys now enforce built-artifact isolation, strict accessibility and responsive behavior, performance budgets, and eighteen stable visual goldens across the public, account, and admin apps**

## Performance

- **Duration:** 1h 49m
- **Started:** 2026-07-31T11:20:14Z
- **Completed:** 2026-07-31T13:08:15Z
- **Tasks:** 3
- **Files modified:** 55

## Accomplishments

- Proved every W01-W09 public, documentation, search, release, blocked-download, history, locale, and distinct error journey with deterministic Playwright coverage and no dead destinations.
- Proved every W10-W17 account/admin responsibility, state, confirmation, receipt, consent, audit, mobile, and no-change boundary while scanning independently built artifacts for cross-origin, fixture, authority, index, and release leakage.
- Derived a canonical W01-W18 visual manifest and checked in eighteen stable goldens covering the required 1440/1280/960/768/390/320 layouts.
- Enforced axe serious/critical, landmarks, keyboard focus, 24px targets, reflow, 200% text, reduced motion, forced colors, Core Web Vitals, route/image budgets, and golden comparisons.
- Passed the complete `pnpm web:verify` gate, including strict TypeScript, all unit suites, runner-separated evidence tests, and production builds for all three apps.

## Task Commits

Each task was committed atomically:

1. **Task 1: Prove public, documentation, and release journeys W01-W09** - `a2f5e75` (test)
2. **Task 2: Prove account/admin previews W10-W17 and security artifacts** - `f091ec4` (test)
3. **Task 3: Prove W18 accessibility, responsive, visual, and performance gates** - `e662a5e` (test)
4. **Overall gate fixes: Restore complete web verification** - `f98bfe5` (fix)

## Files Created/Modified

- `tooling/web-evidence/tests/public.spec.ts`, `documentation.spec.ts`, and `releases.spec.ts` - W01-W09 route, content, locale, recovery, error, and release-integrity journeys.
- `tooling/web-evidence/tests/account.spec.ts` and `admin.spec.ts` - W10-W17 responsibility, role, state, workflow, consent, audit, viewport, and receipt proof.
- `tooling/web-evidence/tests/security-artifacts.spec.ts` - Independent build/origin/header/cookie/index/fixture/authority/release leakage scans.
- `tooling/web-evidence/tests/accessibility-responsive.spec.ts` - Accessibility, reflow, text scale, forced colors, reduced motion, responsive, performance, and screenshot gates.
- `tooling/web-evidence/visual-manifest.json` - Canonical W01-W18 golden evidence records and source hashes.
- `tooling/web-evidence/tests/__screenshots__/accessibility-responsive.spec.ts/` - Eighteen checked-in canonical PNG goldens.
- `tooling/web-evidence/playwright.config.ts` - Dedicated `.localhost` servers, scenario axes, and stable evidence runtime configuration.
- `tooling/web-evidence/vitest.config.ts` - Unit-only Vitest discovery boundary.
- `packages/contracts-ts/src/web-validation.ts` and generated standalone validators - Strict-CSP browser validation without Node runtime compilation.
- `apps/account/src/account-preview-model.ts` and `apps/admin/src/admin-preview-model.ts` - Server-safe canonical route and metadata projections.
- `apps/admin/next.config.ts` and `apps/admin/src/admin-runtime.ts` - Dedicated admin-origin build binding and validation.
- Public, account, and admin shell styles - Contrast and forced-colors accessibility corrections discovered by the release gates.

## Decisions Made

- Browser clients consume generated standalone validators; Node-only validator compilation remains outside the client dependency graph.
- Account/admin pages and client experiences share server-safe route models rather than importing client components into metadata execution.
- Artifact evidence uses the apps' exact `.localhost` origins instead of wildcard bind addresses, making origin and CSP assertions deterministic.
- Golden screenshot records are projections of canonical W01-W18 scenarios, not a second manually maintained scenario authority.
- Vitest owns `src/**/*.test.ts`; Playwright exclusively owns `tests/**/*.spec.ts`.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] Kept Node validators out of the public browser bundle**

- **Found during:** Task 1 public journey execution
- **Issue:** Importing the aggregate web-features entry pulled Node-side validators into the browser bundle.
- **Fix:** Switched the browser component import to the browser-safe `@liiiraa/web-features/components` export.
- **Files modified:** `apps/web/src/features/home-web-components.tsx`
- **Verification:** Public Playwright suites and the production web build pass.
- **Committed in:** `a2f5e75`

**2. [Rule 2 - Missing Critical] Added strict-CSP browser contract validation**

- **Found during:** Task 2 account/admin artifact execution
- **Issue:** Browser previews needed runtime contract validation, but dynamic schema compilation would violate strict CSP and the client/server boundary.
- **Fix:** Generated and exported browser-safe standalone validators and routed web document admission through them.
- **Files modified:** `packages/contracts-ts/scripts/generate-standalone.mjs`, generated validator artifacts, `packages/contracts-ts/src/web-validation.ts`, and web-core admission modules.
- **Verification:** Contract tests, account/admin suites, artifact scans, typechecks, and production builds pass.
- **Committed in:** `f091ec4`

**3. [Rule 1 - Bug] Corrected generated Ajv runtime-helper interop**

- **Found during:** Task 2 strict-CSP validation execution
- **Issue:** Generated ESM validators referenced Ajv CommonJS runtime helpers with an incompatible default shape.
- **Fix:** Normalized helper interop during standalone generation while preserving generated validator behavior.
- **Files modified:** `packages/contracts-ts/scripts/generate-standalone.mjs`, `packages/contracts-ts/src/generated/standalone-validators.js`
- **Verification:** Generated validation, CSP, typecheck, and browser artifact suites pass.
- **Committed in:** `f091ec4`

**4. [Rule 3 - Blocking] Made preview route and origin evidence server-safe and exact**

- **Found during:** Task 2 independent account/admin build and origin checks
- **Issue:** Server metadata depended on client modules, the admin origin was not build-bound, and wildcard server binds made strict origin checks observe `0.0.0.0`.
- **Fix:** Extracted account/admin route models, injected and validated the dedicated admin origin, and bound Playwright servers to their actual `.localhost` hostnames.
- **Files modified:** Account/admin preview models and pages, `apps/admin/next.config.ts`, `apps/admin/src/admin-runtime.ts`, and `tooling/web-evidence/playwright.config.ts`
- **Verification:** Account/admin/security-artifact Playwright suites and all production builds pass independently.
- **Committed in:** `f091ec4`

**5. [Rule 1/2 - Accessibility] Restored contrast and forced-colors semantics**

- **Found during:** Task 3 axe, contrast, and forced-colors gates
- **Issue:** Phase 2 token overrides reduced primary CTA contrast, while skip links and the admin brand mark lacked system-color treatment in forced-colors mode.
- **Fix:** Corrected CTA tokens and added forced-colors system-color styles to affected controls and branding.
- **Files modified:** Public, account, and admin shell styles.
- **Verification:** All 32 focused accessibility/visual/performance tests pass with 256 explicit axis skips; all eighteen goldens compare without update mode.
- **Committed in:** `e662a5e`

**6. [Rule 1/3 - Release Gate] Separated test runners and followed extracted admin model ownership**

- **Found during:** Overall `pnpm web:verify`
- **Issue:** Vitest collected Playwright specifications, and an admin unit test still searched the client component source after role-route ownership moved to the server-safe model.
- **Fix:** Limited Vitest to `src/**/*.test.ts` and asserted the exported canonical admin route model directly.
- **Files modified:** `tooling/web-evidence/vitest.config.ts`, `apps/admin/src/features/admin-preview.test.tsx`
- **Verification:** Web-evidence unit tests pass (41 passed, 1 skipped), admin tests pass (21 passed), and the complete `pnpm web:verify` gate passes.
- **Committed in:** `f98bfe5`

---

**Total deviations:** 6 auto-fixed (2 blocking, 2 bugs, 1 missing critical function, 1 combined accessibility correction, and 1 combined release-gate correction).
**Impact on plan:** Every deviation was required for deterministic browser execution, strict security boundaries, accessible rendering, or the complete release gate; no product authority or speculative feature was added.

## Issues Encountered

- The full release gate initially exposed runner overlap and a stale source-text assertion only after all focused Playwright suites were green. Both were corrected at their ownership boundaries and the complete gate was rerun successfully.
- Context7 tooling was unavailable on this host; no version-specific library API change was needed beyond the pinned repository implementation, and behavior was verified through the real test/build toolchain.

## Known Stubs

None. Stub-pattern matches are intentional UI affordances or fail-closed product states (route-template placeholders, empty filter options, search placeholder copy, unavailable public downloads, and generated schema initialization), not unwired data or incomplete journeys.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness

- Plan 03-32 can promote WEB-01, WEB-02, WEB-03, and WEB-08 using deterministic W01-W18 journey, artifact, accessibility, performance, and visual evidence.
- The three built apps now have release-blocking isolation proof and stable canonical goldens.
- No blockers remain.

## Self-Check: PASSED

- All seven Playwright suites, the visual manifest, Vitest boundary, and summary exist on disk.
- All eighteen canonical PNG goldens exist under the configured snapshot path.
- Commits `a2f5e75`, `f091ec4`, `e662a5e`, and `f98bfe5` resolve in repository history.
- The complete `pnpm web:verify` gate passed after the final release-gate corrections.

---

_Phase: 03-complete-web-experience_
_Completed: 2026-07-31_
