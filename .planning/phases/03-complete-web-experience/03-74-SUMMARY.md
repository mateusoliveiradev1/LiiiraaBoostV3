---
phase: 03-complete-web-experience
plan: "74"
subsystem: account-ui
tags: [nextjs, react, i18n, accessibility, deterministic-preview, account]

requires:
  - phase: 03-72
    provides: Final localized account shell, canonical routes, and automated web preflight
provides:
  - Five-goal bilingual account navigation with contextual legacy destinations
  - Contradiction-free Essential, active Premium, and pending Premium account projections
  - Decisive Account Home with plan, linked PC, security, and one recommendation
  - Last-trustworthy degraded Home summary with one recovery action
affects: [03-76-route-coverage, 03-81-visual-coverage, phase-04-account-authority]

tech-stack:
  added: []
  patterns:
    - Legacy canonical account routes project into stable customer-goal parents
    - Account scenario admission rejects contradictory plan, billing, PC, security, and action combinations
    - Degraded account rendering retains the last coherent summary without claiming fresh authority

key-files:
  created: []
  modified:
    - apps/account/src/account-navigation.tsx
    - apps/account/src/account-preview-model.ts
    - apps/account/src/features/account-preview.tsx
    - apps/account/src/app/account-shell.css
    - apps/account/src/content/account.pt-BR.json
    - apps/account/src/content/account.en.json
    - apps/account/src/account-shell.test.ts
    - apps/account/src/features/account-preview.test.tsx

key-decisions:
  - "Project Profile to Home, invoices to Plan and payments, downloads to PCs and licenses, and Privacy to Security and privacy without deleting any canonical route."
  - "Use active Premium as the authoritative Account Home projection: active billing, one linked PC, configured MFA, pending passkey, and one passkey recommendation."
  - "Keep remoteStateChanged false in every admitted account scenario and reject recommendations that contradict the represented state."

patterns-established:
  - "Goal projection: customer navigation can change without breaking stable deep links or internal route identities."
  - "Coherent Home: one admitted scenario supplies all plan, billing, PC, security, and recommendation truth."

requirements-completed: [WEB-08]

duration: 20min
completed: 2026-08-03
status: complete
---

# Phase 03 Plan 74: Goal-Oriented Account Home Summary

**Five bilingual customer goals now lead to a contradiction-free Account Home that immediately shows the active plan, linked PC, security posture, and one useful next action.**

## Performance

- **Duration:** 20min
- **Started:** 2026-08-03T07:55:00Z
- **Completed:** 2026-08-03T08:15:28Z
- **Tasks:** 2
- **Files modified:** 8

## Accomplishments

- Replaced the nine-item responsibility rail with Home, PCs and licenses, Plan and payments, Security and privacy, and Help in PT-BR and English while retaining every canonical legacy deep link.
- Moved Profile into the signed-in identity menu and exposed invoices and downloads inside their relevant payments and PC/product workspaces.
- Added admitted Essential, active Premium, and pending Premium projections whose plan, billing, linked-PC, passkey/MFA, recommendation, and no-mutation states cannot contradict each other.
- Rebuilt Account Home as one task-first command surface with exactly one recommendation and three authoritative facts; degraded rendering keeps the last trustworthy summary and one support recovery action.
- Preserved native compact disclosures, locale/route projection, 320px reflow, 400% zoom protections, reduced motion, forced colors, keyboard focus, and the Phase 4 no-mutation boundary.

## Task Commits

1. **Task 1 RED: five-goal navigation contract** - `c796a49`
2. **Task 1 GREEN: customer-goal navigation and contextual routes** - `eea121b`
3. **Task 2 RED: coherent Account Home contract** - `0be927f`
4. **Task 2 GREEN: decisive and degraded Account Home** - `3772fbe`
5. **Task 2 hardening: closed scenario admission** - `acadcc5`

## Files Created/Modified

