# Project Research Summary

**Project:** Liiiraa Boost  
**Domain:** Security-sensitive Windows gaming optimizer with a global SaaS control plane  
**Researched:** 2026-07-26  
**Confidence:** MEDIUM

## Executive Summary

Liiiraa Boost should be built as two deliberately separated systems: a local-first Windows product that remains useful and recoverable without the cloud, and a modular cloud control plane that manages identity, licensing, signed declarative profiles, releases, support, and optional AI. The desktop UI must remain unprivileged; a minimal Rust Windows service is the only privileged boundary. Every mutation must resolve to a compiled allowlisted operation, pass capability and policy checks, capture exact prior state, execute through a durable journal, verify its effect, and support compensating rollback. Neither the cloud, an administrator, a signed profile, nor AI may introduce arbitrary executable behavior.

The first delivery should be a production-quality, installable desktop experience driven by typed deterministic scenarios, followed by the web/admin experience, control-plane foundations, read-only Windows discovery, privilege and recovery foundations, and then narrowly promoted optimization families. “Visual first” does not mean pretending the optimizer already works: fixtures must carry explicit provenance, simulated execution must be unavailable in customer production mode, and no displayed metric or gain may be presented as measured user data. This gives the UI final-quality states and contracts without creating performance theatre or forcing a rewrite when real adapters arrive.

The largest risks are false or universal performance claims, irreversible Windows changes, an overpowered privileged bridge, compatibility drift, and solo-developer operational overload. Windows 10 support must be lifecycle-aware because general consumer support ended on 2025-10-14; Defender weakening must never promise permanence or bypass Tamper Protection; TypeScript must use the newest fully compatible stable toolchain rather than forcing TypeScript 7 before its lint ecosystem supports it; Better Auth remains conditional on a dedicated security spike; and the target AWS architecture should be encoded now but provisioned only as product stages justify its cost.

## Key Findings

### Recommended Stack

The recommended stack in [STACK.md](./STACK.md) is intentionally heterogeneous at trust boundaries while remaining coherent in one modular monorepo. React/Vite and Tauri 2 serve the desktop product, Rust owns Windows-sensitive work, Next.js serves separate public/account and administrative deployments, and Fastify provides a modular TypeScript control plane. TypeSpec emits OpenAPI 3.1 and JSON Schema so transport contracts, runtime validators, TypeScript clients, and Rust models derive from one source. PostgreSQL remains authoritative; SQLite holds local-first state and recovery data; Valkey is optional coordination, never truth.

**Core technologies:**

- **Tauri 2 + React/Vite:** unprivileged, lightweight desktop shell with a bespoke accessible UI.
- **Rust stable + Win32 bindings:** capability discovery, service boundary, operation engine, journal, verification, and rollback.
- **TypeScript 6.0 compatibility pin:** strict typing across JS surfaces while TypeScript 7 remains incompatible with the current `typescript-eslint` support range; upgrade only after the full gate passes.
- **TypeSpec + OpenAPI 3.1 + JSON Schema:** canonical cross-language messages with generated artifacts and runtime validation.
- **Next.js + React:** current compatible stable releases for separate web/account and admin deployments.
- **Fastify:** low-overhead modular-monolith API with explicit boundaries and schema-oriented validation.
- **PostgreSQL + Kysely:** database-enforced invariants and visible, strongly typed SQL; Neon for development/previews and AWS RDS PostgreSQL first in production.
- **AWS CDK + Cloudflare/OpenTofu:** typed target infrastructure and protected edge, provisioned progressively.
- **OpenTelemetry:** vendor-neutral logs, metrics, and traces with privacy and cardinality budgets.

The monorepo should use pnpm/Turborepo and Cargo Workspace, but those tools do not define modularity. Package exports, forbidden-import rules, Cargo visibility, schema ownership, architecture tests, and CI must enforce dependency direction. Avoid catch-all `shared`, `utils`, and global `services` packages.

### Expected Features

The feature conclusions in [FEATURES.md](./FEATURES.md) favor evidence and recovery over tweak count.

**Must — credible product foundations:**

