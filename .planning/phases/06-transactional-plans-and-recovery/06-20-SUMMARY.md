---
phase: 06-transactional-plans-and-recovery
plan: '20'
subsystem: testing
tags: [playwright, vitest, tauri, packaged-windows, accessibility, recovery, promotion]
requires:
  - phase: 06-18
    provides: Native PlanAuthority, recovery-first Tauri lifecycle, authenticated broker, and closed command capability
  - phase: 06-19
    provides: Authoritative Improve and Recovery surfaces over validated immutable documents
  - phase: 06-22
    provides: Exact-byte approved Phase 6 UI contract and read-only authority validator
  - phase: 06-25
    provides: Accessible device-local Advanced preference lifecycle
provides:
  - Deterministic browser witness covering all approved plan, execution, recovery, receipt, presentation, and D-13 lifecycle states
  - Guarded packaged harness validating generated documents, exact Tauri authority, broker failure drills, GUID identity, restore-point observations, and ordered promotion
  - Bounded redacted evidence that cannot represent deterministic fixtures as physical Windows proof or enable mutation without an exact physical-stage checkpoint
affects: [06-21, 06-26, 06-27, 06-28, phase6-evidence, packaged-windows]
tech-stack:
  added: []
  patterns:
    [
      explicit-run-kind,
      disabled-by-default-physical-hooks,
      ordered-promotion-checkpoint,
      bounded-redacted-evidence,
    ]
key-files:
  created:
    - apps/desktop/tests/browser/transactional-plans.spec.ts
    - apps/desktop/tests/packaged/transactional-plans.ts
    - apps/desktop/tests/packaged/transactional-plans.test.ts
  modified: []
key-decisions:
  - 'Label every browser witness as deterministic test composition and explicitly not physical Windows evidence.'
  - 'Require the exact ordered promotion predecessors and a stage-matching human checkpoint before any physical mutation callback can be reached.'
  - 'Emit only exact build/version/GUID identity, hashed client identity, bounded drill results, and an allowlisted redaction declaration.'
patterns-established:
  - 'Sequence-gap browser drills perform one authoritative snapshot read and zero mutation calls.'
  - 'Packaged physical hooks default closed and cannot be widened by a deterministic or fixture run kind.'
requirements-completed: [PLAN-01, PLAN-02, PLAN-03, PLAN-04, PLAN-05, PLAN-06, PLAN-07, PLAN-08]
duration: 8 min
completed: 2026-08-13
status: complete
---

# Phase 06 Plan 20: Browser and Packaged Transactional Evidence Summary

**Eighty-five deterministic browser journeys and a guarded packaged Windows harness now exercise the complete plan/apply/restart/recover/receipt story while keeping physical mutation and promotion evidence fail closed.**

## Performance

- **Duration:** 8 min
- **Started:** 2026-08-13T18:02:50Z
- **Completed:** 2026-08-13T18:10:24Z
- **Tasks:** 2
- **Files modified:** 3

## Accomplishments

- Added named Playwright coverage for every approved composition, review, confirmation, D-13 Advanced preference, execution, restart, recovery, receipt/export, viewport, locale, contrast, motion, keyboard, and scaling state.
- Proved sequence gaps request one snapshot without mutation, Advanced enable/revoke remains non-optimistic, posture invalidation blocks apply without blocking recovery, and Extreme has no execution control.
- Added a packaged harness that validates generated transactional documents, all 14 Tauri command/capability identities, deterministic broker identity/replay/session rejection, failure drills, exact power-scheme GUID order, and observed restore-point states.
- Made physical mutation disabled by default and unreachable from deterministic evidence; later stages must present the exact ordered predecessor chain plus a stage-matching promotion checkpoint.
- Produced bounded evidence containing exact build SHA-256, operation version, run kind, GUID observations, hashed client identity, and explicit redactions without raw credentials, hardware identifiers, or Windows user SID.

## Task Commits

1. **Task 1: Cover every plan, Advanced-preference, and recovery UI state** - `2f6b2ee8` (test)
2. **Task 2: Add packaged native journey hooks and failure drills** - `a334a68f` (test)

## Files Created/Modified

- `apps/desktop/tests/browser/transactional-plans.spec.ts` - Explicitly deterministic browser composition with 85 named state, interaction, accessibility, scale, and provenance journeys.
- `apps/desktop/tests/packaged/transactional-plans.ts` - Generated-schema and Tauri-identity gates, deterministic broker probe, physical promotion guard, Windows observation hooks, and bounded evidence builder.
- `apps/desktop/tests/packaged/transactional-plans.test.ts` - Twelve focused adversarial tests for default denial, fixture refusal, stage order, checkpoints, exact identity, redaction, GUIDs, restore points, and failure drills.

## Decisions Made

- Browser evidence uses an isolated deterministic witness marked `NOT PHYSICAL WINDOWS EVIDENCE`; it never relabels fixture output as native or physical proof.
- The physical hook accepts an effect callback only after the run kind is a physical stage, predecessors are exact and ordered, mutation is explicitly enabled, and the checkpoint matches that same stage.
- Broker client identity is retained only as SHA-256; raw client identity, credentials, serials, machine GUID, and user SID are excluded from serialized evidence.
- Packaged tests validate representative test-owned documents only through the public `@liiiraa/contracts-ts/generated` API; private contracts fixture paths are not test dependencies.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Excluded the redaction declaration from raw-secret scanning**

