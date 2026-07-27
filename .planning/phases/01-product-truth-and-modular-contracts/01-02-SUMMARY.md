---
phase: 01-product-truth-and-modular-contracts
plan: '02'
subsystem: tooling
tags:
  - pnpm
  - turborepo
  - typescript
  - eslint
  - prettier
requires:
  - phase: 01-product-truth-and-modular-contracts
    provides: Exact approved Phase 1 dependency evidence from Plan 01-01
provides:
  - Exact-pinned pnpm and Node development runtime
  - Frozen reviewed JavaScript dependency graph
  - Strict TypeScript, type-aware ESLint, and deterministic formatting policy
  - Terminating root generate, check, test, build, and verify commands
affects:
  - 01-03-module-constitution
  - 01-04-contract-generation-spike
  - phase-01-javascript-packages
tech-stack:
  added:
    - pnpm 11.17.0
    - Node.js 24.18.0
    - Turborepo 2.10.7
    - TypeScript 6.0.3
    - ESLint 10.8.0
    - typescript-eslint 8.65.0
    - Prettier 3.9.6
    - dependency-cruiser 18.1.0
    - Vitest 4.1.10
  patterns:
    - Exact direct dependency pins checked against the versioned allowlist
    - Project lifecycle scripts denied by default
    - Root orchestration delegates package tasks through Turbo
key-files:
  created:
    - package.json
    - pnpm-lock.yaml
    - pnpm-workspace.yaml
    - turbo.json
    - .npmrc
    - tsconfig.base.json
    - eslint.config.mjs
    - prettier.config.mjs
  modified:
    - .gitignore
key-decisions:
  - 'Use pnpm devEngines to download and execute the exact Node 24.18.0 runtime while packageManager pins pnpm 11.17.0.'
  - 'Keep TypeScript at compatibility pin 6.0.3 with typescript-eslint 8.65.0; TypeScript 7 remains excluded.'
  - 'Deny package lifecycle scripts in both project pnpm settings and .npmrc without adding build-script exceptions.'
patterns-established:
  - 'Toolchain pinning: exact runtime and package-manager versions are part of the frozen lockfile.'
  - 'Static policy: strict compiler defaults and type-aware lint rules are inherited by future packages.'
  - 'Module naming: catch-all packages and cross-package src imports are rejected at lint time.'
requirements-completed:
  - FOUND-01
  - FOUND-05
  - FOUND-06
duration: 15 min
completed: 2026-07-27
status: complete
---

# Phase 1 Plan 2: Pinned JavaScript Workspace and Strict Root Policy Summary

**An exact-pinned pnpm/Turborepo workspace now runs Node 24.18.0 with a frozen lockfile, denied lifecycle scripts, strict TypeScript 6, type-aware ESLint, and deterministic root checks.**

## Performance

- **Duration:** 15 min
- **Started:** 2026-07-27T02:10:00Z
- **Completed:** 2026-07-27T02:25:11Z
- **Tasks:** 2
- **Files modified:** 9

## Accomplishments

- Pinned pnpm 11.17.0, Node 24.18.0, and every root Phase 1 tool to an exact approved version.
- Generated a frozen lockfile from a lifecycle-script-disabled clean install.
- Added terminating Turbo task shapes and a root `verify` chain for generation, static checks, tests, and builds.
- Enforced strict TypeScript compiler defaults, type-aware linting, forbidden catch-all/deep imports, and one Prettier authority.

## Task Commits

Each task was committed atomically:

1. **Task 01-02-01: Create the pinned pnpm and Turbo workspace** — `bcf8f0b` (`chore`)
2. **Task 01-02-02: Enforce strict TypeScript, lint, and formatting policy** — `12f1f53` (`chore`)

## Files Created/Modified

- `package.json` — Exact runtimes, root scripts, and approved tooling dependencies.
- `pnpm-lock.yaml` — Frozen pnpm, Node, Turbo, lint, formatting, graph, and test dependency graph.
- `pnpm-workspace.yaml` — Workspace roots and fail-closed project pnpm settings.
- `turbo.json` — Terminating generate, check, test, and build task graph.
- `.npmrc` — Exact-save, strict-peer, frozen-workspace, and lifecycle-script policy.
- `tsconfig.base.json` — Strict TypeScript 6 compiler baseline for future packages.
- `eslint.config.mjs` — Type-aware rules and forbidden catch-all/deep-import policy.
- `prettier.config.mjs` — Single deterministic formatting authority.
- `.gitignore` — Generated dependency, Turbo, build, coverage, and compiler artifacts.

## Decisions Made

- Used pnpm `devEngines` so all package scripts execute with exact Node 24.18.0 even though the host shell began on Node 24.16.0.
- Installed only the approved Phase 1 root tooling set; TypeSpec, Ajv, UI, cloud, database, auth, Windows, and optimizer dependencies remain outside this plan.
- Kept lifecycle execution fully disabled rather than adding package-specific exceptions.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 2 - Missing Critical] Added generated workspace artifacts to `.gitignore`**

- **Found during:** Task 01-02-01
- **Issue:** The repository only ignored the research cache, so a normal pnpm install exposed `node_modules/` and future Turbo/build outputs to accidental commits.
- **Fix:** Preserved the existing research-cache rule and added only deterministic generated workspace artifacts.
- **Files modified:** `.gitignore`
- **Verification:** `rtk git status --short` remains clean after a clean frozen install and full root verification.
- **Committed in:** `bcf8f0b`

---

**Total deviations:** 1 auto-fixed (1 missing critical functionality)

## Issues Encountered

- TypeScript 6 rejects an explicitly empty `files` list. The root command now verifies the exact compiler while future package `check` tasks compile their own inherited projects.
- The first ESLint pass correctly exposed missing Node/Web globals in the pre-existing supply-chain verifier; the flat config now declares those globals read-only without changing the verifier.

## User Setup Required

None — no external service configuration is required.

## Next Phase Readiness

- Plan 01-03 can create the first workspace tooling package and inherit the strict compiler/lint baseline.
- Plan 01-04 can install only its owning TypeSpec dependencies at exact approved pins.
- No blockers remain.

## Self-Check: PASSED

- All nine plan artifacts exist on disk.
- Both atomic task commits are present in git history.
- A clean frozen install, both task verification commands, the full root `verify` chain, and the dependency evidence verifier pass.

---

_Phase: 01-product-truth-and-modular-contracts_
_Completed: 2026-07-27_