- Capability-aware hardware, Windows, driver, launcher, game, and security inventory.
- Guided calibration, contextual home, game library, editable plans, layered explanations, and risk/compatibility status.
- Per-game profile lifecycle whether launched inside or outside the app.
- Exact change ledger, plan snapshots, partial-failure recovery, post-rollback verification, and restart-aware execution.
- Measured session monitoring, matched comparisons, data-quality status, and reproducible reports without fabricated gains.
- Complete degraded states: offline, unsupported, expired Premium, restart pending, permission denied, recovery required, and insufficient evidence.
- PT-BR and English, WCAG 2.2 AA, local-first privacy, secure updates, activity history, support consent, and strict self-overhead budgets.
- Web/account documentation, subscription, one-device management, verified downloads, support, and isolated administration.

**Should — defensible differentiation:**

- Capability graph instead of model-name recipes.
- Claim-and-evidence ledger separating fixture, observed, measured, and modeled information.
- Transactional plan execution with exact-state compensation.
- Signed official profile + local adaptation + controlled user customization.
- Goal-first navigation with component depth, not a generic hardware-card dashboard.
- Advisory AI that returns explanation or a typed proposal but has no privileged tool.
- Security and recovery continuity after subscription expiry.

**Defer until prerequisites are proven:**

- Cloud AI beyond explanation and typed proposals.
- Community sharing beyond declarative, version-compatible intent.
- Broad firmware guidance.
- Any Extreme security operation in Stable.
- Kernel drivers, BIOS/firmware mutation, injection, game-file changes, arbitrary scripts, and universal “safe tweak” bundles remain out of scope.

### Architecture Approach

The architecture in [ARCHITECTURE.md](./ARCHITECTURE.md) applies ports and adapters around stable application use cases. The deterministic simulator and future real Tauri/Rust adapter must pass the same contract suite. The privileged service receives only authenticated, versioned, bounded messages over a narrow Windows IPC boundary and resolves operation identifiers through code compiled into the installed binary. The cloud modular monolith uses module-owned PostgreSQL schemas and public APIs/events; admin never queries domain tables directly. Signed profiles prove origin, not safety, so the local service must still validate schema, revocation, engine compatibility, capabilities, policy, risk, approval, and rollback readiness.

**Major components:**

1. **Desktop UI and application layer** — goal-oriented UX, state machines, accessibility, orchestration, and typed ports without Windows mutation.
2. **Deterministic product simulator** — versioned hardware, network, entitlement, failure, reboot, and recovery scenarios with explicit fixture provenance.
3. **Minimal privileged Windows service** — caller authorization, capability checks, compiled operation registry, durable saga journal, verification, and boot recovery.
4. **Local stores and read-only adapters** — encrypted user state, machine-protected journal, game discovery, inventory, and measurement capture.
5. **Fastify modular control plane** — identity, billing, entitlements, devices, profiles, releases, support, audit, and optional AI behind module APIs.
6. **Separate Next.js surfaces** — public/account web and a separately deployed, more strongly protected admin.
7. **PostgreSQL and transactional messaging** — constraints and transactions for truth, outbox/inbox for SQS/EventBridge delivery semantics.
8. **Artifact and profile supply chain** — immutable storage, separate update/profile signing identities, revocation, cohort promotion, SBOM, and provenance.

### Critical Pitfalls and Resolutions

1. **Performance theatre** — every value must include provenance and methodology; only matched, quality-approved observations may become gain claims. Fixtures are test vectors, not user results.
2. **Universal or unsafe tweaks** — recommendations require positive capability/build/driver evidence; unknown or stale evidence fails closed. Promote operation families narrowly through Verified, Advanced, Experimental, and only later Extreme.
3. **Defender permanence and Tamper Protection** — do not promise a permanent disable or attempt bypass behavior. A future Extreme operation may request only supported, locally allowed configuration; it must detect managed/Tamper Protection states, require proportional confirmation, verify the effective result, preserve warnings and recovery, and accept that Windows or policy can restore protection.
4. **Restore theatre** — Windows restore points are supplemental. Primary recovery captures exact prior values, journals every side effect before and after execution, reverts in reverse dependency order, and verifies restored state after crashes, reboot, disk-full, and corruption scenarios.
5. **Overpowered privilege boundary** — never elevate the UI and never expose shell, arbitrary registry/file/service access, or downloaded code. Adversarial IPC tests are a release gate.
6. **Windows lifecycle and variability** — Windows 10 general consumer support has ended. Support remains build/SKU/lifecycle-aware: serviced LTSC/ESU states may qualify for specifically validated operations, while unsupported consumer builds receive a prominent lifecycle status and cannot receive “verified secure” claims. Compatibility is per operation, not a blanket product promise.
7. **Signed-but-unsafe supply chain** — separate application and profile signing; validate semantics and local eligibility after signature verification; rehearse revocation and rollback.
8. **Fragile identity and billing** — device identity uses opaque, rotatable derivation rather than raw serials; one-device and cooldown invariants live in PostgreSQL; webhook inboxes, reconciliation, PKCE, MFA, and session revocation handle retries and compromise.
9. **AI authority creep** — local minimization and consent precede cloud processing; model output remains untrusted advisory data that can only reference an existing typed catalog.
10. **Solo-developer overreach** — encode the target architecture but deliver vertical, dependency-complete phases. No Fargate, RDS, NAT gateway, Valkey, multi-account production estate, or paid observability merely to prove future scale.

