---
phase: 03-complete-web-experience
plan: "50"
subsystem: account-ui
tags: [react, nextjs, responsive-navigation, localization, accessibility, tdd]

requires:
  - phase: 03-48
    provides: Canonical current-route localization resolver and accessible LocaleSwitcher
  - phase: 03-39
    provides: Initial authored account Overview and Profile composition
provides:
  - Premium account topbar with explicit disconnected identity and current-task context
  - Canonical one-current desktop responsibility navigation and compact mobile disclosure
  - Route-preserving flag-plus-language switching for every account responsibility
  - Task-specific semantic account workspaces with deterministic no-change boundaries
affects: [03-45, 03-46, WEB-08, account-visual-evidence]

tech-stack:
  added: []
  patterns:
    - One narrow client owner resolves canonical pathname, current responsibility, and alternate locale
    - Mobile task navigation uses a native closed details disclosure instead of a stacked route inventory
    - Account density comes from semantic rows, tables, definition lists, and bounded fields

key-files:
  created:
    - .planning/phases/03-complete-web-experience/03-50-SUMMARY.md
  modified:
    - apps/account/src/app/[locale]/layout.tsx
    - apps/account/src/account-navigation.tsx
    - apps/account/src/app/account-shell.css
    - apps/account/src/account-shell.test.ts
    - apps/account/src/features/account-preview.tsx
    - apps/account/src/features/account-preview.test.tsx
    - .planning/debug/phase-03-account-visual-polish.md

key-decisions:
  - "Keep pathname awareness in one AccountNavigation client boundary while the server layout supplies identity and preview-truth slots."
  - "Use the canonical account route resolver for both active responsibility and alternate-locale href; fall back only to the target-locale Overview when the pathname is not admitted."
  - "Below 960px replace the desktop inventory with a native current-task disclosure, and below 400px remove the redundant topbar task copy while retaining the full disclosure label."
  - "Ordinary routes rely on the shell preview boundary; consequence-specific device, download, privacy, support, cancellation, and receipt contexts retain explicit truth."

patterns-established:
  - "Account orientation: one canonical current desktop anchor plus one compact mobile current-task summary."
  - "Account composition: constrained 1024px task canvas inside the 1280px shell, with responsibility-specific semantic structures."

requirements-completed: [WEB-08]

duration: 17 min
completed: 2026-08-01
status: complete
---

# Phase 03 Plan 50: Premium Account Shell and Responsibility Workspaces Summary

**A route-aware premium account shell now preserves the active responsibility across languages, collapses mobile navigation into a current-task disclosure, and presents every deterministic account task through bounded semantic workspaces.**

## Performance

- **Duration:** 17 min
- **Started:** 2026-08-01T05:08:44.753Z
- **Completed:** 2026-08-01T05:25:42.609Z
- **Tasks:** 2
- **Files modified:** 7

## Accomplishments

- Rebuilt the account frame around a familiar product topbar, one active desktop responsibility, a compact mobile disclosure, a constrained task canvas, and one quiet persistent disconnected-preview note.
- Integrated `resolveLocalizedCurrentRoute` and the shared `LocaleSwitcher`, preserving Profile, Security, invoices, device, privacy, support, and every other canonical responsibility while visibly rendering 🇧🇷 Português or 🇺🇸 English.
- Reauthored Security, subscription, invoices, device, downloads, privacy, and support around semantic rows, responsive tables, definition groups, bounded fields, and consequence-specific review regions rather than interchangeable card walls.
- Preserved synthetic fixtures, safe-draft allowlists, email validation, degraded recovery, cancellation, validated Phase 4 receipts, and `remoteStateChanged: false` terminals.
- Verified the result at 1440×900, 390×844, and 320×800; the 320px follow-up removed a redundant truncated task label without weakening current-location context.

## TDD Execution

### RED

- Shell tests failed until canonical active-route resolution, shared locale switching, contextual topbar composition, and compact mobile disclosure existed.
- Workspace tests failed until each responsibility exposed its own semantic structure, bounded measure, and explicit deterministic state coverage.

### GREEN

- `AccountNavigation` became the single pathname-aware owner and the server layout remained responsible for locale validation, identity copy, and preview-truth content.
- Account routes gained responsibility-specific markup and account-only responsive CSS while retaining the existing no-authority workflow machine and adapters.

### REFACTOR

- Visual QA added a small 320px orientation fix after the GREEN implementations; no separate behavior-neutral refactor was required.

