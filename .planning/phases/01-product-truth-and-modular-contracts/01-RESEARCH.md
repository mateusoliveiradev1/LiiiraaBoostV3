# Phase 1: Product Truth and Modular Contracts - Research

**Researched:** 2026-07-26  
**Domain:** Greenfield modular monorepo, language-neutral contracts, TS/Rust validation parity, truthful fixture boundary, and executable quality policy  
**Confidence:** MEDIUM

## User Constraints

There is no Phase 1 `CONTEXT.md`. The following upstream decisions are therefore binding.

### Locked Decisions

- The product is **Liiiraa Boost — o otimizador definitivo**, premium, trustworthy, exclusive, lightweight, and technically honest. [VERIFIED: `PRODUCT.md`]
- Use a fully modular pnpm/Turborepo and Cargo Workspace monorepo. [VERIFIED: `.planning/PROJECT.md`, `.planning/research/STACK.md`]
- Desktop stack is Tauri 2 + Rust + React/Vite; web and admin are separate current-stable Next.js deployments; API is a Fastify modular monolith; PostgreSQL is authoritative. [VERIFIED: `.planning/PROJECT.md`, `.planning/research/STACK.md`]
- Critical cross-process and network contracts have one language-neutral source; TypeScript and Rust transports and validators are generated, not manually duplicated. [VERIFIED: `.planning/PROJECT.md`, `FOUND-01`]
- TypeScript remains pinned at `6.0.3` until the complete lint/build/test chain supports 7.x. [VERIFIED: `.planning/research/STACK.md`; npm registry evidence recorded 2026-07-26]
- Security is local-first and least-privilege. No elevated UI, arbitrary command bridge, remote scripts, generic registry/file/service RPC, or AI execution authority. [VERIFIED: `.planning/PROJECT.md`, `.planning/research/ARCHITECTURE.md`]
- Every diagnostic or performance value carries one of exactly five provenance kinds: `fixture`, `observed`, `measured`, `modeled`, or `unavailable`. [VERIFIED: `FOUND-03`, `DESIGN.md`, Phase 2 `02-UI-SPEC.md`]
- Production cannot present deterministic fixture data as if it came from the user's PC. A hidden badge is not sufficient protection. [VERIFIED: `FOUND-04`, Phase 2 `02-UI-SPEC.md`]
- Security, privacy, accessibility, performance, and recovery are acceptance-test dimensions, not later hardening work. [VERIFIED: `FOUND-06`, `.planning/research/PITFALLS.md`]
- The Phase 2 visual system is bespoke. shadcn, registry components, generic dashboard templates, fixture theater, and provisional surfaces are forbidden. [VERIFIED: `DESIGN.md`, Phase 2 `02-UI-SPEC.md`]

### Phase Boundary

- Phase 1 establishes truth semantics, generation, adapter conformance, module policy, ADR/ownership policy, and quality gates. [VERIFIED: `.planning/ROADMAP.md`]
- It does **not** implement real Windows inventory, optimizer mutations, privileged IPC, game profiles, Defender manipulation, billing, cloud infrastructure, or finished product UI. [VERIFIED: `.planning/ROADMAP.md`, `.planning/research/SUMMARY.md`]
- The production-side reference adapter in this phase must fail closed with typed `unavailable` results. It must not imitate a real machine or perform Tauri/Windows calls. [ASSUMED] This is the narrowest implementation that satisfies adapter substitutability and the production fixture prohibition without stealing later phase scope.

## Summary

Phase 1 should produce a small executable architecture, not a directory-only scaffold. The proof slice is: author a versioned TypeSpec truth contract; emit JSON Schema and OpenAPI artifacts; generate TypeScript and Rust transport models; validate the same golden valid/invalid corpus with Ajv and Rust `jsonschema`; map transport objects into native domain/application types; run one adapter conformance suite against both a deterministic simulator and a production-safe unavailable adapter; and make CI reject generated drift, fixture leakage, forbidden dependencies, cycles, and incomplete cross-cutting acceptance manifests. [VERIFIED: `.planning/research/STACK.md`, `.planning/research/ARCHITECTURE.md`; prescriptive synthesis]

The canonical runtime truth for non-HTTP messages is emitted JSON Schema, not TypeScript types and not Rust deserialization. Ajv and the Rust `jsonschema` crate validate untrusted payloads before generated transport models are used. This avoids the false assumption that compile-time typing or `serde` alone provides boundary validation. [VERIFIED: `.planning/research/STACK.md`, `.planning/research/ARCHITECTURE.md`]

The scope guard is equally important: create only the modules needed to prove these invariants. Reserve future app/package/crate names in the architecture map, but do not scaffold Next.js, Fastify/PostgreSQL, the Windows service, AWS, billing, games, AI, or the real optimizer. Phase 2 may then build the real Tauri shell and full visual experience on the stable contracts without Phase 1 becoming an accidental product build. [VERIFIED: `.planning/research/SUMMARY.md`, `.planning/ROADMAP.md`]

**Primary recommendation:** Plan Phase 1 as four dependency-ordered vertical plans: toolchain/module constitution → contract generation parity → truthful adapter/provenance enforcement → CI/acceptance-policy gates.

## Architectural Responsibility Map

