---
status: fixing
trigger: "Premium current-PC preview succeeds, but binding ends with 'O vínculo não foi confirmado'."
created: 2026-08-09T16:32:39.1907248Z
updated: 2026-08-09T17:00:00.0000000Z
---

# Debug Session: Device Bind Not Confirmed

## Symptoms

- expected: After native preview and both explicit confirmations, binding succeeds once, persists in PostgreSQL, and the desktop shows the active PC.
- actual: Windows preview succeeds with a sanitized physical-PC label and three protected evidence classes, but the bind action ends in the generic unconfirmed warning.
- errors: "O vínculo não foi confirmado. Nenhum sucesso local foi presumido. Atualize a conta ou use o portal protegido antes de tentar novamente."
- timeline: First owner test of the replacement Phase 04-66 installer against the newly promoted staging API.
- reproduction: Sign in with the Premium owner account, open Account > Device, verify the current PC, check both confirmations, and select Bind this PC.

## Current Focus

- hypothesis: Confirmed — the real `/v1/account` composition hardcodes `activeDevice: null` even after the device authority commits the PostgreSQL binding.
- test: A RED real-auth projection test injects a valid active device resolver and requires the account response to include it.
- expecting: Wiring the resolver into every account projection path makes the regression pass and allows the renderer's existing pessimistic confirmation to succeed.
- next_action: Ask the owner to refresh the device projection and confirm that the previously committed binding now appears as active.
- reasoning_checkpoint: Native Windows collection, sanitized preview, Premium gating, and both confirmation controls have already passed on the real PC.
- tdd_checkpoint: RED test required before implementation because workflow.tdd_mode is true.

## Evidence

- timestamp: 2026-08-09T16:32:39.1907248Z
  observation: The real installer reports a physical Windows PC, three protected evidence classes, and readiness before mutation.
  implication: Inventory collection and the renderer privacy boundary are not the failing stage.
- timestamp: 2026-08-09T16:32:39.1907248Z
  observation: The warning is the renderer's fail-closed confirmation message rather than a raw API or native error.
  implication: The exact authority outcome must be recovered from code/tests without logging secrets or hardware evidence.
- timestamp: 2026-08-09T16:37:00.0000000Z
  observation: The RED real-auth test received `activeDevice: null` despite an injected valid active-device projection; 7 sibling tests passed.
  implication: The account projection hardcode is the exact post-commit confirmation failure.
- timestamp: 2026-08-09T16:39:00.0000000Z
  observation: Real-auth, device concurrency, and runtime control-plane tests passed 22/22; the full API suite passed 236/236; TypeScript and focused ESLint passed.
  implication: The persistent resolver is integrated without regressing identity, device, or staging authority behavior.
- timestamp: 2026-08-09T17:00:00.0000000Z
  observation: GitHub staging promotion 31324354207 completed successfully and hosted `/ready` reports build `61d8db9f8e4e1d090d75c67e918f53228bec03de`, `authorityConnected: true`, and `device-authority`.
  implication: The corrected account projection is active in staging; only owner-visible persistence confirmation remains.

## Eliminated

- hypothesis: The account is Free and therefore cannot bind.
  evidence: Screenshot shows Premium and the Premium-only verification flow is available.
- hypothesis: Windows evidence collection is unsupported on this PC.
  evidence: Preview is ready and reports three protected evidence classes.

## Resolution

- root_cause: The real account route hardcoded `activeDevice: null`, so post-bind synchronization could never confirm the device mutation even when PostgreSQL committed it.
- fix: Resolve the newest non-revoked device authority projection once in staging and inject it into every real account projection path and `/v1/devices/current`.
- verification: Local automated gates and hosted promotion pass; owner-visible persistence retest pending.
- files_changed: apps/api/src/modules/identity/real-routes.ts, apps/api/src/staging/runtime.ts, apps/api/src/staging/real-auth.test.ts
