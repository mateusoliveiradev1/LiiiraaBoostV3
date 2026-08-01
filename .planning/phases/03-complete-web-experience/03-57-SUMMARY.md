---
phase: 03-complete-web-experience
plan: "57"
subsystem: ui
tags: [nextjs, react, account-shell, responsive-navigation, accessibility]

requires:
  - phase: 03-54
    provides: canonical account routes, server-owned locale projection, and account preview contracts
provides:
  - exact 72px topbar, 40px preview band, 264px responsibility rail, and max-1240 account workspace
  - native 48px current-task disclosure below 960px with route-preserving locale links
  - one canonical aria-current destination across desktop and mobile account navigation
  - canonical sign-in current-task projection and fully wrapped 320px preview status
affects: [03-61, account-visual-evidence, account-uat]

tech-stack:
  added: []
  patterns:
    - server-owned account route projection with one narrow pathname-aware client boundary
    - native details/summary disclosure for compact responsibility navigation

key-files:
  created: []
  modified:
    - apps/account/src/app/[locale]/layout.tsx
    - apps/account/src/account-navigation.tsx
    - apps/account/src/app/account-shell.css
    - apps/account/src/account-shell.test.ts

key-decisions:
  - "Keep the server layout as the canonical owner of routes, localized groups, noindex metadata, preview truth, and fixture composition."
  - "Keep one canonical desktop aria-current anchor while the mobile disclosure names the current task without duplicating current-page semantics."
  - "Use the localized preview label as explicit provenance detail while rendering the locked remote-changes-disconnected copy once."
  - "Project sign-in as a contextual canonical entry only when it is current, preserving responsibility ownership and one aria-current."

patterns-established:
  - "Responsive account navigation: replace the desktop responsibility rail with a closed native disclosure below 960px."
  - "Preview truth: keep human-readable provenance explicit without exposing raw fixture or adapter metadata in ordinary chrome."

requirements-completed: [WEB-08]

duration: 20min
completed: 2026-08-01
status: complete
---

# Phase 03 Plan 57: Premium Account Shell Summary

**Task-first account frame with exact desktop geometry, compact native mobile disclosure, route-preserving locale controls, and explicit non-authoritative preview truth**

## Performance

- **Duration:** 20 min (12 min initial execution + 8 min rejection correction)
- **Started:** 2026-08-01T16:58:05Z
- **Completed:** 2026-08-01T23:06:55Z
- **Tasks:** 2
- **Files modified:** 4

## Accomplishments

- Replaced the sparse account frame with the required 72px branded topbar, 40px preview band, 264px responsibility rail, and centered max-1240 workspace.
- Preserved every canonical account responsibility, route-aware locale switching, and exactly one `aria-current` destination, including the sign-in entry route.
- Replaced the mobile route inventory below 960px with a closed 48px native current-task disclosure that reflows without horizontal page overflow at 320px.
- Made the complete bilingual preview status wrap at 320px/400%-equivalent reflow instead of inheriting a single-line ellipsis.
- Preserved noindex, same-origin routing, deterministic preview truth, forced-colors support, reduced-motion behavior, and the existing CSP boundary.

## Task Commits

Each TDD gate and implementation was committed atomically:

1. **Task 1 RED: encode desktop shell contract** - `e86fa8b` (test)
2. **Task 1 GREEN: compose exact desktop account shell** - `f05298b` (feat)
3. **Task 2 RED: encode mobile disclosure contract** - `7219dc2` (test)
4. **Task 2 GREEN: replace mobile inventory with task disclosure** - `623e6df` (feat)
5. **Rule 2 correction: keep preview provenance detail explicit** - `5c5cd43` (fix)
6. **03-64 rejection RED: encode sign-in and status-wrap contracts** - `34197e5` (test)
7. **03-64 rejection GREEN: close rejected account shell states** - `b28dabd` (fix)

## Files Created/Modified

- `apps/account/src/app/[locale]/layout.tsx` - Composes the branded shell, canonical navigation projection, localized locale controls, and explicit preview provenance.
- `apps/account/src/account-navigation.tsx` - Keeps pathname awareness inside one client boundary and exposes desktop/mobile responsibility navigation.
- `apps/account/src/app/account-shell.css` - Defines the exact desktop geometry, compact responsive disclosure, narrow-width reflow, focus, forced-colors, and reduced-motion behavior.
- `apps/account/src/account-shell.test.ts` - Enforces desktop shell, mobile disclosure, locale preservation, preview copy, and reflow contracts.

