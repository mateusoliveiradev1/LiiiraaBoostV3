# ADR 0001: TypeSpec JSON Schema to Rust generation

- Status: Accepted — spike approved
- Date: 2026-07-27
- Owners: contracts source and contract-generation tooling
- Requirements: FOUND-01, FOUND-03

## Decision

Critical transport contracts use hand-authored TypeSpec as their only editable semantic source. TypeSpec emits one bundled JSON Schema 2020-12 artifact, and both TypeScript and Rust transports are generated from that artifact. Rust generation uses Typify and must complete without hand-editing generated code.

The spike passes. The production generator will reuse its fail-closed, in-memory compatibility normalization and its pinned `rustfmt` stage. Runtime JSON Schema validation remains mandatory before generated Rust transport deserialization because Typify constructs Rust types but does not enforce every JSON Schema numeric and collection bound.

There are no open generator questions for the production contract source.

## Pinned evidence

| Component                    | Exact version | Role                                                           |
| ---------------------------- | ------------- | -------------------------------------------------------------- |
| Rust toolchain and `rustfmt` | 1.97.1        | Compile and deterministically format generated Rust            |
| `@typespec/compiler`         | 1.14.0        | Compile the language-neutral source                            |
| `@typespec/json-schema`      | 1.14.0        | Emit bundled JSON Schema 2020-12                               |
| `typify`                     | 0.7.0         | Generate Rust transport types                                  |
| `serde`                      | 1.0.229       | Serialize and deserialize generated transports                 |
| `serde_json`                 | 1.0.151       | Parse schemas, fixtures, and transports                        |
| `jsonschema`                 | 0.49.1        | Enforce the complete emitted schema at Rust runtime boundaries |

The spike input is the byte-stable artifact at `tooling/contract-generation-spike/generated/spike.schema.json`. It contains reusable envelope and metadata definitions, a `oneOf` provenance union, literal version/message/provenance discriminators, closed objects, string lengths, numeric bounds, and array cardinality.

## Chosen representation

- One canonical bundled JSON Schema 2020-12 document with `$defs`.
- Each referenced definition has a stable sibling `$id` such as `SpikeEnvelope.json`.
- Envelopes require literal `version` and `kind` fields, required metadata and payload, and closed object shapes.
- Provenance is a closed `oneOf` whose variants each require a literal `kind`.
- Generated Rust is formatted output only. It contains transport representation and Serde behavior, never domain behavior.
- The persisted schema is read unchanged. Compatibility rewrites occur only in memory and are never written over the TypeSpec artifact.

## Semantics-preserving Typify compatibility layer

Typify 0.7.0 consumes schemars 0.8-style schema structures internally. The following deterministic rewrites preserve the accepted JSON instance set while making the emitted TypeSpec representation constructive for Typify:

| TypeSpec-emitted form                              | Typify input form                          | Why semantics are unchanged                                                                                 |
| -------------------------------------------------- | ------------------------------------------ | ----------------------------------------------------------------------------------------------------------- |
| Bare bundled `$ref`, for example `Provenance.json` | Local `#/definitions/Provenance` reference | Both resolve to the same definition whose `$id` is verified before rewriting                                |
| `unevaluatedProperties: {"not": {}}`               | `additionalProperties: false`              | The spike models have no composition at those object nodes, so both close the same named properties         |
| String `const: "value"`                            | Singleton `enum: ["value"]`                | A singleton enum accepts exactly the same value and causes Typify to generate a Serde-enforced literal type |

The generator verifies the exact dialect, every definition `$id`, every reference target, and every supported keyword before applying these rewrites. No generated-code patching is permitted.

## Semantic matrix

| Contract semantic                         | Generated Rust evidence                                   | Boundary rule                                      |
| ----------------------------------------- | --------------------------------------------------------- | -------------------------------------------------- |
| Required properties                       | Non-optional generated struct fields                      | Generated Serde type                               |
| Closed objects                            | `deny_unknown_fields` generated structs                   | Generated Serde type                               |
| Version and message literals              | Singleton generated enums                                 | Generated Serde rejects an unknown discriminator   |
| Provenance `oneOf` and literal kinds      | Generated enum plus singleton variant-kind enums          | Generated Serde rejects an unknown provenance kind |
| Non-empty strings                         | Typify generated constrained newtypes                     | Generated Serde type                               |
| Integer bounds                            | Integer transport fields                                  | Validate emitted schema before deserialization     |
| Array minimum/maximum cardinality         | Vector transport fields                                   | Validate emitted schema before deserialization     |
| Complete accepted/rejected fixture matrix | Rust `jsonschema` validates the unchanged shared fixtures | Runtime validation is mandatory                    |

The Rust test suite generates twice and compares bytes, compiles and runs the generated source, round-trips a valid envelope, rejects altered version and provenance discriminators, and validates every shared TypeSpec accepted/rejected vector.

## Regeneration order

1. Run the TypeSpec spike generator. It compiles TypeSpec, canonicalizes JSON keys, atomically replaces the persisted schema, and proves the TypeScript vectors.
2. Read that exact persisted schema in the Rust generator.
3. Validate the supported schema subset and apply only the in-memory compatibility mappings above.
4. Run Typify 0.7.0.
5. Format with the repository-pinned Rust 1.97.1 `rustfmt`.
6. Compile generated Rust and run the shared runtime-validation and discriminator proofs.

The terminating spike command is:

```text
rtk pnpm --filter @liiiraa/contract-generation-spike test -- --run
rtk cargo test -p contract-generation-spike-rust
```

The first command must complete before Cargo starts. Deleting the persisted schema before this sequence must recreate the same bytes.

## Ownership and change policy

- `packages/contracts-source` owns future editable production TypeSpec semantics.
- The TypeSpec emitter owns persisted JSON Schema artifacts.
- Contract-generation tooling owns deterministic orchestration and the compatibility mapping.
- Generated TypeScript and Rust packages own no semantics and must not be manually repaired.
- Each untrusted process, network, downloaded, or persisted boundary must validate against the emitted schema before constructing Rust transports.
- A new schema keyword or representation requires an explicit semantics-preserving mapping plus a regression fixture, or generation fails.

## Rejection criteria

Generation fails on:

- a dialect other than JSON Schema 2020-12;
- a missing `$defs`, missing/mismatched definition `$id`, unresolved reference, or non-bundled reference;
- an unknown schema keyword or unsupported keyword value;
- ambiguous object closure or simultaneous closure representations;
- simultaneous `const` and `enum`;
- Typify or `rustfmt` failure;
- nondeterministic output, non-compiling output, discriminator broadening, or fixture-matrix disagreement.

If a future contract cannot satisfy these rules without changing its accepted instance set, stop and evaluate another generator or representation. Do not patch generated Rust and do not introduce handwritten DTO copies.

## Consequences

The approach keeps one language-neutral source, produces deterministic compiling Rust, preserves critical discriminators, and makes unsupported constructs visible during generation. It also makes runtime schema validation an explicit architectural requirement rather than assuming generated Rust types enforce every JSON Schema constraint.
