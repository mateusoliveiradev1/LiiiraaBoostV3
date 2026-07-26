# Architecture Research

**Domain:** Security-sensitive Windows gaming optimizer plus global subscription control plane  
**Project:** Liiiraa Boost  
**Researched:** 2026-07-26  
**Confidence:** MEDIUM

## Executive Recommendation

Build Liiiraa Boost as two systems with an explicit trust boundary:

1. A **local-first Windows product** where an unprivileged Tauri application orchestrates a narrowly scoped privileged Windows service.
2. A **modular cloud control plane** that distributes signed declarative data, manages identity/licensing, and never gains arbitrary execution authority over a PC.

The local optimizer must remain useful and recoverable without the cloud. The cloud may authorize Premium capabilities, publish signed profiles, and provide optional AI/support services, but the privileged service must independently validate every requested operation against code compiled into the installed binary.

Use a modular monorepo and a modular monolith, not premature microservices. Enforce boundaries with dependency rules, module-owned database schemas, generated contracts, and architecture tests. Extract services only when measured scaling, independent release cadence, or isolation requirements justify it.

The most important architectural choice is not Tauri, Fastify, or AWS. It is the **privilege protocol**: plans are typed, declarative, capability-checked, approved, journaled, applied through allowlisted operations, verified, and compensatingly rolled back. No UI route, cloud profile, administrator account, AI response, or community content may bypass that protocol.

## Standard Architecture

### System Overview

```text
┌──────────────────────────── User PC: unprivileged boundary ─────────────────────────────┐
│                                                                                          │
│  React feature UI ──typed client──> Tauri host / application orchestrator                │
│         │                              │                                                  │
│         │                              ├── local user state (SQLite, user ACL)            │
│         │                              ├── game/launcher adapters (read-only)              │
│         │                              ├── cloud API adapter                               │
│         │                              └── AI suggestion adapter                           │
│         │                                                                                 │
│         └──────── deterministic simulator implements the same application ports ─────────┤
└──────────────────────────────────────┬───────────────────────────────────────────────────┘
                                       │ versioned authenticated local IPC
                                       │ no generic command execution
┌──────────────────────────── User PC: privileged boundary ────────────────────────────────┐
│  Minimal Windows service                                                                  │
│    ├── request authorizer + caller verification                                           │
│    ├── plan compiler / policy engine                                                      │
│    ├── capability inventory                                                               │
│    ├── operation registry (compiled allowlist)                                            │
│    ├── transaction coordinator                                                            │
│    ├── durable operation journal (machine ACL)                                            │
│    ├── verification / rollback / boot recovery                                            │
│    └── Windows adapters: registry, services, tasks, power, network, devices, files        │
└──────────────────────────────────────┬───────────────────────────────────────────────────┘
                                       │ signed HTTPS requests; least data necessary
┌──────────────────────────── Cloudflare / public edge ─────────────────────────────────────┐
│ DNS │ CDN │ WAF │ DDoS │ rate limits │ Turnstile │ origin protection                     │
└──────────────────────────────────────┬───────────────────────────────────────────────────┘
                                       │
┌──────────────────────────── AWS control-plane boundary ──────────────────────────────────┐
│  Next.js web/account       Next.js admin (separate deployment and policy)                 │
│              └───────────────> Fastify modular monolith <──────────────┐                  │
│                                   │                                    │                  │
│       identity │ licensing │ devices │ billing │ profiles │ releases │ support │ AI       │
│                                   │                                    │                  │
│              PostgreSQL <── transactional outbox ──> EventBridge/SQS ──> workers/Lambda    │
│              Valkey (cache/limits only)       S3 immutable artifacts      observability    │
└───────────────────────────────────────────────────────────────────────────────────────────┘
                                       │
┌──────────────────────────── Supply-chain signing boundary ────────────────────────────────┐
│ protected release workflow │ separate signing identities │ provenance │ SBOM │ promotion │
└───────────────────────────────────────────────────────────────────────────────────────────┘
```

### Non-Negotiable Dependency Direction

```text
contracts/schema  <──  generated TS/Rust artifacts
       ↑
domain models + policies  <──  application use cases  <──  adapters/frameworks
       ↑                              ↑
no Tauri/AWS/SQL/React              ports/interfaces

UI features ──> desktop application client ──> simulator OR Tauri adapter
API routes  ──> domain module public API ──> repositories/outbox adapters
Windows service endpoint ──> policy engine ──> operation registry ──> Windows adapters
```

Domain and policy packages must not import React, Tauri, Fastify, PostgreSQL, AWS SDKs, or Windows APIs. Framework code is replaceable infrastructure around stable use cases.

## Component Responsibilities

### Desktop Components

