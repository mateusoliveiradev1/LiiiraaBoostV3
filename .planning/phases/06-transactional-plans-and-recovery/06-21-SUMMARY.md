---
phase: 06-transactional-plans-and-recovery
plan: '21'
subsystem: testing
tags: [typescript, vitest, promotion, evidence, recovery, privacy, tdd]
requires:
  - phase: 06-transactional-plans-and-recovery
    provides: Exact-version promotion, signed revocation, and bounded diagnostics from Plan 06-10
  - phase: 06-transactional-plans-and-recovery
    provides: Deterministic browser witness and guarded packaged Windows harness from Plan 06-20
provides:
  - Fail-closed staged evidence evaluator for deterministic, clean-VM, owner-PC, and friends-PC promotion
  - Separate immutable physical run evidence and strictly later exact matching human-review authority
  - Honest planned manifest with deterministic admission, explicit physical blockers, and preserved coverage gaps
affects: [06-26, 06-27, 06-28, phase-7-catalog-promotion]
tech-stack:
  added: []
  patterns:
    [
      closed schema-first admission,
      canonical evidence hashing,
      ordered physical promotion,
      explicit pending cells,
    ]
key-files:
  created:
    - tooling/phase6-evidence/src/evaluate.ts
    - tooling/phase6-evidence/evidence-manifest.schema.json
    - tooling/phase6-evidence/evidence-manifest.json
    - tooling/phase6-evidence/tests/evaluate.test.ts
  modified:
    - package.json
    - pnpm-lock.yaml
    - architecture/module-boundaries.json
    - tooling/architecture-tests/src/policy.test.ts
key-decisions:
  - 'Deterministic and browser witnesses can admit only deterministic simulation; no human response can relabel them as physical Windows evidence.'
  - 'Every physical stage requires already-persisted PASS run evidence followed by a strictly later APPROVED review bound to the exact stage, operation version, build, run hash, artifact hashes, and participant.'
  - 'Planned mode remains green with physical stages explicitly pending, while final mode fails with one exact blocker per missing physical run and never claims universal hardware support.'
patterns-established:
  - 'Canonical sorted-key SHA-256 binds review authority to immutable run bytes independent of object property order.'
  - 'Closed structural admission runs before semantic gates so omitted, additional, or wrongly typed trust-boundary fields fail without evaluator crashes.'
requirements-completed: [PLAN-01, PLAN-05, PLAN-06, PLAN-07, PLAN-08]
duration: 13 min
completed: 2026-08-13
status: complete
---

# Phase 06 Plan 21: Fail-Closed Evidence and Promotion Gate Summary

**A closed TypeScript authority now admits only exact complete recovery evidence, requires a later matching human review for each physical Windows stage, and leaves every unrun physical cell visibly pending.**

## Performance

- **Duration:** 13 min
- **Started:** 2026-08-13T18:18:10.1938888Z
- **Completed:** 2026-08-13T18:30:45.5473697Z
- **Tasks:** 3
- **Files modified:** 11

## Accomplishments

- Added a closed JSON Schema and deterministic evaluator binding operation version, immutable build, ordered stage, complete prepare/apply/verify/restart/restore/verify cycle, journal/receipt hashes, IPC adversarial proof, fault drills, accessibility, privacy, signed revocation, and explicit coverage gaps.
- Kept physical run evidence and human review as distinct immutable records; approval must be later than the run and match its stage, version, build, participant, canonical run hash, and ordered artifact hashes.
- Added 113 focused behavior and mutation tests covering every required run/review field, omission, stage skip, version/build swap, artifact tamper, stale input, raw-data leak, automatic upload, review substitution, failure propagation, and forbidden universal-support/manual-override claim.
- Seeded only deterministic Plan 20 evidence. Clean VM, owner PC, and friends PCs remain exact pending cells; planned mode passes while final mode exits nonzero with three explicit `PHYSICAL_RUN_EVIDENCE_MISSING` diagnostics.

## TDD Gate Compliance

