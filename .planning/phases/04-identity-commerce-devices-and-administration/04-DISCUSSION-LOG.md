# Phase 4: Identity, Commerce, Devices, and Administration - Discussion Log

> **Audit trail only.** Do not use as input to planning, research, or execution agents.
> Decisions are captured in CONTEXT.md — this log preserves the alternatives considered.

**Date:** 2026-08-04; administrative redesign update 2026-08-06
**Phase:** 04-identity-commerce-devices-and-administration
**Areas discussed:** Identity and recovery; commerce; device and offline entitlement; support, consent, and administration; persistence; web/desktop synchronization; non-production deployment; release readiness; administrative structure and navigation; team and permissions; invitation lifecycle; operation at scale

---

## Identity, authentication, sessions, and recovery

| Decision prompt            | Selected                                                                | Alternatives considered                                       |
| -------------------------- | ----------------------------------------------------------------------- | ------------------------------------------------------------- |
| Launch social providers    | Google + Discord                                                        | Google + Microsoft; Google + Microsoft + Discord; another set |
| Email entry                | Verified email and password                                             | Magic link only; password plus magic link                     |
| Customer MFA policy        | Optional for ordinary use, mandatory step-up for sensitive actions      | Mandatory for every Premium user; always optional             |
| Total factor-loss recovery | Verified email/recovery codes first; reviewed support recovery last     | Support-only recovery; immediate email-only reset             |
| One-PC effect on sessions  | Restrict Premium license only; allow visible revocable account sessions | One account session; account only on licensed PC              |
| Passkey enrollment         | Offer after first verified login; allow defer                           | Require during registration; offer only at Premium activation |
| Launch second factors      | Authenticator app, passkey, recovery codes                              | Email code; SMS                                               |
| Post-support-recovery hold | 24 hours by default, risk-extensible, with trusted-session notices      | Fixed 48 hours; immediate critical access                     |

**User's choice:** The recommended option was selected for all eight decisions. Microsoft was explicitly excluded from launch because its operational/cost implications were not yet understood.

**Notes:** A non-production developer identity may assume one administrative role at a time. No credential supplied during the conversation is reproduced or stored in project artifacts.

---

## Commerce and subscription lifecycle

| Decision prompt             | Selected                                                         | Alternatives considered                                      |
| --------------------------- | ---------------------------------------------------------------- | ------------------------------------------------------------ |
| Failed renewal              | Seven-day grace with retries and notices                         | Restricted three-day grace; immediate expiry                 |
| Monthly/annual change       | Annual immediately with credit; monthly at annual-cycle end      | Every change next renewal; every change immediately prorated |
| First-payment refund        | Full self-service refund for seven days                          | Support-only; refund while retaining Premium through cycle   |
| Awaiting provider authority | Explicit payment-pending state                                   | Provisional Premium; no intermediate state                   |
| Undo cancellation           | Restore future renewal before cycle end without duplicate charge | Subscribe again; support-only reactivation                   |
| Annual Pix renewal          | Manual per period with reminders                                 | Pix Automático; require card for renewal                     |
| Future price change         | Minimum 30-day notice, effective only on renewal                 | Apply published price silently; permanent grandfathering     |
| Charge dispute/fraud review | Restrict new Premium actions, preserve safety/history            | Immediate cancellation; retain full Premium during review    |

**User's choice:** The recommended option was selected for all commerce decisions.

**Notes:** Phase 3 pricing, payment methods, cancellation-through-cycle, and first-payment refund policy remain authoritative. Provider redirects never grant entitlement; reconciled provider events do.

---

## Device identity and offline Premium

