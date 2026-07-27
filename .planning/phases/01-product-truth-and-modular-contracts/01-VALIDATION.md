---
phase: 01
slug: product-truth-and-modular-contracts
status: planned
nyquist_compliant: true
created: 2026-07-26
updated: 2026-07-26
---

# Phase 01 Validation Strategy

## Policy

Every task has a terminating automated command. Acceptance manifests have two explicit modes:

- `planned`: validates schema, FOUND-01..06 coverage, evidence ownership, and exact command/path syntax without requiring artifacts owned by later waves.
- `final`: rejects every `planned`, missing, unresolved, wildcard, watch-mode, or non-final evidence reference.

Only Plan 01-10 invokes the release acceptance gate in `final` mode.

## Feedback Targets

| Command | Purpose | Target |
|---|---|---:|
| `rtk pnpm verify:workspace` | Toolchain/workspace smoke | <= 15 s |
| `rtk pnpm verify:quick` | Frequent foundation feedback | <= 30 s |
| `rtk pnpm verify` | Full local release gate | <= 5 min |
| `rtk pnpm test:contracts` | Cross-language parity | <= 60 s |
| `rtk pnpm test:production-truth` | Artifact/process truth | <= 60 s |

## Wave 0 Dependencies

| Dependency | Owning task | Required before | Proof |
|---|---|---|---|
| Reviewed dependency allowlist | 01-01-01 / 01-01-02 | Any install | `rtk node tooling/supply-chain/verify-pins.mjs --check` |
| JavaScript workspace | 01-02-01 / 01-02-02 | All JS policy/spike plans | `rtk pnpm install --frozen-lockfile` |
| Cargo/toolchain workspace | 01-11-01 | Rust graph/spike/generation | `rtk pnpm verify:workspace` |
| Canonical graph evaluator | 01-03-01 / 01-03-02 | Live graph adapters and fixture guards | `rtk pnpm --filter @liiiraa/architecture-tests test -- --run` |
| Persisted spike schema | 01-04-01 | Rust generator spike | `rtk pnpm --filter @liiiraa/contract-generation-spike test -- --run` |
| Acceptance evaluator modes | 01-06-01 / 01-06-02 | Requirement manifests | `rtk pnpm --filter @liiiraa/acceptance-policy test -- --run -t "planned|final"` |

## Task Traceability

