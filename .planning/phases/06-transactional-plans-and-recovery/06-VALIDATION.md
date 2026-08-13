---
phase: 6
slug: transactional-plans-and-recovery
status: approved
nyquist_compliant: true
wave_0_complete: false
created: 2026-08-12
---

# Phase 6 - Validation Strategy

> Feedback contract for immutable plan revisions, proportional approval, durable intent journaling, crash reconciliation, dependency-scoped rollback, recovery, and one allowlisted Windows power-scheme operation.

## Test Infrastructure

| Property | Value |
| --- | --- |
| Frameworks | Cargo test/nextest + proptest, Vitest, Playwright + axe, Tauri/WebDriver |
| Rust workspace | `Cargo.toml` and `apps/desktop/src-tauri/Cargo.toml` |
| TypeScript workspace | `pnpm-workspace.yaml` and package-local Vitest configs |
| Browser E2E | `apps/desktop/tests/browser` |
| Packaged Windows | `apps/desktop/tests/packaged` plus Hyper-V checkpoint evidence |
| Quick run | owning package `pnpm --filter ... test -- --run` or `cargo test -p ... <target>` |
| Full deterministic suite | `pnpm verify:foundation && pnpm --filter @liiiraa/desktop test && cargo test --workspace` |
| Physical promotion suite | exact-version simulation -> clean VM -> owner PC -> friends' PCs, sequentially |

## Sampling Rate

- After every TDD RED/GREEN/REFACTOR commit: run the focused feature test, targeting feedback within 30 seconds.
- After every standard UI or integration task: run the owning Vitest/component test plus lint/typecheck for the touched package.
- After every plan: run affected Rust and TypeScript packages, TypeSpec generation/drift checks, and deterministic adapter conformance.
- After every wave: run `cargo test --workspace`, relevant package tests, and all Phase 6 fault-injection scenarios introduced so far.
- Before phase verification: full repository suite and packaged desktop journey must be green; physical promotion evidence must explicitly record its highest completed stage.
- No task may rely on watch mode, and no three consecutive tasks may omit an automated check.

## Per-Plan Verification Map

| Plan | Requirements | Threat refs | Secure behavior | Automated evidence |
| --- | --- | --- | --- | --- |
| 06-01 | PLAN-01, PLAN-02, PLAN-03 | T-06-03 | Immutable deterministic revisions, complete generated metadata, and invalidation when evidence changes | TypeSpec drift/corpus, Rust plan composition and revision properties, TS/Rust conformance |
| 06-02 | PLAN-04, PLAN-05 | T-06-03, T-06-09 | Global policy is only a ceiling; mixed plans inherit maximum risk; Extremo has no execution transition; fresh action-bound approval gates mutation | Rust risk/approval properties, stale/wrong-action proof corpus, focused Vitest/browser interactions |
| 06-03 | PLAN-06, PLAN-07 | T-06-04, T-06-07 | FULL-durable intent precedes side effects; hash-chain or drift failures block new mutation while preserving recovery | migrations, restart/disk-full/IOERR/BUSY tests, journal tamper corpus |
| 06-04 | PLAN-06, PLAN-07, PLAN-08 | T-06-05, T-06-07, T-06-08 | Observation-first reconciliation never blindly retries; rollback is reverse dependency closure only; native state survives renderer loss | proptest dependency closure, failpoint matrix, reconnect snapshot/conformance tests |
| 06-05 | PLAN-05, PLAN-06 | T-06-01, T-06-02, T-06-06 | Broker accepts only bounded allowlisted typed operations from authenticated local clients; replay and generic primitives are rejected | canonical protocol corpus, identity/replay/dedup adversarial tests, capability assertions |
| 06-06 | PLAN-06, PLAN-07 | T-06-05, T-06-09 | `Liiiraa Verificado` uses exact GUID observation/apply/restore, detects external drift, and proves restored state | fake PowrProf port tests, packaged Windows journey, clean-VM reboot/crash drills |
| 06-07 | PLAN-02, PLAN-03, PLAN-04, PLAN-05, PLAN-07, PLAN-08 | T-06-03, T-06-08 | Review, approval, progress, partial failure, receipts, and Recovery Center are projections of native authority and remain keyboard/screen-reader operable | Vitest, Playwright + axe, locale/visual/reduced-motion/reconnect fixtures |
| 06-08 | PLAN-01..08 | all | Deterministic fixtures cannot masquerade as physical evidence; promotion is monotonic per exact operation version with no override | packaged harness, evidence-manifest audit, privacy scan, sequential promotion checklist |

## Wave 0 Requirements

