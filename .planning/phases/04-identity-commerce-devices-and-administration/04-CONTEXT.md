# Phase 4: Identity, Commerce, Devices, and Administration - Context

**Gathered:** 2026-08-04
**Status:** Ready for planning

<domain>

## Phase Boundary

Deliver the real non-production control plane that replaces Phase 3's deterministic no-change previews: secure identity shared by web and desktop, subscription and invoice authority, one-PC Premium licensing, seven-day signed offline entitlement, customer support, consent-bound diagnostic access, isolated role-specific administration, authoritative persistence, and end-to-end staging deployments.

Phase 4 must work across the existing account web app, isolated admin app, and Windows desktop. It deploys the complete development/preview/staging system needed for internal and invited-PC testing, but it does not launch public production infrastructure, accept real customer payments, publish a trusted Stable installer, or claim that the Phase 5–8 hardware/optimization engine is already connected. Final AWS/Cloudflare production hardening, public signing, promotion, and operations remain Phase 10 responsibilities.

</domain>

<decisions>

## Implementation Decisions

### Identity, authentication, sessions, and recovery

- **D-01:** Launch authentication methods are verified email/password, Google, Discord, and passkeys. Microsoft is not a launch provider.
- **D-02:** Email/password registration requires address verification. Passkeys are offered immediately after the first verified login and may be deferred without persistent pressure.
- **D-03:** Customer MFA is optional for ordinary use but step-up authentication is mandatory for sensitive actions such as changing security methods, transferring a PC, requesting a refund, or accessing protected data.
- **D-04:** Launch second factors are authenticator applications, passkeys, and recovery codes. SMS and email codes are not accepted as second factors.
- **D-05:** Recovery first uses verified email and recovery codes. Loss of every factor escalates to security-reviewed support recovery rather than immediate email-only takeover.
- **D-06:** Exceptional support recovery restores basic access but blocks critical actions for 24 hours by default. Risk signals may extend the hold, and already-trusted sessions are notified and may contest the recovery.
- **D-07:** The one-PC rule applies only to Premium licensing, not account access. Users may hold multiple visible, individually revocable web and desktop sessions.
- **D-08:** Administrative identity never becomes one omnipotent production super-admin. Support, Operations, Security, and Audit remain separate active roles.
- **D-09:** A non-production developer identity may assume any administrative role one at a time. Every role assumption and action is audited, and the identity may receive permanent Premium only as an explicitly non-production test grant.
- **D-10:** Phase 4 authentication is real on desktop as well as web. Desktop authentication opens the system browser, uses PKCE and a secure callback, never handles social-provider passwords, and stores account tokens in Windows Credential Manager rather than localStorage or SQLite.

### Commerce and subscription lifecycle

- **D-11:** Carry forward the Phase 3 commercial contract: Free has no trial or card requirement; Premium costs R$ 29,90 monthly or R$ 249,90 annually in PT-BR and US$ 6.99 monthly or US$ 59.99 annually in English; card supports monthly/annual and Pix supports annual.
- **D-12:** A failed recurring renewal enters a seven-day grace period with retries and clear notices. Premium expires only after the grace period ends.
- **D-13:** Monthly-to-annual migration is immediate and applies proportional credit for the unused monthly period. Annual-to-monthly migration takes effect only after the paid annual period ends.
- **D-14:** The first subscription payment has a seven-day full self-service refund window. Confirmed refund ends Premium but never removes existing changes, diagnostic history, security warnings, or restoration.
- **D-15:** Duplicate charge, fraud, or proven service-failure refund claims outside the automatic window receive prioritized review rather than an invented automatic outcome.
- **D-16:** Checkout return pages never activate Premium. Until an authoritative provider event is reconciled, the account shows a truthful payment-pending state and refreshes automatically.
- **D-17:** Delayed, duplicated, replayed, or reordered payment events cannot duplicate charges, invoices, subscriptions, or entitlements.
- **D-18:** Cancellation preserves Premium through the already-paid cycle. The user may undo cancellation before that date without being charged again for the same period.
- **D-19:** Annual Pix renewal is manual. Each new period requires a fresh authorized payment, preceded by reminders; there is no silent Pix renewal at launch.
- **D-20:** Price changes require at least 30 days' notice and apply only at renewal. Already-paid periods never change price.
- **D-21:** A charge dispute or fraud review restricts new Premium actions during investigation but preserves existing changes, local history, warnings, and restoration.

