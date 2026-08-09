---
phase: 04-identity-commerce-devices-and-administration
plan: '66'
subsystem: desktop-device-authority
tags: [desktop, devices, windows, privacy, licensing, tauri, postgres]
requires:
  - phase: 04-06
    provides: One-PC device domain policy and PostgreSQL authority
  - phase: 04-14
    provides: Privacy-preserving device evidence design
  - phase: 04-38
    provides: Real desktop account synchronization
  - phase: 04-65
    provides: Stable one-action desktop session transitions
provides:
  - Truthful Free and Premium device-binding journey
  - Native allowlisted Windows evidence collection without renderer disclosure
  - Server-only evidence protection and canonical binding derivation
  - PostgreSQL-confirmed one-PC binding with conflict and replay safety
affects: [04-40, 04-25, 04-26, private-beta]
tech-stack:
  added: []
  patterns: [native-evidence-custody, server-owned-binding-digest, post-mutation-authoritative-sync]
key-files:
  modified:
    - apps/desktop/src-tauri/src/device_identity.rs
    - apps/desktop/src/account-authority.ts
    - apps/desktop/src/features/account-experience.tsx
    - apps/api/src/modules/devices/routes.ts
    - packages/control-plane-domain/src/devices/device-evidence.ts
key-decisions:
  - 'React receives only a sanitized PC preview and typed outcomes; local digests and raw hardware observations remain native.'
  - 'The API owns wrapping keys and derives the persisted binding digest from validated account-bound evidence.'
  - 'Free accounts never invoke native binding; Premium binding requires both explicit confirmations.'
  - 'The UI reports success only after a fresh PostgreSQL-backed account projection confirms the binding.'
requirements-completed: [WEB-05, IDEN-04, IDEN-05]
duration: 42 min
completed: 2026-08-09
status: complete-owner-uat-passed
---

# Phase 04 Plan 66: Real Current-PC Binding Summary

**The hard-coded beta gate is gone: Free accounts receive honest plan guidance and Premium accounts can privately verify and bind exactly one Windows PC through native custody and PostgreSQL authority.**

## Accomplishments

- Closed the device-evidence contract so the client submits only canonical local component digests
  under an account-bound context while the API keeps every wrapping key server-only.
- Added allowlisted Windows inventory collection and native Tauri prepare/bind commands without
  PowerShell, arbitrary shell execution, Docker, or renderer access to raw observations.
- Replaced “Aguardando beta” with distinct Free, Premium-ready, pending, conflict, cooldown,
  revalidation, offline, and failure states in PT-BR and English.
- Required confirmation that this is the owner's PC and acknowledgment of the one-PC limit before
  mutation becomes available.
- Kept success pessimistic: the renderer shows a linked PC only after direct authoritative account
  synchronization confirms the same active PostgreSQL binding.
- Published and promoted the exact API artifact, then generated a replacement connected NSIS
  installer for owner retest.

## Task Commits

1. `c60b8df` — close the account-bound device-evidence contract.
2. `3fabbc7` — collect and bind privacy-preserving Windows evidence natively.
3. `0845880` — lock the truthful desktop binding journey with tests.
4. `638b0ea` — enable the Free/Premium current-PC binding UI.
5. `4c78334` — satisfy the device API lint boundary.
6. `db99678` — align the canonical visual-token verification witness.
7. `61d8db9` — project the committed active device through the real account authority.

## Verification

- Focused desktop authority and presentation: 32/32 tests passed.
- Full desktop unit suite: 18 files and 152/152 tests passed.
- API device route/concurrency suite: 12/12 tests passed.
- Desktop TypeScript, focused ESLint, Vite production build, Rust device tests, generated contract
  drift, and design-token suite passed.
- Workspace verification passed all executable code, contract, architecture, Rust, desktop,
  Storybook, supply-chain, build, and browser E2E gates (86/86 browser scenarios).
- The aggregate command stops only at its explicit external packaged-driver prerequisite: reviewed
  Windows 10 and Windows 11 images are unavailable on this formatted PC. No code gate failed.
- Production source contains none of the former beta-gate strings.
- React/Tauri renderer source contains no raw serial, machine GUID, protected digest, or local
  digest access. Generated validators retain only the `localDigest` field name required to validate
  the native-to-API contract; no value is rendered or logged.

## Staging and Installer Evidence

| Evidence          | Exact value                                                               | Result |
| ----------------- | ------------------------------------------------------------------------- | ------ |
| Source/API build  | `db996787627c3817ddbef72350eb75f39cb32bac`                                | PASS   |
| GitHub promotion  | `31307797683`                                                             | PASS   |
| API OCI digest    | `sha256:303e33f02d9e9c1a15eaa6fc37ab5041dee82ae0499c4bb3c9806f615c506b3c` | PASS   |
| Render deployment | `dep-d9s577u7bikc738tmon0`                                                | PASS   |
| API readiness     | `authorityConnected=true`, `device-authority`, exact build ID             | PASS   |
| Projection hotfix | `61d8db9f8e4e1d090d75c67e918f53228bec03de`, promotion `31324354207`       | PASS   |
| NSIS installer    | `target/release/bundle/nsis/Liiiraa Boost_0.0.1_x64-setup.exe`            | PASS   |
| Installer SHA-256 | `7be3df5497dadad71399b00c46c736597707a7c9bbb3a753f185baf2bd92ecf4`        | PASS   |

## Safety Boundaries Preserved

- Free entitlement cannot be consumed by device binding.
- Raw Windows observations cannot serialize, log, persist, enter URLs, or cross IPC.
- A client cannot supply a protected digest, wrapping key, account identity, or final device digest.
- Replay remains idempotent and concurrent first binds preserve exactly one active PC.
- A different PC is never silently substituted; conflict and cooldown remain explicit.
- No Docker was installed or used on the owner's PC.

## Owner Checkpoint

Owner UAT passed on the current Windows PC:

1. The replacement package opened the real Premium account.
2. Native preview exposed only the sanitized `DESKTOP-FOV8OLO` label and protected evidence count.
3. Both confirmations enabled the mutation and PostgreSQL accepted the one-PC binding.
4. After the authoritative projection hotfix and refresh, the desktop showed the same device as `Vinculado` in both account projection locations.

This plan does not approve the wider `04-40` real-authority UAT and does not create
`04-40-SUMMARY.md`.

## Self-Check: PASSED — OWNER UAT PASSED

---

_Phase: 04-identity-commerce-devices-and-administration_
_Completed: 2026-08-09_
