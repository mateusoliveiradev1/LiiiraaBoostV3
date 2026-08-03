---
phase: 03-complete-web-experience
plan: '82'
subsystem: web-evidence
tags: [playwright, nextjs, csp, accessibility, screenshots, i18n, launch-readiness]

requires:
  - phase: 03-81
    provides: 464 deterministic canonical route candidates and launch-readiness inspection
provides:
  - Clean independent public, account, and admin production builds
  - Complete canonical and legacy visual regression replay
  - Exact pending-human-review packet with current hashes and approval boundary
affects: [03-45-human-approval, 03-46-publication, phase-04-auth-data]

tech-stack:
  added: []
  patterns:
    - Development-only React/Turbopack CSP compatibility with strict production CSP
    - Header-scoped locale authoring parity where footer language controls are valid
    - Token-owned one-pixel dividers for screenshot-stable skeleton geometry

key-files:
  created:
    - .planning/phases/03-complete-web-experience/03-82-SUMMARY.md
  modified:
    - .planning/phases/03-complete-web-experience/03-UAT.md
    - quality/evidence/phase-03/web/route-reachability.json
    - tooling/web-evidence/src/verify-phase.ts
    - tooling/web-evidence/src/verify-phase.test.ts
    - tooling/web-evidence/tests/accessibility-responsive.spec.ts
    - tooling/web-evidence/tests/__screenshots__/accessibility-responsive.spec.ts/
    - packages/design-tokens/src/tokens.css
    - apps/admin/src/app/admin-shell.css
    - packages/web-features/src/components.test.tsx

key-decisions:
  - "Footer language controls are valid product affordances; the Home duplicate-locale detector is intentionally scoped to the public header."
  - "The Home promise is centered on tablet and desktop, then start-aligned below 640px for readable narrow reflow."
  - "Automated detector passes never imply human or publication approval."

patterns-established:
  - "Complete visual handoff binds every candidate by route, locale, width, state, dimensions, bytes, and SHA-256."
  - "Legacy named goldens remain continuity evidence beside the canonical all-route matrix."

requirements-completed: [WEB-01, WEB-02, WEB-03, WEB-08]
duration: 1h 12min
completed: 2026-08-03
status: complete
---

# Phase 03 Plan 82: Final Route QA and Human-Review Handoff Summary

**All public, account, and admin routes now pass clean builds and complete automated regressions, with 464 canonical candidates plus 25 legacy continuity screenshots bound into one exact, explicitly unapproved human-review packet.**

## Performance

- **Duration:** 1h 12min
- **Completed:** 2026-08-03
- **Tasks:** 1
- **Canonical candidates:** 464
- **Legacy continuity candidates:** 25

## Accomplishments

- Closed all production build, route/content, browser, CSP, accessibility, responsive, planned-verifier, and workspace regression gates against current sources.
- Bound 58 routes × 2 locales × 4 widths into 464 original-resolution candidates: 248 public, 128 account, and 88 admin; 368 ready states and 96 error states.
- Recorded candidate binding `401369ededbe239dc526f2776bac5172507b352a2dfa2288bacee31fbbc4131f` with D-102 through D-110 passing and every approval flag still false.
- Refreshed 23 legacy W/G screenshots while W10 and G05 remained byte-stable; the complete 25-image binding is `68620cf4259a074bc0feaba10dc777ffdf58a2700023ddf2b984d80e0d80ccfd`.
- Preserved every prior human rejection and handed off the exact current packet without creating approval or publication artifacts.

## Task Commits

1. **Task 1: Pass clean builds and bind the exact pending-review packet** — `3c11c91` (`test`)

## Verification

- Public, account, and admin independent production builds: passed.
- Canonical Playwright route matrix: 464/464 passed without update mode.
- Legacy no-update replay: 44 passed, 161 expected matrix skips.
- Legacy controlled refresh: 45 passed, 160 expected matrix skips; 23 changed and 2 byte-stable screenshots.
- Workspace regression: 49/49 tasks successful.
- Package suites: web 119, account 68, admin 76, web-core 111, web-evidence 151 with one intentional skip, web-features 41.
- Planned phase verifier: 110 decisions, 58 routes, 24 observed route outcomes, and 18 scenarios; hash `9ae46bffb42c9083fb900b064539ea00780f8dda54cc8d83837aa6395b412370`.
- React/Turbopack CSP browser gate: development behavior passed while production remained strict.
- `git diff --check`: passed.

## Decisions Made

- Kept the Home's new launch-grade footer language control and corrected the authoring-parity detector to distinguish it from duplicate header navigation.
- Kept the responsive Home hero alignment as an intentional composition instead of forcing desktop centering onto narrow screens.
- Added a semantic divider-width token instead of retaining an unowned screenshot-sensitive pixel literal.
- Kept the entire handoff pending human review; visual stability, automated accessibility, and detector verdicts are evidence, not aesthetic approval.

## Deviations from Plan

### Auto-fixed Issues

**1. Stale locale and hero-alignment detector assumptions**

- **Found during:** complete Playwright regression.
- **Issue:** legacy Home assertions treated the new footer locale control as duplicate navigation and required centered hero copy at every width.
- **Fix:** scoped the duplicate check to the public header and asserted start alignment below 640px.
- **Verification:** exact no-update accessibility/responsive replay passed.
- **Committed in:** `3c11c91`.

**2. Stale visual-manifest schema expectations**

- **Found during:** workspace regression.
- **Issue:** legacy web-evidence and web-features tests still expected schema version 2 after the canonical manifest moved to version 3.
- **Fix:** updated both expectations to the current schema contract.
- **Verification:** web-evidence and web-features suites passed.
- **Committed in:** `3c11c91`.

**3. Admin separator pixel drift**

- **Found during:** legacy W/G screenshot replay.
- **Issue:** the admin skeleton separator used an unowned one-pixel literal that produced a stale visual contract.
- **Fix:** introduced `--lb-divider-width` and consumed it in the admin shell.
- **Verification:** 23 controlled screenshot refreshes plus exact no-update replay passed.
- **Committed in:** `3c11c91`.

---

**Total deviations:** 3 auto-fixed correctness/contract issues.
**Impact on plan:** The fixes were required to make the final QA describe the current authored experience; no approval or publication scope was added.

## Issues Encountered

- The first combined Playwright run exposed 29 stale legacy assertions/snapshots after all 464 canonical candidates had already passed. Each failure was classified and corrected, followed by controlled snapshot refresh and exact no-update replay.

## User Setup Required

None — no external service configuration is required for this QA handoff.

## Next Phase Readiness

- Plan 03-45 can present the exact current Home and full route matrix for literal human review.
- Plan 03-46 remains blocked until the user explicitly approves the candidate packet.
- The download action remains intentionally gated until a signed, trusted release artifact exists.

## Self-Check: PASSED

- All Plan 03-82 artifacts exist and are committed.
- Candidate, legacy, route, build, CSP, accessibility, and workspace gates passed.
- Human and publication approval remain false.

---

_Phase: 03-complete-web-experience_
_Completed: 2026-08-03_
