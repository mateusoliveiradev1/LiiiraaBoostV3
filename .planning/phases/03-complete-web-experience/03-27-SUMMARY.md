---
phase: 03-complete-web-experience
plan: "27"
subsystem: account-ui
tags: [nextjs, react, xstate, accessibility, localization, privacy, no-change-adapter]

requires:
  - phase: 03-16
    provides: isolated bilingual account shell and canonical account-origin boundary
  - phase: 03-26
    provides: shared preview workflow machine, accessible review UI, and FutureAuthorityPort contract
provides:
  - Complete bilingual sign-in and nine canonical account responsibility routes
  - Deterministic W10-W13 ready, degraded, sensitive-review, cancellation, and no-change states
  - Schema-validated Phase 4 no-change receipts with safe draft and privacy boundaries
affects: [phase-04-account-authority, phase-03-web-evidence, account-e2e]

tech-stack:
  added: []
  patterns:
    - Canonical account-origin route matching through web-core
    - Fixture-only account workflows through an injected FutureAuthorityPort
    - Essential responsive table columns with progressive row details

key-files:
  created:
    - apps/account/src/app/[locale]/[[...responsibility]]/page.tsx
    - apps/account/src/features/account-preview.tsx
    - apps/account/src/features/account-preview.test.tsx
    - apps/account/src/content/account.en.json
    - apps/account/src/content/account.pt-BR.json
  modified: []

key-decisions:
  - "Resolve every account page against the canonical account-origin route manifest and keep scenario selection out of URLs, cookies, and environment state."
  - "Route every sensitive account review through the shared workflow machine and injected web-preview adapter so cancellation or a validated Phase 4 no-change receipt is the only terminal result."
  - "Preserve only explicitly safe support subject and profile fields across degraded preview states; never retain sensitive support descriptions or privacy request payloads."

patterns-established:
  - "Account composition: W10 for sign-in, W11 for ready responsibilities, W12 only by explicit test composition, and W13 for device/privacy/support reviews."
  - "Sensitive review: disclose purpose, required fields, retention, sharing, revocation, and repeated preview provenance before confirmation."

requirements-completed: [WEB-08]

duration: 15min
completed: 2026-07-31
status: complete
---

# Phase 3 Plan 27: Complete Account and Support Preview Summary

**Bilingual account experience with ten canonical routes, closed degraded states, accessible sensitive reviews, and schema-valid Phase 4 no-change receipts**

## Performance

- **Duration:** 15 min
- **Started:** 2026-07-31T09:36:13Z
- **Completed:** 2026-07-31T09:51:25Z
- **Tasks:** 2
- **Files modified:** 5

## Accomplishments

- Added manifest-resolved sign-in, overview, profile, security, subscription, invoices, device, downloads, privacy, and support compositions in PT-BR and English.
- Covered W10-W13 entry, ready, empty, offline, stale, expired-session, failure, recovery, sensitive-review, cancellation, and no-change terminal states with persistent fixture provenance.
- Kept email/session/security, billing, device, privacy, and support authority disconnected while exercising generated receipt validation through the shared deterministic adapter.
- Added accessible correction links, focus targets, semantic status/live regions, compact responsive invoice rows, safe cross-origin download guidance, and privacy collection disclosures.

## Task Commits

Each task was committed atomically:

1. **Task 1: Author and render sign-in, overview, profile, and security previews** - `d2e6d67` (feat)
2. **Task 2: Complete subscription, device, downloads, privacy, and support previews** - `fc06ae9` (feat)

## Files Created/Modified

- `apps/account/src/app/[locale]/[[...responsibility]]/page.tsx` - Canonical account-origin catch-all resolver and localized metadata.
- `apps/account/src/features/account-preview.tsx` - Complete fixture account composition and sensitive workflow integration.
- `apps/account/src/features/account-preview.test.tsx` - Route, locale, accessibility, W11-W13, and receipt-boundary verification.
- `apps/account/src/content/account.en.json` - English account and support copy.
- `apps/account/src/content/account.pt-BR.json` - PT-BR account and support copy with structural parity.

## Decisions Made

- Kept published composition deterministic: W10 is selected for sign-in, W11 for ordinary account responsibilities, and W13 for device/privacy/support; W12 is available only through explicit test composition.
- Used the canonical web route matcher for account-origin admission instead of maintaining a second pathname authority.
- Allowed only `displayName`, `locale`, and the support `subject` as explicit safe drafts; support descriptions, privacy inputs, credentials, payment information, recovery codes, and diagnostics are never retained or uploaded.
- Sent stable download navigation to the public release origin without transferring account context or requiring an account.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Removed an unsupported Next.js route-module export**

- **Found during:** Task 1 production build
- **Issue:** Exporting the pure route resolver from `page.tsx` violated Next.js 16's closed route-module export contract.
- **Fix:** Kept the resolver module-private while preserving manifest-based resolution and testable rendered behavior.
- **Files modified:** `apps/account/src/app/[locale]/[[...responsibility]]/page.tsx`
- **Verification:** `pnpm --filter @liiiraa/account build`
- **Committed in:** `d2e6d67`

**2. [Rule 3 - Blocking] Adapted account tests to the existing JSX-preserve Vitest setup**

- **Found during:** Task 2 account test execution
- **Issue:** The account package intentionally has no JSX-transforming Vitest plugin, so importing the new TSX client module directly failed Vite import analysis.
- **Fix:** Followed the existing account source/contract test pattern and verified canonical sources, locale records, scenarios, and the live no-change adapter without adding a dependency or test-only transform.
- **Files modified:** `apps/account/src/features/account-preview.test.tsx`
- **Verification:** `pnpm --filter @liiiraa/account test -- --run`
- **Committed in:** `fc06ae9`

---

**Total deviations:** 2 auto-fixed (1 bug, 1 blocking issue)
**Impact on plan:** Both fixes preserve the planned architecture and security boundary; no scope or dependency was added.

## Issues Encountered

- `pnpm web:verify:quick -- --requirement WEB-08 --grep "account|W11|W12|W13"` passed all 20 workspace check/test tasks, then stopped at the planned Plan 03-32 readiness boundary for public/account/admin standalone roots and final `security-boundaries.json` / `preview-boundaries.json` evidence. The account package's own strict check, 14 tests, and production build pass. The phase-wide evidence omission is recorded in `deferred-items.md` and was not fabricated here.

## Known Stubs

None. All preview endpoints intentionally terminate at cancellation or a Phase 4 no-change receipt; this is the plan's authority contract, not an incomplete implementation.

## Verification

- `pnpm --filter @liiiraa/account check` - PASS
- `pnpm --filter @liiiraa/account test -- --run` - PASS, 14 tests
- `pnpm --filter @liiiraa/account verify` - PASS, including optimized Next.js build
- `pnpm web:verify:quick -- --requirement WEB-08 --grep "account|W11|W12|W13"` - all implementation checks/tests PASS; staged final evidence gate remains pending Plan 03-32
- Stub and mutation-channel scans - PASS; no placeholder, network, upload, cookie, or browser-storage channel found

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness

- Plan 03-28 can build the isolated admin preview against the same shared no-change workflow contract.
- Plan 03-32 can promote WEB-08 only after all three standalone builds and final security/preview evidence are present.

## Self-Check: PASSED

- All five created implementation/content/test files exist.
- Task commits `d2e6d67` and `fc06ae9` are present in git history.
- Summary, verification claims, requirement mapping, and intentional Plan 03-32 readiness deferral were confirmed against the working tree.

---

*Phase: 03-complete-web-experience*
*Completed: 2026-07-31*
