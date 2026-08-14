---
phase: 06-transactional-plans-and-recovery
plan: '32'
subsystem: physical-evidence-custody
tags: [typescript, vitest, cms, spki, append-only, windows, evidence, consent]
requires:
  - phase: 06-21
    provides: transactional evidence contracts and generated cross-runtime validation baseline
  - phase: 06-35
    provides: compiled-pin artifact, config, live-byte, and friends-roster custody verifier
  - phase: 06-39
    provides: generated physical artifact, roster, config, and continuation contracts
provides:
  - Exact ordered PLAN-01 through PLAN-08 evaluation with targeted planned gates and final-only release readiness
  - Signed-artifact-first physical ingestion with closed CLI grammar and authenticated MSI, runner, and config identity
  - Create-only friends roster, run, local consent, and human-review evidence with exact participant cardinality
affects: [06-33, 06-34, physical-windows-promotion, phase6-verification]
tech-stack:
  added: []
  patterns:
    - Fixed Rust verifier success precedes all physical envelope parsing and persistence
    - Physical records are exclusively created before byte-compared atomic manifest append
    - Friends promotion revalidates fixed-path same-SPKI roster custody and local pre-export consent
key-files:
  created:
    - tooling/phase6-evidence/src/physical-writer.ts
  modified:
    - tooling/phase6-evidence/src/evaluate.ts
    - tooling/phase6-evidence/evidence-manifest.schema.json
    - tooling/phase6-evidence/tests/evaluate.test.ts
    - tooling/phase6-evidence/tests/physical-writer.test.ts
    - tooling/phase6-evidence/src/node-ambient.d.ts
    - package.json
key-decisions:
  - 'Accept physical evidence only after the fixed 06-35 verifier returns its exact verified verdict; envelope labels and hashes never establish artifact authority.'
  - 'Keep planned run and admitted-stage checks mutually exclusive and scoped to their exact predecessor chain; only final mode evaluates all four stages.'
  - 'Bind friends consent to the exact locally previewed redacted bytes before export, then require a strictly later immutable human review.'
  - 'Revalidate the canonical fixed-path roster and adjacent CMS against the compiled SPKI on every friends ingestion, not only when freezing the roster.'
patterns-established:
  - 'Create-only evidence: roster pairs and per-stage run, consent, and review files use exclusive creation plus compare-and-append.'
  - 'Closed custody: CLI callers supply no output path, signer, trust pin, participant, or artifact identity override.'
requirements-completed: [PLAN-01, PLAN-02, PLAN-03, PLAN-04, PLAN-05, PLAN-06, PLAN-07, PLAN-08]
duration: 25 min
completed: 2026-08-13
---

# Phase 06 Plan 32: Authenticated Physical Evidence Promotion Summary

**Exact staged evaluation now admits only independently verified physical runner evidence, with same-SPKI friends roster custody and create-only consent/review cardinality for every declared machine.**

## Performance

- **Duration:** 25 min
- **Started:** 2026-08-13T23:45:21Z
- **Completed:** 2026-08-14T00:09:35Z
- **Tasks:** 2 TDD tasks
- **Files modified:** 7

## Accomplishments

- Closed the evaluator to the exact ordered requirement set `PLAN-01` through `PLAN-08`, schema v2 append-only collections, and mutually exclusive planned run/admitted gates versus final mode.
- Added root commands `phase6:ingest-physical`, `phase6:freeze-friends-roster`, and `phase6:record-review` with canonical, fail-closed argument grammars.
- Required the fixed `phase6-artifact-verifier --artifact-manifest` inspection to succeed before reading physical envelopes, then bound the run to authenticated artifact, operation, build, stage, MSI, runner, and config identities.
- Made the generated-path friends roster and adjacent detached CMS create-only, compiled-SPKI verified, canonically hashed, and immutable across later ingestion.
- Bound every friends run to one signed roster participant/slot plus a local pre-export consent over the exact previewed redacted bytes and a strictly later exact human review.

