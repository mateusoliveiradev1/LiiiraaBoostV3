---
phase: 04-identity-commerce-devices-and-administration
plan: '37'
subsystem: auth
tags: [react, nextjs, csrf, invitation, session, playwright]
requires:
  - phase: 04-identity-commerce-devices-and-administration
    provides: persistent invitation-only signup, password sessions, CSRF, and account authority routes
provides:
  - Real invitation signup, password login, session restoration, and logout in the Account app
  - Production identity chrome and account inspector derived from live authority
  - Browser request-contract coverage with preview disabled
affects: [desktop-auth, admin-auth, staging-deploy]
tech-stack:
  added: []
  patterns: [client-only invitation query admission, in-memory CSRF custody, authority-derived account chrome]
key-files:
  created:
    - apps/account/src/account-auth.ts
    - apps/account/src/features/account-auth.tsx
  modified:
    - apps/account/src/features/account-authority.tsx
    - apps/account/src/app/[locale]/[[...responsibility]]/page.tsx
    - apps/account/src/app/[locale]/layout.tsx
    - tooling/web-evidence/tests/account-authority.spec.ts
key-decisions:
  - "Read invitation and sign-out query parameters in the client auth boundary so the server route remains free of sensitive query handling and deterministic preview selection."
  - "Keep CSRF tokens only in module memory and derive identity, plan, device, security, and support chrome from authority responses."
patterns-established:
  - "Production/preview split: production routes use AccountAuthPage and AccountAuthorityPage; AccountPreviewPage remains explicit preview/test composition only."
  - "Unauthenticated authority reads render a sign-in boundary without exposing account projections."
requirements-completed: [WEB-04, IDEN-01, IDEN-02, IDEN-03, IDEN-04]
duration: 8 min
completed: 2026-08-05
status: complete
---

# Phase 04 Plan 37: Real Account Authentication Summary

**Invitation-only signup, password sessions, logout, profile authority, and account chrome now use the live Fastify authority while deterministic previews remain test-only.**

## Performance

- **Duration:** 8 min
- **Started:** 2026-08-05T22:40:35Z
- **Completed:** 2026-08-05T22:47:45Z
- **Tasks:** 2
- **Files modified:** 10

## Accomplishments

- Connected the Account UI to real CSRF, signup, login, current-session, logout, account projection, and profile mutation routes with credential cookies included.
- Removed Astra, simulated Premium, fixed MFA, and other deterministic identity claims from the production layout.
- Preserved invite admission and sign-out actions entirely inside the client auth boundary while keeping errors generic and secrets out of diagnostics.
- Updated the production-authority browser contract to prove in-memory CSRF issuance and authority-derived UI with preview disabled.

## Task Commits

1. **Task 04-37-01 RED: real Account authentication flow witnesses** - `0c2c2c4` (test)
2. **Tasks 04-37-01/02 GREEN: live Account authentication and authority chrome** - `ed030cf` (feat)

## Files Created/Modified

- `apps/account/src/account-auth.ts` - Typed real authentication client with bounded response admission, in-memory CSRF, credential cookies, and generic failures.
- `apps/account/src/features/account-auth.tsx` - Accessible invitation signup, login, logout, and authority-derived identity chrome.
- `apps/account/src/features/account-authority.tsx` - Real protected account responsibilities, profile mutations, and authority inspector.
- `apps/account/src/app/[locale]/[[...responsibility]]/page.tsx` - Explicit preview/production routing without server query-token handling.
- `apps/account/src/app/[locale]/layout.tsx` - Real identity and account inspector composition.
- `tooling/web-evidence/tests/account-authority.spec.ts` - Production-mode CSRF/session request contracts and authoritative browser assertions.

## Decisions Made

- Used `useSearchParams` behind a Suspense boundary for invitation and logout admission so the server page does not inspect or persist authentication query values.
- Kept newly created accounts on truthful Free, no-device, no-MFA, and no-support-case states until those authorities contain real records.
- Retained deterministic Account previews only when the explicit preview runtime flag is enabled.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] Existing browser authority contract assumed cookie-readable CSRF**
- **Found during:** Plan verification
- **Issue:** The older Playwright contract injected a CSRF cookie and did not serve the new CSRF/session endpoints, so real profile mutations could not complete.
- **Fix:** Mocked the real `/v1/identity/csrf` and `/v1/identity/session` request contracts and asserted the issued in-memory token on profile mutation.
- **Files modified:** `tooling/web-evidence/tests/account-authority.spec.ts`
- **Verification:** Four production-mode Account authority browser tests pass with preview disabled.
- **Committed in:** `ed030cf`

---

**Total deviations:** 1 auto-fixed blocking verification contract.
**Impact on plan:** The change updates existing evidence to the real security model; no product scope was added.

## Issues Encountered

- Six legacy source-inspection tests still required deterministic Astra, Premium, and MFA values in the production layout. They were corrected to assert the explicit preview boundary and authority-derived production components.

## User Setup Required

None in this plan. External staging environment variables and invitation creation remain owned by Plan 04-40.

## Verification

- Account: 6 files, 82 tests passed.
- Account TypeScript and production Next.js build passed.
- Focused ESLint and Prettier checks passed for all changed Account files.
- Web evidence TypeScript check passed.
- Playwright production authority: 4 tests passed with Account preview disabled.

## Self-Check: PASSED

- Signup and login payloads contain no diagnostic or device fields.
- Used invitations and bad passwords share the same generic failure.
- A fresh client restores the credential-cookie session; logout revokes it.
- Production source contains no Astra identity or simulated Premium claim.
- Unauthenticated protected routes render sign-in without account data.

## Next Phase Readiness

- Ready for 04-38 to connect the Tauri desktop system-browser PKCE flow and secure local token custody.
- Three real invitations and deployed end-to-end validation remain intentionally deferred to 04-40.

---
*Phase: 04-identity-commerce-devices-and-administration*
*Completed: 2026-08-05*
