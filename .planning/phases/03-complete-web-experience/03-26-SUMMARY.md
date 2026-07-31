---
phase: 03-complete-web-experience
plan: '26'
subsystem: web-ui
tags: [xstate, react, accessibility, preview-authority, no-change-receipts]
requires:
  - phase: 03-10
    provides: account and admin shell boundaries
  - phase: 03-13
    provides: deterministic web preview scenarios
  - phase: 03-18
    provides: shared semantic workflow and receipt components
provides:
  - Closed XState workflow for every Phase 4-dependent account and admin action family
  - Guarded purpose, consent, role, viewport, freshness, and confirmation policies
  - Bilingual accessible review, recovery, cancellation, and immutable no-change receipt UI
affects: [phase-04-authority, account-journeys, admin-journeys, web-e2e]
tech-stack:
  added: []
  patterns:
    - Structural FutureAuthorityPort injection keeps preview runtime code outside production packages
    - Final-state output union permits only cancellation or schema-valid no-change receipts
key-files:
  created:
    - packages/web-features/src/preview-machine.ts
    - packages/web-features/src/preview-machine.test.ts
    - packages/web-features/src/preview-workflows.tsx
  modified:
    - packages/web-features/src/index.ts
key-decisions:
  - 'Keep the FutureAuthorityPort structurally owned by web-features so fixture adapters can implement it without entering production bundles.'
  - 'Preserve only explicitly allowlisted safe draft fields across offline, stale, expired-session, and retryable failure states.'
  - 'Reject every authority result except a runtime schema-valid Phase 4 no-change receipt with remoteStateChanged false.'
patterns-established:
  - 'Preview policy table: each sensitive action family declares its proportional confirmation and prerequisite guards.'
  - 'Accessible preview composition: error summary links, repeated authority boundary, assertive blocking failures, polite terminal receipts.'
requirements-completed: [WEB-08]
duration: 13min
completed: 2026-07-31
status: complete
---

# Phase 03 Plan 26: Closed Preview Workflows Summary

**A guarded XState workflow and bilingual React composition now complete every Phase 4-dependent account/admin journey without any path to remote mutation.**

## Performance

- **Duration:** 13 min
- **Started:** 2026-07-31T07:44:55Z
- **Completed:** 2026-07-31T07:57:45Z
- **Tasks:** 2
- **Files modified:** 4 production/test files

## Accomplishments

- Added one exhaustive statechart covering editing, validation, review, simulated reauthentication, proportional confirmation, issuing, offline, stale, expired-session, partial failure, cancellation, and completion.
- Enforced action-family guards for required fields, purpose, impact, scoped consent, role, desktop viewport, freshness, and object-specific confirmation.
- Added abort-aware authority invocation and runtime receipt validation so the only completed result is a schema-valid receipt with `remoteStateChanged: false`.
- Added PT-BR/English accessible fields, linked error summaries, review diffs, consent details, focus targets, live regions, recovery paths, cancellation, and immutable no-change ledgers.

## Task Commits

Each task was committed atomically:

1. **Task 1 RED: failing preview workflow contract** — `096c5ca` (test)
2. **Task 1 GREEN: closed preview workflow machine** — `c4b99ec` (feat)
3. **Task 2: accessible preview workflow renderer** — `aab048e` (feat)
4. **Task 2 hardening: correction and focus paths** — `31c972a` (fix)

**Plan metadata:** committed with this summary.

## Files Created/Modified

- `packages/web-features/src/preview-machine.ts` — action policies, closed statechart, authority actor, guards, output union, safe-draft selector, and state projection.
- `packages/web-features/src/preview-machine.test.ts` — transition, mutation, abort, invalid-result, accessibility, localization, focus, and receipt invariants.
- `packages/web-features/src/preview-workflows.tsx` — accessible workflow, review, confirmation, failure, error-summary, field, and receipt compositions.
- `packages/web-features/src/index.ts` — public exports for the reusable machine and renderer.

## Decisions Made

- The production feature package owns a structural `FutureAuthorityPort`; the deterministic preview adapter can satisfy it without becoming a runtime dependency.
- Safe work preservation is allowlist-based. Sensitive values are not implicitly retained across recovery states.
- A typed `no-change` shape is insufficient on its own: the machine validates the receipt at runtime before entering `complete`.
- Action-specific confirmation metadata is centralized with the guards, preventing screen-local boolean drift or generic confirmation copy.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 2 - Missing Critical] Added correctable prerequisite fields and programmatic focus targets**

- **Found during:** Task 2 accessibility verification
- **Issue:** The first renderer surfaced purpose/impact/prerequisite failures, but purpose and impact were not yet editable within the reusable composition and its state-change focus container was not programmatically focusable.
- **Fix:** Added guarded purpose/impact edit events, labeled inputs, visible role/consent/viewport/freshness targets for every error-summary link, and a `tabIndex={-1}` focus target.
- **Files modified:** `preview-machine.ts`, `preview-machine.test.ts`, `preview-workflows.tsx`
- **Verification:** ESLint, Prettier, strict TypeScript, and all 27 package tests pass.
- **Committed in:** `31c972a`

---

**Total deviations:** 1 auto-fixed (1 missing critical accessibility/correctability issue).
**Impact:** The fix stays inside the planned workflow contract and makes its authored validation states operable.

## Issues Encountered

- `pnpm test:architecture` reports two expectation drifts that already exist at base commit `26f58c9`: the expected `apps/web` dependency list omits `@liiiraa/design-tokens`, and the expected `web:verify:quick` command predates the current evidence runner. These are unrelated to Plan 03-26 and are recorded in `deferred-items.md`.
- Plan-scoped architecture protection passed through `pnpm test:runtime-truth` (13 tests), proving the preview adapter boundary remains closed.

## Verification

- `pnpm --filter @liiiraa/web-features test -- --run -t "preview workflow machine"` — PASS
- `pnpm --filter @liiiraa/web-features test -- --run -t "preview workflow accessibility"` — PASS
- `pnpm --filter @liiiraa/web-features test -- --run` — PASS, 27 tests
- `pnpm --filter @liiiraa/web-features check` — PASS
- `pnpm --filter @liiiraa/web-features build` — PASS
- Scoped ESLint and Prettier checks — PASS
- `pnpm test:runtime-truth` — PASS, 13 fixture-boundary tests

## Known Stubs

None. The preview deliberately ends at the authored Phase 4 authority boundary; this is the plan's finished no-change behavior, not an unwired mutation stub.

## Threat Model Results

- **T-03-01:** Mitigated — the statechart has no authority-success output and validates every completed receipt.
- **T-03-09:** Mitigated — safe drafts are allowlisted and retry/cancel paths are deterministic.
- **T-03-SC:** Mitigated — no dependency was added and the runtime fixture-boundary suite passes.

No additional network, authentication, file-access, or schema trust boundary was introduced.

## User Setup Required

None — no external service configuration required.

## Next Phase Readiness

- Account and admin route plans can now compose finished sensitive journeys against one shared state and accessibility contract.
- Phase 4 can implement the structural authority port without changing Phase 3 terminal truth or UI copy.
- No Plan 03-26 blocker remains.

## Self-Check: PASSED

- All three created files and the modified barrel export exist.
- Commits `096c5ca`, `c4b99ec`, `aab048e`, and `31c972a` are present in git history.
- All plan-scoped tests, type checks, build, formatting, lint, and fixture-boundary checks pass.

---

_Phase: 03-complete-web-experience_
_Completed: 2026-07-31_
