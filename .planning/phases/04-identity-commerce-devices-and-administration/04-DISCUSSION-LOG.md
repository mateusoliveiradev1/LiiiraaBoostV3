# Phase 4: Identity, Commerce, Devices, and Administration - Discussion Log

> **Audit trail only.** Do not use as input to planning, research, or execution agents.
> Decisions are captured in CONTEXT.md — this log preserves the alternatives considered.

**Date:** 2026-08-04
**Phase:** 04-identity-commerce-devices-and-administration
**Areas discussed:** Identity and recovery; commerce; device and offline entitlement; support, consent, and administration; persistence; web/desktop synchronization; non-production deployment; release readiness

---

## Identity, authentication, sessions, and recovery

| Decision prompt | Selected | Alternatives considered |
|---|---|---|
| Launch social providers | Google + Discord | Google + Microsoft; Google + Microsoft + Discord; another set |
| Email entry | Verified email and password | Magic link only; password plus magic link |
| Customer MFA policy | Optional for ordinary use, mandatory step-up for sensitive actions | Mandatory for every Premium user; always optional |
| Total factor-loss recovery | Verified email/recovery codes first; reviewed support recovery last | Support-only recovery; immediate email-only reset |
| One-PC effect on sessions | Restrict Premium license only; allow visible revocable account sessions | One account session; account only on licensed PC |
| Passkey enrollment | Offer after first verified login; allow defer | Require during registration; offer only at Premium activation |
| Launch second factors | Authenticator app, passkey, recovery codes | Email code; SMS |
| Post-support-recovery hold | 24 hours by default, risk-extensible, with trusted-session notices | Fixed 48 hours; immediate critical access |

**User's choice:** The recommended option was selected for all eight decisions. Microsoft was explicitly excluded from launch because its operational/cost implications were not yet understood.

**Notes:** A non-production developer identity may assume one administrative role at a time. No credential supplied during the conversation is reproduced or stored in project artifacts.

---

## Commerce and subscription lifecycle

| Decision prompt | Selected | Alternatives considered |
|---|---|---|
| Failed renewal | Seven-day grace with retries and notices | Restricted three-day grace; immediate expiry |
| Monthly/annual change | Annual immediately with credit; monthly at annual-cycle end | Every change next renewal; every change immediately prorated |
| First-payment refund | Full self-service refund for seven days | Support-only; refund while retaining Premium through cycle |
| Awaiting provider authority | Explicit payment-pending state | Provisional Premium; no intermediate state |
| Undo cancellation | Restore future renewal before cycle end without duplicate charge | Subscribe again; support-only reactivation |
| Annual Pix renewal | Manual per period with reminders | Pix Automático; require card for renewal |
| Future price change | Minimum 30-day notice, effective only on renewal | Apply published price silently; permanent grandfathering |
| Charge dispute/fraud review | Restrict new Premium actions, preserve safety/history | Immediate cancellation; retain full Premium during review |

**User's choice:** The recommended option was selected for all commerce decisions.

**Notes:** Phase 3 pricing, payment methods, cancellation-through-cycle, and first-payment refund policy remain authoritative. Provider redirects never grant entitlement; reconciled provider events do.

---

## Device identity and offline Premium

| Decision prompt | Selected | Alternatives considered |
|---|---|---|
| Offline window conflict | Seven days | Thirty days; seven days with exceptional extension |
| First device binding | Explicit confirmation in desktop | Automatic first-login binding; web-only initiation |
| Reinstall/hardware change | Tolerant derived identity and proportional revalidation | Motherboard always creates new PC; every change requires support |
| Transfer during cooldown | Keep current PC; loss/theft may revoke immediately | Always revoke and wait; schedule automatic transfer |
| Expiry during active work | Finish session/operation and preserve restoration | Interrupt current operation; automatic extra 24 hours |
| Renewal after reconnect | Silent automatic verification | Manual confirmation; verify only at Premium use |
| Clock/data contradiction | Fail safely until online verification | Ignore clock; invalidate and require support |
| Cooldown exception | Single-use audited 24-hour authorization | Remove cooldown; operator directly binds PC |

**User's choice:** Seven days and every recommended device behavior were selected.

**Notes:** The 30-day offline statement in Phase 3 D-93 is superseded. The 30-day device-transfer cooldown remains unchanged.

---

## Support, consent, and administration

| Decision prompt | Selected | Alternatives considered |
|---|---|---|
| Support case channel | Threaded account case plus email notifications | Email-only; isolated form responses |
| Diagnostic consent | Per case, purpose, fields, maximum 72 hours | Whole-case consent; approve each view |
| Critical admin action | Strong reauth, reason, impact review, confirmation, immutable audit | Two-person approval for every action; authenticated session only |
| Cross-role handoff | Explicit minimum-data transfer and access removal | All roles retain access; duplicate into new case |
| Consent expiry while viewing | End access immediately and discard usable temporary copies | Finish current session; retain opened data through closure |
| Attachment retention | Delete within 30 days after closure | Retain 90 days; retain for account lifetime |
| Case reopening | 14 days; consent never renews automatically | Reopen indefinitely; never reopen |
| Break-glass | Redacted minimum metadata only; never diagnostic content without consent | Emergency diagnostic access; no emergency access of any kind |

