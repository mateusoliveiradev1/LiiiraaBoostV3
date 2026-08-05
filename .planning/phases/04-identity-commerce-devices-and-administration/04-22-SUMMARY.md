---
phase: 04-identity-commerce-devices-and-administration
plan: "22"
subsystem: api-infrastructure
tags: [fastify, staging, invitations, oci, ghcr, render, supply-chain]

requires:
  - phase: 04-identity-commerce-devices-and-administration
    provides: Identity, commerce, device, entitlement, support, email, privacy, audit, and administration authority surfaces from Plans 04-13 through 04-30
provides:
  - Fail-closed synthetic invitation-only staging environment admission
  - Deterministic isolated developer/tester seeds and expiring single-use invitations
  - Complete Fastify API/worker module registration contract with health and readiness routes
  - Non-root Node 24.18.0 OCI definition and protected digest-only GHCR-to-Render workflow
affects: [04-23, phase-4-staging, web-surfaces, desktop-internal-channel, release-promotion]

tech-stack:
  added: []
  patterns:
    - Exact non-production authority admission before Fastify listens
    - One immutable OCI digest propagated through build, attest, scan, and deploy definitions

key-files:
  created:
    - apps/api/src/config/env.ts
    - apps/api/src/app.ts
    - apps/api/src/server.ts
    - apps/api/src/staging/seed.ts
    - apps/api/src/staging/invitations.ts
    - apps/api/Dockerfile
    - apps/api/staging.render.yaml
    - .github/workflows/phase-4-staging-api.yml
  modified:
    - tooling/ci/verify-required-artifacts.mjs

key-decisions:
  - "Reject any staging startup unless origins, Neon data classification, Stripe keys, AWS resources, signup mode, invitation mode, and channel are exact non-production values."
  - "Require every API and worker authority registrar before readiness can be exposed."
  - "Build and publish without a mutable image tag, then attest, scan, and deploy only the exact build digest through the protected staging environment definition."

patterns-established:
  - "Synthetic authority gate: configuration is admitted once before app composition and never inferred from ambient production state."
  - "Invitation isolation: deterministic synthetic identities receive distinct account, dataset, and device IDs; redemption is expiring and single-use."
  - "Daemon-free local verification: container and deployment artifacts are inspected as static text; Docker remains CI/hosting-only."

requirements-completed: [WEB-04, WEB-06, IDEN-01, IDEN-09]

duration: 14min
completed: 2026-08-05
status: complete
---

# Phase 04 Plan 22: Invitation-Only Staging API Summary

**Fail-closed Fastify staging composition with isolated synthetic invitations and a digest-only, attested GHCR-to-Render artifact contract**

## Performance

- **Duration:** 14 min
- **Started:** 2026-08-05T08:00:00Z
- **Completed:** 2026-08-05T08:13:42Z
- **Tasks:** 2
- **Files modified:** 14

## Accomplishments

- Added exact environment admission that refuses wildcard/missing origins, non-synthetic databases, live Stripe authority, production AWS resources, public signup, non-invited admission, and Stable/Beta channels before Fastify can listen.
- Added deterministic developer/tester seeding and expiring single-use invitation redemption with isolated account, dataset, and device identities and an explicit non-production D-09 developer Premium grant.
- Added an ordered all-or-nothing API/worker registration contract plus health/readiness routes, with 17 focused staging tests and the full 155-test API suite passing.
- Added non-root multi-stage Node 24.18.0/pnpm 11.17.0 container, Render, SBOM/provenance, scan, GHCR, and protected digest-only deployment definitions verified without Docker or external mutations.

## Task Commits

Each task was committed atomically:

1. **Task 04-22-01 RED: staging composition behavioral contract** - `697005a` (test)
2. **Task 04-22-01 GREEN: fail-closed staging API composition** - `1b1ed36` (feat)
3. **Task 04-22-02: immutable staging API artifact definitions** - `fbba338` (feat)

## Files Created/Modified

- `apps/api/src/config/env.ts` - Exact synthetic/sandbox/invitation-only environment admission.
- `apps/api/src/app.ts` - Fastify security plugins, health/readiness, and required API/worker registration.
- `apps/api/src/server.ts` - Node/pnpm-compatible server listener boundary.
- `apps/api/src/staging/seed.ts` - Deterministic isolated synthetic identity seeds.
- `apps/api/src/staging/invitations.ts` - Expiring, single-use invited tester provisioning.
- `apps/api/src/staging/staging-config.test.ts` - RED/GREEN environment, seed, invitation, and composition matrix.
- `apps/api/Dockerfile` - Non-root multi-stage Node 24.18.0/pnpm 11.17.0 OCI definition.
- `.dockerignore`, `apps/api/.dockerignore` - Root-context and API-context secret/build exclusion contracts.
- `apps/api/staging.render.yaml` - Manual, digest-required Render staging service definition.
- `.github/workflows/phase-4-staging-api.yml` - Build-once, attest, scan, publish-by-digest, and protected deploy workflow.
- `apps/api/src/staging/container-contract.test.ts` - Daemon-free static artifact and immutable-promotion verification.
- `apps/api/src/raw.d.ts` - Typed raw-text imports for static artifact tests.
- `tooling/ci/verify-required-artifacts.mjs` - Dedicated fail-closed reachability checks for the Phase 4 staging workflow without weakening Phase 1 CI policy.

