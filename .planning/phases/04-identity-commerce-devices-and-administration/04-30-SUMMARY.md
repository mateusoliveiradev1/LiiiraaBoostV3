---
phase: 04-identity-commerce-devices-and-administration
plan: '30'
subsystem: audit-security
tags: [audit, immutable-storage, s3-object-lock, scheduling, health, tdd]
requires:
  - phase: 04-04
    provides: Append-only audit events, serialized chain heads, outbox jobs, and object metadata schema
  - phase: 04-10
    provides: AuditAnchorPort, S3 Object Lock adapter, chain verification, custody policy, and retention ADR
provides:
  - Durable 15-minute or 1,000-event audit-head claiming with SKIP-LOCKED semantics
  - Idempotent immutable anchor writes with exact object-version and five-year receipt persistence
  - Daily latest-anchor verification and monthly complete-segment continuity drills
  - Bounded retry, terminal failure evidence, fail-visible health, and separate-role composition proof
affects: [04-16, 04-29, audit-operations, security-monitoring, production-composition]
tech-stack:
  added: []
  patterns:
    - Durable due-work claims with deterministic immutable object identity and ambiguous-write recovery
    - Health becomes true only after storage read-back, checksum, signature, retention, receipt, and database continuity proof
key-files:
  created:
    - packages/control-plane-application/src/use-cases/anchor-audit-chain.ts
    - apps/api/src/workers/audit-anchors.ts
    - apps/api/src/workers/audit-anchors.test.ts
    - apps/api/src/modules/audit/anchor-health.test.ts
  modified:
    - packages/control-plane-application/src/ports/audit.ts
    - packages/control-plane-application/src/index.ts
    - packages/control-plane-adapters/src/storage/audit-anchor.ts
    - apps/api/src/modules/admin/audit-privileges.test.ts
key-decisions:
  - 'Persist the provider-assigned object version in the database receipt, outside the signed immutable object body, and pin that version on every verification read.'
  - 'Recover ambiguous duplicate writes by reading the deterministic immutable object key and accepting it only after the complete verification contract passes.'
  - 'Keep API composition limited to AuditAnchorPort and the schedule repository; signing, storage, deletion, retention administration, and health override remain unavailable.'
patterns-established:
  - 'Anchor completion order: durable claim -> deterministic checkpoint -> immutable write/read proof -> exact receipt persistence -> healthy projection.'
  - 'Verification order: version-pinned object read -> receipt equality -> database head continuity -> optional complete-segment chain drill -> health projection.'
requirements-completed: [WEB-06, WEB-07, IDEN-03]
duration: 11 min
completed: 2026-08-05
status: complete
---

# Phase 04 Plan 30: Durable Audit Anchor Scheduling and Health Summary

**Durably claimed audit heads now reach version-pinned S3 Object Lock evidence every 15 minutes or 1,000 events, with bounded retries and daily/monthly verification that cannot be forged healthy by ordinary API authority**

## Performance

- **Duration:** 11 min
- **Started:** 2026-08-05T04:11:19Z
- **Completed:** 2026-08-05T04:22:06Z
- **Tasks:** 1
- **Files modified:** 9

## Accomplishments

- Added an executable durable worker contract that claims due audit heads in bounded batches with `FOR UPDATE SKIP LOCKED` semantics and invokes the existing immutable anchor adapter at either cadence threshold.
- Persisted exact stream, segment, sequence, hash, checksum, retention, signing-key, object-key, and provider-assigned object-version receipts only after complete read-back verification.
- Made ambiguous duplicate writes idempotent by reading the deterministic immutable key, while checksum, retention, KMS/signature, read, and write failures remain retryable and visibly unhealthy up to a bounded terminal attempt.
- Added daily newest-anchor verification and monthly full-segment database continuity drills, with provider-neutral stable failure evidence.
- Proved ordinary API composition cannot sign, delete, shorten retention, reuse storage/signing roles, or promote an unverified adapter response to healthy.

## Task Commits

Each TDD gate was committed atomically:

1. **RED: Durable scheduler, immutable receipt, verification, retry, and custody witnesses** - `ae6afba` (test)
2. **GREEN: Due-head anchoring and continuous verification implementation** - `14dfebd` (feat)

No separate REFACTOR commit was necessary; receipt matching and verification-code handling were shared during GREEN and all gates remained passing.

## Files Created/Modified

- `packages/control-plane-application/src/use-cases/anchor-audit-chain.ts` - Due-head orchestration, receipt validation/persistence, idempotent recovery, daily verification, and monthly continuity drill.
- `apps/api/src/workers/audit-anchors.ts` - Durable claim SQL, bounded worker entrypoints, cadence constants, and custody composition assertion.
- `apps/api/src/workers/audit-anchors.test.ts` - Threshold, duplicate claim, retry/terminal, idempotency, receipt, daily, monthly, and custody witnesses.
- `apps/api/src/workers/audit-anchor-worker.test.ts` - Compatibility entrypoint for the plan's exact focused verification filter.
- `apps/api/src/modules/audit/anchor-health.test.ts` - Forged-health denial and ordinary-authority exclusion witnesses.
- `packages/control-plane-application/src/ports/audit.ts` - Exact immutable object-version receipt and version-pinned read contract.
- `packages/control-plane-application/src/index.ts` - Public application export for the Plan 30 use cases and repository contracts.
- `packages/control-plane-adapters/src/storage/audit-anchor.ts` - S3 `VersionId` capture, validation, exact-version read-back, and verified result propagation.
- `apps/api/src/modules/admin/audit-privileges.test.ts` - Versioned immutable-storage fixture and receipt assertion.

## Decisions Made

