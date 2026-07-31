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
  - Turbopack-compatible exact imports in raw web/design source with NodeNext-compatible emitted JavaScript specifiers in shared contracts
affects: [phase-04, phase-10, web-acceptance, web-publication, web-evidence]

tech-stack:
  added: []
  patterns:
    - Exact final evidence resolution from repository files and terminating commands
    - Stable omission mutation diagnostics with source hash immutability
    - Explicit Playwright target parsing instead of ambient process-argument substring matching
    - Boundary-specific imports: literal TypeScript targets for raw web/design source and emitted JavaScript specifiers for NodeNext contract consumers
    - Package-qualified Turbo ordering for tests that destructively rebuild a shared distributable

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
    - tooling/web-evidence/src/source-import-resolution.test.ts
    - tooling/architecture-tests/src/check-workspace.test.ts
    - tooling/architecture-tests/src/policy.test.ts
    - tooling/fixture-guard/src/fixture-guard.test.ts
    - apps/desktop/src/app.test.tsx
    - turbo.json
    - package.json

key-decisions:
  - 'Close Phase 3 only from exact observed evidence for all four WEB requirements while preserving publicDistributionApproved=false and rejecting development artifacts.'
  - 'Treat deferred Phase 4 authority and Phase 10 trusted distribution as forbidden evidence rather than missing Phase 3 scope.'
  - 'Select Playwright web servers only from explicit spec/project targets so ordinary reporter flags cannot suppress required surfaces.'
  - 'Use exact .ts/.tsx specifiers only in raw web/design source; shared NodeNext contracts and their generator retain emitted .js specifiers for compiling consumers.'

patterns-established:
  - 'Final phase gate: one pure verifier binds decisions, requirements, success criteria, routes, locales, scenarios, captures, independent builds, evidence commands, and publication truth.'
  - 'Omission proof: removing, renaming, duplicating, or mutating any closed source class produces a stable diagnostic without changing source hashes.'

requirements-completed: [WEB-01, WEB-02, WEB-03, WEB-08]

duration: 2h
completed: 2026-07-31
status: complete
---

# Phase 3 Plan 32: Final Web Evidence and Recursive Acceptance Summary

**Exact observed WEB-01/02/03/08 evidence now closes Phase 3 through a fail-closed verifier covering 86 decisions, 53 routes, 18 scenarios, three independent builds, and blocked public distribution**

## Performance

- **Duration:** 2h, including interrupted-executor and post-close regression recovery
- **Started:** 2026-07-31T13:35:22.000Z
- **Completed:** 2026-07-31T15:34:59.000Z
- **Tasks:** 2
- **Files modified:** 59

## Accomplishments

- Promoted WEB-01, WEB-02, WEB-03, and WEB-08 to exact final evidence across security, privacy, accessibility, performance, and recovery without claiming a public installer or connected future authority.
- Added `verifyPhase3` and `web:verify:phase -- --mode planned|final`, closing all D-01 through D-86 decisions, four roadmap success criteria, W01-W18 scenarios, bilingual routes/content, captures, release truth, security boundaries, three independent app artifacts, and approved publication evidence.
- Added stable negative coverage for missing, renamed, duplicated, stale, wildcard, unresolved, development-artifact, and deferred-authority mutations while proving verifier inputs remain byte-unchanged.
- Recovered the interrupted execution safely without rewriting its three existing commits and fixed Playwright server selection so bare/reporter-only full runs start public, account, and admin while focused runs remain bounded.
- Rebuilt the ignored admin standalone artifact after removing one stale generated TypeScript build-info cache entry, then passed the final Phase 3 verifier.
- Fixed the live Next 16.2.12 Turbopack failure with exact raw-source TypeScript targets in design/web packages while preserving emitted `.js` specifiers in the shared NodeNext contract package and generator.
- Closed the post-recovery TS5097 regression for emitting desktop consumers and made the 49-task root test graph deterministic across live architecture scans and destructive fixture builds.
- Proved public Turbopack, account dev, and admin dev each serve a locale route with HTTP 200, then rebuilt all three standalone production artifacts.