- **Found during:** Task 2 focused packaged tests
- **Issue:** The initial evidence guard rejected its own allowlisted `credentials`, `raw-hardware-identifiers`, and `windows-user-sid` redaction labels as if they were leaked values.
- **Fix:** Scan the actual redacted payload without the declaration field while continuing to serialize and assert the declaration.
- **Files modified:** `apps/desktop/tests/packaged/transactional-plans.ts`
- **Verification:** Focused packaged suite passes 12/12 and serialized evidence remains under 64 KiB with no raw identity values.
- **Committed in:** `a334a68f`

**2. [Rule 1 - Bug] Reused the accepted nonce in the replay drill**

- **Found during:** Task 2 broker adversarial test
- **Issue:** The first replay vector generated a different nonce, so it modeled a second legitimate message instead of replaying the accepted envelope.
- **Fix:** Use one exact accepted nonce for the legitimate request and replay attempt; the replay now fails before a second dispatch.
- **Files modified:** `apps/desktop/tests/packaged/transactional-plans.ts`
- **Verification:** Broker test records one accepted mutation followed by four pre-dispatch rejections.
- **Committed in:** `a334a68f`

**3. [Rule 1 - Bug] Removed a private contracts fixture deep import**

- **Found during:** Post-plan workspace architecture gate
- **Issue:** The packaged smoke test imported `packages/contracts-ts/src/fixtures/transactional-plans/valid.json` directly, violating the contracts package's public-boundary rule.
- **Fix:** Replace the private corpus dependency with a frozen test-owned representative progress snapshot validated through `@liiiraa/contracts-ts/generated`, plus an adversarial additional-property rejection.
- **Files modified:** `apps/desktop/tests/packaged/transactional-plans.test.ts`
- **Verification:** Focused packaged tests pass 12/12, architecture tests pass 51/51, fixture-guard tests pass 13/13, and the full pnpm workspace test graph passes 56/56 tasks.
- **Committed in:** `6f3a3eb`

---

**Total deviations:** 3 auto-fixed correctness bugs. **Impact on plan:** The fixes strengthen spoofing/tampering and package-boundary enforcement; no product authority, dependency, or physical evidence was widened.

## Issues Encountered

- The desktop browser-test composition does not yet inject native `PlanAuthority` into the routed app shell. The exhaustive Playwright matrix therefore uses a test-owned deterministic witness rather than relabeling the legacy preview as authoritative. Actual authoritative React behavior remains covered by the 115-test feature-shell suite from Plan 06-25; physical and packaged proof remains reserved for Plans 06-26 through 06-28.

## Verification

- `rtk pnpm --filter @liiiraa/desktop exec playwright test tests/browser/transactional-plans.spec.ts --grep "@smoke" --workers=1` - **PASS**, 2/2.
- `rtk pnpm --filter @liiiraa/desktop exec playwright test tests/browser/transactional-plans.spec.ts --workers=1` - **PASS**, 85/85; axe serious/critical checks and horizontal-scroll assertions passed across required presentations.
- `rtk pnpm --filter @liiiraa/desktop exec vitest --run tests/packaged/transactional-plans.test.ts` - **PASS**, 12/12.
- `rtk pnpm test:architecture` - **PASS**, 51/51; workspace and Cargo architecture adapters also passed.
- `rtk pnpm --filter @liiiraa/fixture-guard test -- --run` - **PASS**, 13/13.
- `rtk pnpm --filter @liiiraa/desktop test` - **PASS**, 170/170 across 20 files.
- `rtk pnpm test` - **PASS**, 56/56 workspace tasks.
- `rtk cargo test --workspace` - **PASS**, 346/346 across 41 suites.
- `rtk pnpm --filter @liiiraa/desktop check` - **PASS**.
- Exact Phase 06-22 UI authority validator - **PASS** with subject `aafe1e0e...` and report `6e9ae150...`.
- Prettier and `git diff --check` - **PASS** for all three owned files.
- No Docker command or environment participated in the verification matrix.

## Authentication Gates

None.

## User Setup Required

None - physical Windows promotion is intentionally deferred to the explicit clean-VM, owner-PC, and friends-PC plans.

## Known Stubs

None. Deterministic callbacks and observed failure statuses are deliberate test harness ports; they cannot claim or execute physical mutation without later promotion authority.

## Threat Flags

None. The new test-harness-to-physical-evidence boundary and physical hook are the declared T-06-20A/B surfaces and are covered by default-denial, provenance, stage-order, checkpoint, identity, and redaction tests.

## Next Phase Readiness

- Plan 06-21 can consume deterministic browser and packaged evidence shapes without accepting fixture evidence as physical.
- Plans 06-26 through 06-28 have closed real-Windows hooks for exact GUIDs, service identity, replay/session cases, crash/reboot/drift/disk-full, restore-point status, and ordered promotion.
- No blocker remains for the deterministic evidence evaluator; physical stage PASS remains intentionally unclaimed.

## Self-Check: PASSED

- All three created files exist.
- Task commits `2f6b2ee8` and `a334a68f` resolve in repository history.
- All task acceptance criteria and plan-level verification commands pass.
- User-owned `apps/account/.gitignore`, `apps/admin/.gitignore`, and `apps/web/.gitignore` remain untouched and unstaged.

---

_Phase: 06-transactional-plans-and-recovery_
_Completed: 2026-08-13_
