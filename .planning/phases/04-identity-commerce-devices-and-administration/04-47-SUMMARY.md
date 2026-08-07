---
phase: 04-identity-commerce-devices-and-administration
plan: '47'
subsystem: application
tags: [admin, governance, approvals, step-up, offboarding, delegation, tdd]
requires:
  - phase: 04-43
    provides: Deterministic administrative governance and segregation-of-duties policy
  - phase: 04-45
    provides: Transactional invitation authority and administrative-team invitation separation
provides:
  - Transactional membership activation, function switching, permission impact/change, delegation, approval, offboarding, review, simulation, and audit reveal use cases
  - Narrow authorization, scoped step-up, governance repository, audit, outbox, and receipt ports
  - Atomic authority removal and urgent-work reassignment with durable replay
affects: [04-48, 04-52, admin-governance, approvals, isolated-admin]
tech-stack:
  added: []
  patterns: [authorization-before-load, action-bound step-up, repository-authoritative approval evidence]
key-files:
  created:
    - packages/control-plane-application/src/ports/admin-governance.ts
    - packages/control-plane-application/src/use-cases/manage-admin-access.ts
  modified:
    - packages/control-plane-application/src/use-cases/manage-admin-access.test.ts
    - packages/control-plane-application/src/index.ts
    - packages/control-plane-application/package.json
key-decisions:
  - 'Treat client-supplied approval IDs only as references; eligibility comes from repository-loaded approved, unexpired, independent records with exact capability and scope.'
  - 'Validate administrative step-up against actor, authorization context, action, resource, redacted target, cryptographic verifier, expiry, and five-minute freshness before protected repository access.'
  - 'Commit membership suspension/offboarding, session and delegation revocation, future-approval removal, urgent-work reassignment, audit, outbox, receipt, and replay result in one transaction.'
patterns-established:
  - 'Permission mutation recomputes the before/after impact from locked authority and rejects a stale or client-computed projection.'
  - 'Simulation uses the read projection port only and returns canAuthorizeAction=false without exposing a mutation transaction.'
requirements-completed: [WEB-06, IDEN-03]
duration: 11 min
completed: 2026-08-06
status: complete
---

# Phase 04 Plan 47: Transactional Admin Governance Summary

**Governed administrative access with repository-authoritative approvals, five-minute action-bound step-up, atomic offboarding, immutable impact previews, and projection-only simulation**

## Performance

- **Duration:** 11 min
- **Started:** 2026-08-06T23:37:08-03:00
- **Completed:** 2026-08-06T23:48:08-03:00
- **Tasks:** 1
- **Files modified:** 5

## Accomplishments

- Implemented separate administrative invitation activation with verified identity, passkey/MFA, no shared credentials, and authorization before repository access.
- Added permission impact previews and mutations that recompute before/after authority, invalidate sessions/approvals, and require exact fresh step-up plus independent approval for critical, irreversible, or mass changes.
- Added function switching, delegation creation/expiry, bounded approval request/approve/cancel/reassign flows, periodic access review, and reason-gated masked audit reveal.
- Made offboarding/compromise atomically revoke membership authority, sessions, delegations, and future approvals while redistributing urgent work and preserving audit evidence.
- Proved simulation is read-only and carries no command authority.

## Task Commits

1. **Task 04-47-01: Orchestrate access governance and approval commands**
   - `7b5924a` — RED governed-access use-case suite
   - `5cd9c55` — GREEN transactional admin governance

## Files Created/Modified

- `packages/control-plane-application/src/ports/admin-governance.ts` — Governance authorization, step-up, repository, transaction, state, impact, approval, review, receipt, and evidence contracts.
- `packages/control-plane-application/src/use-cases/manage-admin-access.ts` — Membership, permissions, function, delegation, approval, offboarding, review, simulation, and reveal application authority.
- `packages/control-plane-application/src/use-cases/manage-admin-access.test.ts` — Authorization ordering, impact immutability, step-up binding, approval independence/expiry/reassignment, rollback, expiry, simulation, and reveal witnesses.
- `packages/control-plane-application/src/index.ts` and `package.json` — Public governance exports.

## Decisions Made

- Approval booleans and caller-computed eligibility are never authority; mutations reload the referenced approval records within the governance transaction.
- Sensitive and critical commands fail before protected data loading when step-up binding or freshness is invalid.
- The application transaction owns all authority-removal effects, so partial offboarding cannot be represented as success.
- Masked audit projection is the default; a reveal requires the audit/security capability, reason, exact step-up, audit event, and durable receipt.

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered

None.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness

- The governance ports and application authority are ready for Plan 04-48 PostgreSQL persistence and concurrency defenses.
- Plan 04-52 can later expose the same authority through generated, least-privilege API routes without accepting client-computed eligibility.

## Self-Check: PASSED

- All key files exist and both TDD commits are present.
- Focused governance suite: 7/7; application: 20/20; domain: 103/103.
- Architecture: 46/46; Rust: 85/85; Cargo build passed; contracts: 12 artifacts without drift.

---

*Phase: 04-identity-commerce-devices-and-administration*
*Completed: 2026-08-06*
