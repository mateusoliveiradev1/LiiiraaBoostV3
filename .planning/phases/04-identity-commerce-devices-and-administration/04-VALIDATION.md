---
phase: 04
slug: identity-commerce-devices-and-administration
status: draft
nyquist_compliant: false
wave_0_complete: false
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

Task IDs and plan/wave assignments are finalized by the Phase 4 planner. Every row below must be bound to at least one concrete task before `wave_0_complete` becomes true.

| Task ID | Plan | Wave | Requirement | Threat Ref                | Secure Behavior                                                                                        | Test Type                            | Automated Command                                                                                                                                                              | File Exists | Status     |
| ------- | ---- | ---- | ----------- | ------------------------- | ------------------------------------------------------------------------------------------------------ | ------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | ----------- | ---------- |
| TBD     | TBD  | 0+   | WEB-04      | T-P4-ACCOUNT-VERSION      | Account projections and version-aware mutations stay truthful across web and desktop                   | integration + Playwright             | `pnpm --filter @liiiraa/api test -- --run account-projection && pnpm --filter @liiiraa/web-evidence exec playwright test tests/account-authority.spec.ts`                      | ❌ W0       | ⬜ pending |
| TBD     | TBD  | 0+   | WEB-05      | T-P4-DEVICE-RACE          | Revoke/replace obeys cooldown and cannot create two active PCs                                         | PostgreSQL concurrency               | `pnpm --filter @liiiraa/api test -- --run device-transfer`                                                                                                                     | ❌ W0       | ⬜ pending |
| TBD     | TBD  | 0+   | WEB-06      | T-P4-ADMIN-AUTHZ          | Isolated admin origin enforces exactly one assumed least-privilege role                                | integration + Playwright             | `pnpm --filter @liiiraa/api test -- --run admin-authorization && pnpm --filter @liiiraa/web-evidence exec playwright test tests/admin-authority.spec.ts`                       | ❌ W0       | ⬜ pending |
| TBD     | TBD  | 0+   | WEB-07      | T-P4-CONSENT-REVOKE       | Consent expiry/revocation terminates diagnostic access and appends audit evidence                      | integration + browser                | `pnpm --filter @liiiraa/api test -- --run diagnostic-consent && pnpm --filter @liiiraa/web-evidence exec playwright test tests/admin-consent-revocation.spec.ts`               | ❌ W0       | ⬜ pending |
| TBD     | TBD  | 0+   | IDEN-01     | T-P4-OAUTH                | Verified email, Google, Discord, and passkeys authenticate; public/unverified paths fail closed        | adapter conformance + E2E            | `pnpm --filter @liiiraa/api test -- --run identity-conformance`                                                                                                                | ❌ W0       | ⬜ pending |
| TBD     | TBD  | 0+   | IDEN-02     | T-P4-RECOVERY             | MFA, recovery review/hold/contest, and session revocation follow locked policy                         | state-machine + integration          | `pnpm --filter @liiiraa/control-plane-domain test -- --run identity-recovery`                                                                                                  | ❌ W0       | ⬜ pending |
| TBD     | TBD  | 0+   | IDEN-03     | T-P4-STEP-UP              | Critical admin actions require recent scoped reauthentication, reason, review, confirmation, and audit | authorization integration            | `pnpm --filter @liiiraa/api test -- --run admin-step-up`                                                                                                                       | ❌ W0       | ⬜ pending |
| TBD     | TBD  | 0+   | IDEN-04     | T-P4-DEVICE-RACE          | Concurrent binds preserve the one-active-PC invariant                                                  | PostgreSQL concurrency               | `pnpm --filter @liiiraa/api test -- --run one-active-device`                                                                                                                   | ❌ W0       | ⬜ pending |
| TBD     | TBD  | 0+   | IDEN-05     | T-P4-DEVICE-PRIVACY       | Raw hardware serials never cross boundaries and minor changes follow tolerant revalidation             | property + privacy contract          | `pnpm --filter @liiiraa/control-plane-domain test -- --run device-evidence && cargo test -p liiiraa-desktop device_identity`                                                   | ❌ W0       | ⬜ pending |
| TBD     | TBD  | 0+   | IDEN-06     | T-P4-OFFLINE-TOKEN        | Exact-byte Ed25519 envelope verifies for seven days and rejects tamper/key/device/time mismatches      | cross-language fixture + property    | `pnpm --filter @liiiraa/contracts test -- --run offline-entitlement && cargo test -p liiiraa-desktop offline_entitlement`                                                      | ❌ W0       | ⬜ pending |
| TBD     | TBD  | 0+   | IDEN-07     | T-P4-ENTITLEMENT-BOUNDARY | Expiry blocks only the next new paid action, not in-flight or safety work                              | domain table + desktop E2E           | `pnpm --filter @liiiraa/control-plane-domain test -- --run entitlement-policy && pnpm --filter @liiiraa/desktop exec playwright test tests/browser/entitlement-expiry.spec.ts` | ❌ W0       | ⬜ pending |
| TBD     | TBD  | 0+   | IDEN-08     | T-P4-SAFETY-ACCESS        | History, warnings, and restoration remain available after entitlement loss                             | domain + desktop E2E                 | `pnpm --filter @liiiraa/desktop exec playwright test tests/browser/post-premium-safety.spec.ts`                                                                                | ❌ W0       | ⬜ pending |
| TBD     | TBD  | 0+   | IDEN-09     | T-P4-WEBHOOK-REPLAY       | Duplicate, delayed, replayed, and reordered webhooks converge without duplicate authority              | permutation + PostgreSQL integration | `pnpm --filter @liiiraa/api test -- --run webhook-reconciliation`                                                                                                              | ❌ W0       | ⬜ pending |

_Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky_

---

## Wave 0 Requirements

- [ ] `apps/api/vitest.config.ts` and `apps/api/src/testing/postgres.ts` — API/PostgreSQL integration harness with CI Testcontainers and synthetic Neon mode.
- [ ] `packages/control-plane-domain/src/**/*.test.ts` — deterministic clock/ID state-table tests for recovery, commerce, device, entitlement, consent, and admin policy.
- [ ] `packages/control-plane-adapters/src/identity/better-auth.spike.test.ts` — terminating native OAuth/MFA/passkey/recovery/revocation gate.
- [ ] `packages/control-plane-adapters/src/commerce/stripe-webhook.permutation.test.ts` — raw-signature admission plus duplicate/delay/replay/reorder convergence.
- [ ] `packages/contracts/src/fixtures/offline-entitlement/` and Rust fixture tests — exact cross-language signed-byte corpus with tamper/key/time/device cases.
- [ ] `apps/api/src/modules/devices/device-concurrency.test.ts` — real PostgreSQL lock and partial-index races.
- [ ] `apps/api/src/modules/support/consent-stream.test.ts` — expiry/revoke abort, no-store headers, disposal, and audit cases.
- [ ] `tooling/web-evidence/tests/account-authority.spec.ts`, `admin-authority.spec.ts`, and `admin-consent-revocation.spec.ts` — real authority projections preserving Phase 3 UX.
- [ ] `apps/desktop/tests/browser/entitlement-expiry.spec.ts` and `post-premium-safety.spec.ts` — start/continue/safety boundary coverage.
- [ ] Pinned `oasdiff` 1.26.0 CI job before accepting the first emitted OpenAPI change.

---

## Manual-Only Verifications

| Behavior                                                            | Requirement      | Why Manual                                                                                                     | Test Instructions                                                                                                                                                                                                                                          |
| ------------------------------------------------------------------- | ---------------- | -------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Windows system-browser PKCE callback and Credential Manager custody | IDEN-01, IDEN-02 | Requires a packaged Windows build, OS browser, loopback/callback ownership, and Credential Manager inspection  | Run every enabled sign-in and recovery path on clean Windows 10/11; verify no provider password or bearer token enters the WebView, deep link, SQLite, localStorage, logs, or clipboard; revoke the session and confirm credentials clear on next contact. |
| Consent revocation clears an operator's active diagnostic view      | WEB-07           | Browser/server stream termination and rendered-data disposal require an interactive admin session              | Open a consented case in the isolated admin origin, revoke consent from the account origin, and verify the current view closes immediately, no durable URL/download/cache remains, and an immutable access/revocation event exists.                        |
| Invited staging promotion and rollback by exact build identity      | WEB-04, WEB-06   | Requires deployed Vercel origins, hosted OCI API, Neon branch, sandbox providers, and a numbered desktop build | Exercise the local → preview → internal staging → invited-alpha ladder with synthetic tester identities; force a critical gate failure and prove the exact build returns to the prior stage with evidence preserved.                                       |

---

## Validation Sign-Off

- [ ] Every plan task is mapped above with a concrete Task ID, plan, and wave.
- [ ] All tasks have an automated verify command or explicit Wave 0 dependency.
- [ ] Sampling continuity: no three consecutive tasks lack automated verification.
- [ ] Wave 0 covers all currently missing references.
- [ ] No watch-mode flags are used.
- [ ] Focused feedback latency is measured below 30 seconds.
- [ ] `wave_0_complete: true` is set after all Wave 0 prerequisites exist and pass.
- [ ] `nyquist_compliant: true` is set only after all mappings and sampling checks pass.

**Approval:** pending
