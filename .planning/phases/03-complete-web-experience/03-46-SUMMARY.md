---
phase: 03-complete-web-experience
plan: '46'
subsystem: web-evidence
tags: [playwright, vitest, nextjs, accessibility, visual-regression, publication, sha256]

requires:
  - phase: 03-45
    provides: Renewed literal human approval for the current canonical and legacy visual digests
  - phase: 03-76
    provides: Complete route-experience matrix and launch-readiness contract
  - phase: 03-81
    provides: Current 60-route canonical visual manifest and inspected candidates
  - phase: 03-82
    provides: Canonical 24-outcome route-reachability handoff
provides:
  - Exactly three Plan 03-46-owned final evidence artifacts with all unaffected proof owners frozen
  - Approved visual and accessibility reports for 480 canonical and 25 legacy records
  - Current publication evidence bundle bound to UAT, reports, builds, manifests, reachability, and D-102 through D-110
  - Fail-closed distribution, legal, operational, and rollback truth
affects: [phase-04-auth-data, phase-10-release-distribution, web-publication-verification]

tech-stack:
  added: []
  patterns:
    - Content-addressed approval and publication bindings with historical-digest rejection
    - Exact optional evidence projection that omits absent bindings instead of serializing undefined
    - Official-writer refreshes that preserve the original reachability proof owner

key-files:
  created:
    - .planning/phases/03-complete-web-experience/03-46-SUMMARY.md
    - .planning/phases/03-complete-web-experience/visuals/candidate-inspections/03-46-renewed-approval-scope.json
  modified:
    - .planning/phases/03-complete-web-experience/03-UAT.md
    - tooling/web-evidence/src/verify-phase.ts
    - tooling/web-evidence/src/verify-phase.test.ts
    - tooling/web-evidence/src/route-reachability.test.ts
    - tooling/web-evidence/tests/public.spec.ts
    - tooling/web-evidence/tests/account.spec.ts
    - tooling/web-evidence/tests/admin.spec.ts
    - tooling/web-evidence/visual-manifest.json
    - quality/evidence/phase-03/web/route-reachability.json
    - quality/evidence/phase-03/web/visual-report.json
    - quality/evidence/phase-03/web/accessibility-report.json
    - quality/evidence/phase-03/web/approved-publication-bundle.json
    - tooling/web-evidence/tests/__screenshots__/

key-decisions:
  - 'Advance only visual-report, accessibility-report, and approved-publication-bundle to plan-03-46; route reachability remains owned by plan-03-35.'
  - 'Accept only the current canonical and legacy approval digests; prior approval records remain audit history and cannot authorize promotion.'
  - 'Treat finalApproved as internal evidence approval only; public distribution, official artifact availability, and download availability remain false.'
  - 'Keep the legal and operational boundary blocked until supplier identity, commercial acceptance, processors/transfers/retention, monitored contacts, and registration/address are verified.'

patterns-established:
  - 'Evidence promotion fails closed on missing files, stale SHA-256 bindings, historical approval digests, non-passing detector results, or proof-owner drift.'
  - 'Regenerated browser evidence may update source hashes without inheriting or advancing the authority of the original reachability proof.'

requirements-completed: [WEB-01, WEB-02, WEB-03, WEB-08]
duration: 2h 40min
completed: 2026-08-03
status: complete
---

# Phase 03 Plan 46: Approved Publication Evidence Summary

**Current human-approved visual and accessibility evidence is hash-bound to 60 routes, 480 canonical candidates, 25 legacy records, three production builds, and D-102–D-110 while public distribution and official artifact authority remain closed.**

## Performance

- **Duration:** 2h 40min
- **Started:** 2026-08-03T22:54:43Z
- **Completed:** 2026-08-04T01:35:19Z
- **Tasks:** 3
- **Files modified:** 24
- **Full Playwright:** 752 passed, 665 expected skips, 0 failed in 13.9 min

## Accomplishments

