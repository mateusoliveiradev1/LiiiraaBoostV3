# Stack Research

**Domain:** Secure Windows 10/11 gaming optimizer, global SaaS control plane, and premium product UI  
**Project:** Liiiraa Boost  
**Researched:** 2026-07-26  
**Confidence:** MEDIUM

## Executive Recommendation

Build one modular monorepo with four deliberately different runtime surfaces:

1. A Tauri 2 desktop shell with a React/Vite UI and an unprivileged Rust host.
2. A separate, minimal Windows service in Rust for privileged operations. The UI never runs elevated.
3. A Fastify modular monolith for accounts, licensing, profiles, releases, support, and administration.
4. Two isolated Next.js deployments: public/account web and administration.

Use TypeSpec as the language-neutral contract source, emitting OpenAPI 3.1 and JSON Schema. Generated TypeScript clients/types, generated Rust models, runtime schema validation, and breaking-change checks must all derive from those artifacts. Keep domain invariants in the owning module rather than duplicating them in transport types.

The version table is a researched snapshot, not permission to auto-upgrade. Renovate may propose upgrades, but the lockfile, Rust toolchain, generated contracts, screenshots, and signed release pipeline move only after all gates pass.

## Recommended Stack

### Runtime and Core Frameworks

| Technology | Version baseline | Purpose | Why recommended |
|---|---:|---|---|
| Node.js | 24.18.0 LTS | JS/TS build, web, API, workers, CDK | Current LTS satisfies the stricter Vite, Kysely, and Connect/Fastify engine ranges. Do not use the non-LTS Node 26 line for production yet. |
| pnpm | 11.17.0 | JS package manager and workspaces | Strict, fast, disk-efficient dependency graph; good monorepo filtering and deterministic lockfile behavior. Pin through `packageManager`. |
| Rust | 1.97.1 stable | Desktop host, Windows service, local engine | Memory-safe systems implementation with direct Win32 access. Pin through `rust-toolchain.toml`; do not track nightly. |
| Tauri | Rust crate 2.11.5; CLI 2.11.4; JS API 2.11.1 | Installable Windows desktop shell | Far lighter than Electron and compatible with a bespoke React UI. Tauri capabilities provide a deny-by-default boundary around native commands. |
| React | 19.2.8 | Shared product UI runtime | Current stable React shared by desktop and Next.js surfaces. |
| Vite | 8.1.5 | Desktop UI development/build | Small, fast frontend build independent of Next.js server assumptions; requires Node `^20.19 || >=22.12`, satisfied by Node 24 LTS. |
| Next.js | 16.2.12 | Public/account web and isolated admin | Current stable release with React 19 support and first-class server rendering. Deploy web and admin separately. |
| TypeScript | **6.0.3 compatibility pin** | Strict typing across JS surfaces | TypeScript 7.0.2 is the registry latest, but `@typescript-eslint/*` 8.65.0 declares `<6.1.0`. Use 6.0.3 until the complete lint/build/test toolchain officially supports 7.x. |
| Fastify | 5.10.0 | Modular-monolith API and worker HTTP endpoints | Low overhead, schema-oriented request handling, strong plugin encapsulation, and fewer framework abstractions than NestJS. |
| PostgreSQL | 18.x managed minor | Authoritative cloud datastore | Explicit constraints, transactions, row locking, JSON support, mature tooling, and a clean path from Neon previews to AWS RDS/Aurora. Never pin an old minor; follow managed security patching. |
| SQLite | rusqlite 0.40.1 | Local diagnostics, plans, history, recovery journal | Reliable local-first persistence without a server. Use WAL, explicit migrations, bounded retention, and never store auth secrets as plaintext rows. |

### Windows Desktop and Local Engine

