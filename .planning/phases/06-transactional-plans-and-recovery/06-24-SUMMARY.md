---
phase: 06-transactional-plans-and-recovery
plan: '24'
subsystem: desktop-native
tags: [tauri, rust, typescript, advanced-preference, strong-auth, device-posture]
requires:
  - phase: 06-11
    provides: Renderer-safe PlanAuthority and deterministic adapter boundary
  - phase: 06-18
    provides: Least-privilege native plan executor and recovery command surface
  - phase: 06-23
    provides: Durable device-local Advanced preference store and proof-authorized lifecycle
provides:
  - Three exact least-privilege Tauri commands for reading, enabling, and revoking Advanced preference
  - Native startup, read, and pre-apply posture revalidation over the durable D-13 authority
  - Closed renderer-safe Advanced preference projection with strict unknown-payload rejection
  - Non-optimistic enable/revoke and one-time restart rehydration through PlanAuthority
affects: [06-20, 06-25, 06-26, 06-27, 06-28, advanced-ui, plan-admission]
tech-stack:
  added: []
  patterns:
    - Native-only strong-auth proof consumption behind a dedicated plan-auth boundary
    - Exact command capability allowlisting with generated Tauri permission manifests
    - Frozen closed renderer projection validated before any authority state is published
key-files:
  created: []
  modified:
    - apps/desktop/src-tauri/src/plan_commands.rs
    - apps/desktop/src-tauri/src/plan_executor.rs
    - apps/desktop/src-tauri/src/main.rs
    - apps/desktop/src-tauri/src/plan_auth.rs
    - apps/desktop/src-tauri/build.rs
    - apps/desktop/src-tauri/capabilities/main.json
    - apps/desktop/src-tauri/tests/advanced_preference.rs
    - apps/desktop/src-tauri/tests/recovery_executor.rs
    - apps/desktop/src-tauri/tests/shell_contract.rs
    - packages/desktop-client/src/plans.ts
    - packages/desktop-client/src/plans.test.ts
    - packages/desktop-client/src/index.ts
    - packages/feature-shell/src/features/transactional-plans.test.tsx
key-decisions:
  - 'Expose exactly read, enable, and revoke preference commands; keep device posture, credentials, and consumed proof material native-only.'
  - 'Recompute device posture on startup, read, and immediately before apply; invalidated or unavailable preference authority blocks new Advanced apply work.'
  - 'Publish one closed native-attributed projection to the renderer and mutate cached authority only after a validated native response.'
  - 'Never gate local recovery on Advanced preference, authentication, subscription, or connectivity.'
patterns-established:
  - 'Renderer preference intent carries only action context, opaque one-use proof reference, expected sequence, and request time.'
  - 'PlanAuthority restart rehydration is idempotent: the first successful reopen performs one native read and later reopens reuse the frozen projection.'
requirements-completed: [PLAN-04, PLAN-05, PLAN-06]
duration: 18 min
completed: 2026-08-13
status: complete
---

# Phase 06 Plan 24: Native Advanced Preference PlanAuthority Summary

**The durable D-13 Advanced preference now reaches the desktop renderer through three least-privilege Tauri commands, native posture revalidation, one-use proof consumption, and a closed non-optimistic PlanAuthority projection that never exposes authority internals.**

## Performance

- **Duration:** 18 min
- **Started:** 2026-08-13T17:25:20Z
- **Completed:** 2026-08-13T17:43:00Z
- **Tasks:** 2 TDD tasks
- **Files modified:** 13

## Accomplishments

- Added exact `read_advanced_preference`, `enable_advanced_preference`, and `revoke_advanced_preference` native commands, matching Tauri capability permissions, and generated command permission manifests.
- Opened the Phase 06-23 preference store beside recovery state, revalidated native hardware and security posture at startup and reads, and revalidated again immediately before new plan apply admission.
- Consumed enable and revoke approvals through the native plan-auth boundary and returned only frozen state, reason, freshness, sequence, timestamp, and native provenance.
- Kept restore and recovery commands independent from preference, authentication, subscription, and network state.
- Extended `PlanAuthority` and both native and deterministic adapters with strict runtime projection validation, non-optimistic transitions, abort behavior, and one-time restart rehydration.
- Rejected fixture-origin authority on the native path, every unknown response field, and renderer attempts to submit hardware, security posture, credentials, reusable proof, enabled state, or cloud-sync authority.

## TDD Cycle

- **Task 1 RED:** Added native command allowlist, request-boundary, state transition, proof-redaction, restart, posture invalidation, and recovery-independence tests; compilation failed only on the missing preference command and authority types.
- **Task 1 GREEN:** Wired the durable native authority, exact Tauri commands/capabilities, startup/read/pre-apply revalidation, and native proof consumption; focused tests passed.
- **Task 2 RED:** Added renderer registry, strict projection, non-optimistic transition, abort, fixture rejection, and idempotent reopen tests; seven assertions failed against the missing client lifecycle.
- **Task 2 GREEN:** Implemented and exported the closed preference lifecycle through `PlanAuthority`; all 25 focused and 46 package tests passed.