- Advanced exactly `visual-report`, `accessibility-report`, and `approved-publication-bundle` to `owner: plan-03-46`, with regression tests freezing every unaffected proof owner.
- Bound renewed literal approval to canonical digest `fa594ae3b2bda7ab2d7bea8e475d45e52ee5e350362c6c9315a62c7199ad4f55` and legacy digest `5c589ac20992b698a1e097ab92f15a7bd9072c8e99a8d01993709b354df341d6`.
- Regenerated visual report `89975b7b5abb14a8285703c3138ec2a65d2072cb56c6dd3d30ce89a0a0b69e54` and accessibility report `a67d4a01ed0c157fee4592b5dee5d0deb751b71c23cdfb431c854e2e194d5290` from observed passing runs.
- Promoted a schema-version-2 bundle binding UAT, route matrix, launch readiness, visual manifest, reachability, both reports, three app artifacts, requirements, and D-102 through D-110.
- Preserved `downloadAvailable: false`, `publicDistributionApproved: false`, `officialArtifact: unavailable`, the blocked legal/operational boundary, and rollback exclusions for databases, external data, and migrations.

## Task Commits

### Task 1: Advance exactly three final proof owners

- `3513b47` — RED: add failing final proof ownership contracts.
- `5510fd6` — GREEN: enforce final evidence ownership bindings.
- `12d0bb2` — RED: reject historical approval digests.
- `6540e75` — GREEN: bind renewed canonical and legacy approval digests.
- `33996df` — RED: require regenerated visual and accessibility report bindings.
- `dcee6f7` — GREEN: enforce regenerated report bindings.

### Task 2: Regenerate approved visual and accessibility reports

- `58511a3` — scope public locale controls by context.
- `2d8c449` — attempted four-pixel ignition-stage correction.
- `ddc7308` — revert the source correction after confirming the approved composition.
- `35cec42` — anchor approved ignition geometry.
- `b1570cd` — bound the approved visible stage area.
- `3084995` — freeze route-reachability ownership.
- `81d62cf` — regenerate reachability source proof through the official writer.
- `f55dcf3` — scope mobile locale assertions to the owning header control.
- `45d298d` — align account proof assertions.
- `64a0d4e` — align admin proof assertions.
- `84ac91f` — recapture exact consent evidence.
- `5e3ddd5` — reopen approval against current evidence digests.
- `f549783` — record renewed human visual approval.
- `3045dc6` — refresh reachability source bindings while preserving `plan-03-35` ownership.
- `46e17a4` — regenerate approved visual and accessibility evidence.

### Task 3: Promote current bundle and pass recursive final verification

- `ca76eeb` — keep optional publication bindings type-safe under strict TypeScript.
- `81d5c0a` — promote approved publication evidence with fail-closed release truth.

## Automated Gate Results

- `rtk pnpm --filter @liiiraa/web-evidence exec vitest run src/verify-phase.test.ts`: 65/65 passed.
- `rtk pnpm web:verify`: passed checks, package tests, public/account/admin builds, 752 Playwright cases, 665 expected skips, and final verification with zero failures.
- `rtk pnpm web:verify:phase -- --mode final`: passed with digest `b4b988a7b695d6616a7e9532bdf2ff3fe7e170d6f93a944833b57e97bd56cf47`; 110 decisions, 60 routes, 24 observed route outcomes, and 18 scenarios.
- `rtk pnpm test`: 49/49 Turbo tasks passed, including 46 architecture tests, 93 desktop tests, and 182 web-evidence tests with one intentional skip.
- Public build ID after the final build: `ojhxdaT88TQKbZS5ZHEaZ`.
- `rtk git diff --check 3513b47^..81d5c0a`: passed.

## Decisions Made

- Only the three final report/bundle artifacts inherit Plan 03-46 authority. The reachability artifact keeps `owner: plan-03-35`, and all other proof owners remain frozen.
- Approval is content-addressed. Historical approval signals and digests are retained for auditability but rejected as current authority.
- The human review approves the observed visual/accessibility evidence, not public distribution. No signed installer, official release artifact, commercial authority, or Phase 10 distribution permission was invented.
- The `impeccable` product register was applied to the evidence translation: reports record only observed visual, accessibility, responsive, motion, forced-color, and localization outcomes without extrapolating qualitative claims.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Corrected stale locale-control ownership assertions**

- **Found during:** Task 2 full browser replay.
- **Issue:** Public assertions conflated deliberate header and footer language controls, and mobile checks did not isolate the primary owning control.
- **Fix:** Scoped assertions by context while preserving one route-retaining switcher in each intended location.
- **Files modified:** `tooling/web-evidence/tests/public.spec.ts`.
- **Verification:** Full Playwright replay passed with no snapshot update.
- **Committed in:** `58511a3`, `f55dcf3`.

**2. [Rule 1 - Bug] Replaced a rejected source nudge with exact approved geometry bounds**

