---
phase: 04-identity-commerce-devices-and-administration
plan: '38'
subsystem: auth
tags: [tauri, rust, pkce, loopback, winhttp, credential-manager, react]
requires:
  - phase: 04-identity-commerce-devices-and-administration
    provides: persistent identity authority, invitation authentication, and real Account sessions
provides:
  - Native Windows system-browser login with PKCE S256 and one-shot loopback callback
  - Opaque desktop credential custody in Windows Credential Manager
  - Real Account approval and API revocation endpoints for desktop sessions
  - Renderer login and logout driven by native authority without browser storage
affects: [admin-auth, staging-deploy, desktop-account-sync, beta-invitations]
tech-stack:
  added: []
  patterns:
    [
      native secret custody,
      system-browser PKCE,
      exact loopback admission,
      renderer session projection,
    ]
key-files:
  created:
    - apps/desktop/src/desktop-auth.ts
  modified:
    - apps/desktop/src-tauri/src/identity.rs
    - apps/desktop/src-tauri/src/main.rs
    - apps/desktop/src/features/account-experience.tsx
    - apps/account/src/account-auth.ts
    - apps/account/src/features/account-auth.tsx
    - apps/api/src/modules/identity/real-routes.ts
key-decisions:
  - 'Bind the loopback listener before requesting authorization and admit only an exact 127.0.0.1 callback with matching issuer, redirect, state, and one-time code.'
  - 'Keep the opaque credential entirely in Windows Credential Manager; expose only a validated SessionProjection to the renderer.'
  - 'Use bounded synchronous WinHTTP calls inside Tauri blocking tasks so renderer commands remain responsive and network input fails closed.'
patterns-established:
  - 'Desktop OAuth custody: native code owns PKCE verifier, callback, exchange, revocation, and credential storage; React owns only progress and session projection.'
  - 'Test transports are admitted only inside the explicit deterministic desktop test composition.'
requirements-completed: [IDEN-01, IDEN-02, IDEN-03, IDEN-04]
duration: 21 min
completed: 2026-08-05
status: complete
---

# Phase 04 Plan 38: Real Desktop Browser Authentication Summary

**Tauri now completes real system-browser PKCE authentication, retains the opaque session credential only in Windows Credential Manager, and returns a bounded account session projection to React.**

## Performance

- **Duration:** 21 min
- **Started:** 2026-08-05T22:54:03Z
- **Completed:** 2026-08-05T23:14:57Z
- **Tasks:** 2
- **Files modified:** 14

## Accomplishments

- Implemented native PKCE S256 generation, exact loopback callback admission, 120-second timeout, one-shot exchange, bounded HTTPS requests, and credential custody.
- Connected the Account web surface to approve an authenticated desktop challenge and return only the exact admitted loopback callback.
- Connected React login and logout to Tauri commands, removed the prepared/local-account shortcut from production, and kept demo mode explicitly unauthenticated.
- Added remote desktop-session revocation and verified that credentials never enter renderer responses, browser storage, logs, or debug output.

## Task Commits

1. **Tasks 04-38-01/02 RED: native desktop authentication witnesses** - `10cb8f7` (test)
2. **Tasks 04-38-01/02 GREEN: native browser authentication and credential custody** - `cb0547f` (feat)

## Files Created/Modified

