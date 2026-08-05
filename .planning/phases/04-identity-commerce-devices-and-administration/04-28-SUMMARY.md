---
phase: 04-identity-commerce-devices-and-administration
plan: "28"
subsystem: email-notifications
tags: [sesv2, outbox, idempotency, redaction, localization, tdd]

requires:
  - phase: 04-04
    provides: PostgreSQL outbox schema and bounded SKIP LOCKED claim pattern
  - phase: 04-12
    provides: Recovery hold, trusted-session notice, and contest producers
  - phase: 04-13
    provides: Reconciled commerce lifecycle and notification producers
  - phase: 04-15
    provides: Authoritative support-case lifecycle and notification producers
provides:
  - Closed provider-neutral EmailPort and ten bounded notification classes
  - Localized PT-BR and English templates with shared sensitive-content admission
  - SESv2 sandbox adapter restricted to verified invited recipients
  - Idempotent SKIP LOCKED worker with durable delivery, retry, and terminal-failure evidence
affects: [04-35, staging-email, recovery, commerce, invitations, support]

tech-stack:
  added: []
  patterns:
    - Outbox job ID reused as the provider-visible idempotency identity
    - Closed topic-to-notification admission before provider delivery
    - Notification-only templates carrying bounded authoritative references

key-files:
  created:
    - packages/control-plane-application/src/ports/email.ts
    - packages/control-plane-adapters/src/email/ses-email.ts
    - apps/api/src/workers/email-notifications.ts
    - apps/api/src/workers/email-templates.ts
    - apps/api/src/workers/email-notifications.test.ts
  modified:
    - packages/control-plane-application/src/index.ts
    - packages/control-plane-adapters/src/index.ts

key-decisions:
  - "Use the outbox job ID as both the worker idempotency key and SES message tag; completed jobs are never reclaimed."
  - "Admit SES sandbox recipients only from an injected verified-invitation allowlist and expose only provider-neutral failure codes."
  - "Carry bounded references in email while PostgreSQL recovery, commerce, invitation, support, and audit records remain authoritative."

patterns-established:
  - "Email boundary admission: topic/class, locale, recipient, exact value keys, length, and sensitive-content checks all fail closed before SES."
  - "Bounded retry evidence: exponential delay caps at sixty seconds and the configured final attempt becomes a visible terminal failure."

requirements-completed: [WEB-04, IDEN-02, IDEN-09]

duration: 12min
completed: 2026-08-05
status: complete
---

# Phase 04 Plan 28: Idempotent SES Sandbox Notifications Summary

**Ten recovery, commerce, invitation, and support notice classes now flow through localized redacted templates into a verified-recipient SES sandbox adapter with idempotent bounded outbox retries.**

## Performance

- **Duration:** 12 min
- **Started:** 2026-08-05T05:30:28Z
- **Completed:** 2026-08-05T05:42:31Z
- **Tasks:** 1 TDD task
- **Files modified:** 7

## Accomplishments

- Added a closed application port for recovery hold/contest, grace/retry, Pix renewal, price change, refund/dispute, invitation, and support case notifications.
- Added exhaustive PT-BR and English templates whose exact value allowlists, size bounds, and shared sensitive-content checks reject unknown, missing, extra, or secret-bearing input.
- Added a narrow SESv2 sandbox adapter that sends only to injected verified invited recipients, tags delivery with the outbox job identity, and redacts provider failures to stable codes.
- Added a bounded `FOR UPDATE SKIP LOCKED` worker contract that records provider receipts, schedules capped exponential retries, and preserves terminal failure evidence without mutating domain authority.
- Proved replay suppression, topic/class admission, all required delivery paths, and notification-only authority references through seventeen daemon-free tests.

## TDD Gates

- **RED:** `5e12b0b` — the focused owner suite failed because the notification worker and templates did not exist.
- **GREEN:** `b073bc9` — the email port, localized templates, SES adapter, worker, and public exports made all seventeen witnesses pass.
- **REFACTOR:** `22a0b4b` — one shared admission predicate now protects both template rendering and direct SES adapter calls while the focused suite remains green.