## Tensions Resolved

### Windows 10 Support After End of General Support

“Windows 10 and 11 supported” becomes a capability statement, not an assurance that every Windows 10 installation is safe or eligible. Inventory must distinguish consumer EOL builds, ESU enrollment, and serviced LTSC editions. EOL consumer machines can receive transparent inventory, recovery, and operations validated for their exact build only, but the product must show the lifecycle risk and must not label the OS security posture healthy or promise future compatibility. Roadmap planning needs a lifecycle-policy spike before any Windows 10 operation reaches Verified.

### Extreme Defender Controls

The requested Extreme control is retained as a future, isolated research area, not a launch promise. Microsoft Defender and Tamper Protection can reject, revert, or centrally govern changes. Liiiraa Boost will not bypass platform protection, malware safeguards, or managed policy. If a supported operation is eventually implemented, the UI will say exactly what was requested and what state was actually observed, never “disabled forever.” Stable release requires threat modeling, legal review, recovery tests, managed-device behavior, and post-change verification.

### Modern Stack Versus TypeScript 7

“Most modern” means the newest compatible, secure stable system, not the highest version number. TypeScript 7.0.2 conflicts with the current `typescript-eslint` support declaration, so the baseline is TypeScript 6.0.3. Renovate may propose TypeScript 7 only when lint, Next.js, Vite, test, generator, and editor workflows all pass the same locked CI matrix. This avoids weakening lint/type gates for novelty.

### Final-Quality Visual Milestone Versus Honest Behavior

The first app must look and behave like a finished product across all planned states, but it is an internal/closed product contract, not a public optimizer release. Deterministic fixtures are visibly and structurally marked as fixture provenance; random telemetry and fake boost scores are prohibited. Production-mode adapters return honest unavailable, unsupported, or not-yet-measured states until real capabilities exist. The exit gate is adapter substitutability without information-architecture or state-machine redesign.

### Better Auth Versus Extreme Security

Better Auth is the preferred candidate, not an approved production dependency. A focused spike must prove system-browser OAuth 2.1/PKCE for desktop, passkeys, MFA, account recovery, session/device revocation, abuse controls, administrator security, auditability, and upgrade response. Identity is isolated behind a port so failure of any gate permits Auth0 or another OIDC provider without rewriting product domains.

### Global AWS Design Versus Near-Zero Initial Budget

AWS Organizations, private networking, ECS/Fargate, RDS, SQS/EventBridge, KMS, centralized logs, and Cloudflare describe the beta/production target. Early work uses the simulator, local PostgreSQL/SQLite, containers or emulators, Neon preview branches, GitHub Actions, and static/low-cost previews. CDK and policy tests can validate topology without provisioning it. Each paid service requires a stage need, cost ceiling, owner, alert, backup/export plan, and decommission path.

## Implications for Roadmap

The following order is dependency-driven. Safety, evidence, and observability are acceptance criteria in every phase rather than a later hardening phase.

### Phase 0: Product Truth, Threat Model, Contracts, and Quality Gates

**Rationale:** Every later UI, cloud, and engine decision depends on shared semantics for provenance, capability, risk, approval, recovery, errors, and versioning.  
**Delivers:** ADR process; domain/module map; threat-model skeleton; evidence/claim vocabulary; TypeSpec TS/Rust generation spike; monorepo boundaries; deterministic fixtures; CI, SDD/TDD/E2E policy; TypeScript 6 compatibility baseline.  
**Avoids:** Fake gains, duplicated DTOs, unbounded scope, framework-led architecture.  
**Research flags:** TypeSpec generator parity for unions/bounds/unknown fields; desktop/backend compatibility policy; exact tool versions after lockfile resolution.