**User's choice:** The recommended option was selected for all support and administration decisions.

**Notes:** Bulk or irreversible administration remains unavailable until two-person approval exists. A solo developer role cannot bypass this boundary.

---

## Persistence and non-production authority

| Decision prompt | Selected | Alternatives considered |
|---|---|---|
| Developer administrative testing | One identity assumes one audited role at a time | Simultaneous general admin; four separate test accounts |
| Development/preview data isolation | Separate Neon branch with synthetic data | Shared Neon database; local PostgreSQL only |
| Audit integrity | Append-only hash-linked events with external checkpoints | Append-only table only; event-source entire product |
| Account deletion | Strong reauth, cancelable seven-day delay, then delete/anonymize | Immediate irreversible deletion; indefinite soft delete |
| PostgreSQL sensitive-data boundary | Hashes, public material, protected IDs, metadata, references only | Encrypted copies of everything; delegate all authority externally |
| Desktop authentication | Real system-browser PKCE in Phase 4, tokens in Credential Manager | Web-only real authentication was rejected by phase boundary |
| Environment persistence | Neon dev/preview/staging, isolated PostgreSQL tests, future AWS production, object storage for attachments | A single database/runtime for every environment |

**User's choice:** The recommended option was selected for all persistence decisions.

**Notes:** The user asked for deeper persistence design. Exact schemas, cryptography, migrations, retention jobs, provider selection, and transaction/outbox design remain research/planning responsibilities.

---

## Shared truth across web and desktop

| Decision prompt | Selected | Alternatives considered |
|---|---|---|
| Data synchronization boundary | Hybrid local-first | Sync almost everything; keep desktop almost independent |
| Update timing | Automatic at lifecycle/action boundaries with visible pending state | Permanent realtime connection; manual refresh only |
| Concurrent edits | Version conflict, preserve remote value and local draft | Last-write-wins; web-always-wins |
| Web revocation effect | Sign out/remove credentials/block new Premium, preserve safety data | Remote wipe; retain session until manual logout |

**User's choice:** The recommended option was selected for all synchronization decisions.

**Notes:** The user referenced the existing desktop “Sua conta” screen. Phase 4 must replace its fixture `.local` identity and simulated entitlement with real shared account projections while keeping technical activity and restoration local-first.

---

## Non-production deployment and invited testing

| Decision prompt | Selected | Alternatives considered |
|---|---|---|
| Hosted topology | Separate Vercel frontends + containerized Fastify staging API + Neon | All-in Vercel; local-only until engine completion |
| Local Docker requirement | No Docker Desktop requirement; remote OCI builds | Eliminate containers; require Docker locally |
| Staging enrollment | Invitation-only, isolated tester accounts/devices | Open registration; shared account |
| Desktop test distribution | Internal numbered channel with separate manifest and rollback | Public Beta from start; manual installer delivery only |

**User's choice:** The recommended option was selected for all environment decisions.

**Notes:** Phase 4 deploys complete non-production staging. Phase 10 owns public production AWS/Cloudflare hardening, trusted signing, Stable distribution, and launch promotion.

---

## Release-readiness ladder

| Decision prompt | Selected | Alternatives considered |
|---|---|---|
| Promotion sequence | Local → CI/preview → staging → invited alpha → frozen RC → production | Test only after all phases; continuous public beta |
| Production approval | Owner approves complete evidence bundle; critical gates cannot be waived | CI auto-deploy; informal manual approval |
| Real-PC sufficiency | Coverage matrix by Windows, hardware, form factor, and journey | Raw tester count; available friends' PCs only |
| Permitted launch defects | Documented minor/non-material only | Zero known defects of any severity; ship important known issues |

**User's choice:** The recommended option was selected for all release-readiness decisions.

**Notes:** “Perfect” was translated into an enforceable standard: no known critical gaps and every declared release contract proven, without making an impossible zero-bug promise.

---

## The agent's Discretion

- Authentication framework approval after the mandatory security spike.
- Payment, email, object-storage, and temporary container-host providers.
- Exact schemas, transaction/outbox mechanics, cryptographic derivations, key management, sync transport, and audit checkpoint cadence.
- Exact invite implementation, synthetic seed data, CI builder, test matrix instances, and evidence-bundle format.

## Deferred Ideas

- Add Microsoft as a social provider after the initial authentication set is stable.
- Connect real hardware intelligence and the optimization engine in Phases 5–8.
- Complete AI/support-package authority in Phase 9.
- Promote to trusted public production, signing, Cloudflare/AWS operations, and Stable release in Phase 10.
