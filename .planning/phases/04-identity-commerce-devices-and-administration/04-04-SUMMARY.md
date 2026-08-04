---
phase: 04-identity-commerce-devices-and-administration
plan: '04'
subsystem: database
tags: [postgresql, migrations, kysely, fastify, better-auth, stripe, testcontainers, audit]
requires:
  - phase: 04-identity-commerce-devices-and-administration
    provides: Exact Phase 4 package-legitimacy approval from Plan 04-01
  - phase: 04-identity-commerce-devices-and-administration
    provides: Synthetic PostgreSQL admission and deterministic harness strategy from Plan 04-02
  - phase: 04-identity-commerce-devices-and-administration
    provides: Bounded Better Auth PASS decision from Plan 04-05
provides:
  - Exact review-backed server dependency graph with scripts disabled and frozen resolution
  - Authoritative PostgreSQL schema for identity, commerce, devices, support, consent, outbox, audit, deletion, and retention
  - SHA-256 checksum-locked serializable migration runner with advisory locking and schema inspection
  - Deterministic rollback/replay proof plus live synthetic PostgreSQL and Testcontainers probes
affects: [04-07, 04-08, 04-09, 04-10, 04-11, 04-12, control-plane]
tech-stack:
  added:
    - fastify@5.10.0
    - '@fastify/cors@11.3.0'
    - '@fastify/helmet@13.1.0'
    - kysely@0.29.4
    - pg@8.22.0
    - testcontainers@12.0.4
    - better-auth@1.6.25
    - '@better-auth/passkey@1.6.25'
    - '@better-auth/oauth-provider@1.6.25'
    - stripe@22.4.0
    - '@aws-sdk/client-s3@3.1102.0'
    - '@aws-sdk/client-sesv2@3.1102.0'
  patterns:
    - External packages live in their narrowest consuming API or adapter package
    - Ordered migrations are serialized, checksum-verified, and recorded atomically
    - Live database proof accepts only synthetic identities and otherwise remains daemon-free
key-files:
  created:
    - packages/control-plane-adapters/src/postgres/migrations/0001_control_plane.sql
    - packages/control-plane-adapters/src/postgres/database.ts
    - packages/control-plane-adapters/src/postgres/migrate.ts
    - packages/control-plane-adapters/src/postgres/migrations.test.ts
  modified:
    - apps/api/package.json
    - packages/control-plane-adapters/package.json
    - architecture/dependency-allowlist.json
    - architecture/dependency-review.md
    - pnpm-lock.yaml
key-decisions:
  - 'Keep Fastify/CORS/helmet at the API boundary while database, identity, commerce, object-storage, and email SDKs remain in control-plane-adapters.'
  - 'Use a serializable pg migration transaction with a PostgreSQL advisory lock and SHA-256 migration record; expose Kysely through the database adapter for typed repositories.'
  - 'Enforce audit append-only behavior with chain-head locking, contiguous sequence/hash checks, mutation/truncate triggers, and public privilege revocation.'
  - 'Run live probes only for explicit synthetic URLs or isolated Testcontainers; use the reviewed daemon-free checksum/DDL/transaction fallback when no PostgreSQL daemon exists.'
patterns-established:
  - 'Migration integrity: SQL bytes are hashed once, checked before replay, and inserted into control_plane_schema_migrations in the same transaction as the schema.'
  - 'Database authority: aggregate versions, provider inbox uniqueness, outbox claims, and one-active-device constraints are enforced in PostgreSQL rather than cache or application convention.'
  - 'Audit correction: audit rows cannot update, delete, or truncate; corrections append a new hash-linked event.'
requirements-completed: [WEB-04, WEB-05, WEB-06, WEB-07, IDEN-04, IDEN-09]
metrics:
  duration: 22 min
  completed: 2026-08-04
  tasks: 2
  files: 9
status: complete
---

# Phase 04 Plan 04: Authoritative PostgreSQL Control Plane Summary

**Exact approved server pins now back a checksum-locked PostgreSQL control-plane schema with transactional replay protection, one-active-device enforcement, durable inbox/outbox state, append-only hash-linked audit events, and bounded retention fields.**

## Performance

- **Duration:** 22 min
- **Started:** 2026-08-04T23:19:56Z
- **Completed:** 2026-08-04T23:42:11Z
- **Tasks:** 2, including one TDD task
- **Files modified:** 9

## Accomplishments

- Installed only the 12 exact approved/researched server identities, placed them at their narrowest consumers, regenerated registry-backed review evidence, and reproduced the lockfile with lifecycle scripts disabled.
- Created all 17 required PostgreSQL authority tables with UUID keys, `TIMESTAMPTZ` fields, aggregate versions, provider/event uniqueness, durable outbox claiming, consent/deletion/retention state, and minimized sensitive data.
- Enforced exactly one active device per Premium entitlement through the named partial unique index while retaining row-lockable entitlement heads and optimistic versions.
- Added append-only audit semantics with serialized chain-head updates, contiguous sequence/hash validation, correction links, UPDATE/DELETE/TRUNCATE rejection triggers, and public mutation privilege revocation.
- Added a SHA-256 checksum migration runner and schema inspector with deterministic apply-once, replay, checksum-drift, interruption rollback, and reapply proof.