- S3 assigns `VersionId` only after the immutable body is written, so the exact version belongs in the separately persisted verified receipt rather than inside the signed body.
- A write failure can be ambiguous after storage accepted the object. The worker reads the deterministic key and converges only when the full port verification succeeds; it never overwrites the object.
- Health is an output of verified storage and database continuity. Neither request input nor an ordinary adapter-shaped response with `verified: false` can create healthy state.
- Daily work verifies each latest receipt against current database head state; monthly work additionally replays the complete selected segment through the canonical audit-chain verifier.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 2 - Missing Critical] Added exact immutable object-version receipts**

- **Found during:** Task 04-30-01 GREEN implementation
- **Issue:** The existing 04-10 `AuditAnchorPort` returned a verified anchor but not the provider-assigned S3 object version required by Plan 30's immutable receipt.
- **Fix:** Extended successful port results with `objectVersion`, captured `VersionId` on put/get, pinned write read-back to that version, and rejected missing or mismatched versions.
- **Files modified:** `packages/control-plane-application/src/ports/audit.ts`, `packages/control-plane-adapters/src/storage/audit-anchor.ts`, `apps/api/src/modules/admin/audit-privileges.test.ts`
- **Verification:** Adapter suite passes 25 tests with four policy-skipped live probes; API immutable-anchor tests assert exact version equality.
- **Committed in:** `14dfebd`

**2. [Rule 2 - Missing Critical] Added the application package export**

- **Found during:** Task 04-30-01 GREEN composition
- **Issue:** The API worker could not consume the new use cases through the package's approved public root without a narrow export.
- **Fix:** Exported the Plan 30 use-case module from `packages/control-plane-application/src/index.ts`.
- **Files modified:** `packages/control-plane-application/src/index.ts`
- **Verification:** API TypeScript project check and focused runtime tests resolve the public package import.
- **Committed in:** `14dfebd`

**3. [Rule 3 - Blocking] Preserved the plan's exact verification command**

- **Found during:** Task 04-30-01 final verification
- **Issue:** The plan declares `audit-anchors.test.ts` but its automated command filters for `audit-anchor-worker`, which Vitest matches against file paths.
- **Fix:** Added a two-line compatibility test entrypoint that imports the declared witness suite without duplicating behavior.
- **Files modified:** `apps/api/src/workers/audit-anchor-worker.test.ts`
- **Verification:** `pnpm --filter @liiiraa/api test -- --run audit-anchor-worker` passes one file and ten tests.
- **Committed in:** `14dfebd`

---

**Total deviations:** 3 auto-fixed (2 missing critical, 1 blocking).
**Impact on plan:** Each change is a narrow correctness or execution seam; no daemon, new provider, schema table, endpoint, or unrelated feature was added.

## Issues Encountered

- Context7 was unavailable in this runtime, so the installed `@aws-sdk/client-s3` 3.1102.0 type declarations were inspected directly to confirm `VersionId` on `PutObject` and `GetObject` outputs.
- The complete API replay passes 90/96 tests; six remaining failures are explicit `EXPECTED_RED` witnesses owned by Plans 04-16 and 04-17.
- The complete control-plane-domain replay passes 49/53 tests; four remaining failures are explicit `EXPECTED_RED` witnesses owned by Plan 04-21.
- These out-of-scope witnesses are recorded in `deferred-items.md` and were not changed.

## Verification

- `pnpm --filter @liiiraa/api test -- --run audit-anchor-worker` - PASS (1 file, 10 tests).
- `pnpm --filter @liiiraa/api test -- --run audit` - PASS (3 files, 14 tests before compatibility entrypoint; all audit tests remain green).
- `pnpm --filter @liiiraa/control-plane-domain exec vitest --run audit` - PASS (1 file, 8 tests).
- `pnpm --filter @liiiraa/control-plane-adapters exec vitest --run migrations` - PASS in daemon-free mode (4 passed, 3 live-PostgreSQL probes skipped by policy).
- Full control-plane-adapters replay - PASS (25 passed, 4 live-policy probes skipped).
- API TypeScript project check - PASS.
- Changed-file ESLint and Prettier checks - PASS.
- No Docker, Testcontainers, live PostgreSQL, or AWS calls were used.

## TDD Gate Compliance

- **RED:** `ae6afba` collected both planned suites and failed because `apps/api/src/workers/audit-anchors.ts` did not exist.
- **GREEN:** `14dfebd` made cadence, claiming, retry/idempotency, immutable receipt, daily/monthly verification, health, and custody witnesses pass.
- **REFACTOR:** No additional cleanup commit was required; shared receipt and continuity verification helpers were already established in GREEN.

## Known Stubs

None. Empty arrays and nullable values found by the scan are deterministic test repository state or defensive adapter checks, not production data stubs.

## Threat Flags

None. The worker implements the plan-declared database-to-immutable-storage trust boundary and adds no network endpoint, authentication path, schema change, or new file-access surface.

## User Setup Required

None - execution and verification use injected deterministic repositories/adapters. Production roles and storage remain later deployment composition concerns.

## Next Phase Readiness

- Plan 04-29 can reuse the bounded claim/retry/terminal-health pattern for retention and deletion workers.
- Administrative health surfaces can consume repository-projected status without receiving signing, storage, retention, deletion, or health-override authority.
- Production composition must supply distinct API, audit-storage, and audit-signing roles and schedule daily/monthly invocations; the code fails closed when role identities are not separate.

## Self-Check: PASSED

- All four plan-declared artifacts and this summary exist on disk.
- RED commit `ae6afba` and GREEN commit `14dfebd` exist in git history.
- Focused scheduler, health, immutable privilege, adapter, audit-chain, TypeScript, lint, and formatting gates pass.

---

_Phase: 04-identity-commerce-devices-and-administration_
_Completed: 2026-08-05_