| Component | Owns | Must Not Own |
|---|---|---|
| React feature UI | Presentation, navigation, accessibility, local view state, user intent | Windows mutation, cloud secrets, authorization policy |
| Desktop application layer | Use cases, orchestration, state machines, ports, typed errors | Raw registry/service commands |
| Deterministic simulator | Realistic fixtures, time/failure controls, same ports as production adapters | Separate UI-only domain models |
| Tauri host | Window lifecycle, tray, secure command boundary, adapter composition | Broad elevation or generic shell execution |
| Local user store | Preferences, encrypted AI history, UI activity, cached inventory/read models | Privileged rollback authority |
| Game discovery/runtime | Launcher adapters, installed-game identity, process/session lifecycle | Injection, game file changes, anti-cheat interaction |
| Capability inventory | Hardware/driver/OS feature facts with evidence and freshness | Deciding mutations by itself |
| Privileged service | Authorization, validation, mutations, durable journal, boot recovery | Marketing, billing decisions, arbitrary remote instructions |
| Operation registry | Compiled operation IDs, parameter bounds, preconditions, apply/verify/revert implementations | Dynamically downloaded executable code |
| Machine journal | Before-state, checkpoints, outcomes, recovery state, audit linkage | User-facing analytics or cloud synchronization by default |

### Control-Plane Components

| Module | Owns | Storage Boundary |
|---|---|---|
| Identity | Accounts, authenticators, sessions, recovery, MFA/passkey policy | `identity` schema; Better Auth adapter behind a port |
| Entitlements | Plans, subscription state projection, Premium capability grants | `entitlements` schema |
| Devices | One-active-device invariant, opaque fingerprints, reset cooldown, device grants | `devices` schema |
| Billing | Provider adapters, webhook inbox, invoices/plan mapping | `billing` schema |
| Profile registry | Versioned profile metadata, compatibility, channels, promotion state | `profiles` schema; immutable bundles in object storage |
| Releases | Desktop/web release records, rollout rings, signatures, revocations | `releases` schema; immutable artifacts in object storage |
| Documentation | Versioned technical evidence and compatibility content | `content` schema or versioned content repository |
| Support | Cases, user-granted diagnostic access, expiration, audit | `support` schema; encrypted packages in object storage |
| AI gateway | Consent, redaction, provider routing, usage policy, typed suggestion responses | Minimal metadata; no privileged action channel |
| Administration | Commands over module public APIs, RBAC/ABAC, approvals | No direct table access |
| Audit | Append-only security and business audit events, retention policy | Dedicated schema/export to protected log account |

Each module exposes a narrow public API and publishes domain events. Other modules must not import its repositories or query its private tables.

## Recommended Monorepo Structure

```text
apps/
  desktop/                    # React UI and unprivileged Tauri host
  web/                        # Public site, docs, account, billing, downloads
  admin/                      # Separate administrative deployment
  api/                        # Fastify composition root for modular monolith
  workers/                    # Queue consumers and scheduled jobs

crates/
  desktop-application/        # Use cases and ports
  optimizer-domain/           # Plans, operations, risk, evidence, state machines
  optimizer-policy/           # Compatibility and authorization rules
  optimizer-service/          # Windows service endpoint and lifecycle
  optimizer-journal/          # Durable transaction journal and recovery
  windows-inventory/          # Read-only hardware/OS discovery
  windows-operations/         # Allowlisted mutation implementations
  game-discovery/             # Launcher/process adapters
  contracts-rust/             # Generated; never hand-edited

packages/
  contracts-source/           # Canonical JSON Schema/OpenAPI source and fixtures
  contracts-ts/               # Generated types, clients, validators
  desktop-client/             # UI-facing application client interface
  desktop-simulator/          # Deterministic implementation of desktop-client
  design-tokens/              # Brand primitives, no product logic
  design-system/              # Accessible bespoke components
  feature-*/                  # Goal-oriented UI feature modules
  domain-identity/
  domain-entitlements/
  domain-devices/
  domain-billing/
  domain-profiles/
  domain-releases/
  domain-support/
  domain-audit/
  observability/

infra/
  cdk/
    organizations/
    network/
    data/
    compute/
    edge-origins/
    security/
    observability/
    delivery/

tooling/
  architecture-tests/
  contract-generation/
  fixtures/
  windows-test-lab/
  release/
```

### Structure Rules

- Never create a catch-all `shared`, `utils`, or global `services` package. Shared code must have a named capability and owner.
- Generated contract packages are build artifacts checked for drift; developers edit only the schema source.
- UI feature packages may depend on design primitives and application contracts, not on Tauri APIs.
- Rust operation crates may depend on domain traits and Windows adapters, not on UI or cloud code.
- Backend module imports are allowed only through each module's `public` entry point.
- Infrastructure modules describe deployable capabilities, not mirror every application folder.
- Enforce these constraints through ESLint import rules, package export maps, Cargo visibility/features, dependency graph checks, and CI architecture tests.

## Core Architectural Patterns

### Pattern 1: Ports, Adapters, and a Deterministic Product Simulator

**What:** Every desktop screen talks to an application-level client interface. The initial simulator and later Tauri/Rust implementation both satisfy the same contract.

**Why here:** The first milestone is a complete, installable visual product before dangerous optimizations exist. A simulator prevents throwaway UI logic while keeping privileged behavior absent.