### Device identity, transfer, and offline Premium

- **D-22:** The authoritative offline Premium window is seven days. This explicitly supersedes Phase 3 D-93's 30-day statement and aligns with IDEN-06 and the Phase 4 success criteria.
- **D-23:** First-PC activation is explicitly confirmed inside the desktop app after showing a friendly device name, protected identity, and the consequences of consuming the one-PC entitlement. The web account reflects the same device.
- **D-24:** Device identity is privacy-preserving and tolerant. Raw serials/HWID are never stored; reinstallations and minor upgrades do not consume a transfer.
- **D-25:** A substantial hardware change opens an explainable revalidation instead of silently granting or permanently blocking a new device.
- **D-26:** An ordinary transfer before the 30-day cooldown ends leaves the current PC active and shows the eligibility date. It must not strand the user without a licensed PC.
- **D-27:** Loss or theft permits immediate revocation. A replacement still waits for eligibility unless support grants a security-reviewed exception.
- **D-28:** A support exception is a single-use, audited authorization valid for 24 hours after strong reauthentication and review. The user, not the operator, confirms the replacement binding; the former PC is revoked as part of replacement.
- **D-29:** Offline expiry never interrupts an active game, in-progress Premium operation, or required restoration. It blocks the next Premium action or session.
- **D-30:** The signed offline authorization renews automatically when connectivity returns. Normal renewal is silent; the product surfaces only approaching expiry, contradiction, or required action.
- **D-31:** Clock rollback, corrupted entitlement data, or contradictory evidence fails safely: new Premium actions stop until online verification, without accusing the user of fraud and without blocking safety functions.

### Support, diagnostic consent, and administration

- **D-32:** A support request is a threaded case inside the account with status, priority, history, consented attachments, and expected response. Email is a notification channel, not the authoritative case record.
- **D-33:** Carry forward the public support contract: Free receives documentation/community/email with response within 72 business hours; Premium receives an initial response within 24 business hours; billing, security, and restoration incidents remain prioritized regardless of plan.
- **D-34:** Diagnostic consent is scoped to one case, one stated purpose, and explicit field classes for at most 72 hours. The user may revoke at any time.
- **D-35:** Consent expiry or revocation ends access immediately, including an operator's current view, and discards usable temporary copies. Continuing requires fresh consent.
- **D-36:** Revocation does not erase the immutable record of what was already accessed, by whom, for what purpose, and under which consent.
- **D-37:** Critical administrative actions require recent passkey/MFA reauthentication, mandatory reason, impact review, explicit confirmation, and an immutable event.
- **D-38:** Bulk or irreversible administrative actions remain unavailable until two-person approval can be enforced. A solo developer cannot bypass this through a general-admin role.
- **D-39:** Cross-role case handoff is explicit and justified. Only the minimum necessary data moves to the new role, and access that is no longer justified is removed.
- **D-40:** Support attachments and diagnostic packages are removed no later than 30 days after case closure. Only the minimum receipt, consent, checksum, and required audit evidence remain.
- **D-41:** A closed case may be reopened for 14 days, but old diagnostic consent never reactivates. Later contact creates a related new case.
- **D-42:** Break-glass access never exposes user-provided diagnostic content without valid consent. Emergency containment may reveal only minimum redacted metadata under strong authentication, short expiry, reason, alerting, and immutable audit.

### Persistence, minimization, and audit integrity