## Task Commits

Each TDD gate and follow-up fix was committed atomically:

1. **Task 1 RED: Account shell composition contract** - `b40cdea` (test)
2. **Task 1 GREEN: Premium route-aware account shell** - `5a4683f` (feat)
3. **Task 2 RED: Responsibility workspace density contract** - `2496631` (test)
4. **Task 2 GREEN: Semantic account responsibility workspaces** - `640f7a3` (feat)
5. **Visual QA fix: 320px account orientation** - `20c368c` (fix)

## Files Created/Modified

- `apps/account/src/app/[locale]/layout.tsx` - Supplies localized account identity, current-task language, and the single persistent disconnected-preview note.
- `apps/account/src/account-navigation.tsx` - Resolves canonical current and alternate-locale routes, renders the desktop rail, and owns the compact mobile disclosure.
- `apps/account/src/app/account-shell.css` - Defines the constrained premium frame, semantic task density, 960px navigation switch, 320px reflow, forced colors, and reduced motion.
- `apps/account/src/account-shell.test.ts` - Proves one current route, mobile disclosure behavior, topbar truth, locale preservation wiring, and responsive accessibility contracts.
- `apps/account/src/features/account-preview.tsx` - Authors task-specific account workspaces while retaining deterministic review and no-change terminal behavior.
- `apps/account/src/features/account-preview.test.tsx` - Proves semantic density, bounded measures, bilingual states, safe drafts, cancellation, and no-change receipts.
- `.planning/debug/phase-03-account-visual-polish.md` - Records the resolved root cause and final automated and visual evidence.

## Decisions Made

- Passed server-rendered identity, preview, and page content through one client navigation owner so pathname awareness did not spread into route content or server authority.
- Kept only one `aria-current="page"` anchor in the DOM; mobile orientation comes from the disclosure summary, avoiding duplicate current-page semantics across hidden responsive variants.
- Removed ordinary Security and subscription preview-boundary repetition because the persistent shell note already communicates global truth; sensitive review and receipt surfaces retain contextual consequence language.
- Hid redundant topbar task text below 400px because the adjacent disclosure preserves the full current task and avoids truncation at the 320px contract width.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Removed truncated duplicate task context at 320px**

- **Found during:** Final visual QA after Task 2
- **Issue:** The topbar current-task value truncated to a fragment at 320px even though the full current responsibility appeared immediately below in the compact disclosure.
- **Fix:** Hide the redundant topbar task below 400px and retain the complete disclosure summary; add spacing between the desktop active marker and label.
- **Files modified:** `apps/account/src/app/account-shell.css`, `apps/account/src/account-shell.test.ts`
- **Verification:** Shell test passed and the repeated 320×800 capture showed a readable brand/locale topbar plus full Profile disclosure.
- **Committed in:** `20c368c`

---

**Total deviations:** 1 auto-fixed (1 Rule 1 bug)
**Impact on plan:** The fix was required for the explicit 320px reflow criterion and did not broaden account scope.

## Issues Encountered

- The first account `check` run observed a concurrent CSP test narrowing issue owned by Plan 03-47. Its owner resolved it in `fdf8213`; no CSP file was edited by Plan 03-50, and the final account check passed.

## Verification

- `rtk pnpm --filter @liiiraa/account test -- --run` — PASS, 30/30 tests
- `rtk pnpm --filter @liiiraa/account check` — PASS
- `rtk pnpm --filter @liiiraa/account build` — PASS
- Impeccable detector over the account layout, navigation, styles, and workspaces — PASS, 0 findings
- Direct Playwright visual inspection at 1440×900, 390×844, and 320×800 — PASS

## Known Stubs

None. Empty collections, unavailable authority, and synthetic fixture values are intentional scenario truth, not incomplete UI wiring.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness

- The account visual gap is resolved with executable and direct browser evidence.
- Named cross-surface human UAT remains appropriate after sibling public/admin gap plans finish; Plan 03-50 grants no publication or real account authority.

## Self-Check: PASSED

- All seven modified implementation, test, and debug files plus this Summary exist on disk.
- RED/GREEN and visual-QA commits `b40cdea`, `5a4683f`, `2496631`, `640f7a3`, and `20c368c` exist in repository history.
- Final account tests, type check, production build, Impeccable detector, and three responsive browser captures passed.

---
*Phase: 03-complete-web-experience*
*Completed: 2026-08-01*
