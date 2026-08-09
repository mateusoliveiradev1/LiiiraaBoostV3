---
phase: 04-identity-commerce-devices-and-administration
plan: '65'
subsystem: desktop-auth-session
tags: [desktop, authentication, logout, race-condition, tauri, react]
requires:
  - phase: 04-35
    provides: Native credential-backed desktop authentication
  - phase: 04-38
    provides: Authoritative desktop account synchronization
provides:
  - One-action desktop logout with immediate revoked authority publication
  - Invalidated late synchronization responses after confirmed native logout
  - Cleared lifecycle synchronization queue at the logout boundary
affects: [04-40, 04-66, final-phase-4-uat]
tech-stack:
  added: []
  patterns: [confirmed-local-revocation, sequence-invalidated-sync, idempotent-logout]
key-files:
  modified:
    - apps/desktop/src/account-authority.ts
    - apps/desktop/src/account-authority.test.ts
    - apps/desktop/src/features/account-experience.tsx
    - apps/desktop/src/features/account-experience.test.ts
key-decisions:
  - 'Native logout confirmation is published to the singleton account authority before navigation resolves.'
  - 'Confirmed logout invalidates in-flight reads and clears queued lifecycle reads without disabling a future authenticated synchronization.'
  - 'The authority owns the revoked event; the account UI no longer dispatches a duplicate event.'
requirements-completed: [IDEN-02, IDEN-03]
duration: 9 min
completed: 2026-08-09
status: complete
---

# Phase 04 Plan 65: One-Click Desktop Logout Summary

**Desktop logout now changes the authoritative React session to revoked before routing to login, so an in-flight account refresh cannot restore the old authenticated screen.**

## Accomplishments

- Added an idempotent `confirmSignedOut()` transition to the application-wide desktop account
  authority.
- Invalidated any account response already in flight and discarded queued focus, resume, or
  reconnection reads at the confirmed logout boundary.
- Removed the duplicate UI-owned revoked event and made the account screen publish revocation
  before navigating to `/login`.
- Locked the reported two-click race with delayed-response and queued-synchronization regression
  tests.
- Aligned the formatted PC with the repository's pinned pnpm 11.17.0 toolchain without Docker.

## Task Commits

1. `f858b5a` — lock one-click desktop logout race.
2. `af3f40d` — publish confirmed desktop sign-out.

## Verification

- Focused logout and account presentation suite: 27/27 tests passed.
- Full desktop unit suite: 18 files and 147/147 tests passed.
- Desktop TypeScript check passed.
- Desktop Vite production build passed.
- Workspace quick verification passed through toolchain, formatting, TypeScript, contract drift,
  contract compatibility, architecture, Rust contract, acceptance-policy, fixture-boundary, and
  desktop gates.
- The later workspace-wide web test stage remains blocked by a pre-existing design-token
  expectation for `--lb-accent-electric`; no logout or desktop test failed.

## Deviations from Plan

### Environment recovery

**The formatted PC exposed pnpm 11.16.0 ahead of the required 11.17.0 executable**

- **Fix:** activated and installed the exact repository-pinned pnpm 11.17.0 in the user toolchain.
- **Proof:** the workspace toolchain contract subsequently reported Node 24.18.0, pnpm 11.17.0,
  TypeScript 6.0.3, and Rust 1.97.1.

### Unrelated workspace gate

**The final aggregate verify stopped in the design-token package after all desktop gates passed**

- **Scope:** the failure compares an existing CSS accent token against an older expected value.
- **Decision:** preserved that unrelated UI-token state instead of mixing it into the logout fix.

## Safety Boundaries Preserved

- Server-side session revocation remains the prerequisite for the local confirmed transition.
- Late or queued responses cannot resurrect the logged-out projection.
- Repeated logout confirmation is idempotent and does not emit duplicate authority transitions.
- A later real sign-in may synchronize the singleton again; logout does not permanently disable
  account restoration.
- No Docker was installed or used.

## Next Phase Readiness

The one-click logout race is closed. Plan 04-66 can now replace the visible beta-only device gate
with the truthful Free/Premium secure device-binding flow.

## Self-Check: PASSED

---

_Phase: 04-identity-commerce-devices-and-administration_
_Completed: 2026-08-09_