- **D-43:** PostgreSQL is authoritative for identity, sessions, subscriptions, invoices, entitlements, device bindings, support metadata, consent, and audit indexes. Cache is never authority.
- **D-44:** Neon supplies isolated development, preview, and staging PostgreSQL branches populated only with synthetic/non-production data. Production data is never cloned into these environments.
- **D-45:** Local and CI integration tests may use isolated PostgreSQL/Testcontainers. Docker Desktop is not required for ordinary local development; Node runs the API directly against Neon when desired.
- **D-46:** Administrative and security audit events are append-only. Application credentials cannot update or delete them; corrections append new events.
- **D-47:** Audit events form a verifiable chain and periodically anchor checkpoints in separate object storage so privileged database alteration becomes detectable. This does not require event-sourcing the entire product.
- **D-48:** Account deletion uses strong reauthentication and a cancelable seven-day pending period. Afterward, ordinary profile, session, consent, and support content is deleted or anonymized.
- **D-49:** Legally necessary billing, antifraud, security, and audit records may remain only in minimized form, for a documented purpose and bounded retention period.
- **D-50:** PostgreSQL stores only necessary password hashes, passkey public material, provider identifiers, protected device derivations, billing metadata, and object references. It never stores reversible passwords, full card details, raw desktop tokens, raw hardware serials, or diagnostic files as table payloads.
- **D-51:** Support attachments live in object storage with independent encryption, access, and deletion controls; PostgreSQL retains only authoritative metadata, consent, checksums, and lifecycle state.

### Shared account truth across web and desktop

- **D-52:** Use a hybrid local-first model. Identity, plan, security methods, sessions, billing, support state, and linked-device truth synchronize; technical PC activity, unshared diagnostics, operational history, and restoration remain local by default.
- **D-53:** The existing desktop account page must replace local fixture identity, `.local` email, simulated Premium, and local-only device authority with real authenticated account projections and explicit online/offline/stale states.
- **D-54:** Desktop synchronizes at launch, resume, reconnection, and after relevant mutations. Unconfirmed changes render as pending and never as successful authority.
- **D-55:** Concurrent shared-data edits use version-aware conflict detection. Stale writes are rejected, both the remote value and local draft are preserved, and the user reviews before resubmission; silent last-write-wins is forbidden.
- **D-56:** Web revocation signs the desktop out on its next contact, removes account credentials, and blocks new Premium actions while preserving local warnings, history, and restoration. A fully offline device cannot receive remote revocation before reconnecting; its signed authorization still expires within seven days.

### Non-production deployment and invited testing

- **D-57:** Phase 4 deploys all non-production services required for real end-to-end validation: public web, account, and admin as separate Vercel projects/origins; a remotely hosted Fastify staging API; isolated Neon databases; sandbox auth, email, payment/webhook, and object-storage integrations; and desktop staging configuration.
- **D-58:** The Fastify API remains a container-compatible service so the same OCI artifact can later run on ECS/Fargate. It must not be reshaped into a throwaway Vercel-only serverless backend.
- **D-59:** Ordinary local development runs the API directly through Node/pnpm and Neon. CI or the hosting platform builds the OCI image remotely; Docker Desktop remains optional for the maintainer and unnecessary for PC testers.
- **D-60:** Staging account creation is invitation-only. Every friend/tester receives an isolated identity, device, and dataset; shared accounts and public registration are forbidden.
- **D-61:** Pre-production desktop builds use an internal numbered channel with restricted access, a separate manifest, change notes, exact build identity, and rollback. They are never labeled Stable or a public Beta.
- **D-62:** A custom domain is not required for the earliest previews, but stable owned domains and callback/email identities must be in place before a broader closed beta. Provider URLs may be used only for bounded early testing.
- **D-63:** Phase 4 does not accept real customer money, operate the production AWS database, expose public signup, publish a trusted installer, or claim public release readiness. Those production authorities remain gated for Phase 10.

### Release-readiness ladder