| Library/tool | Version | Purpose | When to use |
|---|---:|---|---|
| `windows` | 0.62.2 | Generated Win32/COM bindings | Hardware inventory, services, registry, process, power, event, and security APIs. Prefer documented APIs over shelling out. |
| `windows-service` | 0.8.1 | Windows service lifecycle | The small privileged broker only; keep optimizer domain logic in non-elevated/testable crates where possible. |
| Tokio | 1.53.1 | Async runtime and Windows named pipes | Service IPC, bounded jobs, cancellation, and background orchestration. Avoid async in pure calculation modules. |
| Serde / `serde_json` | 1.0.229 / 1.0.151 | Generated contract serialization | TypeSpec-derived JSON command/control messages and durable local documents. |
| `jsonschema` | 0.49.1 | Rust runtime schema validation | Validate every external, downloaded, migrated, or cross-process document before domain execution. |
| `typify` | 0.7.0 | JSON Schema to Rust model generation | Generate transport types from emitted schemas; check generated output into a reviewable package or verify drift in CI. |
| `rusqlite_migration` | 2.6.0 | Local database migrations | Version the local state and recovery journal with upgrade tests from every supported app version. |
| `keyring` | 4.1.5 | OS-backed credential storage | Store refresh tokens or small secrets in Windows Credential Manager; use Windows CNG/TPM-backed keys later for device identity. |
| `zeroize` / `secrecy` | 1.9.0 / 0.10.3 | Secret handling | Minimize accidental logging and lifetime of sensitive in-memory values. |
| `tracing` / `tracing-subscriber` | 0.1.44 / 0.3.23 | Structured local diagnostics | Correlated logs with aggressive redaction; game-time logging must be low volume. |
| `tauri-plugin-updater` | 2.10.1 | Signed update client | Stable/beta/experimental channels with immutable signed manifests and staged rollout. |
| `tauri-plugin-single-instance` | 2.4.3 | Single desktop instance | Route subsequent launches and deep links to the active process. |

The privileged service must expose a narrow, versioned, allowlisted protocol over a Windows named pipe with an explicit security descriptor. Authenticate the caller, bind requests to the installed product identity, validate every payload, apply timeouts/cancellation, and audit privileged operations. Never expose PowerShell, `cmd.exe`, a generic registry writer, arbitrary filesystem paths, or arbitrary service names as protocol operations.

### Product UI

| Library | Version | Purpose | When to use |
|---|---:|---|---|
| Tailwind CSS | 4.3.3 | Token-backed utility infrastructure | Implement Liiiraa Boost tokens in CSS custom properties/OKLCH. It is infrastructure, not the visual language. |
| React Aria Components | 1.19.0 | Accessible headless interaction primitives | Menus, dialogs, lists, tabs, comboboxes, tooltips, and keyboard/focus behavior without adopting a stock visual system. |
| TanStack Query | 5.101.4 | Async state/cache | Tauri commands, API queries, retries, invalidation, and explicit offline states. Do not put server state in a global UI store. |
| TanStack Router | 1.170.18 | Typed desktop navigation | Desktop-only route tree, search state, deep links, and testable navigation. Next.js continues to use the App Router. |
| XState / `@xstate/react` | 5.32.5 / 6.1.0 | Safety-critical workflows | Calibration, plan review/apply, restart scheduling, failure recovery, rollback, and high-risk confirmation flows. |
| Motion | 12.42.2 | Purposeful UI motion | Small state transitions and spatial continuity, always respecting reduced motion; never animate live telemetry decoratively. |
| uPlot | 1.6.32 | Efficient dense time-series charts | Frametime and telemetry charts where measured performance proves SVG/DOM charts too costly. Wrap it behind an authored chart component. |
| React Hook Form | 7.83.0 | Complex forms | Account/settings/admin forms; combine with contract-derived validation rather than handwritten duplicate DTO schemas. |
| `next-intl` | 4.13.4 | Next.js localization | PT-BR and English on web/admin with extraction and missing-key CI. Desktop should use a framework-neutral message catalog package shared at the message-source level. |

Do not adopt shadcn/ui, Material UI, Ant Design, Chakra, Bootstrap, or a dashboard template. React Aria supplies behavior only; every component, spacing rule, hierarchy, state treatment, chart treatment, and interaction pattern remains authored for Liiiraa Boost under the `impeccable` design process.

### Contracts and End-to-End Typing

| Technology | Version | Purpose | Rule |
|---|---:|---|---|
| TypeSpec compiler and emitters | 1.14.0 | Canonical language-neutral definitions | Own HTTP APIs, desktop commands, privileged-service messages, events, signed profile envelopes, and durable exchange documents in bounded TypeSpec libraries. |
| OpenAPI 3.1 emission | TypeSpec 1.14.0 | HTTP contract artifact | Fastify routes and generated clients consume the emitted artifact; never maintain a second handwritten API spec. |
| JSON Schema emission | TypeSpec 1.14.0 | Non-HTTP contract artifact | Tauri IPC, service IPC, signed profiles, support bundles, and persisted documents use emitted schemas. |
| Ajv | 8.20.0 | TypeScript runtime validation | Compile emitted schemas once and validate all untrusted boundaries. |
| `@hey-api/openapi-ts` | 0.99.0 | Generated TS API client | Generate a small typed client package; pin generator output and test regeneration drift. |
| `typify` + `jsonschema` | 0.7.0 / 0.49.1 | Rust model generation and validation | Generated Rust transport models plus runtime validation for untrusted documents. |
| oasdiff | 1.26.0 | API compatibility gate | CI blocks unapproved breaking changes and produces a reviewable change report. |

