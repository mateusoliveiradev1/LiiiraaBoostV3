# Phase 1: Product Truth and Modular Contracts Pattern Map

**Mapped:** 2026-07-27  
**Mode:** verification-gap closure  
**Files classified:** 6  
**Strong analogs found:** 5 (one new live-mutation harness has no exact analog)

## Gap Boundary

The only failed behavior is the TypeScript workspace architecture adapter's
discovery boundary. `dependency-cruiser.config.mjs` currently derives
`includeOnly` from `architecture/module-boundaries.json`, so a workspace package
missing from that policy is excluded before `evaluateGraph()` can emit
`UNKNOWN_OWNER`.

The closure should modify only the architecture constitution, its live
TypeScript adapter/configuration, its tests, and the two contributor-facing
ownership documents. Contract generation, adapters, provenance, fixture guards,
quality manifests, and Cargo graph behavior already passed verification.

## File Classification

| New/Modified File                                   | Role                      | Data Flow                                                                         | Closest Analog                                                      | Match Quality                                 |
| --------------------------------------------------- | ------------------------- | --------------------------------------------------------------------------------- | ------------------------------------------------------------------- | --------------------------------------------- |
| `architecture/module-boundaries.json`               | config / ownership model  | workspace inventory → normalized policy                                           | `architecture/decisions/0003-module-ownership-and-direction.md`     | exact authority                               |
| `dependency-cruiser.config.mjs`                     | config / adapter wiring   | discovered roots → dependency-cruiser batch                                       | `tooling/architecture-tests/src/check-cargo.ts`                     | same flow, different ecosystem                |
| `tooling/architecture-tests/src/check-workspace.ts` | adapter / transformer     | workspace discovery + dependency-cruiser output → canonical graph → policy result | `tooling/architecture-tests/src/check-cargo.ts`                     | exact role and flow                           |
| `tooling/architecture-tests/src/policy.test.ts`     | test                      | mutation / batch graph evaluation                                                 | existing `negativeFixtures` and real-adapter tests in the same file | exact test conventions, partial live coverage |
| `architecture/OWNERSHIP.md`                         | contributor documentation | canonical policy → human-readable table                                           | ADR 0003 status/ownership section                                   | exact semantics                               |
| `architecture/README.md`                            | contributor documentation | canonical policy → workflow guidance                                              | ADR 0003 status/ownership section                                   | exact semantics                               |

## Current Inventory Facts

The live pnpm workspace contains these package roots:

```text
packages/contracts-source
packages/contracts-ts
packages/desktop-client
packages/desktop-production-reference
packages/desktop-simulator
tooling/acceptance-policy
tooling/architecture-tests
tooling/contract-compat
tooling/contract-generation
tooling/contract-generation-spike
tooling/fixture-guard
tooling/workspace-smoke
```

Five active tooling packages have no module record:

```text
tooling/acceptance-policy
tooling/contract-compat
tooling/contract-generation
tooling/contract-generation-spike
tooling/workspace-smoke
```

Three implemented packages are incorrectly marked `reserved`:

```text
packages/contracts-source
packages/desktop-client
packages/desktop-simulator
```

`contracts-source` also declares the nonexistent public root
`packages/contracts-source/src/index.ts`; its actual TypeSpec entry is
`packages/contracts-source/src/main.tsp`.

## Pattern Assignments

### `tooling/architecture-tests/src/check-workspace.ts`

**Primary analog:** `tooling/architecture-tests/src/check-cargo.ts`

Cargo already uses the required ordering: discover the real workspace from an
ecosystem-owned source, normalize every discovered member into the canonical
graph, and only then consult the ownership policy.

**Independent discovery pattern** (`check-cargo.ts:132-168`):

```typescript
const readCargoPackages = (
  metadata: Record<string, unknown>,
  repositoryRoot: string,
): Map<string, CargoPackage> => {
  const workspaceMembers = new Set(readStringArray(metadata['workspace_members']));
  const packages = new Map<string, CargoPackage>();
  // Iterate metadata.packages, retain workspace members, normalize target paths.
  return packages;
};
```

**Normalize then evaluate pattern** (`check-cargo.ts:182-218`,
`check-cargo.ts:242-253`):

```typescript
const graph = normalizeCargoMetadata(policyInput, metadata, repositoryRoot);
return Promise.resolve({
  adapter: 'cargo' as const,
  graph,
  policy: evaluateGraph(policyInput, graph),
});
```

Apply the same separation to pnpm:

1. Discover package roots independently from `module-boundaries.json`.
2. Give every discovered package at least one graph node (for example its
   normalized manifest/root sentinel), even when dependency-cruiser finds no
   TypeScript edge.
3. Run dependency-cruiser across the independently discovered roots.
4. Merge and deterministically sort discovery nodes and dependency nodes/edges.
5. Pass the complete graph to `evaluateGraph()`.