- `apps/desktop/src-tauri/src/identity.rs` - Native PKCE, browser, loopback, WinHTTP exchange/revocation, and Credential Manager custody boundary.
- `apps/desktop/src-tauri/src/main.rs` - Bounded `desktop_sign_in` and `desktop_sign_out` Tauri commands.
- `apps/desktop/src/desktop-auth.ts` - Typed renderer client that admits only active desktop session projections and never uses browser storage.
- `apps/desktop/src/features/account-experience.tsx` - Real login progress, native authority navigation, explicit demo isolation, and secure logout.
- `apps/account/src/account-auth.ts` - CSRF-protected desktop challenge approval with exact loopback callback validation.
- `apps/account/src/features/account-auth.tsx` - Existing-session and post-login browser approval flow.
- `apps/api/src/modules/identity/real-routes.ts` - Idempotent bearer-authenticated desktop sign-out route.
- `apps/desktop/tests/browser/desktop-auth.spec.ts` - Behavioral login, failure, demo isolation, storage, and logout coverage.
- `apps/desktop/src-tauri/tests/identity.rs` - Native mismatch, replay, timeout, custody, revocation, and redaction coverage.
- `apps/desktop/src-tauri/tests/shell_contract.rs` - Closed registration contract for the five admitted native commands.
- `eslint.config.mjs` - Typed ESLint admission for the new Playwright specification.

## Decisions Made

- The desktop API and Account origins must be HTTPS and originate from the native deployment configuration; HTTP is admitted only for the ephemeral 127.0.0.1 callback.
- Revocation occurs remotely before the local credential is deleted, preserving an auditable server-side logout contract.
- Errors crossing into React are coarse `invalid-request`, `rejected`, or `unavailable` states and never include credentials, verifier material, codes, or provider responses.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 2 - Missing Critical] Added the Account approval and API revocation bridge**

- **Found during:** Tasks 04-38-01/02
- **Issue:** The plan required a live browser/API flow but its declared file list did not include the Account approval client/UI or the API logout endpoint.
- **Fix:** Added CSRF-protected desktop challenge approval and idempotent bearer revocation using the existing real authority.
- **Files modified:** `apps/account/src/account-auth.ts`, `apps/account/src/features/account-auth.tsx`, `apps/api/src/modules/identity/real-routes.ts`
- **Verification:** Account 83/83 tests and build; API 159/159 tests and TypeScript check.
- **Committed in:** `cb0547f`

**2. [Rule 3 - Blocking] Kept lint and shell command contracts closed after adding the new flow**

- **Found during:** Final verification
- **Issue:** The new Playwright spec was outside the explicit ESLint project list, and the shell test still expected only the prior two Tauri commands.
- **Fix:** Admitted exactly the new spec and updated the shell contract to name all five allowed commands.
- **Files modified:** `eslint.config.mjs`, `apps/desktop/src-tauri/tests/shell_contract.rs`
- **Verification:** ESLint passed with zero warnings; full Rust suite passed 66/66.
- **Committed in:** `cb0547f`

---

**Total deviations:** 2 auto-fixed (1 missing critical, 1 blocking).
**Impact on plan:** Both changes were required to make the planned end-to-end authentication executable and keep existing deny-by-default verification intact; no unrelated product scope was added.

## Issues Encountered

- The focused Playwright logout witness initially navigated to the simulated Security page. Installing the explicit Account authority test transport moved the test onto the production authority composition, after which login and native logout passed behaviorally.
- Workspace-wide Clippy with warnings denied still reports pre-existing dead-code/large-enum warnings outside this plan. Required Rust tests, formatting, TypeScript, ESLint, builds, and focused browser verification all pass.

## Verification

- Account: 83 tests, TypeScript check, and Next.js production build passed.
- API: 159 tests and TypeScript check passed.
- Desktop Rust: 66 tests total; 8 focused identity tests passed.
- Desktop React: 111 tests, TypeScript check, and Vite production build passed.
- Desktop Playwright: 3/3 real-auth flow tests passed.
- Secret scan and diff whitespace checks passed.

## User Setup Required

None in this plan. Deployment origins and hosted-service configuration are owned by Plan 04-40.

## Next Phase Readiness

- Real Account and desktop authentication are ready for the administrative authority work in Plan 04-39.
- Plan 04-40 must inject the final HTTPS API/Account origins into the installed desktop environment and complete hosted end-to-end UAT before beta invitations are issued.

---

_Phase: 04-identity-commerce-devices-and-administration_
_Completed: 2026-08-05_