## Task Commits

The interrupted executor's completed commits were preserved, followed by bounded recovery commits and one post-close regression commit:

1. **Task 1: Promote final web requirement evidence** - `b145e91` (test)
2. **Task 2 RED: Add failing final phase verifier coverage** - `9f9208d` (test)
3. **Task 2 GREEN: Enforce final phase acceptance gate** - `36b0f6c` (feat)
4. **Recovery fix: Select Playwright surfaces from explicit targets** - `00434c1` (fix)
5. **Recovery fix: Use the supported Playwright stderr mode** - `6edb538` (fix)
6. **Recovery fix: Make workspace source imports Turbopack-compatible** - `52378b8` (fix)
7. **Regression fix: Preserve the NodeNext contract boundary and recursive test graph** - `ee515aa` (fix)

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
- `tooling/web-evidence/src/source-import-resolution.test.ts` - Recursive literal-target regression for raw web/design source plus NodeNext emitted-specifier and generator checks for contracts.
- `packages/contracts-ts/src` - NodeNext-compatible emitted `.js` specifiers, including the generated public index.
- `packages/design-system/src`, `packages/design-tokens/src`, `packages/web-core/src`, `packages/web-features/src`, `packages/web-preview/src` - Exact `.ts`/`.tsx` internal raw-source specifiers; web-core imports contract types through the generated type-only boundary.
- `tooling/contract-generation/src/generate.ts` - Generator authority for the emitted `./models.js` TypeScript index specifier.
- `turbo.json` - Serializes fixture-guard after desktop tests so distributable rebuilds cannot invalidate concurrent package resolution.
- `tooling/architecture-tests/src`, `tooling/fixture-guard/src`, `apps/desktop/src/app.test.tsx` - Current graph expectations, bounded Windows integration timeouts, and effective-scale assertions used by the recursive root suite.
- `package.json` - Root `web:verify:phase` command and recursive web verification reachability.
- `.planning/phases/03-complete-web-experience/deferred-items.md` - Exact repository-wide lint debt observed by the final recursive run.

## Decisions Made

- Final Phase 3 approval requires exact observed evidence files, commands, owners, app artifacts, routes, scenarios, captures, and publication truth; no planned or inferred evidence can promote itself.
- WEB-03 completion means the integrity journey is verified while public download remains unavailable, `publicDistributionApproved=false`, and no development artifact is admitted.
- Real identity, billing, device, support, diagnostic upload, admin mutation, and trusted public distribution remain fail-closed exclusions for Phases 4 and 10.
- Playwright server selection now reads only explicit test/project selectors; unrelated CLI flags are not evidence that a surface can be omitted.
- Raw web/design TypeScript exports must resolve at literal source paths, while NodeNext contract source intentionally names emitted `.js` targets; the generator is the authority for that split.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Corrected Playwright web-server selection for ordinary CLI flags**

- **Found during:** Final recursive verification recovery
- **Issue:** The existing selector scanned every process argument, so reporter-only or other ordinary flags could produce an empty selected-surface set and launch no app servers.
- **Fix:** Extracted a pure selector that admits only explicit spec/project targets, defaults bare/reporter-only runs to all surfaces, and preserves focused/cross-surface behavior.
- **Files modified:** `tooling/web-evidence/playwright.config.ts`, `tooling/web-evidence/src/playwright-config.test.ts`
- **Verification:** 3 focused regression tests and the complete 102-test web-evidence unit suite pass.
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

**4. [Rule 1 - Bug] Fixed raw web/design source resolution under Next Turbopack**