| Capability | Primary Tier | Secondary Tier | Rationale |
|---|---|---|---|
| Canonical contract vocabulary | Contract source/tooling | — | Language-neutral TypeSpec owns transport truth; apps consume generated artifacts. |
| Runtime boundary validation | Adapter boundary | Generated contract packages | Untrusted JSON is validated before mapping to domain/application types. |
| Diagnostic provenance | Domain vocabulary | Presentation contract | The data source owns truth; UI renders it exhaustively and cannot invent provenance. |
| Deterministic scenarios | Test adapter | Test fixtures | Fixtures are versioned test vectors, never a production data source. |
| Production fixture refusal | Composition root/build graph | Runtime startup guard | Exclude fixture dependencies statically and reject fixture adapter identity dynamically. |
| Adapter conformance | Application port tests | Simulator/production-safe adapters | Behavior is specified once and executed against every adapter implementation. |
| TS/JS module boundaries | Architecture tooling | Package export maps/ESLint | Dependency-cruiser checks graph policy; exports and lint block deep/forbidden imports. |
| Rust module boundaries | Cargo workspace policy test | Crate visibility/features | `cargo metadata` is checked against the same architectural direction. |
| Acceptance obligations | Quality manifest/schema | Test runner/CI | Every affected feature must explicitly cover or justify each required quality dimension. |
| ADR and ownership | Architecture constitution | CODEOWNERS/public entry points | Decisions and dependency authority stay reviewable as a solo project scales. |
| Web/API/database implementations | Later phases | Contract reservations only | Phase 1 defines boundaries but does not build these runtimes. |

<phase_requirements>

## Phase Requirements

| ID | Description | Research Support |
|---|---|---|
| FOUND-01 | One versioned contract source generates TypeScript and Rust transport models and runtime validators. | TypeSpec → JSON Schema/OpenAPI → TS/Rust models; Ajv/Rust `jsonschema`; golden parity corpus and drift gate. |
| FOUND-02 | Simulator and future real adapters pass the same conformance suite. | Application-level port, adapter identity/capabilities, shared contract suite, deterministic simulator, production-safe unavailable reference adapter. |
| FOUND-03 | Every diagnostic/performance value identifies fixture, observed, measured, modeled, or unavailable provenance. | Closed discriminated union with required per-kind metadata and exhaustive validators/tests. |
| FOUND-04 | Production cannot expose deterministic fixture data as user-PC data. | Dev-only fixture dependency, graph prohibition, adapter identity startup guard, release sentinel scan, production-mode negative E2E. |
| FOUND-05 | Architecture checks reject forbidden imports and circular dependencies. | Canonical module policy, dependency-cruiser, package exports, ESLint rules, Cargo metadata policy test, cycle gates. |
| FOUND-06 | Security, privacy, accessibility, performance, and recovery criteria are acceptance tests for affected features. | Schema-validated quality manifests with test references or explicit reviewed `not_applicable` rationale; CI negative fixtures prove omissions fail. |

</phase_requirements>

## Standard Stack

### Phase 1 Core

| Technology | Version | Purpose | Prescription |
|---|---:|---|---|
| Node.js | 24.18.0 LTS | JS/TS toolchain | Pin in repository and CI. Local `24.16.0` must be upgraded before the full phase gate. [VERIFIED: `.planning/research/STACK.md`; local probe] |
| pnpm | 11.17.0 | Workspace/package manager | Pin with root `packageManager`; use workspace protocol for internal packages. Local `11.8.0` must be activated through Corepack. [VERIFIED: `.planning/research/STACK.md`; local probe] |
| Turborepo | 2.10.7 | Task orchestration/cache | Orchestrate `generate`, `check`, `test`; do not treat Turbo as architecture enforcement. [VERIFIED: `.planning/research/STACK.md`; npm registry 2026-07-26] |
| Rust | 1.97.1 stable | Rust workspace/toolchain | Pin with `rust-toolchain.toml`. Local `1.88.0` must be installed/upgraded through available rustup. [VERIFIED: `.planning/research/STACK.md`; local probe] |
| TypeScript | 6.0.3 | Strict JS-surface typing | Use strictest practical shared config and project references; do not move to 7.x yet. [VERIFIED: `.planning/research/STACK.md`] |
| TypeSpec packages | 1.14.0 | Canonical contract source and OpenAPI/JSON Schema emission | Pin compiler, HTTP, OpenAPI3, and JSON Schema packages together. [VERIFIED: `.planning/research/STACK.md`; npm registry 2026-07-26] |
| Ajv | 8.20.0 | TypeScript runtime JSON Schema validation | Compile validators once in generated contract package; strict mode; schemas must explicitly reject unknown properties where required. [VERIFIED: `.planning/research/STACK.md`; npm registry] |
| `json-schema-to-typescript` | 15.0.4 | Generate TS transport models from emitted JSON Schema | Use only for non-HTTP transport models; generated output is read-only. [VERIFIED: npm registry and package repository; legitimacy `OK`] |
| `typify` | 0.7.0 | Generate Rust transport models from emitted JSON Schema | Pin in generation tool crate/script; verify output and do not hand-edit. [VERIFIED: `.planning/research/STACK.md`; crates registry] |
| Rust `jsonschema` | 0.49.1 | Rust runtime validation | Validate raw boundary values using emitted schemas before deserialization/mapping. [VERIFIED: `.planning/research/STACK.md`; crates registry] |
| Serde / `serde_json` | 1.0.229 / 1.0.151 | Rust serialization | Transport serialization only; not the canonical validator. [VERIFIED: `.planning/research/STACK.md`; crates registry] |

### Quality and Architecture

