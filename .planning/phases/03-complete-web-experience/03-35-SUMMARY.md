---
phase: 03-complete-web-experience
plan: '35'
subsystem: web-evidence
tags: [playwright, nextjs, error-routing, localization, evidence, security]

requires:
  - phase: 03-33
    provides: closed bilingual account 403/404/410/500 routing
  - phase: 03-34
    provides: closed bilingual admin 403/404/410/500 routing
  - phase: 03-30
    provides: independently served public, account, and admin Playwright origins
provides:
  - Browser-observed W17 proof for all 24 canonical surface/status/locale outcomes
  - Closed deterministic route-reachability contract with atomic surface-slice writes
  - Source-bound privacy-safe evidence for response, semantic state, localization, recovery, redaction, and authority
  - Post-03-66 owner correction with current public, account, and admin Playwright source fingerprints
affects: [03-36, WEB-01, WEB-08, phase-03-verification]

tech-stack:
  added: []
  patterns:
    - Derive error observation identities from canonical webRoutes crossed with WEB_LOCALES
    - Persist bounded booleans, statuses, paths, identifiers, and SHA-256 fingerprints instead of rendered text
    - Merge only complete validated surface slices and promote evidence after the exact 24-item set closes

key-files:
  created:
    - tooling/web-evidence/src/route-reachability.ts
    - tooling/web-evidence/src/route-reachability.test.ts
    - quality/evidence/phase-03/web/route-reachability.json
  modified:
    - tooling/web-evidence/tests/public.spec.ts
    - tooling/web-evidence/tests/account.spec.ts
    - tooling/web-evidence/tests/admin.spec.ts

key-decisions:
  - 'Canonical webRoutes and WEB_LOCALES are the only authority for the 24 expected W17 observation identities.'
  - 'Reachability evidence stores only bounded outcomes and content/source SHA-256 values; raw browser text and diagnostics never cross the durable evidence boundary.'
  - 'A complete surface slice replaces only that surface, and status becomes passed only when all three current-source-bound slices form the exact closed set.'
  - 'When owning Playwright specs change without changing validated route outcomes, refresh the proof only through the canonical Plan 03-35 writer; never hand-edit generated evidence.'

patterns-established:
  - 'Browser reachability: assert response, unchanged URL, semantic code, exact localized H1, redaction, live recovery, and disconnected authority before hashing content.'
  - 'Evidence lifecycle: atomic temporary write plus rename, deterministic surface/route/locale sort, and current canonical/spec hash verification.'

requirements-completed: [WEB-01, WEB-08]

duration: 15min
completed: 2026-07-31
status: complete
---

# Phase 03 Plan 35: Browser-Observed Error Route Reachability Summary

**All 24 canonical public, account, and admin error outcomes are now proven through real bilingual browser navigation with deterministic, source-bound, privacy-safe evidence.**

## Performance

- **Duration:** 15 min
- **Started:** 2026-07-31T17:10:49Z
- **Completed:** 2026-07-31T17:25:19Z
- **Tasks:** 3
- **Files modified:** 6

## Accomplishments

- Replaced route-ID enumeration with real Playwright response observations for four semantic statuses, three isolated surfaces, and both supported locales.
- Proved genuine canonical 404 routes return HTTP 404 while authored 403, 410, and 500 states remain reachable HTTP 200 outcomes rather than collapsing to transport failures.
- Asserted unchanged canonical URLs, exact localized H1s, distinct bilingual copy fingerprints, bounded correlations, diagnostic redaction, live same-locale recovery, dead-control absence, and disconnected authority.
- Added a strict evidence validator and atomic writer that derives identities from `webRoutes`, rejects missing/duplicate/foreign/unsafe observations, and binds the final proof to current route and W17 spec hashes.

## Task Commits

Each task was committed atomically:

1. **Task 1 RED: Specify browser route reachability evidence** - `3105b8a` (test)
2. **Task 1 GREEN: Record canonical route reachability** - `ec3567d` (feat)
3. **Task 2: Prove public and account error routes** - `627cc90` (test)
4. **Task 3: Close admin route reachability matrix** - `8573f2b` (test)

## Files Created/Modified

- `tooling/web-evidence/src/route-reachability.ts` - Canonical target projection, closed validator, source hashing, deterministic merge, and atomic evidence writer.
- `tooling/web-evidence/src/route-reachability.test.ts` - RED/GREEN mutation, privacy, closed-set, source-binding, slice-merge, and byte-determinism coverage.
- `tooling/web-evidence/tests/public.spec.ts` - Eight browser-observed public W17 outcomes across PT-BR and English.
- `tooling/web-evidence/tests/account.spec.ts` - Eight browser-observed account W17 outcomes with account-origin recovery and disconnected authority proof.
- `tooling/web-evidence/tests/admin.spec.ts` - Eight browser-observed admin W17 outcomes including distinct canonical 410 behavior.
- `quality/evidence/phase-03/web/route-reachability.json` - Exact passed 24-observation proof with current canonical and spec fingerprints.

