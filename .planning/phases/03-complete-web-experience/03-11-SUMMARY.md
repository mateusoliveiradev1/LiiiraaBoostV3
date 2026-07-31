---
phase: 03-complete-web-experience
plan: "11"
subsystem: web-workspace
tags: [pnpm, turborepo, nextjs, architecture, supply-chain]
requires:
  - phase: 03-01
    provides: exact package legitimacy approval
  - phase: 03-02
    provides: reserved web module ownership graph
  - phase: 03-04
    provides: web-core manifest
  - phase: 03-05
    provides: web-preview manifest
  - phase: 03-06
    provides: web-features manifest
  - phase: 03-07
    provides: web-evidence manifest
  - phase: 03-08
    provides: public web application manifest
  - phase: 03-10
    provides: generated web contract validation
provides:
  - frozen dependency resolution for all seven Phase 3 roots
  - active live web architecture graph with mutation coverage
  - terminating root web check, test, build, and verification commands
affects: [03-12, 03-13, 03-14, phase-04]
tech-stack:
  added: []
  patterns:
    - exact approved lock resolution with lifecycle scripts disabled
    - explicit Turbo filters for the seven web roots
    - route-less Next application roots that build without claiming product routes
key-files:
  created:
    - apps/web/src/app/.gitkeep
    - apps/account/src/app/.gitkeep
    - apps/admin/src/app/.gitkeep
  modified:
    - pnpm-lock.yaml
    - architecture/module-boundaries.json
    - tooling/architecture-tests/src/check-workspace.test.ts
    - tooling/architecture-tests/src/policy.test.ts
    - package.json
    - turbo.json
key-decisions:
  - "Activate exactly the seven predeclared Phase 3 module records and preserve every other reserved record."
  - "Keep public, account, and admin route-less while giving Next.js a buildable application root; later plans remain responsible for user-facing routes."
  - "Reuse the already approved @types/react@19.2.17 identity in each owning Next app rather than introducing a new package identity."
patterns-established:
  - "Web lifecycle commands explicitly enumerate all seven roots and never enter watch mode."
  - "Next build output is captured by Turbo while .next caches remain excluded."
requirements-completed: [WEB-08]
duration: 27min
completed: 2026-07-31
status: complete
---

# Phase 03 Plan 11: Web Workspace Activation Summary

**Frozen exact dependency resolution and a live seven-root web graph with terminating checks, tests, and independent Next.js builds.**

## Performance

- **Duration:** 27 min
- **Started:** 2026-07-31T03:34:43Z
- **Completed:** 2026-07-31T04:01:04Z
- **Tasks:** 2
- **Files modified:** 23

## Accomplishments

- Resolved and materialized the approved Phase 3 dependency graph with pnpm 11.17.0 under managed Node 24.18.0, strict peers, frozen lockfile, integrity verification, and lifecycle scripts disabled.
- Activated exactly `web-core`, `web-preview`, `web-features`, `web-evidence`, `web-app`, `account-app`, and `admin-app`, with live discovery, manifest parity, ownership, runtime-class, fixture-edge, duplicate-owner, and root-command coverage.
- Added bounded `web:check`, `web:test`, `web:build`, `web:verify:quick`, and `web:verify` commands; public, account, and admin produce independent Next.js standalone builds.

## Task Commits

Each task was committed atomically:

1. **Task 1: Resolve the exact approved dependency graph** — `c655d6b` (`chore`)
2. **Task 2 RED: Add failing activation parity tests** — `3dfc515` (`test`)
3. **Task 2 GREEN: Activate the live graph and root lifecycle** — `7886eee` (`feat`)

## Files Created/Modified

- `pnpm-lock.yaml` — Frozen seven-importer dependency resolution and approved React type ownership.
- `architecture/module-boundaries.json` — Exactly seven Phase 3 module records changed from reserved to active.
- `tooling/architecture-tests/src/check-workspace.test.ts` — Live package, dependency, status, and root command parity.
- `tooling/architecture-tests/src/policy.test.ts` — Live discovery baseline includes all seven activated roots.
- `package.json` — Bounded web lifecycle commands and desktop-plus-web root verification delegation.
- `turbo.json` — Next output tracking with `.next/cache` excluded.
- `apps/{web,account,admin}/src/app/.gitkeep` — Buildable route-less Next application roots.
- `apps/{web,account,admin}/package.json` — Exact already-approved React declaration ownership.
- `packages/web-{core,preview}/tsconfig.json` and app TypeScript configs — External declaration isolation required by the pinned TypeScript/React/Next combination.

