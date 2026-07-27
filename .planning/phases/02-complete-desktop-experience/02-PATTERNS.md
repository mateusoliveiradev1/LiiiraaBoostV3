# Phase 02: Complete Desktop Experience Pattern Map

**Mapped:** 2026-07-27  
**Mode:** pre-plan implementation mapping  
**Files classified:** 35 logical new/modified file groups  
**Analogs found:** 24 / 35  
**Coverage:** 15 exact architectural analogs, 9 role/data-flow matches, 11 no direct analog

Phase 2 creates the repository's first React/Tauri product UI. There is no existing
desktop screen, React component, route tree, XState workflow, localization catalog,
Storybook catalog, Playwright suite, or packaged Tauri journey to copy. The strongest
repository analogs are therefore behavioral: bounded generated ownership, validated
request/result ports, deterministic simulator composition, fail-closed production
truth, executable module policy, and omission-resistant acceptance evidence.

The classifications below are logical file groups because `02-RESEARCH.md` explicitly
leaves exact internal filenames to planner discretion. A plan may split a group into
multiple files, but every resulting file should retain the assigned role, data flow,
and pattern source.

## File Classification

| # | New/Modified File Group | Role | Data Flow | Closest Existing Analog | Match Quality |
|---:|---|---|---|---|---|
| 1 | `architecture/module-boundaries.json` | config / ownership model | batch | `architecture/module-boundaries.json` plus `tooling/architecture-tests/src/check-workspace.ts` | exact architectural |
| 2 | Root workspace scripts and package graph (`package.json`, `pnpm-workspace.yaml`, root TypeScript/Turbo config) | config | batch | root `package.json` and `tooling/ci/verify-required-artifacts.mjs` | exact architectural |
| 3 | `packages/contracts-source/src/**` Phase 2 TypeSpec definitions | model | transform | `tooling/contract-generation/src/generate.ts` | exact architectural |
| 4 | Generated TypeScript/Rust/schema Phase 2 artifacts | generated model | transform / file-I/O | `tooling/contract-generation/src/generate.ts` | exact architectural |
| 5 | `packages/desktop-client/src/**` Phase 2 transport models | model | request-response | `packages/desktop-client/src/client.ts` | exact |
| 6 | `packages/desktop-client/src/**` Phase 2 client services | service | request-response | `packages/desktop-client/src/client.ts` | exact |
| 7 | Desktop-client Phase 2 unit/conformance tests | test | request-response | `packages/desktop-client/src/client.test.ts` | exact |
| 8 | `packages/desktop-simulator/src/scenarios/**` scenario families and deltas | model / fixture | transform | `packages/desktop-simulator/src/scenarios.ts` | exact |
| 9 | Desktop simulator Phase 2 adapters | service / provider | request-response | `packages/desktop-simulator/src/index.ts` | exact |
| 10 | Simulator conformance, determinism, and provenance tests | test | request-response | `packages/desktop-simulator/src/conformance.test.ts` | exact |
| 11 | `packages/design-tokens` package manifest and build/type config | config | batch | existing workspace package manifests and module records | role/data-flow |
| 12 | `packages/design-tokens/src/**` color, type, spacing, scale, density, and motion tokens | model | transform | none | no direct analog |
| 13 | `packages/design-system` package manifest and build/type config | config | batch | existing workspace package manifests and module records | role/data-flow |
| 14 | `packages/design-system/src/primitives/**` React Aria visual wrappers | component | event-driven | none | no direct analog |
| 15 | `packages/design-system/src/evidence/**` provenance, status, freshness, and quality components | component / projection | transform | `packages/desktop-client/src/client.ts` validated domain mapping | role/data-flow |
| 16 | Design-system workflow compositions and desktop app-shell/window components | component | event-driven | none | no direct analog |
| 17 | `packages/design-system/src/data/**` charts, tables, timelines, and text alternatives | component | transform / streaming | none | no direct analog |
| 18 | Design-system component/unit/interaction tests | test | event-driven | existing Vitest tests with frozen complete-object assertions | role/data-flow |
| 19 | `packages/feature-shell` package manifest and build/type config | config | batch | existing workspace package manifests and module records | role/data-flow |
| 20 | `packages/feature-shell/src/model/**` operational state, favorites, Activity, feedback, and phase boundaries | model / store | event-driven / transform | desktop-client closed result/error models and frozen values | role/data-flow |
| 21 | `packages/feature-shell/src/machines/**` calibration, preview, recovery, and restart machines | store / workflow | event-driven | none | no direct analog |
| 22 | `packages/feature-shell/src/features/**` selectors, projections, and feature surfaces | component / service | transform | desktop-client boundary mapping and simulator receipts | role/data-flow |
| 23 | Feature-shell route-facing exports | route | request-response | existing public-root and production-composition boundaries | role/data-flow |
| 24 | Feature-shell reducers, machines, selectors, and feature tests | test | event-driven / transform | architecture and acceptance mutation-matrix tests | role/data-flow |
| 25 | `apps/desktop` package, Vite, TypeScript, and test configuration | config | batch | root package scripts and executable workspace policy | exact architectural |
| 26 | `apps/desktop/src/composition/**` providers and adapter selection | provider | request-response | `packages/desktop-production-reference/src/composition.ts` | exact |
| 27 | `apps/desktop/src/routes/**` TanStack route tree, search state, and return intents | route | event-driven | none | no direct analog |
| 28 | `apps/desktop/src-tauri/**` Rust host, plugins, capabilities, bundle, signing, tray, and updater config | controller / config | event-driven / file-I/O | none | no direct analog |
| 29 | PT-BR, English, and pseudo-locale catalogs and formatter utilities | model / utility | file-I/O / transform | none | no direct analog |
| 30 | Storybook configuration, story catalog, and state fixtures | config / test | event-driven / batch | none | no direct analog |
| 31 | Playwright, axe, keyboard, forced-colors, screenshot, and route journeys | test | event-driven | none | no direct analog |
| 32 | Packaged Windows/Tauri driver, signature, non-elevation, tray, and deep-link harness | test | event-driven | none | no direct analog |
| 33 | `quality/features/ux-01.json` through `quality/features/ux-12.json` | quality manifest | batch / file-I/O | `quality/features/found-03.json` | exact |
| 34 | Required-artifact lists and root-gate reachability updates | config / verifier | batch / file-I/O | `tooling/ci/verify-required-artifacts.mjs` | exact |
| 35 | Acceptance-policy, omission-matrix, and CI tests/updates | policy / test | batch / transform | `tooling/acceptance-policy/src/policy.ts` and tests | exact |