| Technology | Version | Purpose | Prescription |
|---|---:|---|---|
| Vitest | 4.1.10 | TS unit, conformance, contract, negative-policy tests | Quick suite for every task; deterministic fixtures and fake clock only. [VERIFIED: `.planning/research/STACK.md`; npm registry] |
| `cargo-nextest` | 0.9.140 target | Rust tests | Pin CI installer; local `0.9.114` is available but below target. [VERIFIED: `.planning/research/STACK.md`; local probe] |
| `proptest` | 1.11.0 | Rust property tests | Exercise envelope/provenance serialization and invalid corpus invariants. [VERIFIED: `.planning/research/STACK.md`; crates registry] |
| `insta` | 1.48.0 | Reviewable Rust snapshots | Snapshot stable generated mappings/errors, not volatile timestamps/paths. [VERIFIED: `.planning/research/STACK.md`; crates registry] |
| ESLint / typescript-eslint | 10.8.0 / 8.65.0 | Type-aware rules and forbidden imports | Apply at package public boundaries; this compatibility pair is why TS 6 remains pinned. [VERIFIED: `.planning/research/STACK.md`; npm registry] |
| dependency-cruiser | 18.1.0 | TS/JS dependency graph/cycles | Generate/read rules from canonical module policy; reject deep imports and forbidden layer direction. [VERIFIED: `.planning/research/STACK.md`; npm registry] |
| Prettier | 3.9.6 | Deterministic formatting | One formatter for JS/TS/JSON/Markdown; generated files excluded or regenerated. [VERIFIED: `.planning/research/STACK.md`; npm registry] |
| `cargo-deny` / `cargo-audit` | 0.20.2 / 0.22.2 | Rust policy/advisories | CI install required; absent locally. Do not confuse these with crate-boundary enforcement. [VERIFIED: `.planning/research/STACK.md`; local probe] |

### Explicitly Deferred

React/Vite/Tauri UI packages, Playwright browser/desktop E2E, Storybook, Next.js, Fastify, Kysely/PostgreSQL, AWS/Cloudflare, Better Auth, Windows APIs, SQLite recovery, and optimizer crates belong to their owning phases. Only architecture-map reservations may appear now. [VERIFIED: `.planning/ROADMAP.md`, `.planning/research/SUMMARY.md`]

### Installation Direction

```powershell
corepack use pnpm@11.17.0
pnpm add -Dw turbo@2.10.7 typescript@6.0.3 eslint@10.8.0 `
  @typescript-eslint/parser@8.65.0 @typescript-eslint/eslint-plugin@8.65.0 `
  prettier@3.9.6 dependency-cruiser@18.1.0 vitest@4.1.10

pnpm --filter @liiiraa/contracts-source add -D @typespec/compiler@1.14.0 `
  @typespec/http@1.14.0 @typespec/openapi3@1.14.0 `
  @typespec/json-schema@1.14.0 json-schema-to-typescript@15.0.4

pnpm --filter @liiiraa/contracts-ts add ajv@8.20.0
```

Rust dependencies belong only to their owning generation/contract-test crates. Do not add broad dependencies to `[workspace.dependencies]` unless at least two crates legitimately consume them. [ASSUMED] This keeps the dependency constitution meaningful.

## Package Legitimacy Audit

The mechanical legitimacy seam was run before writing. It flagged many official packages `SUS` solely because their latest publication was very recent (`too-new`); it did not find any `SLOP` package. The planner must include one human verification checkpoint covering exact package name, official repository, exact version, lockfile diff, and absence of unexpected postinstall behavior before the first install. [VERIFIED: package-legitimacy seam output, 2026-07-26]

| Package/group | Registry evidence | Repository evidence | Verdict | Disposition |
|---|---|---|---|---|
| `turbo` 2.10.7 | 19M+ weekly downloads in seam snapshot | `vercel/turborepo` | SUS: too-new | Keep; checkpoint before install |
| `typescript` 6.0.3 | Exact version exists; latest is 7.0.2 | `microsoft/TypeScript` | SUS: package latest too-new | Keep approved compatibility pin; checkpoint |
| `eslint`, typescript-eslint, Prettier | Exact versions exist; high-use packages | Official project repositories | SUS: too-new | Keep; checkpoint |
| `dependency-cruiser` 18.1.0 | Exact version exists; ~2.8M weekly in seam snapshot | `sverweij/dependency-cruiser` | SUS: too-new | Keep; checkpoint |
| TypeSpec compiler/http/OpenAPI3/JSON Schema 1.14.0 | Exact aligned versions exist | `microsoft/typespec` | SUS: too-new | Keep; checkpoint |
| Ajv 8.20.0 | Exact version; very high use | `ajv-validator/ajv` | OK | Approved |
| `json-schema-to-typescript` 15.0.4 | Exact version; ~3.2M weekly | `bcherny/json-schema-to-typescript` | OK | Approved |
| Vitest 4.1.10 | Exact version; high use | `vitest-dev/vitest` | SUS: too-new | Keep; checkpoint |
| `typify`, Rust `jsonschema`, Serde, `serde_json` | Exact versions found in crates registry | Established source repositories | OK | Approved |
| `proptest`, `insta`, `cargo-nextest`, `cargo-deny`, `cargo-audit` | Exact target versions recorded in stack research | Established source repositories | OK | Approved |

**Packages removed due to `SLOP`:** none.  
**Packages requiring checkpoint due to `SUS`:** official recently published npm group listed above.  
**Postinstall finding:** no proposed package returned a suspicious postinstall script in the registry/legitimacy evidence gathered. [VERIFIED: package-legitimacy seam and npm queries]

## Architecture Patterns

### System Architecture Diagram

```text
Developer edits TypeSpec source
              |
              v
       TypeSpec compile
        /            \
       v              v
JSON Schema 2020-12   OpenAPI 3.1
       |              |
       +------+-------+
              |
       deterministic generation
       /                     \
      v                       v
TS transports + Ajv      Rust transports
validators               + jsonschema runtime
      |                       |
      +----------+------------+
                 |
         shared golden corpus
      valid accepted / invalid rejected
                 |
        application-level port
          /               \
         v                 v
deterministic simulator   production-safe unavailable adapter
         \                 /
          shared conformance suite
                 |
      fixture/build/runtime guards
                 |
     generated-drift + architecture +
       quality-manifest CI gates
```

### Recommended Project Structure