## Decisions Made

- Activated only the seven predeclared Phase 3 records; `optimizer-domain` and `desktop-application` remain reserved.
- Preserved the plan's no-route boundary. Empty application roots allow Next to build only its framework `/404`; no public, account, or admin product route was introduced.
- Used only previously approved package identities. `@types/react@19.2.17` was already approved by the Phase 2 package gate and was added solely to its three owning Next manifests.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] Updated stale live-workspace architecture expectations**

- **Found during:** Task 2 GREEN
- **Issue:** Existing architecture tests still expected all Phase 3 manifests to be absent and retained two previously deferred Phase 2 parity assumptions.
- **Fix:** Added the seven live roots to discovery coverage, aligned desktop workspace dependency parity, and tied the packaged harness type identity to its exact approval summary.
- **Files modified:** `tooling/architecture-tests/src/check-workspace.test.ts`, `tooling/architecture-tests/src/policy.test.ts`
- **Verification:** `pnpm test:architecture` — 46/46 tests pass.
- **Committed in:** `7886eee`

**2. [Rule 3 - Blocking] Made the predeclared web lifecycle terminate successfully**

- **Found during:** Task 2 GREEN
- **Issue:** Vitest exited non-zero for intentionally test-empty activation packages, Next required application directories, and generated declarations required the already approved React types plus external declaration isolation.
- **Fix:** Added `--passWithNoTests` to the four activation-only package test scripts, route-less application roots, exact `@types/react@19.2.17` dev dependencies, and narrow `skipLibCheck` settings.
- **Files modified:** Web package manifests, app manifests and TypeScript configs, `pnpm-lock.yaml`, route-less app roots
- **Verification:** `pnpm web:verify` passes all checks, tests, and three Next standalone builds.
- **Committed in:** `7886eee`

**3. [Rule 3 - Blocking] Excluded generated Next output from repository lint and status**

- **Found during:** Overall verification
- **Issue:** `.next` and `next-env.d.ts` were generated during required builds; root ESLint otherwise traversed generated bundles.
- **Fix:** Added repository and ESLint ignores for `.next`, ignored generated `next-env.d.ts`, and included each authored `next.config.ts` in its owning TypeScript project.
- **Files modified:** `.gitignore`, `eslint.config.mjs`, app TypeScript configs
- **Verification:** Root lint no longer reports generated Next files or Next config project-service errors.
- **Committed in:** `7886eee`

---

**Total deviations:** 3 auto-fixed (3 Rule 3 blocking)
**Impact on plan:** All fixes were required to execute the predeclared lifecycle and architecture graph. No new package identity, product route, network surface, or cross-app dependency was introduced.

## Verification

- `pnpm install --frozen-lockfile --ignore-scripts --strict-peer-dependencies` — PASS
- `pnpm verify:workspace` — PASS (Node 24.18.0, pnpm 11.17.0)
- `pnpm supply-chain:check` — PASS (60 exact pins)
- `pnpm test:architecture` — PASS (46/46)
- `pnpm web:check` — PASS
- `pnpm web:verify` — PASS (check, test, and build across all seven roots)
- `pnpm list -r --depth 0` — PASS
- `pnpm verify:foundation:quick` — Reaches the unchanged root lint gate, then stops on the pre-existing `packages/contracts-ts/src/validation.ts:220` lint error documented in `deferred-items.md`.

## TDD Gate Compliance

- RED: `3dfc515` proves reserved statuses and missing commands fail.
- GREEN: `7886eee` makes the live activation and lifecycle suite pass.
- REFACTOR: Not required.

## Authentication Gates

None.

## Known Stubs

None. The empty application roots are intentional no-route scaffolds required by this plan; they do not render placeholder data or claim a future product route.

## Issues Encountered

The unchanged foundation quick chain is blocked by a pre-existing contract-validation lint error outside this plan's files. It is recorded in `.planning/phases/03-complete-web-experience/deferred-items.md`; all Plan 03-11-specific gates pass.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness

All seven Phase 3 roots are discoverable, exact-pinned, architecture-enforced, and independently executable. Plans 03-12 onward can add real routes and journeys without changing workspace activation or package authority.

## Self-Check: PASSED

- All key created files exist.
- Task commits `c655d6b`, `3dfc515`, and `7886eee` exist.
- Exact activation, frozen install, supply-chain, architecture, web check/test/build, and TDD gates passed.

---

*Phase: 03-complete-web-experience*
*Completed: 2026-07-31*
