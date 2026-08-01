---
phase: 03-complete-web-experience
plan: "42"
subsystem: public-web-evidence
tags: [playwright, visual-regression, accessibility, responsive, public-web]

requires:
  - phase: 03-complete-web-experience
    plan: "37"
    provides: Neutral-focus capture helper and manifest v2
  - phase: 03-complete-web-experience
    plan: "38"
    provides: Artifact-led public Home and visitor-facing chrome
provides:
  - Redesigned neutral-focus W01-W09 and W17 public goldens
  - Wide and mobile G01-G02 artifact-review goldens
  - Bilingual deterministic focus and canonical historical-documentation projection
affects: [03-45, public-visual-review, phase-03-publication]

tech-stack:
  added: []
  patterns:
    - Accessibility assertions precede deterministic focus and scroll neutralization
    - Qualitative captures use the same manifest-bound routes and project axes as canonical evidence

key-files:
  created:
    - tooling/web-evidence/tests/__screenshots__/accessibility-responsive.spec.ts/G01-public-final-wide-1440.png
    - tooling/web-evidence/tests/__screenshots__/accessibility-responsive.spec.ts/G02-public-final-mobile-390.png
  modified:
    - tooling/web-evidence/tests/__screenshots__/accessibility-responsive.spec.ts/W01-public-final-wide-1440.png
    - tooling/web-evidence/tests/__screenshots__/accessibility-responsive.spec.ts/W02-public-final-mobile-390.png
    - tooling/web-evidence/tests/__screenshots__/accessibility-responsive.spec.ts/W03-public-final-wide-1280.png
    - tooling/web-evidence/tests/__screenshots__/accessibility-responsive.spec.ts/W04-public-final-wide-1280.png
    - tooling/web-evidence/tests/__screenshots__/accessibility-responsive.spec.ts/W05-public-final-wide-1280.png
    - tooling/web-evidence/tests/__screenshots__/accessibility-responsive.spec.ts/W06-public-final-desktop-960.png
    - tooling/web-evidence/tests/__screenshots__/accessibility-responsive.spec.ts/W07-public-final-wide-1440.png
    - tooling/web-evidence/tests/__screenshots__/accessibility-responsive.spec.ts/W08-public-final-wide-1440.png
    - tooling/web-evidence/tests/__screenshots__/accessibility-responsive.spec.ts/W09-public-final-wide-1280.png
    - tooling/web-evidence/tests/__screenshots__/accessibility-responsive.spec.ts/W17-public-final-desktop-960.png
    - tooling/web-evidence/tests/accessibility-responsive.spec.ts
    - tooling/web-evidence/tests/public.spec.ts
    - tooling/web-evidence/visual-manifest.json
    - quality/evidence/phase-03/web/route-reachability.json

key-decisions:
  - "Reject pixel-stable captures when their route or composition contradicts the UAT contract; this replaced W04's accidental 404 with the canonical historical document."
  - "Keep the redesigned public Home free of the rejected PUBLIC rail and raw open provenance while retaining localized truthful capture details in disclosure."
  - "Use Playwright's canonical {arg}-{projectName} paths for G01-G02, matching visual-manifest.json and the executable snapshot contract."

requirements-completed: [WEB-01, WEB-02, WEB-03]
duration: 19min
completed: 2026-07-31
status: complete
---

# Phase 03 Plan 42: Public Visual Rebaseline Summary

**Twelve current public goldens now capture the redesigned artifact-led experience with neutral focus, canonical routes, responsive reflow, Axe coverage, and fail-closed release truth.**

## Performance

- **Duration:** 19 min
- **Started:** 2026-08-01T01:15:10Z
- **Completed:** 2026-08-01T01:33:59Z
- **Tasks:** 3
- **Files modified:** 16

## Accomplishments

- Replaced W01-W09 and W17 from current production-built public routes after the keyboard-focus assertion and neutral reset.
- Added G01/G02 wide and mobile artifact-review captures without promoting human approval.
- Confirmed visually that the redesigned Home uses the real desktop artifact as the focal object, canonical compact scale, and tighter pacing without the rejected `PUBLIC` rail or raw open provenance.
- Verified documentation, search, release, integrity, status, and error states for useful hierarchy, localized recovery, and fail-closed download behavior.
- Corrected W04 to capture the declared historical unsupported document instead of silently accepting a visually stable 404.
- Reconciled the durable public route-evidence hash after updating the browser contract.

## Task Commits

1. **Task 1: Replace public W01-W05 baselines** - `390f452`
2. **Task 2: Replace public W06-W09 and W17 baselines** - `56d03c1`
3. **Task 3: Capture artifact-review G01-G02** - `af9dd8b`
4. **Verification repair: Refresh route-evidence binding** - `d8fa32e`

## Decisions Made

- Visual inspection remains authoritative over blind snapshot acceptance: the old rejected composition was not preserved, and the initially captured W04 404 was rejected despite passing screenshot generation.
- The PT-BR and English skip-link matcher is bilingual, and the test establishes a deterministic sequential-focus origin before pressing Tab; the capture still blurs focus only after focus visibility and Axe pass.
- G01/G02 intentionally match the W01/W02 rendered Home at their shared routes/viewports. They are separate review identities, not alternate compositions or human approvals.
- The canonical G filenames are `G01-public-final-wide-1440.png` and `G02-public-final-mobile-390.png`, as generated by the executable Playwright template and declared by `visual-manifest.json`; the `public-home-artifact` names in PLAN frontmatter were non-executable naming drift.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Fixed bilingual and deterministic focus setup**