```ts
export interface OptimizationClient {
  inspectSystem(input: InspectSystemInput): Promise<Result<SystemSnapshot, InspectError>>;
  previewPlan(input: PreviewPlanInput): Promise<Result<PlanPreview, PlanError>>;
  approvePlan(input: ApprovePlanInput): Promise<Result<ApprovalReceipt, ApprovalError>>;
  observeExecution(executionId: ExecutionId): AsyncIterable<ExecutionEvent>;
  requestRollback(input: RollbackInput): Promise<Result<RollbackReceipt, RollbackError>>;
}
```

The simulator must support deterministic clock, hardware fixture, locale, permission state, network state, partial failure, reboot-required state, and recovery state. Story/demo fixtures are product test vectors, not fake random dashboards.

**Trade-off:** More interface design up front. It is justified because replacing fixtures with the real engine must not rewrite the product.

### Pattern 2: Schema-First Contracts With Runtime Validation

**What:** Author critical messages once in a language-neutral schema source. Generate:

- TypeScript types, validators, API clients, and test fixtures.
- Rust `serde` models and validation adapters.
- OpenAPI 3.1 documents for HTTP endpoints.
- Compatibility tests and golden payloads for local IPC.

Use JSON Schema 2020-12 as the canonical value/message vocabulary and OpenAPI 3.1 for HTTP operations referencing those schemas. Do not let generated transport types become domain entities; map them at each boundary.

Every message carries:

```text
schemaVersion | messageType | requestId | correlationId | issuedAt | payload
```

Persisted plans and journals also carry their schema version and migration policy. Additive changes are preferred. Breaking changes require a new major contract version and explicit desktop/backend compatibility window.

**Required spike:** Verify the chosen generators against recursive schemas, branded identifiers, discriminated unions, numeric bounds, unknown-field policy, and identical invalid-payload rejection in TypeScript and Rust. No generator is approved merely because it emits compiling types.

### Pattern 3: Declarative Signed Optimization Plans

**What:** Remote profiles are signed data, never scripts. A profile bundle contains:

```text
profile identity and version
channel and validity window
supported engine/contract versions
hardware/OS/game eligibility expression
operation IDs with bounded typed parameters
dependency/conflict graph
expected evidence and verification rules
risk classification and consent requirements
rollback requirements and reboot boundaries
content hash, anti-rollback sequence, signature metadata
```

The privileged service performs this sequence independently:

1. Verify signature, hash, validity, channel, schema version, and revocation state.
2. Resolve operation IDs only through its compiled registry.
3. Reject unknown operations and out-of-range parameters.
4. Re-evaluate local eligibility and preconditions.
5. Compile the profile plus local capability overlay plus user delta into a concrete plan.
6. Require approval proportional to the highest-risk operation.
7. Snapshot, apply, verify, and journal each operation.

Use separate signing identities for application updates and profile content. Protect production signing through an isolated release workflow, short-lived deployment identity, approval gates, provenance, and revocation. A compromised website or admin session must not be sufficient to sign executable behavior.

### Pattern 4: Saga-Style Local Transaction and Compensating Rollback

Windows configuration changes cannot participate in one database transaction. Treat a plan as a durable saga:

```text
DRAFT
  → ANALYZED
  → APPROVED
  → SNAPSHOTTING
  → READY
  → APPLYING
  → VERIFYING
  → APPLIED

failure → ROLLBACK_PENDING → ROLLING_BACK → RESTORED
                                      └──→ ATTENTION_REQUIRED
```

Every operation implements the same behavioral protocol:

```rust
trait Operation {
    fn detect(&self, ctx: &ReadContext) -> Result<ObservedState, OperationError>;
    fn preconditions(&self, ctx: &ReadContext) -> Result<Eligibility, OperationError>;
    fn snapshot(&self, ctx: &WriteContext) -> Result<RollbackArtifact, OperationError>;
    fn apply(&self, ctx: &WriteContext, key: IdempotencyKey) -> Result<AppliedState, OperationError>;
    fn verify(&self, ctx: &ReadContext) -> Result<Verification, OperationError>;
    fn revert(&self, ctx: &WriteContext, artifact: &RollbackArtifact) -> Result<(), OperationError>;
    fn verify_reverted(&self, ctx: &ReadContext) -> Result<Verification, OperationError>;
}
```

The service writes a durable journal checkpoint before and after each side effect. A plan records a precondition fingerprint so a stale approval cannot mutate a materially changed machine. Rollback runs in reverse dependency order and restores captured state, not assumed defaults.

Windows System Restore is supplemental protection. It is not the primary rollback mechanism because availability, coverage, and timing are not precise enough for per-operation recovery.

Plans requiring restart are split at explicit reboot barriers. The service resumes verification or rollback from the journal at boot without depending on the UI being open.

### Pattern 5: Capability Model, Not Hardware Name Branches

Inventory produces facts with evidence and freshness:

```text
fact ID | value | source | observedAt | confidence | driver/provider | scope
```

Eligibility rules consume capabilities such as `supports.resizableBar`, `storage.nvme.trim`, or `gpu.vendor.nvidia.driverBranch`, not scattered string checks such as `if model contains RTX`.

Separate:

