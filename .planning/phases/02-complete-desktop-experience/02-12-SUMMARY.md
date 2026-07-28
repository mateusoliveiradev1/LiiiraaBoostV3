---
phase: 02-complete-desktop-experience
plan: "12"
subsystem: desktop-host
tags: [tauri, rust, capabilities, csp, shell-contracts, windows-signing]
requires:
  - phase: 02-complete-desktop-experience
    provides: Approved exact Phase 2 dependencies, generated shell transports, and fail-closed Rust validators from Plans 02-31 and 02-32
provides:
  - Real registered Tauri desktop crate consuming generated Rust shell transports
  - Production fixture refusal before native host construction
  - Deny-by-default renderer capability and strict CSP boundary
  - Non-elevated current-user Windows bundle identity with truthful development-signing metadata
affects: [desktop-ui, renderer-bridge, packaged-acceptance, signing, updater]
tech-stack:
  added:
    - tauri 2.11.5
    - tauri-plugin-deep-link 2.4.9
    - tauri-plugin-notification 2.3.3
    - tauri-plugin-process 2.3.1
    - tauri-plugin-single-instance 2.4.3
    - tauri-plugin-updater 2.10.1
    - tauri-plugin-window-state 2.4.1
  patterns:
    - Unknown renderer JSON validates against generated direction-specific contracts before dispatch
    - Capability file and inline runtime capability are equality-tested and deny all renderer permissions by default
key-files:
  created:
    - apps/desktop/src-tauri/Cargo.toml
    - apps/desktop/src-tauri/build.rs
    - apps/desktop/src-tauri/src/main.rs
    - apps/desktop/src-tauri/capabilities/default.json
    - apps/desktop/src-tauri/tests/shell_contract.rs
    - apps/desktop/src-tauri/icons/icon-rgba.png
  modified:
    - Cargo.toml
    - Cargo.lock
    - apps/desktop/src-tauri/tauri.conf.json
key-decisions:
  - "Keep the Phase 2 renderer capability empty and route the only custom command through generated validation; future permissions require an explicit reviewed capability change."
  - "Keep updater artifacts disabled and record signature-required but unconfigured development metadata until a legitimate key exists; never fabricate updater or production trust."
  - "Use current-user NSIS installation and null signing inputs so Plan 02-33 can bind the observed free local certificate without elevating the UI or committing secrets."
patterns-established:
  - "Native shell boundary: unknown JSON -> generated schema validator -> generated Rust enum -> bounded dispatch."
  - "Signing configuration: publisher and SHA-256 policy may be declared early, but thumbprint and timestamp remain null until observed evidence exists."
requirements-completed: [UX-01, UX-07, UX-09, UX-10, UX-11, UX-12]
duration: 14min
completed: 2026-07-28
status: complete
---

# Phase 02 Plan 12: Least-Privilege Tauri Host Summary

**A buildable non-elevated Tauri host now accepts only generated, runtime-validated shell commands behind an empty renderer capability boundary and truthful development-only Windows identity.**

## Performance

- **Duration:** 14 min
- **Started:** 2026-07-28T01:30:02.454Z
- **Completed:** 2026-07-28T01:44:09.975Z
- **Tasks:** 2
- **Files modified:** 9

## Accomplishments

- Registered `liiiraa-desktop` atomically with the Cargo workspace and activated only exact approved direct dependencies.
- Added `ShellContract` dispatch over generated `RendererToHostShellCommand` and `HostToRendererShellEvent` validators, with cross-direction and unknown-message rejection.
- Refused fixture adapters before constructing a production host and exposed no optimizer, privileged broker, generic script, file, registry, service, or mutation command.
- Locked a strict CSP, empty renderer permissions, 1280×800 initial and 760×600 minimum window, and current-user NSIS installation.
- Recorded development channel, Windows 10/11 compatibility, updater signature requirement, and explicit false public-trust/SmartScreen/production/distribution claims.

## Task Commits

Each TDD gate was committed atomically:

1. **Task 1 RED: Specify generated shell host boundary** — `1e92c4e` (test)
2. **Task 1 GREEN: Implement validated non-elevated Tauri host** — `f94890c` (feat)
3. **Task 2 RED: Specify least-privilege capability contract** — `d95212d` (test)
4. **Task 2 GREEN: Lock desktop bundle identity and capability boundary** — `a1a4830` (feat)

## Files Created/Modified

- `Cargo.toml` — Registers the desktop crate in the same atomic change that creates it.
- `Cargo.lock` — Freezes the approved Tauri/plugin graph.
- `apps/desktop/src-tauri/Cargo.toml` — Defines the real desktop package and exact direct dependency pins.
- `apps/desktop/src-tauri/build.rs` — Tracks configuration and capability changes without introducing an unapproved direct build dependency.
- `apps/desktop/src-tauri/src/main.rs` — Implements startup refusal, generated validation, bounded shell dispatch, approved plugins, and single-instance focus.
- `apps/desktop/src-tauri/capabilities/default.json` — Records the deny-by-default main-window capability.
- `apps/desktop/src-tauri/tauri.conf.json` — Locks window, CSP, bundle, non-elevation, compatibility, signing, and updater policy.
- `apps/desktop/src-tauri/tests/shell_contract.rs` — Mutation-sensitive tests for capability, identity, elevation, and command registration.
- `apps/desktop/src-tauri/icons/icon-rgba.png` — Original RGBA desktop icon required by Tauri context generation.

