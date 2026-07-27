# Liiiraa Boost

Liiiraa Boost is a premium Windows 10/11 gaming-performance platform. This
repository currently contains the deterministic foundation for that product:
the modular workspace, generated cross-language contracts, truth and fixture
guards, architecture tests, and acceptance evidence.

Phase 1 does **not** contain a visual desktop application or a real optimizer.
See [Phase 1 scope](architecture/README.md#phase-1-scope-fence) before describing
implemented behavior.

## Repository map

| Path                                    | Purpose                                                       |
| --------------------------------------- | ------------------------------------------------------------- |
| `packages/contracts-source`             | Only editable semantic source for production contracts        |
| `packages/contracts-ts`                 | Generated TypeScript transports and runtime validation        |
| `crates/contracts-rust`                 | Generated Rust transports and runtime validation              |
| `packages/desktop-client`               | Inspection-only desktop contract client and truth mapping     |
| `packages/desktop-production-reference` | Fail-closed production composition                            |
| `packages/desktop-simulator`            | Deterministic fixture adapter; never production truth         |
| `contracts/corpus`                      | Shared valid and invalid contract vectors                     |
| `quality/features`                      | Executable acceptance manifests for FOUND-01 through FOUND-06 |
| `tooling`                               | Generation, compatibility, architecture, truth, and CI gates  |
| `architecture`                          | Human-readable decisions that link to executable authorities  |

The canonical module owners, public roots, dependency layers, runtime classes,
and reserved future modules live in
[`architecture/module-boundaries.json`](architecture/module-boundaries.json).
Use [the ownership guide](architecture/OWNERSHIP.md) to interpret that policy.

## Root workflows

Run commands from the repository root:

```text
pnpm contracts:generate
pnpm contracts:check
pnpm contracts:compat
pnpm test:architecture
pnpm test:runtime-truth
pnpm test:production-truth
pnpm test:acceptance-policy -- --mode planned
pnpm acceptance:check -- --mode final
pnpm docs:check
pnpm verify:quick
pnpm verify
```

- `verify:quick` is the deterministic development gate.
- `verify` is the final Phase 1 gate. It adds full tests and builds,
  production-artifact truth, supply-chain verification, and final acceptance.
- `docs:check` and the required-artifact verifier ensure these contributor
  entrypoints remain present and formatted.

For contract regeneration, compatibility approval, truth provenance, fixture
isolation, and acceptance evidence, follow the
[architecture contributor workflow](architecture/README.md).
