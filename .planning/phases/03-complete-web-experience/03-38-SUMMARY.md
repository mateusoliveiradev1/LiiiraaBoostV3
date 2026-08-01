---
phase: 03-complete-web-experience
plan: "38"
subsystem: public-web
tags: [nextjs, react, localization, accessibility, visual-design, evidence]

requires:
  - phase: 03-complete-web-experience
    plan: "37"
    provides: Exact ProductLockup primitive and owner-bound visual scale gate
  - phase: 02-complete-desktop-experience
    provides: Approved Pre-Dawn Flight Deck desktop Home captures
provides:
  - Visitor-facing public chrome with the exact Liiiraa Boost identity
  - Artifact-led bilingual Home with localized progressive capture disclosure
  - Canonical public typography and spacing with resolved Plan 03-38 migration debt
affects: [03-42, public-goldens, public-accessibility, web-evidence]

tech-stack:
  added: []
  patterns:
    - Direct server-safe import of the dedicated ProductLockup module
    - Manifest-bound product evidence with localized on-demand provenance
    - Artifact-first responsive composition on the canonical design scale

key-files:
  created: []
  modified:
    - apps/web/src/app/[locale]/layout.tsx
    - apps/web/src/app/public-shell.css
    - apps/web/src/features/home.tsx
    - apps/web/src/styles/public.css
    - apps/web/src/content/public/home.pt-BR.json
    - apps/web/src/content/public/home.en.json
    - packages/web-features/src/components.tsx
    - packages/web-features/src/components.test.tsx

key-decisions:
  - "The public shell imports the dedicated ProductLockup source directly so the server layout receives exact identity without pulling client-only design-system barrels or changing package manifests."
  - "Real capture metadata remains truthful and localized, but scenario, viewport, and commit details render only inside an accessible details disclosure."
  - "The desktop artifact owns seven of twelve wide-screen columns and moves ahead of supporting prose visually below 960px while semantic copy order remains stable."
  - "Resolved Plan 03-38 token entries remain immutable audit history but are excluded from active migration debt."

requirements-completed: [WEB-01, WEB-02, WEB-03]
duration: 14min
completed: 2026-07-31
status: complete
---

# Phase 03 Plan 38: Public Shell and Artifact-Led Home Summary

**Exact product identity and a manifest-bound desktop capture now lead a compact bilingual public journey with truthful evidence available on demand.**

## Performance

- **Duration:** 14 min
- **Started:** 2026-07-31T23:46:44Z
- **Completed:** 2026-08-01T00:00:18Z
- **Tasks:** 2
- **Files modified:** 11

## Accomplishments

- Replaced the boxed `LB` substitute with the approved `ProductLockup` and removed the permanent internal `PUBLIC` origin rail from ordinary visitor chrome.
- Rebalanced Home to a 5/7 copy-to-artifact composition, placed the real desktop capture first visually on compact screens, and removed the oversized hero floor and sparse section pacing.
- Consolidated trust into one artifact-adjacent statement that distinguishes an approved real capture from its deterministic scenario data without claiming measured gains.
- Moved bounded scenario, viewport, and commit provenance into localized accessible disclosures while retaining complete-screenshot access.
- Returned public Home, shell, catalog, and route-header typography/spacing to the canonical 13/15/20/28 type and 4/8/16/24/32/48/64 rhythm.
- Preserved skip navigation, locale routing, safe links, fail-closed distribution language, forced colors, reduced motion, and PT-BR/English structural parity.

## Task Commits

Each task was committed through its TDD gates:

1. **Task 1 RED: visitor shell contract** - `082dc2f` (test)
2. **Task 1 GREEN: approved visitor chrome** - `08b6d10` (feat)
3. **Task 2 RED: artifact-led Home contract** - `ddd8f09` (test)
4. **Task 2 GREEN: evidence-led Home composition** - `5193072` (feat)

## Files Created/Modified

- `apps/web/src/app/[locale]/layout.tsx` - Exact lockup, localized navigation, and visitor-facing chrome without the internal boundary rail.
- `apps/web/src/app/public-shell.css` - Product lockup presentation, responsive shell behavior, and canonical public spacing/type.
- `apps/web/src/public-shell.test.ts` - Shell identity, boundary-removal, accessibility, locale, safe-link, and responsive contracts.
- `apps/web/src/features/home.tsx` - Localized capture disclosure wiring and concise visitor-facing evidence journey.
- `apps/web/src/styles/public.css` - Dominant artifact composition, compact chapter rhythm, canonical hierarchy, and responsive order.
- `apps/web/src/content/public/home.pt-BR.json` - PT-BR trust statement and capture-disclosure copy.
- `apps/web/src/content/public/home.en.json` - Meaning-equivalent English trust statement and capture-disclosure copy.
- `apps/web/src/home.test.tsx` - Artifact dominance, progressive disclosure, and scale contracts.
- `apps/web/src/home-content.test.ts` - Bilingual provenance-disclosure parity contract.
- `packages/web-features/src/components.tsx` - Accessible localized provenance disclosure for `RealProductStage`.
- `packages/web-features/src/components.test.tsx` - Resolved Plan 03-38 token debt while retaining immutable migration history.