- **Inventory:** what exists.
- **Capability derivation:** what the hardware/OS/driver combination can support.
- **Policy:** whether an operation is validated for that combination and channel.
- **Plan selection:** whether it advances the user's stated objective.

Unknown or stale facts fail closed for stable mutations. Experimental operations remain isolated, clearly labeled, and equally reversible.

### Pattern 6: Module-Owned Data With Outbox Events

PostgreSQL is the source of truth. Each backend module owns a schema/tables, repositories, migrations, and invariants. Cross-module behavior goes through public application APIs or durable events, not private-table imports.

Within the same request, keep strongly consistent invariants in one owning module. For example, the Devices/Entitlements boundary should expose one command that atomically enforces “one active PC” and the 30-day reset rule rather than coordinating two independent writes.

For asynchronous effects:

1. Write domain state and an outbox row in the same PostgreSQL transaction.
2. Relay the outbox record to EventBridge/SQS.
3. Make consumers idempotent with a durable inbox/deduplication key.
4. Configure bounded retries and dead-letter queues.
5. Expose replay and quarantine operations in administration.

Valkey may accelerate reads, rate limits, and locks, but loss of cache must not lose entitlements, approvals, billing events, device rules, or audit evidence.

### Pattern 7: AI as an Untrusted Advisory Adapter

The AI boundary accepts a user-approved, locally redacted diagnostic projection and returns a typed `SuggestionDraft`:

```text
catalog references | rationale | questions | uncertainty | proposed objectives
```

It cannot return shell commands, registry paths to execute, service calls, or privileged payloads. The deterministic planner resolves catalog references, rechecks local capability/policy, and creates an ordinary preview requiring ordinary approval.

The AI process/provider receives no service IPC credential, signing key, payment secret, or general machine filesystem access. Prompt text, tool output, and retrieved documentation are untrusted content.

### Pattern 8: Cell-Based Scaling Without Premature Microservices

Start with one Fastify modular-monolith deployment and independently scalable worker processes. Preserve extraction seams through module APIs, outbox events, separate schemas, and ownership.

Extract a module only when one of these is measured:

- It needs materially different scaling or availability.
- It handles a higher-risk trust boundary requiring stronger isolation.
- Its deploy cadence blocks the rest of the product.
- Its data volume or workload harms the transactional core.
- A dedicated operational owner exists.

At very large scale, devices/users can be assigned to regional or logical cells for profile delivery, rate limiting, and telemetry/support processing while billing and entitlement authority remains strongly consistent in a home region.

## Trust Boundaries and Threat Controls

| Boundary | Primary Threat | Required Controls | Fail-Safe Behavior |
|---|---|---|---|
| Webview → Tauri host | XSS invokes native authority | No remote product content in privileged window; strict CSP; minimal Tauri capabilities per window; runtime validation | Reject command and record local security event |
| Tauri host → privileged service | Same-user malware or forged IPC | Named-pipe DACL scoped to service/system/authorized logon; versioned protocol; caller token/PID verification; challenge binding; per-command authorization | Reject unknown caller/request; no partial mutation |
| Service → Windows | Excess privilege or unsafe operation | Dedicated service identity where possible; minimal token privileges; compiled operation registry; bounded parameters | Reject operation; retain journal and recovery |
| Cloud → desktop | Compromised API/admin publishes hostile content | Signed immutable bundles; separate signer; anti-rollback; local eligibility and allowlist validation | Keep last trusted bundle or operate offline |
| Desktop → cloud | Device impersonation or token theft | System-browser OAuth/OIDC with PKCE; short-lived tokens; device-bound key material protected by Windows; rotation/revocation | Local recovery remains available; Premium actions pause after grace window |
| Public web → API | Credential stuffing, abuse, injection | Cloudflare/WAF/rate limits; schema validation; CSRF/session controls; prepared SQL; audit | Bounded denial without leaking account existence |
| Admin → control plane | Insider misuse/account takeover | Separate admin deployment; phishing-resistant MFA for critical roles; least privilege; just-in-time grants; dual approval for signing/revocation; immutable audit | High-risk command denied or held for approval |
| AI provider → product | Prompt injection or fabricated actions | Data minimization; typed advisory-only result; catalog resolution; no privileged tools | Show uncertainty; never execute |
| Build pipeline → release | Dependency/build compromise | Pinned lockfiles; isolated runners; SBOM; provenance; reproducible checks; code signing after gates | Do not publish; preserve previous release |

### Local IPC Requirements

Microsoft documents that a named pipe receives access control from its security descriptor and that default descriptors can grant broader read access than this product should accept. Therefore:

- Always create the pipe with an explicit DACL; never accept the default descriptor.
- Use individual pipe rights rather than broad generic rights.
- Scope access to the service identity, SYSTEM/administrative recovery, and the intended interactive logon identity.
- Validate the connected client's security token and process identity before accepting privileged requests.
- Treat impersonation carefully and always restore the service thread identity after any impersonated check.
- Never expose a generic `execute(command, args)` endpoint.
- Reauthorize each operation; a successful connection is not blanket authorization.

