---
phase: 02-complete-desktop-experience
plan: "16"
subsystem: desktop-testing
tags: [tauri-driver, windows, authenticode, evidence, node-test, fail-closed]
requires:
  - phase: 02-complete-desktop-experience
    provides: Bounded generated shell protocol from Plan 02-24
  - phase: 02-complete-desktop-experience
    provides: Root-reachable desktop verification lifecycle from Plan 02-15
provides:
  - Bounded tauri-driver 2.0.6 adapter with generated shell lifecycle fixtures
  - Unresolved Windows 10, Windows 11, and free local development-signing matrix
  - Mutation-tested reviewed-environment, observed-manual, and planned dry-run verifier
affects: [02-26, 02-33, packaged-windows-acceptance, phase-02-evidence]
tech-stack:
  added: []
  patterns:
    - Exact-cardinality reviewed environment records with deterministic diagnostics
    - Manual observations are validated from supplied files without creating evidence
    - Browser evidence can never substitute for packaged Windows evidence
key-files:
  created:
    - apps/desktop/tests/packaged/driver.ts
    - apps/desktop/tests/packaged/windows-matrix.json
    - tooling/desktop-evidence/verify-packaged-wave-zero.mjs
    - tooling/desktop-evidence/verify-packaged-wave-zero.test.mjs
  modified:
    - eslint.config.mjs
key-decisions:
  - "Keep Wave 0 dry-run strictly planned and report every unavailable packaged prerequisite without invoking tauri-driver."
  - "Accept development signing only as local CurrentUser CNG custody with false public-trust, SmartScreen, production, and distribution claims."
  - "Allow timestamping only when it is not applicable or backed by explicit official-free evidence; otherwise fail closed."
patterns-established:
  - "Environment gate: exactly one reviewed Windows 10 image, one reviewed Windows 11 image, and one reviewed local development-signing record."
  - "Manual gate: exact observed check catalog with packaged provenance and reachable, contained attachment references."
requirements-completed: [UX-01, UX-09, UX-10, UX-11, UX-12]
duration: 9min
completed: 2026-07-28
status: complete
---

# Phase 02 Plan 16: Packaged Windows Wave 0 Harness Summary

**A bounded tauri-driver adapter and 44-case evidence verifier now distinguish planned, reviewed, and observed packaged Windows proof without inventing public signing trust.**

## Performance

- **Duration:** 9 min
- **Started:** 2026-07-28T02:55:17Z
- **Completed:** 2026-07-28T03:04:28Z
- **Tasks:** 2
- **Files modified:** 5

## Accomplishments

- Added an unresolved Windows 10/11 matrix with explicit WebView2, runner, image, and local development-signing boundaries.
- Added a dry-run packaged driver that consumes generated `ShellStartupState` and `ShellWindowState` fixtures while reporting `packagedAcceptance: false`.
- Added reviewed-environment validation for exact Windows and self-signed CurrentUser CNG evidence, including secret-field rejection.
- Added observed-manual validation for Authenticode, non-elevation, startup, single instance, tray, deep link, performance, NVDA, forced-colors, and scale records.
- Covered 44 positive and mutation cases with stable fail-closed diagnostics.

## Task Commits

Each task was committed atomically:

1. **Task 1: Configure the bounded packaged driver and reviewed-image schema** — `71d58a3` (`feat`)
2. **Task 2 RED: Specify packaged evidence gates** — `40c3233` (`test`)
3. **Task 2 GREEN: Implement the Wave 0 evidence verifier** — `d20f45f` (`feat`)
4. **Task 2 coverage: Cover every reviewed image/signing omission** — `4e8d26d` (`test`)
5. **Task 2 lint fix: Configure the standalone strip-types driver** — `f3d5b47` (`fix`)

## TDD Gate Compliance

- **RED:** `40c3233` introduced the CLI and mutation contract; all 26 initial cases failed because the verifier did not yet exist.
- **GREEN:** `d20f45f` implemented the three bounded modes and made all initial cases pass.
- **Coverage:** `4e8d26d` expanded the suite to 44 passing cases across every required Windows, signing, timestamp, provenance, and attachment invariant.