## Pattern Assignments

### 1. Contract generation and bounded artifact ownership

**Applies to groups:** 3, 4, and the generated portions of 5.

**Primary analog:** `tooling/contract-generation/src/generate.ts`

The generator owns an explicit artifact set rather than scanning arbitrary output.
Its declared artifact paths and source inputs are centralized
(`generate.ts:46-56`, `generate.ts:98-102`), and writes are staged before replacement
(`generate.ts:437-480`).

```typescript
const temporaryPath = `${path}.${String(process.pid)}.tmp`;

await mkdir(dirname(path), { recursive: true });
await writeFile(temporaryPath, contents, 'utf8');
await rename(temporaryPath, path);
```

The schema compiler also isolates temporary state and guarantees cleanup
(`generate.ts:203-232`):

```typescript
const stagingRoot = await mkdtemp(
  join(tmpdir(), 'liiiraa-contract-generation-'),
);

try {
  // Compile and validate canonical schema in isolation.
} finally {
  await rm(stagingRoot, { force: true, recursive: true });
}
```

Copy these rules into Phase 2 contract work:

- Add UI/workflow transport concepts to the canonical TypeSpec source first.
- Generate TypeScript, Rust, and schemas only into declared module-owned roots.
- Reject undeclared, stale, or drifting artifacts deterministically.
- Keep generated output reviewable and never hand-edit it.
- Add a drift test using the complete deterministic diagnostic style in
  `tooling/contract-generation/src/check-drift.test.ts:1-60`.
- Do not put component-local view state into cross-process contracts. Only transport
  stable identities, capabilities, inputs, results, receipts, and truth provenance.

### 2. Validated desktop-client request/result boundary

**Applies to groups:** 5-7, 15, 20, and 22.

**Primary analog:** `packages/desktop-client/src/client.ts`

The public client boundary separates transport identity from the application client
(`client.ts:32-45`), accepts unknown transport data, validates it before mapping, and
returns a closed typed result rather than throwing or leaking a raw payload
(`client.ts:119-140`, `client.ts:158-208`, `client.ts:231-238`).