| Gate     | Commit     | Evidence                                                                                                  |
| -------- | ---------- | --------------------------------------------------------------------------------------------------------- |
| RED      | `c6a8c5e3` | 47 evaluator-decision assertions failed against the deliberate `EVALUATOR_NOT_IMPLEMENTED` fallback.      |
| GREEN    | `b927ef7d` | Exact staged evaluation and the honest deterministic-only manifest made all initial 47 cases pass.        |
| REFACTOR | `7ecece3c` | Closed nested structural admission and omission/tamper mutations expanded the suite to 112 passing cases. |

## Task Commits

1. **Task 1 RED: Specify exact-version run and review evidence** - `c6a8c5e3` (test)
2. **Task 2 GREEN: Evaluate deterministic, physical-run, and human-review truth** - `b927ef7d` (feat)
3. **Task 3 REFACTOR: Mutation-test every promotion and review gate** - `7ecece3c` (refactor)
4. **Acceptance fix: Diagnose every missing physical run** - `e9a1ef9a` (fix)
5. **Integration fix: Register canonical module ownership** - `bbe3e798` (fix)

## Files Created/Modified

- `tooling/phase6-evidence/src/evaluate.ts` - Closed structural and semantic promotion authority, canonical evidence hashing, and planned/final CLI.
- `tooling/phase6-evidence/evidence-manifest.schema.json` - Exact staged run/review evidence schema with no additional properties.
- `tooling/phase6-evidence/evidence-manifest.json` - Current honest deterministic-only evidence state with three physical stages pending.
- `tooling/phase6-evidence/tests/evaluate.test.ts` - 113 admission, omission, tamper, privacy, review, staleness, and stage-order witnesses.
- `tooling/phase6-evidence/package.json`, `tooling/phase6-evidence/tsconfig.json`, `tooling/phase6-evidence/src/node-ambient.d.ts` - Workspace test and strict TypeScript boundary.
- `package.json`, `pnpm-lock.yaml` - Root `phase6:verify` command and deterministic workspace importer.
- `architecture/module-boundaries.json`, `tooling/architecture-tests/src/policy.test.ts` - Canonical ownership and live workspace discovery for the new tooling package.

## Decisions Made

- Simulation provenance is structural: deterministic evidence is rejected at every physical cell even when accompanied by an `APPROVED` response.
- A human review is not an execution receipt. It can authorize only the exact persisted physical run whose canonical bytes and artifacts it names, and only when its timestamp is strictly later.
- Physical evidence expires explicitly; stale, mixed-build, mixed-version, failed, missing, or edited inputs block their stage and all later stages.
- Hardware coverage gaps remain nonempty and visible. Completing a bounded friends-PC stage cannot silently become a 100% hardware-support claim.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] Persisted the new workspace importer**

- **Found during:** Task 1 RED verification
- **Issue:** pnpm added the new `@liiiraa/phase6-evidence` workspace importer; leaving the lockfile unstaged would fail frozen deterministic installs.
- **Fix:** Committed the exact Vitest importer generated for the new package without changing any approved dependency version.
- **Files modified:** `pnpm-lock.yaml`
- **Verification:** Supply-chain policy passed and the complete workspace test graph passed 57/57 tasks.
- **Committed in:** `c6a8c5e3`

**2. [Rule 3 - Blocking] Added the strict TypeScript project boundary**

- **Found during:** Task 2 GREEN lint/type verification
- **Issue:** ESLint project-service admission rejected the new source until the package had its own tsconfig; Node ambient types were also required without adding an unreviewed dependency.
- **Fix:** Added the same strict tooling-package tsconfig and minimal Node ambient declarations used by the existing Phase 5 evidence tool.
- **Files modified:** `tooling/phase6-evidence/tsconfig.json`, `tooling/phase6-evidence/src/node-ambient.d.ts`, `tooling/phase6-evidence/tests/evaluate.test.ts`
- **Verification:** strict TypeScript and ESLint both pass with zero diagnostics.
- **Committed in:** `b927ef7d`

**3. [Rule 1 - Bug] Added exact final-mode diagnostics for absent physical runs**

- **Found during:** Post-task final-mode acceptance verification
- **Issue:** Missing physical cells blocked final admission but initially returned no explicit reason code.
- **Fix:** Emit one stable `PHYSICAL_RUN_EVIDENCE_MISSING` diagnostic for each absent clean-VM, owner-PC, and friends-PC run while keeping planned mode green.
- **Files modified:** `tooling/phase6-evidence/src/evaluate.ts`, `tooling/phase6-evidence/tests/evaluate.test.ts`
- **Verification:** 113/113 focused tests pass; final CLI exits 1 with the exact three blockers.
- **Committed in:** `e9a1ef9a`