Use TypeSpec for contracts that cross a language, process, trust boundary, or persistence-version boundary. Internal TypeScript-only helper types and Rust-only domain value objects remain native to their module.

Protobuf/Buf is not the default. It adds another transport and validation ecosystem while the product's command/control traffic fits JSON well. Reconsider Protobuf only if measurements later prove a specific binary telemetry channel needs it; keep that channel separate from the safety-critical control protocol.

### Backend, Auth, Data, and Cache

| Technology | Version | Purpose | Why/constraints |
|---|---:|---|---|
| Kysely | 0.29.4 | Typed SQL query builder | Preserves visible SQL and transactions instead of hiding the database model behind an active-record abstraction. Requires Node >=22; Node 24 LTS satisfies it. |
| `pg` | 8.22.0 | PostgreSQL driver/pool | Mature Kysely PostgreSQL dialect. Apply statement/transaction timeouts and module-owned repositories. |
| Better Auth | 1.6.25, **conditional** | User authentication, sessions, social login, passkeys/MFA | Strong candidate compatible with Next 16/React 19, but production adoption depends on a dedicated OAuth 2.1 native-client, PKCE, passkey, MFA, recovery, session-revocation, and abuse-resistance spike. |
| Valkey | upstream 9.1.1; AWS-supported engine selected at provisioning | Cache, ephemeral rate limits, coordination | Never a source of truth. Namespace/TTL/ownership are mandatory. Do not provision before measured need. |
| Neon PostgreSQL | managed | Development and per-PR preview databases | Fast isolated branches; production data remains in AWS-managed PostgreSQL. Migration tests must run against plain PostgreSQL too. |
| AWS RDS PostgreSQL | PostgreSQL 18 supported minor | First production database | Lower operational complexity than premature Aurora. Multi-AZ, PITR, KMS, private networking, and audited access for paid production. |
| Aurora PostgreSQL | compatible major selected later | Scale-out production option | Adopt only when connection, read scale, recovery, or regional requirements justify its cost and migration rehearsal passes. |

Better Auth must not become the product-domain boundary. Hide it behind an identity port owned by the identity module. The desktop signs in through the system browser using Authorization Code + PKCE; it has no client secret and never renders credentials in the Tauri WebView. Admin requires phishing-resistant MFA/passkeys, stricter session policy, separate origin, and auditable just-in-time authorization.

### Web and API Deployment

| Surface | Deployment | Notes |
|---|---|---|
| `apps/web` | Independent Next.js standalone artifact | Marketing, docs, account, subscription, downloads, devices, and support. Cache only public content at the edge. |
| `apps/admin` | Independent Next.js artifact and origin | Separate hostname, deployment, CSP, cookies, access policy, and authorization. It is never a hidden route in `apps/web`. |
| `apps/api` | Fastify modular monolith on ECS/Fargate | One deployable initially, internally split by identity, billing, devices, profiles, releases, support, audit, and AI boundaries. |
| Workers | ECS/Fargate worker process | Long-running queue consumers and jobs needing predictable resources. |
| Event tasks | Lambda | Short, isolated, event-driven tasks only. Do not force every request into Lambda. |
| Messaging | SQS + EventBridge | Durable work queues plus domain/integration events; transactional outbox prevents database/event divergence. |
| Artifacts | S3 with immutable object versions | Installers, updater artifacts, signed profile bundles, SBOMs, and support packages with constrained presigned access. |

### Infrastructure and Edge