```text
.
├── apps/
│   └── README.md                         # reserved composition roots; no app scaffold yet
├── packages/
│   ├── contracts-source/                 # only hand-authored TypeSpec source
│   ├── contracts-ts/                     # generated TS models + compiled Ajv validators
│   ├── desktop-client/                   # application port and typed errors
│   ├── desktop-simulator/                # deterministic dev/test adapter
│   ├── desktop-production-reference/     # fail-closed unavailable adapter
│   └── test-fixtures/                    # scenario corpus; dev/test only
├── crates/
│   ├── contracts-rust/                   # generated transport models; no domain logic
│   └── contract-conformance/             # Rust parity/golden corpus tests
├── contracts/
│   ├── generated/                        # JSON Schema/OpenAPI artifacts
│   ├── corpus/valid/
│   └── corpus/invalid/
├── architecture/
│   ├── module-boundaries.json            # canonical package/crate layer policy
│   ├── quality-manifest.schema.json
│   └── decisions/                        # numbered ADRs
├── quality/features/                     # acceptance manifests by requirement/feature
├── tooling/
│   ├── contract-generation/
│   ├── architecture-tests/
│   └── fixture-guard/
├── Cargo.toml
├── pnpm-workspace.yaml
└── turbo.json
```

Do not create catch-all `shared`, `common`, `utils`, or global `services` packages. A shared concept must have a named capability owner. [VERIFIED: `.planning/research/ARCHITECTURE.md`]

### Pattern 1: One Contract Source, Three Distinct Artifacts

**What:** TypeSpec is edited; JSON Schema/OpenAPI and language transports are generated; runtime validators consume the emitted schema. Generated language models are not domain entities. [VERIFIED: `.planning/research/STACK.md`, `.planning/research/ARCHITECTURE.md`]

**Prescription:**

1. Put only boundary/exchange models in TypeSpec.
2. Mark an explicit export root for non-HTTP schemas; do not emit every internal TypeSpec helper automatically.
3. Emit deterministic sorted artifacts with a pinned compiler/config.
4. Generate TS non-HTTP models from JSON Schema and Rust transports with `typify`.
5. Compile Ajv validators once; compile/cache Rust schemas once.
6. Validate raw values first, deserialize second, map into native domain types third.
7. `generate && git diff --exit-code` is a required CI gate.

**Contract envelope:**

```typespec
enum ContractVersion { v1: "1.0" }

model MessageEnvelope<TPayload> {
  schemaVersion: ContractVersion;
  messageType: string;
  requestId: string;
  correlationId?: string;
  issuedAt: utcDateTime;
  payload: TPayload;
}
```

The explicit `schemaVersion` remains even when TypeSpec versioning decorators are used, because persisted/IPC payloads must self-identify without compiler context. [ASSUMED] This follows the versioned-envelope direction in architecture research.

### Pattern 2: Closed Evidence/Provenance Union

```typespec
union EvidenceValue<T> {
  FixtureEvidence<T>,
  ObservedEvidence<T>,
  MeasuredEvidence<T>,
  ModeledEvidence<T>,
  UnavailableEvidence
}

model FixtureEvidence<T> {
  kind: "fixture";
  value: T;
  scenarioId: string;
  fixtureVersion: string;
}

model ObservedEvidence<T> {
  kind: "observed";
  value: T;
  source: string;
  observedAt: utcDateTime;
}

model MeasuredEvidence<T> {
  kind: "measured";
  value: T;
  method: string;
  measuredAt: utcDateTime;
  quality: "valid" | "degraded" | "insufficient";
}

model ModeledEvidence<T> {
  kind: "modeled";
  value: T;
  modelId: string;
  confidence: float32;
}

model UnavailableEvidence {
  kind: "unavailable";
  reason: string;
}
```

Exact field syntax must be proven by the generation spike, but the five-way discriminant and required metadata are locked. Unknown kinds fail validation. `unavailable` has no value. A measured value with insufficient quality remains measured-but-insufficient and cannot become a gain claim. [VERIFIED: `FOUND-03`, `PRODUCT.md`, `DESIGN.md`; schema spelling is [ASSUMED] until compiler test]

### Pattern 3: Capability-Aware Adapter Contract

The port declares operations, adapter identity, and capabilities. The shared conformance suite has universal assertions plus capability-specific assertions; it must not require a production adapter to fabricate successful data. [ASSUMED]

```ts
type AdapterKind = "simulator" | "production";

interface DesktopAdapter {
  readonly identity: {
    kind: AdapterKind;
    contractVersion: "1.0";
    capabilities: readonly string[];
  };
  inspectSystem(input: InspectSystemInput): Promise<Result<SystemSnapshot, InspectError>>;
}
```

Universal conformance checks schema validity, deterministic error taxonomy, request correlation, cancellation semantics, provenance exhaustiveness, and no undeclared capability behavior. Simulator-specific tests require deterministic scenarios. Production-reference tests require typed `unavailable` responses and prove fixture kinds are never returned. Future Tauri/Rust adapters register against the same suite. [VERIFIED: `FOUND-02`, `.planning/research/ARCHITECTURE.md`; suite decomposition is prescriptive synthesis]

### Pattern 4: Defense-in-Depth Fixture Refusal

Use all four controls:

1. `test-fixtures` may be imported only by simulator/test packages.
2. Production composition roots may not have any dependency path to simulator or fixture packages.
3. Adapter factory refuses `identity.kind === "simulator"` when build/runtime mode is production.
4. Release verification scans output for a stable fixture sentinel and known scenario manifest IDs, then runs a production-mode negative E2E that attempts fixture selection and expects startup refusal.

Do not rely on a badge, environment variable alone, tree shaking, or naming conventions. [VERIFIED: `FOUND-04`, Phase 2 `02-UI-SPEC.md`; specific four-layer implementation is prescriptive synthesis]

