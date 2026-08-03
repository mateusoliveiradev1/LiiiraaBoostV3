---
phase: 03-complete-web-experience
plan: "68"
subsystem: public-web
tags: [nextjs, acquisition, pricing, responsive, i18n, accessibility]
requires:
  - phase: 03-complete-web-experience
    provides: final bilingual route, entitlement, pricing, and lifecycle contracts from Plan 03-67
provides:
  - Final public acquisition shell with route-preserving flag locale control and one Download CTA
  - Sales-led Home grounded in the real desktop product capture
  - Distinct Product, Results, Compatibility, and purchase-ready Plans experiences
affects: [03-69, 03-70, 03-71, 03-72, public-web, account-conversion, distribution]
tech-stack:
  added: []
  patterns: [real-product-as-proof, route-specific acquisition composition, visible pre-purchase terms]
key-files:
  created:
    - apps/web/src/styles/home.css
  modified:
    - apps/web/src/features/home.tsx
    - apps/web/src/features/public-catalog.tsx
    - apps/web/src/public-navigation.tsx
    - apps/web/src/styles/public.css
key-decisions:
  - "The real desktop capture is the Home hero's largest proof object, while copy and the free-download CTA remain first on mobile."
  - "Compatibility never implies web-based PC inspection; both the route and its CTA send the visitor to the desktop download flow."
  - "Plans exposes billing, payment, refund, cancellation, one-PC/HWID reset, offline, and support terms before the account handoff while disconnected authority remains structured metadata only."
patterns-established:
  - "Each acquisition route owns one customer decision instead of reusing a technical catalog template."
  - "Commercial surfaces use customer-visible truth and keep provenance available through secondary disclosures."
requirements-completed: [WEB-01, WEB-03]
duration: 31min
completed: 2026-08-03
status: complete
---

# Phase 03 Plan 68: Public Acquisition Experience Summary

**A launch-grade public web journey now sells the real Windows product through product proof, credible results, direct compatibility guidance, and a complete Free-versus-Premium purchase decision.**

## Performance

- **Duration:** 31 min
- **Started:** 2026-08-03T01:58:28Z
- **Completed:** 2026-08-03T02:29:30Z
- **Tasks:** 3
- **Files modified:** 10

## Accomplishments

- Rebuilt the public shell around five exact acquisition pillars, one dominant bilingual Download CTA, route-preserving flag locale control, semantic Phosphor icons, and full-width responsive framing.
- Reworked Home into an eight-movement sales narrative with the admitted desktop capture above the fold, player pain, workflow, Essential/Competitive comparison, evidence, restoration, objections, and repeated free entry.
- Gave Product, Results, and Compatibility distinct customer jobs, including the complete bounded Competitive session promise and an explicit desktop-only PC analysis boundary.
- Rebuilt Plans as a real purchase surface with useful Free, exact Premium prices, monthly/annual choice, account handoff, and all commercial/device/support terms visible before confirmation.

## Task Commits

Each task was committed atomically:

1. **Task 1: Finish public shell, navigation, locale, icons, and responsive frame** - `4844790`
2. **Task 2: Recompose Home as a complete sales narrative** - `e6a029a`
3. **Task 3: Finish Product, Results, Compatibility, and Plans decisions** - `b29072e`

Additional verification fix: `fb6c4ec` removed two unnecessary navigation type guards found by the final lint gate.

## Files Created/Modified

- `apps/web/src/styles/home.css` - Route-owned Home geometry, section rhythm, responsive ordering, and mobile controls.
- `apps/web/src/features/home.tsx` - Final sales sequence consuming canonical plan and capture contracts.
- `apps/web/src/features/public-catalog.tsx` - Distinct acquisition routes and purchase-grade plan selection/checkout handoff.
- `apps/web/src/styles/public.css` - Product, results, compatibility, plans, and responsive commercial compositions.
- `apps/web/src/public-navigation.tsx` - Final pillars, route-preserving locale state, and dominant Download action.
- `apps/web/src/app/public-shell.css` - Full-width shell, footer, overflow, and acquisition navigation polish.
- `apps/web/src/home.test.tsx`, `apps/web/src/public-catalog.test.tsx`, `apps/web/src/public-shell.test.ts` - Bilingual sales, commercial, authority, route, and responsive assertions.