| Technology | Version | Purpose | Recommendation |
|---|---:|---|---|
| AWS CDK | 2.262.1 | AWS infrastructure as code | TypeScript constructs for organizations/bootstrap, network, data, compute, messaging, artifacts, security, and observability. Add assertions and `cdk-nag`; review synthesized changes. |
| OpenTofu | 1.12.5 | Cloudflare infrastructure as code | Use only for Cloudflare resources because AWS CDK does not natively manage them. Keep a remote locked state and a narrow provider token. |
| Cloudflare provider | 5.22.0 | DNS, CDN, WAF, DDoS, Access, Turnstile | Origins must reject direct public access. Keep edge configuration separate from application code and AWS stacks. |
| GitHub Actions | hosted Windows/Linux runners | CI/CD | Use OIDC to AWS, SHA-pinned actions, protected environments, no long-lived cloud keys, and clean Windows release jobs. |
| AWS Organizations | managed service | Account isolation | Separate management, security, log archive, non-production, staging, and production before storing paid-customer data. |

Pre-beta infrastructure should be local plus free/low-cost hosted development services. Do not provision Fargate, RDS, NAT gateways, managed Valkey, multi-account production, or observability vendors merely to prove architecture. CDK/OpenTofu synth and policy tests can run before deployment.

### Observability

| Technology | Version | Purpose | Policy |
|---|---:|---|---|
| OpenTelemetry API | JS 1.9.1 | Vendor-neutral instrumentation API | Application modules depend on APIs/semantic conventions, not a backend SDK. |
| OpenTelemetry Node SDK | 0.221.0 | API/worker traces, metrics, logs | Export OTLP through a collector; configure sampling and PII scrubbing centrally. |
| Rust `opentelemetry` | 0.32.0 | Rust telemetry bridge | Combine with `tracing`; desktop export is opt-in and disabled or reduced during games. |
| OpenTelemetry Collector | compatible stable image, digest-pinned | Routing, batching, redaction, sampling | Put the collector between workloads and the selected storage/backend. |

Start locally with structured logs, traces in test environments, and inexpensive AWS-native retention. Select a hosted backend later by actual volume and operator needs. Sentry may be added for crashes, but it does not replace OpenTelemetry and desktop reporting remains explicit opt-in.

### Testing and Quality Gates

| Tool | Version | Gate |
|---|---:|---|
| Vitest | 4.1.10 | TypeScript unit, integration, fixture, and contract adapter tests |
| Storybook / React-Vite | 10.5.4 | Complete component/state catalog, interaction tests, and design-system review |
| Playwright | 1.62.0 | Web/admin E2E, desktop webview flows where applicable, deterministic screenshot regression |
| `@axe-core/playwright` | 4.12.1 | Automated WCAG checks; supplement with keyboard, screen-reader, zoom, contrast, and reduced-motion manual tests |
| MSW | 2.15.0 | Deterministic browser fixtures and typed simulated adapters in the visual milestone |
| Testcontainers | 12.0.4 | PostgreSQL/Valkey integration tests and migration verification |
| `tauri-driver` | 2.0.6 | Packaged Tauri E2E on clean Windows 10/11 runners with matching WebDriver |
| `cargo-nextest` | 0.9.140 | Fast, isolated Rust test execution |
| `proptest` | 1.11.0 | Apply/revert idempotency, serialization, plan ordering, and state-machine properties |
| `insta` | 1.48.0 | Human-reviewable Rust snapshots for plans, diffs, errors, and audit records |
| `cargo-deny` / `cargo-audit` | 0.20.2 / 0.22.2 | Rust licenses, duplicate/source policies, and vulnerability advisories |
| ESLint / typescript-eslint | 10.8.0 / 8.65.0 | Type-aware TypeScript rules, forbidden imports, and architectural boundaries |
| dependency-cruiser | 18.1.0 | Cross-package dependency graph and cycle enforcement |
| Prettier | 3.9.6 | One deterministic formatter for JS/TS/JSON/Markdown; do not add a second competing formatter |

Required release gates include strict typecheck, lint, formatting, unit/integration/property tests, contract regeneration drift, OpenAPI breaking checks, SQL migration up/down/restore rehearsal, visual regression, accessibility, Windows 10/11 E2E, updater-from-last-supported-version E2E, dependency/license audit, CodeQL, secret scanning, SBOM generation, artifact signature verification, and reproducibility/provenance evidence.

## Monorepo and Module Rules

Use pnpm workspaces + Turborepo for JS/TS and a root Cargo Workspace for Rust. Turborepo orchestrates tasks; it does not define architecture.

Recommended top-level shape:

```text
apps/
  desktop-ui/        # React/Vite presentation and desktop routes
  desktop-shell/     # Tauri host; minimal IPC adapters
  web/               # public/account Next.js deployment
  admin/             # isolated Next.js admin deployment
  api/               # Fastify modular monolith composition root
  worker/            # asynchronous composition root
crates/
  windows-service/   # elevated process composition root
  engine-*/          # capability, plan, operation, recovery domains
  platform-windows/  # Win32 adapters
  local-store/       # SQLite/recovery persistence
packages/
  contracts-source/  # TypeSpec only
  contracts-ts/      # generated; no manual edits
  design-system/     # authored primitives, tokens, accessibility behavior
  feature-*/         # UI feature modules
  test-fixtures/     # deterministic, versioned scenarios
  observability/
  config-*/
infra/
  aws-cdk/
  cloudflare-tofu/
```

Every module exposes a public entry point. Domain packages do not import apps, adapters, database clients, Tauri, Fastify, Next.js, or AWS SDKs. Composition roots connect ports to adapters. Generated packages are read-only. CI rejects dependency cycles, deep imports, undeclared cross-domain database access, and contract drift.

## Desktop Signing and Update Chain

Two independent signatures are required:

1. Windows Authenticode signs executables/installers so Windows can identify the publisher.
2. Tauri updater signatures authenticate update artifacts/manifests to the installed client.

Use a reputable hardware-backed code-signing path at production launch. Keep the Tauri updater private key and code-signing authorization out of the repository and ordinary developer machines. Release jobs run in a protected Windows environment, use short-lived identity, produce SBOM/provenance, sign once, verify independently, and publish immutable artifacts.

Maintain separate stable, beta, and experimental manifests. Channels promote the exact same artifact digest; they do not rebuild it. Roll out in cohorts, halt automatically on crash/update-health thresholds, retain at least the previous supported signed artifact, and test upgrading from every supported previous version. A failed subscription check must never block a safety update or rollback.

## Version Compatibility

| Pair | Compatibility decision |
|---|---|
| Node 24.18 LTS + Vite 8.1 | Supported by Vite's `^20.19 || >=22.12` engine range. |
| Node 24.18 LTS + Kysely 0.29 | Supported; Kysely requires Node >=22. |
| Next 16.2 + React 19.2 | Supported by Next's React 19 peer range. |
| TypeScript 7.0 + typescript-eslint 8.65 | **Not supported by the declared peer range** (`<6.1`). Hold TypeScript at 6.0.3. |
| Tauri 2.11 + Rust 1.97 | Supported; Tauri's declared MSRV is lower, but pin current stable for security/tooling consistency. |
| tonic 0.14 + Rust 1.97 | Compatible, but tonic/Protobuf is not required in the initial architecture. |
| SQLx 0.9 + Rust 1.97 | Compatible by MSRV, but use `rusqlite` locally and Kysely/`pg` in the cloud to avoid introducing a third query abstraction without need. |
| Better Auth 1.6 + Next 16/React 19/Vitest 4 | Peer ranges include these versions; native desktop OAuth behavior still requires the security spike. |
| Storybook 10.5 + Vite 8 + React 19 | Declared peer ranges support this combination. |
| Fastify 5.10 + Connect Fastify 2.1 | Compatible if Connect is later introduced; do not add it without a Protobuf use case. |

## Stack Patterns by Delivery Stage

### Visual desktop milestone

- Build the real Tauri shell and complete React UI.
- Use TypeSpec-generated contracts, MSW/deterministic adapters, Storybook, Playwright screenshots, axe checks, and Tauri E2E.
- Persist only benign UX preferences if needed; do not fake privileged operations or create a throwaway backend.
- Model loading, offline, unsupported, permission, partial failure, restart, expired license, and rollback states now.

### Web platform milestone

- Build independent `web` and `admin` deployments against the same generated contracts.
- Run Fastify/PostgreSQL locally and Neon per preview.
- Keep payment providers, email, object storage, and identity behind ports with test doubles.
- Complete the Better Auth security spike before production identity data exists.

### Private beta

- Provision AWS accounts and least-privilege OIDC deployment roles.
- Start with RDS PostgreSQL and ECS/Fargate; add Lambda/SQS/EventBridge only for concrete workflows.
- Activate Cloudflare WAF/Access/Turnstile through OpenTofu.
- Introduce managed Valkey only after a rate-limit/cache/lock requirement is measured.

### Scale

