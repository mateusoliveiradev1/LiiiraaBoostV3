---
phase: 03-complete-web-experience
plan: "53"
subsystem: ui
tags: [design-tokens, oklch, typography, accessibility, motion, web-fonts]

requires:
  - phase: 03-complete-web-experience
    provides: Revised Cobalt Ignition Bay UI contract and Plan 03-52 visual evidence baseline
provides:
  - Exact typed and CSS Cobalt Ignition Bay token authority
  - Verified local Saira Semi Condensed display font with colocated OFL evidence
  - Executable font-integrity, scale-closure, CTA contrast, forced-color, and motion gates
affects: [03-54, 03-55, 03-56, 03-57, public-web, account, admin, design-system]

tech-stack:
  added: []
  patterns:
    - Canonical OKLCH tokens with deterministic sRGB fallbacks
    - Surface-specific typography roles with direct build-compatible aliases
    - TDD-enforced local font provenance and immutable SHA-256 identity

key-files:
  created:
    - apps/web/public/fonts/saira-semi-condensed-variable.woff2
    - apps/web/public/fonts/OFL-Saira-Semi-Condensed.txt
    - apps/web/public/fonts/OFL-Manrope.txt
    - apps/web/public/fonts/OFL-JetBrains-Mono.txt
  modified:
    - packages/design-tokens/src/index.ts
    - packages/design-tokens/src/tokens.css
    - packages/design-tokens/src/tokens.test.ts

key-decisions:
  - "Admit the official Google Fonts variable Saira artifact backed by Omnibus-Type provenance, pin its SHA-256 identity, and expose only the approved 87.5% stretch at weight 600."
  - "Use dark canvas labels on electric-cobalt CTA states and verify every authored pair after OKLCH-to-linear-sRGB conversion."
  - "Keep existing consumers build-compatible only through direct aliases to the new Cobalt authority, never through retained legacy values."

patterns-established:
  - "Public display type is isolated from product controls through a dedicated --lb-font-display role."
  - "Reduced motion removes translation, entrance scale, stage delay, and animated glow while retaining at most 100ms tone changes."

requirements-completed: [WEB-01, WEB-02, WEB-03, WEB-08]

duration: 16min
completed: 2026-08-01
status: complete
---

# Phase 03 Plan 53: Cobalt Ignition Bay Token Foundation Summary

**Exact OKLCH, material, typography, radius, and motion authority with verified local Saira display bytes and executable WCAG contrast gates**

## Performance

- **Duration:** 16 min
- **Started:** 2026-08-01T15:48:00Z
- **Completed:** 2026-08-01T16:04:47Z
- **Tasks:** 2
- **Files modified:** 7

## Accomplishments

- Admitted the official local variable Saira source with deterministic SHA-256 identity and same-directory OFL evidence for every web font.
- Replaced the rejected universal 13/15/20/28 baseline with exact public, documentation, and product typography contracts using only weights 400 and 600.
- Encoded every Section 8 OKLCH role, sRGB fallback, CTA state pair, E0-E3 material, glow/focus cap, radius, z-index, and forced-color mapping.
- Closed motion to 100/160/200/220/360/480ms roles plus the approved 80ms stage-delay cap, 8px translation cap, and 0.985 entrance-scale floor.
- Preserved account/admin/runtime builds through direct aliases that can no longer retain timid cobalt, purple preview chrome, off-scale motion, or the 28px display ceiling.

## Task Commits

Each TDD gate was committed atomically:

1. **Task 1 RED: font integrity and license gates** - `7e39691` (test)
2. **Task 1 GREEN: verified local web font set** - `4db2cc9` (feat)
3. **Task 2 RED: exact Cobalt token contract** - `261ce2e` (test)
4. **Task 2 GREEN: Cobalt Ignition Bay token authority** - `77d7556` (feat)

## Files Created/Modified