Exact caller attestation, executable signature verification, service identity, installer ACLs, and session-secret handling require a Windows security spike and adversarial tests before implementing mutations.

## Key Data Flows

### 1. UI-First Milestone

```text
User action
  → React feature use case
  → generated contract validator
  → OptimizationClient port
  → deterministic simulator
  → typed domain event stream
  → UI state/read model
```

The production Tauri adapter is absent or returns explicit `notAvailableInThisBuild` for privileged mutations. No dead control pretends success. Every success, empty, loading, offline, permission, failure, reboot, recovery, and subscription state is driven by deterministic scenarios and covered by visual/E2E tests.

### 2. Apply an Optimization Plan

```text
UI selects objectives/operations
  → unprivileged planner requests preview
  → service inventories capabilities and compiles concrete DAG
  → UI displays evidence, risk, dependencies, restart effects, rollback readiness
  → proportional approval creates short-lived approval receipt bound to plan hash
  → service rechecks plan hash + preconditions
  → snapshot and durable journal
  → apply allowlisted operations in dependency order
  → verify measured state
  → return typed outcome and evidence
  → rollback failed branch or whole atomic group as policy requires
```

The approval receipt is invalid if the plan, capability snapshot, risk level, operation parameters, or expiry changes.

### 3. Game Profile Activation

```text
launcher adapters + user-added executable
  → canonical GameIdentity
  → process/session detector
  → official signed base profile
  + local hardware/capability overlay
  + validated user delta
  → conflict resolver and preview
  → pre-launch apply (when launched through app)
     OR safe runtime subset (when detected after external launch)
  → session observation without injection
  → exit/crash/reboot detection
  → restore temporary operations and verify
```

Use stable platform IDs where available and verify executable path/publisher/hash evidence. Do not identify games by process name alone. External-launch detection must never race into unsafe boot-time or persistent mutations.

### 4. Profile Publication

```text
author creates declarative profile
  → schema + policy validation
  → compatibility lab matrix
  → security and rollback tests
  → review/promotion approval
  → isolated signer signs immutable bundle
  → object storage version
  → CDN/channel manifest
  → desktop verifies signature/hash/version locally
```

The administration UI can request promotion but must not possess signing keys.

### 5. Account, License, and Offline Grant

```text
system-browser authentication with PKCE
  → API session/token exchange
  → entitlement + one-device invariant
  → signed short-lived device grant
  → Windows-protected local storage
  → local verification for up to seven offline days
```

Subscription expiry disables new Premium actions after policy/grace evaluation. It must not revoke rollback, history, diagnostic transparency, or automatically reverse existing machine state.

### 6. AI Assistance

```text
user asks question
  → local intent and consent check
  → redact/minimize selected diagnostic projection
  → AI gateway
  → provider
  → typed advisory response
  → local deterministic catalog resolution
  → ordinary plan preview
```

Cloud AI is optional. Encrypted local conversation history is the default; synchronization is a separate opt-in.

## Database Architecture

### PostgreSQL Rules

- One managed PostgreSQL cluster initially; schema namespaces and roles reflect module ownership.
- Constraints, unique indexes, exclusion rules, and transactions enforce local module invariants.
- The application never relies on Valkey to enforce the one-device rule, billing idempotency, cooldowns, or authorization.
- Webhook ingestion stores the provider event before processing and has a unique provider/event constraint.
- Time-dependent rules use server-side authoritative time and explicit UTC timestamps.
- Audit events include actor, subject, action, decision, correlation, source, before/after references, and retention class; secrets and raw device identifiers are excluded.
- Store derived opaque device identifiers, not raw hardware serials. Keep the derivation/version scheme rotatable.
- High-volume measurements remain local by default. Optional uploaded diagnostics use purpose-specific encrypted objects and expiring grants rather than bloating the transactional database.
- Migration CI must initialize from zero, upgrade from supported versions, validate rollback/forward-fix strategy, and detect destructive locks.

### Cross-Module Data

Prefer opaque IDs and module APIs over cross-schema joins in command paths. Permit controlled read models for administration/reporting through replicated projections or explicitly owned SQL views. A reporting convenience must not become a hidden write dependency.

## AWS and Environment Topology

### Target Organization

```text
AWS Organization
  ├── Management account            # billing/organization only; no workloads
  ├── Security OU
  │   ├── Security tooling account  # delegated security administration
  │   └── Log archive account       # immutable centralized logs
  ├── Infrastructure OU
  │   └── Shared services account   # CI federation, artifact/supporting services
  ├── Non-production OU
  │   ├── Development account
  │   └── Staging account
  └── Production OU
      └── Production workload account
```

Use SCPs as guardrails, not as application authorization. Human access is federated and short-lived. GitHub Actions assumes narrowly scoped roles through OIDC; no permanent AWS keys exist in repository secrets.

### Budget-Aware Evolution

The codebase should support the target topology from day one, but the solo-developer phase should not provision all paid services:

| Stage | Runtime |
|---|---|
| Local/UI development | Simulator, local PostgreSQL container, local queue/storage emulators where useful |
| Pull-request preview | Neon branch, ephemeral web preview, contract/visual/E2E tests; no permanent AWS stack |
| Private alpha | Minimal non-production cloud, immutable artifact distribution, identity/licensing only where needed |
| Beta | Staging and production accounts, managed PostgreSQL, ECS workers/API, queues, centralized logs |
| Scale | Read replicas, partitioned hot tables, cell/ring delivery, independently scaled workers, selective service extraction |

Cloudflare may be the public edge, but origins must authenticate edge traffic and remain inaccessible directly where practical. Administrative access uses a separate hostname, policy, deployment, and stronger identity controls.

## Scalability Considerations

| Concern | Solo development / 100 users | 10K–100K users | Toward 1M users |
|---|---|---|---|
| API compute | One modular Fastify process; local/preview environments | ECS/Fargate horizontal autoscaling; separate worker service | Scale modules by traffic class; extract only proven hotspots |
| PostgreSQL | Neon dev/preview; managed single writer for production | Connection pooling, query budgets, indexes, read replicas | Partition audit/event inbox tables; cell read models; carefully selected extraction |
| Profile/release delivery | Immutable object artifacts | CDN caching, signed manifests, rollout rings | Multi-region replicated artifacts; regional manifests; aggressive edge caching |
| Events | In-process events locally; outbox tests | SQS/EventBridge with idempotent consumers and DLQs | Queue sharding by workload/cell; backpressure budgets; replay tooling |
| Sessions/rate limits | Database truth with local cache | Valkey cluster for ephemeral coordination | Regional caches; token/grant validation minimizes central calls |
| Diagnostics/support | Local-first; explicit upload only | Expiring encrypted object uploads | Region-aware object storage/processing; deletion workers and retention proofs |
| Observability | OpenTelemetry local collector/dev backend | Central metrics/traces/logs with sampling and SLOs | Tail sampling, tenant/cardinality budgets, protected cross-account archive |
| Billing/entitlements | Strong consistency in one region | Same; async projections for convenience | Keep authoritative home region; avoid premature active-active billing writes |

### Likely Bottlenecks in Order

1. Inefficient PostgreSQL queries and connection pressure.
2. Artifact/profile download bursts after releases.
3. High-cardinality audit/observability events.
4. Billing webhook retries and event fan-out.
5. Support diagnostic upload/processing, if users opt in.

None requires microservices at project inception. All require measurement, idempotency, and explicit data-retention budgets.

## Build Order

Architecture must preserve the agreed product sequence: complete desktop UX first, complete web platform second, privileged optimization later.

1. **Decision and contract foundation**
   - ADR format, module dependency rules, threat model skeleton.
   - Contract-generation spike for TypeScript/Rust parity.
   - Monorepo, CI quality gates, deterministic fixtures, release versioning.
2. **Design system and desktop application shell**
   - Tauri non-elevated shell, React feature architecture, navigation, localization/accessibility foundations.
   - No privileged service yet.
3. **Complete desktop UX on simulator**
   - Full inventory, plans, games, results, history, recovery, AI, account/license, settings, errors, offline, expiry, risk, reboot, and unsupported states.
   - Visual regression, accessibility, contract, performance, and Windows E2E gates.
4. **Complete web and administration UX**
   - Public site, documentation, account, billing, downloads, devices, support, isolated admin.
   - Simulated/provider adapters behind the same modular contracts where necessary.
5. **Control-plane foundations**
   - Fastify modular monolith, PostgreSQL schemas/migrations, identity spike, device/entitlement invariants, outbox/inbox.
   - Minimal-cost environments; production AWS resources only when beta requires them.
6. **Read-only Windows inventory**
   - Hardware/OS/driver/game discovery with evidence, fixtures captured from a controlled matrix, no mutations.
7. **Privileged boundary security spike**
   - Service identity, installer/service ACLs, named-pipe protocol, caller verification, attack tests, code signing, recovery boot path.
8. **Transaction engine with inert test operations**
   - Journal, state machine, fault injection, crash/reboot recovery, idempotency/property tests.
9. **Verified optimization operation waves**
   - Implement small capability families independently: snapshot/apply/verify/revert before adding breadth.
   - Stable channel only after physical/VM matrix evidence.
10. **Game session automation and measurement**
    - Launcher/process state machine, safe profile activation, permitted external measurements, temporary rollback.
11. **Signed profile pipeline**
    - Compatibility lab, promotion, signing separation, revocation, staged rollout.
12. **AI advisory integration and support diagnostics**
    - Only after deterministic planner/catalog and privacy controls are operational.
13. **Scale and regional hardening**
    - Driven by load/SLO evidence, not roadmap ambition.

This order prevents a polished UI from hard-coding fake behavior, while also preventing the privileged engine from dictating an unusable product.

## Architecture Verification Strategy

