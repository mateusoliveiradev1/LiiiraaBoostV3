---
phase: 01-product-truth-and-modular-contracts
plan: '16'
subsystem: contracts
tags: [contracts, drift, compatibility, json-schema, openapi, oasdiff, semver]
requires:
  - phase: 01-product-truth-and-modular-contracts
    provides: deterministic production contract generation from plan 01-15
provides:
  - isolated non-mutating generated artifact drift gate
  - executable closed-schema compatibility fixture matrix
  - immutable hash-verified approved contract baseline
  - accepted contract versioning and compatibility policy
affects: [contract-generation, ci-quality-gates, runtime-validation]
tech-stack:
  added: []
  patterns:
    - temporary-root regeneration before byte comparison
    - git-revision and SHA-256 anchored compatibility baseline
    - explicit major-transition approval
key-files:
  created:
    - tooling/contract-generation/src/check-drift.ts
    - tooling/contract-compat/src/check-compat.ts
    - tooling/contract-compat/fixtures/versioned-baseline.json
    - architecture/decisions/0002-contract-versioning-and-compatibility.md
  modified:
    - package.json
    - tooling/contract-generation/src/generate.ts
    - tooling/contract-generation/package.json
key-decisions:
  - 'Anchor the approved baseline to an immutable Git revision and verify every artifact SHA-256 before comparison.'
  - 'Require explicit architecture/contracts approval plus ADR-0002 for any accepted major transition.'
  - 'Fail closed when changed HTTP artifacts require oasdiff 1.26.0 and the binary is unavailable.'
patterns-established:
  - 'Generation drift and semantic compatibility are separate terminating commands and separate root verify steps.'
  - 'Closed desktop schemas treat discriminator, required-set, closure, type/reference, and bound changes as breaking.'
requirements-completed: [FOUND-01]
duration: 32 min
completed: 2026-07-27
status: PASSED
---

# Phase 01 Plan 16: Contract Drift and Compatibility Gates Summary

**Generated contract bytes now have a non-mutating drift gate, while incompatible
contract evolution is independently rejected against a tamper-evident approved
baseline.**

## Performance

- **Duration:** 32 min
- **Tasks:** 3
- **Files modified:** 15
- **Status:** PASSED

## Accomplishments

- Added `contracts:check`, which regenerates all seven owned schema and language
  artifacts under a temporary root, compares deterministic paths and bytes, reports
  missing/extra/changed files, and scans production sources for handwritten transport
  declarations without rewriting the checkout.
- Added an executable compatibility engine with exactly two accepted and four breaking
  fixture cases covering additive optional fields, approved major transitions, removed
  fields, discriminator changes, weakened bounds, and unapproved envelope changes.
- Approved an immutable baseline manifest anchored to revision
  `75e63518992821e77b42d572af7571d817e456b9` with four SHA-256 verified JSON artifacts.
- Closed ADR 0002 with SemVer, deprecation, major-transition approval, closed-schema,
  ownership, baseline update, and oasdiff 1.26.0 policies.
- Wired `contracts:check` and `contracts:compat` independently into root `pnpm verify`.

## TDD Evidence

### Task 01-16-01

- **RED:** `8b4a362` — drift behavior test failed because `check-drift.ts` did not exist.
- **GREEN:** `0441781` — isolated generation, byte/path comparison, and handwritten
  declaration detection passed.
- **REFACTOR:** `660c4ad` — formatted the drift test without behavior changes.

### Task 01-16-02

- **RED:** `0e7907a` — accepted/breaking fixture matrix failed because the compatibility
  engine did not exist.
- **GREEN:** `715cc97` — compatibility engine accepted 2/2 allowed cases and rejected
  4/4 deliberate breaking cases with deterministic diagnostics.

## Task Commits

1. **Task 01-16-01: Non-mutating regeneration drift detection**
   - `8b4a362` test(01-16): define contract drift gate behavior
   - `0441781` feat(01-16): add isolated contract drift gate
   - `660c4ad` style(01-16): format drift gate test
2. **Task 01-16-02: Accepted and breaking compatibility fixtures**
   - `0e7907a` test(01-16): define compatibility fixture matrix
   - `715cc97` feat(01-16): enforce contract compatibility fixtures
3. **Task 01-16-03: Approved baseline and ADR 0002**
   - `dbb7cbc` docs(01-16): approve versioned contract baseline

## Verification

- `rtk pnpm contracts:check` — passed; 7 generated artifacts matched without checkout
  mutation.
- `rtk pnpm --filter @liiiraa/contract-compat test -- --run` — passed; exactly 2
  accepted and 4 breaking cases executed.
- `rtk pnpm contracts:compat` — passed against the approved revision and hashes.
- `rtk pnpm verify` — passed all workspace, architecture, generation, type, lint,
  formatting, test, and build gates.
- Independence proof A: with an extra generated file, `contracts:compat` stayed green
  while `contracts:check` rejected the extra path.
- Independence proof B: with clean generated output, `contracts:check` stayed green
  while the compatibility engine rejected all four deliberate breaking cases.

## Decisions Made

- Stored baseline bytes indirectly through an immutable Git revision plus exact hashes
  instead of duplicating large generated documents inside the manifest. This keeps the
  baseline compact while preventing a mutable checkout from approving itself.
- Skipped oasdiff execution only when HTTP documents are byte-semantically identical.
  Any HTTP change invokes the pinned external gate and fails closed if it is absent.
- Required bounds to remain exact inside a major version because broadening accepts
  values previously rejected by the trust boundary.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 2 - Missing Critical Functionality] Added executable drift behavior test**

- **Found during:** Task 01-16-01 RED
- **Issue:** The plan marked the task TDD but did not list a test file.
- **Fix:** Added `check-drift.test.ts` with deterministic missing, extra, changed, clean,
  and handwritten-declaration assertions.
- **Verification:** Package test and root verify pass.
- **Committed in:** `8b4a362`

**2. [Rule 2 - Missing Critical Functionality] Added narrow Node type shims**

- **Found during:** Tasks 01-16-01 and 01-16-02
- **Issue:** Strict TypeScript had no approved `@types/node` dependency.
- **Fix:** Extended package-local shims only for the Node APIs used by each gate.
- **Verification:** Both package checks and root verify pass.
- **Committed in:** `0441781`, `715cc97`, `dbb7cbc`

---

**Total deviations:** 2 auto-fixed missing critical functionality items.

## Issues Encountered

- `oasdiff` 1.26.0 is not installed on the current machine. The current OpenAPI
  baseline is identical and has no operations, so no analyzer invocation is needed.
  The gate explicitly fails closed on the first changed HTTP artifact until the pinned
  binary is provisioned.

## Next Phase Readiness

- Plan 01-18 can consume the stable schemas for runtime validator parity.
- Future HTTP operation work must provision oasdiff 1.26.0 before updating the
  approved baseline.
- No blocker remains for the rest of Phase 1.

## Self-Check: PASSED

- All declared implementation artifacts exist.
- TDD RED and GREEN commits are present in order for both TDD tasks.
- Both gates pass independently on clean output and reject their deliberate failure
  conditions independently.
- Root `pnpm verify` passes.

---

_Phase: 01-product-truth-and-modular-contracts_
_Completed: 2026-07-27_