| Decision prompt           | Selected                                                | Alternatives considered                                          |
| ------------------------- | ------------------------------------------------------- | ---------------------------------------------------------------- |
| Offline window conflict   | Seven days                                              | Thirty days; seven days with exceptional extension               |
| First device binding      | Explicit confirmation in desktop                        | Automatic first-login binding; web-only initiation               |
| Reinstall/hardware change | Tolerant derived identity and proportional revalidation | Motherboard always creates new PC; every change requires support |
| Transfer during cooldown  | Keep current PC; loss/theft may revoke immediately      | Always revoke and wait; schedule automatic transfer              |
| Expiry during active work | Finish session/operation and preserve restoration       | Interrupt current operation; automatic extra 24 hours            |
| Renewal after reconnect   | Silent automatic verification                           | Manual confirmation; verify only at Premium use                  |
| Clock/data contradiction  | Fail safely until online verification                   | Ignore clock; invalidate and require support                     |
| Cooldown exception        | Single-use audited 24-hour authorization                | Remove cooldown; operator directly binds PC                      |

**User's choice:** Seven days and every recommended device behavior were selected.

**Notes:** The 30-day offline statement in Phase 3 D-93 is superseded. The 30-day device-transfer cooldown remains unchanged.

---

## Support, consent, and administration

| Decision prompt              | Selected                                                                 | Alternatives considered                                          |
| ---------------------------- | ------------------------------------------------------------------------ | ---------------------------------------------------------------- |
| Support case channel         | Threaded account case plus email notifications                           | Email-only; isolated form responses                              |
| Diagnostic consent           | Per case, purpose, fields, maximum 72 hours                              | Whole-case consent; approve each view                            |
| Critical admin action        | Strong reauth, reason, impact review, confirmation, immutable audit      | Two-person approval for every action; authenticated session only |
| Cross-role handoff           | Explicit minimum-data transfer and access removal                        | All roles retain access; duplicate into new case                 |
| Consent expiry while viewing | End access immediately and discard usable temporary copies               | Finish current session; retain opened data through closure       |
| Attachment retention         | Delete within 30 days after closure                                      | Retain 90 days; retain for account lifetime                      |
| Case reopening               | 14 days; consent never renews automatically                              | Reopen indefinitely; never reopen                                |
| Break-glass                  | Redacted minimum metadata only; never diagnostic content without consent | Emergency diagnostic access; no emergency access of any kind     |

**User's choice:** The recommended option was selected for all support and administration decisions.

**Notes:** Bulk or irreversible administration remains unavailable until two-person approval exists. A solo developer role cannot bypass this boundary.

---

## Persistence and non-production authority

| Decision prompt                    | Selected                                                                                                   | Alternatives considered                                           |
| ---------------------------------- | ---------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------- |
| Developer administrative testing   | One identity assumes one audited role at a time                                                            | Simultaneous general admin; four separate test accounts           |
| Development/preview data isolation | Separate Neon branch with synthetic data                                                                   | Shared Neon database; local PostgreSQL only                       |
| Audit integrity                    | Append-only hash-linked events with external checkpoints                                                   | Append-only table only; event-source entire product               |
| Account deletion                   | Strong reauth, cancelable seven-day delay, then delete/anonymize                                           | Immediate irreversible deletion; indefinite soft delete           |
| PostgreSQL sensitive-data boundary | Hashes, public material, protected IDs, metadata, references only                                          | Encrypted copies of everything; delegate all authority externally |
| Desktop authentication             | Real system-browser PKCE in Phase 4, tokens in Credential Manager                                          | Web-only real authentication was rejected by phase boundary       |
| Environment persistence            | Neon dev/preview/staging, isolated PostgreSQL tests, future AWS production, object storage for attachments | A single database/runtime for every environment                   |

**User's choice:** The recommended option was selected for all persistence decisions.

**Notes:** The user asked for deeper persistence design. Exact schemas, cryptography, migrations, retention jobs, provider selection, and transaction/outbox design remain research/planning responsibilities.

---

## Shared truth across web and desktop

