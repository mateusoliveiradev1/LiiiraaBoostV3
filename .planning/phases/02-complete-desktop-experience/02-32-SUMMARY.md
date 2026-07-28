---
phase: 02-complete-desktop-experience
plan: "32"
subsystem: contracts
tags: [typescript, rust, json-schema, ajv, validation, shell-ipc]
requires:
  - phase: 02-complete-desktop-experience
    provides: Generated desktop shell protocol from Plan 02-24
provides:
  - Direction-specific TypeScript validators for host events and renderer commands
  - Direction-specific Rust validators returning generated transport enums
  - Cross-language rejection vectors with bounded redacted structural errors
affects: [desktop-shell, tauri-host, renderer-bridge, feature-shell]
tech-stack:
  added: []
  patterns:
    - Generated JSON Schema validation before typed transport use
    - One compiled shell schema registry per runtime
    - Bounded redacted errors with deterministic structural issue ordering
key-files:
  created:
    - crates/contracts-rust/tests/shell_messages.rs
  modified:
    - packages/contracts-ts/src/validation.ts
    - packages/contracts-ts/src/validation.test.ts
    - packages/contracts-ts/src/index.ts
    - crates/contracts-rust/src/validation.rs
key-decisions:
  - "Use distinct stable schema identities for each shell transport direction."
  - "Compile the generated shell schema once per runtime and deserialize Rust values only after schema validation."
  - "Apply a redacted semantic safe-navigation guard after schema validation because generated document IDs are length-bounded but not path-bounded."
patterns-established:
  - "Shell boundary pattern: unknown JSON -> generated schema -> direction-specific generated type -> semantic safe-navigation guard."
  - "Validation errors expose only schema identity, bounded path, bounded keyword, and truncation state."
requirements-completed: [UX-01, UX-09, UX-10, UX-11, UX-12]
duration: 7min
completed: 2026-07-28
status: complete
---

# Phase 02 Plan 32: Fail-Closed Shell Validation Summary

**Generated shell transports now validate in both TypeScript and Rust before routing, with matching unsafe-input rejection and no payload-value disclosure.**

## Performance

- **Duration:** 7 min
- **Started:** 2026-07-28T00:40:31Z
- **Completed:** 2026-07-28T00:46:56Z
- **Tasks:** 2
- **Files modified:** 5

## Accomplishments

- Added public TypeScript validators for both host-to-renderer events and renderer-to-host commands.
- Added Rust validators that schema-check unknown JSON before deserializing generated direction-specific enums.
- Proved matching acceptance/rejection behavior for unknown schemas, fields, discriminators, unsafe navigation, unsupported locales, non-opt-in tray values, and unapproved notification categories.
- Preserved deterministic, bounded, structural-only errors across both runtimes.
- Confirmed all eight generated contract artifacts remain drift-free.

## Task Commits

Each TDD gate was committed atomically:

1. **Task 1 RED: TypeScript shell validation vectors** - `e53ad76` (test)
2. **Task 1 GREEN: TypeScript shell validators** - `9f19f31` (feat)
3. **Task 2 RED: Rust cross-language shell corpus** - `6be801d` (test)
4. **Task 2 GREEN: Rust shell validators** - `d0226d6` (feat)

## Files Created/Modified

- `packages/contracts-ts/src/validation.ts` - Compiles shell schemas and exposes both direction-specific validators.
- `packages/contracts-ts/src/validation.test.ts` - Covers valid transports, unsafe inputs, deterministic bounds, and redaction.
- `packages/contracts-ts/src/index.ts` - Publishes shell validation APIs and result types through the package root.
- `crates/contracts-rust/src/validation.rs` - Validates shell JSON before generated enum deserialization and enforces safe navigation.
- `crates/contracts-rust/tests/shell_messages.rs` - Mirrors the TypeScript corpus and verifies typed round trips.

## Decisions Made

- Used `desktop.shell.host-to-renderer.v1` and `desktop.shell.renderer-to-host.v1` as explicit direction identities so cross-direction or unknown messages fail closed.
- Reused the generated combined shell schema as one compiled validator per runtime; direction correctness is then enforced by the direction-specific generated transport type.
- Kept navigation rejection structural and redacted: unsafe document identifiers produce only a bounded `safeNavigation` keyword and path.

## Verification

- `pnpm --filter @liiiraa/contracts-ts test -- --run` — PASS, 21 tests.
- `pnpm --filter @liiiraa/contracts-ts check` — PASS.
- `cargo test -p liiiraa-contracts-rust --test shell_messages` — PASS, 3 tests.
- `cargo test -p liiiraa-contracts-rust` — PASS, 7 tests across 5 suites.
- `cargo fmt --all -- --check` — PASS.
- `pnpm contracts:check` — PASS, 8 generated artifacts drift-free.

## TDD Gate Compliance

- TypeScript RED `e53ad76` failed because the public direction-specific APIs did not exist.
- TypeScript GREEN `9f19f31` passed all shell vectors and type checking.
- Rust RED `6be801d` failed on the four missing public shell validation symbols.
- Rust GREEN `d0226d6` passed the mirrored cross-language corpus.
- No separate REFACTOR commit was necessary; formatting and shared helper cleanup were completed within GREEN without changing behavior afterward.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 2 - Missing Critical] Exported validators from the public package root**

- **Found during:** Task 1
- **Issue:** The plan's four-file list did not include `packages/contracts-ts/src/index.ts`, but package consumers could not use the new public validators without explicit root exports.
- **Fix:** Exported both schema identities, validators, and result types from the canonical package root.
- **Files modified:** `packages/contracts-ts/src/index.ts`
- **Verification:** TypeScript tests import all APIs from `@liiiraa/contracts-ts`; package type checking passes.
- **Committed in:** `9f19f31`

**2. [Rule 2 - Missing Critical] Added semantic safe-navigation enforcement**

- **Found during:** Task 1
- **Issue:** The generated `ShellDocumentId` schema bounds length but does not prohibit traversal, absolute paths, backslashes, or URL schemes, so schema validation alone accepted risky navigation.
- **Fix:** Added equivalent post-schema safe-navigation guards in TypeScript and Rust before validated messages may route.
- **Files modified:** `packages/contracts-ts/src/validation.ts`, `crates/contracts-rust/src/validation.rs`
- **Verification:** Both cross-language corpora reject `../../SENSITIVE_NAVIGATION_TARGET` without exposing it in errors.
- **Committed in:** `9f19f31`, `d0226d6`

---

**Total deviations:** 2 auto-fixed (2 Rule 2).
**Impact on plan:** Both fixes are required for the public fail-closed boundary and do not broaden dependencies, services, or architecture.

## Issues Encountered

- The generated notification payload field is named `action`, not `intent`; the RED fixture was corrected during GREEN before acceptance verification.
- The generated Rust shell schema compiled directly with embedded Draft 2020-12 resources, so no additional registry or dependency was needed.

## Known Stubs

None.

## User Setup Required

None - no external service, paid product, secret, or manual configuration is required.

## Next Phase Readiness

- Tauri host and renderer bridge plans can now accept only validated generated shell messages.
- No blockers remain for dependent desktop shell routing work.

## Self-Check: PASSED

- All five implementation/test files and this summary exist on disk.
- All four RED/GREEN task commits exist in Git history.
- TypeScript, Rust, formatting, and contract drift acceptance checks pass.