## Decisions Made

- Home leads with a real executable desktop capture rather than fabricated performance art, while the H1 and Download action remain reachable before the media on every viewport.
- Product explains analyze/review/apply/prove/restore plus bounded Competitive session behavior; Results owns measurement methodology; Compatibility owns the Windows/download decision.
- Plans uses two comparison surfaces followed by one Premium cycle selector and a visible terms ledger; it performs only a GET navigation to the account origin and makes no charge or remote mutation.
- Provenance and uncertainty remain accessible without dominating the ordinary sales hierarchy.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Removed implicit-grid dead space from Home**

- **Found during:** Task 2 visual verification at 1440×900.
- **Issue:** The player-problem section created an unintended second grid row and a large empty region.
- **Fix:** Assigned explicit grid areas and a compact asymmetric column ratio, with a single-column mobile order.
- **Files modified:** `apps/web/src/styles/home.css`
- **Verification:** Desktop and 390px screenshots plus 22/22 Home tests.
- **Committed in:** `e6a029a`

**2. [Rule 2 - Missing Critical] Hardened billing controls against browser-injected hydration attributes**

- **Found during:** Task 3 live browser verification.
- **Issue:** A browser extension injected caret styling into radio controls before hydration, triggering the Next development error overlay.
- **Fix:** Scoped hydration suppression to the two deterministic billing inputs; no application mismatch is hidden elsewhere.
- **Files modified:** `apps/web/src/features/public-catalog.tsx`
- **Verification:** Fresh desktop/mobile screenshots completed without a new hydration error or overlay.
- **Committed in:** `b29072e`

**3. [Rule 1 - Bug] Removed stale navigation lint violations**

- **Found during:** Final plan lint gate.
- **Issue:** A no-op type assertion and impossible pathname fallback violated the strict lint contract.
- **Fix:** Returned the already-compatible route ID directly and used Next's non-null pathname contract.
- **Files modified:** `apps/web/src/public-navigation.tsx`
- **Verification:** Focused ESLint and 27/27 public-shell tests.
- **Committed in:** `fb6c4ec`

---

**Total deviations:** 3 auto-fixed (2 correctness, 1 missing robustness). **Impact:** All fixes were required to meet the plan's no-dead-space, no-console-error, and strict-quality goals; no billing, auth, device, or distribution authority was introduced.

## Issues Encountered

- An initial visual capture targeted the isolated admin development origin on port 3002. Validation resumed against the already-running public web origin on port 3000; no product code change was required.
- Fast Refresh briefly compared stale and current navigation markup after the Task 1 route change. Fresh page loads and the production build are clean.

## User Setup Required

None - no external service configuration required.

## Verification

- `@liiiraa/web`: 98/98 tests passed.
- TypeScript check passed with no errors.
- Focused ESLint passed for all Plan 03-68 TypeScript/TSX ownership files.
- Next.js 16.2.12 production build compiled, type-checked, generated all static pages, and collected build traces successfully.
- Impeccable detector returned zero findings for Home and acquisition changes.
- Visual inspection passed at 1440×900 and 390×844 for Home and Plans, plus desktop Product, Results, and Compatibility.

## Next Phase Readiness

- Plan 03-69 can finish Download, releases, installer readiness, update channels, and distribution-state UX against a canonical public acquisition path.
- Authentication, billing charge, device binding/reset, and real artifact distribution remain intentionally deferred to their owning phases.

---

*Phase: 03-complete-web-experience*
*Completed: 2026-08-03*