## Task Commits

1. **Task 1 RED: Specify native Advanced preference commands** - `ce882fba` (test)
2. **Task 1 GREEN: Wire native Advanced preference authority** - `a0095f71` (feat)
3. **Task 2 RED: Specify renderer-safe preference lifecycle** - `eb96e637` (test)
4. **Task 2 GREEN: Project Advanced preference through PlanAuthority** - `0a4acdb3` (feat)
5. **Final gate fix: Keep proof consumption behind plan-auth** - `cd8a7860` (fix)
6. **Final gate regression: Bound preference command registration** - `33e47964` (test)
7. **Workspace gate regression: Align feature-shell authority fixture** - `bd134406` (test)

## Files Created/Modified

- `apps/desktop/src-tauri/src/plan_commands.rs` - Exact command registry plus deny-unknown intent validation.
- `apps/desktop/src-tauri/src/plan_executor.rs` - Native-only preference authority seam, revalidation, transition projection, and apply admission.
- `apps/desktop/src-tauri/src/main.rs` - Durable authority setup and three Tauri command handlers.
- `apps/desktop/src-tauri/src/plan_auth.rs` - Encapsulated native approval consumer so credential-backed proof handling stays outside the command layer.
- `apps/desktop/src-tauri/build.rs` - Generated Tauri permissions for the three new commands.
- `apps/desktop/src-tauri/capabilities/main.json` - Exact capability grants for read, enable, and revoke.
- `apps/desktop/src-tauri/tests/advanced_preference.rs` - Command/request boundary and lifecycle evidence.
- `apps/desktop/src-tauri/tests/recovery_executor.rs` - Startup/read/pre-apply revalidation and unconditional recovery evidence.
- `apps/desktop/src-tauri/tests/shell_contract.rs` - Exact native command registration regression.
- `packages/desktop-client/src/plans.ts` - Closed projection validator and PlanAuthority lifecycle.
- `packages/desktop-client/src/plans.test.ts` - Renderer boundary, non-optimistic, abort, and reopen evidence.
- `packages/desktop-client/src/index.ts` - Public preference lifecycle type exports.
- `packages/feature-shell/src/features/transactional-plans.test.tsx` - Explicit neutral preference projection in the downstream authoritative snapshot fixture.

## Decisions Made

- A preference proof reference is renderer input only; native code consumes it once and neither proof nor credential material enters command responses or the cached `PlanAuthoritySnapshot`.
- Native posture facts are recomputed from the Windows inventory source and represented externally only as `current`, `changed`, or `unavailable` binding freshness.
- Failed, aborted, malformed, fixture-origin, or unknown-field responses never optimistically change renderer authority.
- Recovery is intentionally outside preference admission so revoke, drift, offline state, and unavailable auth cannot remove rollback access.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 2 - Missing Critical] Generated permission manifests for the new Tauri commands**
- **Found during:** Task 1 GREEN
- **Issue:** Capability entries alone are not enforceable unless the application build manifest declares the command permissions Tauri generates.
- **Fix:** Added the exact three commands to `apps/desktop/src-tauri/build.rs`.
- **Files modified:** `apps/desktop/src-tauri/build.rs`
- **Committed in:** `a0095f71`

**2. [Rule 2 - Missing Critical] Exported the new preference lifecycle from the package root**
- **Found during:** Task 2 GREEN
- **Issue:** The implementation existed in `plans.ts`, but downstream consumers could not use the new public projection and intent types through the package boundary requested by the plan.
- **Fix:** Added type exports to `packages/desktop-client/src/index.ts`.
- **Files modified:** `packages/desktop-client/src/index.ts`
- **Committed in:** `0a4acdb3`

**3. [Rule 3 - Blocking] Corrected the owned client module's type-only import form**
- **Found during:** Task 2 GREEN verification
- **Issue:** The repository ESLint policy rejected inline type specifiers in the now-modified `plans.ts` import, blocking the required lint gate.
- **Fix:** Split the imported contracts into the required top-level `import type` form without changing behavior.
- **Files modified:** `packages/desktop-client/src/plans.ts`
- **Committed in:** `0a4acdb3`

**4. [Rule 1 - Bug] Restored the existing native proof-boundary architecture invariant**
- **Found during:** Final full Rust suite
- **Issue:** Directly naming the credential-backed Advanced approval consumer in `main.rs` violated the existing rule that the Tauri command layer cannot own native proof consumption.
- **Fix:** Added a narrow `NativeAdvancedPreferenceApproval` facade in `plan_auth.rs`; `main.rs` now requests consumption through that boundary and cannot access credentials.
- **Files modified:** `apps/desktop/src-tauri/src/plan_auth.rs`, `apps/desktop/src-tauri/src/main.rs`
- **Committed in:** `cd8a7860`