## Files Created/Modified

- `apps/desktop/tests/packaged/driver.ts` — Dry-run-safe tauri-driver adapter and generated shell lifecycle fixtures.
- `apps/desktop/tests/packaged/windows-matrix.json` — Unresolved reviewed-image/signing contract plus the planned manual-check catalog.
- `tooling/desktop-evidence/verify-packaged-wave-zero.mjs` — Planned, reviewed-environment, and observed-manual CLI verifier.
- `tooling/desktop-evidence/verify-packaged-wave-zero.test.mjs` — Positive, omission, mutation, secret, browser-substitution, and attachment coverage.
- `eslint.config.mjs` — Narrow non-type-aware lint treatment for the standalone Node strip-types driver.

## Decisions Made

- The driver never discovers ambient machine truth during dry-run; it consumes only the versioned matrix and generated schema.
- A reviewed signing record must remain self-signed development evidence in `Cert:\CurrentUser\My`, with a non-exportable CNG key and no CI private-key access.
- No paid provider, public trust, SmartScreen reputation, production readiness, or distribution permission is accepted in Phase 2.
- Manual validation reads supplied observations and verifies attachment reachability, but creates no observation or attachment.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] Added a narrow lint override for the standalone Node strip-types driver**

- **Found during:** Overall verification after Task 2
- **Issue:** The repository has no approved direct `@types/node` dependency, so type-aware ESLint could not resolve Node built-ins in the standalone `driver.ts`.
- **Fix:** Disabled only type-information-dependent ESLint rules for this single Node strip-types entrypoint; syntax, ordinary ESLint rules, repository lint, and runtime tests remain active.
- **Files modified:** `eslint.config.mjs`
- **Verification:** Focused ESLint and full `pnpm lint` both pass.
- **Committed in:** `f3d5b47`

---

**Total deviations:** 1 auto-fixed (1 blocking)

**Impact on plan:** The adjustment preserves the approved free dependency set and keeps repository-wide lint green without broadening runtime behavior.

## Issues Encountered

- Node 24.16.0 reported the expected missing-module failures during the TDD RED gate.
- No package install, authentication gate, paid service, clean-machine execution, or certificate creation was needed.

## Known Stubs

None. The unresolved image/signing rows and planned manual checks are the intended fail-closed prerequisite model, not product-data placeholders.

## Authentication Gates

None.

## User Setup Required

None for this plan. Future reviewed/observed gates require controlled Windows evidence, but this plan intentionally creates no machine observation and purchases no service.

## Verification

- `rtk node --test tooling/desktop-evidence/verify-packaged-wave-zero.test.mjs` — passed, 44 tests.
- `rtk pnpm --filter @liiiraa/desktop test:wave-zero -- --packaged-schema` — passed with planned status and no driver execution.
- `rtk node tooling/desktop-evidence/verify-packaged-wave-zero.mjs --dry-run` — passed with all six prerequisite families reported.
- `rtk pnpm lint` — passed.
- `rtk pnpm test:architecture` — passed, 34 tests and both live adapters.
- `rtk pnpm contracts:check` — passed, 8 generated artifacts unchanged.
- Focused Prettier checks — passed.

## Next Phase Readiness

- Plan 02-26 can attach reviewed Windows 10/11 image records to the exact environment contract.
- Plan 02-33 can bind the free local CNG certificate evidence without introducing CI key access or release claims.
- Later human gates can attach observed packaged evidence to the exact manual catalog without retrofitting the verifier.

## Self-Check: PASSED

- All four declared Plan 02-16 artifacts exist.
- Task commits `71d58a3`, `40c3233`, `d20f45f`, `4e8d26d`, and `f3d5b47` exist in repository history.
- No unexpected deletion, untracked output, paid dependency, or packaged acceptance claim exists.

---

_Phase: 02-complete-desktop-experience_
_Completed: 2026-07-28_