```typescript
export interface DesktopInspectionTransport {
  readonly identity: DesktopClientIdentity;
  inspectSystem(input: InspectSystemInput): Promise<unknown>;
}

let raw: unknown;
try {
  raw = await transport.inspectSystem(input);
} catch {
  return { ok: false, error: { code: 'TRANSPORT_FAILURE' } };
}

const envelope = parseEnvelope(raw, input);
if (!envelope.ok) {
  return envelope;
}
```

Follow the same layering for Phase 2:

```text
unknown adapter response
  -> schema/envelope validation
  -> typed client Result
  -> feature selector/projection
  -> authored component
```

- UI components consume projected domain values; they do not parse Tauri responses,
  construct fixture truth, or infer capabilities.
- Every loading, empty, offline, permission, unsupported, partial-failure,
  restart-pending, recovery, expired-entitlement, stale, contradictory, fixture, and
  ready state belongs to one closed discriminated union.
- Boundary failures become redacted stable error codes with retryability/recovery
  metadata. Preserve details only where the contract explicitly permits them.
- Freeze returned identities, capabilities, results, and nested payloads.
- Keep cancellation checks before and after transport work.

Testing precedent:

- `packages/desktop-client/src/client.test.ts:92-175` asserts complete frozen and
  redacted results for invalid data, transport failure, and cancellation.
- Avoid snapshots that merely prove markup exists; assert the complete projected
  state, accessible label/status meaning, recovery action, and provenance.

There is no authentication/authorization middleware pattern in the repository. Phase 2
must render honest signed-out, expired-entitlement, offline, and unavailable account
states without inventing fake authentication success or storing fake credentials.

### 3. Deterministic simulator and fail-closed production composition

**Applies to groups:** 8-10, 20, 22, 23, and 26.

**Primary analogs:**

- `packages/desktop-simulator/src/index.ts`
- `packages/desktop-simulator/src/scenarios.ts`
- `packages/desktop-production-reference/src/composition.ts`
- `tooling/fixture-guard/src/runtime-guard.ts`

Simulator construction receives changing values as dependencies and returns frozen
transport envelopes (`desktop-simulator/src/index.ts:15-49`):

```typescript
export const createDesktopSimulator = (
  options: DesktopSimulatorOptions,
): DesktopInspectionClient => {
  const scenario = DESKTOP_SIMULATOR_SCENARIOS[options.scenario];

  const transport: DesktopInspectionTransport = Object.freeze({
    identity: Object.freeze({
      name: 'liiiraa-desktop-simulator',
      schemaVersion: DESKTOP_SCHEMA_VERSION,
      capabilities: Object.freeze([DESKTOP_INSPECTION_CAPABILITY]),
    }),
    inspectSystem(input) {
      return Promise.resolve(
        Object.freeze({
          // ...
          payload: Object.freeze({
            inspectionId: options.inspectionIds(),
            inspectedAt: options.clock(),
            deviceLabel: scenario.deviceLabel,
          }),
        }),
      );
    },
  });
};
```

Scenario constructors and the scenario registry freeze fixture provenance and values
(`desktop-simulator/src/scenarios.ts:29-69`). Extend that pattern to the S01-S24
families: inject clock, ID source, seed, locale, latency, entitlement, and focused
deltas. A scenario ID must fully reproduce Storybook, browser, screenshot, and packaged
test behavior.

Production composition has no simulator fallback
(`desktop-production-reference/src/composition.ts:45-56`):

```typescript
export const createProductionDesktopComposition = (
  options: ProductionUnavailableOptions,
): ProductionDesktopComposition =>
  Object.freeze({
    mode: 'production',
    client: createProductionUnavailableClient(options),
  });
```

The runtime guard recursively rejects fixture markers
(`fixture-guard/src/runtime-guard.ts:24-59`, `runtime-guard.ts:73-98`):

```typescript
if (
  value['kind'] === 'fixture' ||
  Object.hasOwn(value, 'scenarioId') ||
  Object.hasOwn(value, 'fixtureVersion')
) {
  findings.push(
    Object.freeze({ code: 'FIXTURE_PROVENANCE', path }),
  );
  return;
}
```

Phase 2 composition must therefore:

- Select simulator/production adapters only in `apps/desktop/src/composition/**`.
- Keep scenario imports out of `feature-shell`, `design-system`, and production roots.
- Show a typed unavailable/unsupported state when a real capability does not exist.
- Route future-action previews through typed receipts and scenario-marked Activity,
  never a fake successful privileged operation.
