---
phase: 03-complete-web-experience
plan: '32'
subsystem: testing
tags: [acceptance, evidence, vitest, playwright, publication, fail-closed]

requires:
  - phase: 03-complete-web-experience
    provides: W01-W18 evidence, canonical routes and content, blocked release truth, independent app artifacts, and immutable publication/rollback contracts
provides:
  - Final five-dimension evidence for WEB-01, WEB-02, WEB-03, and WEB-08
  - Recursive Phase 3 verifier covering D-01 through D-86, four requirements, 53 routes, 18 scenarios, publication evidence, and forbidden deferred authority
  - Approved Phase 3 publication evidence bundle that preserves blocked public distribution
  - Regression-tested Playwright surface selection for full, focused, and cross-surface verification runs
  - Turbopack-compatible exact source imports across the complete public/account/admin workspace dependency closure
affects: [phase-04, phase-10, web-acceptance, web-publication, web-evidence]

tech-stack:
  added: []
  patterns:
    - Exact final evidence resolution from repository files and terminating commands
    - Stable omission mutation diagnostics with source hash immutability
    - Explicit Playwright target parsing instead of ambient process-argument substring matching
    - Exact raw-source TypeScript import targets with generator-owned generated index output

key-files:
  created:
    - tooling/web-evidence/src/verify-phase.ts
    - tooling/web-evidence/src/verify-phase.test.ts
    - tooling/web-evidence/src/playwright-config.test.ts
    - tooling/web-evidence/src/source-import-resolution.test.ts
    - quality/evidence/phase-03/web/approved-publication-bundle.json
  modified:
    - quality/features/WEB-01.json
    - quality/features/WEB-02.json
    - quality/features/WEB-03.json
    - quality/features/WEB-08.json
    - tooling/web-evidence/playwright.config.ts
    - tooling/contract-generation/src/generate.ts
    - package.json

key-decisions:
  - 'Close Phase 3 only from exact observed evidence for all four WEB requirements while preserving publicDistributionApproved=false and rejecting development artifacts.'
  - 'Treat deferred Phase 4 authority and Phase 10 trusted distribution as forbidden evidence rather than missing Phase 3 scope.'
  - 'Select Playwright web servers only from explicit spec/project targets so ordinary reporter flags cannot suppress required surfaces.'
  - 'Use exact .ts/.tsx specifiers for raw workspace source and preserve real generated JavaScript imports; the contract generator owns its emitted TypeScript index specifier.'

patterns-established:
  - 'Final phase gate: one pure verifier binds decisions, requirements, success criteria, routes, locales, scenarios, captures, independent builds, evidence commands, and publication truth.'
  - 'Omission proof: removing, renaming, duplicating, or mutating any closed source class produces a stable diagnostic without changing source hashes.'

requirements-completed: [WEB-01, WEB-02, WEB-03, WEB-08]

duration: 1h30m
completed: 2026-07-31
status: complete
---

# Phase 3 Plan 32: Final Web Evidence and Recursive Acceptance Summary

**Exact observed WEB-01/02/03/08 evidence now closes Phase 3 through a fail-closed verifier covering 86 decisions, 53 routes, 18 scenarios, three independent builds, and blocked public distribution**

## Performance

- **Duration:** 1h 30m, including interrupted-executor recovery
- **Started:** 2026-07-31T13:35:22.000Z
- **Completed:** 2026-07-31T15:05:00.000Z
- **Tasks:** 2
- **Files modified:** 54

## Accomplishments

