---
phase: 03-complete-web-experience
plan: '31'
subsystem: testing
tags: [publication, rollback, sha256, immutable-bundles, vitest, fail-closed]

requires:
  - phase: 03-complete-web-experience
    provides: Canonical routes, repository content, release truth, approved desktop captures, W01-W18 visual evidence, and independent public/account/admin builds
provides:
  - Pure atomic web publication evaluator covering every D-84 release dimension
  - Planned/final repository publication command with exact evidence and build observation rules
  - Deeply immutable approved bundle records bound to independently re-evaluated final publication
  - Safe rollback resolver that returns three-artifact redeploy inputs and excludes external state
affects: [03-32-final-evidence, web-publication, web-rollback, release-gates]

tech-stack:
  added: []
  patterns:
    - Exact build/content/artifact/evidence identity binding with SHA-256 fingerprints
    - Independent final-approval re-evaluation before immutable bundle creation
    - Pure rollback planning with explicit external-state exclusion

key-files:
  created:
    - tooling/web-evidence/src/publication.ts
    - tooling/web-evidence/src/publication.test.ts
    - tooling/web-evidence/src/rollback-bundle.ts
    - tooling/web-evidence/src/rollback-bundle.test.ts
  modified:
    - package.json

key-decisions:
  - 'Require final publication to supply passed gates plus exact observed evidence commands/files and observed independent app artifacts; planned evidence can never promote itself.'
  - 'Re-evaluate the complete final publication inside approved-bundle creation and compare its fingerprint instead of trusting caller-supplied approval state.'
  - 'Limit rollback output to code/content/manifest/asset redeploy inputs and always mark databases, external data, and migrations excluded.'

patterns-established:
  - 'Atomic admission pattern: one evaluator binds all app builds, repository artifacts, locales, captures, visuals, quality manifests, and release truth to one publication identity.'
  - 'Immutable rollback pattern: one integrity-hashed approved record is the only valid prior deployment target; mixed or partial histories fail closed.'

requirements-completed: [WEB-01, WEB-02, WEB-03, WEB-08]

duration: 14min
completed: 2026-07-31
status: complete
---

# Phase 3 Plan 31: Atomic Web Publication and Safe Rollback Summary

**SHA-256-bound atomic publication admission now blocks every incoherent release subset, while rollback resolves only one intact previously approved web bundle and never reverses external state**

## Performance

- **Duration:** 14 min
- **Started:** 2026-07-31T13:13:08.000Z
- **Completed:** 2026-07-31T13:26:27.000Z
- **Tasks:** 2
- **Files modified:** 5

## Accomplishments

- Bound three independent public/account/admin build artifacts and eleven repository artifact classes to one build/content identity, with exact route/link parity, bilingual freshness, approved capture sidecars, W01-W18 visuals, four WEB quality manifests, and Phase 3 blocked-download truth.
- Added stable fail-closed diagnostics for every route, link, contract, schema, type, build, security, privacy, accessibility, responsive, visual, performance, SEO, localization, screenshot, evidence, and E2E mutation.
- Added `web:publication:check -- --mode planned|final`; planned mode hashes repository sources before and after evaluation, while final mode refuses unresolved commands, files, builds, quality manifests, or visuals.
- Created deep-frozen approved bundle records that bind commit, build/content identity, every manifest, assets, evidence, and all three app artifacts to an integrity hash.
- Resolved rollback to redeployment inputs only, rejecting tampered, partial, mixed-version, unapproved, current/faulty, missing-history, external-data, and migration requests.

## Task Commits

Each TDD task was committed through RED then GREEN:

1. **Task 1 RED: Atomic publication contract** - `c05ac4a` (test)
2. **Task 1 GREEN: Atomic web publication evaluator and command** - `3506e4e` (feat)
3. **Task 2 RED: Approved rollback contract** - `32474eb` (test)
4. **Task 2 GREEN: Immutable approval and rollback resolver** - `fc9d9e4` (feat)

## Files Created/Modified

- `tooling/web-evidence/src/publication.ts` - Pure atomic evaluator plus planned/final repository command and source-mutation detection.
- `tooling/web-evidence/src/publication.test.ts` - Complete publication fixture, D-84 mutation matrix, coherence negatives, final-mode refusal, and immutability proof.
- `tooling/web-evidence/src/rollback-bundle.ts` - Independent final approval, deep immutable bundle construction, integrity validation, and pure rollback resolution.
- `tooling/web-evidence/src/rollback-bundle.test.ts` - Positive redeploy plan plus tamper, partial, mixed, unapproved, external-state, and faulty-target negatives.
- `package.json` - Root `web:publication:check` lifecycle command.

## Decisions Made

- Final approval requires both semantic success and exact observation of every build path, evidence file, and evidence command; inferred or merely planned evidence is insufficient.
- Approved bundle creation re-runs publication evaluation and requires the caller fingerprint to match, preventing forged success results from minting rollback authority.
- Rollback records code/content/manifests/assets/evidence together, validates the record integrity hash before resolution, and exposes no execution callback or external-state reversal input.

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered

None.

## Known Stubs

None. Planned evidence states are intentional fail-closed inputs owned by Plan 03-32; final mode demonstrably rejects them.

## TDD Gate Compliance

- RED commits `c05ac4a` and `32474eb` failed because their required modules did not yet exist.
- GREEN commits `3506e4e` and `fc9d9e4` made the focused contracts pass.
- Final verification passed 80 tests with 1 intentional pre-existing skip, strict TypeScript, formatting/lint checks, and planned publication admission.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness

- Plan 03-32 can promote the four WEB quality manifests, supply observed final evidence, and persist the resulting approved publication bundle.
- Final publication remains correctly blocked until Plan 03-32 resolves every file/command/build/visual observation.
- No blockers remain.

## Self-Check: PASSED

- All four implementation/test artifacts and this summary exist on disk.
- Commits `c05ac4a`, `3506e4e`, `32474eb`, and `fc9d9e4` resolve in repository history.
- The complete web-evidence unit suite, strict TypeScript check, planned publication command, formatting, lint, and diff checks passed.
- Final mode was also exercised as a negative gate and rejected all unresolved planned evidence and build observations.

---

_Phase: 03-complete-web-experience_
_Completed: 2026-07-31_
