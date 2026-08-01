---
phase: 03-complete-web-experience
plan: '61'
subsystem: testing
tags: [playwright, axe, accessibility, responsive, motion, visual-evidence]

requires:
  - phase: 03-56
    provides: Cobalt token authority and motion roles
  - phase: 03-58
    provides: account focal workspace composition
  - phase: 03-60
    provides: admin focal workspace composition
provides:
  - Closed 25-record candidate-only visual evidence manifest for Plan 03-62
  - Exact executable public, account, and admin geometry contracts
  - Direct Section 17 motion and reduced-motion browser contract
  - Blocking cross-origin Axe, reflow, text-scaling, forced-colors, CSP, and authority gates
affects: [03-62, visual-rebaseline, web-evidence, accessibility]

tech-stack:
  added: []
  patterns:
    - Candidate evidence remains source-bound but cannot become a visual target
    - Browser geometry and motion policy are asserted from computed DOM values

key-files:
  created:
    - tooling/web-evidence/tests/motion-contract.spec.ts
  modified:
    - tooling/web-evidence/visual-manifest.json
    - tooling/web-evidence/tests/accessibility-responsive.spec.ts
    - tooling/web-evidence/tests/public.spec.ts
    - tooling/web-evidence/tests/account.spec.ts
    - tooling/web-evidence/tests/admin.spec.ts
    - tooling/web-evidence/playwright.config.ts
    - packages/design-tokens/src/tokens.css
    - apps/web/src/app/public-shell.css
    - apps/account/src/app/account-shell.css
    - apps/admin/src/app/admin-shell.css

key-decisions:
  - 'Invalidated W/G pixels remain candidate inputs only; candidate records run accessibility checks without screenshot comparison until Plan 03-62 rebaselines them.'
  - 'Explicit Playwright project selection starts only the selected origin, while the unfiltered motion contract starts all three origins.'
  - 'Locked destructive red remains a boundary signal instead of a text background because no label color can provide the required 4.5:1 contrast on that fill.'

patterns-established:
  - 'Evidence status and pixels are separate authorities: candidate metadata never implies approval, publication, or a visual target.'
  - 'Responsive failures report the first overflowing DOM sources so 320px and text-scaling defects remain actionable.'

requirements-completed: [WEB-01, WEB-02, WEB-03, WEB-08]

duration: 58min
completed: 2026-08-01
status: complete
---

# Phase 03 Plan 61: Exact Browser and Candidate Evidence Contracts Summary

**Candidate-only W01-W18/G01-G07 evidence with exact cross-origin geometry, motion, accessibility, responsive, CSP, and authority browser gates**

## Performance

- **Duration:** 58 min
- **Started:** 2026-08-01T18:28:23Z
- **Completed:** 2026-08-01T19:25:44Z
- **Tasks:** 2
- **Files modified:** 12

## Accomplishments

- Closed all 25 visual records as unapproved, unpublished Plan 03-62 candidates while explicitly invalidating the rejected prior pixels as targets.
- Added exact public, account, and admin geometry/navigation assertions at wide, 390px mobile, and 320px reflow axes.
- Added a directly executed motion contract for the approved 100/160/200/220/360/480ms roles, easing curves, entrance caps, default-visible content, and reduced-motion removal.
- Kept serious/critical Axe, keyboard, forced-colors, 200% text, responsive overflow, CSP, noindex, origin, redaction, and no-authority checks blocking without updating screenshots.

## Task Commits

Each task was committed atomically through its TDD gates:

1. **Task 1 RED: Add failing candidate manifest contract** - `ea46008` (test)
2. **Task 1 GREEN: Bind visual records to candidate status** - `677e572` (feat)
3. **Task 2 RED: Add exact geometry and motion browser contracts** - `b3c79c4` (test)
4. **Task 2 GREEN: Enforce exact browser geometry and motion gates** - `2350137` (feat)

## Files Created/Modified

- `tooling/web-evidence/tests/motion-contract.spec.ts` - Direct computed-style motion, entrance, default-visibility, and reduced-motion contract.
- `tooling/web-evidence/visual-manifest.json` - Exact 25-record candidate matrix with closed origins and no approval/publication authority.
- `tooling/web-evidence/tests/accessibility-responsive.spec.ts` - Candidate assertions plus cross-surface Axe, responsive, security, and overflow diagnostics.
- `tooling/web-evidence/tests/public.spec.ts` - Exact Cobalt Ignition Bay wide/mobile geometry, route-preserving locale, and navigation assertions.
- `tooling/web-evidence/tests/account.spec.ts` - Exact account shell/workspace and compact-navigation assertions.
- `tooling/web-evidence/tests/admin.spec.ts` - Exact admin shell/grid/status and compact-navigation assertions.
- `tooling/web-evidence/playwright.config.ts` - Spec/project-aware origin startup for focused and multi-origin runs.
- `packages/web-features/src/components.test.tsx` - Candidate-only manifest projection and origin contract.
- `packages/design-tokens/src/tokens.css` - Canonical responsive geometry tokens and accessible destructive treatment.
- `apps/web/src/app/public-shell.css` - Tokenized public geometry, approved motion duration, and forced-colors CTA specificity.
- `apps/account/src/app/account-shell.css` - Accessible CTA/destructive contrast and robust 200% text wrapping.
- `apps/admin/src/app/admin-shell.css` - Canonical workspace width, 48px compact locale control, and 320px-safe preview/status layout.

## Decisions Made

