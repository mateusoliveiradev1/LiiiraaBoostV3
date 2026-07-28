---
phase: 02-complete-desktop-experience
plan: "23"
subsystem: desktop-shell
tags: [tauri, rust, tray, notifications, startup, generated-contracts, focus-assist]
requires:
  - phase: 02-complete-desktop-experience
    provides: Generated shell protocol and validated native window lifecycle from Plans 02-22, 02-24, and 02-32
provides:
  - Contract-validated native tray lifecycle hidden until explicit opt-in or an active safety workflow
  - Allowlisted redacted Windows notifications with locale, preference, and Focus Assist enforcement
  - Generated installer identity and startup/update/failure events with bounded recovery actions
affects: [renderer-shell, recovery-workflows, update-ui, desktop-e2e, interaction-policy]
tech-stack:
  added: []
  patterns:
    - Untrusted renderer messages validate before any tray or notification state mutation
    - Native notification copy is selected from an internal locale/category allowlist rather than renderer-provided hardware text
key-files:
  created:
    - apps/desktop/src-tauri/src/tray.rs
    - apps/desktop/src-tauri/src/notifications.rs
  modified:
    - apps/desktop/src-tauri/src/main.rs
    - apps/desktop/src-tauri/tests/shell_contract.rs
    - apps/desktop/src-tauri/Cargo.toml
    - packages/contracts-source/src/shell.tsp
    - contracts/generated/desktop/v1/shell-message.schema.json
    - packages/contracts-ts/src/generated/models.ts
    - crates/contracts-rust/src/generated.rs
key-decisions:
  - "Do not construct the native tray at startup; create or reveal it only after validated opt-in or an active recovery/safety workflow."
  - "Never forward renderer notification title/body text to Windows; map each generated category and locale to fixed redacted copy and a category-specific generated navigation action."
  - "Represent declared Windows 10/11 installer compatibility with the contract's explicit 0/0 pre-diagnostics sentinel; observed build claims remain owned by the later diagnostic adapter."
  - "Add development to the generated release-channel union so the self-signed local build reports its configured identity truthfully."
patterns-established:
  - "OS surface boundary: generated renderer command -> local policy -> bounded native effect."
  - "Tray action boundary: closed menu ID allowlist -> generated host event; unknown IDs have no effect."
requirements-completed: [UX-01, UX-07, UX-09, UX-11, UX-12]
duration: 18min
completed: 2026-07-28
status: complete
---

# Phase 02 Plan 23: Native Tray, Notification, and Startup Bridges Summary

**Tauri now exposes a D-19-safe tray and redacted Windows notification/startup bridge whose OS effects are driven exclusively by generated validated shell messages.**

## Performance

- **Duration:** 18 min
- **Started:** 2026-07-28T04:09:29Z
- **Completed:** 2026-07-28T04:27:45Z
- **Tasks:** 2
- **Files modified:** 9

## Accomplishments

- Added an exact ordered tray model with conditional attention entry, accessible textual tooltip, validated opt-in, safety-workflow override, and fail-closed unknown actions.
- Added localized PT-BR/English Windows notification copy for only the five approved categories; raw renderer copy and sensitive hardware identifiers never reach the OS.
- Added generated installer identity and startup/update/failure event builders for missing WebView2, damaged installation, unsupported build, migration failure, update progress, invalid signature, rollback, and safe mode.
- Wired native tray and notification effects into the single generated Tauri dispatcher while preserving default exit-on-close behavior.

## Task Commits

Each TDD task was committed with a failing RED test before its GREEN implementation:

1. **Task 1: Implement validated tray lifecycle and actions**
   - `5be69e2` — RED tray lifecycle, menu-order, and action-event tests
   - `36232d2` — GREEN generated-contract tray lifecycle and native Tauri registration
2. **Task 2: Implement validated notification and startup failure events**
   - `dc4fd55` — RED notification preference, redaction, installer identity, and startup-state tests
   - `b48ce37` — GREEN redacted notification and generated startup bridge
   - `b3d55fb` — REFACTOR explicit Focus Assist/category runtime invariants

## Files Created/Modified

- `apps/desktop/src-tauri/src/tray.rs` — Pure tray lifecycle, ordered menu model, visibility policy, and allowlisted generated actions.
- `apps/desktop/src-tauri/src/notifications.rs` — Notification preference/locale policy, fixed redacted copy, installer identity, and startup-state events.
- `apps/desktop/src-tauri/src/main.rs` — Native Tauri tray/menu creation, notification display, startup emission, and bounded effect application.
- `apps/desktop/src-tauri/tests/shell_contract.rs` — TDD coverage for malformed messages, visibility, menu order, action rejection, redaction, preferences, and every startup failure family.
- `apps/desktop/src-tauri/Cargo.toml` — Enabled the approved Tauri `tray-icon` feature.
- `packages/contracts-source/src/shell.tsp` — Added the truthful `development` release channel.
- `contracts/generated/desktop/v1/shell-message.schema.json` — Regenerated shell JSON Schema.
- `packages/contracts-ts/src/generated/models.ts` — Regenerated TypeScript shell models.
- `crates/contracts-rust/src/generated.rs` — Regenerated Rust shell models and validators.

