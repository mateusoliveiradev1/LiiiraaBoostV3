---
phase: 03-complete-web-experience
plan: "56"
subsystem: ui
tags: [nextjs, react, accessibility, responsive-design, documentation, release-integrity]

requires:
  - phase: 03-complete-web-experience
    provides: Cobalt token authority, accessible public primitives, and the real-product hero from Plans 03-53 through 03-55
provides:
  - Five authored Home movements spanning Prepare, Prove, Restore, compatibility, and release authority
  - Semantic compatibility and plan decision ledgers with invoked provenance and commercial detail
  - Task-led documentation flow with historical guidance and progressively disclosed technical context
  - Integrity-led release narrative that preserves the complete fail-closed download gate
affects: [03-61, public-web, documentation, releases, compatibility, visual-evidence]

tech-stack:
  added: []
  patterns:
    - Real product artifacts reused as contextual proof rather than replaced with decorative diagrams
    - Human outcome first with bounded provenance, version, and manifest detail behind native disclosure
    - Semantic rows and reading-order movements that reflow without card-wall conversion

key-files:
  created:
    - apps/web/src/documentation.test.tsx
    - apps/web/src/public-product-lockup.tsx
  modified:
    - apps/web/package.json
    - apps/web/src/app/[locale]/layout.tsx
    - apps/web/src/features/home.tsx
    - apps/web/src/features/public-catalog.tsx
    - apps/web/src/features/documentation.tsx
    - apps/web/src/features/releases.tsx
    - apps/web/src/styles/public.css
    - apps/web/src/home.test.tsx
    - apps/web/src/public-catalog.test.tsx
    - apps/web/src/releases.test.tsx
    - pnpm-lock.yaml

key-decisions:
  - "Reuse the checksum-admitted desktop capture as the contextual evidence focal point so the product itself carries attention without invented telemetry or illustration."
  - "Keep version, ownership, validation, commercial, and manifest detail complete but subordinate it to human outcomes through native disclosures."
  - "Lead release and integrity routes with the canonical blocked decision, safe next actions, and recovery guidance while keeping machine evidence complete inside closed native disclosures."

patterns-established:
  - "Public long-form rhythm uses stage, connected band, evidence field, decision workspace, and boundary ribbon instead of repeated cards."
  - "Documentation section kind is an executable reading-order contract from purpose through technical detail."

requirements-completed: [WEB-01, WEB-02, WEB-03]

duration: 16min
completed: 2026-08-01
status: complete
---

# Phase 03 Plan 56: Authored Public Long-Form Experience Summary

**Cobalt long-form Home, catalog, documentation, and release journeys led by real product evidence, semantic decisions, and an unchanged fail-closed distribution boundary**

## Performance

- **Duration:** 39 min total (16 min initial execution + 13 min inspection correction + 3 min evidence-test correction + 7 min architecture correction)
- **Started:** 2026-08-01T17:26:19Z
- **Completed:** 2026-08-01T17:41:58Z
- **Tasks:** 2
- **Files modified:** 16

## Accomplishments

- Composed Home as five distinct movements: cinematic ignition, connected Prepare/Prove/Restore band, real-artifact evidence stage, compatibility decision field, and quiet release boundary.
- Replaced catalog documentary metadata and equal section grids with progressive provenance, semantic compatibility rows, asymmetric story bands, and complete invoked commercial terms.
- Made documentation purpose- and task-led while retaining exact version resolution, historical warnings, evidence, compatibility, recovery, identifiers, and bilingual parity.
- Reordered releases around state, compatibility, integrity, risk, corrections, and recovery without introducing any artifact link or bypass around the canonical download decision.
- Verified all four public route families at 1440, 960, 390, and 320 CSS pixels with no horizontal page overflow.

## Task Commits

Each TDD gate was committed atomically:

1. **Task 1 RED: public movement and catalog decision contracts** - `9704c47` (test)
2. **Task 1 GREEN: authored Home and public catalog movements** - `c849bc0` (feat)
3. **Task 2 RED: documentation and release rhythm contracts** - `091a01d` (test)
4. **Task 2 GREEN: task-led documentation and integrity-led releases** - `3565d67` (feat)
5. **03-63 correction RED: public release inspection regressions** - `473aa9b` (test)
6. **03-63 correction RED: manifest framing disclosure boundary** - `2b9b935` (test)
7. **03-63 correction GREEN: human release decision hierarchy** - `dc650b8` (fix)
8. **03-61 evidence correction: scoped W07 terminal action assertion** - `29b3013` (test)
9. **03-66 architecture correction: public ProductLockup boundary** - `8fda0a4` (fix)

## Files Created/Modified

