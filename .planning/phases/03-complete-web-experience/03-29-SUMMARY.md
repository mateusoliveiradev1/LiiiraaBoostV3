---
phase: 03-complete-web-experience
plan: '29'
subsystem: testing
tags: [playwright, chromium, webp, sha256, provenance, localization, nextjs]

requires:
  - phase: 02-complete-desktop-experience
    provides: Executable desktop Home, deterministic S01 composition, shipping locales, and production Vite lifecycle
  - phase: 03-complete-web-experience
    provides: Home product evidence gate, generated ScreenshotProvenance, content admission, and W01/W02 contracts
provides:
  - Deterministic production desktop capture and read-only verification CLI
  - Exact PT-BR and English 1440x900 WebP Home captures with generated sidecars
  - SHA-256 image, source-input, build, environment, and invalidation provenance
  - Home and content-admission binding for the approved real product assets
affects: [03-32-final-evidence, public-home, content-publication, desktop-localization]

tech-stack:
  added: ['@types/node@24.13.3 package-local typing (existing locked identity)']
  patterns:
    [
      production-built executable capture,
      generated sidecar plus extended manifest,
      read-only provenance verification,
    ]

key-files:
  created:
    - tooling/web-evidence/src/capture-desktop.ts
    - tooling/web-evidence/src/capture-desktop.test.ts
    - tooling/web-evidence/src/capture-desktop.cli.test.ts
    - tooling/web-evidence/run-desktop-capture.mjs
    - apps/web/public/product/desktop-home.pt-BR.webp
    - apps/web/public/product/desktop-home.pt-BR.json
    - apps/web/public/product/desktop-home.en.webp
    - apps/web/public/product/desktop-home.en.json
  modified:
    - tooling/web-evidence/capture-manifest.json
    - apps/web/src/features/home.tsx
    - packages/web-core/src/content-admission.ts
    - apps/desktop/src/features/premium-localization.ts

key-decisions:
  - 'Keep generated ScreenshotProvenance sidecars exact and place build, browser, OS, fonts, review, dimensions, and source invalidation evidence in the capture manifest.'
  - 'Capture the production-built desktop UI only from the fixed loopback executable preview with Chromium, frozen S01 state, disabled animation, and full-frame 1440x900 output.'
  - 'Hash every desktop source, locale, style, font, scenario, package, and lock input so relevant product changes invalidate published captures.'

patterns-established:
  - 'Capture/check split: --capture may write only allowlisted product artifacts; --check performs the same validation without regeneration.'
  - 'Real product media is admitted only when generated sidecar schema, image dimensions, source hashes, SHA-256, locale, scenario, viewport, review, and paths agree.'

requirements-completed: [WEB-01, WEB-02]

duration: 18min
completed: 2026-07-31
status: complete
---

# Phase 3 Plan 29: Deterministic Desktop Product Capture Summary

**Production-built S01 desktop Home captured as exact PT-BR and English WebP assets with SHA-256 sidecars, complete source invalidation provenance, and fail-closed Home admission**

## Performance

- **Duration:** 18 min
- **Started:** 2026-07-31T10:58:37Z
- **Completed:** 2026-07-31T11:16:12Z
- **Tasks:** 2
- **Files modified:** 19

## Accomplishments

- Built a deterministic capture tool that launches only the production-built desktop preview on fixed loopback, freezes S01 time/randomness/animations/fonts, emits Chromium WebP, and validates exact generated ScreenshotProvenance.
- Published visually inspected 1440x900 full-frame assets: PT-BR SHA-256 `a42df9e349cf80668a1c747f7978fe8f532e870d97628918338d5ce5c2b428c7` and English SHA-256 `8e6953d73439019c1f7833bb2a3583d7020bdc858ffe699a67ac38c2a6845127`.
- Bound both captures to Home screenshot/social content records and verified Home admission, content admission, read-only capture checking, strict TypeScript, and the production Next.js build.

## Task Commits

Each task was committed atomically:

1. **Task 1 RED: Define desktop capture provenance behavior** - `5d51b71` (test)
2. **Task 1 GREEN: Build deterministic capture/provenance tool** - `de38b8e` (feat)
3. **Task 2 correctness deviation: Complete English dynamic value localization** - `3c7ebc4` (fix)
4. **Task 2: Capture and bind approved Home assets** - `f49e3bb` (feat)

## Files Created/Modified

