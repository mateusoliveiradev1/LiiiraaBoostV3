---
phase: 03-complete-web-experience
plan: '19'
subsystem: web-content
tags: [content-admission, minisearch, localization, evidence, security]
requires:
  - phase: 03-12
    provides: generated web document validation
  - phase: 03-14
    provides: canonical route and indexing manifest
provides:
  - fail-closed bilingual repository content admission
  - deterministic SHA-256 content and build identities
  - locale/version/domain/risk/availability-aware public search
  - private, preview, scenario, noindex, and stale-content leak prevention
affects: [03-20, 03-21, 03-22, 03-30, 03-32]
tech-stack:
  added: [minisearch 7.2.0 runtime edge in web-core]
  patterns:
    - generated validation before repository publication
    - admitted canonical-public projection as the only search source
    - stable redacted error codes at content trust boundaries
key-files:
  created:
    - packages/web-core/src/content-admission.ts
    - packages/web-core/src/content-admission.test.ts
    - packages/web-core/src/search.ts
    - packages/web-core/src/search.test.ts
  modified:
    - packages/web-core/src/index.ts
    - packages/web-core/package.json
    - pnpm-lock.yaml
key-decisions:
  - 'Search consumes only a successfully admitted bundle and revalidates route/indexing boundaries before serialization.'
  - 'Stale historical content remains public only as noindex, non-actionable history with a validated canonical current route.'
  - 'Technical punctuation is retained as a full token while punctuation-delimited components are also indexed for natural discovery.'
  - 'Reuse the already-approved exact MiniSearch 7.2.0 lock identity in its owning web-core package without installing a new package identity.'
patterns-established:
  - 'Publication gate: generated schema -> route/evidence/locale/asset review -> frozen deterministic bundle.'
  - 'Search gate: admitted bundle -> canonical-public revalidation -> deterministic MiniSearch serialization.'
requirements-completed: [WEB-01, WEB-02, WEB-03]
duration: 18min
completed: 2026-07-31
status: complete
---

# Phase 03 Plan 19: Repository Content Admission and Public Search Summary

**Fail-closed bilingual content compilation with evidence, review, route, and capture gates feeding a deterministic MiniSearch index that cannot serialize private or preview records.**

## Performance

- **Duration:** 18 min
- **Started:** 2026-07-31T06:37:47Z
- **Completed:** 2026-07-31T06:55:35Z
- **Tasks:** 2
- **Files modified:** 7

## Accomplishments

- Added generated-contract-first repository admission with exact PT-BR/English parity, current review dates, material evidence, canonical route ownership, indexing policy, repository-only sources, and approved screenshot/social sidecars.
- Added deterministic SHA-256 bundle identities, stable ordering, bounded redacted errors, executable-content and generic mutation-recipe rejection, plus non-actionable stale-history handling.
- Added MiniSearch-backed public discovery with diacritic normalization, preserved technical punctuation, boosted identifiers/error codes, explicit filters, stable tie ordering, and authored no-result suggestions.
- Revalidated every bundle at index construction so account, admin, scenario, forged route, nonindex, obsolete, and internal records cannot enter serialized search output.

## Task Commits

Each TDD task was committed with its RED and GREEN gates:

1. **Task 1: Admit only complete truthful repository content**
   - `4f7d308` — test(03-19): add failing content admission coverage
   - `3669bc4` — feat(03-19): admit only truthful repository content
2. **Task 2: Build deterministic public-only search**
   - `c1b7201` — test(03-19): add failing public-only search coverage
   - `a036401` — feat(03-19): build deterministic public-only search

## Files Created/Modified

- `packages/web-core/src/content-admission.ts` — publication input types, fail-closed admission rules, deterministic bundle hashing, stale-history projection.
- `packages/web-core/src/content-admission.test.ts` — bilingual, staleness, evidence, route, asset, executable-content, redaction, and determinism coverage.
- `packages/web-core/src/search.ts` — public-only MiniSearch construction, normalization, filters, ranking, suggestions, and serialized leak gate.
- `packages/web-core/src/search.test.ts` — content-class, bilingual, technical query, filter, ordering, no-result, and leak mutation coverage.
- `packages/web-core/src/index.ts` — public package exports for admission and search contracts.
- `packages/web-core/package.json` — exact MiniSearch 7.2.0 runtime dependency in its owning package.
- `pnpm-lock.yaml` — existing approved MiniSearch identity linked to the web-core importer.

## Decisions Made

- Search never accepts raw repository records; it requires `AdmittedContentBundle` and independently checks canonical route, scenario, owner, indexing, validation, and searchable-route projection integrity.
- Current indexable content must be validated and current. Stale content is admitted only on a canonical noindex history route, loses all actionable claims, and must point at a valid current route.
- Query normalization removes Unicode combining marks for PT-BR discovery while retaining versions, hashes, hardware identifiers, and error-code punctuation as meaningful full tokens.
- MiniSearch 7.2.0 was already approved and locked for Phase 3. The plan reused that exact identity in web-core and performed no package-name or version substitution.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] Declared the existing approved MiniSearch identity in web-core**

- **Found during:** Task 2
- **Issue:** The plan owns `search.ts` in `@liiiraa/web-core`, but MiniSearch was linked only to `apps/web`; strict pnpm resolution could not compile the owning package.
- **Fix:** Added exact `minisearch: 7.2.0` to the web-core manifest and its importer entry using the already-present approved lock identity. No new package identity or lifecycle script was installed.
- **Files modified:** `packages/web-core/package.json`, `pnpm-lock.yaml`
- **Verification:** focused web-core tests/check, supply-chain pin verification, and `web:verify:quick` all pass.
- **Commit:** `a036401`

**Total deviations:** 1 auto-fixed (1 blocking).

**Impact:** Required ownership metadata only; no library version, package source, or architecture boundary was substituted.

## TDD Gate Compliance

- Task 1 RED failed on missing `content-admission.js`, followed by GREEN commit `3669bc4`.
- Task 2 RED failed on missing `search.js`, followed by GREEN commit `a036401`.
- Git history preserves both `test(...)` commits before their corresponding `feat(...)` commits.

## Verification

- `pnpm --filter @liiiraa/web-core test -- --run -t "content admission|public-only search"` — 31 tests passed.
- `pnpm --filter @liiiraa/web-core check` — passed.
- `pnpm supply-chain:check` — 60 pins verified.
- `pnpm web:verify:quick` — checks and tests passed across all seven web packages, including WEB-01/WEB-02 evidence gates.
- Serialized-index leak assertions reject account, admin, scenario, forged searchable-route, noindex, and private-domain mutations.

## Known Stubs

None.

## Issues Encountered

The GSD progress handler correctly calculated 77/90 plans (86%) but left stale
rendered percentage and completed-plan fields in `STATE.md`; those fields were
reconciled to the handler's authoritative result during close-out.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness

- Public pages, documentation, releases, and support plans can now compile authored records through one admission contract and build leak-resistant search from the resulting bundle.
- Plan 03-32 can consume deterministic publication/search evidence from these focused tests and the existing web quick gate.

## Self-Check: PASSED

- All four created implementation/test files exist.
- All four TDD task commits exist in git history.
- Focused admission/search tests, TypeScript check, supply-chain verification, and full web quick verification pass.

---

_Phase: 03-complete-web-experience_
_Completed: 2026-07-31_