- Scale the modular monolith horizontally and separate read-heavy or asynchronous workers first.
- Extract a service only when ownership, load, failure isolation, or deployment cadence is proven by evidence.
- Evaluate Aurora, regional data placement, and a hosted observability backend when operational metrics justify them.

## Alternatives Considered

| Category | Recommended | Alternative | When the alternative is justified |
|---|---|---|---|
| Desktop | Tauri 2 + Rust + React | WinUI 3/.NET | Choose WinUI if native Windows control fidelity becomes more important than shared bespoke UI and cross-surface design code. |
| Desktop | Tauri 2 | Electron | Only if a required browser/Node capability cannot be provided safely through Tauri and measured memory cost becomes acceptable. |
| API | Fastify modular monolith | NestJS | Use Nest only if a larger team needs its enforced conventions enough to justify decorators, DI container, and framework weight. |
| Contracts | TypeSpec → OpenAPI/JSON Schema | Protobuf + Buf | Use for a measured binary/high-throughput channel or multi-language RPC ecosystem; keep it out of ordinary UI/control traffic. |
| SQL | Kysely + explicit migrations | Drizzle | Drizzle is reasonable if its schema/migration workflow proves more maintainable in a dedicated spike without hiding constraints. |
| SQL | Kysely | Prisma ORM | Use only if rapid CRUD productivity clearly outweighs explicit SQL/control requirements; not recommended for this domain. |
| Auth | Better Auth behind a port | Auth0/Cognito | Switch if the security spike, external audit, operational burden, or compliance needs exceed a solo maintainer's safe capacity. |
| AWS IaC | AWS CDK | OpenTofu for all cloud resources | Prefer all-OpenTofu if multi-cloud portability becomes a real requirement; CDK remains better aligned with the approved TypeScript/AWS focus. |
| Cloudflare IaC | OpenTofu provider | Manual dashboard | Manual configuration is acceptable only for a disposable experiment, never staging/production. |
| Local data | SQLite | Flat JSON files | Flat files are acceptable only for immutable fixtures, never transactional recovery or audit history. |
| State | TanStack Query + local state + XState for workflows | Redux everywhere | Redux is justified only if a large amount of truly global client state appears; it should not duplicate server or machine state. |

## What NOT to Use

| Avoid | Why | Use instead |
|---|---|---|
| TypeScript 7.0.2 immediately | Current typescript-eslint peer range excludes it; "latest" would break the verified toolchain contract. | TypeScript 6.0.3 until all critical peers support 7.x. |
| Electron | Violates the lightweight product budget and expands the embedded runtime/update surface. | Tauri 2 with narrowly exposed Rust commands. |
| Running the entire UI as administrator | A WebView or renderer compromise would inherit system-wide power. | Unprivileged UI plus a minimal authenticated privileged service. |
| Generic remote scripts/PowerShell | Turns profile distribution or admin compromise into remote code execution. | Signed declarative profiles mapped to compiled allowlisted engine operations. |
| Generic registry/file/service RPC methods | They are script execution by another name and impossible to reason about safely. | Operation-specific commands with capability checks and exact rollback logic. |
| Microservices from day one | Adds deployments, networking, tracing, consistency, and local-development burden for one developer. | Modular monolith plus workers, transactional outbox, and enforceable boundaries. |
| Prisma schema as the database authority | Risks hiding SQL, constraints, indexes, and migration behavior central to licensing/audit correctness. | PostgreSQL constraints + reviewed SQL migrations + Kysely. |
| Redis/Valkey as truth | Eviction or outage would corrupt licensing, cooldown, or billing decisions. | PostgreSQL authority; cache only reconstructable/ephemeral state. |
| Tauri Store/localStorage for audit and recovery | Key-value storage lacks the transaction/migration guarantees needed for rollback history. | SQLite with migrations and an append-oriented recovery journal. |
| Next.js for the desktop UI | Pulls server-framework assumptions into a static Tauri frontend and complicates packaging. | React + Vite for desktop; Next.js only for web/admin. |
| Shared admin route in public web | A hidden route is not an isolation boundary. | Separate deployment, origin, CSP, cookies, access policy, and authorization. |
| shadcn/ui or dashboard templates | Produces the generic component-library look explicitly rejected by the product brief. | React Aria behavior plus a bespoke design system. |
| Blanket telemetry or high-frequency game-time export | Harms trust, privacy, and potentially performance. | Local-first metrics, adaptive sampling, explicit consent, bounded OTLP export. |
| Unsigned installers or updater manifests | Enables tampering and destroys user trust. | Authenticode + Tauri updater signatures + immutable artifacts. |
| GitHub Actions using long-lived AWS keys | Creates unnecessary credential exposure. | OIDC federation and protected environment roles. |
| Cloudflare dashboard drift | Security behavior becomes unauditable and irreproducible. | OpenTofu-managed edge configuration. |
| Canary/nightly framework versions in production | Expands instability in an already high-risk systems product. | Latest mutually compatible stable versions, exact lockfiles, staged upgrades. |