- `apps/web/public/fonts/saira-semi-condensed-variable.woff2` - Official variable Saira artifact used at the approved semi-condensed stretch.
- `apps/web/public/fonts/OFL-Saira-Semi-Condensed.txt` - Reviewable Saira OFL and reserved-name evidence.
- `apps/web/public/fonts/OFL-Manrope.txt` - Colocated approved Manrope OFL.
- `apps/web/public/fonts/OFL-JetBrains-Mono.txt` - Colocated approved JetBrains Mono OFL.
- `packages/design-tokens/src/index.ts` - Typed Cobalt color, type, state, material, radius, focus, glow, z-index, and motion authority.
- `packages/design-tokens/src/tokens.css` - Canonical CSS variables, local font faces, CTA states, aliases, reduced-motion, and forced-color mappings.
- `packages/design-tokens/src/tokens.test.ts` - Exact equality, set-closure, provenance, byte-integrity, and computed contrast gates.

## Decisions Made

- Used the official variable Saira WOFF2 distributed by Google Fonts and backed by the Omnibus-Type source repository; the local family alias fixes the approved 87.5% stretch and exposes weight 600 only.
- Kept OKLCH as canonical source while providing deterministic sRGB fallback values before each modern-color declaration.
- Retained legacy CSS property names only as direct references to canonical roles so existing consumers compile without preserving the rejected visual values.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Test bug] Corrected an over-broad purple-detection assertion**

- **Found during:** Task 2 GREEN verification
- **Issue:** The initial numeric-pattern assertion treated unrelated OKLCH components as forbidden purple hues despite the exact color-object equality already proving the approved palette.
- **Fix:** Reduced the negative assertion to forbidden semantic identities while retaining exact equality for every approved OKLCH value.
- **Files modified:** `packages/design-tokens/src/tokens.test.ts`
- **Verification:** Design-token tests pass 11/11 and still reject any `purple` or `experimental` typed role.
- **Committed in:** `77d7556`

---

**Total deviations:** 1 auto-fixed (1 Rule 1)
**Impact on plan:** The correction removed a false positive without weakening any palette or preview-chrome gate.

## Issues Encountered

- The first RED regex used an unescaped closing brace under Unicode regex mode; it was corrected before the RED gate was accepted so the suite failed only on missing planned behavior.

## TDD Gate Compliance

- Task 1 RED `7e39691` precedes GREEN `4db2cc9`.
- Task 2 RED `261ce2e` precedes GREEN `77d7556`.
- Both RED runs failed on the planned missing contracts, and both GREEN runs passed the complete package suite.

## Known Stubs

None.

## Verification

- `rtk pnpm --filter @liiiraa/design-tokens test` — 11/11 passed.
- `rtk pnpm --filter @liiiraa/design-tokens check` — passed.
- `rtk pnpm --filter @liiiraa/design-system test` — 15/15 passed.
- `rtk pnpm --filter @liiiraa/design-system check` — passed.
- `rtk pnpm web:check` — 10/10 package checks passed.
- ESLint and Prettier checks passed for all modified token sources.

## User Setup Required

None - no external service configuration or package installation required.

## Next Phase Readiness

- Plans 03-54 onward can compose public, account, and admin surfaces from one exact tested Cobalt authority.
- Saira provenance, local loading, allowed weight, and license evidence are fail-closed.
- No blocker remains for downstream surface composition.

## Threat Review

- The planned upstream font trust boundary is mitigated by an exact SHA-256 identity, WOFF2 signature check, official provenance, and colocated OFL evidence.
- Font loading remains repository-local with no third-party runtime request.
- CTA illegibility is blocked by computed contrast for default, loading, hover, pressed, and disabled states.
- No unplanned security-relevant surface was introduced.

## Self-Check: PASSED

- All seven created/modified implementation files and this summary exist.
- All four TDD task commits resolve in Git history.

---
*Phase: 03-complete-web-experience*
*Completed: 2026-08-01*
