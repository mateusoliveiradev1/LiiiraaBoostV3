---
phase: 04-identity-commerce-devices-and-administration
plan: '35'
subsystem: desktop-account-authority
tags: [tauri, rust, winhttp, react, account-sync, credential-manager, playwright]
dependency_graph:
  requires:
    - Plan 04-17 versioned account projections and optimistic-concurrency receipts
    - Plan 04-20 native PKCE and Windows Credential Manager custody
    - Plan 04-34 owner-bound browser authority witness
  provides:
    - Native HTTPS account synchronization over credential-manager custody
    - Version-aware desktop account authority with degraded, conflict, and revoked states
    - Production account composition without fixture identity or simulated Premium authority
  affects: [desktop-account, premium-authority, phase-05-windows-engine]
tech_stack:
  added: []
  patterns:
    - Renderer receives validated generated projections but never the native credential
    - Lifecycle synchronization is centralized across launch, resume, reconnection, and mutation
    - Conflicts preserve remote truth and a bounded safe local draft for explicit resubmission
key_files:
  created:
    - apps/desktop/src-tauri/src/account_sync.rs
    - apps/desktop/src/account-authority.ts
    - apps/desktop/tests/browser/account-authority.spec.ts
  modified:
    - apps/desktop/src-tauri/Cargo.toml
    - apps/desktop/src-tauri/src/main.rs
    - apps/desktop/src/features/account-experience.tsx
    - packages/feature-shell/src/features/account-settings.tsx
    - eslint.config.mjs
decisions:
  - Admit browser authority transport only under the explicit SIMULATED SCENARIO test marker; production transport exists only through Tauri IPC.
  - Keep credentials in Rust and delete native custody on 401/403 without deleting warnings, history, diagnostics, or restoration.
  - Synchronize only shared account projections; technical PC history, unshared diagnostics, operational history, and restoration never enter the payload.
metrics:
  duration: 16 min
  completed: 2026-08-05
  tasks: 1
  files: 8
status: complete
requirements-completed: [WEB-04, IDEN-01, IDEN-02]
---

# Phase 04 Plan 35: Authoritative Desktop Account Synchronization Summary

**Native WinHTTP account synchronization now feeds generated, version-aware projections into the desktop while credentials and local safety data remain outside renderer authority.**

## Performance

- **Duration:** 16 min
- **Started:** 2026-08-05T16:55:36Z
- **Completed:** 2026-08-05T17:11:28Z
- **Tasks:** 1
- **Files modified:** 8

## Accomplishments

- Added HTTPS-only native synchronization that reads Windows Credential Manager custody, bounds remote responses, validates generated account components, and rejects mixed ownership.
- Replaced production fixture account authority with explicit online, offline, stale, pending, conflict, and revoked rendering while retaining fixture-only test and Storybook composition.
- Preserved remote truth plus the safe local profile draft on version conflict, and removed account/Premium authority on next-contact revocation without removing local warnings, history, diagnostics, or restoration.
- Centralized launch, resume, reconnection, and successful-mutation synchronization triggers in `DesktopAccountAuthority`.

## Task Commits

1. **Task 04-35-01 RED: authoritative account behavior witness** — `ae55e06` (`test`)
2. **Task 04-35-01 GREEN: native synchronization and production authority composition** — `e86d54e` (`feat`)

## Files Created/Modified

- `apps/desktop/src-tauri/src/account_sync.rs` — bounded native account projection, lifecycle synchronization, optimistic mutation, conflict, offline, and revocation handling.
- `apps/desktop/src/account-authority.ts` — validated renderer projection, lifecycle triggers, transport admission, and safe draft state.
- `apps/desktop/src/features/account-experience.tsx` — production account composition and explicit degraded/conflict/revoked account views.
- `packages/feature-shell/src/features/account-settings.tsx` — shared account authority summary without fixture provenance.
- `apps/desktop/tests/browser/account-authority.spec.ts` — lifecycle, conflict preservation, and revocation browser evidence.
- `apps/desktop/src-tauri/src/main.rs` — registered native state and the `sync_account` Tauri command.
- `apps/desktop/src-tauri/Cargo.toml` — enabled the existing pinned `windows` crate's WinHTTP feature.
- `eslint.config.mjs` — admitted the new Playwright witness to typed linting.

## Verification Results