## Installation Outline

Do not install everything in phase one. Bootstrap only the packages required by the current milestone and add infrastructure/runtime dependencies when their owning phase begins.

```bash
# Toolchains
corepack use pnpm@11.17.0
rustup toolchain install 1.97.1

# Root orchestration and compatible TS lint baseline
pnpm add -Dw turbo@2.10.7 typescript@6.0.3 eslint@10.8.0 \
  @typescript-eslint/parser@8.65.0 @typescript-eslint/eslint-plugin@8.65.0 \
  prettier@3.9.6 dependency-cruiser@18.1.0

# Desktop UI milestone
pnpm --filter desktop-ui add react@19.2.8 react-dom@19.2.8 \
  @tauri-apps/api@2.11.1 @tanstack/react-query@5.101.4 \
  @tanstack/react-router@1.170.18 react-aria-components@1.19.0 \
  xstate@5.32.5 @xstate/react@6.1.0 motion@12.42.2
pnpm --filter desktop-ui add -D vite@8.1.5 @vitejs/plugin-react@6.0.4 \
  tailwindcss@4.3.3 @tailwindcss/vite@4.3.3 vitest@4.1.10 \
  @playwright/test@1.62.0 @axe-core/playwright@4.12.1 msw@2.15.0

# Contract source/generation
pnpm --filter contracts-source add -D @typespec/compiler@1.14.0 \
  @typespec/http@1.14.0 @typespec/openapi3@1.14.0 \
  @typespec/json-schema@1.14.0

# Web/API milestone, not phase one
pnpm --filter web add next@16.2.12 react@19.2.8 react-dom@19.2.8
pnpm --filter admin add next@16.2.12 react@19.2.8 react-dom@19.2.8
pnpm --filter api add fastify@5.10.0 kysely@0.29.4 pg@8.22.0 better-auth@1.6.25

# Rust dependencies are added to the owning crate only
cargo add -p desktop-shell tauri@2.11.5 serde@1.0.229 serde_json@1.0.151
cargo add -p windows-service windows@0.62.2 windows-service@0.8.1 tokio@1.53.1
```

Use platform-appropriate command continuation when executing; the block is a dependency map, not a ready-to-run PowerShell script. Exact features for `windows`, Tokio, Tauri plugins, and SQLite must be minimized per crate rather than enabled globally.

## Mandatory Spikes Before Irreversible Choices

1. **Contract generation spike:** one TypeSpec operation and one signed profile document generated to TS and Rust, runtime-validated on both sides, with an intentional breaking change caught in CI.
2. **Privileged IPC spike:** unprivileged Tauri host to Windows service over a secured named pipe; prove caller authentication, cancellation, replay resistance, audit, and rejection of malformed/unauthorized messages.
3. **Better Auth native-client spike:** system-browser Authorization Code + PKCE, passkey/MFA, device revocation, seven-day offline entitlement behavior, account recovery, and admin hardening. Fail closed to an external OIDC provider if gates are not met.
4. **Windows packaging/update spike:** signed installer and Tauri updater artifact, channel promotion by digest, upgrade from the previous version, interrupted update, failed signature, and rollback on clean Windows 10/11.
5. **Performance budget spike:** cold/warm startup, idle CPU/RAM, tray/service memory, WebView2 variability, and game-time sampling overhead on low/mid/high hardware.
6. **PostgreSQL migration spike:** migrate from empty and previous snapshots, restore from backup, validate constraints/indexes, and run identical migrations on container PostgreSQL, Neon, and AWS target major.

## Sources

### Official release and registry sources