- `apps/web/src/features/home.tsx` - Five authored public movements with a real-product evidence focal point and compatibility-first actions.
- `apps/web/src/features/public-catalog.tsx` - Progressive provenance, semantic compatibility field, asymmetric content sequence, and invoked plan terms.
- `apps/web/src/features/documentation.tsx` - Explicit purpose-to-detail reading order, invoked technical context, and narrow index workspace.
- `apps/web/src/features/releases.tsx` - State-first header, invoked release metadata, semantic channel ledger, and ordered release movements.
- `apps/web/src/styles/public.css` - Cobalt tonal rhythm, 40px support-route headings, semantic rows, mobile reflow, forced-color structure, and zero card-wall layouts.
- `apps/web/src/content/public/policies.pt-BR.json` - Visitor-facing PT-BR status language without internal phase identifiers.
- `apps/web/src/content/public/policies.en.json` - English parity for visitor-facing account-preview status language.
- `apps/web/src/home.test.tsx` - Home movement order, next-chapter hint, contextual evidence, and visitor-copy gates.
- `apps/web/src/public-catalog.test.tsx` - Compatibility and plan composition, bilingual consequence, and 320px reflow gates.
- `apps/web/src/documentation.test.tsx` - Documentation hierarchy, historical guidance, invoked metadata, and narrow-layout gates.
- `apps/web/src/releases.test.tsx` - Release hierarchy, progressive metadata, responsive integrity, and no-bypass gates.
- `tooling/web-evidence/tests/releases.spec.ts` - Semantic W07 terminal-gate action ownership without positional selectors.
- `apps/web/src/app/[locale]/layout.tsx` - Server-owned public shell consuming an app-local ProductLockup boundary instead of a private package path.
- `apps/web/src/public-product-lockup.tsx` - Narrow client bridge to the canonical `@liiiraa/design-system` export.
- `apps/web/package.json` and `pnpm-lock.yaml` - Explicit local workspace dependency for the public design-system API.

## Decisions Made

- Reused the admitted real desktop artifact in the contextual proof movement. This keeps attention on truthful product evidence and avoids invented diagrams, screenshots, or performance claims.
- Kept ordinary headings and actions direct while moving validation state, ownership, release references, commercial boundaries, and manifest detail into native disclosures.
- Made the download decision renderer first and authoritative on download and integrity routes. Narrative reordering never grants distribution authority or exposes an installer path.
- Kept manifest fields, provenance, raw decision reasons, and contract identifiers complete but available only through localized closed native disclosures.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Test Bug] Narrowed an over-broad download-link assertion**

- **Found during:** Task 2 GREEN verification
- **Issue:** The RED source regex matched the legitimate canonical release-navigation route because its path contains `download`, even though it was not an artifact link or HTML download action.
- **Fix:** Restricted the assertion to actual download attributes while retaining rendered-markup checks for artifact URLs and download links.
- **Files modified:** `apps/web/src/releases.test.tsx`
- **Verification:** All 20 documentation/release tests and the complete 79-test public suite pass.
- **Committed in:** `3565d67`

**2. [Rule 1 - Visual Bug] Corrected support-route heading scale**

- **Found during:** Task 2 browser validation at 1440, 960, 390, and 320 widths
- **Issue:** Documentation and catalog headings inherited the 32px product scale instead of the approved 40px documentation/release page role.
- **Fix:** Bound support-route page headings directly to the canonical 40/46 document tokens.
- **Files modified:** `apps/web/src/styles/public.css`
- **Verification:** Browser measurement reports 40px support-route H1s with no horizontal overflow at every required width.
- **Committed in:** `3565d67`

**3. [Rule 3 - Blocking Issue] Preserved the server layout across the public package import**

- **Found during:** 03-66 architecture correction production build
- **Issue:** Importing the design-system root directly from the server layout caused Next.js to traverse client-only barrel exports using React state and React Aria.
- **Fix:** Kept the locale layout server-owned and contained the canonical package import in a narrow app-owned client bridge that renders the unchanged shared `ProductLockup`.
- **Files modified:** `apps/web/src/app/[locale]/layout.tsx`, `apps/web/src/public-product-lockup.tsx`, `apps/web/package.json`, `pnpm-lock.yaml`
- **Verification:** Focused shell and lockup tests, strict TypeScript, and the production Next.js build pass.
- **Committed in:** `8fda0a4`

---

**Total deviations:** 3 auto-fixed (2 Rule 1 bugs, 1 Rule 3 blocking issue)
**Impact on plan:** The corrections strengthened release, typography, and module-boundary gates without adding external dependencies, authority, claims, or product scope.

## Issues Encountered

- The existing development server was reused for read-only responsive inspection and left running unchanged.
- The complete public suite currently has one unrelated stale Home assertion: `home.test.tsx` expects literal `clamp(52px, 6vw, 76px)` while the unchanged Home CSS uses canonical `var(--lb-public-hero-display-size)`. The failure existed outside the W07/W08/W09 correction scope, so no Home file was edited; ownership was routed back to the Home plan.