| Decision prompt               | Selected                                                            | Alternatives considered                                 |
| ----------------------------- | ------------------------------------------------------------------- | ------------------------------------------------------- |
| Data synchronization boundary | Hybrid local-first                                                  | Sync almost everything; keep desktop almost independent |
| Update timing                 | Automatic at lifecycle/action boundaries with visible pending state | Permanent realtime connection; manual refresh only      |
| Concurrent edits              | Version conflict, preserve remote value and local draft             | Last-write-wins; web-always-wins                        |
| Web revocation effect         | Sign out/remove credentials/block new Premium, preserve safety data | Remote wipe; retain session until manual logout         |

**User's choice:** The recommended option was selected for all synchronization decisions.

**Notes:** The user referenced the existing desktop “Sua conta” screen. Phase 4 must replace its fixture `.local` identity and simulated entitlement with real shared account projections while keeping technical activity and restoration local-first.

---

## Non-production deployment and invited testing

| Decision prompt           | Selected                                                             | Alternatives considered                                |
| ------------------------- | -------------------------------------------------------------------- | ------------------------------------------------------ |
| Hosted topology           | Separate Vercel frontends + containerized Fastify staging API + Neon | All-in Vercel; local-only until engine completion      |
| Local Docker requirement  | No Docker Desktop requirement; remote OCI builds                     | Eliminate containers; require Docker locally           |
| Staging enrollment        | Invitation-only, isolated tester accounts/devices                    | Open registration; shared account                      |
| Desktop test distribution | Internal numbered channel with separate manifest and rollback        | Public Beta from start; manual installer delivery only |

**User's choice:** The recommended option was selected for all environment decisions.

**Notes:** Phase 4 deploys complete non-production staging. Phase 10 owns public production AWS/Cloudflare hardening, trusted signing, Stable distribution, and launch promotion.

---

## Release-readiness ladder

| Decision prompt          | Selected                                                                 | Alternatives considered                                         |
| ------------------------ | ------------------------------------------------------------------------ | --------------------------------------------------------------- |
| Promotion sequence       | Local → CI/preview → staging → invited alpha → frozen RC → production    | Test only after all phases; continuous public beta              |
| Production approval      | Owner approves complete evidence bundle; critical gates cannot be waived | CI auto-deploy; informal manual approval                        |
| Real-PC sufficiency      | Coverage matrix by Windows, hardware, form factor, and journey           | Raw tester count; available friends' PCs only                   |
| Permitted launch defects | Documented minor/non-material only                                       | Zero known defects of any severity; ship important known issues |

**User's choice:** The recommended option was selected for all release-readiness decisions.

**Notes:** “Perfect” was translated into an enforceable standard: no known critical gaps and every declared release contract proven, without making an impossible zero-bug promise.

---

## The agent's Discretion

- Authentication framework approval after the mandatory security spike.
- Payment, email, object-storage, and temporary container-host providers.
- Exact schemas, transaction/outbox mechanics, cryptographic derivations, key management, sync transport, and audit checkpoint cadence.
- Invitation technical schemas and provider mechanics within the later locked product lifecycle; synthetic seed data, CI builder, test matrix instances, and evidence-bundle format.

## Deferred Ideas

- Add Microsoft as a social provider after the initial authentication set is stable.
- Connect real hardware intelligence and the optimization engine in Phases 5–8.
- Complete AI/support-package authority in Phase 9.
- Promote to trusted public production, signing, Cloudflare/AWS operations, and Stable release in Phase 10.

---

# Administrative Redesign Update — 2026-08-06

The owner requested a complete, production-grade, scalable Admin redesign plus real invitation management. Existing identity, Stripe, account, desktop, and authority boundaries remain in scope and must not regress. The recommended option was selected for every decision below.

## Administrative structure and navigation