| Wave | Task | Plan | Requirements | Exact terminating command |
|---:|---|---|---|---|
| 1 | 01-01-01 | 01-01 | FOUND-01,05,06 | `rtk node tooling/supply-chain/verify-pins.mjs --check` |
| 1 | 01-01-02 | 01-01 | FOUND-01,05,06 | `rtk node tooling/supply-chain/verify-pins.mjs --check` |
| 2 | 01-02-01 | 01-02 | FOUND-01,05,06 | `rtk pnpm install --frozen-lockfile && rtk pnpm exec turbo --version` |
| 2 | 01-02-02 | 01-02 | FOUND-01,05,06 | `rtk pnpm exec tsc --version && rtk pnpm exec eslint --version && rtk pnpm exec prettier --check package.json` |
| 3 | 01-03-01 | 01-03 | FOUND-05 | `rtk pnpm --filter @liiiraa/architecture-tests test -- --run -t "policy"` |
| 3 | 01-03-02 | 01-03 | FOUND-05 | `rtk pnpm --filter @liiiraa/architecture-tests test -- --run` |
| 3 | 01-04-01 | 01-04 | FOUND-01,03 | `rtk pnpm --filter @liiiraa/contract-generation-spike test -- --run -t "schema|determinism"` |
| 3 | 01-04-02 | 01-04 | FOUND-01,03 | `rtk pnpm --filter @liiiraa/contract-generation-spike test -- --run` |
| 3 | 01-06-01 | 01-06 | FOUND-06 | `rtk pnpm --filter @liiiraa/acceptance-policy test -- --run -t "schema|dimension|exemption"` |
| 3 | 01-06-02 | 01-06 | FOUND-06 | `rtk pnpm --filter @liiiraa/acceptance-policy test -- --run -t "planned|final"` |
| 3 | 01-11-01 | 01-11 | FOUND-01,05,06 | `rtk pnpm verify:workspace && rtk cargo metadata --format-version 1 --no-deps` |
| 4 | 01-12-01 | 01-12 | FOUND-05 | `rtk pnpm test:architecture` |
| 4 | 01-13-01 | 01-13 | FOUND-01,03 | `rtk pnpm --filter @liiiraa/contract-generation-spike test -- --run && rtk cargo test -p contract-generation-spike-rust` |
| 4 | 01-13-02 | 01-13 | FOUND-01,03 | `rtk pnpm --filter @liiiraa/contract-generation-spike test -- --run && rtk cargo test -p contract-generation-spike-rust` |
| 4 | 01-17-01 | 01-17 | FOUND-01..06 | `rtk pnpm test:acceptance-policy -- --mode planned` |
| 4 | 01-17-02 | 01-17 | FOUND-01..06 | `rtk pnpm test:acceptance-policy -- --mode planned` |
| 5 | 01-05-01 | 01-05 | FOUND-01,03 | `rtk pnpm --filter @liiiraa/contracts-source exec tsp compile .` |
| 5 | 01-05-02 | 01-05 | FOUND-01,03 | `rtk pnpm --filter @liiiraa/contracts-source exec tsp compile .` |
| 6 | 01-14-01 | 01-14 | FOUND-01,03 | `rtk pnpm --filter @liiiraa/contract-generation exec tsc --noEmit` |
| 6 | 01-14-02 | 01-14 | FOUND-01,03 | `rtk pnpm contracts:generate && rtk pnpm --filter @liiiraa/contracts-source exec tsp compile .` |
| 7 | 01-07-01 | 01-07 | FOUND-01,03 | `rtk pnpm --filter @liiiraa/contracts-source exec tsp compile .` |
| 7 | 01-07-02 | 01-07 | FOUND-01,03 | `rtk node tooling/contract-generation/src/check-corpus.mjs` |
| 7 | 01-15-01 | 01-15 | FOUND-01,03 | `rtk pnpm contracts:generate && rtk pnpm --filter @liiiraa/contracts-ts check` |
| 7 | 01-15-02 | 01-15 | FOUND-01,03 | `rtk cargo check -p contract-generation-rust && rtk cargo check -p liiiraa-contracts-rust` |
| 7 | 01-15-03 | 01-15 | FOUND-01,03 | `rtk pnpm contracts:generate && rtk pnpm --filter @liiiraa/contracts-ts check && rtk cargo check -p liiiraa-contracts-rust` |
| 8 | 01-16-01 | 01-16 | FOUND-01 | `rtk pnpm contracts:check` |
| 8 | 01-16-02 | 01-16 | FOUND-01 | `rtk pnpm --filter @liiiraa/contract-compat test -- --run` |
| 8 | 01-16-03 | 01-16 | FOUND-01 | `rtk pnpm --filter @liiiraa/contract-compat test -- --run && rtk pnpm contracts:compat` |
| 8 | 01-18-01 | 01-18 | FOUND-01,03 | `rtk pnpm --filter @liiiraa/contracts-ts test -- --run` |
| 8 | 01-18-02 | 01-18 | FOUND-01,03 | `rtk pnpm test:contracts` |
| 9 | 01-08-01 | 01-08 | FOUND-02,03 | `rtk pnpm --filter @liiiraa/desktop-client check` |
| 9 | 01-08-02 | 01-08 | FOUND-02,03 | `rtk pnpm --filter @liiiraa/desktop-client test -- --run` |
| 10 | 01-19-01 | 01-19 | FOUND-02,03 | `rtk pnpm test:adapters -- --identity simulator` |
| 10 | 01-19-02 | 01-19 | FOUND-02,03 | `rtk pnpm test:adapters` |
| 11 | 01-09-01 | 01-09 | FOUND-03,04,05 | `rtk pnpm --filter @liiiraa/fixture-guard test -- --run -t "type-boundary"` |
| 11 | 01-09-02 | 01-09 | FOUND-03,04,05 | `rtk pnpm --filter @liiiraa/fixture-guard test -- --run -t "static|runtime"` |
| 12 | 01-20-01 | 01-20 | FOUND-04 | `rtk pnpm --filter @liiiraa/fixture-guard test -- --run -t "artifact"` |
| 12 | 01-20-02 | 01-20 | FOUND-04 | `rtk pnpm test:production-truth` |
| 13 | 01-10-01 | 01-10 | FOUND-01..06 | `rtk pnpm verify:quick && rtk pnpm verify` |
| 13 | 01-10-02 | 01-10 | FOUND-01..06 | `rtk pnpm exec prettier --check .github/workflows/ci.yml && rtk node tooling/ci/verify-required-artifacts.mjs --ci .github/workflows/ci.yml` |
| 14 | 01-21-01 | 01-21 | FOUND-01..06 | `rtk pnpm docs:check && rtk node tooling/ci/verify-required-artifacts.mjs --docs` |
| 14 | 01-21-02 | 01-21 | FOUND-01..06 | `rtk pnpm docs:check && rtk node tooling/ci/verify-required-artifacts.mjs --docs` |