- `tooling/web-evidence/src/capture-desktop.ts` - Executable-only capture, WebP parsing, generated sidecar validation, hashing, invalidation, and check/capture behavior.
- `tooling/web-evidence/src/capture-desktop.test.ts` - Positive provenance fixture plus mockup, path, scenario, viewport, crop, tamper, sidecar, and stale-source rejection.
- `tooling/web-evidence/run-desktop-capture.mjs` - CLI flag bridge through the pinned Vitest/Vite TypeScript transform.
- `tooling/web-evidence/capture-manifest.json` - Canonical build, environment, review, capture, and complete source-input hash authority.
- `apps/web/public/product/desktop-home.pt-BR.webp` and `.json` - Approved PT-BR image and exact generated provenance.
- `apps/web/public/product/desktop-home.en.webp` and `.json` - Approved English image and exact generated provenance.
- `apps/web/src/features/home.tsx` - Admits the canonical web-evidence capture command and matching sidecar.
- `packages/web-core/src/content-admission.ts` - Narrowly admits repository-owned `/product/*.webp` alongside existing `/media` assets.
- `apps/desktop/src/features/premium-localization.ts` - Completes English translation of dynamic Home profile values exposed by real capture inspection.

## Decisions Made

- Generated sidecars remain the exact language-neutral ScreenshotProvenance contract; extended evidence is not duplicated into the sidecar and lives in the manifest.
- The approved public assets are full-frame 1440x900 captures. No crop, text modification, value replacement, or composited framing is applied.
- The production Vite desktop build served on `127.0.0.1:4173` is the only capture source; files, visual probes, generated images, mockups, source-tree pages, and arbitrary URLs fail closed.
- Capture source commit `3c7ebc4e...` is bound to the corrected bilingual executable, and all relevant desktop inputs carry SHA-256 invalidation hashes.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] Routed the CLI through the pinned workspace TypeScript transform**

- **Found during:** Task 2 real capture execution
- **Issue:** Raw Node stripping could not resolve the monorepo's intentional `.js`-to-TypeScript workspace aliases, so capture stopped before Chromium launch.
- **Fix:** Added a small Node flag bridge and focused Vitest CLI entry using the already pinned Vitest/Vite transform; no new runtime package was installed.
- **Files modified:** `tooling/web-evidence/run-desktop-capture.mjs`, `tooling/web-evidence/src/capture-desktop.cli.test.ts`, `tooling/web-evidence/package.json`
- **Verification:** Exact `verify -- --capture-manifest ... --capture` and `--check` commands both pass.
- **Committed in:** `f49e3bb`

**2. [Rule 1 - Bug] Completed English localization revealed by the real capture**

- **Found during:** Task 2 visual inspection
- **Issue:** The first English executable capture still showed `Aguardando medição` and `Competitivo` in the selected-game panel.
- **Fix:** Added exact translations and a focused desktop regression test, committed the source, then regenerated the English asset so provenance points at the corrected commit.
- **Files modified:** `apps/desktop/src/features/premium-localization.ts`, `apps/desktop/src/features/premium-localization.test.ts`
- **Verification:** Desktop localization test and strict typecheck pass; the regenerated English WebP was visually inspected and contains `Awaiting measurement` and `Competitive`.
- **Committed in:** `3c7ebc4`

**3. [Rule 2 - Missing Critical] Completed real asset admission and Home binding**

- **Found during:** Task 2 Home/content verification
- **Issue:** The fail-closed Home command gate did not recognize the canonical web-evidence command, and content admission allowed `/media` but not the plan-owned `/product` asset path.
- **Fix:** Admitted the exact capture command family and narrowly added `/product/*.webp`; tests now load both real sidecars as screenshot/social records.
- **Files modified:** `apps/web/src/features/home.tsx`, `apps/web/src/home.test.tsx`, `apps/web/src/home-content.test.ts`, `packages/web-core/src/content-admission.ts`
- **Verification:** 37 Home tests, 97 web-core tests, web workspace typechecks, and the production Next build pass.
- **Committed in:** `f49e3bb`

---

**Total deviations:** 3 auto-fixed (1 bug, 1 missing critical functionality, 1 blocking issue).
**Impact on plan:** Each fix was necessary to produce truthful bilingual executable evidence and make the planned asset path consumable; no speculative feature or authority was added.

## Issues Encountered

- Context7 documentation tooling and its Bash fallback were unavailable on this Windows host, so implementation used the pinned Playwright 1.62 type surface and verified Chromium CDP WebP behavior directly through the real capture run.
- The initial English capture exposed a pre-existing dynamic localization gap; it was corrected and the image was recaptured rather than accepted or edited.

## Known Stubs

None. Capture placeholders in the initial manifest were replaced by real image, environment, source, and checksum evidence before completion.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness

- Plan 03-32 can promote WEB-01/WEB-02 evidence using exact capture hashes and the read-only manifest gate.
- Any relevant desktop source, font, locale, scenario, package, or lockfile change now invalidates the capture until an explicit production recapture.
- No blockers remain.

## Self-Check: PASSED

- All capture tool, manifest, PT-BR/English WebP, sidecar, and summary artifacts exist on disk.
- Commits `5d51b71`, `de38b8e`, `3c7ebc4`, and `f49e3bb` resolve in repository history.
- Final `--check` verification passed without changing manifest, image, or sidecar hashes.

---

_Phase: 03-complete-web-experience_
_Completed: 2026-07-31_