### Phase 1: Complete Desktop UX Contract

**Rationale:** Visual quality is the first product risk, but contracts and truthful scenario semantics must already exist.  
**Delivers:** Bespoke design system under the Impeccable process; non-elevated Tauri shell; goal-first navigation; all calibration, home, game, plan, monitoring, recovery, AI, account, settings, risk, failure, offline, expiry, restart, and unsupported states; PT-BR/English; WCAG 2.2 AA; screenshot and Windows E2E suites.  
**Uses:** React/Vite, Tauri 2, React Aria, XState where safety workflows benefit, Storybook, Playwright, MSW-like deterministic adapters.  
**Avoids:** Generic dashboard UI, fixture deception, happy-path-only polish, inaccessible custom controls.  
**Research flags:** Tauri/WebView2 memory and startup budget on reference Windows hardware; Windows screen-reader/keyboard behavior; typography and locale expansion; fixture labeling/provenance UX.

### Phase 2: Web, Documentation, Account, and Isolated Admin UX

**Rationale:** These surfaces must share product contracts and design language before backend/provider choices harden their flows.  
**Delivers:** Separate Next.js public/account and admin applications; marketing, pricing, docs, downloads, account security, billing/device/support flows, administrative role/approval states; responsive, accessibility, localization, and E2E coverage.  
**Avoids:** Admin hidden inside the public app, unsupported claims in documentation, identity-provider coupling in UI.  
**Research flags:** Current compatible Next.js deployment baseline; CSP and cookie boundary design; documentation versioning and claim-review workflow.

### Phase 3: Identity, Licensing, Billing, and Control-Plane Foundations

**Rationale:** Real entitlements and device flows require authoritative database invariants before desktop cloud integration.  
**Delivers:** Fastify modular monolith; module-owned PostgreSQL schemas; Kysely repositories; migration and restore tests; Better Auth evaluation; one-device invariant, 30-day reset cooldown, seven-day signed offline grant; billing provider abstraction; webhook inbox, outbox, reconciliation; audit and administration authorization.  
**Avoids:** Raw device fingerprinting, webhook-order bugs, app-only constraints, owner-level database access.  
**Research flags:** Better Auth security gate; device-binding privacy/tolerance; signed offline lease and trusted-time model; payment-provider/Merchant-of-Record decision; PostgreSQL major support in selected AWS service.

### Phase 4: Read-Only Windows Inventory and Measurement Foundation

**Rationale:** Capability and evidence must exist before recommendations or mutation. It also validates desktop contracts against real machines early.  
**Delivers:** Hardware/OS/driver/security/game inventory; evidence freshness; capability graph; launcher identity; restore readiness; external low-overhead measurement prototypes; real read adapters replacing relevant simulator ports.  
**Avoids:** Hardware-name recipes, unknown-to-known coercion, EOL Windows 10 being labeled verified, optimizer-induced measurement bias.  
**Research flags:** Windows 10 ESU/LTSC lifecycle policy; WMI/ETW/native API matrix; PresentMon methodology across APIs; HAGS accuracy; OEM/driver variability; physical hardware lab coverage.

### Phase 5: Privileged Service, Installer, IPC, and Signing Boundary

**Rationale:** Privilege is established only after use cases and capability inputs are understood, and before any mutation implementation.  
**Delivers:** Minimal Windows service; explicit service identity; authenticated versioned named-pipe protocol; installer/update lifecycle; machine/user ACLs; app/profile signing separation; adversarial IPC and clean-machine install/update/uninstall tests.  
**Avoids:** Elevated UI, generic command execution, premature kernel driver, signature-as-safety thinking.  
**Research flags:** Same-user caller attestation; LocalSystem versus virtual/service account; DPAPI/CNG/TPM usage; hardware-backed code signing; updater rollback and downgrade resistance.

### Phase 6: Durable Journal and Recovery Engine

**Rationale:** No optimization may ship until exact-state recovery is proven independently of individual tweak families.  
**Delivers:** Versioned operation protocol; precondition fingerprint; snapshot/apply/verify/revert/verify-reverted lifecycle; SQLite/WAL machine journal; atomic groups and dependency order; reboot continuation; recovery center backed by real data; fault injection at every checkpoint.  
**Avoids:** Restore-point-only rollback, guessed defaults, best-effort cleanup, UI-dependent recovery.  
**Research flags:** Journal encryption/ACL; disk-full and corruption recovery; schema migrations across app/service versions; Windows Restore interaction.