- Promoted WEB-01, WEB-02, WEB-03, and WEB-08 to exact final evidence across security, privacy, accessibility, performance, and recovery without claiming a public installer or connected future authority.
- Added `verifyPhase3` and `web:verify:phase -- --mode planned|final`, closing all D-01 through D-86 decisions, four roadmap success criteria, W01-W18 scenarios, bilingual routes/content, captures, release truth, security boundaries, three independent app artifacts, and approved publication evidence.
- Added stable negative coverage for missing, renamed, duplicated, stale, wildcard, unresolved, development-artifact, and deferred-authority mutations while proving verifier inputs remain byte-unchanged.
- Recovered the interrupted execution safely without rewriting its three existing commits and fixed Playwright server selection so bare/reporter-only full runs start public, account, and admin while focused runs remain bounded.
- Rebuilt the ignored admin standalone artifact after removing one stale generated TypeScript build-info cache entry, then passed the final Phase 3 verifier.
- Fixed the live Next 16.2.12 Turbopack failure by replacing nonexistent emitted-JavaScript specifiers with exact raw-source TypeScript targets across contracts, design, web-core, web-features, and web-preview, while retaining real generated JavaScript imports.
- Proved public Turbopack, account dev, and admin dev each serve a locale route with HTTP 200, then rebuilt all three standalone production artifacts.

## Task Commits

The interrupted executor's completed commits were preserved, followed by one bounded recovery commit:

1. **Task 1: Promote final web requirement evidence** - `b145e91` (test)
2. **Task 2 RED: Add failing final phase verifier coverage** - `9f9208d` (test)
3. **Task 2 GREEN: Enforce final phase acceptance gate** - `36b0f6c` (feat)
4. **Recovery fix: Select Playwright surfaces from explicit targets** - `00434c1` (fix)
5. **Recovery fix: Use the supported Playwright stderr mode** - `6edb538` (fix)
6. **Recovery fix: Make workspace source imports Turbopack-compatible** - `52378b8` (fix)

## Files Created/Modified

- `quality/features/WEB-01.json` - Final public product/evidence manifest with exact five-dimension proof.
- `quality/features/WEB-02.json` - Final versioned documentation and contextual-link evidence.
- `quality/features/WEB-03.json` - Final release/integrity evidence preserving blocked download eligibility and no public development artifact.
- `quality/features/WEB-08.json` - Final three-surface isolation, accessibility, privacy, performance, and rollback evidence.
- `tooling/web-evidence/src/verify-phase.ts` - Pure final Phase 3 acceptance evaluator and planned/final repository CLI.
- `tooling/web-evidence/src/verify-phase.test.ts` - Positive closure plus omission, tamper, deferred-authority, recursive command, and source-immutability mutations.
- `quality/evidence/phase-03/web/*.json` - Exact public route, documentation, release, security, accessibility, visual, preview-boundary, and approved-publication proofs.
- `tooling/web-evidence/playwright.config.ts` - Explicit spec/project-based surface selection for browser verification servers.
- `tooling/web-evidence/src/playwright-config.test.ts` - Regression coverage for full, focused, and cross-surface server selection.
- `tooling/web-evidence/src/source-import-resolution.test.ts` - Literal-target regression over the complete raw-source web dependency closure.
- `packages/contracts-ts/src`, `packages/design-system/src`, `packages/design-tokens/src`, `packages/web-core/src`, `packages/web-features/src`, `packages/web-preview/src` - Exact `.ts`/`.tsx` internal source specifiers; real `.js` files remain unchanged.
- `tooling/contract-generation/src/generate.ts` - Generator authority for the Turbopack-compatible generated TypeScript index.
- `package.json` - Root `web:verify:phase` command and recursive web verification reachability.
- `.planning/phases/03-complete-web-experience/deferred-items.md` - Exact repository-wide lint debt observed by the final recursive run.

## Decisions Made