| Decision prompt          | Selected                                                                 | Alternatives considered                                 |
| ------------------------ | ------------------------------------------------------------------------ | ------------------------------------------------------- |
| Primary navigation model | Business domains plus operational work queue                             | Domains only; queue only                                |
| Sidebar growth           | Stable structure filtered by permission                                  | Different sidebar per role; freely personalized sidebar |
| Overview priority        | Operational priorities, then real business context                       | Queue only; KPIs/charts first                           |
| Record workspace         | List plus inspector; full route for complex/mobile                       | Always full route; modals                               |
| Domain groups            | Visão geral, Pessoas, Receita, Operação, Atendimento, Segurança, Sistema | Flat list; internal teams                               |
| Global discovery         | Universal search plus command center, server-authorized                  | Records only; per-page search                           |
| Repeated filters         | Official and personal saved views; later publishable team views          | Fixed filters only; fully custom dashboards             |
| Alerts                   | Persistent actionable inbox                                              | Temporary toasts; module queues only                    |
| Responsive navigation    | Expanded, compact, and true mobile drawer with persistence               | Always expanded; always compact                         |
| Data density             | Comfortable and compact, both accessible                                 | Comfortable only; compact only                          |
| Shareable route state    | Safe state and opaque IDs in URL; sensitive data excluded                | Memory only; profile only                               |
| Keyboard operation       | Complete keyboard support and safe shortcuts                             | Basic accessibility; direct critical shortcuts          |

**User's choice:** Every recommended navigation decision was selected.

**Notes:** The owner explicitly asked whether the visual was already perfect. It is not approved. The next required gate is a dedicated UI-SPEC and reviewed desktop/tablet/mobile compositions before implementation. The existing visual must not be represented as final.

---

## Administrative team and permissions

| Decision prompt          | Selected                                                                                     | Alternatives considered                            |
| ------------------------ | -------------------------------------------------------------------------------------------- | -------------------------------------------------- |
| Administrator enrollment | Separate scoped invite, own verified identity, passkey/MFA                                   | Promote ordinary account; shared credential        |
| Permission model         | Functions plus capabilities and scopes                                                       | Fixed roles only; free-form individual permissions |
| Multiple functions       | One active function per session                                                              | Sum all privileges; separate account per function  |
| Risk approvals           | Routine audit; sensitive reauth; critical independent approval; mass/irreversible two-person | Reauth every mutation; visual confirmation only    |
| Solo critical operation  | Controlled break-glass without standing super-admin                                          | Block all critical actions; ordinary self-approval |
| Temporary coverage       | Scoped time-bound delegation with automatic expiry                                           | Permanent added function; no coverage              |
| Offboarding/compromise   | Revoke access, sessions, delegations, approvals; reassign work                               | Login-only suspension; scheduled deactivation only |
| Access review            | Continuous deviation alerts; monthly critical and quarterly general recertification          | Quarterly only; change-triggered only              |
| Critical approver        | Eligible independent person with compatible scope                                            | Any administrator; Security only                   |
| Permission-change impact | Full diff and clearly read-only role simulation                                              | Summary only; direct application                   |
| Inactive administrators  | Risk-based warning and automatic suspension at 45/90 days                                    | Single 90-day limit; manual only                   |
| Audit visibility         | Own history plus scoped Security/Audit access; masked reveal by reason                       | Everyone sees all; Security only                   |

**User's choice:** Every recommended team and permission decision was selected.

**Notes:** Break-glass covers eligible critical action during the initial solo period but does not override the existing prohibition on solo irreversible or mass action. No super-admin is introduced.

---

## Private-beta invitation lifecycle

| Decision prompt               | Selected                                                                    | Alternatives considered                           |
| ----------------------------- | --------------------------------------------------------------------------- | ------------------------------------------------- |
| Creation                      | Recipient-bound individual/batch/CSV with campaign and preflight            | One-by-one only; generic links                    |
| Recipient experience          | One guided branded acceptance flow through app opening/download             | Generic signup then validate; pre-created account |
| Re-send                       | Rotate secret, invalidate prior link, audit, rate-limit                     | Reuse link; manually revoke and recreate          |
| Wrong/bounced/expired/revoked | Close immutable record, free slot, create corrected replacement             | Edit recipient; retain occupied slot              |
| Forwarded link                | Require invited-email possession and preserve privacy                       | Change recipient email; silent dead end           |
| Interrupted enrollment        | Resume safe progress; short-lived checks expire; consume only at completion | Always restart; consume at first step             |
| Timeline                      | Operational delivery/lifecycle events without invasive tracking             | Opens/location/fingerprint; pending/accepted only |
| Batch actions                 | Preview, risk approval, durable progress, partial failures, receipt         | Simple confirmation; no batch actions             |
| Accepted invitation           | Historical only; account restriction is separate                            | Revoke account too; delete both                   |
| 25 active limit               | Visible pausible queue promotes eligible recipients as slots free           | Block drafting; exceed temporarily                |
| Reminders                     | At most two localized reminders with decline and stop conditions            | Manual only; frequent reminders                   |
| Closed-data retention         | Purpose-bound retention then deletion/pseudonymization                      | Retain forever; erase immediately                 |

