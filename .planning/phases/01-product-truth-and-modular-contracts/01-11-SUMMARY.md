---
phase: 01-product-truth-and-modular-contracts
plan: "11"
subsystem: tooling
tags:
  - rust
  - cargo
  - workspace
  - toolchain
  - tdd
requires:
  - phase: 01-product-truth-and-modular-contracts
    plan: "02"
    provides: Exact-pinned pnpm, Node, TypeScript, Vitest, and root verification toolchain
provides:
  - Exact Rust 1.97.1 toolchain with rustfmt and clippy
  - Resolver-3 Cargo workspace with reserved crate and Rust-tooling roots
  - Pure mutation-tested JavaScript workspace contract verifier
  - Terminating root verify:workspace command
affects:
  - 01-15-rust-contract-generation
  - phase-02-tauri-desktop-shell
  - future-rust-crates
tech-stack:
  added:
    - Rust 1.97.1 stable
    - Cargo resolver 3
  patterns:
    - Repository pins and effective local tool versions are checked separately
    - Reserved Rust member roots live in Cargo workspace metadata until crates exist
    - Toolchain mutations are tested through a pure snapshot policy core
key-files:
  created:
    - rust-toolchain.toml
    - Cargo.toml
    - tooling/workspace-smoke/package.json
    - tooling/workspace-smoke/tsconfig.json
    - tooling/workspace-smoke/check-toolchain.mjs
    - tooling/workspace-smoke/check-toolchain.d.mts
    - tooling/workspace-smoke/toolchain.test.ts
  modified:
    - package.json
    - pnpm-lock.yaml
key-decisions:
  - "Keep Cargo members empty until real crates exist, while machine-checking the approved crates/* and tooling/*/rust roots in workspace metadata."
  - "Test mutations through a pure snapshot policy core so strict TypeScript coverage does not require an unreviewed Node type dependency."
  - "Fail local runtime mismatches with actionable pnpm devEngines and Corepack recovery guidance, without spawning or modifying tools."
patterns-established:
  - "Two-layer toolchain proof: validate repository declarations first, then the effective local Node and pnpm versions."
  - "Reserved Cargo topology: member roots are policy metadata; real crates are added to workspace members only when implemented."
requirements-completed:
  - FOUND-01
  - FOUND-05
  - FOUND-06
duration: 7 min
completed: 2026-07-27
status: complete
---

# Phase 01 Plan 11: Rust Workspace Toolchain Contract Summary

**Rust 1.97.1 and Cargo resolver 3 are pinned behind a side-effect-free, mutation-tested workspace policy that verifies both repository topology and effective local tools.**

## Performance

- **Duration:** 7 min
- **Started:** 2026-07-27T00:22:21-03:00
- **Completed:** 2026-07-27T00:29:00-03:00
- **Tasks:** 1
- **Files modified:** 9

## Accomplishments

- Pinned exact Rust 1.97.1 with the minimal profile, rustfmt, and clippy.
- Established a resolver-3 Cargo workspace whose reserved `crates/*` and `tooling/*/rust` roots are machine-checked before consumers exist.
- Added nine mutation tests covering Node, pnpm, TypeScript, Rust, Cargo resolver, missing roots, local tool mismatches, and forbidden catch-all names.
- Made `pnpm verify:workspace` a terminating first gate in the complete root `pnpm verify` chain.

## Task Commits

Task 01-11-01 executed with RED/GREEN TDD commits:

1. **RED: Pin Rust and test workspace topology** — `15b0a2a` (`test`) — nine expected failures against the unimplemented policy stub
2. **GREEN: Enforce pinned Rust workspace contract** — `df5567a` (`feat`) — exact pins, topology, names, diagnostics, Cargo metadata, and full root verification pass

## Files Created/Modified

- `rust-toolchain.toml` — Exact Rust 1.97.1 minimal toolchain with rustfmt and clippy.
- `Cargo.toml` — Resolver-3 workspace, inherited Rust package baseline, and approved future member roots.
- `tooling/workspace-smoke/check-toolchain.mjs` — Read-only repository loader, pure policy evaluator, local runtime diagnostics, and CLI.
- `tooling/workspace-smoke/check-toolchain.d.mts` — Strict TypeScript surface for the JavaScript verifier.
- `tooling/workspace-smoke/toolchain.test.ts` — Nine deterministic pin and topology mutation tests.
- `tooling/workspace-smoke/package.json` — Terminating check/build commands and mutation test command.
- `tooling/workspace-smoke/tsconfig.json` — Strict test and declaration project.
- `package.json` — Root `verify:workspace` command and fail-fast integration into `verify`.
- `pnpm-lock.yaml` — Frozen workspace-smoke importer using already reviewed exact pins.

