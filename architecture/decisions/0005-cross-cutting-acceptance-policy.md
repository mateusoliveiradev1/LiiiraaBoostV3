# ADR 0005: Cross-cutting acceptance policy

- Status: Accepted
- Date: 2026-07-27
- Owners: architecture
- Requirements: FOUND-01, FOUND-02, FOUND-03, FOUND-04, FOUND-05, FOUND-06

## Decision

Every requirement or feature accepted by the repository must account for five
quality dimensions:

1. security;
2. privacy;
3. accessibility;
4. performance; and
5. recovery.

The executable manifest authority is
[`architecture/quality-manifest.schema.json`](../quality-manifest.schema.json).
Phase 1 uses one manifest per requirement under `quality/features` so ownership
and coverage remain unambiguous.

## Planned and final modes

Acceptance mode is always an explicit caller choice. It is never inferred from
the checkout, environment, file presence, CI state, or a fixture label.

- **Planned mode** permits evidence with `planned` status. It validates schema,
  requirement coverage, ownership, exact paths, exact terminating commands, and
  accountable exemptions so incomplete work stays visible.
- **Final mode** requires tested evidence to have `passed` status. Each exact
  repository-relative evidence file must exist and each exact terminating
  command must be reachable from the caller-supplied root verification graph.

A dimension may be `not_applicable` only with an accountable owner, specific
rationale, residual risk, and dated reopening trigger. Omission is never an
exemption.

The executable evaluator is
[`tooling/acceptance-policy/src/policy.ts`](../../tooling/acceptance-policy/src/policy.ts).
Mutation fixtures prove that final mode rejects planned evidence, unresolved
files, unresolved commands, stale triggers, owner mismatches, and missing
dimensions.

## Root reachability

The development policy command is:

```text
pnpm test:acceptance-policy -- --mode planned
```

The final policy command is:

```text
pnpm acceptance:check -- --mode final
```

`pnpm verify:quick` reaches planned acceptance and every deterministic
foundation gate. `pnpm verify` reaches quick verification, full tests and
builds, production truth, supply-chain verification, and final acceptance.
Required-artifact tests ensure neither the root scripts nor CI can silently
drop these gates.

A directly executed test, a manually inspected document, or the existence of an
evidence file does not constitute final acceptance outside this graph.

## Phase 1 scope fence

Passing Phase 1 acceptance establishes only the modular workspace, generated
contract pipeline, compatibility policy, deterministic adapters and corpora,
truth/fixture defenses, architecture enforcement, and evidence machinery.

It does not establish or claim:

- a real optimizer or Windows mutation;
- Defender removal or bypass, Tamper Protection bypass, or silent security
  changes;
- any measured performance gain or real-machine benchmark;
- authentication, device licensing, subscriptions, billing, or administration;
- cloud, database, cache, queue, edge, or production infrastructure;
- a visual Tauri/React application or completed product UX.

Those capabilities require later-phase requirements and their own final evidence
across all five dimensions. A reserved module or planned manifest cannot be
used as proof that a capability exists.

## Consequences

Quality claims become traceable to exact, terminating, repository-owned
evidence instead of prose or ambient state. The policy is intentionally strict:
every release-relevant dimension is either tested or explicitly accountable,
and later phases cannot inherit Phase 1 acceptance for work Phase 1 did not do.