- **Found during:** Task 2 visual-contract replay.
- **Issue:** A four-pixel source adjustment was initially attempted for the ignition stage, but the approved composition required preserving source layout and correcting the evidence contract.
- **Fix:** Reverted the CSS change, then bound the approved top and visible-area ranges in the browser assertions.
- **Files modified:** `apps/web/src/styles/home.css` (net reverted), `tooling/web-evidence/tests/public.spec.ts`.
- **Verification:** Full no-update Playwright replay passed.
- **Committed in:** `2d8c449`, `ddc7308`, `35cec42`, `b1570cd`.

**3. [Rule 3 - Blocking] Refreshed stale reachability source hashes through the official writer**

- **Found during:** Task 2 report regeneration.
- **Issue:** Corrected public/account/admin test sources invalidated three source hashes while the 24 semantic outcomes and original proof authority remained unchanged.
- **Fix:** Regenerated only the source bindings through the canonical writer and added an ownership regression guard.
- **Files modified:** `quality/evidence/phase-03/web/route-reachability.json`, `tooling/web-evidence/src/route-reachability.test.ts`.
- **Verification:** 37 focused reachability/verifier cases and the final recursive verifier passed.
- **Committed in:** `3084995`, `81d62cf`, `3045dc6`.

**4. [Rule 1 - Bug] Recaptured consent evidence and renewed approval against current pixels**

- **Found during:** Task 2 account/admin proof replay.
- **Issue:** Current privacy/consent workflows changed the exact canonical and legacy digests, making the earlier approval historical rather than promotable.
- **Fix:** Corrected proof assertions, recaptured only the affected account privacy candidates plus W13/W18, reopened the approval boundary, and recorded a new literal `aprovado` signal against current digests.
- **Files modified:** account/admin specs, ten screenshot files, `visual-manifest.json`, `03-UAT.md`, renewed approval scope, and launch readiness.
- **Verification:** 480 canonical and 25 legacy records passed the full no-update replay.
- **Committed in:** `45d298d`, `64a0d4e`, `84ac91f`, `5e3ddd5`, `f549783`.

**5. [Rule 3 - Blocking] Made optional evidence bindings compatible with strict TypeScript**

- **Found during:** Task 3 `web:verify` quick typecheck.
- **Issue:** `exactOptionalPropertyTypes` rejected an explicit `undefined` projection, and a missing-binding fixture deleted a statically required field.
- **Fix:** Omitted absent bindings from repository input and narrowed the fixture to a partial binding before deletion.
- **Files modified:** `tooling/web-evidence/src/verify-phase.ts`, `tooling/web-evidence/src/verify-phase.test.ts`.
- **Verification:** strict typecheck, Prettier, 65 verifier tests, `web:verify`, final verifier, and workspace regression passed.
- **Committed in:** `ca76eeb`.

---

**Total deviations:** 5 auto-fixed (3 correctness bugs, 2 blocking issues).
**Impact on plan:** Every deviation was required to make promotion describe the current observed evidence exactly. No proof owner, release authority, network surface, or product capability was broadened.

## Issues Encountered

- The first Task 3 `web:verify` attempt stopped at strict TypeScript before builds or Playwright. The local typing defect was fixed, committed independently, and the entire gate was rerun from the beginning.
- Next.js generated a new public `BUILD_ID` during the final build. Only that observed identifier was refreshed; artifact hashes and the explicit final verifier remained valid.

## Known Stubs

None. The unavailable official artifact, disabled download/public-distribution flags, and blocked legal/operational fields are deliberate fail-closed product truth, not implementation stubs.

## Security and Threat Surface Scan

- No new endpoint, authentication path, schema, privileged operation, or file-access capability was introduced.
- T-03-46-01 through T-03-46-04 are mitigated by current SHA-256 bindings, exact owner regression tests, historical-digest rejection, and preserved release-authority denial.
- No additional threat flags were found beyond the plan threat model.

## User Setup Required

None — no external service configuration is required.

## Next Phase Readiness

- Phase 3 evidence is internally approved and recursively verifiable against current sources and builds.
- Public distribution remains intentionally blocked until a signed official artifact and the outstanding legal/operational facts are independently verified.
- Phase 4 may consume the complete web surface contract without treating the demonstrative account/admin workflows as real authority.

## Self-Check: PASSED

- All five key summary/evidence artifacts exist.
- All 23 Plan 03-46 commits resolve as commits in repository history.
- Summary formatting and the complete automated gate set pass.

---

_Phase: 03-complete-web-experience_
_Completed: 2026-08-03_