### Phase 7: Verified Optimization Families

**Rationale:** Breadth comes only after the policy and recovery substrate is proven. Each family is a small evidence-backed vertical slice.  
**Delivers:** Allowlisted Windows operation families with capability predicates, bounded parameters, exact rollback, source/evidence records, lab matrix, and measured overhead; promotion workflow from Experimental toward Verified.  
**Avoids:** Universal tweak packs, misleading peak benchmarks, unsafe thermal/security trade-offs.  
**Research flags:** Required for every family: official behavior, supported OS/build/driver matrix, failure modes, measurement protocol, recovery evidence. Defender/VBS/Update controls require a separate Extreme-only security study and are not an early family.

### Phase 8: Game Lifecycle and Trustworthy Session Measurement

**Rationale:** Automatic game optimization depends on stable game identity, recovery, and already-validated operations.  
**Delivers:** Internal/external launch detection; launcher child-process modeling; per-game profile composition; temporary plan activation/restoration; crash/reboot recovery; external measurement; quality-gated before/after reports and kill switches.  
**Avoids:** Injection, game-file modification, universal anti-cheat claims, temporary settings stranded after failure.  
**Research flags:** Per-launcher/process trees; game/anti-cheat validation matrix; multi-instance behavior; graphics API capture quality; measurement overhead.

### Phase 9: Signed Profiles, Updates, Revocation, and Channels

**Rationale:** Remote distribution becomes safe only after local policy can reject semantically unsafe content.  
**Delivers:** Declarative profile bundle schema; immutable artifacts; separate signing identities; anti-rollback sequence; revocation; Stable/Beta/Experimental promotion of identical digests; cohort rollout; health halts; updater transaction coordination; SBOM and provenance.  
**Avoids:** Remote code execution through profiles, manual cross-channel mistakes, updates during games or recovery.  
**Research flags:** HSM/KMS signing workflow; revocation freshness while offline; reproducible Windows build feasibility; last-supported-version upgrade matrix.

### Phase 10: Advisory AI and Secure Support

**Rationale:** AI can become useful only after a deterministic catalog, typed proposal model, consent, and privacy boundaries exist.  
**Delivers:** Local redaction/minimization; optional cloud gateway; encrypted local history; cited explanations; typed proposal rejection/preview; prompt-injection evaluation; consent-bound encrypted support packages, expiring access, and user-visible audit.  
**Avoids:** AI command authority, hidden telemetry, unrestricted employee access to diagnostics.  
**Research flags:** Model/provider cost and privacy; local-model feasibility; structured-output adversarial evaluation; regional retention obligations.

### Phase 11: Production Infrastructure and Operational Scale

**Rationale:** Provision only what real alpha/beta load and reliability needs justify; architecture has already kept extraction paths open.  
**Delivers:** Progressive AWS Organizations topology; private RDS; ECS/Fargate API/workers; SQS/EventBridge; immutable S3 artifacts; Cloudflare edge/origin protection; OIDC CI; OpenTelemetry collector; backups, incident runbooks, canaries, cost and SLO budgets.  
**Avoids:** Premature microservices, unused multi-account cost, unrecoverable solo-operator releases.  
**Research flags:** Regional data placement; production cost model; RTO/RPO; observability backend; load evidence before Aurora, Valkey, replicas, multi-region, or service extraction.

### Phase Ordering Rationale

```text
Truth/contracts
  → truthful complete desktop UX
  → web/admin UX
  → identity/control plane
  → read-only capability evidence
  → privilege boundary
  → recovery substrate
  → verified operation families
  → game/session automation
  → remote profile/update supply chain
  → advisory AI/support
  → demand-driven production scale
```

Parallel work is safe only inside a phase after contracts and file/module ownership are fixed. Cross-cutting architecture, schema changes, security policy, and integration remain centrally reviewed. This preserves the speed benefit of subagents without accepting unreviewed or conflicting code.

## Confidence Assessment

| Area | Confidence | Reason |
|---|---|---|
| Stack | MEDIUM | Stable releases and official constraints were checked, but exact generator, auth, IPC, and Windows tooling choices require spikes. |
| Features | MEDIUM | Microsoft/PresentMon capabilities are primary-source grounded; market priority comes from competitor marketing and product direction rather than user research. |
| Architecture | MEDIUM | Patterns are established and primary-source compatible; Windows-specific caller authentication, recovery, measurement, and device binding need implementation evidence. |
| Pitfalls | HIGH | The safety, lifecycle, privilege, recovery, database, and supply-chain risks follow official platform behavior and well-established failure modes. |

