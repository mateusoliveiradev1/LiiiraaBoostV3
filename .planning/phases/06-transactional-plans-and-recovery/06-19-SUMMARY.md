---
phase: 06-transactional-plans-and-recovery
plan: "19"
subsystem: desktop-ui
tags: [react, plan-authority, recovery, accessibility, tdd]

requires:
  - phase: 06-11
    provides: PlanAuthority immutable snapshots, intents, and event subscriptions
  - phase: 06-17
    provides: transactional plan and recovery presentation primitives
  - phase: 06-22
    provides: approved UI contract and executable approval validator
provides:
  - Authority-backed Improve review, approval, execution, restart, and receipt states
  - Unified Recovery Center for active recovery, conflicts, restore, receipts, and diagnostics
  - Transactional UI regression coverage for fail-closed authority behavior
affects: [desktop-shell, plan-engine-integration, recovery-journal]

tech-stack:
  added: []
  patterns:
    - useSyncExternalStore subscriptions over immutable PlanAuthority snapshots
    - renderer emits typed intents and renders validated immutable documents only
    - missing receipts and checkpoints fail closed with explicit reasons

key-files:
  created:
    - packages/feature-shell/src/features/transactional-plans.test.tsx
  modified:
    - packages/feature-shell/src/features/improve.tsx
    - packages/feature-shell/src/features/recover.tsx

key-decisions:
  - "Authoritative Improve and Recovery branches consume immutable PlanAuthority snapshots and emit intents; legacy preview branches remain only when no authority is supplied."
  - "Receipts, checkpoints, journals, and revocations render only from typed validated documents; absent authority evidence produces disabled or pending states instead of synthetic success."
  - "Extreme plans remain structurally non-executable, while proportional gates and exact confirmation language apply to lower risk levels."

patterns-established:
  - "Authority surface: subscribe through stable useSyncExternalStore callbacks and clean up transaction event subscriptions on reconnect or unmount."
  - "Recovery truth: distinguish operation restore, plan restore, and checkpoint restore, each with explicit authority and missing-evidence behavior."

requirements-completed: [PLAN-01, PLAN-02, PLAN-03, PLAN-04, PLAN-05, PLAN-07, PLAN-08]

duration: 12m
completed: 2026-08-13
---

# Phase 6 Plan 19: Authoritative Transactional UI Summary

**Checker-admitted Improve and Recovery workspaces now render immutable PlanAuthority truth, emit typed intents, and fail closed across approval, execution, restart, receipt, conflict, and restore states.**

## Performance

- **Duration:** 12 minutes
- **Started:** 2026-08-13T16:47:29Z
- **Completed:** 2026-08-13T16:59:03Z
- **Tasks:** 2
- **Files modified:** 3

## Accomplishments

- Connected Improve to immutable plan revisions, evidence, risk, approval freshness, execution stages, restart choices, cancellation, and verified receipt truth.
- Built a unified Recovery Center that leads with the current safety verdict and supports active timelines, affected groups, conflict decisions, distinct restore scopes, immutable receipts, revocation continuity, and redacted local diagnostics.
- Added nine focused transactional UI tests and preserved complete legacy feature-shell compatibility while removing preview/demo claims from authoritative rendering.
- Applied the Vercel React best-practices checklist to stabilize external-store callbacks and subscriptions, avoid conditional hooks, and keep disabled-control explanations accessible.

## Task Commits

Each task was committed atomically through RED, GREEN, and the final shared refactor:

1. **Task 1: Build the truthful plan workspace**
   - `59445af8` — `test(06-19): specify authoritative plan workspace`
   - `95b7dbc8` — `feat(06-19): connect Improve to plan authority`
2. **Task 2: Build the unified Recovery Center**
   - `45034358` — `test(06-19): specify unified Recovery Center`
   - `3c4df399` — `feat(06-19): build unified Recovery Center`
3. **Shared React/accessibility refactor**
   - `ec42ee3f` — `refactor(06-19): stabilize authority subscriptions`

## Files Created/Modified

- `packages/feature-shell/src/features/improve.tsx` — authoritative review, approval, execution, restart, and receipt workspace.
- `packages/feature-shell/src/features/recover.tsx` — unified recovery, conflict, restore, receipt, revocation, and diagnostic workspace.
- `packages/feature-shell/src/features/transactional-plans.test.tsx` — regression contract for authoritative and fail-closed transactional UI.

