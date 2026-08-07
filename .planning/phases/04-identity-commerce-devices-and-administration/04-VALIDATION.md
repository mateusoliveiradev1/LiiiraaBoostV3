---
phase: 04
slug: identity-commerce-devices-and-administration
status: planned
nyquist_compliant: true
wave_0_complete: false
validation_scaffolding_complete: true
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
| **Estimated runtime**  | Target: each focused task check is measured under 30 seconds; cross-runtime/build/full-suite gates are measured separately during plan and wave execution          |

---

## Sampling Rate

- **After every task commit:** Run the focused Vitest/Rust test for the touched invariant; add `pnpm contracts:check` whenever contracts change.
- **After every plan wave:** Run Phase 4 API integration, contract, architecture, affected Playwright, and Rust cross-language fixture suites.
- **Before `$gsd-verify-work`:** Run the full foundation, web, desktop, PostgreSQL/provider adversarial, security/privacy evidence, and invited-staging smoke suites.
- **Max feedback latency:** 30 seconds for focused per-task checks.

---

## Per-Task Verification Map

Every requirement is bound to a concrete implementation task/wave and to a prerequisite-aware RED witness owner. Wave 0 creates the required manifests/configuration in Plan 04-02 (plus independent browser witnesses in 04-34); Plans 04-31/32/33 run in Wave 1 with `depends_on: ["04-02"]`. `validation_scaffolding_complete: true` records complete witness planning, while `wave_0_complete: false` prevents claiming the dependent Wave 1 witnesses execute before their scaffold.

