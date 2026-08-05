---
phase: 04-identity-commerce-devices-and-administration
plan: '39'
subsystem: auth
tags: [fastify, postgres, admin, rbac, nextjs, redaction]
requires:
  - phase: 04-identity-commerce-devices-and-administration
    provides: persistent invitation roles, password sessions, and real identity authority
provides:
  - Staging Admin routes backed by persisted operator identity, role, and session rows
  - Role-authorized PostgreSQL collection reads with bounded redacted projections
  - Production Admin loading, denied, empty, and authorized states without eager preview composition
affects: [staging-deploy, operator-invitations, admin-uat]
tech-stack:
  added: []
  patterns:
    [persisted operator role authority, redacted admin read models, unavailable privileged commands]
key-files:
  created:
    - apps/api/src/staging/real-admin.test.ts
  modified:
    - apps/api/src/staging/runtime.ts
    - apps/admin/src/admin-runtime.ts
    - apps/admin/src/admin-runtime-server.ts
    - apps/admin/src/features/admin-authority.tsx
    - apps/admin/src/app/[locale]/[[...workspace]]/page.tsx
key-decisions:
  - 'Derive the active staging Admin role exclusively from a persisted non-tester identity with an active admin session; runtime role escalation is disabled.'
  - 'Expose only bounded allowlisted summaries from PostgreSQL and keep privileged Admin commands unavailable until their real persistence and step-up authorities exist.'
patterns-established:
  - 'Staging Admin authorization: exact origin plus persisted admin credential plus resource/action role policy are all required before a database query runs.'
  - 'Production Admin composition lazy-loads preview code only when preview mode is explicitly enabled.'
requirements-completed: [WEB-07, IDEN-05, IDEN-07, IDEN-08]
duration: 9 min
completed: 2026-08-05
status: complete
---

# Phase 04 Plan 39: Real Administrative Authority Summary

**The isolated Admin origin now authorizes persisted operator sessions, reads only role-allowed redacted PostgreSQL projections, and renders honest production states instead of a simulated dashboard.**

## Performance

- **Duration:** 9 min
- **Started:** 2026-08-05T23:20:26Z
- **Completed:** 2026-08-05T23:29:27Z
- **Tasks:** 2
- **Files modified:** 7

## Accomplishments

- Registered real Admin routes in the staging Fastify runtime using the same PostgreSQL identity/session authority as Account authentication.
- Denied tester, non-admin-session, missing-cookie, and wrong-origin requests before any administrative collection query runs.
- Added bounded redacted read models for support cases, devices, entitlements, sessions, diagnostic consent metadata, and audit events.
- Replaced deployed preview behavior with production loading, denial, authorized-empty, and redacted-record states plus a safe Account login recovery link.
- Kept role mutation, step-up, break-glass, and privileged command persistence unavailable instead of emulating authority.

## Task Commits

1. **Task 04-39-01 RED: persistent Admin authority witnesses** - `634756f` (test)
2. **Task 04-39-01 GREEN: persisted operator and PostgreSQL projection authority** - `7ffec8b` (feat)
3. **Task 04-39-02: production-authority Admin composition** - `e6b2a95` (feat)

## Files Created/Modified

- `apps/api/src/staging/real-admin.test.ts` - Operator, tester, origin, redaction, and privilege-escalation witnesses.
- `apps/api/src/staging/runtime.ts` - Persistent Admin dependency composition and bounded PostgreSQL projection adapters.
- `apps/admin/src/admin-runtime.ts` - Exact HTTPS Account/API origin admission for production Admin.
- `apps/admin/src/admin-runtime-server.ts` - Server-only deployment environment composition.
- `apps/admin/src/features/admin-authority.tsx` - Honest production authority states, empty results, redacted summaries, and Account login recovery.
- `apps/admin/src/features/admin-authority.test.tsx` - Production/preview isolation and origin validation coverage.
- `apps/admin/src/app/[locale]/[[...workspace]]/page.tsx` - Lazy preview loading and explicit production authority props.

## Decisions Made

- An operator is administrative only when the persisted identity role is non-tester and the persisted session kind is `admin`; query parameters and headers cannot grant roles.
- Staging Admin is read-only for now. Missing real command, step-up, role-mutation, and break-glass persistence fails closed rather than using in-memory substitutes.
- PostgreSQL records are mapped to allowlisted `id` and bounded `summary` fields; token digests, email addresses, raw diagnostic payloads, subjects, and event details never leave the adapter.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Resolved the stale admin-role source path**

- **Found during:** Task 04-39-01 read-first gate
- **Issue:** The plan referenced `admin-roles.ts`, while the implemented application authority lives in `assume-admin-role.ts`.
- **Fix:** Read and followed the live application interface without duplicating or renaming it.
- **Files modified:** None.
- **Verification:** API TypeScript and all Admin authorization tests passed.
- **Committed in:** N/A (context correction only).

**2. [Rule 2 - Missing Critical] Added exact Account origin to Admin production runtime**

- **Found during:** Task 04-39-02
- **Issue:** The denied state required a functional login recovery route, but production runtime carried only the API origin.
- **Fix:** Added validated HTTPS Account origin configuration and a locale-preserving sign-in link.
- **Files modified:** `apps/admin/src/admin-runtime.ts`, `apps/admin/src/admin-runtime-server.ts`, `apps/admin/src/features/admin-authority.tsx`
- **Verification:** Admin 81/81 tests, lint, TypeScript, and Next.js build passed.
- **Committed in:** `e6b2a95`

---

**Total deviations:** 2 auto-fixed (1 bug, 1 missing critical).
**Impact on plan:** Both changes were necessary to bind the plan to the live codebase and provide a usable denied-state recovery path; privileged scope remained closed.

## Issues Encountered

- The first GREEN commit command masked ESLint failures behind a later successful command. The lint findings were corrected and the task commit was amended before Task 2 began.

## Verification

- API: 162/162 tests, including 3/3 focused real Admin staging tests, and TypeScript passed.
- Admin: 81/81 tests, TypeScript, ESLint, and Next.js production build passed.
- Production fixture guard: 13/13 tests passed.
- Secret scan and diff whitespace checks passed.

## User Setup Required

None in this plan. Hosted API/Account origins and operator invitation creation are owned by Plan 04-40.

## Next Phase Readiness

- Account, Desktop, and Admin now all have real authority compositions.
- Plan 04-40 can deploy these surfaces, run Neon migrations, create the three bounded invitations, and execute end-to-end staging UAT.

---

_Phase: 04-identity-commerce-devices-and-administration_
_Completed: 2026-08-05_
