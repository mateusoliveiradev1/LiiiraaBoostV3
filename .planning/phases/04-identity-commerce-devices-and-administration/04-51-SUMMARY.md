---
phase: 04-identity-commerce-devices-and-administration
plan: '51'
subsystem: api-worker
tags: [admin, invitations, identity, worker, idempotency, privacy, tdd]
requires:
  - phase: 04-41
    provides: Real invitation domain and transactional application authority
  - phase: 04-46
    provides: Production identity and account boundary patterns
provides:
  - Authorized masked invitation management HTTP lifecycle
  - Generic resumable recipient validation, possession, decline, and atomic activation boundaries
  - Durable delivery, reminder, promotion, retention, and partial-batch worker contracts
affects: [04-53, 04-54, 04-57, admin-invitations, identity-acceptance, workers]
tech-stack:
  added: []
  patterns:
    [
      server-owned-version,
      opaque-resume-state,
      persisted-effect-identity,
      provider-neutral-delivery,
    ]
key-files:
  created:
    - apps/api/src/modules/admin/invitation-routes.ts
    - apps/api/src/modules/admin/invitation-routes.test.ts
    - apps/api/src/modules/identity/invitation-acceptance-routes.ts
    - apps/api/src/modules/identity/invitation-acceptance-routes.test.ts
    - apps/api/src/worker/admin-invitation-jobs.ts
    - apps/api/src/worker/admin-invitation-jobs.test.ts
key-decisions:
  - 'Authorize exact origin, CSRF, active function, capability, and invitation scope before any recipient query or mutation.'
  - 'Resume recipient work only through opaque server-persisted state and use its version instead of browser-supplied authority.'
  - 'Use persisted job and item identities so crash recovery reconstructs completed effects and final batch receipts without repeating delivery or lifecycle actions.'
patterns-established:
  - 'Public invitation projections contain masked identity and bounded provider-neutral state only.'
  - 'Promotion persists the versioned domain transition and delivery enqueue as one repository effect.'
requirements-completed: [WEB-06, IDEN-01]
duration: 16 min
completed: 2026-08-07
status: complete
---

# Phase 04 Plan 51: Invitation HTTP and Worker Summary

**Real private-beta invitation management and recipient acceptance with privacy-preserving HTTP boundaries and replay-safe long-running work**

## Performance

- **Duration:** 16 min
- **Started:** 2026-08-07T00:47:00-03:00
- **Completed:** 2026-08-07T01:03:00-03:00
- **Tasks:** 2
- **Files modified:** 6

## Accomplishments

- Exposed authorized list, detail, timeline, preflight, issue, resend, revoke, and governed batch endpoints with exact origin, HMAC CSRF, capability/scope checks, rate bounds, generated command validation, expected versions, and idempotency.
- Bounded preflight to 100 rows and 128 KiB, accepted JSON or CSV, and returned classifications without recipient email, recipient digest, secret, or provider data.
- Added generic recipient validation, opaque resumable progress, trusted email-possession verification, explicit decline, completed account activation, and atomic single-use invitation consumption.
- Added a bounded worker claim contract with row locking, retries, provider-neutral delivery states, at most two domain-governed reminders, terminal stop conditions, stable capacity promotion, retention/pseudonymization, and durable batch item/final receipt recovery.
- Proved crash recovery after delivery and after partial batches without duplicate delivery, lifecycle event, item action, or final receipt.

## Task Commits

1. **Task 04-51-01: Build invitation management and acceptance routes**
   - `3b79416` — RED invitation HTTP lifecycle contracts
   - `e44955a` — GREEN real management and acceptance routes
   - `4fa85e5` — RED recipient decline contract
   - `4f46079` — GREEN resumable recipient decline
2. **Task 04-51-02: Execute durable invitation work**
   - `ab91744` — RED durable worker contracts
   - `fa7a637` — GREEN delivery, reminder, promotion, retention, and batch worker

## Files Created

- `apps/api/src/modules/admin/invitation-routes.ts` — Masked and governed management endpoints.
- `apps/api/src/modules/admin/invitation-routes.test.ts` — Authorization, privacy, validation, CSV, mutation, and batch contracts.
- `apps/api/src/modules/identity/invitation-acceptance-routes.ts` — Generic resumable validation, possession, decline, and activation endpoints.
- `apps/api/src/modules/identity/invitation-acceptance-routes.test.ts` — Anti-enumeration, server-owned state, possession, decline, and atomic acceptance contracts.
- `apps/api/src/worker/admin-invitation-jobs.ts` — Bounded durable invitation worker and repository/port contracts.
- `apps/api/src/worker/admin-invitation-jobs.test.ts` — Crash, replay, reminder, promotion, partial batch, and retention proofs.

## Decisions Made

- The route session keeps `activeFunction` as runtime data and validates it equals `operations`; a compile-time literal is not accepted as a substitute for the security check.
- Recipient activation and decline always use the version persisted with opaque progress. Browser `expectedVersion`, possession booleans, actor identity, account references, and completion claims are ignored.
- Delivery jobs contain only opaque delivery references, locale, campaign reference, version, and job identity. They contain no plaintext secret, full email, tracking pixel, fingerprint, or provider policy.
- Batch replay reloads previously persisted item results before finalization, preserving both successful and failed subsets across a crash.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 2 - Missing Critical] Preserved a real runtime active-function authorization check**

- **Found during:** Task 04-51-01 lint/type verification
- **Issue:** Typing the session function as the literal `operations` made the runtime comparison statically meaningless.
- **Fix:** Treat the resolved value as runtime data and reject anything other than the exact operations function before accessing invitation scope.
- **Verification:** Route authorization tests, API typecheck, and lint pass.
- **Committed in:** `e44955a`

**2. [Rule 1 - Bug] Reconstructed partial batch receipts after crash**

- **Found during:** Task 04-51-02 GREEN review
- **Issue:** Skipping already completed item identities prevented duplicate actions, but a replayed final receipt could omit results persisted before the crash.
- **Fix:** Reload persisted batch results first, execute only missing items, and finalize one idempotent receipt over the complete subset.
- **Verification:** The batch test crashes after effects, replays, retains completed/failed results, and emits one receipt.
- **Committed in:** `fa7a637`

**3. [Rule 2 - Missing Critical] Added recipient decline before plan closure**

- **Found during:** Final must-have audit
- **Issue:** The written plan explicitly required a decline boundary, while the initial GREEN exposed validation, progress, possession, and activation only.
- **Fix:** Added CSRF/origin-protected decline from validated opaque progress using the server-owned version and generic denial semantics.
- **Verification:** Dedicated RED/GREEN contract plus full API suite pass.
- **Committed in:** `4f46079`

---

**Total deviations:** 3 auto-fixed (1 authorization hardening, 1 replay correctness bug, 1 missing required lifecycle action). **Impact on plan:** All fixes were necessary to meet the stated security and durability contract; no product scope expansion.

## Issues Encountered

- None requiring user setup. No Docker or staging database was used.

## User Setup Required

None.

## Next Phase Readiness

- Plans 04-53/54/57 can compose the production repositories and generated clients, then consume the invitation workspace without rebuilding lifecycle authority in the UI.
- The three-email technical provisioner remains bootstrap-only; the product lifecycle now has real API and worker boundaries.

## Self-Check: PASSED

- Focused plan suites: 15/15.
- Full API: 196/196.
- API typecheck and changed-file lint: passed.
- Architecture: 46/46.
- Contract generation: 12 artifacts without drift.
- Rust workspace: 85/85.

---

_Phase: 04-identity-commerce-devices-and-administration_
_Completed: 2026-08-07_
