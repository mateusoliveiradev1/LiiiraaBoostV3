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
  - Bounded explicit-update capture path for exactly W01-W18 and G01-G07
  - Permanent Playwright dry-list contract binding each candidate to one owning project
  - Exact executable public, account, and admin geometry contracts
  - Direct Section 17 motion and reduced-motion browser contract
  - Blocking cross-origin Axe, reflow, text-scaling, forced-colors, CSP, and authority gates
affects: [03-62, visual-rebaseline, web-evidence, accessibility]

tech-stack:
  added: []
  patterns:
    - Candidate evidence remains source-bound but cannot become a visual target
    - Ordinary Playwright runs set snapshot updates to none; explicit update mode alone activates candidate capture
    - Candidate titles carry exact project identity and project grep excludes cross-axis duplicates before runtime
    - Browser geometry and motion policy are asserted from computed DOM values

key-files:
  created:
    - tooling/web-evidence/tests/motion-contract.spec.ts
    - tooling/web-evidence/src/candidate-capture-selection.test.ts
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
  - 'Playwright defaults to no snapshot updates in this harness; the explicit Plan 03-62 update flag is the only candidate-capture authority.'
  - 'Each candidate test carries its exact final-project tag so Playwright selection closes at 25 tests before runtime skips.'
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
- Restored a bounded candidate writer that stays inert in ordinary runs and maps one explicit update to the exact 25 manifest identities without changing approval or publication state.
- Bound every candidate title to its exact final project and added a permanent dry-list gate proving exactly 25 unique manifest identities are selected with no duplicates or extras.

## Task Commits

Each task was committed atomically through its TDD gates:

1. **Task 1 RED: Add failing candidate manifest contract** - `ea46008` (test)
2. **Task 1 GREEN: Bind visual records to candidate status** - `677e572` (feat)
3. **Task 2 RED: Add exact geometry and motion browser contracts** - `b3c79c4` (test)
4. **Task 2 GREEN: Enforce exact browser geometry and motion gates** - `2350137` (feat)
5. **Bounded correction: Restore explicit candidate capture mode** - `ee9b2d9` (fix)
6. **Bounded correction: Bind candidate tests to owning projects** - `922ea82` (fix)

## Files Created/Modified

- `tooling/web-evidence/tests/motion-contract.spec.ts` - Direct computed-style motion, entrance, default-visibility, and reduced-motion contract.
- `tooling/web-evidence/src/candidate-capture-selection.test.ts` - Permanent no-server/no-screenshot Playwright list contract for the exact 25 candidate project/ID pairs.
- `tooling/web-evidence/visual-manifest.json` - Exact 25-record candidate matrix with closed origins and no approval/publication authority.
- `tooling/web-evidence/tests/accessibility-responsive.spec.ts` - Candidate assertions, bounded update-only capture, exact identity proof, and cross-surface Axe/responsive/security diagnostics.
- `tooling/web-evidence/tests/public.spec.ts` - Exact Cobalt Ignition Bay wide/mobile geometry, route-preserving locale, and navigation assertions.
- `tooling/web-evidence/tests/account.spec.ts` - Exact account shell/workspace and compact-navigation assertions.
- `tooling/web-evidence/tests/admin.spec.ts` - Exact admin shell/grid/status and compact-navigation assertions.
- `tooling/web-evidence/playwright.config.ts` - Spec/project-aware origin startup plus a fail-closed ordinary snapshot policy.
- `packages/web-features/src/components.test.tsx` - Candidate-only manifest projection and origin contract.
- `packages/design-tokens/src/tokens.css` - Canonical responsive geometry tokens and accessible destructive treatment.
- `apps/web/src/app/public-shell.css` - Tokenized public geometry, approved motion duration, and forced-colors CTA specificity.
- `apps/account/src/app/account-shell.css` - Accessible CTA/destructive contrast and robust 200% text wrapping.
- `apps/admin/src/app/admin-shell.css` - Canonical workspace width, 48px compact locale control, and 320px-safe preview/status layout.

## Decisions Made

