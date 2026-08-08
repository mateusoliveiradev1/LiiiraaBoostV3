---
phase: 04-identity-commerce-devices-and-administration
plan: '63'
subsystem: private-beta-distribution
tags: [account, authentication, private-blob, installer, vercel, beta]
requires:
  - phase: 04-61
    provides: Real authenticated Account authority and isolated staging deployment
provides:
  - Session-gated same-origin delivery of one immutable Internal Windows installer
  - Private Vercel Blob storage with anonymous and direct-access denial
  - Honest unsigned-Internal trust copy and a permanent authenticated Downloads route
  - Deployed digest-bound proof for build internal-023001
affects: [04-40, private-beta, account-downloads, desktop-distribution]
tech-stack:
  added: ['@vercel/blob@2.7.0']
  patterns: [authenticate-before-storage, fixed-server-owned-artifact, no-redirect-private-stream]
key-files:
  created:
    - apps/account/src/app/api/internal-download/route.ts
    - apps/account/src/features/internal-download.ts
    - apps/account/src/features/internal-download.test.ts
  modified:
    - apps/account/src/features/account-authority.tsx
    - apps/account/src/app/account-shell.css
    - apps/account/src/account-preview-model.ts
    - apps/account/src/account-production-model.ts
    - .github/workflows/phase-4-surfaces.yml
key-decisions:
  - 'Internal installer delivery authenticates the same-origin account session before any private storage read and never redirects to the Blob identity.'
  - 'The browser supplies no artifact pathname, account identifier, storage URL, or storage credential.'
  - 'Downloads is a permanent authenticated navigation goal, separate from PCs and licenses.'
requirements-completed: [WEB-04, IDEN-01, IDEN-02, IDEN-03, IDEN-07]
duration: 45 min
completed: 2026-08-08
status: complete
---

# Phase 04 Plan 63: Private Internal Installer Delivery Summary

**Invited authenticated accounts can now download the exact numbered Internal Windows installer through a private, fail-closed Account route without creating a public unsigned distribution channel.**

## Accomplishments

- Added one fixed server-owned private artifact route that validates the Account session before opening Vercel Blob storage.
- Streamed the installer as a no-store attachment without exposing the private Blob URL, pathname controls, credentials, or browser-controlled account identity.
- Added explicit copy distinguishing invited Internal testing from a publicly signed stable release.
- Uploaded build `internal-023001` immutably with pathname `internal/windows/internal-023001/Liiiraa Boost_0.0.1_x64-setup.exe`, size `5,478,552` bytes, and SHA-256 `79ea2c63f682139f5e76312fc7f216e2c2398583a5870301df57a114998e4373`.
- Confirmed through the user's authenticated session that the deployed installer downloads correctly.
- Fixed the discovered navigation regression by promoting Downloads to a permanent desktop and mobile account destination.

## Task Commits

1. `076d932` — require authenticated private installer delivery.
2. `cefb73f` — protect the private Internal installer boundary.
3. `2bbba78` — require honest invited download UI.
4. `fa1f1f5` — expose the invited tester download.
5. `d5c7e78` — sequence private beta distribution.
6. `1d6ce17` — keep private Downloads permanently reachable.

## Verification

- Account verification: 106 tests passed, TypeScript passed, and Next.js production build passed.
- Anonymous `/api/internal-download` access returns 401 without redirect or storage identity disclosure.
- Direct anonymous Blob access returns 403.
- Private Blob stream matches the expected size and SHA-256 exactly.
- Human authenticated proof confirmed the installer download started correctly.
- Deployment pipeline `31282644644` passed on revision `1d6ce175e3a3d4df2e57f0b0a587d17f1454636c`, including exact Account deployment, anonymous denial, and origin/session/consent isolation probes.

## Deviations from Plan

### Auto-fixed issue

**Downloads disappeared after navigating away**

- **Cause:** `account-downloads` was modeled as a contextual route under `account-device`, while persistent navigation rendered only top-level account goals.
- **Fix:** promoted Downloads to its own bilingual account goal in preview and production models.
- **Proof:** regression test failed before the change and the full 106-test Account suite plus deployed pipeline passed after it.

## Safety Boundaries Preserved

- Public stable distribution remains unavailable and no public signing claim was added.
- No Docker, destructive invitation reset, production data mutation, or secret exposure was used.
- The user's existing owner/admin account and the two stale tester invitations were not modified.

## Next Phase Readiness

Plan 04-40 may resume with protected tester invitation provisioning. Invalidating stale invitations still requires separate explicit approval, and tester emails must be supplied through a protected input rather than chat, source control, or logs.

## Self-Check: PASSED

---

_Phase: 04-identity-commerce-devices-and-administration_
_Completed: 2026-08-08_
