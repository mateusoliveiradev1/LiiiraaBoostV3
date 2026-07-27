# Executable architecture

This directory explains the Phase 1 foundation. The executable files remain
authoritative: documentation links to them instead of restating schemas or
policy objects that could silently drift.

## Authorities

| Concern                                        | Executable authority                                                                                                              | Human decision                                                      |
| ---------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------- |
| Module ownership, roots, layers, runtime class | [`module-boundaries.json`](module-boundaries.json) and [`module-boundaries.schema.json`](module-boundaries.schema.json)           | [ADR 0003](decisions/0003-module-ownership-and-direction.md)        |
| Contract semantics                             | [`../packages/contracts-source/src`](../packages/contracts-source/src)                                                            | [ADR 0001](decisions/0001-contract-generation-spike.md)             |
| Generated contract compatibility               | [`../tooling/contract-compat`](../tooling/contract-compat)                                                                        | [ADR 0002](decisions/0002-contract-versioning-and-compatibility.md) |
| Provenance and fixture separation              | [`../tooling/fixture-guard`](../tooling/fixture-guard)                                                                            | [ADR 0004](decisions/0004-truth-provenance-and-fixture-boundary.md) |
| Five-dimension acceptance                      | [`quality-manifest.schema.json`](quality-manifest.schema.json) and [`../tooling/acceptance-policy`](../tooling/acceptance-policy) | [ADR 0005](decisions/0005-cross-cutting-acceptance-policy.md)       |
| Required evidence and root reachability        | [`../tooling/ci/verify-required-artifacts.mjs`](../tooling/ci/verify-required-artifacts.mjs)                                      | Phase 1 verification graph                                          |
| Approved dependency identities                 | [`dependency-allowlist.json`](dependency-allowlist.json)                                                                          | [`dependency-review.md`](dependency-review.md)                      |

## Contributor workflow

### Ownership and dependency direction

1. Find the owning module and its public roots in
   [`module-boundaries.json`](module-boundaries.json).
2. Import through a declared public root. Do not deep-import another module.
3. Keep dependencies in the declared layer direction. Both TypeScript and Cargo
   graphs are evaluated by the same policy through `pnpm test:architecture`.
4. Treat `status: "reserved"` records as future constraints, not implemented
   packages. Do not create empty package shells to satisfy the map.
5. Update the executable policy and [ownership guide](OWNERSHIP.md) together
   when an architecture decision changes ownership or direction.

### Contract generation and compatibility

Contract semantics are edited only in
[`packages/contracts-source/src`](../packages/contracts-source/src). Generated
TypeScript, Rust, JSON Schema, and OpenAPI artifacts own no semantics and must
never be hand-repaired.

Run this sequence:

```text
pnpm contracts:generate
pnpm contracts:check
pnpm contracts:compat
pnpm test:contracts
```

`contracts:check` regenerates into a clean comparison boundary and rejects
drift. `contracts:compat` compares the candidate contract set with the
hash-verified baseline. A breaking transition requires a higher major version
and explicit architecture/contracts approval under ADR 0002. Runtime callers
must validate untrusted input against the emitted schema before mapping
generated transports into domain values.

### Truth and fixtures

Every diagnostic value is one of five closed provenance kinds: `measured`,
`simulated`, `derived`, `user-provided`, or `unavailable`. The canonical shape
is generated from TypeSpec; [ADR 0004](decisions/0004-truth-provenance-and-fixture-boundary.md)
records the interpretation.

Production truth is defended independently at five points:

1. compile-time fixture/production type separation;
2. static architecture and deep-import checks;
3. runtime adapter-identity refusal;
4. built-artifact sentinel scanning; and
5. a subprocess smoke test of the exported production package.

Use `pnpm test:runtime-truth` during development and
`pnpm test:production-truth` before final acceptance. Simulators and fixture
corpora are deterministic test evidence only; they cannot support product
performance claims.

### Acceptance evidence

Each Phase 1 requirement owns one manifest under
[`quality/features`](../quality/features). Every manifest accounts for
security, privacy, accessibility, performance, and recovery.

- `planned` mode permits explicitly planned evidence while implementation is
  still in progress.
- `final` mode requires each tested dimension to have passed evidence whose
  exact repository file exists and whose exact terminating command is reachable
  from the root verification graph.
- `not_applicable` is not an omission: it requires an accountable owner,
  rationale, residual risk, and dated reopening trigger.

Run:

```text
pnpm test:acceptance-policy -- --mode planned
pnpm acceptance:check -- --mode final
```

Final acceptance is reached only through `pnpm verify`; an isolated green test
or the mere presence of a file is not release evidence.

## Phase 1 scope fence

Phase 1 delivers executable foundations and deterministic simulated boundaries.
It does not deliver:

- a real optimizer or any Windows mutation;
- Defender removal, bypass, Tamper Protection bypass, or silent security change;
- measured performance gains or any real-machine performance claim;
- authentication, licensing, billing, account, or administrative behavior;
- AWS, Cloudflare, Neon, PostgreSQL, Valkey, queue, or production provisioning;
- the visual Tauri/React application, product screens, or user-facing UX.

Reserved module records describe allowed future architecture only. Later phases
must add their own requirements, threat mitigations, generated contracts, tests,
and final five-dimension evidence before claiming those capabilities.

## Verification

For documentation-only changes:

```text
pnpm docs:check
node tooling/ci/verify-required-artifacts.mjs --docs
```

For the complete foundation:

```text
pnpm verify:quick
pnpm verify
```