**5. [Rule 3 - Blocking] Advanced the exact native command registration regression**
- **Found during:** Final full Rust suite
- **Issue:** The shell contract still bounded the command surface at 31 and did not list the three plan-approved preference commands.
- **Fix:** Raised the exact bound to 34 and asserted all three names explicitly.
- **Files modified:** `apps/desktop/src-tauri/tests/shell_contract.rs`
- **Committed in:** `33e47964`

**6. [Rule 1 - Bug] Aligned the downstream feature-shell authority fixture**
- **Found during:** Wave 6 full workspace gate after plan completion
- **Issue:** The transactional plan UI test factory constructed a `PlanAuthoritySnapshot` without the newly required `advancedPreference` field, causing TypeScript TS2322 in `@liiiraa/feature-shell:check`.
- **Fix:** Added the explicit neutral `advancedPreference: null` projection to the fixture, preserving its intended no-preference-authority state.
- **Files modified:** `packages/feature-shell/src/features/transactional-plans.test.tsx`
- **Committed in:** `bd134406`

---

**Total deviations:** 6 auto-fixed (2 missing critical integration seams, 1 lint blocker, 2 regression bugs, 1 regression blocker).
**Impact on plan:** Every deviation closes an existing build, export, lint, or architecture gate around the planned surface; no generic setter, new dependency, cloud sync, localStorage, or renderer authority was added.

## Issues Encountered

- The final full Rust suite exposed two exact architectural regressions that focused tests could not see: the proof consumer belonged behind `plan_auth`, and the shell command count needed to include the three explicitly approved commands. Both were fixed with narrow regression coverage.
- The later Wave 6 workspace gate exposed one downstream typed fixture that needed to model the new required projection explicitly; no production feature-shell behavior changed.

## Verification

- `rtk cargo test -p liiiraa-desktop --test advanced_preference` - **PASS**, 17/17.
- `rtk cargo test -p liiiraa-desktop --test recovery_executor` - **PASS**, 9/9.
- `rtk cargo test -p liiiraa-desktop` - **PASS**, 200/200 across 20 suites.
- `rtk cargo check -p liiiraa-desktop` - **PASS**.
- `rtk cargo fmt -p liiiraa-desktop -- --check` - **PASS**.
- `rtk cargo clippy -p liiiraa-desktop --tests --no-deps` - **PASS**, 0 errors; pre-existing warnings remain.
- `rtk pnpm --filter @liiiraa/desktop-client exec vitest --run src/plans.test.ts` - **PASS**, 25/25.
- `rtk pnpm --filter @liiiraa/desktop-client test -- --run` - **PASS**, 46/46 across five files.
- `rtk pnpm --filter @liiiraa/desktop-client check` - **PASS**.
- `rtk pnpm --filter @liiiraa/feature-shell check` - **PASS**.
- `rtk pnpm --filter @liiiraa/feature-shell test -- --run` - **PASS**, 101/101 across seven files.
- `rtk pnpm test` - **PASS**, all 56 workspace tasks completed successfully.
- Targeted ESLint - **PASS** for `plans.ts`, `plans.test.ts`, and `index.ts`.
- `rtk pnpm test:architecture` - **PASS**, both adapters executed and 51/51 tests passed.
- Capability/source scans - **PASS**, exactly three preference grants; no generic setter, localStorage, cloud-sync authority, renderer posture input, credential response, reusable proof response, placeholder, TODO, or FIXME surface.

## Authentication Gates

None.

## User Setup Required

None - no external service configuration required.

## Known Stubs

None.

## Threat Flags

None. The native IPC, credential-backed proof consumption, device posture, and recovery access boundaries were declared by the plan threat model and are covered by exact allowlists and negative tests.

## Next Phase Readiness

- Plan 06-25 can consume one authoritative `PlanAuthoritySnapshot.advancedPreference` without reading storage, credentials, hardware facts, or proof material.
- Advanced apply admission now fails closed on revoke, posture drift, unavailable authority, malformed native payload, and stale sequence while recovery remains available.
- Plans 06-26 through 06-28 can build UI and execution reporting over stable native-attributed state semantics.

## Self-Check: PASSED

- All 13 modified implementation/test files exist.
- RED `ce882fba`, GREEN `a0095f71`, RED `eb96e637`, GREEN `0a4acdb3`, fix `cd8a7860`, regressions `33e47964` and `bd134406` exist in order.
- Focused/full Rust, focused/full TypeScript, typecheck, formatting, lint, clippy, and architecture gates pass.
- No known stubs or undeclared threat surface remain.
- The three user-owned `apps/*/.gitignore` modifications remain untouched and unstaged.

---
*Phase: 06-transactional-plans-and-recovery*
*Completed: 2026-08-13*