### Pattern 5: Machine-Readable Architecture Constitution

`architecture/module-boundaries.json` should define module name, path, runtime/language, layer, public entry point, allowed dependency layers/modules, fixture eligibility, and owner. Generate dependency-cruiser rules from it and test Cargo metadata against it. Keep human rationale in ADRs; do not duplicate the machine policy in prose. [ASSUMED]

Initial dependency direction:

```text
contract-source
    -> generated-contracts
        -> domain/application ports
            -> adapters/frameworks
                -> app composition roots
```

No reverse edge is allowed. Generated packages cannot depend on applications. Domain/application ports cannot depend on Tauri, React, Next.js, Fastify, PostgreSQL, AWS SDKs, or Win32. [VERIFIED: `.planning/research/ARCHITECTURE.md`]

### Pattern 6: Executable SDD/TDD/E2E Quality Manifests

Each affected feature/requirement gets a schema-validated manifest:

```json
{
  "requirement": "FOUND-04",
  "acceptance": {
    "security": { "status": "applicable", "tests": ["fixture-guard.production.test.ts"] },
    "privacy": { "status": "applicable", "tests": ["provenance-redaction.test.ts"] },
    "accessibility": { "status": "not_applicable", "rationale": "No UI is delivered in Phase 1." },
    "performance": { "status": "applicable", "budget": "<30s quick guard suite", "tests": ["fixture-guard.performance.test.ts"] },
    "recovery": { "status": "not_applicable", "rationale": "No mutation or persistence occurs." }
  }
}
```

CI rejects missing dimensions, missing test files, empty rationale, or `not_applicable` where the feature's risk tags mandate the dimension. Negative policy fixtures intentionally omit each dimension and must fail the checker. [ASSUMED] This is the prescriptive mechanism that makes `FOUND-06` enforceable without pretending every feature needs irrelevant tests.

## ADR and Ownership Contract

Create ADRs for:

1. canonical TypeSpec/JSON Schema/OpenAPI pipeline;
2. versioning and compatibility policy;
3. module dependency direction and public-entry rule;
4. fixture/production truth boundary;
5. adapter conformance model;
6. cross-cutting quality manifest policy.

Each ADR records status, context, decision, alternatives, consequences, security/privacy/recovery impact, supersedes/superseded-by, and verification links. Architecture-changing PRs must update an ADR or state why no ADR is needed. [ASSUMED]

The solo owner is initially one CODEOWNER, but every module still declares a capability owner and change authority. This prepares review automation and future delegation without inventing a team structure. [VERIFIED: user is solo developer from upstream conversation; module ownership mechanism is [ASSUMED]]

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---|---|---|---|
| Contract parser/schema language | Custom TS/Rust DTO DSL | TypeSpec + emitted OpenAPI/JSON Schema | Parsing, versioning, and emitter drift are deceptively complex. |
| Runtime validation | Type guards duplicated in TS/Rust | Ajv + Rust `jsonschema` against same schema corpus | Compile-time types and deserialization do not validate equivalent constraints. |
| TS transport generation | Manually copied interfaces | `json-schema-to-typescript` | Hand copies defeat `FOUND-01`. |
| Rust transport generation | Handwritten Serde structs | `typify` | Manual models drift from schema. |
| JS dependency graph engine | Recursive import script | dependency-cruiser | Handles resolution, cycles, aliases, and reports. |
| Rust dependency discovery | Parse `Cargo.toml` text | `cargo metadata` plus a small policy assertion | Cargo owns resolved workspace graph semantics. |
| General CI build system | Bespoke orchestration daemon | pnpm scripts + Turbo + Cargo | Existing tools provide caching and task graphs. |
| Fixture hiding | UI-only demo badge | graph exclusion + runtime guard + release scan + negative E2E | A badge does not prevent production deception. |
| Security crypto/signing | Any custom cryptography | Defer to owning security phases and platform libraries | Phase 1 has no need to sign or encrypt data. |

## Common Pitfalls

### Critical

1. **Types without runtime validation:** generated TS/Rust models compile while malformed external payloads pass differently. Gate with shared valid/invalid corpus. [VERIFIED: `.planning/research/PITFALLS.md`]
2. **Generated types become domain models:** transport changes contaminate domain behavior. Map at boundaries. [VERIFIED: `.planning/research/ARCHITECTURE.md`]
3. **Simulator and production adapter forced into identical capabilities:** the production reference starts fabricating success. Share universal contract semantics, not fake capability outcomes. [ASSUMED]
4. **Fixture guard only in UI:** a hidden badge/env flag leaks fixture results. Enforce dependency, composition, bundle, and E2E guards. [VERIFIED: Phase 2 `02-UI-SPEC.md`]
5. **Architecture documented but not executed:** folders look modular while imports bypass boundaries. Generate/test rules and include intentional failing fixtures. [VERIFIED: `FOUND-05`]
6. **Acceptance checklist theater:** all five quality words appear in a template, but omissions do not fail CI. Validate manifests and referenced tests. [VERIFIED: `FOUND-06`; mechanism is synthesis]

### Moderate

7. **Emitting every TypeSpec helper as public contract:** accidental schema surface becomes compatibility burden. Emit explicit boundary roots. [ASSUMED]
8. **Ajv strict mode mistaken for unknown-field rejection:** the schema must express the closed-object policy and parity corpus must prove it. [ASSUMED]
9. **Platform-dependent generated output:** Windows/Linux newline/path ordering creates drift. Normalize generation and compare on both CI OSes. [ASSUMED]
10. **Catch-all shared package:** ownership and dependency direction collapse. Name packages by capability. [VERIFIED: `.planning/research/ARCHITECTURE.md`]
11. **Scaffolding all future apps now:** stale dependencies and empty shells create work without proving Phase 1. Reserve names in architecture map only. [VERIFIED: `.planning/research/SUMMARY.md`]
12. **Newest-version theater:** TypeScript 7 is selected despite lint incompatibility. Keep the verified compatibility pin. [VERIFIED: `.planning/research/STACK.md`]