**User's choice:** Every recommended invitation decision was selected.

**Notes:** The three-email technical provisioner is not the product limit. The final Admin supports an unlimited historical population with at most 25 active invitations at once and only one active invitation per email. Administrative invitations remain a separate capability. Affiliates are deferred to a future Revenue/Growth phase.

---

## Operation at scale

| Decision prompt        | Selected                                                                                       | Alternatives considered                                    |
| ---------------------- | ---------------------------------------------------------------------------------------------- | ---------------------------------------------------------- |
| Long work              | Durable asynchronous job center with idempotency and receipts                                  | Block current screen; silent background processing         |
| Live changes           | Live updates with connection/freshness status and manual fallback                              | Fixed polling; manual refresh only                         |
| Concurrent edits       | Version conflict detection, merge independent changes, preserve draft                          | Last-write-wins; exclusive lock                            |
| Partial outage         | Capability-specific safe degradation and fail-closed mutations                                 | Block whole Admin; continue optimistically                 |
| Audit record           | Immutable verifiable events with full context and no secrets                                   | Editable history; technical logs only                      |
| Abuse defense          | Risk-adaptive limits, step-up, temporary block, alert, audited override                        | One global limit; monitor only                             |
| Incidents              | Integrated incident workspace through review/follow-up                                         | Independent alerts; external tool only                     |
| Recovery               | Versioned, previewable, rehearsable, approved, idempotent procedures                           | Free-form commands; external technical intervention only   |
| Sensitive exports      | Purpose, minimum scope, preview, masking, encryption, expiry, audit                            | Direct table download; aggregate-only reports              |
| Product configuration  | Drafted, validated, approved, versioned, gradual, reversible publication                       | Save immediately; deploy-only configuration                |
| Capacity               | Current use, growth, forecast, safe limits, early actionable warnings                          | Alert at exhaustion; raw metrics only                      |
| Environment separation | Isolated and visually unmistakable data/sessions/permissions/integrations                      | Environment selector in one session; production-only Admin |
| Work ownership         | Responsible person, substitute, priority, deadline, escalation, handoff context                | Shared queue only; rigid automatic assignment              |
| Off-app alerts         | Severity-based verified channels, acknowledgement, substitute escalation, no sensitive payload | Email only; in-Admin only                                  |
| Privacy requests       | Verified end-to-end case with legal basis, retention, execution, receipt                       | Manual checklist; unreviewed automation                    |
| Emergency stop         | Scoped time-bound control with strong auth, reason, review, safe restoration                   | Stop whole service; wait for deploy                        |

**User's choice:** Every recommended scale and governance decision was selected.

**Notes:** Phase 4 implements and validates the Admin application behavior against non-production authority. Phase 10 still activates public production infrastructure, telemetry backends, external on-call integrations, and launch operations.

## Administrative update — the agent's discretion

- Exact schemas, indexes, queue/job implementation, event transport, retention windows justified by purpose/law, and external providers.
- Exact spacing, typography families, token values, responsive breakpoints, motion timings, and compositions only after the UI-SPEC and owner approval, while respecting `PRODUCT.md` and `DESIGN.md`.

## Administrative update — deferred ideas

- Affiliate management as a separate Revenue/Growth capability, never a reuse of private-beta invitations.