- Run the production fixture guard against the fully composed desktop boundary.

Testing precedent:

- `packages/desktop-simulator/src/conformance.test.ts:10-63` runs shared conformance
  expectations across scenarios.
- Add focused delta tests: each S01-S24 case changes only its declared conditions and
  remains stable under a frozen clock/seed/locale.

### 4. Executable workspace and module policy

**Applies to groups:** 1, 2, 11, 13, 19, 23, and 25.

**Primary analogs:**

- `tooling/architecture-tests/src/check-workspace.ts`
- `architecture/module-boundaries.json`

Workspace discovery and policy evaluation are separate. The live adapter discovers
workspace roots independently, normalizes dependency-cruiser output, then hands the
complete graph to the canonical evaluator (`check-workspace.ts:258-330`,
`check-workspace.ts:422-507`):

```typescript
export const runLiveWorkspaceCheck = (
  policyInput: unknown,
): Promise<WorkspaceCheckResult> => {
  const workspaceRoots = discoverPnpmWorkspaceRoots(process.cwd());
  const graph = normalizeDependencyCruiserResult(
    policyInput,
    readCruiseOutput(runDependencyCruiser()),
    workspaceRoots,
  );

  return Promise.resolve({
    adapter: 'workspace' as const,
    graph,
    policy: evaluateGraph(policyInput, graph),
  });
};
```

Use this pattern when activating `design-tokens`, `design-system`, `feature-shell`, and
`apps/desktop`:

- Give each package one named owner, layer, runtime class, root, real public root, and
  `active` status.
- Import across packages only through declared public roots.
- Keep local ESM source imports explicit with `.js` extensions.
- Do not add `shared`, `common`, `utils`, or catch-all UI ownership buckets.
- Feature packages may depend on client/contracts and design-system public roots;
  production code must not depend on simulator/fixture roots.
- Route-facing exports expose feature capability; they do not construct adapters.
- Preserve deterministic root/node/edge/diagnostic ordering.

Negative-test precedent:

- `tooling/architecture-tests/src/policy.test.ts:176-236` seeds fixture-boundary,
  dependency-direction, and cycle violations one at a time.
- `policy.test.ts:311-336` asserts unknown public-root/ownership failures.
- `policy.test.ts:605-700` exercises live workspace mutation and restoration.

Every new module/dependency rule needs a negative mutation proving that the root
architecture command sees and rejects the violation.

### 5. Quality manifests and omission/reachability enforcement

**Applies to groups:** 18, 24, and 30-35.

**Primary analogs:**

- `quality/features/found-03.json`
- `tooling/acceptance-policy/src/policy.ts`
- `tooling/ci/verify-required-artifacts.mjs`
- root `package.json`

The policy defines the complete required quality dimensions and explicit planned/final
modes (`acceptance-policy/src/policy.ts:5-14`):

```typescript
export const QUALITY_DIMENSIONS = [
  'security',
  'privacy',
  'accessibility',
  'performance',
  'recovery',
] as const;

export type PolicyMode = 'planned' | 'final';
```

Evidence validation requires a unique ID, matching owner, exact repository file,
exact terminating command, and final passed status
(`acceptance-policy/src/policy.ts:254-323`):

```typescript
if (!isExactRepositoryPath(evidence.file)) {
  diagnostics.push(/* EVIDENCE_PATH_NOT_EXACT */);
}

if (!isTerminatingCommand(evidence.command)) {
  diagnostics.push(/* EVIDENCE_COMMAND_NOT_TERMINATING */);
} else if (!isExactCommand(evidence.command)) {
  diagnostics.push(/* EVIDENCE_COMMAND_NOT_EXACT */);
}

if (context.mode === 'final' && evidence.status !== 'passed') {
  diagnostics.push(/* EVIDENCE_NOT_FINAL */);
}
```

The evaluator walks every dimension and sorts diagnostics
(`acceptance-policy/src/policy.ts:369-390`). The repository verifier then confirms
that final evidence files exist and evidence commands are reachable from the root
verification graph (`verify-required-artifacts.mjs:200-219`,
`verify-required-artifacts.mjs:240-260`).

Root reachability is explicit (`package.json:44-45`):

