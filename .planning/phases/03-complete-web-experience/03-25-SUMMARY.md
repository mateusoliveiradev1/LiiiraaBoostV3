---
phase: 03-complete-web-experience
plan: '25'
subsystem: web-ui
tags: [nextjs, react, releases, integrity, accessibility, fail-closed]

requires:
  - phase: 03-15
    provides: Canonical public release and download route records
  - phase: 03-18
    provides: Public shell, shared web components, and bilingual routing
  - phase: 03-24
    provides: Exhaustive fail-closed release decision engine
provides:
  - Bilingual release channel, notes, manifest, integrity, history, download, and install journeys
  - Canonical release and download routes with exhaustive localized blocking decisions
  - W07/W08 browser-verified fail-closed states without executable links
affects: [03-29, 03-32, public-release-evidence, distribution]

tech-stack:
  added: []
  patterns:
    - Server-owned release admission with a narrow client-safe shared-component boundary
    - Exhaustive DownloadDecision rendering with no bypass branch

key-files:
  created:
    - apps/web/src/features/releases.tsx
    - apps/web/src/features/release-ui.tsx
    - apps/web/src/app/[locale]/releases/[[...release]]/page.tsx
    - apps/web/src/app/[locale]/download/[channel]/[version]/page.tsx
    - apps/web/src/releases.test.tsx
  modified:
    - apps/web/src/content/releases/releases.metadata.json
    - packages/web-features/src/components.tsx
    - apps/web/src/styles/public.css

key-decisions:
  - 'Keep every Phase 3 release decision blocked until a generated record carries explicit public approval and an official artifact.'
  - 'Keep release admission and canonical route resolution on the server while exporting only localized presentational components through the client boundary.'
  - 'Treat demonstrative manifest values as explanatory evidence outside the official trust path, never as installer provenance.'

patterns-established:
  - 'Release trust boundary: admit bilingual records once, derive routes canonically, then exhaustively render every DownloadDecision.'
  - 'Distribution UI: compatibility and support remain reachable, but no artifact link or continue-anyway control exists while blocked.'

requirements-completed: [WEB-03]

duration: 1h12m
completed: 2026-07-31
status: complete
---

# Phase 03 Plan 25: Release Integrity and Download Gate Summary

**Bilingual release and integrity routes with exhaustive download blocking, independent verification guidance, and zero executable distribution links**

## Performance

- **Duration:** 1h12m
- **Started:** 2026-07-31T09:43:00Z
- **Completed:** 2026-07-31T10:54:35Z
- **Tasks:** 2
- **Files modified:** 16

## Accomplishments

- Authored PT-BR and English channel policy, release notes, manifest explanations, verification guidance, history, installation, and purpose-bound analytics content.
- Rendered canonical release index, channel, version, integrity, download, and install routes from generated release records and the fail-closed decision engine.
- Preserved `publicDistributionApproved: false`, `officialArtifact: unavailable`, and the absence of artifact evidence, URLs, Phase 2 filenames, hashes, paths, or certificate identities.
- Verified W07 and W08 in production output at desktop and 390 px forced-colors viewports with keyboard-first focus, zero axe violations, zero overflow, no browser errors, and no executable links.

## Task Commits

Each task was committed atomically:

1. **Task 1: Author bilingual release and verification records** - `bf3b6d4` (feat)
2. **Task 2: Compose release, integrity, and download-gate routes** - `94d1b73` (feat)

## Files Created/Modified

- `apps/web/src/content/releases/releases.pt-BR.json` - Complete Brazilian Portuguese release, integrity, history, and installation copy.
- `apps/web/src/content/releases/releases.en.json` - Structurally identical English release content.
- `apps/web/src/content/releases/releases.metadata.json` - Demonstrative fail-closed `ReleaseRecord`, manifest fields, integrity disagreements, and historical records.
- `apps/web/src/features/releases.tsx` - Record admission, canonical route resolution, page compositions, and exhaustive decision rendering.
- `apps/web/src/features/release-ui.tsx` - Client-safe localized shared component exports for release presentation.
- `apps/web/src/app/[locale]/releases/[[...release]]/page.tsx` - Canonical release catch-all route.
- `apps/web/src/app/[locale]/download/[channel]/[version]/page.tsx` - Canonical download eligibility route that remains blocked.
- `apps/web/src/releases.test.tsx` - Locale parity, route, decision, artifact absence, and render coverage.
- `apps/web/src/public-client-boundary.ts` - Audited client-safe route subset used by global recovery UI.
- `packages/web-features/src/components.tsx` - Localizable shared download gate and release primitives.
- `apps/web/src/styles/public.css` - Forced-colors navigation treatment for release review.