- **Found during:** User-reproduced public development server failure
- **Issue:** Raw TypeScript workspace packages referenced nonexistent emitted `.js` siblings. Webpack's `extensionAlias` masked the mismatch, but Next 16.2.12 Turbopack correctly failed at the literal path, first in web-core and then in transitive contracts/design packages.
- **Fix:** Converted handwritten internal imports in the raw design/web packages to exact `.ts`/`.tsx` targets, retained imports of real generated `.js` validators, and added a literal-target regression test. The subsequent recovery below narrowed this rule so the NodeNext contract boundary retains emitted `.js` specifiers.
- **Files modified:** Design-system, design-tokens, web-core, web-features, and web-preview source imports; `tooling/web-evidence/src/source-import-resolution.test.ts`.
- **Verification:** All affected package checks/tests pass; public Turbopack, account dev, and admin dev locale routes return HTTP 200; all three standalone production builds pass.
- **Committed in:** `52378b8`

**5. [Rule 1 - Bug] Preserved emitted specifiers at the NodeNext contract boundary**

- **Found during:** Post-close recursive regression verification
- **Issue:** Applying literal `.ts` targets to `packages/contracts-ts` fixed raw Turbopack resolution but caused TS5097 failures in emitting consumers such as the desktop production reference. The generated contract index and its generator also no longer described the emitted JavaScript module graph.
- **Fix:** Restored `.js` specifiers throughout contract source and its generator, routed web-core contract types through the generated package boundary, and expanded the import-resolution regression to enforce both sides of the split.
- **Files modified:** `packages/contracts-ts/src`, `packages/web-core/src`, `tooling/contract-generation/src/generate.ts`, `tooling/web-evidence/src/source-import-resolution.test.ts`.
- **Verification:** Contract drift, the desktop production-reference build, all web production builds, live Turbopack smokes, and the recursive root test graph pass.
- **Committed in:** `ee515aa`

**6. [Rule 3 - Blocking] Stabilized the recursive root test graph**

- **Found during:** Post-close `pnpm test` verification
- **Issue:** Live workspace scans exceeded inherited five-second Windows integration timeouts, architecture fixtures still asserted superseded dependency/script shapes, desktop scale tests expected device scale rather than the application override, and fixture-guard could destructively rebuild a shared distributable while desktop tests were importing it.
- **Fix:** Increased the bounded integration timeouts, refreshed the stale architecture and desktop assertions, and added package-qualified Turbo ordering so fixture-guard runs after desktop tests.
- **Files modified:** `tooling/architecture-tests/src/check-workspace.test.ts`, `tooling/architecture-tests/src/policy.test.ts`, `tooling/fixture-guard/src/fixture-guard.test.ts`, `apps/desktop/src/app.test.tsx`, `turbo.json`.
- **Verification:** `pnpm --filter @liiiraa/fixture-guard test` and the complete `pnpm test` graph pass; Turbo reports 49/49 successful tasks.
- **Committed in:** `ee515aa`

---

**Total deviations:** 6 auto-fixed (3 bugs, 3 blocking verification/build issues)
**Impact on plan:** The fixes were required to execute the acceptance gate and its recursive regression graph reliably; none broadened product authority, routes, dependencies, or distribution scope.

## Issues Encountered

- `pnpm verify` passed the workspace toolchain contract and formatting gate, then stopped at the unchanged repository-wide ESLint gate with 68 pre-existing errors in prior-plan account, admin, public-web, contract, and web-evidence files. The complete 49-task `pnpm test` graph, web-evidence unit suite, workspace package checks, production web build, live dev smokes, and exact final phase verifier pass independently. The unrelated lint debt is recorded in `deferred-items.md` and was not modified.

## Known Stubs

None. Unavailable official distribution and disconnected future authority are intentional, verifier-enforced Phase 3 safety contracts rather than incomplete wiring.

## Threat Flags

None. This plan adds an offline evidence/acceptance boundary only; it introduces no network endpoint, authentication path, file-write authority, schema migration, or product mutation surface.

## TDD Gate Compliance