## TDD Gates

### RED

- Commit `ae529c7` added checksum, fresh/replay, rollback/reapply, constraint, privilege, minimization, and live PostgreSQL probes.
- The suite failed at collection because `database.ts` and `migrate.ts` did not exist, the intended missing-migration failure before implementation.

### GREEN

- Commit `bbd0f08` added the reviewed SQL migration, pg/Kysely database adapter, checksum runner, schema inspector, focused API command, and safe live/fallback test strategy.
- The focused command passes 4 deterministic tests. Three live-only probes are collected and skipped locally because Docker, Podman, `psql`, and a local PostgreSQL service are unavailable.
- Setting an explicitly synthetic `TEST_DATABASE_URL`, `POSTGRES_TEST_STRATEGY=testcontainers`, or CI activates the live PostgreSQL 18 lifecycle, concurrency, audit, privilege, and inspection probes; production-labeled URLs fail closed before connection.

### REFACTOR

- Query result normalization, serializable transaction handling, migration metadata, and schema inspection were consolidated behind `ControlPlaneDatabase`, `migrateControlPlane`, and `inspectControlPlaneSchema` during GREEN.
- No separate behavior-neutral refactor commit was required after the focused, supply-chain, and architecture gates passed.

## Task Commits

1. **Task 04-04-01: install approved exact dependencies** — `5427d0d` (`chore`)
2. **Task 04-04-01 ownership correction: colocate Testcontainers** — `89f87e1` (`fix`)
3. **Task 04-04-02 RED: specify authoritative migration behavior** — `ae529c7` (`test`)
4. **Task 04-04-02 GREEN: implement migration and schema** — `bbd0f08` (`feat`)

## Files Created/Modified

- `apps/api/package.json` — exact Fastify boundary pins and the focused `db:migrate:test` command.
- `packages/control-plane-adapters/package.json` — exact PostgreSQL, identity, commerce, S3, SES, and adapter-owned Testcontainers pins.
- `architecture/dependency-allowlist.json` — exact registry, repository, license, lifecycle, purpose, and human-review records for every admitted identity.
- `architecture/dependency-review.md` — regenerated evidence report for 72 exact pins.
- `pnpm-lock.yaml` — frozen exact importer and transitive resolution graph.
- `packages/control-plane-adapters/src/postgres/migrations/0001_control_plane.sql` — complete authoritative control-plane DDL, indexes, functions, triggers, and privilege revocations.
- `packages/control-plane-adapters/src/postgres/database.ts` — bounded pg pool, serializable transaction seam, and Kysely dialect composition.
- `packages/control-plane-adapters/src/postgres/migrate.ts` — ordered checksum migration execution and live catalog inspection.
- `packages/control-plane-adapters/src/postgres/migrations.test.ts` — deterministic fallback plus conditional live PostgreSQL lifecycle and invariant probes.

## Decisions Made

- Assigned HTTP dependencies only to `@liiiraa/api`; all provider and persistence SDKs belong to `@liiiraa/control-plane-adapters`, and Testcontainers is a dev dependency of the package that owns migration tests.
- Used PostgreSQL advisory transaction locking plus a SHA-256 checksum row to prevent concurrent, reordered, or byte-drifted migration execution.
- Kept provider payload storage to a digest and object storage to bounded encrypted metadata; no raw serial, full-card, bearer-token, plaintext-password, or diagnostic-blob column exists.
- Used triggers as the owner-resistant audit immutability backstop while keeping explicit privilege revocation for non-owner application roles.

## Verification Results

- `rtk pnpm install --frozen-lockfile --ignore-scripts`: **PASS** — exact frozen resolution reproduced without lifecycle execution.
- `rtk pnpm supply-chain:check`: **PASS** — 72 exact dependency pins verified; all 12 Phase 4 server pins have review-backed exact metadata.
- Exact manifest ownership/version assertion: **PASS** — all 12 identities match the approved versions with no range prefixes.
- `rtk pnpm --filter @liiiraa/api db:migrate:test`: **PASS** — 4/4 daemon-free deterministic proofs; 3 live-only probes safely skipped because no database daemon exists.
- PostgreSQL harness admission suite: **PASS** — 10/10 safe strategy, production-label rejection, redaction, and serializable seam tests.
- Better Auth bounded spike regression: **PASS** — 13/13 D-01 through D-10 tests remain green after production dependency admission.
- `rtk pnpm test:architecture`: **PASS** — both live adapters executed and 46/46 architecture tests passed.
- Stub scan: **PASS** — no TODO, FIXME, placeholder, coming-soon, or unimplemented runtime path exists in changed files.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Moved Testcontainers to its actual test owner**