**Overall confidence:** MEDIUM. The project direction is strong enough for roadmap creation, but operation-level claims and security approvals must remain evidence-gated.

## Gaps to Address

- **Contract generation:** prove identical TypeScript/Rust acceptance and rejection semantics before committing to a generator pipeline.
- **Windows IPC and service identity:** validate ACLs, caller identity, replay resistance, and minimum privileges under adversarial same-user conditions.
- **Windows 10 policy:** define supported SKU/build/ESU/LTSC matrix and lifecycle messaging before real compatibility claims.
- **Defender and security controls:** document supported interfaces, Tamper Protection/managed-device behavior, recovery, legal wording, and explicit non-bypass policy.
- **Measurement:** establish statistically defensible, low-overhead protocols per graphics API, game, and anti-cheat environment.
- **Better Auth:** pass desktop PKCE, passkey/MFA, recovery, revocation, admin, and incident-response gates or replace it behind the identity port.
- **Device binding:** balance legitimate hardware/reinstall tolerance with privacy and one-device enforcement.
- **Local journal:** prove crash consistency, encryption/ACLs, disk-full behavior, corruption repair, and version migrations.
- **Paid infrastructure:** create a stage-based cost model before provisioning AWS production services.
- **Legal and claims:** review subscriptions, device cooldown, Windows 10 lifecycle, security reductions, privacy, and performance substantiation before public release.

## Sources

### Primary — HIGH confidence

- [Microsoft: Windows 10 support ended on October 14, 2025](https://support.microsoft.com/en-US/Windows/Deployment/Updates-Lifecycle/windows-10-support-has-ended-on-october-14-2025) — lifecycle constraint.
- [Microsoft Learn: Defender Tamper Protection](https://learn.microsoft.com/en-us/defender-endpoint/prevent-changes-to-security-settings-with-tamper-protection) — protected security settings and managed behavior.
- [Microsoft Learn: Named Pipe Security and Access Rights](https://learn.microsoft.com/en-us/windows/win32/ipc/named-pipe-security-and-access-rights) — privileged IPC boundary.
- [Microsoft Learn: Service Security and Access Rights](https://learn.microsoft.com/en-us/windows/win32/services/service-security-and-access-rights) — Windows service security.
- [Microsoft Learn: Event Tracing for Windows](https://learn.microsoft.com/en-us/windows/win32/etw/about-event-tracing) — measurement foundation.
- [PresentMon](https://github.com/GameTechDev/PresentMon) — external frame-presentation measurement capabilities and limitations.
- [Tauri 2 Security Documentation](https://v2.tauri.app/security/) — capabilities, permissions, CSP, IPC, isolation, and updater boundaries.
- [PostgreSQL Constraints](https://www.postgresql.org/docs/current/ddl-constraints.html) and [Transaction Isolation](https://www.postgresql.org/docs/current/transaction-iso.html) — authoritative invariant design.
- [AWS Security Reference Architecture](https://docs.aws.amazon.com/prescriptive-guidance/latest/security-reference-architecture/welcome.html) — target account and security topology.
- [AWS SQS At-Least-Once Delivery](https://docs.aws.amazon.com/AWSSimpleQueueService/latest/SQSDeveloperGuide/standard-queues-at-least-once-delivery.html) — idempotency requirement.
- [JSON Schema 2020-12](https://json-schema.org/draft/2020-12) and [OpenAPI 3.1](https://spec.openapis.org/oas/v3.1.0) — language-neutral contract basis.
- [WCAG 2.2](https://www.w3.org/TR/WCAG22/) — accessibility requirements.
- [OWASP Top 10 for LLM Applications](https://owasp.org/www-project-top-10-for-large-language-model-applications/) — advisory AI threat model.

### Secondary — MEDIUM confidence

- [Hone official site](https://hone.gg/) — advertised market expectations; performance claims were not treated as evidence.
- [StarBoost / BravoBoost official site](https://app.bravoboost.com.br/) — advertised feature and commercial positioning; claims were not treated as proof.
- Official package registries and framework release notes listed in [STACK.md](./STACK.md) — version baseline to be locked only after compatibility gates.

---

*Research completed: 2026-07-26*  
*Ready for roadmap: yes*