| Boundary | Required Tests |
|---|---|
| Contracts | Golden payloads in TS/Rust, invalid corpus, backward/forward compatibility, generated-code drift |
| Module graph | Forbidden imports, cyclic dependency detection, public-entry enforcement, Cargo feature/visibility checks |
| Simulator parity | Same application contract suite runs against simulator and Tauri adapter |
| Operation protocol | Property tests for idempotency, revert-to-captured-state, parameter bounds, precondition invalidation |
| Transaction journal | Power loss/process kill at every checkpoint, disk-full/corruption handling, reboot resume |
| Privileged IPC | Unauthorized user/process, malformed frame, replay, downgrade, stale approval, oversized payload, race tests |
| Signed profiles | Wrong key/hash/channel/version, expired/revoked bundle, unknown operation, incompatible capability |
| Game lifecycle | External/internal launch, launcher child process, crash, anti-cheat presence, multi-instance, reboot |
| Database | Fresh migration, upgrade path, constraint races, webhook replay, outbox crash windows |
| Cloud events | Duplicate/out-of-order delivery, poison message, DLQ/redrive, backpressure |
| Access control | Role matrix, just-in-time expiry, support consent expiry, administrative dual approval |
| UI quality | WCAG 2.2 AA, keyboard/screen reader, localization expansion, reduced motion, screenshot states |
| Release | Clean Windows install/update/uninstall/recovery, signature/provenance/SBOM verification |

## Anti-Patterns to Avoid

### 1. Elevated UI Process

**Mistake:** Run the Tauri/React application as administrator.  
**Why it fails:** Webview and presentation defects inherit broad machine authority; every plugin becomes privileged attack surface.  
**Instead:** Keep UI and Tauri host unprivileged. Isolate only minimal mutations in the service.

### 2. Generic Native or Cloud Command Bridge

**Mistake:** Expose `runCommand`, `writeRegistry`, PowerShell, or arbitrary script execution through Tauri IPC or remote profiles.  
**Why it fails:** One XSS, compromised account, or signing mistake becomes remote privileged execution.  
**Instead:** Use typed use cases and a compiled operation registry with bounded parameters.

### 3. Trusting a Signed Profile Too Much

**Mistake:** Treat valid signature as permission to execute everything in the bundle.  
**Why it fails:** Signing proves origin, not local compatibility, safety, freshness, or approval.  
**Instead:** Revalidate schema, revocation, engine version, capabilities, policy, risk, approval, and operation allowlist locally.

### 4. Hand-Written Duplicate Types

**Mistake:** Maintain similar DTOs in React, Fastify, and Rust.  
**Why it fails:** Drift appears exactly at risky boundaries; TypeScript compile-time types do not validate runtime data.  
**Instead:** Generate transport artifacts and run parity tests.

### 5. Rollback to a Presumed Default

**Mistake:** “Undo” an optimization by writing a vendor/Windows default.  
**Why it fails:** It destroys the user's previous customization and may be wrong for that machine.  
**Instead:** Capture exact before-state with provenance and verify restoration.

### 6. One Giant Transaction With Best-Effort Cleanup

**Mistake:** Apply dozens of unrelated changes, then report failures at the end.  
**Why it fails:** Partial state is opaque and restart/crash recovery is unreliable.  
**Instead:** DAG-based atomic groups, durable checkpoints, compensating operations, explicit attention-required state.

### 7. Hardware Recipes by Marketing Name

**Mistake:** Branch on CPU/GPU model strings and apply broad presets.  
**Why it fails:** Driver, firmware, notebook topology, OS policy, and vendor capability differ.  
**Instead:** Evidence-bearing capabilities and validation matrices.

### 8. Polling Everything During Games

**Mistake:** Continually scan processes, hardware, services, and network at high frequency.  
**Why it fails:** The optimizer consumes the resources it claims to free and distorts measurements.  
**Instead:** Event-driven detection, adaptive sampling, strict overhead budgets, measurement self-observation.

### 9. AI With a Privileged Tool

**Mistake:** Let the model call registry/service/network mutation tools.  
**Why it fails:** Prompt injection, hallucination, and compromised retrieved content become machine mutations.  
**Instead:** Advisory typed drafts resolved through the deterministic catalog and normal approval pipeline.

### 10. Admin as a Hidden Route in the Public App

**Mistake:** Share deployment, session policy, and broad API client between public/account and admin surfaces.  
**Why it fails:** Public application compromise expands directly into operational control.  
**Instead:** Separate deployment, hostname, CSP, identity policy, API audience, and least-privilege roles.

### 11. Shared Database as an Unbounded Integration Bus

**Mistake:** Let every module query and mutate every table.  
**Why it fails:** The “modular monolith” becomes a distributed codebase with invisible coupling and impossible extraction.  
**Instead:** Module-owned schemas/repositories and explicit APIs/events.

### 12. Premature AWS and Microservice Complexity

**Mistake:** Provision the final multi-account, multi-service topology before users or revenue.  
**Why it fails:** A solo developer spends budget and time operating infrastructure instead of validating product.  
**Instead:** Encode the target topology in CDK, exercise it in CI, and provision incrementally at alpha/beta gates.

### 13. Licensing Coupled to Safety

**Mistake:** Disable history or rollback when Premium expires or cloud validation fails.  
**Why it fails:** Billing state can strand a modified system and damages trust.  
**Instead:** License new Premium actions; keep safety/recovery local and available.

