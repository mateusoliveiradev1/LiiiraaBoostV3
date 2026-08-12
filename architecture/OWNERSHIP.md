# Module ownership

[`module-boundaries.json`](module-boundaries.json) is the canonical,
machine-checked ownership policy. This guide makes the current records
discoverable; if this document and the JSON disagree, the JSON wins and
`pnpm docs:check` must be followed by a correction here.

## Owners and public entrypoints

ADR 0003 uses each status precisely: `active` identifies an implementation root
participating in the current executable foundation; `reserved` allocates a
future boundary without asserting an implementation exists.

| Module                           | Owner         | Layer       | Runtime    | Status   | Public entrypoint                                               |
| -------------------------------- | ------------- | ----------- | ---------- | -------- | --------------------------------------------------------------- |
| `contracts-source`               | contracts     | contracts   | production | active   | `packages/contracts-source/src/main.tsp`                        |
| `contracts-ts`                   | contracts     | generated   | production | active   | `packages/contracts-ts/src/index.ts`                            |
| `contracts-rust`                 | contracts     | generated   | production | active   | `crates/contracts-rust/src/lib.rs`                              |
| `optimizer-domain`               | optimizer     | domain      | production | reserved | `crates/optimizer-domain/src/lib.rs`                            |
| `desktop-application`            | desktop       | application | production | reserved | `crates/desktop-application/src/lib.rs`                         |
| `desktop-client`                 | desktop       | application | production | active   | `packages/desktop-client/src/index.ts`                          |
| `desktop-production-reference`   | desktop       | adapter     | production | active   | `packages/desktop-production-reference/src/index.ts`            |
| `desktop-simulator`              | desktop       | adapter     | fixture    | active   | `packages/desktop-simulator/src/index.ts`                       |
| `design-tokens`                  | design-system | design      | production | reserved | `packages/design-tokens/src/index.ts`                           |
| `design-system`                  | design-system | design      | production | reserved | `packages/design-system/src/index.ts`                           |
| `feature-shell`                  | desktop-ui    | feature     | production | reserved | `packages/feature-shell/src/index.ts`                           |
| `desktop-app`                    | desktop       | composition | production | reserved | `apps/desktop/src/index.ts`                                     |
| `acceptance-policy`              | architecture  | tooling     | tooling    | active   | `tooling/acceptance-policy/src/policy.ts`                       |
| `phase5-evidence`                | architecture  | tooling     | tooling    | active   | `tooling/phase5-evidence/src/evaluate.ts`                       |
| `architecture-tests`             | architecture  | tooling     | tooling    | active   | `tooling/architecture-tests/src/policy.ts`                      |
| `contract-compat`                | contracts     | tooling     | tooling    | active   | `tooling/contract-compat/src/check-compat.ts`                   |
| `contract-generation`            | contracts     | tooling     | tooling    | active   | `tooling/contract-generation/src/generate.ts`                   |
| `contract-generation-spike`      | contracts     | tooling     | tooling    | active   | `tooling/contract-generation-spike/src/run-spike.ts`            |
| `fixture-guard`                  | architecture  | tooling     | tooling    | active   | `tooling/fixture-guard/src/static-guard.ts`, `runtime-guard.ts` |
| `contract-generation-rust`       | contracts     | tooling     | tooling    | active   | `tooling/contract-generation-rust/src/main.rs`                  |
| `contract-generation-spike-rust` | contracts     | tooling     | tooling    | active   | `tooling/contract-generation-spike-rust/src/main.rs`            |
| `workspace-smoke`                | architecture  | tooling     | tooling    | active   | `tooling/workspace-smoke/check-toolchain.mjs`                   |

`reserved` means the policy allocates ownership and dependency direction for a
future module. It does not mean the package, crate, application, API, or product
feature exists in Phase 1.

## Dependency direction

Dependencies point only toward the layers listed by the canonical policy:

| Layer       | May depend on                                    |
| ----------- | ------------------------------------------------ |
| contracts   | none                                             |
| generated   | contracts                                        |
| domain      | generated                                        |
| application | domain, generated                                |
| adapter     | application, domain, generated                   |
| design      | design, generated                                |
| feature     | application, design, generated                   |
| composition | feature, adapter, application, design, generated |
| tooling     | all declared layers, including tooling           |

Named exceptions can waive only an exact layer-direction rule. They cannot
permit undeclared owners, overlapping roots, cycles, non-public deep imports,
or production-to-fixture dependencies. There are currently no exceptions.

## Generated-file ownership

- `packages/contracts-source` owns editable TypeSpec semantics.
- TypeSpec and the contract-generation tooling own emitted schemas and generated
  TypeScript and Rust transports.
- `packages/contracts-ts` and `crates/contracts-rust` expose generated results
  but do not own contract meaning.
- A generated diff is reviewed through generation, drift, compatibility, corpus,
  and runtime-validation gates. Generated files are never patched by hand.
- The contracts owner approves compatible baseline updates and all explicit
  major transitions under ADR 0002.

## Change checklist

Before merging an ownership or boundary change:

1. Change `module-boundaries.json` and its fixtures/tests.
2. Confirm every root has exactly one owner and every cross-module import uses a
   declared public root.
3. Update this guide and record a new or superseding ADR when the decision
   changes architecture.
4. Run `pnpm test:architecture`, `pnpm docs:check`, and `pnpm verify:quick`.