```json
"verify:quick": "... test:acceptance-policy -- --mode planned && pnpm verify:artifacts",
"verify": "pnpm verify:quick && ... test:acceptance-policy -- --mode final && pnpm acceptance:check -- --mode final"
```

Apply this as follows:

- Create one manifest for each UX-01 through UX-12; do not aggregate requirements into
  a generic desktop manifest.
- Every automated evidence command terminates, has no shell chaining/redirection in the
  manifest value, and is reachable from `verify:quick` or `verify` as appropriate.
- Manual-only Authenticode, Windows 10/11, NVDA, high-contrast, and performance checks
  remain explicit planned evidence until performed; final mode must fail closed.
- Add omission tests for every required UX manifest, evidence file, root command,
  quality dimension, scenario/story matrix member, and CI marker.
- Preserve the planned/final matrix precedent in
  `tooling/acceptance-policy/src/policy.test.ts:222-264` and
  `policy.test.ts:333-380`.

## Shared Patterns

### Public boundaries and imports

- Import another package only through a public root declared in
  `architecture/module-boundaries.json`.
- Use local ESM imports with explicit `.js` extensions.
- Keep generated artifacts in their owning package and fail generation drift.
- Keep simulator construction in app composition and simulator provenance outside
  production feature/UI dependency graphs.

### Validation, errors, and truth

- Treat adapter, persisted, deep-link, downloaded, and cross-process values as
  `unknown` until runtime validation succeeds.
- Return typed `Result` errors and closed operational-state unions; do not leak
  exceptions or raw payloads into components.
- Redact diagnostics by default and expose stable correlation IDs where required.
- Unsupported or unavailable real capability is a valid explicit state, not permission
  to substitute fixture success.
- No real auth pattern exists yet; do not invent one in the visual milestone.

### Determinism and immutability

- Freeze identities, capabilities, scenario definitions, provenance, truth values,
  receipts, and policy reports.
- Inject clock, ID, seed, locale, latency, and other nondeterministic dependencies.
- Sort generated artifacts, roots, nodes, edges, evidence, and diagnostics before
  comparing complete objects.
- Scenario IDs are stable shared keys across simulator, stories, screenshots, E2E, and
  evidence.

### Executable policy and testing

- Express ownership, dependency, fixture, requirement, and evidence rules as data
  interpreted by one canonical evaluator.
- Every new invariant gets a negative mutation/omission test that fails only for the
  seeded violation.
- Every evidence record names one exact file and one exact terminating root-reachable
  command.
- Unit tests cover reducers/selectors/formatters and state machines; component stories
  cover semantic/visual states; browser journeys cover keyboard/axe/routes/screenshots;
  packaged journeys cover Windows/Tauri truth.

## No Analog Found

The following 11 groups have no direct implementation analog in the current repository:

1. Design-token implementation and Pre-Dawn Flight Deck visual values.
2. Authored React Aria primitive wrappers and their visual/accessibility API.
3. Reusable workflow compositions and desktop shell/window components.
4. uPlot charts, tables, timelines, and mandatory text alternatives.
5. XState calibration, preview, recovery, restart, and overlay machines.
6. TanStack Router route tree, validated search state, and typed return intents.
7. Tauri Rust host, plugin/capability policy, bundling, signing, tray, and updater setup.
8. PT-BR/English/pseudo-locale catalogs, expansion tests, and formatter layer.
9. Storybook configuration and the exhaustive scenario/state story catalog.
10. Playwright/axe/keyboard/forced-colors/screenshot browser harness.
11. Packaged `tauri-driver` Windows, signature, non-elevation, tray, and deep-link harness.

For these files, use the official stack contracts and `02-UI-SPEC.md` as the
implementation authority. Reuse the repository's boundary, determinism, fixture,
ownership, and evidence behaviors around them, but do not pretend an unrelated tooling
file is a component-level analog.

## Metadata

**Phase requirements:** UX-01 through UX-12  
**Analog search scope:** `architecture/`, `packages/desktop-client/`,
`packages/desktop-simulator/`, `packages/desktop-production-reference/`,
`tooling/contract-generation/`, `tooling/fixture-guard/`,
`tooling/architecture-tests/`, `tooling/acceptance-policy/`, `tooling/ci/`,
`quality/features/`, and root workspace scripts.  
**Strong analog families:** 5  
**Direct UI analogs:** 0  
**Pattern extraction date:** 2026-07-27
