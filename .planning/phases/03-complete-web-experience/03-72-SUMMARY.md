---
phase: 03-complete-web-experience
plan: "72"
subsystem: web-final-experience
tags: [nextjs, playwright, responsive, accessibility, i18n, visual-evidence, download]

requires:
  - phase: 03-68
    provides: Final public acquisition and commercial experience
  - phase: 03-69
    provides: Final documentation, distribution, and service experience
  - phase: 03-70
    provides: Final authentication, onboarding, and account experience
  - phase: 03-71
    provides: Final isolated administration experience
provides:
  - Complete browser-observed public, account, and admin route/state/locale/breakpoint contract
  - Restored localized direct download destination with truthful unavailable-distribution behavior
  - Hash-bound original-resolution inspection for all 25 W01-W18 and G01-G07 candidates
  - Current 24-outcome route-reachability evidence and renewed human-review index
affects: [03-45-human-review, 03-46-publication, phase-04-auth-control-plane]

tech-stack:
  added: []
  patterns:
    - Canonical route matrices are generated from owned route definitions and replayed across surface-specific browser axes
    - Direct download acquisition and technical release detail remain separate but mutually reachable visitor journeys
    - Visual candidates remain hash-bound and explicitly unapproved until a literal human approval is recorded

key-files:
  created:
    - apps/web/src/app/[locale]/download/page.tsx
    - tooling/web-evidence/tests/final-route-experience.spec.ts
    - .planning/phases/03-complete-web-experience/visuals/candidate-inspections/03-72-route-matrix.json
  modified:
    - apps/web/src/features/home.tsx
    - apps/web/src/features/public-catalog.tsx
    - apps/web/src/features/releases.tsx
    - apps/web/src/styles/home.css
    - apps/web/src/styles/public.css
    - apps/account/src/app/account-shell.css
    - apps/admin/src/admin-navigation.tsx
    - tooling/web-evidence/tests/accessibility-responsive.spec.ts
    - quality/evidence/phase-03/web/route-reachability.json
    - tooling/web-evidence/visual-manifest.json

key-decisions:
  - "Keep /download as the acquisition destination and /download/[channel]/[version] as the detailed distribution-integrity destination."
  - "Treat final visual inspection as bounded non-human preflight only; humanApproved and publicationApproved remain false."
  - "Update legacy browser assertions to customer-facing copy and destinations instead of restoring obsolete internal language."
  - "Leave Phase 3 executing until Plan 03-45 receives explicit human approval; never execute Plan 03-46 from this plan."

patterns-established:
  - "Final route contract: every canonical family proves locale, navigation, favicon, icon semantics, copy, authority, accessibility, and horizontal containment."
  - "Evidence renewal: stale source hashes require a complete writer-owned route replay, never manual hash editing."

requirements-completed: [WEB-01, WEB-02, WEB-03, WEB-08]

duration: 1h48
completed: 2026-08-03
status: complete
---

# Phase 03 Plan 72: Complete Final Web Experience Summary

**The complete public, authentication, account, and administration experience is now browser-observed as one coherent localized product, with direct download routing restored and every candidate prepared—but not approved—for human review.**

## Performance

- **Duration:** 1h48
- **Completed:** 2026-08-03
- **Tasks:** 3
- **Files modified:** 59 including 25 renewed visual candidates and planning evidence

## Accomplishments

- Added the missing localized `/pt-BR/download` and `/en/download` acquisition route, connected it to the public navigation, plans, releases, and compatibility journey, and kept executable distribution truthfully unavailable until signed release authority exists.
- Consolidated public Home, commercial/catalog, release, account, and admin finishing work into a complete Playwright route matrix covering every canonical destination, both locales, 1440/960/390/320 layouts, representative degraded states, reduced motion, forced colors, focus, CSP, and origin boundaries.
- Recaptured and inspected all 25 W01-W18/G01-G07 candidates at original resolution, recording route, locale, viewport, state, dimensions, bytes, SHA-256, register, and verdict with `humanApproved: false` and `publicationApproved: false`.
- Regenerated all 24 localized public/account/admin error-route observations through the allowlisted evidence writer and aligned the Phase 3 verifier with the current 101 decisions and 57 canonical routes.
- Updated legacy browser tests to assert the final customer-facing documentation, status, download, plans, and security experience rather than obsolete internal copy or destinations.

## Task Commit

Tasks 1–3 are delivered together in the final atomic Plan 03-72 commit so implementation, browser contracts, candidate pixels, hashes, and planning handoff cannot drift independently.

## Decisions Made

- The direct `/download` page sells and explains the Windows product while the versioned download route remains the technical release/integrity surface.
- The Free/Premium commercial story, compatibility journey, and update lifecycle are final visual/copy contracts only; no real billing, authentication, device authority, or artifact distribution was introduced.
- Browser evidence may prove completeness and stability, but only Plan 03-45 can convert the exact current candidate set into a human approval.
- Plans 03-45 and 03-46 remain untouched; publication stays fail-closed.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 2 - Missing Critical] Restored the direct localized download destination**