## Decisions Made

- The tray does not exist on ordinary startup. It is created only by the first validated visibility effect and is hidden again after opt-out unless a safety workflow remains active.
- Tray menu IDs are private allowlisted control values. Only generated navigation or close-request events cross to the renderer, and raw/unknown IDs are discarded.
- Windows notifications always respect Focus Assist. Category, localized title/body, and safe navigation target are chosen locally; renderer-provided title/body fields are validated but intentionally never displayed.
- The installer identity consumes the checked-in Tauri identity configuration. `detectedBuild: 0` and `minimumBuild: 0` are the explicit pre-diagnostics sentinel for declared Windows 10/11 support and must not be presented as observed hardware evidence.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] Enabled Tauri's approved tray feature**

- **Found during:** Task 1 GREEN compilation
- **Issue:** `tauri = 2.11.5` was already approved and pinned, but its built-in `tray-icon` feature was disabled, so `tauri::tray` and `tray_by_id` were unavailable.
- **Fix:** Enabled only the `tray-icon` feature on the same exact Tauri version; no new library identity or paid service was introduced.
- **Files modified:** `apps/desktop/src-tauri/Cargo.toml`
- **Verification:** Focused tray tests, complete desktop Rust suite, and `cargo check` pass.
- **Committed in:** `36232d2`

**2. [Rule 1 - Bug] Reconciled the configured development channel with the generated contract**

- **Found during:** Task 2 installer identity verification
- **Issue:** `tauri.conf.json` truthfully identifies local artifacts as `development`, while `ShellReleaseChannel` rejected that value.
- **Fix:** Added the channel additively to the canonical TypeSpec union and regenerated all affected Rust, TypeScript, and JSON Schema artifacts.
- **Files modified:** `packages/contracts-source/src/shell.tsp`, generated schema/models
- **Verification:** Contract drift and approved-baseline compatibility checks pass; the installer identity event validates as `development`.
- **Committed in:** `b48ce37`

---

**Total deviations:** 2 auto-fixed (1 blocking configuration, 1 contract bug).
**Impact:** Both changes were required for the planned native bridges; neither expands authority, cost, remote access, or package identity.

## TDD Gate Compliance

- Task 1 RED `5be69e2` failed because `tray.rs` did not exist; GREEN `36232d2` passed all four focused tray tests.
- Task 2 RED `dc4fd55` failed because `notifications.rs` did not exist; GREEN `b48ce37` and REFACTOR `b3d55fb` passed all four focused notification/startup tests.

## Verification

- `cargo test -p liiiraa-desktop --test shell_contract -- tray` — PASS, 4 tests.
- `cargo test -p liiiraa-desktop --test shell_contract -- notification_startup` — PASS, 4 tests.
- `cargo test -p liiiraa-desktop --test shell_contract` — PASS, 15 tests.
- `cargo test -p liiiraa-desktop` — PASS, 18 tests across 2 suites.
- `cargo check -p liiiraa-desktop` — PASS without warnings.
- `cargo fmt --all -- --check` — PASS.
- `pnpm contracts:check` — PASS, no generated drift.
- `pnpm contracts:compat` — PASS against the approved baseline.

## Known Stubs

None. The 0/0 compatibility pair is a contract-defined pre-diagnostics sentinel for declared installer support, not an observed Windows build or fixture metric.

## Threat Flags

None. The new OS tray/notification surface is the plan's registered T-02-26 boundary and is constrained by generated validation, fixed redacted notification copy, category-specific navigation, and closed action IDs.

## Issues Encountered

- The referenced `packages/feature-shell/src/model/interaction-policy.ts` does not yet exist because its owning Plan 02-07 remains incomplete. The implemented policy was therefore grounded directly in D-19, the approved tray/feedback sections of `02-UI-SPEC.md`, and the generated shell protocol; no dependency was invented.

## User Setup Required

None — no account, external service, secret, certificate, paid product, or manual configuration is required.

## Next Phase Readiness

- Renderer shell and recovery plans can drive tray visibility, preferences, and safe actions through generated commands/events.
- Update, account, game-profile, and recovery scenarios can request only approved redacted Windows notification categories.
- Packaged Windows verification can now exercise real tray/menu/Focus Assist behavior without changing the protocol.

## Self-Check: PASSED

- Both created bridge modules, all planned integration/test files, and this summary exist on disk.
- All five TDD task/refactor commits are reachable in Git history.
- Focused acceptance tests, the complete Rust desktop suite, compiler check, formatter check, generated-contract drift check, and compatibility gate pass.

---

*Phase: 02-complete-desktop-experience*
*Completed: 2026-07-28*
