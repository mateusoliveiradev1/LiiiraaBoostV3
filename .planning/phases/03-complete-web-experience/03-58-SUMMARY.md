---
phase: 03-complete-web-experience
plan: "58"
subsystem: ui
tags: [nextjs, react, account-workspace, responsive-layout, accessibility, preview-safety]

requires:
  - phase: 03-57
    provides: exact account shell geometry, canonical navigation, locale projection, and quiet preview truth
provides:
  - task-specific 7/5 and 8/4 account workspaces with one focal action and contextual evidence
  - focal-first mobile reflow with bounded profile and support forms
  - localized loading, empty, offline, stale, expired-session, and retryable-failure presentations
  - unchanged fail-closed no-change workflows with narrow safe-draft retention
affects: [03-61, account-visual-evidence, account-uat]

tech-stack:
  added: []
  patterns:
    - explicit focal/context workspace regions with structural mobile order
    - localized deterministic state projection around an unchanged typed workflow machine
    - safe-draft allowlists that exclude privacy and support message payloads

key-files:
  created: []
  modified:
    - apps/account/src/features/account-preview.tsx
    - apps/account/src/features/account-preview.test.tsx
    - apps/account/src/app/account-shell.css

key-decisions:
  - "Use focal-first DOM order for every account responsibility, then apply exact 7/5 or 8/4 desktop geometry so mobile requires no semantic reordering."
  - "Expose deterministic account presentation state as a typed optional input while preserving the existing W12 combined degraded-state catalog."
  - "Keep the canonical preview workflow machine unchanged and retain only display name/locale for Profile and subject for Support; Device and Privacy retain no drafts."

patterns-established:
  - "Account workspace regions identify focal and contextual responsibility through data-workspace-region without creating a parallel card system."
  - "Degraded state labels are localized human language rendered through text-plus-pattern StatusSignal semantics."

requirements-completed: [WEB-08]

duration: 17min
completed: 2026-08-01
status: complete
---

# Phase 03 Plan 58: Dense Account Workspaces Summary

**Premium task-first account workspaces with exact 7/5–8/4 hierarchy, focal-first mobile reflow, and complete localized fail-closed preview states**

## Performance

- **Duration:** 17 min
- **Started:** 2026-08-01T17:45:00Z
- **Completed:** 2026-08-01T18:01:56Z
- **Tasks:** 2
- **Files modified:** 3

## Accomplishments

- Recast Overview, Profile, Security, Subscription, Invoices, Device, Downloads, Privacy, and Support as responsibility-specific workspaces with one raised focal task and a quieter contextual evidence region.
- Standardized desktop composition on exact 7/5 or 8/4 splits, capped Profile and Support fields at 560px, filled the available workspace, and made focal content first in mobile DOM order without horizontal page scrolling.
- Added independently reachable localized loading, empty, offline, stale, expired-session, and retryable-failure presentations while retaining the complete combined W12 degraded-state catalog.
- Preserved consent, confirmation, cancellation, and schema-valid no-change receipt journeys without adding remote authority or changing the canonical typed preview machine.
- Kept sensitive retention fail closed: Profile retains display name and locale, Support retains subject only, and Device/Privacy retain no draft payloads.

## Task Commits

Each TDD gate was committed atomically:

1. **Task 1 RED: focal workspace geometry and mobile order** - `c3cacef` (test)
2. **Task 1 GREEN: responsibility-specific account workspaces** - `a5138a4` (feat)
3. **Task 2 RED: state matrix and safe-draft contracts** - `96a21b7` (test)
4. **Task 2 GREEN: complete localized preview states** - `e5c0f8c` (feat)

## Files Created/Modified

- `apps/account/src/features/account-preview.tsx` - Adds focal/context workspace composition, localized state presentations, and typed state selection while preserving existing workflow authority.
- `apps/account/src/features/account-preview.test.tsx` - Enforces route density, exact geometry, mobile order, state completeness, safe draft retention, cancellation, and validated no-change receipts.
- `apps/account/src/app/account-shell.css` - Provides exact 7/5–8/4 workspace geometry, one E2 focal material, 560px field bounds, structural mobile reflow, and forced-color treatment.

## Decisions Made

- Focal task content owns semantic DOM priority. Desktop columns are a visual projection of that order, so mobile reflow does not require CSS ordering or duplicate markup.
- Permanent account hierarchy uses one raised focal workspace and a plain contextual region; semantic tables, lists, timelines, and disclosures carry detail without identical or nested cards.
- Loading and degraded states are presentation inputs only. The existing deterministic scenarios, adapter, consent flow, cancellation path, and no-change receipt validator remain the authority.
- Status copy is localized human language and continues through `StatusSignal`, which supplies explicit text, a symbol, and a pattern rather than relying on color alone.

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered

- The first uncommitted Task 2 RED draft attempted to validate the cancellation receipt through the no-change document validator. It was corrected before the RED commit because the plan requires cancellation to remain distinct and only the no-change terminal receipt to be schema-valid.

## TDD Gate Compliance

- Task 1 RED `c3cacef` failed on five planned workspace/geometry/mobile-order gaps before GREEN `a5138a4` passed the filtered 9-test gate and complete 17-test suite.
- Task 2 RED `96a21b7` failed only on the missing state-presentation contract before GREEN `e5c0f8c` passed all 18 account preview tests.
- Both RED commits precede their corresponding GREEN commits.

## Known Stubs

None. The empty safe-draft default is an intentional fail-closed workflow boundary, not a UI placeholder.

## Verification

- `rtk pnpm --filter @liiiraa/account test` - 41/41 tests passed across account shell, preview, routes, states, and safety journeys.
- `rtk pnpm --filter @liiiraa/account check` - strict TypeScript passed.
- `rtk pnpm --filter @liiiraa/account build` - optimized Next.js 16.2.12 production build passed.
- `rtk pnpm exec prettier --check ...` - all three plan-owned files passed formatting.
- `rtk git diff --check` - passed.
- Impeccable detector on the account preview and shell CSS - zero findings.

## Threat Review

- No endpoint, authentication path, schema, storage channel, upload path, network call, cookie/session mutation, dependency, or file-access surface was introduced.
- Spoofing remains mitigated by validated `remoteStateChanged: false` no-change receipts and consequence-specific truth at sensitive actions.
- Information disclosure remains mitigated by explicit safe-draft allowlists; support message details and all privacy/device payloads are cleared across degraded states.
- Tampering remains mitigated because the existing typed workflow machine and deterministic adapter are unchanged.

## User Setup Required

None - no external service configuration or package installation required.

## Next Phase Readiness

- Plan 03-61 can capture browser geometry and visual evidence against explicit focal/context markers and deterministic state inputs.
- No blockers, known stubs, remote authority, or sensitive-data claims remain.

## Self-Check: PASSED

- All three plan-owned implementation/test files and this summary exist on disk.
- RED/GREEN commits `c3cacef`, `a5138a4`, `96a21b7`, and `e5c0f8c` resolve in Git history.
- The complete 18-test account preview acceptance suite passes after summary creation.

---
*Phase: 03-complete-web-experience*
*Completed: 2026-08-01*