| Task ID | Plan | Wave | Requirement | Threat Ref                | Secure Behavior                                                                                        | Test Type                            | Automated Command                                                                                                                                                              | File Exists | Status     |
| ------- | ---- | ---- | ----------- | ------------------------- | ------------------------------------------------------------------------------------------------------ | ------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | ----------- | ---------- |
| 04-17-01 / 04-18-01 / 04-35-01 | 04-17 / 04-18 / 04-35 | 6 / 7 / 8 | WEB-04 | T-P4-ACCOUNT-VERSION | Account projections and version-aware mutations stay truthful across web and desktop | integration + browser | `pnpm --filter @liiiraa/api test -- --run account-projection` | 🟦 04-32/34 | ✅ mapped |
| 04-14-01 / 04-18-02 | 04-14 / 04-18 | 4 / 7 | WEB-05 | T-P4-DEVICE-RACE | Revoke/replace obeys cooldown and cannot create two active PCs | PostgreSQL concurrency + smoke | `pnpm --filter @liiiraa/api test -- --run device-concurrency` | 🟦 04-32/34 | ✅ mapped |
| 04-16-01 / 04-19-01 | 04-16 / 04-19 | 6 / 7 | WEB-06 | T-P4-ADMIN-AUTHZ | Isolated admin origin enforces exactly one assumed least-privilege role | integration + browser | `pnpm --filter @liiiraa/api test -- --run admin-authorization` | 🟦 04-32/34 | ✅ mapped |
| 04-09-01 / 04-19-02 | 04-09 / 04-19 | 4 / 7 | WEB-07 | T-P4-CONSENT-REVOKE | Consent expiry/revocation terminates diagnostic access and appends audit evidence | integration + browser | `pnpm --filter @liiiraa/api test -- --run consent-stream` | 🟦 04-33/34 | ✅ mapped |
| 04-05-01 / 04-11-01 / 04-20-01 / 04-35-01 | 04-05 / 04-11 / 04-20 / 04-35 | 2 / 4 / 7 / 8 | IDEN-01 | T-P4-OAUTH | Verified email, Google, Discord, and passkeys authenticate; desktop completes system-browser PKCE and renders the authenticated projection | adapter conformance + API + native/browser | `pnpm --filter @liiiraa/api test -- --run identity-conformance` | 🟦 04-32/33 | ✅ mapped |
| 04-12-01 | 04-12 | 5 | IDEN-02 | T-P4-RECOVERY | MFA, recovery review/hold/contest, and session revocation follow locked policy | state-machine + integration | `pnpm --filter @liiiraa/control-plane-domain test -- --run identity-recovery` | 🟦 04-31/32 | ✅ mapped |
| 04-16-01 | 04-16 | 6 | IDEN-03 | T-P4-STEP-UP | Critical admin actions require recent scoped reauthentication, reason, review, confirmation, and audit | authorization integration | `pnpm --filter @liiiraa/api test -- --run admin-authorization` | 🟦 04-32 | ✅ mapped |
| 04-14-01 | 04-14 | 4 | IDEN-04 | T-P4-DEVICE-RACE | Concurrent binds preserve the one-active-PC invariant | PostgreSQL concurrency | `pnpm --filter @liiiraa/api test -- --run device-concurrency` | 🟦 04-32 | ✅ mapped |
| 04-06-01 / 04-14-01 | 04-06 / 04-14 | 2 / 4 | IDEN-05 | T-P4-DEVICE-PRIVACY | Raw hardware serials never cross boundaries and minor changes follow resolved tolerant scoring | property + privacy contract | `pnpm --filter @liiiraa/control-plane-domain test -- --run device-evidence` | 🟦 04-31 | ✅ mapped |
| 04-07-01 / 04-27-01 | 04-07 / 04-27 | 3 / 6 | IDEN-06 | T-P4-OFFLINE-TOKEN | Exact-byte envelope verifies for seven days and real API issuance links reconciled state to those bytes | cross-language + issuance | `pnpm --filter @liiiraa/api test -- --run entitlement-issuance` | 🟦 04-31 | ✅ mapped |
| 04-21-01 | 04-21 | 8 | IDEN-07 | T-P4-ENTITLEMENT-BOUNDARY | Expiry blocks only the next new paid action, not in-flight or safety work | domain + Rust | `pnpm --filter @liiiraa/control-plane-domain test -- --run paid-action-policy` | 🟦 04-31/34 | ✅ mapped |
| 04-21-01 | 04-21 | 8 | IDEN-08 | T-P4-SAFETY-ACCESS | History, warnings, and restoration remain available after entitlement loss | domain + browser | `pnpm --filter @liiiraa/desktop exec playwright test tests/browser/post-premium-safety.spec.ts --grep @safety-smoke --workers=1` | 🟦 04-34 | ✅ mapped |
| 04-08-01 / 04-13-01 | 04-08 / 04-13 | 4 / 5 | IDEN-09 | T-P4-WEBHOOK-REPLAY | Duplicate, delayed, replayed, and reordered webhooks converge without duplicate authority | permutation + PostgreSQL | `pnpm --filter @liiiraa/control-plane-adapters test -- --run stripe-webhook.permutation` | 🟦 04-33 | ✅ mapped |

### Administrative expansion task and sampling map

Plans 04-41–04-62 extend the same requirement set with D-69–D-111. Every row below owns all task IDs in the named plan; focused checks run after each task commit, Storybook builds run after every Admin UI plan, and fixture-off browser-to-API-to-PostgreSQL checks run before either staging checkpoint.