- [ ] `packages/contracts-source/src/transactional-plans.tsp` and valid/invalid cross-runtime corpus for PLAN-01 through PLAN-08.
- [ ] `crates/plan-engine/tests/plan_revision.rs`, `risk_policy.rs`, `dependency_rollback.rs`, and `reconcile.rs` as pure RED witnesses.
- [ ] `apps/desktop/src-tauri/tests/recovery_store.rs`, `recovery_executor.rs`, and `broker_protocol.rs` for migration, durability, crash, and IPC RED witnesses.
- [ ] `packages/desktop-client/src/plans.test.ts` for deterministic/production conformance and fixture-provenance rejection.
- [ ] `packages/feature-shell/src/features/transactional-plans.test.tsx` for required fields, plan editing, policy groups, approval, progress, and Recovery Center.
- [ ] `apps/desktop/tests/browser/transactional-plans.spec.ts` for keyboard, screen-reader semantics, reduced motion, reconnect, drift, and recovery.
- [ ] `apps/desktop/tests/packaged/transactional-plans.ts` for packaged command/schema checks and real-Windows journey hooks.
- [ ] `architecture/module-boundaries.json` entries for the pure plan engine and privileged broker before adding source files.
- [ ] Human package-legitimacy checkpoint for `windows-service` before installation or broker implementation.

## Required Fault Injection

- Before prepare insert; SQLite `BUSY`, `FULL`, and `IOERR` during commit; and immediately after the prepared intent commits.
- Before broker dispatch; broker timeout before and after the external effect; response loss after effect; and process crash before observation append.
- Verification failure; dependency rollback failure; receipt append failure; renderer disconnect; Windows shutdown; and reboot reconciliation.
- Stale or wrong-action approval proof, changed plan fingerprint, changed evidence/security posture, revoked operation version, and unavailable complementary recovery.
- External power-scheme drift before apply and before restore, including already-applied, already-restored, and conflicting third-state observations.

Every failpoint must assert the exact derived state, mutation-gate status, absence of blind retry, affected dependency closure, retained immutable evidence, and deterministic next safe action.

## Manual-Only Verifications

| Behavior | Requirement | Why manual/physical | Instructions |
| --- | --- | --- | --- |
| Real GUID power-scheme apply, reboot, restore, and drift recovery on Windows 10/11 | PLAN-06, PLAN-07 | PowrProf, service identity, reboot, and policy behavior cannot be faithfully proven in browser simulation | restore the clean Hyper-V checkpoint, install the exact build, record prior/applied/restored GUIDs, inject crash/reboot/drift, and retain the redacted evidence package |
| Privileged IPC user-context and process identity | PLAN-05, PLAN-06 | token impersonation, session identity, pipe ACL, and signed-process behavior require an elevated packaged environment | execute legitimate, same-user spoof, replay, wrong-session, and remote-client cases; verify every invalid case fails closed without mutation |
| System Restore preparation and unavailable states | PLAN-05, PLAN-07 | availability depends on elevation, OS policy, service configuration, and restore-point frequency | run begin/end and unavailable/disabled/frequency scenarios in the VM; verify the UI never claims a recovery point without observed proof |
| Sequential exact-version promotion | PLAN-01..08 | owner/friends hardware evidence and consent cannot be simulated or parallelized | pass deterministic simulation, then clean VM, then owner PC, then consented friends' PCs; record stage and block advancement on any failure |
| Assistive-technology recovery walkthrough | PLAN-03, PLAN-05, PLAN-07, PLAN-08 | automated semantics do not prove comprehension during high-risk or failure states | complete keyboard and Narrator journeys in PT-BR and English at 150%/200% scaling, including approval, partial failure, restart, and individual/plan/checkpoint restore |

Manual gates cannot be converted into automated PASS by deterministic fixtures. Until the privileged IPC, action-scoped strong-auth, and user-context PowrProf spikes pass, real high-risk mutation remains blocked while deterministic conformance work may proceed.

## Validation Sign-Off

- [x] PLAN-01 through PLAN-08 have deterministic automated coverage.
- [x] Every behavior-heavy boundary is assigned a TDD witness or fault-injection suite.
- [x] Sampling continuity forbids three consecutive tasks without automated verification.
- [x] Missing infrastructure is explicit Wave 0 work.
- [x] Commands are bounded and non-watch.
- [x] Physical-only gates are isolated from simulated evidence and ordered sequentially.
- [x] Security-critical real mutation is blocked until prerequisite spikes pass.
- [x] `nyquist_compliant: true` is set.

**Approval:** approved 2026-08-12
