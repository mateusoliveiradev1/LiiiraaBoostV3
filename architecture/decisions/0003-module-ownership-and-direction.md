# ADR 0003: Module ownership and dependency direction

- Status: Accepted
- Date: 2026-07-27
- Owners: architecture
- Requirements: FOUND-02, FOUND-05

## Decision

[`architecture/module-boundaries.json`](../module-boundaries.json) is the single
executable authority for repository module identity, ownership, canonical roots,
public roots, dependency layers, runtime classes, and narrowly named
exceptions. Its schema is
[`architecture/module-boundaries.schema.json`](../module-boundaries.schema.json).

Human guides may summarize the policy but do not redefine it. Architecture
tests resolve ownership from repository roots rather than caller-supplied module
labels, reject overlapping roots, and evaluate both TypeScript and Cargo graphs
with the same rules.

## Direction

The allowed dependency direction is:

```text
contracts
  <- generated
  <- domain
  <- application
  <- adapter

generated + application + design
  <- feature
  <- composition
```

The `design` layer may depend on itself and generated transports. Tooling may
inspect every declared layer. The exact allowed-dependency sets remain in the
JSON authority.

Cross-module imports must use a declared public root. A layer exception can
waive only its exact named direction rule; it cannot waive unknown ownership,
overlapping roots, deep imports, production-to-fixture edges, or cycles.

TypeScript and Rust do not depend directly on each other. Both consume
transports generated from the same TypeSpec semantic source and share the same
runtime schema and corpus evidence. Domain behavior remains outside generated
transport packages.

## Status and ownership

`active` means an implementation root participates in the current executable
foundation. `reserved` allocates a future boundary without asserting that a
package, crate, application, API, screen, or capability exists.

The owner recorded for a module is accountable for its public surface and
dependency changes. Generated transports are exposed by the contracts owner,
but semantic edits belong only in `packages/contracts-source`; generator output
is never hand-edited.

## Enforcement

`pnpm test:architecture` runs:

- the live pnpm/dependency-cruiser adapter;
- the live Cargo metadata adapter; and
- policy fixtures for allowed graphs, forbidden directions, deep imports,
  fixture edges, unknown ownership, overlaps, and cycles.

The command is reachable from `pnpm verify:quick` and therefore from final
`pnpm verify`. Any change to ownership or direction must update the executable
policy, its fixtures, [the ownership guide](../OWNERSHIP.md), and a superseding
decision when architectural intent changes.

## Consequences

Module boundaries are reviewable before future packages exist and enforceable
as soon as they become active. Contributors cannot bypass ownership by naming a
graph node differently, importing a private path, or adding a language-specific
exception. The cost is that every legitimate new boundary needs an explicit
policy change and architecture review.
