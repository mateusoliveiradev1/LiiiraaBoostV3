---
phase: 03-complete-web-experience
plan: "58"
subsystem: ui
tags: [nextjs, react, account-workspace, responsive-layout, accessibility, preview-safety, i18n]

requires:
  - phase: 03-57
    provides: exact account shell geometry, canonical navigation, locale projection, and quiet preview truth
provides:
  - task-specific 7/5 and 8/4 account workspaces with one focal action and contextual evidence
  - focal-first mobile reflow with bounded profile and support forms
  - localized loading, empty, offline, stale, expired-session, and retryable-failure presentations
  - unchanged fail-closed no-change workflows with narrow safe-draft retention
  - task-first Overview and human Privacy/degraded copy with canonical route-compatible scenario admission
affects: [03-61, account-visual-evidence, account-uat]

tech-stack:
  added: []
  patterns:
    - explicit focal/context workspace regions with structural mobile order
    - localized deterministic state projection around an unchanged typed workflow machine
    - safe-draft allowlists that exclude privacy and support message payloads
    - canonical scenario registry admission before account state projection

key-files:
  created: []
  modified:
    - apps/account/src/features/account-preview.tsx
    - apps/account/src/features/account-preview.test.tsx
    - apps/account/src/app/account-shell.css
    - apps/account/src/content/account.en.json
    - apps/account/src/content/account.pt-BR.json

key-decisions:
  - "Use focal-first DOM order for every account responsibility, then apply exact 7/5 or 8/4 desktop geometry so mobile requires no semantic reordering."
  - "Expose deterministic account presentation state as a typed optional input while preserving the existing W12 combined degraded-state catalog."
  - "Keep the canonical preview workflow machine unchanged and retain only display name/locale for Profile and subject for Support; Device and Privacy retain no drafts."
  - "Keep the shell as the sole persistent preview-truth owner while ordinary Overview summaries stay task-first and sensitive Privacy/degraded states explain consequences directly."
  - "Admit explicit account scenarios through the canonical registry and route compatibility before rendering; do not expose URL, environment, or browser-controlled scenario selectors."

patterns-established:
  - "Account workspace regions identify focal and contextual responsibility through data-workspace-region without creating a parallel card system."
  - "Degraded state labels are localized human language rendered through text-plus-pattern StatusSignal semantics."
  - "Canonical W12 projection remains independently renderable through a validated typed prop while ordinary account routes default safely."

requirements-completed: [WEB-08]

duration: 32min
completed: 2026-08-01
status: complete
---

# Phase 03 Plan 58: Dense Account Workspaces Summary

**Premium task-first account workspaces with localized human consequence copy, canonical fail-closed scenario admission, and complete responsive degraded-state recovery**

## Performance

- **Duration:** 32 min (17 min initial execution + 15 min rejection correction)
- **Started:** 2026-08-01T17:45:00Z
- **Completed:** 2026-08-01T18:01:56Z
- **Tasks:** 2
- **Files modified:** 5

## Accomplishments

- Recast Overview, Profile, Security, Subscription, Invoices, Device, Downloads, Privacy, and Support as responsibility-specific workspaces with one raised focal task and a quieter contextual evidence region.
- Standardized desktop composition on exact 7/5 or 8/4 splits, capped Profile and Support fields at 560px, filled the available workspace, and made focal content first in mobile DOM order without horizontal page scrolling.
- Added independently reachable localized loading, empty, offline, stale, expired-session, and retryable-failure presentations while retaining the complete combined W12 degraded-state catalog.
- Preserved consent, confirmation, cancellation, and schema-valid no-change receipt journeys without adding remote authority or changing the canonical typed preview machine.
- Kept sensitive retention fail closed: Profile retains display name and locale, Support retains subject only, and Device/Privacy retain no draft payloads.
- Closed the Plan 03-64 W11/G03 rejection by removing the duplicate Overview authority region and all ordinary Overview phase/synthetic implementation prose while preserving its focal actions and responsibility summaries.
- Rewrote Privacy and degraded-state guidance in both locales around availability, purpose, retention, sharing, cancellation, no-change outcome, stale data, and recovery.
- Added canonical registry and route-compatibility admission before scenario rendering; W12 remains independently renderable without a URL, environment, or browser-controlled selector.

## Task Commits

Each TDD gate was committed atomically:

1. **Task 1 RED: focal workspace geometry and mobile order** - `c3cacef` (test)
2. **Task 1 GREEN: responsibility-specific account workspaces** - `a5138a4` (feat)
3. **Task 2 RED: state matrix and safe-draft contracts** - `96a21b7` (test)
4. **Task 2 GREEN: complete localized preview states** - `e5c0f8c` (feat)
5. **Rejection RED: account copy and state contracts** - `2bd13b4` (test)
6. **Rejection GREEN: task-first copy and fail-closed scenario admission** - `68ce7e7` (fix)
7. **Visual correction: remove remaining ordinary synthetic summaries** - `13d5b70` (fix)

## Files Created/Modified

- `apps/account/src/features/account-preview.tsx` - Adds focal/context workspace composition, localized state presentations, and typed state selection while preserving existing workflow authority.
- `apps/account/src/features/account-preview.test.tsx` - Enforces route density, exact geometry, mobile order, state completeness, safe draft retention, cancellation, and validated no-change receipts.
- `apps/account/src/app/account-shell.css` - Provides exact 7/5–8/4 workspace geometry, one E2 focal material, 560px field bounds, structural mobile reflow, and forced-color treatment.
- `apps/account/src/content/account.en.json` - Supplies concise English Overview, Privacy, and degraded recovery outcomes without phase-shaped implementation prose.
- `apps/account/src/content/account.pt-BR.json` - Preserves equivalent PT-BR task, consequence, retention, cancellation, stale, and recovery guidance.

