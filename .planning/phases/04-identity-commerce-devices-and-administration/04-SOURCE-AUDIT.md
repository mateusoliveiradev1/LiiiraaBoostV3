# Phase 04 Multi-Source Coverage Audit

| SOURCE | ID | Feature / requirement | Plan(s) | Status | Notes |
|---|---|---|---|---|---|
| GOAL | — | Secure real subscription account and one-device license with isolated consent-bound auditable administration | 04-11–04-30 | COVERED | End-to-end authority, signed issuance, notification/lifecycle/anchor workers, clients, staging, and evidence. |
| REQ | WEB-04 | Manage profile, security, subscription, invoices, device, support | 04-13, 04-15, 04-17, 04-18, 04-20, 04-28, 04-29 | COVERED | Shared projection, notification/lifecycle execution, and web/desktop composition. |
| REQ | WEB-05 | Revoke/bind replacement after 30-day cooldown | 04-14, 04-18, 04-21 | COVERED | Transactional device authority and UI evidence. |
| REQ | WEB-06 | Isolated role-specific administration | 04-16, 04-19, 04-30 | COVERED | Server-first RBAC, isolated client, and scheduled external audit evidence. |
| REQ | WEB-07 | Time-limited diagnostic consent and immutable audit | 04-09, 04-10, 04-15, 04-16, 04-19, 04-29, 04-30 | COVERED | Continuous stream gate, deletion execution, audit receipts, and anchor scheduling. |
| REQ | IDEN-01 | Verified email/social/passkey authentication | 04-05, 04-11, 04-20 | COVERED | Terminating provider spike, API, desktop PKCE. |
| REQ | IDEN-02 | MFA and security-reviewed recovery | 04-05, 04-12, 04-20 | COVERED | Cross-method step-up/recovery/hold. |
| REQ | IDEN-03 | Strong admin authentication | 04-05, 04-12, 04-16, 04-19 | COVERED | Action-scoped step-up and receipt. |
| REQ | IDEN-04 | Exactly one active Premium PC | 04-04, 04-14 | COVERED | Lock + expected version + partial unique index. |
| REQ | IDEN-05 | Privacy-preserving device identity | 04-06, 04-14 | COVERED | Cross-runtime evidence policy and binding. |
| REQ | IDEN-06 | Seven-day cryptographic offline Premium | 04-03, 04-07, 04-21, 04-27 | COVERED | Exact-byte envelope, real API issuance/renewal/revocation, and capability gate. |
| REQ | IDEN-07 | Expiry blocks new paid actions only | 04-21 | COVERED | Start/continue/safety matrix. |
| REQ | IDEN-08 | History/warnings/restoration survive expiry | 04-21 | COVERED | Desktop E2E safety contract. |
| REQ | IDEN-09 | Idempotent provider event reconciliation | 04-08, 04-13 | COVERED | Raw signature, durable inbox, retrieval, transaction. |
| RESEARCH | R-ARCH | Fastify modular monolith with domain/application/adapter boundaries | 04-02, 04-22 | COVERED | Architecture policy plus API composition. |
| RESEARCH | R-CONTRACT | TypeSpec → OpenAPI/JSON Schema → TS/Rust with oasdiff | 04-03 | COVERED | Additive fixture-compatible contract authority. |
| RESEARCH | R-DB | PostgreSQL transactions, locks, partial indexes, migrations, inbox/outbox | 04-04, 04-08, 04-13, 04-14 | COVERED | Real PostgreSQL verification, no cache authority. |
| RESEARCH | R-ID-SPIKE | Terminating Better Auth/native PKCE/MFA/passkey/recovery/revocation/abuse spike | 04-05 | COVERED | Rejects framework if any invariant fails. |
| RESEARCH | R-DEVICE | Per-component protected evidence and tolerant revalidation | 04-06 | COVERED | Synthetic matrices and privacy threat model. |
| RESEARCH | R-OFFLINE | Exact-byte Ed25519 TS/Rust corpus | 04-07 | COVERED | Tamper/key/device/version/time/rollback cases. |
| RESEARCH | R-WEBHOOK | Raw signature, unique admission, provider reconciliation, permutations | 04-08, 04-13 | COVERED | Event delivery never grants directly. |
| RESEARCH | R-CONSENT | No-store mediated streaming with continuous revoke/expiry | 04-09, 04-15, 04-19 | COVERED | Active stream/DOM disposal and immutable receipt. |
| RESEARCH | R-AUDIT | Canonical append-only chain and external immutable anchors | 04-10, 04-30 | COVERED | Concurrent append, privilege/mutation drills, durable cadence, external write, verification, and health. |
| RESEARCH | R-ENTITLEMENT-ISSUE | Reconciled API issuance, key custody, renewal, revocation, and exact signed bytes | 04-27 | COVERED | PostgreSQL state reaches desktop PremiumAuthority through one signed envelope route. |
| RESEARCH | R-EMAIL | Email port, SES sandbox adapter, and idempotent notification handlers | 04-28 | COVERED | Recovery, commerce, invitation, and support classes have delivery evidence. |
| RESEARCH | R-PRIVACY-WORKER | S3 deletion and scheduled account/retention finalization | 04-29 | COVERED | Seven-day finalization and 30-day attachment deletion execute under retry/race tests. |
| RESEARCH | R-FIXTURE | Preserve deterministic previews while removing production fixture authority | 04-02, 04-03, 04-18, 04-19, 04-20 | COVERED | Architecture, bundle, Storybook, visual guards. |
| RESEARCH | R-DEPLOY | Neon, sandbox providers, Vercel origins, OCI/GHCR/Render, Internal desktop | 04-22, 04-23 | COVERED | Invitation-only synthetic non-production topology. |
| RESEARCH | R-VALIDATE | Wave 0 harnesses, adversarial tests, staging and immutable evidence | 04-02, 04-24, 04-25, 04-26, 04-31–04-34 | COVERED | Every requirement has a concrete Wave 0 RED witness plus manual-only, PC-matrix, and recursive gates. |
| RESEARCH | R-SC | Package legitimacy checkpoint for all SUS npm pins | 04-01, 04-04 | COVERED | Human gate immediately precedes dependency install lineage. |
| CONTEXT | D-01–D-10 | Identity/auth/session/recovery decisions | 04-05, 04-11, 04-12, 04-16, 04-20 | COVERED | Each literal ID appears in plan must-haves. |
| CONTEXT | D-11–D-21 | Commerce lifecycle decisions | 04-13 | COVERED | Exact prices, timing, pending/reconciliation and safety. |
| CONTEXT | D-22–D-31 | Device/offline Premium decisions | 04-06, 04-07, 04-14, 04-21 | COVERED | Seven-day window supersedes Phase 3. |
| CONTEXT | D-32–D-42 | Support/consent/admin decisions | 04-09, 04-15, 04-16, 04-19 | COVERED | Includes retention, handoff, break-glass, no bulk bypass. |
| CONTEXT | D-43–D-51 | Persistence/minimization/audit decisions | 04-04, 04-10, 04-15, 04-27, 04-29, 04-30 | COVERED | SQL authority, exact bounded retention, signed issuance custody, executable deletion, and scheduled anchors. |
| CONTEXT | D-52–D-56 | Shared web/desktop account truth | 04-17, 04-18, 04-20, 04-21 | COVERED | Version conflict and next-contact revocation. |
| CONTEXT | D-57–D-63 | Non-production deployment decisions | 04-22, 04-23 | COVERED | Exact exclusions remain fail-closed. |
| CONTEXT | D-64–D-68 | Release-readiness ladder | 04-24, 04-25, 04-26 | COVERED | Evidence, downgrade, PC matrix, defect policy. |

## Exclusions (not gaps)

- Microsoft launch provider: explicitly deferred.
- Real hardware/optimization/recovery execution/game automation/advisory AI: Phases 5–9.
- Production AWS/Cloudflare, trusted Authenticode/SmartScreen, public Stable/Beta, production operations and launch: Phase 10.

## Audit Result

All GOAL, REQ, required RESEARCH, and CONTEXT items are covered. No source item is missing or silently deferred.