## TDD Gate Compliance

- Task 1 RED `9704c47` failed on four planned public movement behaviors before GREEN `c849bc0` passed 23/23 targeted tests.
- Task 2 RED `091a01d` failed on six planned documentation/release behaviors before GREEN `3565d67` passed 20/20 targeted tests.
- Inspection correction RED `473aa9b` proved W07/W08 rendered machine evidence before the blocked decision and W09 exposed internal phase/enum language; GREEN `dc650b8` passes all 25 release/catalog tests.
- Supplemental RED `2b9b935` proved manifest framing still remained visible outside disclosure before GREEN moved it behind the technical boundary.
- Every RED commit precedes its corresponding GREEN implementation commit.

## Known Stubs

None. The public download-unavailable state is an intentional fail-closed authority boundary; the catalog search example is a functional input hint, not placeholder content.

## Verification

- `rtk pnpm --filter @liiiraa/web test` - 8 files, 79 tests passed.
- `rtk pnpm --filter @liiiraa/web check` - strict TypeScript passed.
- `rtk pnpm --filter @liiiraa/web build` - Next.js 16.2.12 production build passed.
- `rtk pnpm web:check` - 10/10 workspace checks passed.
- Impeccable detector on all changed public feature and style sources - zero findings.
- Headless Chromium at 1440, 960, 390, and 320 widths across Home, Product, Docs, and Releases - 16/16 views had no horizontal page overflow.

### 03-63 Inspection Correction

- `rtk pnpm --filter @liiiraa/web exec vitest run src/releases.test.tsx src/public-catalog.test.tsx` - 2 files, 25 tests passed.
- `rtk pnpm --filter @liiiraa/web check` - strict TypeScript passed.
- `rtk pnpm --filter @liiiraa/web build` - Next.js 16.2.12 production build passed.
- Impeccable detector on the corrected release, status, and public style sources - zero findings.
- Headless Chromium on W07, W08, and W09 at 1440 and 390 CSS pixels - 6/6 views had zero horizontal overflow.
- W07/W08 browser measurements confirmed the blocked decision precedes integrity content and both manifest/provenance disclosures are closed by default at both widths.
- W09 browser text inspection confirmed no visible `Fase 3` or `demonstrative-preview` at either width.
- Full public suite result: 80/81 passed; the sole failure is the unrelated stale Home literal-token assertion documented above.

### 03-61 Evidence-Test Correction

- Replaced the page-wide W07 compatibility-link uniqueness assertion with semantic scoping through the blocked alert and its named terminal action navigation.
- Confirmed both legitimate accessible `Verificar compatibilidade` links remain and the terminal actions preserve compatibility → releases → support order without `first()` or `nth()`.
- Focused Playwright W07/W08/W09 gate across the owning 1440 and 1280 projects - 3 passed, 3 expected axis skips, 0 failed.
- `rtk pnpm --filter @liiiraa/web-evidence check` - strict TypeScript passed.
- Release/status unit suite - 2 files, 25 tests passed.
- No screenshot, candidate inspection, or visual-manifest file changed.

### 03-66 Architecture Correction

- `rtk pnpm --filter @liiiraa/web exec vitest run src/public-shell.test.ts` - 1 file, 25 tests passed.
- `rtk pnpm --filter @liiiraa/design-system exec vitest run src/design-system.test.tsx -t "ProductLockup"` - exact ProductLockup render contract passed.
- `rtk pnpm --filter @liiiraa/web check` - strict TypeScript passed.
- `rtk pnpm --filter @liiiraa/web build` - Next.js 16.2.12 production build passed with the locale layout remaining a Server Component.
- `rtk pnpm test:architecture` - the public owner violation is closed; the aggregate gate narrowed from three private ProductLockup imports to the two independently owned account/admin imports.
- Prettier and `git diff --check` passed for the bounded source and manifest delta; no screenshots or visual evidence changed.

## Threat Review

- Product and catalog claims retain source, scope, version, validation state, and unproven-boundary evidence in bilingual native disclosures.
- Release metadata remains demonstrative and bounded; every approval, artifact, integrity, or historical disagreement still resolves through the canonical blocked decision with no bypass.
- No endpoint, authentication path, schema, dependency, third-party script, external asset, installer, or mutation authority was introduced.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness

- Plan 03-61 can verify exact browser accessibility, fold position, and screenshot dimensions against the authored movement hooks.
- Human visual approval remains pending and is not inferred from deterministic tests or overflow checks.

## Self-Check: PASSED

- Created file `apps/web/src/documentation.test.tsx` exists and is tracked.
- Task commits `9704c47`, `c849bc0`, `091a01d`, `3565d67`, `473aa9b`, `2b9b935`, `dc650b8`, `29b3013`, and `8fda0a4` exist in repository history.

---
*Phase: 03-complete-web-experience*
*Completed: 2026-08-01*