## Non-Vacuous Filter Proof

- Task 01-09-02 uses the exact Plan command `rtk pnpm --filter @liiiraa/fixture-guard test -- --run -t "static|runtime"`.
- The test suite must assert exact non-zero counts for both `static` and `runtime` groups. A filter that runs neither or only one group fails.
- The same executed-case-count rule applies to `planned|final`, generator spike, compatibility accepted/breaking fixtures, and artifact/type-boundary groups.

## Requirement Evidence

| Requirement | Positive evidence | Negative evidence | Final command |
|---|---|---|---|
| FOUND-01 | One TypeSpec source generates compiling TS/Rust and public validators accept the corpus | Drift, invalid corpus, generator loss, and unapproved breaking compatibility fixtures fail | `rtk pnpm test:contracts && rtk pnpm contracts:compat` |
| FOUND-02 | Simulator and unavailable production adapter pass one equal-count suite | Raw throws, nondeterminism, missing provenance, capability lies fail | `rtk pnpm test:adapters` |
| FOUND-03 | Five valid variants plus cross-language properties | Unknown/combined/missing metadata and bounds violations fail | `rtk pnpm test:contracts` |
| FOUND-04 | Clean exported production distributable returns unavailable truth | Compile-time fixture, graph leak, runtime leak, artifact sentinel, and subprocess fixture fail | `rtk pnpm test:production-truth` |
| FOUND-05 | Live TS/Rust graphs pass one policy | Forbidden edges, deep imports, unknown owners, fixture edges, and cycles fail | `rtk pnpm test:architecture` |
| FOUND-06 | Six manifests pass all five dimensions in final mode | Each omission, invalid exemption, planned status, and unresolved reference fails | `rtk pnpm test:acceptance-policy -- --mode final` |

## Source Coverage Audit

| Source | ID | Required item | Plans | Status |
|---|---|---|---|---|
| GOAL | - | One versioned truth model with gates against drift, breaking evolution, deception, and omission | 05,14,15,16,18,09,20,10 | COVERED |
| REQ | FOUND-01 | One source generates TS/Rust models and validators | 04,13,05,14,15,16,18 | COVERED |
| REQ | FOUND-02 | Simulator and future real adapter conformance | 08,19 | COVERED |
| REQ | FOUND-03 | Five-kind provenance on every value | 05,07,18,08,09 | COVERED |
| REQ | FOUND-04 | Production fixture refusal | 09,20 | COVERED |
| REQ | FOUND-05 | Forbidden imports and cycles rejected | 03,12,09 | COVERED |
| REQ | FOUND-06 | Five cross-cutting acceptance dimensions | 06,17,10 | COVERED |
| RESEARCH | - | Exact toolchains and modular monorepo | 01,02,11 | COVERED |
| RESEARCH | - | Generator pass/fail spike with persistent shared schema | 04,13 | COVERED |
| RESEARCH | - | JSON Schema truth and compact shared corpus | 14,07,18 | COVERED |
| RESEARCH | - | Native port, simulator, production-safe unavailable adapter | 08,19 | COVERED |
| RESEARCH | - | Type, static, runtime, artifact, and E2E fixture defenses | 09,20 | COVERED |
| RESEARCH | - | Machine-checkable manifests and final CI omission gate | 06,17,10 | COVERED |
| RESEARCH | - | Versioning ADR and executable compatibility gate | 16,10,21 | COVERED |
| RESEARCH | - | ADRs, ownership, root quick/full commands | 10,21 | COVERED |
| CONTEXT | - | No Phase 1 CONTEXT.md; upstream product/research decisions apply | all | COVERED |

## Final Gate

Phase 1 is complete only when `rtk pnpm verify` runs acceptance policy in `final` mode and every FOUND-01..06 evidence reference exists, terminates, is final, and is reachable from CI.