## Task Commits

1. **RED — notification delivery witnesses** — `5e12b0b` (test)
2. **GREEN — idempotent sandbox notification delivery** — `b073bc9` (feat)
3. **REFACTOR — shared email content admission** — `22a0b4b` (refactor)

## Files Created/Modified

- `packages/control-plane-application/src/ports/email.ts` — closed notification classes, provider-neutral delivery result, and shared content admission.
- `packages/control-plane-adapters/src/email/ses-email.ts` — exact SESv2 `SendEmailCommand` adapter with verified-recipient and redacted-failure enforcement.
- `apps/api/src/workers/email-notifications.ts` — exhaustive producer-topic mapping, bounded SKIP LOCKED claim, idempotent send, retry, and terminal evidence flow.
- `apps/api/src/workers/email-templates.ts` — bounded localized template registry with exact per-class value admission.
- `apps/api/src/workers/email-notifications.test.ts` — seventeen template, replay, retry, failure, mapping, sandbox, and redaction witnesses.
- Application and adapter public roots — export the new contracts and SES composition without private deep imports.

## Decisions Made

- A notification job carries one admitted class, and its durable outbox ID is the singular provider/idempotency identity.
- The SES adapter accepts only the exact normalized recipients injected from verified invitation authority; request payloads cannot self-assert admission.
- Email content links to bounded recovery, subscription, commerce, invitation, or support references and explicitly directs the recipient back to the authoritative account record.
- Provider exceptions, request identifiers, and response payloads never enter retry/failure evidence; only stable codes and the bounded successful receipt ID cross the port.

## Verification

- `rtk pnpm --filter @liiiraa/api test -- --run email-notifications`: **PASS** — 17/17 required-class, localization, replay, retry, terminal, admission, SES, and redaction cases.
- `rtk pnpm test:architecture`: **PASS** — both live adapters and 46/46 architecture tests.
- Targeted type-aware ESLint over all seven changed source/test files: **PASS**.
- Targeted Prettier check over all seven changed source/test files: **PASS**.
- `rtk pnpm supply-chain:check`: **PASS** — 72 exact pins, including the approved `@aws-sdk/client-sesv2@3.1102.0` identity.
- Stub and tracked-deletion scans: **PASS** — no blocking stubs and no tracked deletions.
- Package-level `tsc`: **DEFERRED (pre-existing)** — existing `node:crypto` and `Buffer` imports lack an installed Node ambient type library; no Plan 04-28 file appears in the diagnostics.

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered

- Context7 MCP was unavailable and the documented `ctx7` CLI fallback was not installed. The exact installed `@aws-sdk/client-sesv2@3.1102.0` declarations and `SendEmailCommand` example were used as the version-specific API authority.
- Package-level TypeScript compilation is blocked by the pre-existing Node ambient type gap described in `deferred-items.md`; the focused executable, type-aware lint, formatting, architecture, and supply-chain gates pass.

## Known Stubs

None.

## Threat Flags

None. The SES recipient boundary is the plan-declared `T-04-28-I` surface and is mitigated by closed templates, verified-recipient admission, shared redaction, idempotency, and durable bounded evidence.

## Authentication Gates

None.

## User Setup Required

None for daemon-free verification. Staging composition must inject the verified invited-recipient set and SES transport credentials through its existing secret/configuration boundary.

## Next Phase Readiness

- Plan 04-35 can compose the worker with staging scheduling and operational checks.
- Recovery, commerce, invitation, and support producers now have one exhaustive provider-neutral email boundary.
- No blocker remains for this plan.

## Self-Check: PASSED

- All five created artifacts and both modified public roots exist.
- RED, GREEN, and REFACTOR commits exist in order.
- Focused, architecture, lint, formatting, supply-chain, stub, and deletion gates passed.
- `.impeccable/` and `apps/desktop/src-tauri/gen/` remain unmodified and unstaged.

---
*Phase: 04-identity-commerce-devices-and-administration*
*Completed: 2026-08-05*