### 14. “Exactly Once” Assumptions

**Mistake:** Assume SQS, EventBridge, webhooks, or clients deliver once and in order.  
**Why it fails:** Duplicates and retries produce double billing actions, repeated device resets, or inconsistent projections.  
**Instead:** Idempotency keys, durable inbox/outbox, monotonic versions, DLQs, replay tools, and operation commutativity where possible.

## Decisions That Need Focused Spikes

| Spike | Decision Gate | Evidence Required |
|---|---|---|
| TS/Rust schema generation | Exact generator/toolchain | Union/bounds/unknown-field parity, generated client quality, migration story |
| Windows privileged IPC | Named-pipe protocol and caller attestation | Adversarial same-user tests, ACL correctness, replay/downgrade resistance |
| Service identity | LocalSystem vs virtual/service account plus temporary privilege elevation | Minimum operations supported, token privileges, recovery behavior |
| Local journal | SQLite/WAL and encryption/ACL strategy | Crash consistency, disk-full, corruption, reboot recovery, performance |
| Device binding | Opaque fingerprint and device key | Hardware-change tolerance, privacy review, reset abuse resistance |
| Better Auth | Production identity adapter | Desktop PKCE, passkeys, MFA, session rotation, revocation, admin requirements |
| Profile signing | Key algorithm, hierarchy, KMS/HSM/release workflow | Offline recovery, revocation, rotation, independent app/profile trust roots |
| Game process detection | ETW/WMI/native notification strategy | Idle overhead, launcher trees, multi-instance, Windows 10/11 reliability |
| Measurement | Permitted FPS/frametime/system metrics | Anti-cheat safety, accuracy, overhead, unsupported-game behavior |

## Sources

Primary official references used for the architectural boundaries:

- Tauri v2, Capabilities: https://v2.tauri.app/security/capabilities/
- Tauri v2, Permissions: https://v2.tauri.app/security/permissions/
- Tauri v2, Inter-Process Communication: https://v2.tauri.app/concept/inter-process-communication/
- Tauri v2, Isolation Pattern: https://v2.tauri.app/concept/inter-process-communication/isolation/
- Tauri v2, Content Security Policy: https://v2.tauri.app/security/csp/
- Tauri v2, Updater plugin: https://v2.tauri.app/plugin/updater/
- Microsoft, Service Security and Access Rights: https://learn.microsoft.com/en-us/windows/win32/services/service-security-and-access-rights
- Microsoft, Named Pipe Security and Access Rights: https://learn.microsoft.com/en-us/windows/win32/ipc/named-pipe-security-and-access-rights
- Microsoft, Impersonating a Named Pipe Client: https://learn.microsoft.com/en-us/windows/win32/ipc/impersonating-a-named-pipe-client
- Microsoft, CryptProtectData (Data Protection API): https://learn.microsoft.com/en-us/windows/win32/api/dpapi/nf-dpapi-cryptprotectdata
- JSON Schema, Draft 2020-12: https://json-schema.org/draft/2020-12
- OpenAPI Initiative, OpenAPI 3.1 specification: https://spec.openapis.org/oas/v3.1.0
- PostgreSQL, Constraints: https://www.postgresql.org/docs/current/ddl-constraints.html
- PostgreSQL, Transaction Isolation: https://www.postgresql.org/docs/current/transaction-iso.html
- AWS Security Reference Architecture: https://docs.aws.amazon.com/prescriptive-guidance/latest/security-reference-architecture/welcome.html
- AWS, Organizing Your AWS Environment Using Multiple Accounts: https://docs.aws.amazon.com/whitepapers/latest/organizing-your-aws-environment/organizing-your-aws-environment.html
- AWS IAM, GitHub Actions OIDC federation: https://docs.aws.amazon.com/IAM/latest/UserGuide/id_roles_providers_create_oidc.html
- AWS SQS, At-least-once delivery: https://docs.aws.amazon.com/AWSSimpleQueueService/latest/SQSDeveloperGuide/standard-queues-at-least-once-delivery.html
- AWS SQS, Dead-letter queues: https://docs.aws.amazon.com/AWSSimpleQueueService/latest/SQSDeveloperGuide/sqs-dead-letter-queues.html
- Amazon EventBridge retry policy and DLQs: https://docs.aws.amazon.com/eventbridge/latest/userguide/eb-rule-retry-policy.html
- CloudEvents specification: https://github.com/cloudevents/spec
- OpenTelemetry specification: https://opentelemetry.io/docs/specs/otel/

## Confidence Notes

The macro boundaries are supported by official Tauri, Microsoft, PostgreSQL, and AWS guidance. Confidence remains **MEDIUM**, not HIGH, because three project-specific mechanisms require experiments before they can be fixed safely: identical schema behavior across TypeScript and Rust, same-user caller attestation for privileged local IPC, and reliable low-overhead game/session measurement across Windows 10/11 and anti-cheat environments.

---

*Architecture research for Liiiraa Boost*  
*Researched: 2026-07-26*