| Task ID(s) | Plan | Wave | Requirements | Secure behavior / sampling target | Automated command | Planned witness | Status |
| --- | --- | ---: | --- | --- | --- | --- | --- |
| 04-41-01 / 04-41-02 | 04-41 | 15 | WEB-06, WEB-07, IDEN-03 | Generated Admin contracts and safe isolated route grammar cover D-69–D-111 without handwritten DTOs or sensitive URL state. | `pnpm test:contracts -- --run validation && pnpm --filter @liiiraa/web-core test -- --run routes` | contract parity + route tests | ✅ mapped |
| 04-42-01 | 04-42 | 16 | WEB-06, IDEN-01 | Invitation lifecycle, capacity, queue, resend, reminders, acceptance, and retention are pure deterministic policy. | `pnpm --filter @liiiraa/control-plane-domain exec vitest --run src/admin/invitations.test.ts` | invitation state table | ✅ mapped |
| 04-43-01 | 04-43 | 17 | WEB-06, IDEN-03 | Membership, capabilities/scopes, risk, approvals, delegation, review, offboarding, simulation, and break-glass enforce segregation. | `pnpm --filter @liiiraa/control-plane-domain exec vitest --run src/admin/governance.test.ts` | governance decision matrix | ✅ mapped |
| 04-45-01 | 04-45 | 17 | WEB-06, IDEN-01 | Invitation use cases commit lifecycle, audit, outbox/job, receipt, and digest-only secret state atomically. | `pnpm --filter @liiiraa/control-plane-application exec vitest --run src/use-cases/manage-beta-invitations.test.ts` | transaction doubles | ✅ mapped |
| 04-44-01 | 04-44 | 18 | WEB-06, WEB-07, IDEN-03 | Jobs, freshness, conflict, incidents, configuration, privacy, environment, ownership, and emergency policies fail closed. | `pnpm --filter @liiiraa/control-plane-domain exec vitest --run src/admin/operations.test.ts` | operations state tables | ✅ mapped |
| 04-46-01 / 04-46-02 | 04-46 | 18 | WEB-06, IDEN-01 | PostgreSQL enforces 25 active invitations, one active email, one-use digest, durable queue/jobs/timeline, and safe upgrades. | `pnpm --filter @liiiraa/control-plane-adapters exec vitest --run src/postgres/migrations.test.ts src/postgres/admin-invitations.test.ts` | migration + real concurrency | ✅ mapped |
| 04-47-01 | 04-47 | 18 | WEB-06, IDEN-03 | Governance application authority performs authorization-before-load, step-up, approvals, offboarding, and reassignment atomically. | `pnpm --filter @liiiraa/control-plane-application exec vitest --run src/use-cases/manage-admin-access.test.ts` | access use-case suite | ✅ mapped |
| 04-48-01 / 04-48-02 | 04-48 | 19 | WEB-06, IDEN-03 | PostgreSQL persists one active function, scoped governance, independent approvals, review/inactivity state, and masked reads under races. | `pnpm --filter @liiiraa/control-plane-adapters exec vitest --run src/postgres/migrations.test.ts src/postgres/admin-governance.test.ts` | migration + governance races | ✅ mapped |
| 04-49-01 | 04-49 | 19 | WEB-06, WEB-07, IDEN-03 | Operational query/command use cases authorize before discovery and return distinct stale/conflict/degraded/partial outcomes. | `pnpm --filter @liiiraa/control-plane-application exec vitest --run src/use-cases/manage-admin-operations.test.ts` | operations use-case suite | ✅ mapped |
| 04-51-01 / 04-51-02 | 04-51 | 19 | WEB-06, IDEN-01 | Invitation management/acceptance APIs and worker enforce CSRF, possession, replay/capacity bounds, durable delivery/reminders/batches. | `pnpm --filter @liiiraa/api exec vitest --run src/modules/admin/invitation-routes.test.ts src/modules/identity/invitation-acceptance-routes.test.ts src/worker/admin-invitation-jobs.test.ts` | API + worker integration | ✅ mapped |
| 04-50-01 / 04-50-02 | 04-50 | 20 | WEB-06, WEB-07, IDEN-03 | PostgreSQL persists operational ledgers, versions, jobs, incidents, configurations, capacity, privacy, alerts, and emergency state. | `pnpm --filter @liiiraa/control-plane-adapters exec vitest --run src/postgres/migrations.test.ts src/postgres/admin-operations.test.ts` | migration + worker/concurrency | ✅ mapped |
| 04-52-01 / 04-52-02 | 04-52 | 20 | WEB-06, IDEN-03 | Governance/approval APIs enforce exact origin, CSRF, active function, capability/scope, action-bound step-up, independent approval, and no self-approval. | `pnpm --filter @liiiraa/api exec vitest --run src/modules/admin/governance-routes.test.ts src/modules/admin/approval-routes.test.ts` | governance API integration | ✅ mapped |
| 04-53-01 / 04-53-02 | 04-53 | 21 | WEB-06, WEB-07, IDEN-03 | Complete Admin registrar exposes real PostgreSQL search/jobs/live/incidents/config/privacy/emergency authority and blocks partial readiness. | `pnpm --filter @liiiraa/api exec vitest --run src/modules/admin/operations-routes.test.ts src/staging/real-admin.test.ts src/modules/admin` | API composition + readiness | ✅ mapped |
| 04-54-01 / 04-54-02 | 04-54 | 22 | WEB-06, IDEN-03 | Admin tokens, accessible operational primitives, and the deterministic Storybook state harness are executable while fixtures remain test-only. | `pnpm --filter @liiiraa/design-system exec vitest --run src/design-system.test.tsx && pnpm --filter @liiiraa/design-tokens test && pnpm --filter @liiiraa/admin storybook:build` | token/primitive tests + Storybook | ✅ mapped |
| 04-62-01 / 04-62-02 | 04-62 | 23 | WEB-06, IDEN-03 | Typed query/mutation/live-refetch authority, production fixture exclusion, and the responsive permission-projected Variant A shell are executable. | `pnpm --filter @liiiraa/admin exec vitest --run src/admin-authority.test.ts src/features/admin-authority.test.tsx src/admin-shell.test.ts src/admin-security.test.ts && pnpm --filter @liiiraa/admin storybook:build` | client/provider/fixture guard + shell tests/stories | ✅ mapped |
| 04-55-01 / 04-55-02 | 04-55 | 24 | WEB-06, WEB-07 | Briefing Focus queries real priorities/live freshness and renders complete Storybook states without fabricated metrics. | `pnpm --filter @liiiraa/admin exec vitest --run src/features/admin-overview-model.test.ts && pnpm --filter @liiiraa/admin storybook:build` | overview model + stories | ✅ mapped |
| 04-56-01 / 04-56-02 | 04-56 | 24 | WEB-06, IDEN-03 | Queue Canvas provides safe URL state, authorized search/views/inbox/jobs, live refetch, conflict preservation, inspector/mobile routes, and stories. | `pnpm --filter @liiiraa/admin exec vitest --run src/features/admin-queue-model.test.ts && pnpm --filter @liiiraa/admin storybook:build` | queue model + stories | ✅ mapped |
| 04-57-01 / 04-57-02 | 04-57 | 24 | WEB-06, IDEN-01, IDEN-03 | Invitation UI calls real 04-51 authority for preflight/mutations/jobs/live state and Storybook covers D-88–D-98 states. | `pnpm --filter @liiiraa/admin exec vitest --run src/features/admin-invitations-model.test.ts && pnpm --filter @liiiraa/admin storybook:build` | invitation model + stories | ✅ mapped |
| 04-58-01 / 04-58-02 | 04-58 | 24 | WEB-06, IDEN-03 | Governance UI calls real 04-52 authority and stories cover risk, approval, delegation, review, offboarding, simulation, and break-glass. | `pnpm --filter @liiiraa/admin exec vitest --run src/features/admin-access-model.test.ts && pnpm --filter @liiiraa/admin storybook:build` | access model + stories | ✅ mapped |
| 04-59-01 / 04-59-02 | 04-59 | 24 | WEB-06, WEB-07, IDEN-03 | Revenue/support uses real authority; consent revoke aborts/clears immediately; export/provider/degraded states have Storybook witnesses. | `pnpm --filter @liiiraa/admin exec vitest --run src/features/admin-revenue-support-model.test.ts && pnpm --filter @liiiraa/admin storybook:build` | revenue/support model + stories | ✅ mapped |
| 04-60-01 / 04-60-02 | 04-60 | 24 | WEB-06, WEB-07, IDEN-03 | Operations/Security/System calls real 04-53 authority; jobs/incidents/config/privacy/emergency/live states and recovery bounds have stories. | `pnpm --filter @liiiraa/admin exec vitest --run src/features/admin-operations-system-model.test.ts && pnpm --filter @liiiraa/admin storybook:build` | operations model + stories | ✅ mapped |
| 04-61-01 / 04-61-02 / 04-61-03 | 04-61 | 25 | WEB-06, WEB-07, IDEN-01, IDEN-03 | Production registry and desktop handoff pass complete Storybook, viewport, axe, browser→API→PostgreSQL, fixture-off, and exact-commit manual accessibility/visual gates. | `pnpm --filter @liiiraa/admin storybook:build && pnpm --filter @liiiraa/admin verify && pnpm exec playwright test tooling/web-evidence/tests/admin-operations.spec.ts --grep @production-authority && pnpm --filter @liiiraa/desktop verify` | Storybook + E2E + 04-ADMIN-VISUAL-UAT.md | ✅ mapped |
| 04-40-01 / 04-40-02 / 04-40-03 | 04-40 | 26 | WEB-04, WEB-07, IDEN-01, IDEN-02, IDEN-03, IDEN-04, IDEN-07 | Exact published origins prove real identity and full Admin authority with fixture flags false before human approval. | `pnpm phase4:verify -- --stage internal-staging && pnpm exec playwright test tooling/web-evidence/tests/admin-operations.spec.ts --grep @published-authority` | 04-REAL-AUTH-UAT.md | ✅ mapped |
| 04-25-01 | 04-25 | 27 | WEB-04–WEB-07, IDEN-01–IDEN-09 | Clean Windows, consent, device/offline, complete Admin authority, downgrade, and rollback are observed on exact invited-alpha build. | `pnpm phase4:verify -- --stage invited-alpha && pnpm exec playwright test tooling/web-evidence/tests/admin-operations.spec.ts --grep @published-authority` | 04-STAGING-UAT.md | ✅ mapped |
| 04-26-01 / 04-26-02 | 04-26 | 28 | WEB-04–WEB-07, IDEN-01–IDEN-09 | Recursive manifest maps every individual D-01–D-111 decision and every task/witness without range-only or fixture evidence. | `pnpm phase4:verify -- --stage invited-alpha` | evidence manifest + 04-FINAL-EVIDENCE.md | ✅ mapped |

_Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky_

---

## Validation Scaffolding Requirements

- [x] Plan 04-02 Task 04-02-02 creates the API/PostgreSQL/determinism harness and measured focused command.
- [x] Plan 04-31 Task 04-31-01 runs in Wave 1 after 04-02 and creates recovery, device, offline-envelope, paid-action, and post-Premium RED witnesses.
- [x] Plan 04-32 Task 04-32-01 runs in Wave 1 after 04-02 and creates account, device-concurrency, identity, recovery, and admin API RED witnesses.
- [x] Plan 04-33 Task 04-33-01 runs in Wave 1 after 04-02 and creates the Better Auth, Stripe permutation, and consent-stream RED matrices.
- [x] Plan 04-34 Task 04-34-01 remains an independent Wave 0 plan because it uses existing Playwright manifests/configuration and creates account/admin/consent and desktop entitlement/safety browser RED witnesses with focused tags.
- [x] Plan 04-03 Task 04-03-02 installs/runs the pinned `oasdiff` 1.26.0 compatibility gate before accepting OpenAPI operations.
- [x] Plans 04-41–04-53 map generated contracts through domain → application → PostgreSQL → API/readiness with focused RED/green commands and real concurrency where authority depends on the database.
- [x] Plan 04-54 creates the visual tokens, operational primitives, and deterministic Storybook harness; Plan 04-62 creates the typed production Admin authority, fixture guard, and responsive shell; Plans 04-55–04-60 add domain stories for the complete UI-SPEC state matrix.
- [x] Plan 04-61 binds the production route registry to the typed client and adds fixture-off browser → API → PostgreSQL E2E, full viewport/axe/visual evidence, and exact-commit manual screen-reader/contrast/long-content/touch-target review.
- [x] Plans 04-40 and 04-25 rerun real published-origin Admin authority checks before human staging approval; Plan 04-26 consumes every 04-41–04-62 summary and maps each individual D-01–D-111 decision.