## Validation Architecture

### Test Framework

| Property | Value |
|---|---|
| TS framework | Vitest 4.1.10 |
| Rust framework | cargo-nextest target 0.9.140 + proptest 1.11.0 + insta 1.48.0 |
| Config | Wave 0 creates root Vitest projects and `.config/nextest.toml` only if behavior is needed |
| Quick command | `pnpm test:quick` |
| Contract parity | `pnpm contracts:check` |
| Architecture | `pnpm architecture:check` |
| Rust quick | `cargo nextest run -p contract-conformance` |
| Full phase gate | `pnpm verify:phase1` |

### Phase Requirements → Test Map

| Req | Behavior | Test Type | Automated Command | File Exists? |
|---|---|---|---|---|
| FOUND-01 | One source regenerates matching artifacts; TS/Rust accept/reject same corpus | contract/integration | `pnpm contracts:check` | ❌ Wave 0 |
| FOUND-02 | Simulator and production-safe adapter satisfy common semantics | conformance | `pnpm vitest run packages/desktop-client` | ❌ Wave 0 |
| FOUND-03 | Five provenance variants validate, serialize, and remain exhaustive | unit/property | `pnpm vitest run packages/contracts-ts && cargo nextest run -p contract-conformance` | ❌ Wave 0 |
| FOUND-04 | Production rejects fixture dependency/identity/output | architecture/integration/E2E | `pnpm fixture-guard:check` | ❌ Wave 0 |
| FOUND-05 | Forbidden edges, deep imports, and cycles fail | architecture | `pnpm architecture:check` | ❌ Wave 0 |
| FOUND-06 | Missing cross-cutting dimension/test/rationale fails | policy contract | `pnpm quality:check` | ❌ Wave 0 |

### Test Pyramid

- **Unit/property:** schema helpers, discriminants, error taxonomy, policy parser, deterministic scenario clock.
- **Contract:** golden valid/invalid JSON corpus executed in TS and Rust.
- **Integration:** generator drift, adapter conformance, dependency graph, quality manifests.
- **E2E for this phase:** command-line production composition attempts fixture activation and fails. Browser/Tauri E2E is deferred because there is no UI in Phase 1.
- **Manual gate:** review generated diff readability, ADR coherence, package checkpoint, and CI evidence.

### Sampling

- Per task commit: `pnpm test:quick` or focused Rust package command, target under 30 seconds.
- Per wave: contract parity + architecture + relevant language tests.
- Phase gate: clean generation, full TS/Rust tests, production fixture negative E2E, audit tools, and clean git diff.

### Wave 0 Gaps

- [ ] Root workspace/toolchain pins and deterministic scripts.
- [ ] Vitest project configuration and adapter conformance harness.
- [ ] Rust conformance crate and shared corpus loader.
- [ ] TypeSpec config plus explicit schema export roots.
- [ ] Contract generation/drift script.
- [ ] Canonical architecture policy and both JS/Rust graph checkers.
- [ ] Quality-manifest schema/checker and intentional invalid fixtures.
- [ ] Fixture sentinel/build/runtime guard test harness.

## Security Domain

Security enforcement is enabled because `.planning/config.json` does not disable it. ASVS 5.0.0 was the current stable OWASP ASVS release at research time; this phase uses it as a control taxonomy, not as a claim of certification. [VERIFIED: OWASP official project page checked 2026-07-26]

### Applicable ASVS Control Families

| Control family | Applies | Phase 1 control |
|---|---|---|
| Architecture and threat modeling | Yes | Trust-boundary ADR, dependency direction, no privileged/cloud implementation. |
| Authentication/session management | No runtime implementation | Reserve later module boundary; do not add auth packages. |
| Access control | Yes at architecture level | Production composition cannot access fixture/test adapters. |
| Input validation/business logic | Yes | Same emitted schema and invalid corpus on TS/Rust boundaries. |
| Cryptography | No runtime implementation | No custom crypto; signing/encryption deferred. |
| Error handling/logging | Yes | Typed non-secret validation errors and correlation IDs; golden snapshots redact payload values. |
| Data/privacy | Yes | Fixtures contain synthetic data only; quality manifest requires privacy disposition. |
| API/IPC security | Contract only | Versioned bounded envelopes; no generic operation command or actual IPC. |
| Configuration/supply chain | Yes | Exact pins, lockfile review, package checkpoint, audit jobs, least-privilege CI. |

### Known Threat Patterns

| Pattern | STRIDE | Mitigation |
|---|---|---|
| Fixture presented as user data | Spoofing | Closed provenance union and multi-layer production fixture refusal. |
| Contract downgrade/unknown version | Tampering | Explicit version discriminant; reject unknown major versions. |
| TS/Rust validator divergence | Tampering | Shared invalid corpus and parity report. |
| Deep import bypass | Elevation of privilege | Public exports plus architecture graph and lint gates. |
| Malicious dependency/version confusion | Tampering | Exact versions, pnpm lockfile, official source verification, audit/checkpoint. |
| Sensitive values in validation snapshots | Information disclosure | Redacted structured errors; test only synthetic payloads. |
| Oversized/pathological payload | Denial of service | Add schema bounds and corpus cases; actual transport byte/time limits belong to IPC/API phases. |
| CI token overreach | Elevation of privilege | Read-only default permissions; write permissions only in later protected release jobs. |