- Candidate records continue to prove route, locale, viewport, scenario, source, and accessibility truth, but their invalidated pixels are not compared or promoted.
- Browser server startup is derived from both spec identity and explicit project selection so focused runs remain isolated and unfiltered motion runs remain complete.
- Destructive actions use the locked red as a border signal over canvas; ordinary cobalt CTAs use the canonical dark primary label to satisfy blocking contrast.
- Ordinary Playwright execution uses `updateSnapshots: 'none'`; the explicit `--update-snapshots` CLI flag overrides it to `changed`, activating the bounded candidate helper without granting approval or publication authority.
- Candidate tests use adjacent final/surface tags plus an exact project tag; final-project grep admits ordinary surface tests unchanged while selecting each candidate on one axis project only.

## Bounded Harness Correction

- Commit `2350137` correctly stopped ordinary comparison against invalidated pixels but also removed every candidate screenshot call, so Plan 03-62's exact update command could not produce W01-W18/G01-G07.
- The correction calls `toHaveScreenshot` only from tests tagged `@candidate-capture` and only when explicit update mode is active. Each of the 25 manifest records has one unique capture ID, snapshot path, surface, viewport, and Playwright project mapping.
- Ordinary mode is proven inert because the proof-only update test skips with the harness default `updateSnapshots: 'none'`. Explicit `--update-snapshots` mode is proven active by the same test, which does not call the capture helper and therefore does not consume Plan 03-62's single exact update.
- No candidate PNG, archive, manifest status, UAT verdict, report, publication record, bundle, package version, or lockfile changed.
- The local Playwright runtime was repaired with `pnpm install --offline --frozen-lockfile --force` after confirming the pnpm store was untouched. `coreBundle.js` is 3,425,217 bytes, contains zero NUL bytes, and has SHA-256 `3258d1cf334c6afc95f22aa9c292436cb976b391e0437f1359c83b84f0cb9d66`; `pnpm-lock.yaml` remains `86bb89b58b01cadc5d9791c34d69cb18efd2fc0a8f554cdd2e9cc318ca520091`.
- A second bounded correction fixed project selection without running update mode: RED dry-listing found zero candidates because the surface tag was not adjacent to `@final`; the first tag-order fix exposed 225 cross-axis instances; exact project tags plus candidate-aware project grep reduced the authoritative dry list to 25 unique W/G tests.

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

**6. [Rule 1 - Bug] Restored bounded candidate generation without ordinary screenshot comparison**

- **Found during:** Post-completion Plan 03-61 correction
- **Issue:** Removing invalid candidate comparisons also removed every screenshot call, so the exact Plan 03-62 update command would generate zero candidates. Playwright 1.62 also defaults ordinary runs to `updateSnapshots: 'missing'`, which is not a safe discriminator for explicit update intent.
- **Fix:** Set the harness default to `none`, retained CLI override behavior, added one guarded capture helper call per W/G test, and proved all 25 manifest/project/path identities are unique and exact.
- **Files modified:** `tooling/web-evidence/playwright.config.ts`, `tooling/web-evidence/tests/accessibility-responsive.spec.ts`
- **Verification:** Ordinary proof skipped; explicit update proof passed without invoking screenshot capture; the full ordinary matrix and motion contract passed.
- **Committed in:** `ee9b2d9`

**7. [Rule 3 - Blocking] Repaired the corrupted installed Playwright runtime deterministically**

- **Found during:** Post-completion Plan 03-61 correction
- **Issue:** The installed Playwright `coreBundle.js` was corrupted, blocking trustworthy browser verification while the package store itself remained intact.
- **Fix:** Reinstalled from the existing store with offline, frozen-lockfile, forced relinking; no dependency or lockfile content changed.
- **Files modified:** None in git; local installed dependency only.
- **Verification:** Zero NUL bytes, exact bundle length/hash recorded above, TypeScript and browser suites passed.
- **Committed in:** Not applicable - deterministic local dependency repair produced no repository diff.

**8. [Rule 1 - Bug] Closed candidate selection at exactly one owning project per identity**