- Focused `@authority-smoke` Playwright journey: **PASS**, 3/3 in 3.7 seconds (below the 30-second target).
- Complete `account-authority.spec.ts`: **PASS**, 3/3 in 3.7 seconds.
- Architecture suite and production-to-fixture guard: **PASS**, 46/46.
- Rust `account_sync` tests: **PASS**, 2/2; desktop Rust build: **PASS**.
- Desktop and feature-shell TypeScript checks: **PASS**.
- Type-aware ESLint over every changed TS/TSX file: **PASS**.
- Cargo formatting, Prettier, and `git diff --check`: **PASS**.
- Full desktop `verify`: **BLOCKED BY PRE-EXISTING BASELINE** at repository-wide lint with unrelated errors outside Plan 04-35; recorded in `deferred-items.md`.

## Decisions Made

- Browser simulation is admitted only when the existing test harness carries the exact `SIMULATED SCENARIO` marker. A normal browser cannot supply account authority, and production uses Tauri IPC only.
- Rust retains exclusive credential custody. The credential is used only to build the native Authorization header and is deleted on 401/403; no credential crosses into React state.
- The native API origin must be HTTPS and contain only a bounded host and optional port. Responses are capped at 1 MiB and every account-owned generated document must resolve to the same account.
- Shared synchronization excludes local-only technical history, unshared diagnostics, operational history, and restoration.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 2 - Missing Critical] Registered the native command and WinHTTP capability**

- **Found during:** Task 04-35-01 GREEN
- **Issue:** The plan named the synchronization module but omitted the host registration and existing `windows` crate feature required to make native HTTPS synchronization callable.
- **Fix:** Registered `sync_account`, managed its native state, and enabled `Win32_Networking_WinHttp` on the already-pinned crate without installing a package.
- **Files modified:** `apps/desktop/src-tauri/src/main.rs`, `apps/desktop/src-tauri/Cargo.toml`
- **Verification:** Rust account-sync tests and desktop Rust build pass.
- **Committed in:** `e86d54e`

**2. [Rule 3 - Blocking] Added the new browser witness to typed ESLint admission**

- **Found during:** Plan-level desktop verification
- **Issue:** The root project-service allowlist did not include the new Playwright file, so typed lint rejected it before checking its contents.
- **Fix:** Added the exact spec path, incremented the bounded file count, and corrected the newly exposed plan-owned lint findings.
- **Files modified:** `eslint.config.mjs`, `apps/desktop/tests/browser/account-authority.spec.ts`, `apps/desktop/src/account-authority.ts`
- **Verification:** Focused type-aware ESLint and Playwright smoke both pass.
- **Committed in:** `e86d54e`

---

**Total deviations:** 2 auto-fixed (1 missing critical, 1 blocking)
**Impact on plan:** Both changes were required to expose and verify the planned native boundary; no new package or authority path was introduced.

## Issues Encountered

- The complete desktop verifier delegates to repository-wide root lint and stops on the existing cross-package lint backlog. Plan-owned lint findings were fixed; unrelated files were left unchanged and recorded in `deferred-items.md`.
- Existing Vite messages for the unresolved runtime font URL, mixed static/dynamic Tauri window import, and large desktop bundle remain warnings and are outside this account-authority plan.

## Known Stubs

None. No placeholder, TODO, empty mock projection, or production fixture authority remains in the plan-owned path.

## TDD Gate Compliance

- RED gate: `ae55e06` introduced the failing authority witness before implementation.
- GREEN gate: `e86d54e` implemented the native and renderer authority path after the RED witness.
- REFACTOR gate: no separate refactor commit was needed; lifecycle triggers and verdict mapping were centralized during GREEN and all focused checks remained green.

## User Setup Required

- Production packaging must provide `LIIIRAA_ACCOUNT_API_ORIGIN` as the approved HTTPS account API origin. No secret belongs in renderer configuration.

## Next Phase Readiness

- Desktop account truth is ready for downstream device, subscription, and Premium surfaces through a single validated authority snapshot.
- The repository-wide lint backlog remains an independent quality task; no Plan 04-35 behavior is blocked by it.

## Self-Check: PASSED

- All declared created/modified plan files and this summary exist on disk.
- RED commit `ae55e06` and GREEN commit `e86d54e` exist in repository history in the required order.
- Plan-owned formatting, type, lint, Rust, architecture, and browser assertions were rerun after the final implementation changes.

---

_Phase: 04-identity-commerce-devices-and-administration_
_Completed: 2026-08-05_