## Decisions Made

- Kept actual Cargo members empty until implementation plans create real crates. Cargo rejects unmatched member globs, so approved future roots are recorded under `workspace.metadata.liiiraa.member-roots` and enforced by the smoke policy.
- Split filesystem loading from pure snapshot evaluation. Mutation tests remain deterministic and strictly typed without introducing an unreviewed `@types/node` dependency.
- Checked effective Node and pnpm versions after repository configuration, producing direct remediation through pnpm `devEngines` or Corepack while keeping verification side-effect-free.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] Reserved Cargo roots as workspace metadata**

- **Found during:** Task 01-11-01 GREEN verification
- **Issue:** Cargo treats an unmatched `members = ["crates/*", "tooling/*/rust"]` glob as a missing manifest and refuses `cargo metadata` before the first Rust consumer exists.
- **Fix:** Kept `members = []`, recorded the exact future roots in `workspace.metadata.liiiraa.member-roots`, and made mutation tests enforce both roots.
- **Files modified:** `Cargo.toml`, `tooling/workspace-smoke/check-toolchain.mjs`, `tooling/workspace-smoke/check-toolchain.d.mts`, `tooling/workspace-smoke/toolchain.test.ts`
- **Verification:** `cargo metadata --format-version 1 --no-deps` reports the resolver-3 workspace and both metadata roots.
- **Committed in:** `df5567a`

**2. [Rule 3 - Blocking] Added strict workspace package support files**

- **Found during:** Task 01-11-01 RED/GREEN integration
- **Issue:** The new workspace package needed a frozen lockfile importer and a declaration-backed TypeScript project to participate in existing install, lint, and test gates.
- **Fix:** Added the existing exact TypeScript/Vitest importer, package tsconfig, and `.d.mts` declaration without adding any dependency.
- **Files modified:** `pnpm-lock.yaml`, `tooling/workspace-smoke/tsconfig.json`, `tooling/workspace-smoke/check-toolchain.d.mts`
- **Verification:** Frozen lockfile policy, strict lint, all mutation tests, and root verification pass.
- **Committed in:** `15b0a2a`, `df5567a`

---

**Total deviations:** 2 auto-fixed blocking issues

## TDD Gate Compliance

- **RED:** `15b0a2a` — all nine mutation tests failed against the explicit unimplemented verifier.
- **GREEN:** `df5567a` — all nine mutations pass and the exact repository succeeds.
- **REFACTOR:** No separate refactor commit was needed; the GREEN implementation is the minimal policy and loader split required by strict lint.

## Verification

- `pnpm --filter @liiiraa/workspace-smoke test` — passed, 9/9 mutation tests.
- `pnpm verify:workspace` — passed exact Node 24.18.0, pnpm 11.17.0, TypeScript 6.0.3, Rust 1.97.1, and Cargo resolver 3.
- `cargo metadata --format-version 1 --no-deps` — passed with deterministic empty member set and both reserved member roots.
- `pnpm lint` — passed with zero warnings.
- `pnpm verify` — passed generation, strict checks, all workspace tests, and all builds.

## Issues Encountered

- Cargo does not tolerate unmatched workspace member globs. The reserved-root metadata contract preserves the planned topology without creating empty crates, and Cargo metadata now resolves cleanly.

## Known Stubs

None.

## User Setup Required

None — no external services or manual configuration required.

## Next Phase Readiness

- Plan 01-15 can add the first Rust generator and contract crate under the already approved roots, then list the real members explicitly.
- Tauri and Windows crate plans inherit exact Rust 1.97.1, edition 2024, and resolver-3 behavior.
- No blockers remain.

## Self-Check: PASSED

- All seven created artifacts and both modified root artifacts exist on disk.
- RED commit `15b0a2a` and GREEN commit `df5567a` exist in git history in order.
- All nine mutation tests, the exact workspace verifier, Cargo metadata, strict lint, and full root verification pass.

---

_Phase: 01-product-truth-and-modular-contracts_
_Completed: 2026-07-27_