- **D-64:** Validation runs continuously per phase and again across the integrated product. The promotion ladder is local → CI/preview → internal staging → invited friend alpha → frozen release candidate → production.
- **D-65:** Any critical failure returns the exact build to an earlier stage. A passing later test cannot erase a failed security, privacy, billing, device, data, recovery, signing, accessibility, compatibility, or update gate.
- **D-66:** Production promotion requires an immutable evidence bundle and explicit owner approval after all automated gates pass. The owner cannot waive a critical gate; external legal/security review is required where the risk demands it.
- **D-67:** Real-PC sufficiency is measured by a coverage matrix, not a raw tester count: supported Windows 10/11 states; Intel/AMD CPUs; NVIDIA/AMD/Intel GPUs; notebook/desktop; relevant storage/network classes; clean install, upgrade, offline, failure, restoration, rollback, and uninstall journeys.
- **D-68:** Launch may carry only documented minor defects with no material impact. No known issue may remain in security, privacy, billing, licensing, data integrity, restoration, signing, updates, essential accessibility, or declared compatibility.

### The agent's Discretion

- Select the final authentication framework only after the Better Auth native OAuth 2.1/PKCE, passkey, MFA, recovery, session-revocation, and abuse-resistance spike passes. Preserve the locked customer behavior regardless of library.
- Select the payment provider, email provider, object-storage service, and temporary container host through security, regional coverage, sandbox quality, cost, and migration-fit research. Do not change the locked commercial or authority behavior.
- Design exact schemas, constraints, transaction boundaries, outbox/inbox processing, idempotency keys, retry schedules, device-derivation cryptography, encryption/key management, audit checkpoint cadence, and retention jobs.
- Choose the precise desktop callback mechanism, token rotation details, sync transport, cache invalidation, and polling strategy while preserving system-browser PKCE, credential-manager storage, truthful pending states, and seven-day offline semantics.
- Define the exact invite mechanism, test data seeds, CI container builder, staging host, Vercel project configuration, and evidence-bundle format within the deployment boundary above.

</decisions>

<canonical_refs>

## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Product and phase contract

- `.planning/ROADMAP.md` — Phase 4 goal, dependency, assigned requirements, success criteria, and production-phase boundary.
- `.planning/REQUIREMENTS.md` — authoritative WEB-04–07 and IDEN-01–09 requirements, including the locked seven-day offline window.
- `.planning/PROJECT.md` — core value, business model, one-PC policy, trust constraints, privacy, cost, accessibility, and production quality gates.
- `.planning/research/STACK.md` — approved runtime, identity candidate, PostgreSQL/Neon/AWS topology, Fastify deployment model, testing stack, and mandatory spikes.

### Upstream UX and authority boundaries

- `.planning/phases/03-complete-web-experience/03-CONTEXT.md` — final account/admin UX, pricing, support, privacy, route, and Phase 4 authority handoff. Its D-93 30-day offline statement is superseded by this context's D-22.
- `.planning/phases/02-complete-desktop-experience/02-CONTEXT.md` — desktop truth boundary, account preview behavior, local-first consent, scenario receipts, and future-authority seams.

### Contracts and architecture

- `packages/contracts-source/src/web.tsp` — current Phase 3 web contracts, including FutureAuthorityCommand, NoChangeReceipt, and simulated AdminAuditEvent models that Phase 4 must evolve without duplicating DTOs.
- `architecture/decisions/0002-contract-versioning-and-compatibility.md` — contract evolution and compatibility rules for new identity/commerce/device/admin transports.
- `architecture/decisions/0003-module-ownership-and-direction.md` — module ownership and dependency direction for API, adapters, web compositions, and desktop integration.
- `architecture/decisions/0004-truth-provenance-and-fixture-boundary.md` — fixture/production separation that must remain enforceable while preview adapters are replaced by real authority.
- `architecture/decisions/0005-cross-cutting-acceptance-policy.md` — mandatory security, privacy, accessibility, performance, and recovery evidence dimensions.
- `architecture/module-boundaries.json` — executable module roots, layers, runtime classes, and dependency policy; account/admin currently remain fixture compositions and must gain production authority without forbidden coupling.

</canonical_refs>

<code_context>

## Existing Code Insights

### Reusable Assets

