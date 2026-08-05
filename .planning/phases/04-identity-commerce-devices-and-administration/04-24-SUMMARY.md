---
phase: 04-identity-commerce-devices-and-administration
plan: "24"
subsystem: release-evidence
tags: [evidence, sha256, promotion, windows-coverage, fail-closed, vitest]

requires:
  - phase: 04-22
    provides: Invitation-only staging API and immutable OCI deployment identity
  - phase: 04-23
    provides: Isolated staging surfaces and restricted Internal desktop build identity
provides:
  - Build-bound Phase 4 requirement and critical-gate evidence manifest
  - Append-only critical failure history with deterministic SHA-256 chaining
  - Fail-closed local through invited-alpha promotion evaluator
  - Explicit D-67 Windows, hardware, form-factor, storage, network, and journey matrix
affects: [04-25, 04-26, phase-4-verification, release-promotion]

tech-stack:
  added: []
  patterns:
    - Exact commit, OCI digest, desktop build, contract, schema, and artifact hash binding
    - Historical critical failures remain authoritative after later passes
    - Real-PC omissions cap promotion without inventing tester evidence

key-files:
  created:
    - tooling/phase4-evidence/src/evaluate.ts
    - tooling/phase4-evidence/evidence-manifest.json
    - tooling/phase4-evidence/real-pc-coverage.json
  modified:
    - package.json
    - architecture/module-boundaries.json
    - tooling/architecture-tests/src/policy.test.ts

key-decisions:
  - "Bind Phase 4 evidence to Internal build internal-023001, source commit 51770454aa1d17647c4fe734ae1e57f3e0b403b0, the exact OCI digest, and exact generated contract/schema hashes."
  - "Keep the real-PC matrix empty until real machines produce immutable cells; this truthfully caps the checked-in build at internal staging."
  - "Permit Phase 4 to grant at most invited-alpha authority while leaving owner review explicitly pending and forbidding frozen-RC or production promotion."

patterns-established:
  - "Evidence admission: resolve every requirement, gate, promotion stage, contract, and schema reference through an exact repository path plus SHA-256 and build fingerprint."
  - "Promotion order: local -> preview -> internal-staging -> invited-alpha, with contiguous evidence and no Phase 4 production authority."

requirements-completed:
  [WEB-04, WEB-05, WEB-06, WEB-07, IDEN-01, IDEN-02, IDEN-03, IDEN-04, IDEN-05, IDEN-06, IDEN-07, IDEN-08, IDEN-09]

duration: 18 min
completed: 2026-08-05
status: complete
---

# Phase 04 Plan 24: Immutable Integrated Evidence Summary

**Exact build, contract, schema, requirement, and critical-gate hashes now drive a fail-closed promotion verdict that reaches internal staging while visibly withholding invited-alpha, RC, and production authority.**

## Performance

- **Duration:** 18 min
- **Started:** 2026-08-05T17:45:24Z
- **Completed:** 2026-08-05T18:03:36Z
- **Tasks:** 1 TDD task
- **Files modified:** 11

## Accomplishments

- Added a strict evaluator for all thirteen Phase 4 requirements and ten critical security/privacy/billing/licensing/data/restoration/signing/update/accessibility/compatibility gates.
- Bound the evidence bundle to exact source commit, OCI digest, desktop build ID, contract hash, schema hash, repository artifacts, and one deterministic build fingerprint.
- Preserved append-only gate history so a critical failure cannot be overwritten by a later pass, and rejected omissions, wrong-build references, stale hashes, artifact mutation, history mutation, and known release-blocking defects.
- Added the full D-67 coverage vocabulary while honestly recording zero real-PC cells; the checked-in verdict passes internal staging and caps invited alpha until every required axis and journey has immutable evidence.
- Registered the tooling root in the canonical architecture policy and exposed `pnpm phase4:verify -- --stage <stage>` from the workspace root.

## TDD Gates

- **RED — `4fd7038`:** Added sixteen omission, mutation, build-binding, overwritten-failure, unsupported-stage, coverage-gap, defect, and owner-review cases. The first run failed only because `evaluate.ts` did not exist.
- **GREEN — `9473893`:** Implemented runtime admission, exact artifact hashing, build fingerprinting, gate-history chaining, coverage computation, CLI verdict formatting, manifests, architecture ownership, and root command integration. All sixteen focused cases pass.
- **REFACTOR:** Manifest/history admission, diagnostics, stage comparison, and verdict formatting were consolidated during GREEN. No separate behavior-neutral commit was needed after type, lint, format, architecture, and CLI gates passed.

## Task Commits

1. **Task 04-24-01 RED: Specify fail-closed Phase 4 evidence behavior** — `4fd7038` (`test`)
2. **Task 04-24-01 GREEN: Enforce build-bound Phase 4 promotion** — `9473893` (`feat`)

**Plan metadata:** committed separately after state and roadmap synchronization.

## Files Created/Modified