## TDD Execution

### Task 1: Explicit CLI gates and multi-machine evaluator

- **RED:** Added failing syntax, exact-requirement, targeted-stage, legacy-history, roster-cardinality, participant, hash, and timestamp mutation coverage in `b488c6db`.
- **GREEN:** Implemented schema v2 append-only evaluation, exact ordered requirement coverage, scoped planned gates, complete final evaluation, and friends one-to-one admission in `17048747`.
- **REFACTOR:** No separate refactor was needed; the GREEN implementation keeps parsing, structural validation, stage evaluation, and CLI dispatch separated.

### Task 2: Signed-artifact-first append-only physical writer

- **RED:** Added the failing physical writer corpus covering verifier bypass, artifact/config/runner mutation, closed roster CLI, half-pairs, relabeling, duplicate records, secrets, size bounds, lifecycle drift, and atomic failure in `65f81f24`.
- **GREEN:** Implemented fixed-verifier-first ingestion, exact live role binding, canonical same-SPKI roster freeze/reverification, local consent binding, create-only records, and byte-compared atomic manifest append in `4f597568`.
- **REFACTOR:** No separate refactor was warranted after both suites and strict TypeScript passed together.

## Task Commits

1. **Task 1 RED: failing staged CLI and friends roster gates** - `b488c6db` (test)
2. **Task 1 GREEN: staged gates and friends cardinality** - `17048747` (feat)
3. **Task 2 RED: failing signed physical writer gate** - `65f81f24` (test)
4. **Task 2 GREEN: authenticated append-only physical evidence** - `4f597568` (feat)

## Files Created/Modified

- `tooling/phase6-evidence/src/physical-writer.ts` - Fixed-verifier-first ingestion, same-SPKI roster custody, create-only records, consent binding, review append, and closed CLI.
- `tooling/phase6-evidence/src/evaluate.ts` - Exact staged/final evaluation, schema v2 parsing, friends cardinality, and canonical continuation names.
- `tooling/phase6-evidence/evidence-manifest.schema.json` - Exact eight-requirement and append-only stage evidence contract.
- `tooling/phase6-evidence/tests/evaluate.test.ts` - CLI, requirement, targeted-stage, final, legacy, and multi-participant mutation coverage.
- `tooling/phase6-evidence/tests/physical-writer.test.ts` - Artifact, roster, provenance, consent, redaction, create-only, and atomicity adversarial corpus.
- `tooling/phase6-evidence/src/node-ambient.d.ts` - Narrow Node filesystem, process, child-process, buffer, OS, and path declarations used by the bounded writer.
- `package.json` - Closed physical ingestion, roster-freeze, review, and verification entry points.

## Decisions Made

- Verifier process exit success alone is insufficient: its JSON must parse and return literal `verdict: "verified"`, with manifest and operation identities matching the authenticated document.
- Signed artifact custody remains authoritative for all nine fixed portable roles; the writer independently rechecks live MSI, runner, and selected config bytes before accepting their exact run tuple.
- The roster candidate is canonicalized into the two config-derived paths, signed only by the certificate matching the compiled SPKI, and cryptographically rechecked both after freeze and before each friends ingestion.
- Manifest updates retain immutable legacy blockers and use exclusive record creation plus an expected-byte comparison immediately before atomic replacement.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Aligned the physical continuation chain to the generated 06-39 contract**

- **Found during:** Task 2 GREEN
- **Issue:** The interrupted work still used superseded continuation names (`checkpoint-created`, `reboot-requested`, and `restore-requested`) instead of the generated six-state authority.
- **Fix:** Switched evaluator/writer fixtures to `checkpoint-ready`, `running`, and `reboot-pending`, retaining observation-first `resumed-observation` and terminal `restored-complete`.
- **Files modified:** `tooling/phase6-evidence/src/evaluate.ts`, `tooling/phase6-evidence/tests/evaluate.test.ts`, `tooling/phase6-evidence/tests/physical-writer.test.ts`
- **Verification:** Combined evaluator/writer suite passes 84/84.
- **Committed in:** `4f597568`

