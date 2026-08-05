---
phase: 04-identity-commerce-devices-and-administration
plan: "17"
subsystem: account-authority
tags: [account, etag, optimistic-concurrency, fastify, postgresql-authority]
requires:
  - phase: 04-identity-commerce-devices-and-administration
    provides: Identity, commerce, device, support, and generated control-plane contracts from Plans 04-12 through 04-15
  - phase: 04-identity-commerce-devices-and-administration
    provides: Owner-bound account projection RED witnesses from Plan 04-32
provides:
  - Minimized owner-scoped shared account projection across identity, security, sessions, commerce, support, and device authority
  - Expected-version account mutation with ETag/If-Match and conflict-preserved draft correlation
  - Daemon-free contradiction, concurrency, and cross-client projection verification
affects: [04-18, 04-20, 04-21, 04-35]
tech-stack:
  added: []
  patterns:
    - Owner authorization occurs before any account snapshot load
    - Atomic snapshot assembly rejects contradictory aggregate combinations
    - Stale writes return the remote projection while preserving only an opaque local draft token
key-files:
  created:
    - packages/control-plane-application/src/use-cases/project-account.ts
    - packages/control-plane-application/src/use-cases/update-account.ts
    - packages/control-plane-application/src/use-cases/project-account.test.ts
    - apps/api/src/modules/account/routes.ts
  modified:
    - packages/control-plane-application/src/index.ts
    - apps/api/src/modules/account/account-projection.test.ts
key-decisions:
  - "Authorize the owner before loading any account snapshot, then assemble all shared truth from one atomic repository view."
  - "Represent client observation as online, offline, stale, pending, or conflict while keeping generated authority provenance on each canonical component."
  - "Treat If-Match and command expectedVersion as the same optimistic-concurrency claim and reject any mismatch before mutation."
requirements-completed: [WEB-04, WEB-05, IDEN-01, IDEN-02, IDEN-04]
metrics:
  duration: 13 min
  completed: 2026-08-05
  tasks: 1
  files: 6
status: complete
---

# Phase 04 Plan 17: Versioned Account Truth Summary

**One owner-authorized account projection now joins generated identity, security, session, subscription, invoice, support, and active-device truth with atomic expected-version mutation and conflict-preserved drafts.**

## Performance

- **Duration:** 13 min
- **Started:** 2026-08-05T04:52:30Z
- **Completed:** 2026-08-05T05:05:24Z
- **Tasks:** 1
- **Files modified:** 6

## Accomplishments

- Added a minimized shared projection that redacts email, excludes provider/session/device secrets, and never includes technical PC activity, unshared diagnostics, operational history, or restoration data.
- Added contradiction admission across account ownership, subscription pending/active state, Premium capabilities, and active-device authority before a projection can be returned or a write committed.
- Added atomic expected-version profile mutation with authoritative ETag emission, strict If-Match agreement, typed 409 conflict responses, remote projection preservation, and an untouched opaque local draft token.
- Replaced both `EXPECTED_RED[04-17-01]` sentinels with executable Fastify assertions proving stale-write rejection and identical authoritative versions for web and desktop reads.

## Task Commits

1. **Task 04-17-01: Project and mutate shared account truth with conflicts** — `6033396` (`feat`)

## Files Created/Modified

- `packages/control-plane-application/src/use-cases/project-account.ts` — owner-first atomic projection assembler, contradiction admission, generated component mappings, and shared provenance.
- `packages/control-plane-application/src/use-cases/update-account.ts` — strict profile patch validation and serialized expected-version mutation with typed conflict preservation.
- `packages/control-plane-application/src/use-cases/project-account.test.ts` — daemon-free minimization, contradiction table, owner admission, and concurrent-write proof.
- `apps/api/src/modules/account/routes.ts` — GET/PATCH account endpoints with ETag, If-Match, session-owner resolution, and bounded error responses.
- `apps/api/src/modules/account/account-projection.test.ts` — GREEN replacements for the two Plan 04-32 owner-bound account witnesses.
- `packages/control-plane-application/src/index.ts` — public exports for projection and mutation use cases.

## Decisions Made

- Kept generated `AccountProjectionJson` and generated component projection types as the canonical transport vocabulary while adding only an outer observation provenance for online/offline/stale/pending/conflict client state.
- Performed owner admission before repository access and repeated account ownership checks across every snapshot member so cross-user records cannot be projected accidentally.
- Validated the current and updated aggregate projections before persisting a profile change, preventing contradictory source state from producing a partial write.

