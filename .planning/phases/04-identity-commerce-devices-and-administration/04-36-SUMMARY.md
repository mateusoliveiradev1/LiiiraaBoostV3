---
phase: 04-identity-commerce-devices-and-administration
plan: '36'
subsystem: auth
tags: [fastify, postgres, neon, scrypt, pkce, csrf, tauri]
requires:
  - phase: 04-identity-commerce-devices-and-administration
    provides: generated identity/account contracts, PostgreSQL base schema, and staging deployment shell
provides:
  - Persistent invitation-only signup, password login, logout, and session lookup
  - One-use desktop PKCE authorization exchange backed by PostgreSQL
  - Real Fastify staging entrypoint with database-backed readiness
  - Deployable OCI runtime and migration promotion through 0002_real_identity
affects: [account, admin, desktop, staging-deploy]
tech-stack:
  added: []
  patterns: [opaque credentials stored as SHA-256 digests, scrypt password custody, signed CSRF tokens]
key-files:
  created:
    - packages/control-plane-adapters/src/postgres/migrations/0002_real_identity.sql
    - packages/control-plane-adapters/src/postgres/real-identity.ts
    - apps/api/src/modules/identity/real-routes.ts
    - apps/api/src/staging/runtime.ts
  modified:
    - apps/api/src/staging/main.mjs
    - apps/api/Dockerfile
    - packages/control-plane-adapters/src/postgres/staging-migration.ts
key-decisions:
  - "Store invitation, session, state, and authorization-code secrets only as SHA-256 digests; hash passwords with salted scrypt N=32768."
  - "Keep browser mutations behind exact-origin HMAC CSRF proof and secure HttpOnly SameSite=None cookies; desktop uses bearer custody after PKCE S256 exchange."
  - "Run both the base and real-identity migrations before staging promotion, and make readiness depend on live PostgreSQL connectivity."
patterns-established:
  - "Real staging authority: process recreation reconnects to PostgreSQL rather than rebuilding fixture state."
  - "Generic authentication failures: invalid, expired, revoked, and replayed credentials do not reveal which check failed."
requirements-completed: [IDEN-01, IDEN-02, IDEN-03, IDEN-04, IDEN-07]
duration: 24 min
completed: 2026-08-05
status: complete
---

# Phase 04 Plan 36: Persistent Real Authentication Summary

**Invitation-only PostgreSQL authentication with scrypt passwords, revocable opaque sessions, browser CSRF protection, and one-use desktop PKCE exchange now replaces the health-only staging preview.**

## Performance

- **Duration:** 24 min
- **Started:** 2026-08-05T22:02:52Z
- **Completed:** 2026-08-05T22:26:40Z
- **Tasks:** 2
- **Files modified:** 16

## Accomplishments

- Added an idempotent real-identity migration and persistent repository for invitations, identities, sessions, profile versions, and desktop authorization challenges.
- Exposed real signup, login, logout, current-session, account, profile, desktop authorization, approval, and exchange routes from Fastify.
- Replaced the health-only process with a database-connected staging runtime whose readiness fails closed when PostgreSQL is unavailable.
- Corrected the deploy artifact and migration runner so the published runtime contains its workspace dependencies and applies `0002_real_identity` before promotion.

## Task Commits

1. **Task 04-36-01 RED: real identity authority witnesses** - `11803a5` (test)
2. **Task 04-36-01 GREEN: persistent invitation-only identity authority** - `de52c35` (feat)
3. **Task 04-36-02 RED: real staging route witnesses** - `2d1d5a6` (test)
4. **Task 04-36-02 GREEN: real staging authentication and account authority** - `2a9174f` (feat)
5. **Deploy closure RED: require deployable real runtime** - `1ed9de3` (test)
6. **Deploy closure GREEN: package runtime and apply identity migration** - `ef5a9fd` (fix)

## Files Created/Modified

- `packages/control-plane-adapters/src/postgres/migrations/0002_real_identity.sql` - Invitation, identity role, authentication-method, and desktop challenge schema.
- `packages/control-plane-adapters/src/postgres/real-identity.ts` - Scrypt credential authority and PostgreSQL persistence.
- `apps/api/src/modules/identity/real-routes.ts` - Real browser and desktop authentication HTTP boundary.
- `apps/api/src/staging/runtime.ts` - Fastify composition, exact-origin CORS, migrations, health, and database readiness.
- `apps/api/src/staging/main.mjs` - Production staging process entrypoint.
- `apps/api/Dockerfile` - Runtime source, workspace packages, and pnpm dependency graph included in the final image.
- `packages/control-plane-adapters/src/postgres/staging-migration.ts` - Promotion runner now applies and verifies both migrations.

## Decisions Made

- Used the existing project-owned identity port with Node's native `scrypt` rather than coupling the first real invitation flow directly to provider internals.
- Kept desktop secrets out of the renderer-facing account projection; the PKCE exchange returns explicit Windows Credential Manager custody metadata.
- Kept new accounts truthfully on Free with empty real collections until commerce/device/support authorities are connected.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] Final OCI image omitted the real runtime dependency graph**
- **Found during:** Plan verification
- **Issue:** `main.mjs` imported `runtime.ts`, Fastify, and workspace packages that were absent from the runtime stage.
- **Fix:** Copied the installed pnpm graph, API package, and required workspace packages from the verified stage.
- **Files modified:** `apps/api/Dockerfile`, `apps/api/src/staging/container-contract.test.ts`
- **Verification:** Container contract and full API suite pass.
- **Committed in:** `ef5a9fd`

**2. [Rule 3 - Blocking] Promotion migration command stopped after the base schema**
- **Found during:** Plan verification
- **Issue:** API startup applied migration 0002, but the CI `db:migrate` command applied and inspected only 0001.
- **Fix:** Composed base plus identity migrations and verified the latest migration checksum before returning success.
- **Files modified:** `packages/control-plane-adapters/src/postgres/staging-migration.ts`, `packages/control-plane-adapters/src/postgres/staging-migration.test.ts`
- **Verification:** Adapter tests, TypeScript, architecture, and production-truth gates pass.
- **Committed in:** `ef5a9fd`

---

**Total deviations:** 2 auto-fixed blocking deployment defects.
**Impact on plan:** Both fixes are required for the implemented authentication authority to boot correctly after deployment; no product scope was added.

## Issues Encountered

- Live PostgreSQL integration tests remain intentionally skipped locally because this project does not use Docker for this flow. Persistent Neon execution is deferred to the deployment plan.

## User Setup Required

None in this plan. Staging secrets, Neon migration, and the three invitation deliveries are handled by Plan 04-40 without committing credentials or invitation URLs.

## Verification

- API: 19 files, 159 tests passed.
- Adapters: 6 files, 39 tests passed, 4 live-PostgreSQL tests intentionally skipped.
- Container contract: 5 tests passed.
- API and adapter TypeScript checks passed.
- Architecture: 46 tests passed.
- Production truth: 13 tests passed.

## Self-Check: PASSED

- Invitation/session/password/PKCE acceptance criteria are covered by focused and full suites.
- All key created files exist and every production change has an atomic commit.
- The staging entrypoint contains no fixture or health-only authority composition.

## Next Phase Readiness

- Ready for 04-37 to replace the Account preview login and signup with these live routes.
- Deployment remains intentionally pending until Account, desktop, Admin, provisioning, and external staging configuration are complete.

---
*Phase: 04-identity-commerce-devices-and-administration*
*Completed: 2026-08-05*