No Defender, security-policy, registry, service, filesystem, driver, PowerShell, or Windows mutation API may appear in Phase 1 code. [VERIFIED: project security boundary and requested phase scope]

## Environment Availability

| Dependency | Required By | Available | Detected | Action/Fallback |
|---|---|---:|---:|---|
| Node.js | TS toolchain | Yes, below pin | 24.16.0 | Install/use 24.18.0 before phase gate; CI pin is authoritative. |
| npm | Registry/bootstrap | Yes | 11.13.0 | No blocker. |
| pnpm | Workspace | Yes, below pin | 11.8.0 | Activate 11.17.0 through available Corepack 0.35.0. |
| Rust/Cargo | Rust generation/tests | Yes, below pin | 1.88.0 | Available rustup 1.29.0 installs 1.97.1. |
| Git | drift/CI | Yes | 2.54.0.windows.1 | No blocker. |
| cargo-nextest | Rust tests | Yes, below target | 0.9.114 | Upgrade/pin 0.9.140 in CI/tool install. |
| cargo-deny | Rust policy | No | — | Wave 0 installation required. |
| cargo-audit | Rust advisories | No | — | Wave 0 installation required. |
| Docker CLI | Not required in Phase 1 | Yes; daemon stopped | 29.6.1 | No action; PostgreSQL/Testcontainers are deferred. |
| oasdiff | Compatibility gate | No | — | Defer HTTP breaking gate until OpenAPI operations exist, or install only if Plan 2 includes intentional breaking-change proof. |
| Context7 CLI/MCP | External docs | No | — | Research used verified project research, official URLs already cited there, and registry evidence; no implementation blocker. |

**Missing dependencies with no fallback:** none; all missing tools have an install step or are deferred.  
**Important precondition:** exact Node, pnpm, and Rust pins must be active in CI even if local upgrades are staged.

## CI Quality Gates

Use fast PR gates and a full protected branch gate:

1. format and strict typecheck;
2. contract compile/generate;
3. generated drift (`git diff --exit-code`);
4. TS/Rust valid-invalid parity;
5. adapter conformance;
6. provenance and production fixture guard;
7. dependency-cruiser + Cargo policy graph;
8. quality-manifest completeness;
9. unit/property/integration suites;
10. dependency/license/advisory checks;
11. secret scan and least-privilege workflow lint;
12. Windows and Linux generation reproducibility.

Do not add AWS credentials, deployment, signing, artifact publication, production database, browser matrix, or Windows privileged E2E to this phase. [VERIFIED: `.planning/research/SUMMARY.md`]

Recommended merge rule: every gate is required, no critical exception label. If a tool is temporarily unavailable, the change remains unmerged rather than silently skipping the check. [VERIFIED: `.planning/PROJECT.md` quality constraint]

## State of the Art

| Old/unsafe approach | Approved approach | Impact |
|---|---|---|
| Handwritten TS and Rust DTOs | TypeSpec source → generated transports + shared runtime schema | Drift becomes a failing gate. |
| Compile-time typing as validation | Boundary validation before mapping | Malformed/untrusted payloads fail consistently. |
| Random demo data | Versioned deterministic scenario corpus | Reproducible tests and honest UI provenance. |
| `NODE_ENV` badge as fixture safety | Static graph + runtime identity + artifact scan + negative E2E | Production deception needs multiple failures to occur. |
| Folder naming as modularity | Canonical policy + graph enforcement + public entry points | Forbidden coupling is machine-detectable. |
| “Security later” checklist | Per-feature executable quality manifest | Omissions fail when introduced. |
| Latest version at any cost | Latest mutually compatible stable pins | No weakening lint/tests for novelty. |

## Open Questions — Resolved for Planning

1. **What is the canonical contract source?**  
   TypeSpec 1.14.0. JSON Schema is the runtime truth artifact; OpenAPI is the HTTP artifact. [VERIFIED: approved stack]

2. **How are non-HTTP TS models generated?**  
   `json-schema-to-typescript` 15.0.4 from emitted JSON Schema. Ajv supplies runtime validation. [VERIFIED: registry/repository; prescriptive resolution]

3. **How is Rust parity guaranteed?**  
   `typify` generates transport models, while Rust `jsonschema` validates the same emitted schemas and corpus used by Ajv. Parity is based on accept/reject behavior, not identical generated syntax. [VERIFIED: approved stack; prescriptive resolution]

4. **Should TypeSpec versioning alone identify persisted/IPC messages?**  
   No. Keep explicit `schemaVersion` in every envelope and use TypeSpec versioning for evolution/emission policy. Unknown major versions fail closed. [ASSUMED]

5. **What is the “real” adapter in Phase 1?**  
   A production-safe reference adapter that implements the port and returns typed `unavailable`; it performs no machine access. The first real read adapter arrives in the hardware-intelligence phase. [ASSUMED]

6. **How can the same conformance suite cover simulator and future real adapters?**  
   Split universal contract assertions from declared-capability assertions. An adapter may not claim capabilities it cannot prove. [ASSUMED]

7. **How is fixture leakage prevented?**  
   Dependency graph exclusion, production composition guard, artifact sentinel scan, and production negative E2E. All are mandatory. [ASSUMED, grounded in `FOUND-04`]

8. **How are JS and Rust boundaries enforced from one policy?**  
   Canonical JSON module map feeds dependency-cruiser configuration and a small `cargo metadata` assertion. Cargo itself rejects cycles; the policy test rejects forbidden acyclic edges. [ASSUMED]

9. **How is FOUND-06 made testable?**  
   Schema-validated feature quality manifests with all five dimensions, test references, risk-aware applicability, and intentional failing fixtures. [ASSUMED]

10. **Does Phase 1 scaffold all future applications?**  
    No. It records reserved modules and builds only the proof slice. This avoids stale empty shells and accidental full-product scope. [VERIFIED: roadmap ordering]