---

## Manual-Only Verifications

| Behavior                                                            | Requirement      | Why Manual                                                                                                     | Test Instructions                                                                                                                                                                                                                                          |
| ------------------------------------------------------------------- | ---------------- | -------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Windows system-browser PKCE callback and Credential Manager custody | IDEN-01, IDEN-02 | Requires a packaged Windows build, OS browser, loopback/callback ownership, and Credential Manager inspection  | Run every enabled sign-in and recovery path on clean Windows 10/11; verify no provider password or bearer token enters the WebView, deep link, SQLite, localStorage, logs, or clipboard; revoke the session and confirm credentials clear on next contact. |
| Consent revocation clears an operator's active diagnostic view      | WEB-07           | Browser/server stream termination and rendered-data disposal require an interactive admin session              | Open a consented case in the isolated admin origin, revoke consent from the account origin, and verify the current view closes immediately, no durable URL/download/cache remains, and an immutable access/revocation event exists.                        |
| Invited staging promotion and rollback by exact build identity      | WEB-04, WEB-06   | Requires deployed Vercel origins, hosted OCI API, Neon branch, sandbox providers, and a numbered desktop build | Exercise the local → preview → internal staging → invited-alpha ladder with synthetic tester identities; force a critical gate failure and prove the exact build returns to the prior stage with evidence preserved.                                       |
| Admin screen reader, contrast, long content, touch targets, and final Variant A visual acceptance | WEB-06, WEB-07, IDEN-03 | Assistive technology output, perceived hierarchy, physical target measurement, and authored visual quality require human observation | On the exact 04-61 commit, execute the named Narrator/additional screen-reader, contrast/forced-color, PT-BR/English long-content, 200%/320px, 44×44px touch-target, keyboard/focus, reduced-motion, responsive and Briefing Focus checklists; record every row in `04-ADMIN-VISUAL-UAT.md`. |
| Published Admin invitations, governance, jobs, live degradation, incidents, configuration, privacy and emergency authority | WEB-06, WEB-07, IDEN-03 | Final hosted origin/provider/network behavior and human comprehension must supplement automated browser→API→PostgreSQL proof | At 04-40 and 04-25, exercise the complete named workflow set with preview/fixture flags false, reload persisted versions/receipts, revoke consent live, force reconnect/degradation, and fail approval on any mock response, optimistic success, missing audit, or non-persistent result. |