## Decisions Made

- Used route owner, surface, ID, pathname template, and locale from the canonical route manifest instead of maintaining an evidence-only route list.
- Required exact response status 404 for semantic 404 and exact response status 200 for the other authored states, preventing route enumeration from satisfying the browser contract.
- Hashed a bounded normalized H1/main-text projection only after all content, recovery, redaction, and authority assertions pass; no rendered copy is persisted.
- Allowed partial evidence to validate only the spec sources represented by its completed surfaces, then required every current spec hash when the final 24-item set is promoted.

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered

- The Playwright production servers continue to emit the existing Next.js standalone-mode advisory while starting successfully through the repository's locked lifecycle command. All three optimized webpack builds, dedicated origins, and browser suites completed normally; no deployment configuration changed.

## TDD Gate Compliance

- RED commit `3105b8a` failed because `route-reachability.js` did not exist.
- GREEN commit `ec3567d` added the minimal closed validator/writer and passed all 21 focused contract tests plus strict TypeScript.
- Subsequent browser tasks consumed the committed contract and could write evidence only after a complete surface slice passed its real runtime assertions.

## Verification

- `rtk pnpm --filter @liiiraa/web-evidence exec vitest run src/route-reachability.test.ts` - PASS, 21/21 focused contract tests.
- Public/account focused Playwright command - PASS, both optimized Next.js webpack builds and all sixteen W17 route outcomes; 4 applicable tests passed and 6 axis-gated tests skipped.
- Admin focused Playwright command - PASS, optimized admin build and all eight W17 route outcomes; 1 applicable test passed and 3 axis-gated tests skipped.
- Exact recorded three-origin Playwright command - PASS, all 24 W17 outcomes; 5 applicable tests passed and 9 axis-gated tests skipped.
- `rtk pnpm --filter @liiiraa/web-evidence check` - PASS, strict NodeNext TypeScript.
- Prettier, `git diff --check`, current source-hash comparison, exact 24-key closed-set comparison, and bounded observation-field scan - PASS.

## Post-03-66 Owner Correction (2026-08-01)

- Reproduced the two routed Plan 03-66 proof-graph failures before regeneration: `completeInput()` returned `ok: false`, and the checked-in canonical-line-endings graph returned `ok: false`.
- Regenerated `quality/evidence/phase-03/web/route-reachability.json` exclusively through `writeRouteReachabilityEvidence`, replacing the complete public, account, and admin slices in canonical order.
- Preserved the canonical route fingerprint and all 24 validated observations byte-for-byte at the field level; only the three stale owning Playwright spec fingerprints changed to their current authoritative SHA-256 values.
- Confirmed a second three-surface writer pass was byte-identical (`3f65be58328468eacfe3ca2f2fce5872926e50e8880ea760a22621b1e5d35e79`) and independently validated with zero diagnostics.
- Focused Phase 3 acceptance returned GREEN (2/2), route-reachability writer/hash/idempotency coverage returned GREEN (21/21), combined route-manifest/reachability coverage returned GREEN (30/30), canonical web-route coverage returned GREEN (18/18), strict TypeScript passed, and the generated JSON passed Prettier.
- No screenshot, product source, route observation, approval state, publication state, or Tauri generated artifact was changed.

## Known Stubs

None. Empty arrays in the changed test/tooling sources are runtime collectors initialized before observations, not unwired UI data or placeholder outcomes.

## Threat Flags

No unmodeled threat surface was introduced. The browser-output and durable-evidence boundaries are declared in the plan threat model; the implementation adds no endpoint, credential channel, external origin, schema migration, authority, or product mutation path.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness

- Plan 03-36 can consume the passed `route-reachability.json` proof instead of trusting W17 route-ID counts.
- WEB-01 and WEB-08 now have independently consumable evidence for real response semantics, bilingual content, recovery, redaction, and authority isolation.
- No blocker remains.

## Self-Check: PASSED

- All six implementation, test, and evidence artifacts plus this summary exist on disk.
- RED `3105b8a`, GREEN `ec3567d`, public/account `627cc90`, and admin `8573f2b` resolve in repository history.
- The evidence contains exactly 24 unique current-source-bound observations and validates as `passed` without unbounded fields.
- Focused contract, TypeScript, formatting, three optimized builds, exact three-origin Playwright matrix, and diff checks passed against the committed implementation.
- The post-03-66 canonical writer replay is byte-idempotent and both previously failing Phase 3 proof-graph acceptance tests pass.

---

_Phase: 03-complete-web-experience_
_Completed: 2026-07-31_