Policy may classify discovered paths, but it must not decide which paths are
discoverable.

**Existing failure point** (`check-workspace.ts:157-158`):

```typescript
export const createCanonicalRootPattern = (policyInput: unknown): string =>
  rootPattern(readCanonicalPolicy(policyInput).modules.flatMap(({ roots }) => roots));
```

**Existing final adapter pattern to preserve** (`check-workspace.ts:312-322`):

```typescript
export const runLiveWorkspaceCheck = (policyInput: unknown): Promise<WorkspaceCheckResult> => {
  const graph = normalizeDependencyCruiserResult(
    policyInput,
    readCruiseOutput(runDependencyCruiser()),
  );
  return Promise.resolve({
    adapter: 'workspace' as const,
    graph,
    policy: evaluateGraph(policyInput, graph),
  });
};
```

Keep the returned shape and the shared evaluator; replace only the
self-scoped discovery input.

### Workspace-root discovery helper used by `check-workspace.ts`

**Closest local analog:** `tooling/workspace-smoke/check-toolchain.mjs`

This tool already scans package manifests without reading the architecture
policy. Its imports and traversal are at lines 1-3 and 74-105:

```javascript
import { existsSync, readFileSync, readdirSync } from 'node:fs';
import path from 'node:path';

function packageManifestPaths(root) {
  const manifests = [];
  const pending = ['apps', 'packages', 'tooling']
    .map((directory) => path.join(root, directory))
    .filter((directory) => existsSync(directory));

  // Traverse directories, skip node_modules/dot paths/symlinks,
  // and collect package.json paths.
  return manifests;
}
```

Copy the bounded traversal, path normalization, symlink exclusion, and
deterministic sorting conventions. Prefer deriving scan roots from
`pnpm-workspace.yaml` rather than duplicating `apps/*`, `packages/*`, and
`tooling/*` in another source. Do not add a catch-all `shared` helper package;
keep discovery owned by `architecture-tests` unless an existing named
capability is deliberately extracted.

### `dependency-cruiser.config.mjs`

**Current anti-pattern** (`dependency-cruiser.config.mjs:1-16`):

```javascript
export default {
  forbidden: createDependencyCruiserRestrictions(canonicalPolicy),
  options: {
    exclude: '(^|/)(?:node_modules|dist)(?:/|$)',
    includeOnly: createCanonicalRootPattern(canonicalPolicy),
    tsConfig: {
      fileName: 'tsconfig.base.json',
    },
  },
};
```

Preserve canonical-policy-derived `forbidden` restrictions. Change only
`includeOnly` so it is produced from independently discovered workspace roots.
This keeps rule authority in `module-boundaries.json` while removing policy from
the discovery boundary.

The pattern must continue to escape roots before constructing the regular
expression (`check-workspace.ts:138-155`) and retain the existing
`node_modules|dist` exclusion.

### `tooling/architecture-tests/src/policy.ts` (reuse, do not redesign)

The shared evaluator already fails unknown ownership before dependency
evaluation. Lines 739-772 parse policy/graph, iterate sorted nodes, and emit:

```typescript
const owners = findOwner(policy, node.path);
if (owners.length === 0) {
  diagnostics.push({
    code: 'UNKNOWN_OWNER',
    path: node.path,
    message: `No module owns "${node.path}".`,
  });
  continue;
}
```

Edge processing begins later at line 800. The gap is therefore upstream graph
completeness, not evaluator behavior. Do not add a parallel unknown-owner
implementation in the adapter or change the diagnostic taxonomy.

### `tooling/architecture-tests/src/policy.test.ts`

**Existing pure mutation pattern** (`policy.test.ts:250-305`):

```typescript
const negativeFixtures = [
  {
    name: 'production fixture edge',
    graph: forbiddenEdge,
    expectedDiagnostic: { code: 'PRODUCTION_TO_FIXTURE' /* ... */ },
  },
  {
    name: 'dependency cycle',
    graph: cycleGraph,
    expectedDiagnostic: { code: 'CYCLE' /* ... */ },
  },
] as const;

it.each(negativeFixtures)(
  'rejects only the seeded invariant in $name',
  ({ graph, expectedDiagnostic }) => {
    expect(evaluateGraph(canonicalPolicy, graph)).toEqual({
      ok: false,
      diagnostics: [expectedDiagnostic],
    });
  },
);
```

**Existing unknown-owner assertion** (`policy.test.ts:68-84`):

```typescript
const graph = {
  schemaVersion: 1,
  nodes: [productionNode('packages/unowned/src/index.ts')],
  edges: [],
};

expect(evaluateGraph(canonicalPolicy, graph)).toEqual({
  ok: false,
  diagnostics: [
    {
      code: 'UNKNOWN_OWNER',
      path: 'packages/unowned/src/index.ts',
      message: 'No module owns "packages/unowned/src/index.ts".',
    },
  ],
});
```