## TDD Gate Compliance

- **RED:** `7af8c26` (`test(04-32): collect API and PostgreSQL RED witnesses`) committed both stable `EXPECTED_RED[04-17-01]` account cases before production implementation.
- **GREEN:** `6033396` (`feat(04-17): project versioned account truth`) replaced both sentinels with real route assertions; 2/2 API cases and 6/6 application cases pass.
- **REFACTOR:** No separate refactor commit was needed; provenance normalization, strict patch admission, returned-ETag handling, and pre-save contradiction validation were completed before the GREEN commit.

## Verification Results

- `pnpm --filter @liiiraa/api test -- --run account-projection`: **PASS** — 2/2 inherited account API witnesses are GREEN.
- `pnpm exec vitest --run packages/control-plane-application/src/use-cases/project-account.test.ts`: **PASS** — 6/6 owner, minimization, contradiction, and concurrency cases pass.
- API and control-plane application TypeScript checks: **PASS**.
- Focused ESLint on all six plan files: **PASS** with zero warnings.
- `pnpm test:architecture`: **PASS** — 46/46 architecture checks pass.
- Prettier and `git diff --check`: **PASS**.
- Verification remained daemon-free; Docker, Docker Desktop, and Testcontainers were not started or probed.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] Removed an unowned transitive test import**
- **Found during:** Task 04-17-01 GREEN verification
- **Issue:** The API witness imported `@liiiraa/control-plane-domain` directly even though the API package does not own that dependency, causing collection and TypeScript resolution failure.
- **Fix:** Constructed the minimal typed free-subscription snapshot through the application contract already owned by the API.
- **Files modified:** `apps/api/src/modules/account/account-projection.test.ts`
- **Verification:** Focused API tests and API TypeScript check pass.
- **Committed in:** `6033396`

**2. [Rule 1 - Bug] Accepted returned ETags for hyphenated account identifiers**
- **Found during:** Task 04-17-01 route hardening
- **Issue:** The initial If-Match parser could not round-trip ETags when account identifiers contained hyphens.
- **Fix:** Parsed the terminal version suffix from the complete bounded account ETag and added an executable returned-ETag request path.
- **Files modified:** `apps/api/src/modules/account/routes.ts`, `apps/api/src/modules/account/account-projection.test.ts`
- **Verification:** The stale-write witness reuses the exact ETag returned by GET and receives the expected 409 remote projection.
- **Committed in:** `6033396`

**3. [Rule 2 - Missing Critical] Validate projection consistency before persistence**
- **Found during:** Task 04-17-01 mutation review
- **Issue:** Assembling only after `saveAccount` could allow a pre-existing contradictory snapshot to mutate before returning an error.
- **Fix:** Assemble and admit the current snapshot before version arbitration, assemble the updated snapshot before saving, and reject unknown profile patch fields.
- **Files modified:** `packages/control-plane-application/src/use-cases/update-account.ts`
- **Verification:** Application contradiction/concurrency tests, TypeScript, and focused ESLint pass.
- **Committed in:** `6033396`

---

**Total deviations:** 3 auto-fixed (1 blocking test boundary, 1 ETag correctness bug, 1 critical pre-save validation gap).
**Impact on plan:** All fixes strengthen the planned owner/version boundary without expanding scope or changing architecture.

## Known Stubs

None. Both inherited `EXPECTED_RED[04-17-01]` sentinels were replaced with live production-route assertions.

## Issues Encountered

- The repository-wide `pnpm lint` command reports 235 pre-existing errors across unrelated Phase 3/web/admin/desktop/tooling files. The six files owned by this plan pass focused ESLint with zero warnings; unrelated failures were not modified.

## User Setup Required

None - all account projection and concurrency verification is deterministic and daemon-free.

## Next Phase Readiness

- Web and desktop consumers can read one generated, versioned shared projection and surface explicit online/offline/stale/pending/conflict states.
- Downstream plans can compose this boundary with native credential revocation and lifecycle synchronization without uploading local-only diagnostics, history, or restoration data.

## Self-Check: PASSED

- All five declared implementation/test artifacts exist on disk; the application public export was updated.
- Inherited RED commit `7af8c26` and GREEN task commit `6033396` exist in repository history.
- All plan-owned tests, types, formatting, lint, and architecture checks pass.
- Protected user-owned untracked paths `.impeccable/` and `apps/desktop/src-tauri/gen/` remain untouched and unstaged.