**4. [Rule 2 - Missing Critical] Registered the new evidence module in live architecture policy**

- **Found during:** Post-plan workspace architecture gate
- **Issue:** The new tooling package had no canonical owner, so live architecture enforcement correctly rejected every source path as `UNKNOWN_OWNER`.
- **Fix:** Added the minimal active `phase6-evidence` tooling module record and extended the independently discovered pnpm-root expectation.
- **Files modified:** `architecture/module-boundaries.json`, `tooling/architecture-tests/src/policy.test.ts`
- **Verification:** live workspace/Cargo adapters and 51/51 architecture tests pass.
- **Committed in:** `bbe3e798`

---

**Total deviations:** 4 auto-fixed (1 bug, 1 missing critical integration, 2 blocking workspace integrations). **Impact on plan:** Every deviation was required to keep the new authority deterministic, diagnosable, type-safe, and governed by existing architecture policy; no product or physical mutation authority was widened.

## Issues Encountered

- The first architecture gate correctly exposed both missing canonical ownership and the stale expected workspace-root list. The minimal policy integration above resolved both; no unrelated architecture rule changed.
- Final mode is intentionally red because no clean-VM, owner-PC, or friends-PC run/review evidence exists yet. This is the expected handoff to Plans 06-26 through 06-28, not a fabricated failure or release claim.

## Verification

- `rtk pnpm exec vitest --run tooling/phase6-evidence/tests/evaluate.test.ts` - **PASS**, 113/113.
- `rtk pnpm phase6:verify -- --mode planned` - **PASS**, deterministic simulation admitted; three physical stages explicitly pending; `releaseReady=false`.
- `rtk pnpm phase6:verify -- --mode final` - **EXPECTED FAIL-CLOSED**, exit 1 with three exact `PHYSICAL_RUN_EVIDENCE_MISSING` diagnostics.
- `rtk pnpm exec tsc --project tooling/phase6-evidence/tsconfig.json --noEmit` - **PASS**.
- Focused ESLint and Prettier checks - **PASS**.
- `rtk pnpm test:architecture` - **PASS**, 51/51.
- `rtk pnpm test` - **PASS**, 57/57 workspace tasks; Phase 6 evidence suite participates as an owned package.
- `rtk git diff --check` - **PASS**.

## Authentication Gates

None.

## User Setup Required

None - real Windows evidence and its later human review are deliberately collected only by the explicit physical-stage plans.

## Known Stubs

None. Null physical `runEvidence` and pending reviews are deliberate fail-closed evidence cells consumed by Plans 06-26 through 06-28; they cannot authorize promotion.

## Threat Flags

None. Artifact/manifest/review file reads are the plan-declared T-06-21A/B trust boundary and are covered by closed-schema, hash, ordering, staleness, privacy, and mutation gates. No network endpoint, authentication path, remote execution, or automatic transport was added.

## Next Phase Readiness

- Plan 06-26 can collect one exact clean-VM run using `--require-run-evidence clean-windows-vm`, then persist a distinct later review without rewriting run bytes.
- Plans 06-27 and 06-28 inherit exact predecessor, build, version, stage, privacy, expiry, and review bindings.
- Phase 6 remains intentionally not release-ready until all three physical stages have real PASS runs and exact matching later approvals; visible hardware coverage gaps remain mandatory.

## Self-Check: PASSED

- All 11 created or modified plan files exist and are committed.
- RED `c6a8c5e3`, GREEN `b927ef7d`, REFACTOR `7ecece3c`, acceptance fix `e9a1ef9a`, and architecture fix `bbe3e798` resolve in repository history.
- Focused, planned, strict type, lint, architecture, and full workspace gates pass; final mode rejects the honest pending manifest with exact blockers.
- User-owned `apps/account/.gitignore`, `apps/admin/.gitignore`, and `apps/web/.gitignore` remain untouched and unstaged.

---

_Phase: 06-transactional-plans-and-recovery_
_Completed: 2026-08-13_