- **Found during:** Task 04-04-02 read-first/TDD setup
- **Issue:** The initial research command placed Testcontainers in `@liiiraa/api`, but the plan-owned migration suite lives in `@liiiraa/control-plane-adapters`; pnpm strict isolation would make the package unavailable to its test.
- **Fix:** Moved the same approved exact `testcontainers@12.0.4` pin to adapter devDependencies without changing identity, version, lifecycle policy, or lock integrity.
- **Files modified:** `apps/api/package.json`, `packages/control-plane-adapters/package.json`, `pnpm-lock.yaml`
- **Verification:** Frozen install and supply-chain checks pass; the adapter suite resolves GenericContainer.
- **Committed in:** `89f87e1`

**2. [Rule 3 - Blocking] Routed the focused migration command to the owning suite**

- **Found during:** Task 04-04-02 GREEN
- **Issue:** The inherited API command searched only `apps/api/src/**/*.postgres.test.ts`, while the required test path is in the adapter package, producing a false-green no-test result.
- **Fix:** Pointed `db:migrate:test` at the exact adapter-owned migration test through pnpm's package directory execution.
- **Files modified:** `apps/api/package.json`
- **Verification:** The exact plan command collects seven cases and runs the four safe local proofs.
- **Committed in:** `bbd0f08`

**3. [Rule 1 - Bug] Removed a forbidden adapter-to-composition test dependency**

- **Found during:** Task 04-04-02 architecture verification
- **Issue:** The first GREEN test imported the API's private PostgreSQL harness path, violating deep-import and adapter-to-composition layer rules.
- **Fix:** Kept identical fail-closed synthetic/production-label admission inside the migration proof without creating a production dependency edge.
- **Files modified:** `packages/control-plane-adapters/src/postgres/migrations.test.ts`
- **Verification:** Architecture adapters report no violations and 46/46 architecture tests pass.
- **Committed in:** `bbd0f08`

---

**Total deviations:** 3 auto-fixed (2 correctness bugs, 1 blocking command seam).
**Impact on plan:** All fixes were necessary for strict dependency ownership, truthful test execution, and enforced module direction. No new package, endpoint, provider account, credential, cache authority, or unplanned schema surface was introduced.

## Known Stubs

None. The migration, schema inspection, deterministic proof, and conditional live probes are complete. Local live probes are environment-gated rather than placeholder behavior.

## Threat Flags

No unplanned trust boundary was introduced. Package installation, PostgreSQL authority, device concurrency, provider idempotency, migration tampering, and audit immutability are the exact surfaces registered in the plan threat model and are mitigated above.

## Issues Encountered

- Context7 MCP was unavailable and the documented Bash fallback could not run because WSL has no installed distribution. The implementation used the exact installed Kysely, pg, and Testcontainers runtime/type surfaces and verified their exported APIs directly.
- Docker Desktop's Linux engine, Podman, `psql`, and a local PostgreSQL service are unavailable on this machine. The plan's daemon-free deterministic fallback ran; the same committed suite activates all live probes in CI/Testcontainers or against an explicitly synthetic URL.
- Focused type-aware ESLint cannot include the adapter files because the pre-existing adapter package has no TypeScript project. This plan did not broaden scope with a new project configuration; Prettier, Vitest runtime transforms, supply-chain gates, and the complete architecture suite passed.

## User Setup Required

None. No provider credentials, cloud resources, or external accounts are required. Live migration probes run automatically when CI/Testcontainers or an explicitly synthetic `TEST_DATABASE_URL` is available.

## Next Phase Readiness

- Identity, commerce, device, support, consent, and administration plans can build repositories and use cases against authoritative tables with explicit aggregate versions.
- Stripe reconciliation can rely on unique durable provider inbox admission and claimable outbox jobs without granting authority from navigation.
- Device binding can lock the Premium entitlement head and rely on the partial unique active-device index as a database backstop.
- Deployment work must run the committed live probe against isolated PostgreSQL/Neon before any staging promotion; production-labeled databases remain prohibited test targets.

## Self-Check: PASSED

- All four declared created migration artifacts and five modified dependency artifacts exist on disk.
- Task/deviation/TDD commits `5427d0d`, `89f87e1`, `ae529c7`, and `bbd0f08` exist in repository history in the required RED-before-GREEN order.
- Frozen install, exact-pin assertion, supply-chain review, focused migration proof, PostgreSQL admission, identity regression, architecture, and stub scans pass.
- Docker/PostgreSQL unavailability is recorded explicitly; no live claim is made for this host, and the live synthetic/Testcontainers probes remain executable in the committed suite.