- Candidate records continue to prove route, locale, viewport, scenario, source, and accessibility truth, but their invalidated pixels are not compared or promoted.
- Browser server startup is derived from both spec identity and explicit project selection so focused runs remain isolated and unfiltered motion runs remain complete.
- Destructive actions use the locked red as a border signal over canvas; ordinary cobalt CTAs use the canonical dark primary label to satisfy blocking contrast.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] Canonicalized geometry and typography literals required by exact tests**

- **Found during:** Task 1 GREEN
- **Issue:** Existing public/admin shell literals duplicated approved token authority, preventing exact policy assertions from closing cleanly.
- **Fix:** Added the missing mobile hero/workspace tokens and replaced the duplicated shell values with their canonical variables.
- **Files modified:** `packages/design-tokens/src/tokens.css`, `apps/web/src/app/public-shell.css`, `apps/admin/src/app/admin-shell.css`
- **Verification:** Focused visual-contract tests passed.
- **Committed in:** `677e572`

**2. [Rule 3 - Blocking] Made the motion contract start every required origin**

- **Found during:** Task 2 GREEN
- **Issue:** The new unfiltered motion spec reached public, account, and admin routes but the harness started only the public server.
- **Fix:** Added motion-contract multi-origin selection while preserving explicit `--project` isolation.
- **Files modified:** `tooling/web-evidence/playwright.config.ts`
- **Verification:** Unfiltered motion suite passed 5 tests with 40 intentional project skips.
- **Committed in:** `2350137`

**3. [Rule 3 - Blocking] Removed invalid screenshot comparisons from candidate checks**

- **Found during:** Task 2 GREEN
- **Issue:** Candidate routes correctly ran Axe/reflow checks but still compared pixels explicitly marked as rejected and invalidated.
- **Fix:** Replaced candidate screenshot assertions with status/source/visual-target assertions; no screenshot was updated or promoted.
- **Files modified:** `tooling/web-evidence/tests/accessibility-responsive.spec.ts`
- **Verification:** Exact filtered browser matrix passed without screenshot update mode.
- **Committed in:** `2350137`

**4. [Rule 2 - Missing Critical] Closed serious CTA and destructive-action contrast failures**

- **Found during:** Task 2 GREEN
- **Issue:** Axe found serious contrast failures on cobalt account/admin CTAs, the locked destructive fill, and forced-colors public CTAs.
- **Fix:** Used canonical primary labels, preserved text-primary on raised hover surfaces, moved destructive red to a boundary signal, and matched forced-colors specificity.
- **Files modified:** `packages/design-tokens/src/tokens.css`, `apps/web/src/app/public-shell.css`, `apps/account/src/app/account-shell.css`, `apps/admin/src/app/admin-shell.css`
- **Verification:** The four failing candidate routes passed, then the full matrix passed with zero failures.
- **Committed in:** `2350137`

**5. [Rule 1 - Bug] Fixed 320px and 200% text overflow sources**

- **Found during:** Task 2 GREEN
- **Issue:** Account privacy definition values and the admin preview status exceeded the viewport; compact admin controls also missed the 48px target.
- **Fix:** Made definitions wrap in one safe column, allowed the preview status to shrink with ellipsis, hid nonessential compact header task text, and raised the locale control to 48px.
- **Files modified:** `apps/account/src/app/account-shell.css`, `apps/admin/src/app/admin-shell.css`
- **Verification:** Account reflow/text/reduced-motion and admin reflow accessibility contracts passed.
- **Committed in:** `2350137`

---

**Total deviations:** 5 auto-fixed (1 Rule 1, 1 Rule 2, 3 Rule 3)
**Impact on plan:** All fixes were required to keep the planned exact gates truthful and blocking; no pixels, UAT verdicts, reports, bundles, packages, or publication authority changed.

## Issues Encountered

- The first broad filtered run exposed rejected screenshot comparisons and real contrast/reflow defects together. Candidate screenshot comparisons were retired, then the remaining Axe and overflow defects were fixed without weakening thresholds.
- The final pre-fix matrix reported four repeated primary-CTA contrast failures. A shared semantic label correction closed all four, and the exact matrix then passed 54 tests with 446 intentional project/axis skips.

## TDD Gate Compliance

- RED gates: `ea46008`, `b3c79c4`
- GREEN gates: `677e572`, `2350137`
- Ordering verified in git history; each GREEN commit follows its owning RED commit.

## Verification

- `rtk pnpm --filter @liiiraa/web-features exec vitest run src/components.test.tsx -t "qualitative-review metadata|visual contract"` - 6 passed, 10 skipped.
- Candidate manifest Playwright gate - 2 passed, 16 skipped.
- `rtk pnpm --filter @liiiraa/web-evidence exec playwright test tests/motion-contract.spec.ts` - 5 passed, 40 skipped.
- Exact filtered public/account/admin/accessibility matrix - 54 passed, 446 skipped.
- Focused account/public/admin contrast, reflow, mobile, forced-colors, and geometry reruns all passed.
- Diff whitespace and Prettier checks passed for changed formatted files; canonical precision in the design-token authority was preserved.

## Known Stubs

None - no placeholder, TODO, FIXME, empty UI data source, or future-only stub was introduced.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness

- Plan 03-62 can capture new pixels against exact candidate identities and executable UI/accessibility contracts.
- Human approval, UAT verdicts, report promotion, publication, and bundle ownership remain intentionally closed.

## Self-Check: PASSED

- Summary, motion contract, and candidate manifest exist on disk.
- All four RED/GREEN task commits exist in git history.
- No required file or commit is missing.

---

_Phase: 03-complete-web-experience_
_Completed: 2026-08-01_