**2. [Rule 2 - Missing Critical] Bound friends ingestion to roster custody and actual local preview bytes**

- **Found during:** Task 2 GREEN recovery audit
- **Issue:** The interrupted implementation verified the roster CMS only while freezing it and accepted merely well-formed consent hashes, allowing later ingestion without rechecking signed roster custody or exact redacted bytes.
- **Fix:** Reverify the fixed roster/CMS pair against the compiled SPKI during every friends ingestion, require canonical immutable roster bytes and exact participant/slot membership, match both consent hashes and diagnostic byte length to the local redacted output, and require the authenticated config file in the run artifact tuple.
- **Files modified:** `tooling/phase6-evidence/src/physical-writer.ts`, `tooling/phase6-evidence/tests/physical-writer.test.ts`
- **Verification:** New custody, participant, preview-hash, config-artifact, and byte-length mutations fail atomically; combined suite passes 84/84 and strict TypeScript passes.
- **Committed in:** `4f597568`

---

**Total deviations:** 2 auto-fixed (1 Rule 1 bug, 1 Rule 2 missing critical security functionality)
**Impact on plan:** Both fixes enforce the already planned generated continuation and physical trust boundaries; no package, generic execution surface, mutable trust input, or new architecture was added.

## Issues Encountered

- Execution resumed from a valid interrupted TDD state with three existing commits and uncommitted Task 2 GREEN work. Those commits were verified and preserved without amendment or duplication.
- The plan key-link scanner requires the artifact-verifier invocation witness on one source line; a fixed internal literal now makes the real command relationship machine-verifiable without widening CLI authority.

## Verification

- `rtk pnpm --filter @liiiraa/phase6-evidence exec vitest --run tests/evaluate.test.ts` - 47 passed, 0 failed.
- `rtk pnpm --filter @liiiraa/phase6-evidence exec vitest --run tests/physical-writer.test.ts tests/evaluate.test.ts` - 84 passed, 0 failed.
- `rtk pnpm exec tsc -p tooling/phase6-evidence/tsconfig.json --noEmit` - passed with zero diagnostics.
- `rtk gsd-sdk query verify.key-links .planning/phases/06-transactional-plans-and-recovery/06-32-PLAN.md` - 3/3 links verified.
- `rtk git diff --check` - passed.

## Known Stubs

None. Stub scanning found no implementation TODO, FIXME, placeholder, coming-soon, unavailable data source, or UI-bound empty value in the source files changed by this plan. Test-only placeholder identities remain deliberate rejection fixtures.

## Authentication Gates

None.

## User Setup Required

None for repository verification. A real physical roster freeze intentionally remains fail closed until the reviewed non-exportable Windows certificate matching the compiled SPKI is present.

## Next Phase Readiness

- Plan 06-33 can use targeted planned gates to admit one exact physical stage without requiring later-stage evidence.
- Plan 06-34 can consume only create-once, signed-roster-bound friends evidence and remains blocked until every roster participant has one matching consented run and later approval.
- No evaluator, CLI grammar, artifact custody, roster custody, cardinality, consent, immutability, TypeScript, test, or key-link blocker remains.

## Self-Check: PASSED

- All seven listed source/schema/test/root files exist on disk.
- RED/GREEN commits `b488c6db`, `17048747`, `65f81f24`, and `4f597568` exist in the required order.
- Both declared plan verification commands, strict TypeScript, diff integrity, and all 3 key links pass.
- Requirements `[PLAN-01, PLAN-02, PLAN-03, PLAN-04, PLAN-05, PLAN-06, PLAN-07, PLAN-08]` exactly match plan frontmatter.
- Stub and threat-surface scans found no unfinished implementation or unplanned trust boundary; all child-process and file-custody surfaces are covered by T-06-32A/B/C/D.

---

*Phase: 06-transactional-plans-and-recovery*
*Completed: 2026-08-13*