## Decisions Made

- Used the exact Plan 03-37 lockup geometry. No substitute mark, new logo geometry, or package identity was introduced.
- Kept the capture manifest, checksum admission, and complete-screenshot link unchanged; only the presentation priority and metadata disclosure changed.
- Preserved one concise trust statement adjacent to the artifact and kept release unavailability in its dedicated action context instead of repeating internal boundary language throughout Home.
- Applied the Impeccable brand guidance through restrained scale, real imagery, flat structural depth, rare cobalt, compact pacing, and removal of meta-critical visitor copy.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] Kept client-only controls out of the server layout**

- **Found during:** Task 2 production build verification
- **Issue:** Importing `ProductLockup` through the broad web-features component barrel caused Next.js to pull React Aria and `useState` modules into the public Server Component layout.
- **Fix:** Imported the dedicated server-safe `packages/design-system/src/product-lockup.tsx` module directly and removed the temporary broad-barrel re-export. Package manifests and the lockfile remained unchanged.
- **Files modified:** `apps/web/src/app/[locale]/layout.tsx`, `packages/web-features/src/components.tsx`
- **Verification:** `@liiiraa/web` production build completed successfully with webpack and generated all static pages.
- **Committed in:** `5193072`

**2. [Rule 3 - Blocking] Reconciled the owner-bound public token gate**

- **Found during:** Task 2 shared visual-contract verification
- **Issue:** Removing the rejected Home values made the exact Plan 03-38 debt ledger stale; remaining public shell and route-header entries assigned to this plan also kept the gate red.
- **Fix:** Returned all Plan 03-38-owned public declarations to canonical tokens and excluded resolved entries from active debt while retaining them as immutable audit history.
- **Files modified:** `apps/web/src/app/public-shell.css`, `apps/web/src/styles/public.css`, `packages/web-features/src/components.test.tsx`
- **Verification:** `@liiiraa/web-features` components suite passed 9/9 with only Plans 03-39 and 03-41 remaining as active debt owners.
- **Committed in:** `5193072`

---

**Total deviations:** 2 auto-fixed blocking issues.
**Impact on plan:** Both fixes were required for a buildable server boundary and an executable design-contract gate; no dependency, generated contract, public authority, or distribution behavior changed.

## Issues Encountered

- Existing W01 public PNGs still represent the rejected composition. Plan 03-42 intentionally owns the controlled public rebaseline and replay.
- No human visual approval is claimed by this plan; Phase 3 remains open for the required review.

## Known Stubs

None. The scan found only test accumulators and intentional truthful unavailable-state language; no empty or mock data source was introduced into the rendered Home.

## TDD Gate Compliance

- RED commits: `082dc2f`, `ddd8f09`
- GREEN commits: `08b6d10`, `5193072`
- Both RED runs failed for the intended missing identity/composition/disclosure contracts before implementation.

## Verification

- `rtk pnpm --filter @liiiraa/web exec vitest run src/public-shell.test.ts src/home.test.tsx src/home-content.test.ts` - 20 tests passed.
- `rtk pnpm --filter @liiiraa/web-features exec vitest run src/components.test.tsx` - 9 tests passed.
- `rtk pnpm --filter @liiiraa/web test` - all 43 public web tests passed.
- `rtk pnpm --filter @liiiraa/web-features check` - TypeScript passed.
- `rtk pnpm --filter @liiiraa/web check` - TypeScript passed.
- `rtk pnpm --filter @liiiraa/web build` - optimized Next.js webpack production build passed and generated 8/8 static pages.
- Prettier check passed for all modified source, style, content, and test files.
- Package manifests, `pnpm-lock.yaml`, generated contracts, and capture assets have no drift.

## User Setup Required

None.

## Next Phase Readiness

- Plan 03-42 can now refresh the complete affected public golden set from the deterministic artifact-led composition.
- Human review remains blocking before Phase 3 can close; this summary does not mark the phase complete.

## Self-Check: PASSED

- Canonical summary exists on disk.
- All four TDD task commits are present in git history.
- All key modified files and verification claims were confirmed before state advancement.