- [npm registry API](https://registry.npmjs.org/) — exact npm dist-tags, engine ranges, and peer dependency ranges queried on 2026-07-26.
- [crates.io API](https://crates.io/api/v1/crates) — exact stable crate versions and Rust-version metadata queried on 2026-07-26.
- [Rust stable channel manifest](https://static.rust-lang.org/dist/channel-rust-stable.toml) — Rust 1.97.1 stable release metadata.
- [Node.js release index](https://nodejs.org/dist/index.json) — Node 24.18.0 LTS status.
- [PostgreSQL versioning policy](https://www.postgresql.org/support/versioning/) — supported-major and minor-update policy.
- [Amazon RDS for PostgreSQL release calendar](https://docs.aws.amazon.com/AmazonRDS/latest/PostgreSQLReleaseNotes/postgresql-release-calendar.html) — AWS engine support/release planning.
- [Valkey releases](https://github.com/valkey-io/valkey/releases) — upstream release snapshot; AWS support must still be checked at provisioning.

### Official framework and platform documentation

- [Tauri prerequisites](https://v2.tauri.app/start/prerequisites/) — Windows/Rust/Node prerequisites.
- [Tauri security](https://v2.tauri.app/security/) — capability and trust-boundary guidance.
- [Tauri updater](https://v2.tauri.app/plugin/updater/) — updater signatures, endpoints, and configuration.
- [Tauri Windows code signing](https://v2.tauri.app/distribute/sign/windows/) — Authenticode requirements and signing configuration.
- [Next.js documentation](https://nextjs.org/docs) — supported runtime and deployment model.
- [Vite guide](https://vite.dev/guide/) — current Node engine requirements.
- [Fastify validation and serialization](https://fastify.dev/docs/latest/Reference/Validation-and-Serialization/) — schema validation/serialization model and warnings.
- [Kysely documentation](https://kysely.dev/) — typed SQL scope and dialect model.
- [Better Auth OAuth 2.1 Provider](https://www.better-auth.com/docs/plugins/oauth-provider) — OAuth/OIDC/PKCE candidate capability.
- [Better Auth Passkey plugin](https://www.better-auth.com/docs/plugins/passkey) — passkey candidate capability.
- [TypeSpec documentation](https://typespec.io/docs/) — language-neutral API modeling and emitters.
- [OpenTelemetry documentation](https://opentelemetry.io/docs/what-is-opentelemetry/) — vendor-neutral traces, metrics, and logs.

### Infrastructure, testing, and supply chain

- [AWS CDK v2 guide](https://docs.aws.amazon.com/cdk/v2/guide/home.html) — CDK application and construct model.
- [AWS GitHub Actions OIDC guidance](https://docs.aws.amazon.com/IAM/latest/UserGuide/id_roles_providers_create_oidc.html) — short-lived CI federation.
- [Cloudflare Terraform provider](https://github.com/cloudflare/terraform-provider-cloudflare) — supported IaC provider for Cloudflare resources.
- [OpenTofu releases](https://github.com/opentofu/opentofu/releases) — current OpenTofu release.
- [Playwright documentation](https://playwright.dev/docs/intro) — browser E2E and screenshot testing.
- [Tauri WebDriver testing](https://v2.tauri.app/develop/tests/webdriver/) — `tauri-driver` desktop E2E.
- [Storybook documentation](https://storybook.js.org/docs) — component state catalog and interaction testing.
- [Buf breaking-change documentation](https://buf.build/docs/breaking/) — evaluated for the Protobuf alternative.
- [oasdiff releases](https://github.com/oasdiff/oasdiff/releases) — OpenAPI breaking-change gate.
- [Sigstore Cosign releases](https://github.com/sigstore/cosign/releases) — artifact signature/provenance tooling.
- [Syft releases](https://github.com/anchore/syft/releases) — SBOM generation.
- [OSV-Scanner releases](https://github.com/google/osv-scanner/releases) — dependency vulnerability scanning.

## Confidence Notes and Open Questions

- Exact version and peer/engine claims are registry-backed snapshots, but ecosystem versions will move; compatibility is therefore deliberately pinned and gated rather than assumed.
- TypeSpec is the recommended contract source, but Rust generation and Tauri/service ergonomics require the mandatory spike before the architecture is frozen.
- Better Auth is promising and compatible at the package level, but self-hosted native-client identity carries operational/security responsibility; approval remains conditional.
- The production Authenticode provider, observability backend, payment provider, email provider, and final AWS PostgreSQL flavor should be selected near their implementation phase through security/cost spikes.
- Windows 10 support depends on real WebView2, installer, driver, service, and update testing across supported builds; a framework compatibility claim is not enough.

---

*Stack research for Liiiraa Boost — 2026-07-26*