- RED commit `9f9208d` introduced the final source coverage, omission, recursive-reachability, and forbidden-authority expectations before implementation.
- GREEN commit `36b0f6c` implemented `verifyPhase3`, the final repository command, publication proofs, and root command reachability.
- Recovery commit `00434c1` added a focused regression test together with the minimal Playwright selector correction.
- Recovery commits `6edb538` and `52378b8` restored recursive build compatibility and added source-resolution regression coverage without changing product behavior.
- Regression recovery commit `ee515aa` enforced the raw-source/NodeNext boundary split and stabilized the complete recursive test graph.

## Verification Results

- `pnpm test:acceptance-policy -- --mode final` - PASS, 50 tests.
- `pnpm --filter @liiiraa/web-evidence test` - PASS; complete package result 102 passed, 1 intentional Playwright-owned skip.
- `pnpm --filter @liiiraa/web-evidence exec vitest run src/playwright-config.test.ts` - PASS, 3 tests.
- `pnpm --filter @liiiraa/web-evidence exec vitest run src/source-import-resolution.test.ts` - PASS across contracts, design, web-core, web-features, and web-preview raw-source packages.
- `pnpm --filter @liiiraa/web-evidence typecheck` - PASS.
- `pnpm contracts:check` - PASS, 9 generated artifacts match their owning sources.
- Contracts/design/web-core/web-features/web-preview checks and tests - PASS: 37, 7, 12, 97, 27, and 15 tests respectively.
- `pnpm --filter @liiiraa/desktop-production-reference build` - PASS with the NodeNext-compatible generated contract boundary.
- `pnpm --filter @liiiraa/fixture-guard test` - PASS with bounded Windows workspace-scan timing.
- `pnpm test` - PASS, 49/49 Turbo tasks across the recursive workspace graph.
- Live dev smoke - PASS: public Turbopack `/pt-BR`, account `/pt-BR/sign-in`, and admin `/pt-BR/admin` each returned HTTP 200.
- `pnpm web:build` - PASS, 10/10 tasks including public, account, admin, and web-evidence builds.
- Scoped ESLint over the Plan 03-32 verifier, Playwright regression, source resolver, generator, and package indexes - PASS.
- `pnpm web:verify:phase -- --mode final` - PASS, fingerprint `42338988af5dd7ea950ccff6587c7fcdc0b8c2853924bb92daaca242304970a2`, 86 decisions, 53 routes, 18 scenarios.
- Source hash recheck - PASS; verifier and Playwright source hashes were unchanged before/after final verification.
- `pnpm verify` - BLOCKED by 68 pre-existing out-of-scope ESLint errors after toolchain and formatting passed; deferred without scope expansion.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness

- Phase 3's four requirements, locked decisions, route/content/release boundaries, three app artifacts, and publication evidence are closed by the direct final verifier.
- Phase 4 can connect identity, commerce, devices, support, and governed administration only through the preserved generated contracts and explicit security gates.
- Phase 10 remains responsible for publicly trusted signed distribution; Phase 3 exposes no downloadable installer.
- The complete recursive test graph now passes; repository-wide ESLint debt remains a quality concern for its owning prior-plan files but does not alter the final Phase 3 evidence verdict.

## Self-Check: PASSED

- All ten declared key evidence, verifier, regression, manifest, and summary files exist on disk.
- Commits `b145e91`, `9f9208d`, `36b0f6c`, `00434c1`, `6edb538`, `52378b8`, and `ee515aa` resolve in repository history.
- No plan commit deleted tracked files, and `git diff --check` reports no whitespace errors.
- Stub scan found no TODO, FIXME, placeholder, or coming-soon marker in Plan 03-32 verifier/evidence outputs.
- Final source hashes, direct phase verification, contract drift, package tests, dev route smokes, all web production builds, and the 49-task recursive root test graph passed; the only unresolved root quality result is the documented pre-existing 68-error ESLint backlog.

---

_Phase: 03-complete-web-experience_
_Completed: 2026-07-31_