- **Found during:** Plan 03-62 consumed update attempt after the first bounded correction
- **Issue:** `@candidate-capture` separated `@final` from the surface tag, so final-project grep selected zero candidates. Reordering alone selected every candidate on all nine axes and relied on runtime skips, yielding 225 dry-listed instances instead of an exact 25-test writer set.
- **Fix:** Added exact project tags to W/G titles, made final-project grep candidate-aware, and added a permanent Vitest contract that invokes Playwright `--list` and compares all project/ID pairs with the manifest.
- **Files modified:** `tooling/web-evidence/playwright.config.ts`, `tooling/web-evidence/tests/accessibility-responsive.spec.ts`, `tooling/web-evidence/src/candidate-capture-selection.test.ts`
- **Verification:** RED dry list found 0; intermediate list found 225; final list and permanent contract proved exactly 25 unique W01-W18/G01-G07 entries. Ordinary filtered and motion suites passed without update mode or image changes.
- **Committed in:** `922ea82`

---

**Total deviations:** 8 auto-fixed (3 Rule 1, 1 Rule 2, 4 Rule 3)
**Impact on plan:** All fixes were required to keep the planned exact gates truthful and blocking; no pixels, UAT verdicts, reports, bundles, packages, or publication authority changed.

## Issues Encountered

- The first broad filtered run exposed rejected screenshot comparisons and real contrast/reflow defects together. Candidate screenshot comparisons were retired, then the remaining Axe and overflow defects were fixed without weakening thresholds.
- The final pre-fix matrix reported four repeated primary-CTA contrast failures. A shared semantic label correction closed all four, and the exact matrix then passed 54 tests with 446 intentional project/axis skips.
- The first correction matrix exposed an invalid `Set`/`toHaveLength` proof matcher; switching to the native `Set.size` assertion closed the test-authoring defect without weakening the identity contract.
- Playwright 1.62's installed types and runner source confirmed ordinary mode defaults to `missing` and a bare `--update-snapshots` flag selects `changed`; the harness now makes that boundary explicit and fail-closed.
- Playwright project grep is applied during test enumeration, while `onlyAxis` skips at runtime. The permanent dry-list contract therefore validates project closure directly instead of accepting a larger selected set that happens to skip later.

## TDD Gate Compliance

- RED gates: `ea46008`, `b3c79c4`
- GREEN gates: `677e572`, `2350137`
- Ordering verified in git history; each GREEN commit follows its owning RED commit.

## Verification

- `rtk pnpm --filter @liiiraa/web-features exec vitest run src/components.test.tsx -t "qualitative-review metadata|visual contract"` - 6 passed, 10 skipped.
- Candidate manifest Playwright gate - 2 passed, 16 skipped.
- `rtk pnpm --filter @liiiraa/web-evidence exec playwright test tests/motion-contract.spec.ts` - 5 passed, 40 skipped.
- Exact filtered public/account/admin/accessibility matrix - 54 passed, 446 skipped.
- Corrected-config filtered public/account/admin/accessibility matrix - 30 passed, 263 intentional project/axis skips, 0 failed.
- Ordinary candidate-update boundary proof - 1 skipped, proving capture mode is inactive.
- Explicit `--update-snapshots` proof-only boundary - 1 passed without invoking the screenshot helper or writing candidate pixels.
- Corrected unfiltered motion suite - 5 passed, 40 intentional project/axis skips, 0 failed.
- Permanent candidate-selection dry-list Vitest - 1 passed; exactly 25 tests in one file, 25 unique manifest IDs, and exact project/path ownership.
- Final candidate-aware ordinary filtered matrix - 55 passed, 263 intentional project/axis skips, 0 failed; all 25 candidate routes executed with screenshot capture disabled.
- Final candidate-aware unfiltered motion suite - 5 passed, 40 intentional project/axis skips, 0 failed.
- Web-evidence TypeScript check, Prettier, and `git diff --check` passed.
- Playwright runtime integrity - 3,425,217 bytes, 0 NUL bytes, SHA-256 `3258d1cf334c6afc95f22aa9c292436cb976b391e0437f1359c83b84f0cb9d66`; lockfile SHA-256 unchanged.
- Focused account/public/admin contrast, reflow, mobile, forced-colors, and geometry reruns all passed.
- Diff whitespace and Prettier checks passed for changed formatted files; canonical precision in the design-token authority was preserved.