## Decisions Made

- Kept the existing legacy renderers as compatibility fallbacks only when no `PlanAuthority` is supplied; checker-admitted authoritative paths contain no preview or demo claims.
- Accepted already validated transactional recovery documents as typed renderer input because the current `PlanAuthoritySnapshot` intentionally contains plan, approval, transaction, progress, and diagnostic state but not immutable receipt/checkpoint/journal bodies.
- Used exact immutable references and typed intents at every mutation boundary; the renderer never decides authorization, approval validity, rollback eligibility, or receipt truth.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Corrected RED assertions that overmatched valid UI infrastructure**

- **Found during:** Tasks 1 and 2 RED/GREEN transitions
- **Issue:** Initial assertions treated every checkbox in an Extreme plan as an execution control and interpreted CSS/SVG percentage syntax as fabricated progress.
- **Fix:** Scoped assertions to executable confirmation controls and visible progress copy, then aligned locale capitalization and diagnostic-state expectations with the approved contract.
- **Files modified:** `packages/feature-shell/src/features/transactional-plans.test.tsx`
- **Commits:** `95b7dbc8`, `3c4df399`

**2. [Rule 2 - Missing Critical] Added typed validated-document input for immutable recovery truth**

- **Found during:** Tasks 1 and 2
- **Issue:** `PlanAuthoritySnapshot` does not carry receipt, checkpoint, journal, or revocation document bodies, so rendering those claims from snapshot metadata would either fabricate truth or omit required recovery evidence.
- **Fix:** Added a typed `validatedDocuments` input and fail-closed missing-document states; only matching immutable documents can produce receipt or restore claims.
- **Files modified:** `packages/feature-shell/src/features/improve.tsx`, `packages/feature-shell/src/features/recover.tsx`, `packages/feature-shell/src/features/transactional-plans.test.tsx`
- **Commits:** `95b7dbc8`, `3c4df399`

**3. [Rule 1 - Bug] Stabilized React subscriptions and disabled-control semantics**

- **Found during:** React best-practices and owned-file lint review
- **Issue:** Direct external-store method references were unbound, the legacy Recovery branch made hook ordering conditional, and the shared button abstraction did not forward `aria-describedby` for blocked actions.
- **Fix:** Wrapped store accessors in stable callbacks, extracted the legacy branch, deduplicated event subscriptions with cleanup, and used semantic disabled buttons carrying explicit descriptions.
- **Files modified:** `packages/feature-shell/src/features/improve.tsx`, `packages/feature-shell/src/features/recover.tsx`
- **Commit:** `ec42ee3f`

## Verification

- Approval validator passed before and after implementation with approved subject `aafe1e0e...` and report `6e9ae150...`.
- Transactional UI tests: 9/9 passed.
- Feature-shell tests: 101/101 passed.
- Phase 06-22 validator tests: 63/63 passed.
- Full monorepo tests: 56/56 Turbo tasks passed.
- Strict workspace type checks: 28/28 Turbo tasks passed.
- Owned TSX ESLint, Prettier, and `git diff --check` passed.

## Issues Encountered

- Root `pnpm check` reaches two unrelated pre-existing lint errors in `packages/desktop-client/src/plans.ts` (`no-import-type-side-effects`) and `tooling/architecture-tests/src/check-cargo.ts` (`no-unsafe-assignment`). The owned TSX lint gate, strict type gates, and full test suite pass; these files were not changed because they are outside Plan 06-19 scope.

## Known Stubs

None. Missing receipt/checkpoint copy and disabled actions are intentional fail-closed absence states, not placeholder data.

## Threat Surface

No new network endpoint, authentication path, file access pattern, schema, or privileged boundary was introduced. The renderer only consumes existing typed authority/documents and emits existing typed intents.

## Next Phase Readiness

- The desktop shell can mount checker-admitted Improve and Recovery surfaces by supplying the existing `PlanAuthority` and validated transactional recovery documents.
- Real engine integration can replace deterministic adapters without changing renderer authorization or evidence semantics.

## Self-Check: PASSED

- Summary file exists at the required phase path.
- All five task/TDD commits resolve in repository history.
- Created and modified key files exist and are covered by passing tests and strict type checks.