11. **Are actual optimization, Defender, game profile, cloud, database, or auth operations included?**  
    No. Any such implementation is a phase-scope violation. [VERIFIED: roadmap and project security constraints]

**Unresolved questions:** none that block planning. TypeSpec union/constraint/unknown-field behavior is not an open design decision; it is an implementation spike with explicit pass/fail tests in the plan.

## Assumptions Log

| # | Claim | Risk if Wrong | Planner treatment |
|---|---|---|---|
| A1 | The production reference adapter may satisfy Phase 1 by failing closed with typed unavailable results. | Roadmap checker may expect a Tauri-backed adapter. | State explicitly in Plan 3 and verify against success criterion before implementation. |
| A2 | Explicit TypeSpec export roots and schema spelling support the proposed union/envelope without generator loss. | Generator may flatten or loosen constraints. | Mandatory contract spike; change representation, not truth semantics, if parity fails. |
| A3 | `json-schema-to-typescript` output is adequate for the non-HTTP transport subset. | Recursive/generic schemas may generate poor types. | Keep Phase 1 schema subset small; reject generator if golden type review fails. |
| A4 | One JSON module map can drive both dependency-cruiser and Cargo assertions without excessive custom tooling. | Rule translation may become complex. | Keep policy vocabulary to layers, named exceptions, public entry, fixture eligibility. |
| A5 | Quality manifests are the best executable mechanism for FOUND-06. | Maintenance burden could exceed value. | Prove with six Phase 1 manifests and negative fixtures before generalizing. |

## Project Constraints (from AGENTS.md)

- Start file-changing work through a GSD workflow; this research was executed under `gsd-plan-phase`. [VERIFIED: `AGENTS.md`]
- Prefix shell commands with `rtk`. [VERIFIED: `AGENTS.md`]
- Use GSD planning/execution artifacts and keep work synchronized. [VERIFIED: `AGENTS.md`]
- No project-local skills or rules directories were present during research. [VERIFIED: local filesystem probe]
- Preserve the project constitution embedded in `AGENTS.md`, especially modularity, generated contracts, security, accessibility, performance, and production quality gates. [VERIFIED: `AGENTS.md`]

## Sources

### Primary — Project-verified

- `.planning/PROJECT.md` — locked product/stack/security/quality constraints.
- `.planning/REQUIREMENTS.md` — exact `FOUND-01` through `FOUND-06`.
- `.planning/ROADMAP.md` — Phase 1 goal, success criteria, dependencies, and phase boundary.
- `PRODUCT.md` — product truth, positioning, safety, accessibility, and anti-features.
- `DESIGN.md` — provenance visibility, bespoke design, performance, and accessibility constraints.
- `.planning/phases/02-complete-desktop-experience/02-UI-SPEC.md` — production fixture refusal and visual truth boundary.
- `.planning/research/STACK.md` — registry-backed compatible versions and approved generation/testing stack.
- `.planning/research/ARCHITECTURE.md` — trust boundaries, ports/adapters, schema-first contracts, monorepo direction.
- `.planning/research/PITFALLS.md` — phase-zero claim, contract, threat, and quality risks.
- `.planning/research/SUMMARY.md` — dependency order and scope discipline.

### Primary — Official sources already cited and verified in project research

- [TypeSpec documentation](https://typespec.io/docs/) — canonical modeling/emission direction.
- [TypeSpec JSON Schema emitter reference](https://typespec.io/docs/emitters/json-schema/reference/) — emitter reference.
- [OpenAPI 3.1 specification](https://spec.openapis.org/oas/v3.1.0) — HTTP contract artifact.
- [JSON Schema 2020-12](https://json-schema.org/draft/2020-12) — runtime schema vocabulary.
- [Tauri 2 Security](https://v2.tauri.app/security/) — later desktop trust boundary; no Tauri implementation in Phase 1.
- [pnpm workspaces](https://pnpm.io/workspaces) — workspace/package protocol.
- [Cargo workspaces](https://doc.rust-lang.org/cargo/reference/workspaces.html) — Rust workspace semantics.
- [Vitest](https://vitest.dev/) — TS unit/integration runner.
- [OWASP ASVS](https://owasp.org/www-project-application-security-verification-standard/) — current stable security verification taxonomy.

### Registry evidence gathered 2026-07-26

- npm exact versions verified for all Phase 1 JS packages listed above.
- crates registry exact versions verified for `typify`, `jsonschema`, Serde, `serde_json`, `proptest`, and `insta`.
- Package-legitimacy seam found no `SLOP`; recent official npm releases were mechanically marked `SUS: too-new` and remain behind a checkpoint.

### Research limitation

The research-plan seam selected Context7 for several lookups, but neither Context7 MCP nor its CLI was available in this subagent session. No claim depends solely on an unfetched Context7 digest: recommendations use the project's already verified primary research, direct registry evidence gathered in this session, and explicitly marked assumptions. [VERIFIED: environment probe]

## Metadata

**Confidence breakdown:**

- Standard stack: **HIGH** — exact compatible versions and registries were checked in the upstream stack research and this session.
- Contract architecture: **MEDIUM** — direction is strong; generator parity must be proven by the mandatory spike.
- Modular topology: **HIGH** — dependency direction and scope are locked; exact rule-file implementation is an assumption to validate.
- Fixture safety: **MEDIUM** — defense-in-depth design is prescriptive and must be proven by a production build negative test.
- Validation architecture: **HIGH** — every phase requirement has an automated behavior and negative case.
- Pitfalls/security: **HIGH** — inherited from project threat/pitfall research and encoded as gates.

**Research date:** 2026-07-26  
**Valid until:** 2026-08-25 for architecture; re-check exact package/tool versions immediately before installation.