- `apps/account/src/account-preview-model.ts`: canonical account routes, Essential/Premium scenarios, device/security projections, and contradiction guards that define the existing UI seam.
- `apps/account/src/features/account-preview.tsx`: complete bilingual account journeys for onboarding, profile, security, subscription, invoices, device, privacy, and support that should be connected to real ports rather than redesigned from scratch.
- `apps/admin/src/admin-preview-model.ts`: role-to-route access, operational queues, consent-aware diagnostic cases, redacted targets, audit identities, and safe URL-state admission.
- `packages/web-features/src/preview-machine.ts`: XState review, validation, reauthentication, confirmation, cancellation, stale/offline/failure, and receipt workflow ready to receive production adapters after its Phase 3 no-change contract is evolved.
- `apps/desktop/src/features/account-experience.tsx` and `packages/feature-shell/src/features/account-settings.tsx`: existing desktop account/profile/plan/device/security surfaces and local-first behavior to project real shared account state into.
- `packages/contracts-ts/src/index.ts` and `packages/contracts-rust/src/lib.rs`: generated transport and validation roots; Phase 4 must extend TypeSpec and regenerate rather than add handwritten cross-boundary DTOs.

### Established Patterns

- Public, account, and admin have independent origins, shells, CSP/cookie policies, and deployable compositions.
- Fixture authority is structurally distinct from production authority, with explicit provenance, contradiction detection, and deterministic no-change receipts.
- Sensitive workflows already use typed state machines with review, reauthentication, confirmation, retry, cancellation, and degraded states.
- PT-BR/English parity, React Aria behavior, WCAG 2.2 AA, safe drafts, explicit UTC handling, redacted admin targets, and complete responsive states are established release contracts.
- Architecture and cross-cutting acceptance are executable policies, not optional review prose.

### Integration Points

- Extend `packages/contracts-source/src/web.tsp` with versioned identity, session, factor, subscription, invoice, payment-event, entitlement, device, consent, support, and production audit contracts.
- Add application/domain/adapter boundaries for the Fastify control plane and providers, then activate production runtime classes for account/admin without importing provider SDKs into UI compositions.
- Replace Phase 3 future-authority/no-change adapters behind existing account/admin workflow seams; preserve preview adapters for Storybook, visual tests, and deterministic E2E only.
- Connect the desktop through a system-browser PKCE client, secure token storage, generated contracts, version-aware sync, and signed offline entitlement verification.
- Deploy the existing `apps/web`, `apps/account`, and `apps/admin` compositions separately to Vercel staging and route them to the same versioned Fastify API authority.
- Introduce PostgreSQL migrations, transactional repositories, provider inbox/outbox reconciliation, append-only audit, consent/retention jobs, object-storage lifecycle enforcement, and isolated Neon branch automation.

</code_context>

<specifics>

## Specific Ideas

- The existing desktop “Sua conta” page is the target location for real identity projection: local fixture name/email, simulated Premium, and local device identifiers should become authenticated shared state without erasing local-first activity and restoration.
- A single developer test identity should make every role testable through explicit audited role assumption, never through simultaneous unrestricted authority.
- Friends test installed desktop builds against invitation-only staging using their own isolated accounts and linked PCs; they never share the maintainer identity.
- The product should feel complete before public launch through evidence and staged promotion, while remaining honest that zero bugs cannot be promised and minor non-material defects may be documented.

</specifics>

<deferred>

## Deferred Ideas

- Microsoft as an additional social authentication provider — reconsider after the initial Google + Discord launch set is stable.
- Real hardware intelligence, measurement, privileged optimization, recovery execution, game automation, and advisory AI — Phases 5–9 connect these capabilities to the Phase 4 control plane.
- Public production AWS/Cloudflare infrastructure, trusted Authenticode/SmartScreen distribution, public Stable/Beta channels, production observability/incident operations, and final launch promotion — Phase 10.

</deferred>

---

*Phase: 04-identity-commerce-devices-and-administration*
*Context gathered: 2026-08-04*