- Final Phase 3 approval requires exact observed evidence files, commands, owners, app artifacts, routes, scenarios, captures, and publication truth; no planned or inferred evidence can promote itself.
- WEB-03 completion means the integrity journey is verified while public download remains unavailable, `publicDistributionApproved=false`, and no development artifact is admitted.
- Real identity, billing, device, support, diagnostic upload, admin mutation, and trusted public distribution remain fail-closed exclusions for Phases 4 and 10.
- Playwright server selection now reads only explicit test/project selectors; unrelated CLI flags are not evidence that a surface can be omitted.
- Raw TypeScript workspace exports must reference files that exist at the literal import path; generated JavaScript validators keep `.js`, while generated TypeScript index output is changed at its generator.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Corrected Playwright web-server selection for ordinary CLI flags**
- **Found during:** Final recursive verification recovery
- **Issue:** The existing selector scanned every process argument, so reporter-only or other ordinary flags could produce an empty selected-surface set and launch no app servers.
- **Fix:** Extracted a pure selector that admits only explicit spec/project targets, defaults bare/reporter-only runs to all surfaces, and preserves focused/cross-surface behavior.
- **Files modified:** `tooling/web-evidence/playwright.config.ts`, `tooling/web-evidence/src/playwright-config.test.ts`
- **Verification:** 3 focused regression tests and the complete 100-test web-evidence unit suite pass.
- **Committed in:** `00434c1`

**2. [Rule 3 - Blocking] Regenerated the missing admin standalone artifact**
- **Found during:** `pnpm web:verify:phase -- --mode final`
- **Issue:** Final verification correctly rejected the absent `apps/admin/.next/standalone`; the build was blocked by a stale ignored `.next/cache/.tsbuildinfo` containing slash-inconsistent Windows paths.
- **Fix:** Removed only that generated cache file and rebuilt `@liiiraa/admin`, producing the required standalone artifact without source changes.
- **Files modified:** Ignored generated files under `apps/admin/.next/` only.
- **Verification:** Admin production build passed and final Phase 3 verification reported 86 decisions, 53 routes, and 18 scenarios.
- **Committed in:** Not committed; generated build output is intentionally ignored.

**3. [Rule 3 - Blocking] Restored the Playwright configuration type contract**
- **Found during:** Full web production build
- **Issue:** Playwright 1.62 accepts `stderr: 'ignore' | 'pipe'`; the inherited dirty configuration used unsupported `stderr: 'inherit'`, blocking the web-evidence TypeScript build.
- **Fix:** Preserved the interrupted executor's intended `stderr: 'pipe'` setting after verifying it against the installed Playwright types.
- **Files modified:** `tooling/web-evidence/playwright.config.ts`
- **Verification:** `pnpm --filter @liiiraa/web-evidence build` and the complete `pnpm web:build` graph pass.
- **Committed in:** `6edb538`

**4. [Rule 1 - Bug] Fixed raw workspace source resolution under Next Turbopack**
- **Found during:** User-reproduced public development server failure
- **Issue:** Raw TypeScript workspace packages referenced nonexistent emitted `.js` siblings. Webpack's `extensionAlias` masked the mismatch, but Next 16.2.12 Turbopack correctly failed at the literal path, first in web-core and then in transitive contracts/design packages.
- **Fix:** Converted handwritten internal imports to exact `.ts`/`.tsx` targets across the full web dependency closure, retained imports of real generated `.js` validators, updated the contract generator's TypeScript index template, regenerated its output, and added a literal-target regression test.
- **Files modified:** Contracts, design-system, design-tokens, web-core, web-features, web-preview source imports; `tooling/contract-generation/src/generate.ts`; `tooling/web-evidence/src/source-import-resolution.test.ts`.
- **Verification:** Contract drift passes; all six package type checks/tests pass; public Turbopack, account dev, and admin dev locale routes return HTTP 200; all three standalone production builds pass.
- **Committed in:** `52378b8`

---

**Total deviations:** 4 auto-fixed (2 bugs, 2 blocking verification/build issues)
**Impact on plan:** Both fixes were required to execute the acceptance gate reliably; neither broadened product authority, routes, dependencies, or distribution scope.

## Issues Encountered

- `pnpm verify` passed the workspace toolchain contract and formatting gate, then stopped at the unchanged repository-wide ESLint gate with 68 pre-existing errors in prior-plan account, admin, public-web, contract, and web-evidence files. The root graph therefore did not reach its web verifier subprocess. The complete web-evidence unit suite, workspace package checks, production web build, live dev smokes, and exact final phase verifier pass independently. The unrelated lint debt is recorded in `deferred-items.md` and was not modified.