Keep these fast pure tests, but add a live-adapter/root-gate mutation group that
proves the discovery seam itself:

1. An undeclared package under an allowed pnpm workspace root reaches
   `evaluateGraph()` and makes the root architecture command fail with
   `UNKNOWN_OWNER`.
2. After declaring that package, a forbidden cross-layer edge within/from it
   makes the same root command fail with the existing direction diagnostic.
3. A cycle involving that package makes the same root command fail with
   `CYCLE`.
4. Removing the mutations restores a passing gate and leaves the repository
   unchanged.

The existing adapter-injection convention at `policy.test.ts:542-575` verifies
each adapter executes exactly once; retain it for unit isolation.

There is no exact existing test for mutating a live pnpm workspace and executing
the root architecture gate. If temporary filesystem isolation is needed, the
nearest cleanup convention is
`tooling/contract-generation/src/generate.ts:206` plus lines 431-432:

```typescript
const stagingRoot = await mkdtemp(join(tmpdir(), 'liiiraa-contract-generation-'));
try {
  // isolated work
} finally {
  await rm(stagingRoot, { force: true, recursive: true });
}
```

Use an architecture-specific temporary prefix and `finally` cleanup. Never
leave a seeded package in the real workspace.

### `architecture/module-boundaries.json`

**Semantic authority:** ADR 0003 lines 10-18 and 50-59.

```text
active   = an implementation root participates in the current executable foundation
reserved = a future boundary; it does not assert an implementation exists
```

Preserve the existing record shape and field ordering:

```json
{
  "id": "architecture-tests",
  "owner": "architecture",
  "layer": "tooling",
  "roots": ["tooling/architecture-tests"],
  "publicRoots": ["tooling/architecture-tests/src/policy.ts"],
  "runtimeClass": "tooling",
  "status": "active"
}
```

For each of the five missing tooling packages, add an explicit capability owner,
`layer: "tooling"`, `runtimeClass: "tooling"`, `status: "active"`, its package
root, and its actual public/CLI source root. Do not collapse them into one
generic tooling module. Change the three implemented records from `reserved` to
`active`, and correct the TypeSpec public root.

Do not remove legitimate future `reserved` records; they remain architecture
allocations. Do not add exceptions for this closure.

### `architecture/OWNERSHIP.md` and `architecture/README.md`

**Primary analog/authority:** ADR 0003 lines 50-59.

`OWNERSHIP.md` already declares JSON canonical at lines 3-6 and mirrors every
module in a table. Update that table from the corrected JSON in the same order,
including all five tooling modules, corrected public roots, and the three
corrected statuses.

Its current status prose at lines 29-31 defines only `reserved`. Expand it to
state both ADR meanings:

```markdown
`active` means an implementation root participates in the current executable
foundation. `reserved` allocates a future boundary without asserting that a
package, crate, application, API, screen, or capability exists.
```

Keep the change checklist at `OWNERSHIP.md:68-74` and the rule in
`README.md:24-31` that policy and guide change together. `README.md` should
continue warning against empty shells, but must make clear that an existing
workspace root is `active`, not `reserved`.

## Shared Patterns

### Discovery and policy are separate inputs

- Workspace/Cargo metadata determines what exists.
- `module-boundaries.json` determines who owns it and which edges are legal.
- The graph must include all discovered roots before the evaluator runs.
- The canonical evaluator remains the sole source of architecture diagnostics.

### Deterministic normalization

Reuse `normalizeRepositoryPath`, escape roots before regex construction, exclude
dependency/vendor/build directories, and sort roots, nodes, edges, and
diagnostics before assertions. Existing tests compare complete deterministic
objects rather than substring-only success.

### Capability ownership

Every active package gets its own named module record. Avoid catch-all
`shared`, `common`, `utils`, or generic `services`/`tooling` ownership buckets.
Tooling may depend on all declared layers, but it still needs an explicit owner,
root, public root, runtime class, and active status.

### Documentation follows executable authority

JSON remains canonical. Human tables and status prose are synchronized in the
same change and checked with:

```powershell
pnpm test:architecture
pnpm docs:check
pnpm verify:quick
```

## No Exact Analog

The repository has pure graph mutation fixtures and temporary staging cleanup,
but no existing test that creates an undeclared pnpm workspace package and
executes the live root architecture gate. The closure plan must make that new
integration seam explicit; a further pure `evaluateGraph()` test would repeat
already-passing evidence and would not close the verification gap.

## Metadata

**Analog search scope:** `architecture/`, `tooling/architecture-tests/`,
`tooling/workspace-smoke/`, `tooling/contract-generation/`, root workspace
configuration, and all active package manifests.  
**Strong analogs:** Cargo live adapter, workspace-smoke manifest discovery,
shared policy evaluator, architecture fixture tests, ADR 0003 status/ownership
semantics.  
**Pattern extraction date:** 2026-07-27