- **Found during:** Task 1 update pass
- **Issue:** The shared helper matched only the English skip-link name, and an authored auto-focused recovery control could retain the browser's sequential focus origin.
- **Fix:** Added the exact PT-BR label and established `body` as a temporary programmatic focus origin before the keyboard Tab assertion.
- **Files modified:** `tooling/web-evidence/tests/accessibility-responsive.spec.ts`
- **Verification:** W01-W09, W17, G01, G02, and all public W18 accessibility axes passed.
- **Commit:** `390f452`

**2. [Rule 1 - Bug] Replaced W04 accidental 404 with historical guidance**

- **Found during:** Task 1 qualitative inspection
- **Issue:** The visual projector used `/getting-started`, while the admitted historical record is `/legacy-capture`; snapshot update had produced an authored 404 under the W04 identity.
- **Fix:** Corrected both the route projector and visual manifest to the canonical historical URL, then regenerated and visually inspected W04.
- **Files modified:** `tooling/web-evidence/tests/accessibility-responsive.spec.ts`, `tooling/web-evidence/visual-manifest.json`, W04 PNG
- **Verification:** W04 shows persistent historical/unsupported notice, unchanged URL, canonical recovery, metadata, and noindex-backed content; clean replay passed.
- **Commit:** `390f452`

**3. [Rule 3 - Blocking] Removed the rejected PUBLIC-rail assertion**

- **Found during:** Task 1 clean public replay
- **Issue:** `public.spec.ts` still required the exact internal rail rejected by the UAT, so current redesigned code failed the broader public contract.
- **Fix:** Asserted the visitor-facing capture-proof note and explicitly prohibited the rail and `PUBLIC` label in main content.
- **Files modified:** `tooling/web-evidence/tests/public.spec.ts`
- **Verification:** Focused W01 browser contract passed against the redesigned Home.
- **Commit:** `390f452`

**4. [Rule 3 - Blocking] Refreshed route proof after public spec correction**

- **Found during:** Overall Vitest verification
- **Issue:** The immutable route-reachability record remained bound to the pre-correction public spec hash, causing two final-source verification tests to fail closed.
- **Fix:** Re-ran the bounded W17 browser observation after rebinding the current public spec; all 24 existing route observations were preserved.
- **Files modified:** `quality/evidence/phase-03/web/route-reachability.json`
- **Verification:** `@liiiraa/web-evidence` Vitest passed 141/141.
- **Commit:** `d8fa32e`

---

**Total deviations:** 4 auto-fixed (2 bugs, 2 blocking issues).
**Impact on plan:** The fixes made the named evidence truthful and executable; no product authority, dependency, endpoint, release approval, or public download behavior changed.

## Issues Encountered

- The first combined shell command used `&&`, unsupported by the host Windows PowerShell version; subsequent required commands ran separately with RTK and no verification was skipped.
- Next.js emitted its existing standalone-mode advisory while all optimized webpack builds and dedicated test servers started successfully.

## Known Stubs

None. The changed sources contain no TODO/FIXME, placeholder rendering, empty wired data source, or unfinished public UI.

## Verification

- W01-W05 controlled update and clean replay - PASS after W04 route correction.
- W06-W09/W17 controlled update and clean replay - PASS, 5 applicable cases.
- G01/G02 controlled update - PASS, 2 applicable cases.
- Full public visual/accessibility replay - PASS, 18 applicable tests and 144 axis skips; includes W01-W09, W17, G01/G02, Axe, neutral focus, 320px/400% reflow, 200% text, reduced motion, forced colors, CWV, and asset budgets.
- Focused W01 redesigned public contract - PASS; visitor-facing proof remains visible and `PUBLIC` rail is absent.
- Focused W17 bilingual route reachability - PASS; 24 bounded observations remain current.
- `rtk pnpm --filter @liiiraa/web-evidence check` - PASS.
- `rtk pnpm --filter @liiiraa/web-evidence test` - PASS, 141 passed and 1 intentionally skipped.
- Prettier check for modified TypeScript/JSON - PASS.
- All 12 canonical PNGs exist and have non-empty SHA-256 fingerprints.

## Human Approval

Not claimed. Plan 03-45 owns named human review and publication approval for these captures.

## Next Phase Readiness

- Plans 03-43 and 03-44 can produce account/admin rebaselines against the same corrected neutral-focus helper.
- Plan 03-45 can review the manifest-bound public captures without inheriting the rejected pre-redesign Home or the accidental W04 error state.

## Self-Check: PASSED

- All 12 canonical public PNGs exist on disk.
- Commits `390f452`, `56d03c1`, `af9dd8b`, and `d8fa32e` exist in git history.
- Full public replay, strict TypeScript, and 141/141 Vitest verification passed after the final evidence binding.
- Working tree was clean before planning metadata updates.
