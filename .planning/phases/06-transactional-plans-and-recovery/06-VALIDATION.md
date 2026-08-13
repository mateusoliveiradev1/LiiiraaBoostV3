---
phase: 6
slug: transactional-plans-and-recovery
status: approved
nyquist_compliant: true
wave_0_complete: true
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
- Before phase verification: full repository suite and packaged desktop journey must be green; physical promotion must PASS simulation, clean VM, owner PC, and friends' PCs for one exact operation version. A missing/unavailable/failed stage leaves the phase blocked.
- No task may rely on watch mode, and no three consecutive tasks may omit an automated check.

## Per-Plan Verification Map

| Plan | Requirements | Threat refs | Secure behavior | Automated evidence |
| --- | --- | --- | --- | --- |
| 06-01 | PLAN-01–08 | T-06-01A/B | Closed generated contracts reject generic authority, secrets, invalid lifecycle, and stage skips | `pnpm test:contracts`; Rust transactional corpus |
| 06-02 | PLAN-01,04,06,08 | T-06-02A | Plan engine is a compile-valid pure workspace member with enforced ownership | `pnpm test:architecture`; `cargo metadata --no-deps` |
| 06-03 | PLAN-01–08 | T-06-03A/B | Shared interfaces deny renderer authority and keep recovery auth-independent | `cargo check -p liiiraa-plan-engine`; architecture gate |
| 06-04 | PLAN-06 | T-06-04SC | Exact privileged dependency identity is auto-captured before install, human-reviewed at a canonical checkpoint, then persisted and mechanically validated afterward | approval preparer/validator plus blocking reviewer record |
| 06-05 | PLAN-01–03 | T-06-05A | Immutable deterministic revisions bind exact evidence and operation versions | `cargo test -p liiiraa-plan-engine --test plan_revision` |
| 06-06 | PLAN-04,05 | T-06-06A/B | Risk ceiling, proportional confirmation, recovery readiness, and exact proof fail closed | `cargo test -p liiiraa-plan-engine --test risk_policy` |
| 06-07 | PLAN-07,08 | T-06-07A | Rollback is the reverse affected dependency closure only | `cargo test -p liiiraa-plan-engine --test dependency_rollback` |
| 06-08 | PLAN-06–08 | T-06-08A | Observation-first reconciliation never blindly retries or invents success | `cargo test -p liiiraa-plan-engine --test reconcile` |
| 06-09 | PLAN-06,07 | T-06-09A/B | FULL-durable intent uses HMAC + Windows-protected external anchor; whole-history recomputation fails | `cargo test -p liiiraa-desktop --test recovery_store` |
| 06-10 | PLAN-01,07,08 | T-06-10A/B/C | Exact-version promotion, signed revocation, and redacted diagnostics cannot be bypassed | `cargo test -p liiiraa-plan-engine --test promotion` |
| 06-11 | PLAN-01–05,07,08 | T-06-11A/B | Renderer consumes validated immutable projections and refetches once on sequence gaps | focused desktop-client Vitest |
| 06-12 | PLAN-05 | T-06-12A/B | One-use action/device/session/fingerprint proof is consumed natively without secret leakage | focused API Vitest + native `plan_auth` test |
| 06-13 | PLAN-05,06 | T-06-13A/B/C | Privileged IPC rejects spoofing/remote/generic authority and returns durable recorded outcomes without second dispatch across service restart, crash, and preshutdown | approval preflight + Cargo.lock identity + optimizer-service restart-dedup `ipc_protocol` test + architecture gate |
| 06-14 | PLAN-05–08 | T-06-14A/B | Executor commits before effect, observes before verdict, and reconciles every failpoint | `cargo test -p liiiraa-plan-engine --test executor` |
| 06-15 | PLAN-03,06,07 | T-06-15A/B | Exact PowrProf GUID lifecycle is user-context-bound, drift-safe, and reversible | optimizer-service `power_scheme` test |
| 06-16 | PLAN-05,07 | T-06-16A/B | Restore-point states remain observed and explicit with no generic DLL/registry authority | optimizer-service `restore_point` test |
| 06-17 | PLAN-03,05,07,08 | T-06-17A/B | After 06-22 admits the UI contract, transactional primitives preserve semantic status, focus, scaling, and no Extreme control | UI approval record + design-system transactional component Vitest |
| 06-18 | PLAN-01,02,05–08 | T-06-18A/B | Tauri recomputes authority, uses the broker only, and restores startup/tray truth | recovery-executor + broker-protocol tests; foundation gate |
| 06-19 | PLAN-01–05,07,08 | T-06-19A/B | After 06-22 admits the UI contract, Improve/Recovery Center present authoritative state and proportional controls accessibly | UI approval record + focused feature-shell Vitest |
| 06-20 | PLAN-01–08 | T-06-20A/B | Browser and packaged harnesses preserve provenance, cover D-13 lifecycle, and disable physical hooks by default | focused smoke tests; full Playwright/desktop/workspace plan gate |
| 06-21 | PLAN-01,05–08 | T-06-21A/B | Evaluator rejects omission, tamper, stage skip, version swap, and privacy violations | phase6-evidence Vitest; `phase6:verify --mode planned` |
| 06-22 | PLAN-01–05,07,08 | T-06-22A | Pending UI-SPEC cannot authorize implementation; only an independent structured checker report with exactly six unique PASS verdicts, verified SHA-256, disposed findings, and separate human acknowledgement can promote an exactly agreeing UI-SPEC | `rtk node --test .planning/phases/06-transactional-plans-and-recovery/06-22-validate-ui-contract-approval.test.mjs` adversarial suite + read-only `06-22-validate-ui-contract-approval.mjs --check` record/report/UI-SPEC validator |
| 06-23 | PLAN-04–06 | T-06-23A/B | Device-local Advanced preference is append-audited, strongly authenticated for enable/revoke, restart-persistent, posture-invalidated, and recovery-independent | native `advanced_preference` TDD suite |
| 06-24 | PLAN-04–06 | T-06-24A/B | Closed Tauri/client commands project and mutate D-13 authority without renderer booleans, optimistic success, or replay | native executor + desktop-client conformance suites |
| 06-25 | PLAN-04,05 | T-06-25A/B | Accessible bilingual UI covers enable/revoke/restart/invalidation/revalidation while preserving recovery | focused/full feature-shell Vitest |
| 06-26 | PLAN-01–08 | T-06-26A/B | Clean-VM harness run is persisted before review; exact matching reviewer verdict admits or blocks the stage | clean-VM run evaluator + post-checkpoint review validator |
| 06-27 | PLAN-01–08 | T-06-27A/B | Owner-PC harness run is persisted before review and bound to exact clean-VM predecessor | owner-PC run evaluator + post-checkpoint review validator |
| 06-28 | PLAN-01–08 | T-06-28A/B/C | Friends runs are persisted before consent/review; final verifier requires all four exact-version stages | friends + all-four-stage final evaluators and persisted reviews/UAT |