## Known Stubs

None. Unavailable official distribution and disconnected future authority are intentional, verifier-enforced Phase 3 safety contracts rather than incomplete wiring.

## Threat Flags

None. This plan adds an offline evidence/acceptance boundary only; it introduces no network endpoint, authentication path, file-write authority, schema migration, or product mutation surface.

## TDD Gate Compliance

- RED commit `9f9208d` introduced the final source coverage, omission, recursive-reachability, and forbidden-authority expectations before implementation.
- GREEN commit `36b0f6c` implemented `verifyPhase3`, the final repository command, publication proofs, and root command reachability.
- Recovery commit `00434c1` added a focused regression test together with the minimal Playwright selector correction.
- Recovery commits `6edb538` and `52378b8` restored recursive build compatibility and added source-resolution regression coverage without changing product behavior.

## Verification Results

- `pnpm test:acceptance-policy -- --mode final` - PASS, 50 tests.
- `pnpm --filter @liiiraa/web-evidence test -- --run -t "final source coverage|omission|recursive gate"` - PASS; complete package result 100 passed, 1 intentional Playwright-owned skip.
- `pnpm --filter @liiiraa/web-evidence exec vitest run src/playwright-config.test.ts` - PASS, 3 tests.
- `pnpm --filter @liiiraa/web-evidence exec vitest run src/source-import-resolution.test.ts` - PASS across contracts, design, web-core, web-features, and web-preview raw-source packages.
- `pnpm --filter @liiiraa/web-evidence typecheck` - PASS.
- `pnpm contracts:check` - PASS, 9 generated artifacts match their owning sources.
- Contracts/design/web-core/web-features/web-preview checks and tests - PASS: 37, 7, 12, 97, 27, and 15 tests respectively.
- Live dev smoke - PASS: public Turbopack `/pt-BR`, account `/pt-BR/sign-in`, and admin `/pt-BR/admin` each returned HTTP 200.
- `pnpm web:build` - PASS, 10/10 tasks including public, account, admin, and web-evidence builds.
- Scoped ESLint over the Plan 03-32 verifier, Playwright regression, source resolver, generator, and package indexes - PASS.
- `pnpm web:verify:phase -- --mode final` - PASS, fingerprint `0fab57158895e5ee5ab6b272916270df4821be16e834454c773deae0272f6ba6`, 86 decisions, 53 routes, 18 scenarios.
- Source hash recheck - PASS; verifier and Playwright source hashes were unchanged before/after final verification.
- `pnpm verify` - BLOCKED by 68 pre-existing out-of-scope ESLint errors after toolchain and formatting passed; deferred without scope expansion.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness

- Phase 3's four requirements, locked decisions, route/content/release boundaries, three app artifacts, and publication evidence are closed by the direct final verifier.
- Phase 4 can connect identity, commerce, devices, support, and governed administration only through the preserved generated contracts and explicit security gates.
- Phase 10 remains responsible for publicly trusted signed distribution; Phase 3 exposes no downloadable installer.
- Repository-wide ESLint debt remains a quality concern for its owning prior-plan files but does not alter the final Phase 3 evidence verdict.

## Self-Check: PASSED

- All ten declared key evidence, verifier, regression, manifest, and summary files exist on disk.
- Commits `b145e91`, `9f9208d`, `36b0f6c`, `00434c1`, `6edb538`, and `52378b8` resolve in repository history.
- No plan commit deleted tracked files, and `git diff --check` reports no whitespace errors.
- Stub scan found no TODO, FIXME, placeholder, or coming-soon marker in Plan 03-32 verifier/evidence outputs.
- Final source hashes, direct phase verification, contract drift, package tests, dev route smokes, and all web production builds passed; the only unresolved recursive result is the documented pre-existing 68-error root ESLint backlog.

---

_Phase: 03-complete-web-experience_
_Completed: 2026-07-31_