- **Found during:** Task 1 canonical route replay
- **Issue:** Public navigation linked to `/download`, but only `/download/[channel]/[version]` existed, leaving the acquisition CTA broken.
- **Fix:** Added a localized SSG page with product value, Windows readiness, compatibility, trust, and safe release-status actions while preserving the distribution gate.
- **Verification:** Both `/pt-BR/download` and `/en/download` appear in the production route manifest and pass the complete route matrix.

**2. [Rule 1 - Bug] Replaced stale customer-copy browser assertions**

- **Found during:** Full Playwright regression
- **Issue:** Twelve legacy public tests still expected internal documentation labels, outdated CTA names, earlier search copy, and an obsolete sign-in path even though the final UI was correct.
- **Fix:** Bound assertions to the current accessible names, contextual status actions, route-preserving locale control, and plain-language download gate.
- **Verification:** The complete 937-case Playwright matrix closed with 272 applicable passes, 665 expected axis skips, and zero failures.

**3. [Rule 1 - Bug] Brought the canonical Phase 3 verifier forward to the final route/decision set**

- **Found during:** Workspace regression
- **Issue:** The verifier was frozen at 86 decisions and 54 routes and only parsed two-digit decision identifiers.
- **Fix:** Updated it to 101 decisions, 57 routes, the public results/download and account onboarding owners, and three-digit decision parsing.
- **Verification:** Planned-mode verification passed with 101 decisions, 57 routes, 24 observed route outcomes, and 18 scenarios.

**4. [Rule 3 - Blocking Evidence] Renewed stale reachability provenance through the canonical writer**

- **Found during:** W17 public error replay
- **Issue:** The existing evidence correctly rejected changed Playwright source hashes.
- **Fix:** Rebuilt all surface slices using the allowlisted writer command; no hash was edited by hand.
- **Verification:** Evidence status is `passed` with 24 complete localized observations and current canonical/spec source hashes.

**5. [Completion Audit - Contract Drift] Aligned the hero's DOM geometry contract with the browser-observed limit**

- **Found during:** Post-commit requirement-by-requirement completion audit
- **Issue:** The final browser gate correctly allowed the centered product stage at up to 640px from the viewport top, but the source still advertised the superseded `data-stage-max-top="560"` value.
- **Fix:** Updated the authored DOM contract and its unit assertion to 640px without changing layout or candidate pixels.
- **Verification:** Web 108/108, the web/admin production builds, and the complete final route matrix (18 applicable passes) all passed again.

---

**Total deviations:** 5 auto-fixed (2 bugs, 1 missing critical, 1 blocking evidence renewal, 1 completion-audit contract drift)
**Impact on plan:** Every change was required to make the declared final experience reachable, testable, and reviewable; no Phase 4 authority or production publication capability was added.

## Issues Encountered

- The first complete Playwright run exposed 12 failures, all in legacy public expectations. After customer-facing assertion updates and writer-owned reachability renewal, the same full matrix passed without changing the final UI back to obsolete copy.
- Next.js prints a warning that `next start` is not the preferred launcher for standalone output, but all isolated production builds and the actual browser test servers started and completed successfully.

## Verification

- `rtk pnpm --filter @liiiraa/web-evidence exec playwright test tests/final-route-experience.spec.ts` — 18 passed, 144 expected skips.
- `rtk pnpm --filter @liiiraa/web-evidence exec playwright test` — 272 passed, 665 expected skips, zero failed.
- Canonical route-reachability writer — 24/24 localized error outcomes, `status: passed`.
- `rtk pnpm test` — 49/49 Turbo tasks passed; web 108, account 59, admin 60, web-core 110, web-evidence 142 with one intentional CLI skip.
- `rtk pnpm web:verify:phase -- --mode planned` — 101 decisions, 57 routes, 24 observed route outcomes, 18 scenarios.
- Public/account/admin production builds and strict TypeScript checks — passed.
- `rtk git diff --check` — passed.
- Impeccable detector — zero findings across the changed UI sources.

## User Setup Required

None. Domain, production authentication, database, billing, signed installer publication, and real updater infrastructure remain future work.

## Next Phase Readiness

- Plan 03-45 can now review the exact current 25-candidate packet using the grouped index recorded in `03-UAT.md`.
- Phase 3 remains executing because human visual approval is still false. Plan 03-46 publication must remain blocked until a literal approval is recorded.
- After approval, the project is ready to enter Phase 4 for real authentication, persistence, subscriptions, device/HWID authority, and backend control-plane work.

## Self-Check: PASSED

---
*Phase: 03-complete-web-experience*
*Completed: 2026-08-03*