## Wave 0 Requirements

- [x] Contract source/corpus is owned by 06-01 Task 1/2 and runs before any consumer.
- [x] Pure RED witnesses are owned by 06-05, 06-06, 06-07, and 06-08 Task 1 respectively.
- [x] Recovery-store, recovery-executor, and broker-protocol RED witnesses are owned by 06-09 Task 1 and 06-18 Task 1; IPC adversarial RED is additionally owned by 06-13 Task 1.
- [x] Desktop-client conformance/fixture RED witness is owned by 06-11 Task 1.
- [x] Feature-shell plan/recovery behavior starts test-first in 06-19 Tasks 1 and 2.
- [x] Browser E2E is created in 06-20 Task 1 with focused smoke feedback and a full plan gate.
- [x] Packaged journey hooks and focused contract test are created in 06-20 Task 2.
- [x] Plan-engine boundary/public-root registration is owned by 06-02; broker boundary registration is owned by 06-13 Task 1 before implementation.
- [x] The non-auto-approvable `windows-service` legitimacy review is preceded by automated evidence preparation and followed by automated verdict persistence/validation in 06-04; it blocks 06-13.
- [x] UI-SPEC approval is owned by 06-22 and blocks 06-17/06-19/06-20 until the schema-backed post-checkpoint gate verifies the independent report bytes/semantics, exact six unique PASS verdicts, findings disposition, human acknowledgement, and coherent UI-SPEC promotion; its negative suite covers contradictory PASS prose, non-PASS/unknown/duplicate/missing dimensions, evidence/hash failures, and status/sign-off disagreement.
- [x] D-13 storage/auth lifecycle, native/client wiring, and accessible UI witnesses are owned by 06-23, 06-24, and 06-25.
- [x] Clean-VM, owner-PC, and friends-PC physical work is split across 06-26, 06-27, and 06-28; each run is automated/persisted before a canonical human review and its verdict is persisted afterward.

`wave_0_complete: true` means every missing test scaffold/gate has explicit pre-implementation ownership and an automated command in the 28-plan decomposition; it does not claim those future files have already been implemented.

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