## Decisions Made

- Environment configuration remains a closed staging contract: a caller cannot widen an origin or substitute production data/provider authority and still compose the app.
- All route and worker boundaries are registered in one canonical order; missing, duplicate, or unknown authority modules reject composition.
- OCI publishing uses BuildKit push-by-digest with SBOM/provenance, and the same digest is the subject of attestation, vulnerability scanning, and protected Render deployment.
- Local evidence is deliberately daemon-free in accordance with D-59 and the execution constraint. Docker builds, hosted health checks, registry publication, and deployment exist only as CI definitions and were not invoked during this plan.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] Added a root Docker build-context exclusion file**

- **Found during:** Task 04-22-02 (immutable API image)
- **Issue:** The API depends on workspace packages, so the correct OCI build context is the repository root; `apps/api/.dockerignore` alone is not consumed by a root-context build.
- **Fix:** Added a matching root `.dockerignore` that excludes secrets, unrelated applications, generated desktop artifacts, dependencies, and build output while retaining the API and owning workspace packages.
- **Files modified:** `.dockerignore`, `apps/api/.dockerignore`
- **Verification:** `container-contract` verifies both exclusion contracts and the workflow uses `context: .` with `file: apps/api/Dockerfile`.
- **Committed in:** `fbba338`

**2. [Rule 3 - Blocking] Added a dedicated staging-workflow verifier path**

- **Found during:** Task 04-22-02 (CI reachability verification)
- **Issue:** The existing verifier applied the Phase 1 read-only workflow shape to every `--ci` path, which would reject required staging package, attestation, scan, and deployment permissions and also coupled this plan to unrelated root-script evolution.
- **Fix:** Added a path-specific staging verifier that requires exact pins, least scoped job permissions, supply-chain ordering, tests/migrations, SBOM/provenance, digest-only scan/deploy, protected environment, and health/readiness reachability while leaving the original Phase 1 checks unchanged.
- **Files modified:** `tooling/ci/verify-required-artifacts.mjs`
- **Verification:** `rtk node tooling/ci/verify-required-artifacts.mjs --ci .github/workflows/phase-4-staging-api.yml` passes.
- **Committed in:** `fbba338`

---

**Total deviations:** 2 auto-fixed (2 blocking).
**Impact on plan:** Both changes were required for a correct monorepo build context and executable static CI verification. No provider, registry, Docker daemon, or deployment state was touched.

## Issues Encountered

- The generic CI artifact verifier initially rejected the staging workflow because its original policy intentionally models the Phase 1 read-only verification workflow. A path-specific policy resolved the mismatch without weakening existing checks.
- The first container-contract run used an over-broad mutable-tag regular expression that also matched the `image-ref` field name. The assertion was narrowed to reject actual `liiiraa-boost-api:<tag>` promotion syntax while continuing to require `@sha256` digest propagation.

## User Setup Required

External staging activation remains intentionally manual and was not performed during execution:

- Create synthetic-only Neon branches and provide `STAGING_DATABASE_URL`.
- Configure Stripe test-mode keys/webhook, SES sandbox recipients, and separate staging support/audit buckets.
- Configure a protected `staging-api` GitHub environment with GHCR/Render access and staging origins.
- Create the Render service from `apps/api/staging.render.yaml`; keep `autoDeploy: false` and promote only the workflow-provided digest.

## Verification

- `rtk pnpm --filter @liiiraa/api test -- --run staging-config` - 17/17 passed.
- `rtk pnpm --filter @liiiraa/api test -- --run container-contract` - 5/5 passed.
- `rtk pnpm --filter @liiiraa/api test -- --run` - 155/155 passed across 18 files.
- `rtk pnpm --filter @liiiraa/api exec tsc -p tsconfig.json` - passed.
- `rtk node tooling/ci/verify-required-artifacts.mjs --ci .github/workflows/phase-4-staging-api.yml` - passed.
- Prettier and focused ESLint checks - passed.
- Docker/container execution and external hosted smoke - intentionally not run; prohibited by execution constraints and represented only in the protected CI definition.

## Known Stubs

None. Unsynchronized Render environment variables are intentional secret/configuration inputs, not fallback values; their absence fails environment admission.

## Next Phase Readiness

- Plan 04-23 can bind the three isolated web origins and restricted desktop Internal channel to the exact staging API contract.
- Remote reachability requires the manual external setup above and an authorized CI run; this plan performed no external deployment or provider mutation.

## Self-Check: PASSED

- All key files exist in the shared checkout.
- RED, GREEN, and immutable-artifact commits are present in git history.
- Focused acceptance criteria, full daemon-free API tests, type checks, lint, formatting, and CI reachability checks pass.
- `.impeccable/` and `apps/desktop/src-tauri/gen/` remain untracked, untouched, and unstaged.

---

*Phase: 04-identity-commerce-devices-and-administration*
*Completed: 2026-08-05*