- `tooling/phase4-evidence/package.json` — Active workspace package and focused Vitest/TypeScript commands.
- `tooling/phase4-evidence/tsconfig.json` and `src/node-ambient.d.ts` — Strict local compiler boundary without adding an unreviewed package.
- `tooling/phase4-evidence/src/evaluate.test.ts` — Sixteen fail-closed mutation and promotion witnesses.
- `tooling/phase4-evidence/src/evaluate.ts` — Runtime evaluator and non-mutating CLI.
- `tooling/phase4-evidence/evidence-manifest.json` — Exact build identity, artifact hashes, requirement witnesses, gate history, promotion evidence, and owner-review boundary.
- `tooling/phase4-evidence/real-pc-coverage.json` — Full required D-67 axes with intentionally uncollected cells.
- `architecture/module-boundaries.json` — Canonical ownership for the active evidence tooling root.
- `tooling/architecture-tests/src/policy.test.ts` — Live workspace discovery expectation for the new root.
- `package.json` — Root `phase4:verify` command.
- `pnpm-lock.yaml` — Frozen importer metadata for the workspace package.

## Decisions Made

- The evidence manifest describes the exact existing Internal build identity instead of inferring identity from the current checkout or environment.
- Contract and schema hashes are both part of the build fingerprint and resolve dedicated immutable artifact records.
- A critical failure anywhere in the exact build's chained history remains a blocker even when a later record passes.
- Open defects in any release-critical category reject even when labeled minor; only documented, non-material minor defects outside those categories may remain.
- Real-PC coverage is not inferred from test counts or static fixtures. Empty cells are retained as explicit gaps, limiting the current build to internal staging.

## Verification Results

- Focused evaluator: **PASS** — 16/16 tests.
- Strict TypeScript: **PASS** — `@liiiraa/phase4-evidence` project.
- Targeted ESLint and Prettier: **PASS** for implementation, tests, manifests, architecture registration, and root command.
- Integrated verdict: **PASS** — `pnpm phase4:verify -- --stage internal-staging` reports `highestAllowedStage: internal-staging` with every uncollected D-67 cell visible.
- Architecture: **PASS** — 46/46 tests with live workspace and Cargo adapters.
- Docker, Docker Desktop, Testcontainers, and live PostgreSQL: **NOT INVOKED**.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] Recorded the new workspace importer in the frozen lockfile**

- **Found during:** RED verification
- **Issue:** The new active pnpm workspace root required importer metadata for frozen workspace execution.
- **Fix:** Retained the automatically generated dependency-free importer using only the repository's existing TypeScript and Vitest pins.
- **Files modified:** `pnpm-lock.yaml`
- **Verification:** Focused test and strict TypeScript commands run through the workspace filter.
- **Committed in:** `4fd7038`

**2. [Rule 2 - Missing Critical] Added a strict local Node ambient boundary**

- **Found during:** GREEN strict TypeScript verification
- **Issue:** The workspace does not expose `@types/node` to this dependency-free tool, and adding an unreviewed package was outside the approved supply-chain boundary.
- **Fix:** Added minimal authored declarations for only the built-in crypto, file, path, URL, and process APIs the evaluator consumes.
- **Files modified:** `tooling/phase4-evidence/src/node-ambient.d.ts`, `tooling/phase4-evidence/tsconfig.json`
- **Verification:** Strict TypeScript and targeted ESLint pass.
- **Committed in:** `9473893`

**3. [Rule 3 - Blocking] Updated live architecture discovery for the registered tooling root**

- **Found during:** Architecture verification
- **Issue:** The canonical module was registered, but the live discovery witness still expected the pre-plan workspace set.
- **Fix:** Added `tooling/phase4-evidence` to the exact expected root list.
- **Files modified:** `tooling/architecture-tests/src/policy.test.ts`
- **Verification:** Architecture suite passes 46/46.
- **Committed in:** `9473893`

---

**Total deviations:** 3 auto-fixed (1 missing critical functionality, 2 blocking integration issues).
**Impact on plan:** Each fix was necessary for deterministic, strict, architecture-owned workspace execution; no external dependency, deployment, credential, or production authority was added.

## Known Stubs

None. The empty real-PC `cells` array is an intentional, executable evidence gap rather than a stub: it prevents invited-alpha promotion until real machine results exist.

## Issues Encountered

- The architecture mutation suite exceeded the first 30-second output window. The same process was polled to completion and passed all 46 cases; no competing run was started.
- Root pnpm forwards a literal separator to the package script, but Vitest and the CLI both parse the planned commands correctly and terminate deterministically.

## Authentication Gates

None.

## User Setup Required

None - no credentials, provider accounts, deployments, Docker daemon, or local database are required for this evaluator.

## Next Phase Readiness

- Plan 04-25 can consume one reproducible internal-staging verdict bound to exact build and artifact identities.
- Invited-alpha remains correctly blocked until Windows 10/11, CPU/GPU, form-factor, storage/network, and all seven journey cells are collected on real machines.
- Frozen RC and production remain outside Phase 4 authority and still require immutable integrated evidence, automated gates, explicit owner approval, and risk-appropriate external review.

## Self-Check: PASSED

- All eleven created/modified task files exist.
- RED commit `4fd7038` and GREEN commit `9473893` exist in repository history in the required order.
- Focused tests, strict TypeScript, targeted lint/format, internal-staging CLI verdict, and 46 architecture cases pass.
- No tracked files were deleted; `.impeccable/` and `apps/desktop/src-tauri/gen/` remain untouched and untracked.

---

_Phase: 04-identity-commerce-devices-and-administration_
_Completed: 2026-08-05_