## Decisions Made

- The renderer receives no Tauri core/plugin permission in this plan. The one custom command is registered explicitly and validates unknown JSON into the generated renderer-to-host enum before dispatch.
- The external capability artifact is mirrored inline because resolving file-based ACL manifests would require declaring `tauri-build` directly, which was not in the approved dependency set. The integration test requires byte-equivalent semantic content so the two forms cannot drift.
- Updater artifacts remain disabled while `signatureRequired=true` and `publicKeyConfigured=false`. Phase 2 cannot produce an unsigned updater artifact or imply a key exists.
- The local Authenticode thumbprint and timestamp URL remain explicit null values until Plan 02-33 observes the free CurrentUser CNG certificate and records non-secret evidence.

## Verification

- `rtk cargo test -p liiiraa-desktop` — PASS, 5 tests across 2 suites.
- `rtk cargo test -p liiiraa-desktop --test shell_contract -- capabilities` — PASS, 2 focused tests.
- `rtk cargo check -p liiiraa-desktop` — PASS.
- `rtk cargo build -p liiiraa-desktop` — PASS.
- `rtk cargo clippy -p liiiraa-desktop --all-targets -- -D warnings` — PASS.
- `rtk cargo fmt --all -- --check` — PASS.
- `rtk cargo metadata --format-version 1 --no-deps` — PASS; `liiiraa-desktop` is a resolved workspace member.
- `rtk pnpm contracts:check` — PASS; all 8 generated artifacts remain drift-free.
- `rtk git diff --check` — PASS.

## TDD Gate Compliance

- Task 1 RED failed on the intended valid-dispatch assertion before implementation; GREEN passed generated validation and production fixture refusal.
- Task 2 RED failed because the required capability artifact did not exist; GREEN passed exact capability, CSP, bundle identity, and command-registration assertions.
- No separate REFACTOR commit was needed; formatting and warning cleanup occurred before each GREEN commit.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] Added a project-local RGBA Windows icon**

- **Found during:** Task 1 GREEN
- **Issue:** Tauri `generate_context!` refuses to compile on Windows without a decodable RGBA icon.
- **Fix:** Generated an original square L/boost mark with the built-in image generator, converted its chroma-key exterior to alpha with the skill-provided helper, and configured the final project-local PNG.
- **Files modified:** `apps/desktop/src-tauri/icons/icon-rgba.png`, `apps/desktop/src-tauri/tauri.conf.json`
- **Verification:** Tauri context generation, package tests, check, build, and clippy all pass.
- **Committed in:** `f94890c`
- **Final prompt:** `Create a distinctive square Windows app icon for Liiiraa Boost: a centered angular L and forward boost signal, pre-dawn navy/cyan palette, small amber status accent, strong 32px silhouette, no text or third-party logos.`

**2. [Rule 3 - Blocking] Mirrored the capability inline without adding an unapproved dependency**

- **Found during:** Task 2 GREEN
- **Issue:** A file-reference capability requires application build-script ACL manifests; declaring `tauri-build` directly would exceed the approved dependency set.
- **Fix:** Kept the reviewed capability artifact, supplied the same empty capability inline to the runtime context, and added an equality assertion that fails on drift or permission broadening.
- **Files modified:** `apps/desktop/src-tauri/capabilities/default.json`, `apps/desktop/src-tauri/tauri.conf.json`, `apps/desktop/src-tauri/tests/shell_contract.rs`
- **Verification:** Focused capability tests and Tauri context compilation pass with no additional direct dependency.
- **Committed in:** `a1a4830`

---

**Total deviations:** 2 auto-fixed (2 blocking).
**Impact:** Both fixes were required for a buildable Windows host and preserved the approved free dependency and least-privilege boundaries.

## Issues Encountered

- The first GREEN compile also revealed that generated shell enums intentionally do not implement `PartialEq`; rejection assertions were changed to `matches!` without changing production behavior.
- The known six global TypeScript errors in `tooling/architecture-tests/src/check-workspace.test.ts` were outside this plan and were not touched. They did not block any required Rust, contract-drift, formatting, or lint verification.

## Known Stubs

None. Empty renderer permissions and disabled updater artifacts are deliberate fail-closed security gates, not placeholders.

## Authentication Gates

None.

## User Setup Required

None — no paid service, secret, cloud resource, certificate purchase, or external configuration was introduced.

## Next Phase Readiness

- Renderer composition can now invoke one bounded generated shell command and extend permissions only through reviewed capability changes.
- Plan 02-33 can bind the local free CNG certificate to the null signing fields without changing publisher, digest, channel, or trust classification.
- Publicly trusted signing and updater key configuration remain blocked until their explicit later gates.

## Self-Check: PASSED

- All nine implementation/configuration files and this summary exist on disk.
- All four RED/GREEN commits exist in Git history.
- Focused capability acceptance tests pass after summary creation.
- No unexpected tracked-file deletion or untracked generated artifact remains.

---

*Phase: 02-complete-desktop-experience*
*Completed: 2026-07-28*
