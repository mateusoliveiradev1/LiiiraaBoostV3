---
phase: 04
slug: identity-commerce-devices-and-administration
status: planned
nyquist_compliant: true
wave_0_complete: true
created: 2026-08-04
---

# Phase 04 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.

---

## Test Infrastructure

| Property               | Value                                                                                                                                                                |
| ---------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Framework**          | Vitest 4.1.10 for TypeScript; Playwright 1.62.0 for account/admin/browser flows; Rust `cargo test` plus `proptest`; Testcontainers 12.0.4 for PostgreSQL integration |
| **Config file**        | Existing distributed Vitest configs and `tooling/web-evidence/playwright.config.ts`; `apps/api/vitest.config.ts` is created in Wave 0                                |
| **Quick run command**  | `pnpm --filter @liiiraa/control-plane-domain test -- --run`                                                                                                          |
| **Full suite command** | `pnpm verify:foundation && pnpm web:verify && pnpm --filter @liiiraa/desktop verify` plus Phase 4 API/PostgreSQL/security/evidence jobs                              |
| **Estimated runtime**  | Target: focused task checks under 30 seconds; full suite measured during Wave 0                                                                                      |

---

## Sampling Rate

- **After every task commit:** Run the focused Vitest/Rust test for the touched invariant; add `pnpm contracts:check` whenever contracts change.
- **After every plan wave:** Run Phase 4 API integration, contract, architecture, affected Playwright, and Rust cross-language fixture suites.
- **Before `$gsd-verify-work`:** Run the full foundation, web, desktop, PostgreSQL/provider adversarial, security/privacy evidence, and invited-staging smoke suites.
- **Max feedback latency:** 30 seconds for focused per-task checks.

---

## Per-Task Verification Map

Every requirement is bound to a concrete implementation task/wave and to a Wave 0 RED witness owner. `wave_0_complete: true` means all missing witness paths now have executable Wave 0 plan tasks; it does not claim the intentionally RED tests are already green.

| Task ID | Plan | Wave | Requirement | Threat Ref                | Secure Behavior                                                                                        | Test Type                            | Automated Command                                                                                                                                                              | File Exists | Status     |
| ------- | ---- | ---- | ----------- | ------------------------- | ------------------------------------------------------------------------------------------------------ | ------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | ----------- | ---------- |
| 04-17-01 / 04-18-01 | 04-17 / 04-18 | 6 / 7 | WEB-04 | T-P4-ACCOUNT-VERSION | Account projections and version-aware mutations stay truthful across web and desktop | integration + browser | `pnpm --filter @liiiraa/api test -- --run account-projection` | 🟦 04-32/34 | ✅ mapped |
| 04-14-01 / 04-18-02 | 04-14 / 04-18 | 4 / 7 | WEB-05 | T-P4-DEVICE-RACE | Revoke/replace obeys cooldown and cannot create two active PCs | PostgreSQL concurrency + smoke | `pnpm --filter @liiiraa/api test -- --run device-concurrency` | 🟦 04-32/34 | ✅ mapped |
| 04-16-01 / 04-19-01 | 04-16 / 04-19 | 6 / 7 | WEB-06 | T-P4-ADMIN-AUTHZ | Isolated admin origin enforces exactly one assumed least-privilege role | integration + browser | `pnpm --filter @liiiraa/api test -- --run admin-authorization` | 🟦 04-32/34 | ✅ mapped |
| 04-09-01 / 04-19-02 | 04-09 / 04-19 | 4 / 7 | WEB-07 | T-P4-CONSENT-REVOKE | Consent expiry/revocation terminates diagnostic access and appends audit evidence | integration + browser | `pnpm --filter @liiiraa/api test -- --run consent-stream` | 🟦 04-33/34 | ✅ mapped |
| 04-05-01 / 04-11-01 | 04-05 / 04-11 | 2 / 4 | IDEN-01 | T-P4-OAUTH | Verified email, Google, Discord, and passkeys authenticate; public/unverified paths fail closed | adapter conformance + API | `pnpm --filter @liiiraa/api test -- --run identity-conformance` | 🟦 04-32/33 | ✅ mapped |
| 04-12-01 | 04-12 | 5 | IDEN-02 | T-P4-RECOVERY | MFA, recovery review/hold/contest, and session revocation follow locked policy | state-machine + integration | `pnpm --filter @liiiraa/control-plane-domain test -- --run identity-recovery` | 🟦 04-31/32 | ✅ mapped |
| 04-16-01 | 04-16 | 6 | IDEN-03 | T-P4-STEP-UP | Critical admin actions require recent scoped reauthentication, reason, review, confirmation, and audit | authorization integration | `pnpm --filter @liiiraa/api test -- --run admin-authorization` | 🟦 04-32 | ✅ mapped |
| 04-14-01 | 04-14 | 4 | IDEN-04 | T-P4-DEVICE-RACE | Concurrent binds preserve the one-active-PC invariant | PostgreSQL concurrency | `pnpm --filter @liiiraa/api test -- --run device-concurrency` | 🟦 04-32 | ✅ mapped |
| 04-06-01 / 04-14-01 | 04-06 / 04-14 | 2 / 4 | IDEN-05 | T-P4-DEVICE-PRIVACY | Raw hardware serials never cross boundaries and minor changes follow resolved tolerant scoring | property + privacy contract | `pnpm --filter @liiiraa/control-plane-domain test -- --run device-evidence` | 🟦 04-31 | ✅ mapped |
| 04-07-01 / 04-27-01 | 04-07 / 04-27 | 3 / 6 | IDEN-06 | T-P4-OFFLINE-TOKEN | Exact-byte envelope verifies for seven days and real API issuance links reconciled state to those bytes | cross-language + issuance | `pnpm --filter @liiiraa/api test -- --run entitlement-issuance` | 🟦 04-31 | ✅ mapped |
| 04-21-01 | 04-21 | 8 | IDEN-07 | T-P4-ENTITLEMENT-BOUNDARY | Expiry blocks only the next new paid action, not in-flight or safety work | domain + Rust | `pnpm --filter @liiiraa/control-plane-domain test -- --run paid-action-policy` | 🟦 04-31/34 | ✅ mapped |
| 04-21-01 | 04-21 | 8 | IDEN-08 | T-P4-SAFETY-ACCESS | History, warnings, and restoration remain available after entitlement loss | domain + browser | `pnpm --filter @liiiraa/desktop exec playwright test tests/browser/post-premium-safety.spec.ts --grep @safety-smoke --workers=1` | 🟦 04-34 | ✅ mapped |
| 04-08-01 / 04-13-01 | 04-08 / 04-13 | 4 / 5 | IDEN-09 | T-P4-WEBHOOK-REPLAY | Duplicate, delayed, replayed, and reordered webhooks converge without duplicate authority | permutation + PostgreSQL | `pnpm --filter @liiiraa/control-plane-adapters test -- --run stripe-webhook.permutation` | 🟦 04-33 | ✅ mapped |

_Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky_

---

## Wave 0 Requirements

- [x] Plan 04-02 Task 04-02-02 creates the API/PostgreSQL/determinism harness and measured focused command.
- [x] Plan 04-31 Task 04-31-01 creates recovery, device, offline-envelope, paid-action, and post-Premium RED witnesses.
- [x] Plan 04-32 Task 04-32-01 creates account, device-concurrency, identity, recovery, and admin API RED witnesses.
- [x] Plan 04-33 Task 04-33-01 creates the Better Auth, Stripe permutation, and consent-stream RED matrices.
- [x] Plan 04-34 Task 04-34-01 creates account/admin/consent and desktop entitlement/safety browser RED witnesses with focused tags.
- [x] Plan 04-03 Task 04-03-02 installs/runs the pinned `oasdiff` 1.26.0 compatibility gate before accepting OpenAPI operations.

---

## Manual-Only Verifications

| Behavior                                                            | Requirement      | Why Manual                                                                                                     | Test Instructions                                                                                                                                                                                                                                          |
| ------------------------------------------------------------------- | ---------------- | -------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Windows system-browser PKCE callback and Credential Manager custody | IDEN-01, IDEN-02 | Requires a packaged Windows build, OS browser, loopback/callback ownership, and Credential Manager inspection  | Run every enabled sign-in and recovery path on clean Windows 10/11; verify no provider password or bearer token enters the WebView, deep link, SQLite, localStorage, logs, or clipboard; revoke the session and confirm credentials clear on next contact. |
| Consent revocation clears an operator's active diagnostic view      | WEB-07           | Browser/server stream termination and rendered-data disposal require an interactive admin session              | Open a consented case in the isolated admin origin, revoke consent from the account origin, and verify the current view closes immediately, no durable URL/download/cache remains, and an immutable access/revocation event exists.                        |
| Invited staging promotion and rollback by exact build identity      | WEB-04, WEB-06   | Requires deployed Vercel origins, hosted OCI API, Neon branch, sandbox providers, and a numbered desktop build | Exercise the local → preview → internal staging → invited-alpha ladder with synthetic tester identities; force a critical gate failure and prove the exact build returns to the prior stage with evidence preserved.                                       |

---

## Validation Sign-Off

- [x] Every requirement row has concrete implementation Task ID(s), plan(s), and wave(s).
- [x] Every task has an automated verify command and behavior work has an explicit Wave 0 witness dependency.
- [x] Sampling continuity: no three consecutive tasks lack automated verification.
- [x] Wave 0 plans cover every previously missing reference.
- [x] No watch-mode flags are used.
- [x] Every implementation plan requires a focused command and records measured latency below 30 seconds; full Playwright/recursive suites are plan/wave/phase gates.
- [x] `wave_0_complete: true` records complete Wave 0 task/path planning; execution summaries record RED collection results.
- [x] `nyquist_compliant: true` records complete requirement/task/witness mapping and sampling design.

**Approval:** planner-mapped; execution evidence remains pending by design