## Decisions Made

- The server layout remains the canonical owner of localized routes, responsibility groups, noindex metadata, preview truth, and deterministic fixture composition; only pathname detection remains client-side.
- The hidden canonical desktop link retains the page's sole `aria-current` on mobile, while the disclosure summary communicates the current task without creating a second current-page semantic.
- Phosphor responsibility icons continue to flow through `@liiiraa/design-system`; no new package or parallel icon system was added.
- The preview band uses exact bilingual human copy and an explicit localized provenance label, with raw fixture and adapter values kept out of ordinary chrome.
- Canonical sign-in is projected as a contextual entry only while `/[locale]/sign-in` is current; the server supplies its bounded route and bilingual label, and the existing client boundary performs pathname matching.
- The account shell overrides the shared status-detail ellipsis only below 760px, allowing full preview truth to wrap without changing the global design-system behavior.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 2 - Missing Critical] Removed an empty preview-provenance detail**

- **Found during:** Final stub scan after Task 2
- **Issue:** `AccountPreviewProvenance` received an empty `detail`, weakening the explicit preview-truth contract and duplicating the label in adjacent markup.
- **Fix:** Passed the localized preview label as provenance detail and removed the duplicate label markup and CSS.
- **Files modified:** `apps/account/src/app/[locale]/layout.tsx`, `apps/account/src/app/account-shell.css`
- **Verification:** All 16 account shell tests, strict TypeScript, optimized Next.js build, ESLint, Prettier, and the scoped stub scan pass.
- **Committed in:** `5c5cd43`

---

**Total deviations:** 1 auto-fixed (1 missing critical)
**Impact on plan:** The correction strengthens the required preview-truth boundary without expanding scope.

## TDD Gate Compliance

- RED commits exist for both behavior groups: `e86fa8b` and `7219dc2`.
- GREEN commits follow their respective RED gates: `f05298b` and `623e6df`.
- The 03-64 rejection correction has a dedicated RED commit (`34197e5`) before its GREEN commit (`b28dabd`).
- The final correction was verified against the complete 18-test account shell suite.

## 03-64 Rejection Correction

- **W10 at 960px:** `/en/sign-in` now shows one visible canonical `aria-current="page"` link labeled **Sign in**. The topbar names **Sign in**, while **No session connected** and disconnected preview authority remain unchanged.
- **W18 at 320px / 400%-equivalent:** **Remote changes disconnected** wraps completely with computed `white-space: normal`, `text-overflow: clip`, and `overflow-wrap: anywhere`; measured clipping is false and document horizontal overflow remains zero.
- The native current-task disclosure remains closed by default, retains its 48px minimum target, and the document retains exactly one canonical `aria-current`.
- No account workspace/content, visual golden, screenshot manifest, dependency, CSP, or trust-boundary files changed.

## Verification

- `pnpm --filter @liiiraa/account exec vitest run src/account-shell.test.ts` - 18 passed.
- `pnpm --filter @liiiraa/account exec vitest run` - full account package passed, 43 tests across 3 files.
- `pnpm --filter @liiiraa/account check` - strict TypeScript passed.
- `pnpm --filter @liiiraa/account build` - optimized Next.js build passed.
- ESLint on the modified TypeScript files passed.
- Prettier check and `git diff --check` passed.
- Impeccable product-register detector reported zero findings.
- Exact non-update Playwright inspection for W10 desktop-960 and W18 reflow-320 - 5 passed, with temporary inspection assertions 2 passed.
- Scoped stub scan found no placeholder, TODO, FIXME, empty-detail, or hardcoded empty-value patterns.

## Issues Encountered

None.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness

- The corrected account shell is ready for the required Plan 03-61 browser replay and fresh bounded Plan 03-62 capture attempt.
- No blockers, known stubs, new dependencies, or new security-relevant surfaces remain.

## Self-Check: PASSED

- All four plan-owned implementation/test files and this summary exist on disk.
- All seven Plan 03-57 task and correction commits exist in git history.

---
*Phase: 03-complete-web-experience*
*Completed: 2026-08-01*