## Decisions Made

- Public availability remains unreachable under the current generated schema; the UI explains the acceptance path without inventing distribution authority.
- Stable is the default and requires no account, while Beta requires explicit opt-in and Experimental remains structurally separated by audience, risk, support, and update policy.
- Historical release data remains readable but cannot be used to promote downgrade, unsafe binaries, or stale artifacts.
- The release route loads only the narrow presentation chunk; generated Ajv validation stays server-side for this journey.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 2 - Missing Critical] Added the canonical download route omitted from the task file list**

- **Found during:** Task 2 (Compose release, integrity, and download-gate routes)
- **Issue:** The action and canonical route authority require `/[locale]/download/[channel]/[version]`, but the route file was not listed under task files.
- **Fix:** Added the route and resolved it through the same canonical release page contract as the release catch-all.
- **Files modified:** `apps/web/src/app/[locale]/download/[channel]/[version]/page.tsx`, `apps/web/src/features/releases.tsx`
- **Verification:** Production build emitted the route; both locales return 200 and contain no artifact link.
- **Committed in:** `94d1b73`

**2. [Rule 2 - Missing Critical] Added a localized, narrow shared-component client boundary**

- **Found during:** Task 2 (Compose release, integrity, and download-gate routes)
- **Issue:** Shared release primitives needed localized gate labels without moving server-side record admission or generated validators into interactive browser code.
- **Fix:** Added backwards-compatible gate props and re-exported only the required presentational components from a dedicated client boundary.
- **Files modified:** `apps/web/src/features/release-ui.tsx`, `packages/web-features/src/components.tsx`, `packages/web-features/package.json`
- **Verification:** Strict TypeScript, component tests, production build, and live network inspection pass; release routes load no Ajv script.
- **Committed in:** `94d1b73`

**3. [Rule 3 - Blocking] Removed the shared recovery-route validator leak from global error boundaries**

- **Found during:** Task 2 (Compose release, integrity, and download-gate routes)
- **Issue:** Global recovery components imported the complete canonical route module, which brought generated Ajv code into client recovery bundles and previously caused `require is not defined` during browser hydration.
- **Fix:** Added an audited client-safe route subset with exact locale and pathname builders, then switched public failure and not-found components to it.
- **Files modified:** `apps/web/src/public-client-boundary.ts`, `apps/web/src/features/public-failure.tsx`, `apps/web/src/public-not-found.ts`, `apps/web/src/app/[locale]/not-found.tsx`, `apps/web/src/public-shell.test.ts`
- **Verification:** Production browser checks report zero console/page errors and the release route network loads no Ajv chunk.
- **Committed in:** `94d1b73`

**4. [Rule 2 - Accessibility] Preserved release navigation contrast in forced-colors mode**

- **Found during:** Task 2 (Compose release, integrity, and download-gate routes)
- **Issue:** Release navigation needed an explicit system-color treatment to keep current-route state visible under Windows forced colors.
- **Fix:** Added forced-colors border, text, and focus-visible styling for the release navigation/action surface.
- **Files modified:** `apps/web/src/styles/public.css`
- **Verification:** W07 and W08 pass axe, keyboard-first focus, reflow, and visual inspection with forced colors active.
- **Committed in:** `94d1b73`

---

**Total deviations:** 4 auto-fixed (3 missing critical/blocking, 1 accessibility)
**Impact on plan:** All changes preserve the planned trust, route, browser-runtime, and accessibility boundaries without expanding distribution authority.

## Issues Encountered

- The prescribed `web:verify:quick` command passes all 30 workspace check/test tasks, then stops at the planned later-plan readiness boundary: `$.buildRoots.public`, `release-gate.json`, and `release-artifact.json` are not yet present. Plans 03-29 and 03-32 own those proofs; this plan did not fabricate them.
- Repository-wide architecture parity expectations and one fixture-guard timeout remain outside Plan 03-25 ownership and are recorded in `deferred-items.md`. Release-scoped type checks, 37 web tests, production build, artifact scans, link audit, and live accessibility checks pass.

## Known Stubs

None. The visible unavailable values and “not available” copy are intentional fail-closed release truth, not unwired placeholders.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness

- Plans 03-29 and 03-32 can attach approved capture/build/evidence records to the established release journey without changing its fail-closed semantics.
- A future distribution phase must evolve the generated contract and supply an approved public artifact before the available branch can become reachable.

## Self-Check: PASSED

- All five primary created files and the summary exist at their canonical paths.
- Task commits `bf3b6d4` and `94d1b73` resolve to full commit objects.
- Summary formatting and repository diff checks pass.

---

_Phase: 03-complete-web-experience_
_Completed: 2026-07-31_
