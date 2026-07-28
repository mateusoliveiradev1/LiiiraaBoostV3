---
phase: 02-complete-desktop-experience
plan: "22"
subsystem: desktop-shell
tags: [tauri, rust, window-lifecycle, single-instance, deep-link, generated-contracts]
requires:
  - phase: 02-complete-desktop-experience
    provides: Generated shell protocol and fail-closed Rust validators from Plans 02-24 and 02-32
provides:
  - Contract-validated native close, tray, restore, and window-state behavior
  - Allowlisted single-instance and deep-link navigation bridge
  - Generated host event emission without forwarding raw external arguments
affects: [renderer-shell, recovery-workflows, desktop-navigation, packaged-e2e]
tech-stack:
  added: []
  patterns:
    - Unknown renderer JSON validates into generated Rust commands before host mutation
    - External process arguments reduce to a closed navigation intent before renderer emission
key-files:
  created:
    - apps/desktop/src-tauri/src/window.rs
    - apps/desktop/src-tauri/src/navigation.rs
  modified:
    - apps/desktop/src-tauri/src/main.rs
    - apps/desktop/src-tauri/tests/shell_contract.rs
    - apps/desktop/src-tauri/tauri.conf.json
key-decisions:
  - "Keep native Windows decorations so minimize, maximize, snap layouts, and Alt+Space remain operating-system behavior."
  - "Exit on ordinary close by default; hide to tray only after a validated explicit opt-in, and never expose an exit resolution during recovery."
  - "Accept external navigation only through the liiiraa-boost scheme and closed goal, settings, calibration, or documentation intents."
patterns-established:
  - "Native shell boundary: untrusted JSON -> generated schema validation -> generated command -> bounded host effect."
  - "External navigation boundary: raw argument/URL -> local allowlist -> generated validated host event -> one typed renderer channel."
requirements-completed: [UX-01, UX-10, UX-11, UX-12]
duration: 8min
completed: 2026-07-28
status: complete
---

# Phase 02 Plan 22: Native Window and Navigation Lifecycle Summary

**Tauri now applies window, close, tray, single-instance, and deep-link behavior only after generated contract validation, with recovery-safe close handling and no raw external argument forwarding.**

## Performance

- **Duration:** 8 min
- **Started:** 2026-07-28T03:36:34Z
- **Completed:** 2026-07-28T03:44:37Z
- **Tasks:** 2
- **Files modified:** 5

## Accomplishments

- Added a deterministic window lifecycle that clamps restored bounds to the active monitor work area, preserves native Windows chrome, and emits validated generated state/preference/close events.
- Enforced D-19: ordinary close exits by default, tray behavior requires a validated opt-in, and recovery close offers only keep-running or stay-visible outcomes.
- Routed second launches and registered `liiiraa-boost://` deep links into one existing window through a closed navigation allowlist and redacted errors.
- Proved malformed, unknown, risky, privileged, and cross-purpose payloads cause no host-state mutation and never reach the renderer as raw input.

## Task Commits

Each TDD task was committed with a failing test before its implementation:

1. **Task 1: Implement validated window state and close lifecycle**
   - `471eaa3` — RED window lifecycle contract tests
   - `5547177` — GREEN validated window lifecycle and native close wiring
2. **Task 2: Implement validated single-instance and deep-link navigation**
   - `b9fd969` — RED navigation bridge contract tests
   - `40b79b2` — GREEN allowlisted single-instance/deep-link bridge

## Files Created/Modified

- `apps/desktop/src-tauri/src/window.rs` — Generated-command dispatch, work-area clamping, D-19 close policy, recovery-safe resolutions, and generated host events.
- `apps/desktop/src-tauri/src/navigation.rs` — Closed external URL parser and second-instance event bridge with bounded redacted rejection.
- `apps/desktop/src-tauri/src/main.rs` — Tauri state, native window effects, close interception, single-instance focus, and deep-link listeners.
- `apps/desktop/src-tauri/tests/shell_contract.rs` — Behavioral TDD coverage for window lifecycle, malformed inputs, recovery safety, argument redaction, and registration order.
- `apps/desktop/src-tauri/tauri.conf.json` — Packaged desktop registration for the local `liiiraa-boost` URI scheme.

## Decisions Made

- Retained native window decorations instead of replacing operating-system controls; snap layouts, Alt+Space, minimize, maximize, and accessibility behavior remain native.
- Kept one `desktop-shell-event` transport channel whose payload is always a generated `HostToRendererShellEvent`.
- Ignored unrelated second-launch process arguments and selected at most one allowlisted URI, preventing executable paths, launcher flags, or secondary intents from reaching the renderer.
- Rejected queries, fragments, percent-encoding, traversal markers, unknown destinations, and privileged route families before generated event emission.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 2 - Missing Critical] Registered the packaged deep-link scheme**

- **Found during:** Task 2
- **Issue:** The plan listed Rust routing files but did not include the Tauri configuration required for Windows to associate packaged `liiiraa-boost://` links with the application.
- **Fix:** Added the exact local scheme under `plugins.deep-link.desktop.schemes` and asserted it in the shell contract suite.
- **Files modified:** `apps/desktop/src-tauri/tauri.conf.json`, `apps/desktop/src-tauri/tests/shell_contract.rs`
- **Verification:** Tauri configuration compiled and all navigation tests passed.
- **Committed in:** `40b79b2`

**Total deviations:** 1 auto-fixed (1 Rule 2).

**Impact:** The change completes the planned deep-link behavior without adding a dependency, service, secret, paid product, remote endpoint, or privileged capability.

## Verification

- `cargo test -p liiiraa-desktop --test shell_contract -- window_close` — PASS, 2 tests.
- `cargo test -p liiiraa-desktop --test shell_contract -- navigation` — PASS, 3 tests.
- `cargo test -p liiiraa-desktop --test shell_contract` — PASS, 8 tests.
- `cargo test -p liiiraa-desktop` — PASS, 11 tests across 2 suites.
- `cargo check -p liiiraa-desktop` — PASS.
- `cargo fmt --all -- --check` — PASS.
- `git diff --check` — PASS.

## TDD Gate Compliance

- Task 1 RED `471eaa3` produced the expected RED because `window.rs` did not exist; GREEN `5547177` passed all window close and restore behavior.
- Task 2 RED `b9fd969` produced the expected RED because `navigation.rs` did not exist; GREEN `40b79b2` passed all navigation, redaction, and runtime registration behavior.
- No separate refactor commit was necessary; formatting and shared metadata-envelope extraction were completed within GREEN before the final verification.

## Known Stubs

None.

## Issues Encountered

- Tauri exposes monitor metadata through accessor methods rather than public fields; the initial compile error was corrected to use `name()` and `work_area()` before the GREEN commit.

## User Setup Required

None — no external service, paid product, secret, certificate, or manual configuration is required.

## Next Phase Readiness

- Renderer shell plans can subscribe to one validated event channel for close, tray, window-state, and external navigation events.
- Recovery workflow plans can activate the bounded recovery close context without introducing an exit decision.
- Packaged tests can exercise the registered local URI scheme and verify single-instance focus on Windows 10/11.

## Self-Check: PASSED

- Both created modules and all three modified integration/configuration files exist.
- All four TDD commits are reachable in Git history.
- Focused acceptance checks, the full desktop Rust suite, formatting, and diff hygiene pass.

---

*Phase: 02-complete-desktop-experience*
*Completed: 2026-07-28*