---

## Validation Sign-Off

- [x] Every requirement row has concrete implementation Task ID(s), plan(s), and wave(s).
- [x] Every task has an automated verify command and behavior work has an explicit prerequisite-aware Wave 0 or Wave 1 witness dependency.
- [x] Sampling continuity: no three consecutive tasks lack automated verification.
- [x] Wave 0 scaffold plus Wave 1 dependent witness plans cover every previously missing reference without same-wave prerequisites.
- [x] No watch-mode flags are used.
- [x] Every implementation plan requires a focused command and records measured latency below 30 seconds; full Playwright/recursive suites are plan/wave/phase gates.
- [x] Administrative expansion sampling covers every task in Plans 04-41–04-62, with no three consecutive behavior tasks lacking a focused automated command.
- [x] Every Admin UI plan builds its Storybook states; Plan 04-61 adds full fixture-off E2E and exact-commit manual screen-reader, contrast, long-content, touch-target, responsive, locale, motion, and Variant A review.
- [x] `validation_scaffolding_complete: true` records complete prerequisite-aware task/path planning; `wave_0_complete: false` remains honest until dependent Wave 1 RED collection executes.
- [x] `nyquist_compliant: true` records complete requirement/task/witness mapping and sampling design.

**Approval:** planner-mapped; execution evidence remains pending by design