## Post-Source-Correction Replay

- Replayed Plan 03-61 after the public and hero evidence owner corrections `473aa9b`, `2b9b935`, `dc650b8`, `40c85a2`, `bc2d32b`, and `395647f`, followed by the scoped W07 evidence correction `29b3013` and its owner record `8a94091`.
- Permanent candidate selection passed 1 test and proved exactly 25 unique W01-W18/G01-G07 project/ID pairs.
- The default-off candidate update proof skipped its single test as intended; no `--update-snapshots` command was run.
- The focused W07/W08/W09 release, status, channel, and geometry replay passed 7 tests with 56 intentional project/axis skips.
- The ordinary candidate-aware public/account/admin/accessibility matrix passed 55 tests with 263 intentional project/axis skips.
- The exact unfiltered motion contract passed 5 tests with 40 intentional project/axis skips.
- No application source, evidence harness, manifest, archive, candidate screenshot, package, or lockfile changed during this replay. The unrelated untracked `apps/desktop/src-tauri/gen/` directory was preserved untouched.

## Post-W12-Correction Replay

- Replayed Plan 03-61 after `6d05c1b` bound W12 capture to the canonical account state and `d169fc2` recorded that Plan 03-62 correction.
- The permanent dry-list contract passed 1 test and proved exactly 25 unique project/ID pairs with no duplicate or extra W01-W18/G01-G07 selection.
- The live candidate-aware browser matrix passed all 25 tests with no skips or failures: 12 public candidates across four projects, 8 account candidates across five projects, and 5 admin candidates across two projects. W12 passed on `account-final-wide-1280`.
- The exact unfiltered motion contract started all required origins and passed 5 tests with 40 intentional project/axis skips.
- The web-evidence TypeScript check, focused harness/manifest Prettier check, and `git diff --check` passed.
- Snapshot update mode was never enabled. No application source, evidence harness, manifest, archive, candidate screenshot, approval/publication artifact, package, or lockfile changed; the unrelated untracked `apps/desktop/src-tauri/gen/` directory remained untouched.

## Post-W10-Correction Replay

- Replayed Plan 03-61 after `47eca40` clarified the W10 identity preview boundary and `fe953b4` recorded that Phase 03-58 correction.
- The permanent dry-list contract passed 1 test and again proved exactly 25 unique W01-W18/G01-G07 project/ID pairs.
- The candidate-aware browser matrix passed all 25 tests with no skips or failures: 12 public, 8 account, and 5 admin candidates. W10 passed on its owning `account-final-desktop-960` project.
- The exact unfiltered motion contract started public, account, and admin and passed 5 tests with 40 intentional project/axis skips.
- The web-evidence TypeScript check, focused harness/manifest Prettier check, and `git diff --check` passed.
- Snapshot update mode was never enabled. No source, harness, manifest, archive, candidate screenshot, approval/publication artifact, package, or lockfile changed; the unrelated untracked `apps/desktop/src-tauri/gen/` directory remained untouched.

## Known Stubs

None - no placeholder, TODO, FIXME, empty UI data source, or future-only stub was introduced.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness

- Plan 03-62 can capture new pixels against exact candidate identities and executable UI/accessibility contracts.
- Plan 03-62's exact update command is now the sole writer and will target exactly W01-W18/G01-G07; the proof-only verification did not consume that update.
- Playwright now enumerates those 25 candidates exactly once under their manifest projects before any runtime execution; no real update command was used for the second correction.
- Human approval, UAT verdicts, report promotion, publication, and bundle ownership remain intentionally closed.

## Self-Check: PASSED

- Summary, motion contract, and candidate manifest exist on disk.
- All four RED/GREEN task commits and corrective commits `ee9b2d9` and `922ea82` exist in git history.
- No required file or commit is missing.

---

_Phase: 03-complete-web-experience_
_Completed: 2026-08-01_