- `apps/account/src/account-navigation.tsx` - Projects legacy route items into five localized customer goals and keeps Profile in the identity menu.
- `apps/account/src/account-preview-model.ts` - Owns goal mapping plus closed, contradiction-rejecting account scenario projections.
- `apps/account/src/features/account-preview.tsx` - Renders the decisive Home, contextual invoice/download links, and trustworthy degraded recovery.
- `apps/account/src/app/account-shell.css` - Adds restrained command-region, semantic fact-row, responsive, focus, and forced-colors treatments.
- `apps/account/src/content/account.pt-BR.json` - Supplies customer-facing PT-BR Home facts, recommendation, continuity, and recovery copy.
- `apps/account/src/content/account.en.json` - Supplies equivalent reviewed English Account Home copy.
- `apps/account/src/account-shell.test.ts` - Proves five-goal IA, contextual legacy routes, locale preservation, identity placement, and compact navigation.
- `apps/account/src/features/account-preview.test.tsx` - Proves coherent scenarios, contradiction rejection, one recommendation, and degraded summary retention.

## Decisions Made

- Existing canonical routes remain the compatibility authority; navigation projects them into customer goals instead of renaming or deleting deep links.
- Active Premium is the default signed-in Home truth because it coherently matches the established account identity and linked Windows PC. The single unresolved action is passkey setup.
- Degraded Home never invents fresh data: it labels and retains the same last admitted projection, then offers one support-based refresh path.
- Impeccable's product register kept the page familiar and task-first: one focal command surface, semantic definition rows, no decorative animation, no route inventory, and cobalt reserved for the one recommended action.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Test drift] Updated the legacy mobile disclosure assertion**

- **Found during:** Task 2 full account regression
- **Issue:** One pre-existing source assertion still required the removed responsibility group variable after Task 1 correctly switched the compact disclosure to goal groups.
- **Fix:** Bound the assertion to `goalGroups` and renamed it to the customer-goal behavior it now proves.
- **Files modified:** `apps/account/src/account-shell.test.ts`
- **Verification:** Full account suite passes 64/64.
- **Committed in:** `3772fbe`

**2. [Rule 2 - Missing Critical] Closed scenario state and action admission**

- **Found during:** Post-task threat-boundary review
- **Issue:** Contradictions were rejected, but unknown semantic state values or a recommendation paired with the wrong canonical goal could still enter through the exported admission function.
- **Fix:** Added closed state-union checks and exact recommendation-to-route binding before contradiction evaluation.
- **Files modified:** `apps/account/src/account-preview-model.ts`, `apps/account/src/features/account-preview.test.tsx`
- **Verification:** Focused coherent/degraded suite passes 15/15; strict TypeScript check passes.
- **Committed in:** `acadcc5`

---

**Total deviations:** 2 auto-fixed (1 test drift, 1 missing critical boundary validation)
**Impact on plan:** Both fixes preserve the intended customer-goal and spoofing-mitigation contracts without adding scope or remote authority.

## Issues Encountered

- The previous Overview regression test encoded the superseded readiness-table composition. It was updated to prove the new one-recommendation and three-fact hierarchy.
- No package, authentication, or external-service gate was encountered.

## Verification

- Task 1 exact focused command — 13 passed, 42 skipped, zero failed.
- Task 2 exact focused command — 15 passed, 15 skipped, zero failed.
- Full `@liiiraa/account` Vitest suite — 64/64 passed.
- Strict `@liiiraa/account` TypeScript check — passed.
- `@liiiraa/account` production Next.js build — passed; localized catch-all route and favicon emitted successfully.
- `git diff --check` across the plan commits — passed.

## Known Stubs

- `apps/account/src/content/account.pt-BR.json` and `apps/account/src/content/account.en.json` retain explicit unavailable remote-save/recovery copy for Profile and authority failure states. This is intentional D-101 behavior until Phase 4 supplies real account authority; it does not block the goal-oriented Home or any safe review journey.

## Authentication Gates

None.

## User Setup Required

None - no external service configuration or package installation was introduced.

## Next Phase Readiness

- Plan 03-76 can exercise every canonical legacy route through the new five-goal projection.
- Plan 03-81 can capture the decisive wide/mobile Home and verify its one-action hierarchy visually.
- Phase 4 may replace deterministic authority only behind the same scenario and no-mutation contracts; no billing, identity, device, or support mutation was added here.

## Self-Check: PASSED

- All eight modified implementation/test files and this summary exist on disk.
- All five Plan 03-74 task/TDD commits are present in git history.
- Exact focused verification, full account tests, strict TypeScript, production build, and diff hygiene all pass.

---
*Phase: 03-complete-web-experience*
*Completed: 2026-08-03*