## Decisions Made

- Focal task content owns semantic DOM priority. Desktop columns are a visual projection of that order, so mobile reflow does not require CSS ordering or duplicate markup.
- Permanent account hierarchy uses one raised focal workspace and a plain contextual region; semantic tables, lists, timelines, and disclosures carry detail without identical or nested cards.
- Loading and degraded states are presentation inputs only. The existing deterministic scenarios, adapter, consent flow, cancellation path, and no-change receipt validator remain the authority.
- Status copy is localized human language and continues through `StatusSignal`, which supplies explicit text, a symbol, and a pattern rather than relying on color alone.
- Ordinary Overview relies on the shell's single persistent preview boundary. Route content explains tasks, while Privacy and degraded states retain only consequence-specific no-change guidance.
- `resolveAccountScenarioId` resolves every explicit scenario through the canonical registry and rejects non-account or route-mismatched scenarios before rendering; the canonical page accepts no user-controlled scenario input.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Visual content bug] Removed remaining synthetic/simulated prose from ordinary Overview summaries**
- **Found during:** Post-GREEN W11/G03 visual inspection
- **Issue:** The duplicate limitations region was gone, but reused subscription, device, and support summaries still repeated implementation-shaped preview language beneath the shell truth.
- **Fix:** Rewrote the three responsibility summaries in both locales around the user's actual review task and added a regression assertion covering all ordinary Overview summary copy.
- **Files modified:** `apps/account/src/content/account.en.json`, `apps/account/src/content/account.pt-BR.json`, `apps/account/src/features/account-preview.test.tsx`
- **Verification:** Focused 21-test suite, complete 46-test account suite, TypeScript, production build, formatting, detector, and W11/G03 screenshots passed.
- **Committed in:** `13d5b70`

---

**Total deviations:** 1 auto-fixed bug.
**Impact on plan:** The correction was necessary to satisfy the rejected single-boundary content contract and did not change shell, capture, manifest, or workflow authority.

## Issues Encountered

- The first uncommitted Task 2 RED draft attempted to validate the cancellation receipt through the no-change document validator. It was corrected before the RED commit because the plan requires cancellation to remain distinct and only the no-change terminal receipt to be schema-valid.
- A targeted W11 browser replay still expects the pre-03-57 complementary name `Prévia determinística` while the current shell exposes `Prévia`. This stale shell/harness assertion is recorded in `deferred-items.md` for Plan 03-57; Plan 03-58 did not edit the shell or browser harness. The W13 browser journey passed.

## TDD Gate Compliance

- Task 1 RED `c3cacef` failed on five planned workspace/geometry/mobile-order gaps before GREEN `a5138a4` passed the filtered 9-test gate and complete 17-test suite.
- Task 2 RED `96a21b7` failed only on the missing state-presentation contract before GREEN `e5c0f8c` passed all 18 account preview tests.
- Rejection RED `2bd13b4` failed on five precise copy, W12 projection, and scenario-admission contracts before GREEN `68ce7e7` passed all 21 focused tests.
- Every RED commit precedes its corresponding GREEN commit.

## Known Stubs

None. The empty safe-draft default is an intentional fail-closed workflow boundary, not a UI placeholder.

## Verification

- `rtk pnpm --filter @liiiraa/account exec vitest run` - 46/46 tests passed across account shell, preview, routes, states, and safety journeys.
- `rtk pnpm --filter @liiiraa/account run check` - strict TypeScript passed.
- `rtk pnpm --filter @liiiraa/account run build` - optimized Next.js 16.2.12 production build passed after the temporary W12 inspection harness was restored.
- `rtk prettier --check ...` - all five plan-owned files passed formatting.
- `rtk git diff --check` - passed.
- Impeccable detector on the account preview and bilingual catalogs - zero findings.
- Temporary original-resolution inspection passed for W11 wide, G03 mobile, W13 wide, and W12 wide/mobile without modifying evidence snapshots, visual manifests, or capture mapping.
- Targeted W13 browser workflow passed; the sole W11 stale shell-label assertion is deferred to Plan 03-57 ownership.

## Threat Review

- No endpoint, authentication path, schema, storage channel, upload path, network call, cookie/session mutation, dependency, or file-access surface was introduced.
- Spoofing remains mitigated by validated `remoteStateChanged: false` no-change receipts and consequence-specific truth at sensitive actions.
- Information disclosure remains mitigated by explicit safe-draft allowlists; support message details and all privacy/device payloads are cleared across degraded states.
- Tampering remains mitigated because the existing typed workflow machine and deterministic adapter are unchanged.
- Scenario tampering is additionally constrained by canonical registry lookup and route compatibility before account rendering; the page reads no scenario query, environment, or browser state.

## User Setup Required

None - no external service configuration or package installation required.

## Next Phase Readiness

- Plan 03-62 retains ownership of mapping the bounded W12 candidate capture to the already-renderable canonical degraded projection; Plan 03-58 did not alter capture infrastructure.
- Plan 03-64 can re-inspect W11/G03/W13 after Plan 03-57 closes its stale W11 shell-label assertion and Plan 03-62 selects W12.
- No Plan 03-58 blockers, known stubs, remote authority, or sensitive-data claims remain.

## Self-Check: PASSED

- All five plan-owned implementation/test/content files and this summary exist on disk.
- Initial and correction commits `c3cacef`, `a5138a4`, `96a21b7`, `e5c0f8c`, `2bd13b4`, `68ce7e7`, and `13d5b70` resolve in Git history.
- The focused 21-test and complete 46-test account suites pass after rejection closure.

---
*Phase: 03-complete-web-experience*
*Completed: 2026-08-01*
