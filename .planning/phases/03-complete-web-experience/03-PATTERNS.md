# Phase 3: Complete Web Experience - Pattern Map

**Mapped:** 2026-07-30
**Files analyzed:** 34 explicit or implied files/file families
**Analogs found:** 29 / 34

## Scope Extracted from Context and Research

Phase 3 creates three independently deployable Next.js applications and four shared/tooling modules:

- `apps/web` is a production/static-first composition for public, documentation, release, and download routes.
- `apps/account` and `apps/admin` are fixture-classified preview compositions until Phase 4 supplies authority.
- `packages/web-core` owns routes, content identities, safe links, schemas, and future-authority ports.
- `packages/web-preview` owns the closed deterministic scenario catalog and no-change adapter.
- `packages/web-features` owns shared semantic UI and workflow machines.
- `tooling/web-evidence` owns route, content, security, release, visual, and publication gates.

The exact page inventory is driven by `03-CONTEXT.md` and `03-UI-SPEC.md`; the file map below groups repeated App Router pages by route family while listing every explicitly named Wave 0 file.

## File Classification

| New/Modified File | Role | Data Flow | Closest Analog | Match Quality |
|---|---|---|---|---|
| `architecture/module-boundaries.json` | config | transform | same file, existing desktop module declarations | exact |
| `tooling/architecture-tests/src/check-workspace.test.ts` | test | transform | same file, Phase 2 activation matrix | exact |
| `apps/web/package.json`, `tsconfig.json`, `next.config.ts` | config | batch | `apps/desktop/package.json`, `packages/desktop-simulator/tsconfig.json` | role-match |
| `apps/web/src/index.ts` | config/public root | request-response | `apps/desktop/src/index.ts` | role-match |
| `apps/web/src/app/[locale]/layout.tsx` and public shell | component | request-response | `apps/desktop/src/app.tsx`, `packages/design-system/src/shell.tsx` | role-match |
| `apps/web/src/app/[locale]/**/page.tsx` | component/route | request-response | `apps/desktop/src/routes.tsx` plus feature exports | role-match |
| `apps/web/src/app/[locale]/not-found.tsx`, authored 403/410 routes, `global-error.tsx` | component/route | request-response | typed failure results in `apps/desktop/src/routes.tsx` | partial |
| `apps/web/src/content/**/*.mdx` and metadata records | model/content | file-I/O, transform | no repository MDX analog | none |
| `apps/web/proxy.ts`, `robots.ts`, `sitemap.ts`, metadata routes | middleware/route | request-response, transform | route projections in `apps/desktop/src/routes.tsx` | partial |
| `apps/account/package.json`, `tsconfig.json`, `next.config.ts` | config | batch | `apps/desktop/package.json` | role-match |
| `apps/account/src/index.ts`, `[locale]/layout.tsx`, account route pages | component/route | request-response | `apps/desktop/src/index.ts`, account routes in `apps/desktop/src/routes.tsx` | role-match |
| `apps/account/proxy.ts` and security headers | middleware | request-response | no nonce-CSP Next.js analog | none |
| `apps/admin/package.json`, `tsconfig.json`, `next.config.ts` | config | batch | `apps/desktop/package.json` | role-match |
| `apps/admin/src/index.ts`, `[locale]/layout.tsx`, admin route pages | component/route | request-response | `apps/desktop/src/index.ts`, `packages/feature-shell/src/features/preview-workflows.tsx` | role-match |
| `apps/admin/proxy.ts` and security headers | middleware | request-response | no isolated-origin nonce-CSP analog | none |
| `packages/web-core/package.json`, `tsconfig.json`, `src/index.ts` | config/public root | transform | `packages/desktop-simulator/package.json`, `packages/feature-shell/src/index.ts` | exact role |
| `packages/web-core/src/routes.ts` | model | transform, request-response | `apps/desktop/src/routes.tsx` | exact role |
| `packages/web-core/src/content.ts` | model/utility | file-I/O, transform | scenario manifest parser in `packages/desktop-simulator/src/scenarios/catalog.ts` | role-match |
| `packages/web-core/src/authority.ts` and link policy | service/utility | request-response | interaction-policy/receipt use in `packages/feature-shell/src/features/preview-workflows.tsx` | role-match |
| `packages/web-preview/package.json`, `tsconfig.json`, `src/index.ts` | config/public root | transform | `packages/desktop-simulator/*` | exact |
| `packages/web-preview/src/scenarios.ts` | model | event-driven, transform | `packages/desktop-simulator/src/scenarios/catalog.ts` | exact |
| `packages/web-preview/src/no-change-adapter.ts` | service/adapter | request-response | `packages/desktop-simulator/src/index.ts` | exact |
| `packages/web-features/package.json`, `tsconfig.json`, `src/index.ts` | config/public root | transform | `packages/feature-shell/*` | exact role |
| `packages/web-features/src/**/*.tsx` | component | request-response, event-driven | `packages/feature-shell/src/features/preview-workflows.tsx` | exact role |
| `packages/web-features/src/**/*.machine.ts` | store/machine | event-driven | transition table in `preview-workflows.tsx`; XState machines under `packages/feature-shell/src/machines` | exact role |
| `tooling/web-evidence/package.json`, `tsconfig.json` | config | batch | `tooling/fixture-guard/package.json`, `tooling/acceptance-policy/tsconfig.json` | exact role |
| `tooling/web-evidence/src/route-manifest.test.ts` | test | transform | `tooling/architecture-tests/src/check-workspace.test.ts` | role-match |
| `tooling/web-evidence/src/content-publication.test.ts` | test | file-I/O, batch | `packages/desktop-simulator/src/scenarios/catalog.test.ts` | role-match |
| `tooling/web-evidence/src/security-boundaries.test.ts` | test | request-response, batch | `tooling/fixture-guard/src/fixture-guard.test.ts` | exact role |
| `tooling/web-evidence/src/release-gate.test.ts` | test | file-I/O, request-response | artifact refusal cases in `tooling/fixture-guard/src/fixture-guard.test.ts` | exact role |
| `tooling/web-evidence/playwright.config.ts` | config/test | request-response, batch | `apps/desktop/playwright.config.ts` | exact role |
| `quality/features/WEB-01.json` | config/evidence | transform | `quality/features/ux-01.json` | exact |
| `quality/features/WEB-02.json`, `WEB-03.json`, `WEB-08.json` | config/evidence | transform | `quality/features/ux-01.json` and sibling UX manifests | exact |
| Root workspace scripts/config needed for `web:verify:*` and three builds | config | batch | existing filtered workspace scripts and package-local scripts | role-match |

## Pattern Assignments

### `architecture/module-boundaries.json` and architecture activation tests

**Analog:** existing desktop declarations in `architecture/module-boundaries.json`

**Layer direction pattern** (lines 18-48):

```json
{
  "name": "application",
  "allowedDependencies": ["domain", "generated"]
},
{
  "name": "adapter",
  "allowedDependencies": ["application", "domain", "generated"]
},
{
  "name": "feature",
  "allowedDependencies": ["application", "design", "generated"]
},
{
  "name": "composition",
  "allowedDependencies": ["feature", "adapter", "application", "design", "generated"]
}
```

**Production/fixture sibling pattern** (lines 99-123):

```json
{
  "id": "desktop-client",
  "owner": "desktop",
  "layer": "application",
  "roots": ["packages/desktop-client"],
  "publicRoots": ["packages/desktop-client/src/index.ts"],
  "runtimeClass": "production",
  "status": "active"
},
{
  "id": "desktop-simulator",
  "owner": "desktop",
  "layer": "adapter",
  "roots": ["packages/desktop-simulator"],
  "publicRoots": ["packages/desktop-simulator/src/index.ts"],
  "runtimeClass": "fixture",
  "status": "active"
}
```

Apply the same shape to:

- `web-core`: `application` / `production`
- `web-preview`: `adapter` / `fixture`
- `web-features`: `feature` / `production`
- `apps/web`: `composition` / `production`
- `apps/account`, `apps/admin`: `composition` / `fixture`
- `web-evidence`: `tooling` / `tooling`

**Activation-test pattern** (`tooling/architecture-tests/src/check-workspace.test.ts`, lines 33-74):

```typescript
const phase2Packages = [
  {
    id: 'design-tokens',
    owner: 'design-system',
    root: 'packages/design-tokens',
    publicRoot: 'packages/design-tokens/src/index.ts',
    packageName: '@liiiraa/design-tokens',
    workspaceDependencies: [],
  },
  {
    id: 'feature-shell',
    owner: 'desktop-ui',
    root: 'packages/feature-shell',
    publicRoot: 'packages/feature-shell/src/index.ts',
    packageName: '@liiiraa/feature-shell',
    workspaceDependencies: [
      '@liiiraa/contracts-ts',
      '@liiiraa/design-system',
      '@liiiraa/desktop-client',
    ],
  },
];
```

The Phase 3 test should assert one owner, one public root, exact `workspace:*` internal dependencies, correct runtime class, and legal dependency direction. Preserve the existing rejection tests for production-to-fixture imports and deep imports.

---

### `packages/web-core/src/routes.ts` and all route projections

**Analog:** `apps/desktop/src/routes.tsx`

**Typed record pattern** (lines 28-47):

```typescript
interface DesktopRouteDefinition {
  readonly pattern: string;
  readonly feature: DesktopFeature;
  readonly surface:
    | 'AccountSettingsSurface'
    | 'ActivitySurface'
    | 'DocumentationSurface'
    | 'PreviewWorkflowSurface';
  readonly state: string;
  readonly headingMessageId: string;
  readonly capability: 'navigate';
}
```

Create a web-specific readonly record with the Phase 3 fields: route ID, surface, pathname template, locale behavior, shell, owner, indexing policy, scenario requirement, security boundary, and safe-context keys.

**Construction and freeze pattern** (lines 49-69):

```typescript
const route = <
  const Pattern extends string,
  const Feature extends DesktopFeature,
  const Surface extends DesktopRouteDefinition['surface'],
  const State extends string,
>(
  pattern: Pattern,
  feature: Feature,
  surface: Surface,
  state: State,
) =>
  Object.freeze({
    pattern,
    feature,
    surface,
    state,
    headingMessageId: `route.${feature}.${state}.heading`,
    capability: 'navigate' as const,
  }) satisfies DesktopRouteDefinition;

export const desktopRouteTree = Object.freeze([
  route('/', 'calibration', 'CalibrationWorkspace', 'welcome'),
]);
```

Use one frozen `webRoutes` source. Derive navigation, breadcrumbs, sitemap, redirects, desktop contextual links, robots/indexing rules, and test coverage from it.

**Fail-closed result pattern** (lines 171-195):

```typescript
export type DesktopRouteErrorCode =
  | 'EMPTY_NAVIGATION'
  | 'INVALID_NAVIGATION_INTENT'
  | 'INVALID_PARAMETER'
  | 'INVALID_SEARCH_VALUE'
  | 'UNKNOWN_ROUTE'
  | 'UNKNOWN_SEARCH_KEY'
  | 'UNSAFE_RETURN_INTENT';

export type DesktopRouteResult =
  | Readonly<{ ok: true; value: DesktopRouteMatch }>
  | Readonly<{ ok: false; error: DesktopRouteError }>;

const failure = (code: DesktopRouteErrorCode, path: string): DesktopRouteResult =>
  Object.freeze({ ok: false, error: Object.freeze({ code, path }) });
```

Safe context and return paths must produce typed failures for unknown keys, schemes, hosts, locales, versions, channels, or destinations. They must never accept an arbitrary URL.

---

### `packages/web-preview/*` and preview compositions in `apps/account` / `apps/admin`

**Analog:** `packages/desktop-simulator/src/index.ts` and its scenario catalog

**Closed adapter pattern** (`packages/desktop-simulator/src/index.ts`, lines 18-42):

```typescript
export const createDesktopSimulatorClient = (
  options: DesktopSimulatorOptions,
): DesktopInspectionClient => {
  const scenario = getDesktopSimulatorScenario(options.scenario);
  const transport: DesktopInspectionTransport = {
    identity: Object.freeze({
      adapterId: 'liiiraa-desktop-simulator',
      adapterVersion: '1.0.0',
    }),
    schemaVersion: DESKTOP_SCHEMA_VERSION,
    capabilities: Object.freeze([DESKTOP_INSPECTION_CAPABILITY]),
    inspectSystem(input) {
      return Promise.resolve(
        Object.freeze({
          schemaVersion: DESKTOP_SCHEMA_VERSION,
          messageType: 'desktop.inspect-system.result',
          requestId: input.requestId,
          issuedAt: input.issuedAt,
          payload: Object.freeze({
            inspectionId: options.inspectionIds(),
            inspectedAt: options.clock(),
          }),
        }),
      );
    },
  };
```

`web-preview` should take deterministic clock/ID/scenario dependencies, publish an explicit fixture identity, and implement the same production-facing port as the future authority. It must not leak fixture-only types into `web-core` or `web-features`.

**Scenario completeness and truth tests** (`packages/desktop-simulator/src/scenarios/catalog.test.ts`, lines 28-47):

```typescript
const assertCompleteScenario = (scenario: DesktopScenario): void => {
  expect(scenario.seed).toBeTypeOf('number');
  expect(scenario.clock).toMatch(/Z$/);
  expect(['en-US', 'pt-BR']).toContain(scenario.locale);
  expect(scenario.adapterIdentity.kind).toBe('fixture');
  expect(scenario.adapterIdentity.scenarioMarker).toBe('SIMULATED SCENARIO');
  expect(scenario.requiredRoutes.length).toBeGreaterThan(0);
  expect(scenario.requiredStates.length).toBeGreaterThan(0);
  expect(scenario.noEffect.changed).toBe(false);
  expect(scenario.noEffect.receiptKind).toBe('scenario-preview');
  expect(scenario.noEffect.scenarioId).toBe(scenario.id);
};
```

Also copy the catalog’s unknown-ID refusal and stable serialization assertions (lines 103-111). Web scenarios W01-W18 should be closed, deeply frozen, bilingual, route/state complete, deterministic, and absent from ordinary published UI selection.

---

### `packages/web-features/src/**/*.tsx` and authority-boundary machines

**Analog:** `packages/feature-shell/src/features/preview-workflows.tsx`

**Imports/public-root pattern** (lines 1-18):

```typescript
import {
  ChangeLedger,
  LbButton,
  LbTextField,
  RecoveryCheckpoint,
  RestartPlanner,
  RiskClass,
  RouteHeader,
  ScenarioMarker,
  VerificationReceipt,
} from '@liiiraa/design-system';
import { useState } from 'react';

import {
  createNoChangeReceipt,
  createPhaseBoundaryExplanation,
  type NoChangeReceiptResult,
} from '../model/interaction-policy.js';
```

Use design primitives only through `@liiiraa/design-system`; use package-relative imports internally; expose features from `packages/web-features/src/index.ts`, matching the barrel exports in `packages/feature-shell/src/index.ts` lines 69-80.

**Finite workflow pattern** (lines 21-55, 68-93):

```typescript
export const PREVIEW_WORKFLOW_STATES = Object.freeze([
  'review',
  'validating',
  'ready',
  'confirming',
  'previewing',
  'verifying',
  'preview-complete',
  'partial-failure',
  'guided-recovery',
] as const);

const TRANSITIONS: Readonly<
  Record<PreviewWorkflowState, Partial<Record<PreviewWorkflowEvent, PreviewWorkflowState>>>
> = Object.freeze({
  review: Object.freeze({ VALIDATE: 'validating' }),
  validating: Object.freeze({ VALID: 'ready', FAIL: 'partial-failure' }),
  'preview-complete': Object.freeze({}),
  // ...
});

export const advancePreviewWorkflow = (
  state: PreviewWorkflowState,
  event: PreviewWorkflowEvent,
): PreviewWorkflowState => TRANSITIONS[state][event] ?? state;
```

Use XState where parallel states, recovery, or guards justify it. Simple finite flows may retain a typed frozen transition table. Confirm, cancel, retry, stale, offline, partial-failure, and recovery states must be explicit.

**No-change receipt pattern** (lines 95-111):

```typescript
interface PreviewReceiptInput {
  readonly createdAt: string;
  readonly locale: ShellLocale;
  readonly requestedOperations: readonly string[];
  readonly scenarioId: string;
}

export const createPreviewWorkflowReceipt = (
  input: PreviewReceiptInput,
): Readonly<NoChangeReceiptResult> =>
  createNoChangeReceipt({
    correlationId: `${input.scenarioId}-PREVIEW-NO-CHANGE`,
    createdAt: input.createdAt,
    locale: input.locale === 'pt-BR' ? 'pt-BR' : 'en-US',
    requestedOperations: input.requestedOperations,
    scenarioId: input.scenarioId,
  });
```

Every Phase 4-dependent account/admin confirmation should terminate in a receipt with `remoteStateChanged: false` (or the canonical equivalent), name the future authority, preserve the request summary, and never issue a session, payment, device, consent, diagnostic, or admin mutation.

**Accessible failure/receipt rendering** (lines 301-334):

```tsx
<section aria-live="assertive" data-lb-region role="alert">
  <h2>{locale === 'pt-BR' ? 'Falha parcial' : 'Partial failure'}</h2>
  <p>{STATE_COPY[activeState][locale]}</p>
  <code>S15-RECOVERY-SOURCE-UNAVAILABLE</code>
</section>

<VerificationReceipt
  detail={receipt.receipt.summary}
  locale={locale}
  receiptId={receipt.activity.correlationId}
/>
<ChangeLedger
  entries={[
    {
      change: receipt.receipt.summary,
      id: receipt.activity.correlationId,
      result: 'no-change',
      timestamp: '2030-01-15T18:00:00.000Z',
    },
  ]}
  locale={locale}
/>
```

Use semantic alerts, visible codes, redacted correlation IDs, and explicit no-change ledgers. No state may depend only on color, hover, or animation.

---

### Package manifests, strict TypeScript, and public roots

**Analog:** `packages/desktop-simulator/package.json`

**Package shape** (lines 1-22):

```json
{
  "name": "@liiiraa/desktop-simulator",
  "version": "0.0.0",
  "private": true,
  "type": "module",
  "exports": {
    ".": {
      "types": "./src/index.ts",
      "default": "./src/index.ts"
    }
  },
  "scripts": {
    "build": "pnpm check",
    "check": "tsc -p tsconfig.json",
    "test": "vitest"
  },
  "dependencies": {
    "@liiiraa/desktop-client": "workspace:*"
  },
  "devDependencies": {
    "vitest": "4.1.10"
  }
}
```

All new modules need private ESM manifests, one declared public root, terminating `build/check/test` scripts, exact approved external versions, and `workspace:*` internal dependencies. App packages additionally own independent `build/start/check/test` scripts.

**Strict TS inheritance** (`packages/desktop-simulator/tsconfig.json`, lines 1-8):

```json
{
  "extends": "../../tsconfig.base.json",
  "compilerOptions": {
    "lib": ["ES2024", "DOM"]
  },
  "include": ["src/**/*.ts"]
}
```

Expand includes for TSX/config/tests as needed; do not weaken root strictness.

---

### `tooling/web-evidence/src/*.test.ts`

**Analogs:** `tooling/fixture-guard/src/fixture-guard.test.ts`, `packages/desktop-simulator/src/scenarios/catalog.test.ts`, `tooling/architecture-tests/src/check-workspace.test.ts`

**Imports and exact-fixture pattern** (`tooling/fixture-guard/src/fixture-guard.test.ts`, lines 1-10):

```typescript
import ts from 'typescript';
import { describe, expect, it } from 'vitest';

import { createProductionDesktopComposition } from '@liiiraa/desktop-production-reference';

import leakMatrix from '../fixtures/static-runtime-leaks.json' with { type: 'json' };
import { inspectBuiltArtifact } from './artifact-guard.ts';
import { inspectProductionRuntimeBoundary } from './runtime-guard.ts';
import { inspectStaticProductionGraph } from './static-guard.ts';
```

Evidence tests should import canonical JSON as JSON modules, consume package public roots, and keep inspection logic in named utilities rather than embedding opaque shell assertions.

**Positive and negative proof pattern** (lines 75-80, 128-148):

```typescript
it('static guard accepts actual clean workspace graph', async () => {
  await expect(runLiveStaticProductionGuard()).resolves.toEqual({
    ok: true,
    findings: [],
  });
});

expect(result).toMatchObject({
  ok: true,
  findings: [],
  scannedFiles: 1,
});
expect(result.scannedBytes).toBeGreaterThan(0);
```

Each gate needs both a real-workspace/artifact positive case and seeded negative cases. The Phase 3 negative matrix must cover route drift, untranslated/stale content, fixture leakage, preview indexing, header/CSP mismatch, unsafe context, development artifact exposure, release mismatch, and bypass attempts.

**Fail-closed artifact pattern** (lines 152-172):

```typescript
it('artifact requires explicit absolute distribution root', () => {
  expect(() =>
    inspectBuiltArtifact({ distributionRoot: 'fixtures/clean-artifact' }),
  ).toThrow('distributionRoot must be explicit absolute path or file URL');
});

it('artifact refuses source trees as distribution roots', () => {
  const result = inspectBuiltArtifact({
    distributionRoot: new URL('./', import.meta.url),
  });

  expect(result).toMatchObject({
    ok: false,
    scannedFiles: 0,
    findings: [{ code: 'INVALID_DISTRIBUTION_ROOT', path: '.' }],
  });
});
```

The web release gate should inspect only explicit build/distribution roots and reject source trees, development-signed artifacts, missing approved manifests, and any mismatch. There is no “continue anyway” branch.

---

### `tooling/web-evidence/playwright.config.ts`

**Analog:** `apps/desktop/playwright.config.ts`

**Deterministic axis pattern** (lines 3-30):

```typescript
const viewports = Object.freeze([
  Object.freeze({ height: 900, id: '1440x900', width: 1440 }),
  Object.freeze({ height: 800, id: '1280x800', width: 1280 }),
  Object.freeze({ height: 600, id: '760x600', width: 760 }),
]);

const locales = Object.freeze([
  Object.freeze({ browserLocale: 'pt-BR', id: 'pt-BR' }),
  Object.freeze({ browserLocale: 'en-US', id: 'en' }),
]);

const motions = Object.freeze([
  Object.freeze({ id: 'responsive', reducedMotion: 'no-preference' as const }),
  Object.freeze({ id: 'reduced', reducedMotion: 'reduce' as const }),
]);

const contrasts = Object.freeze([
  Object.freeze({ forcedColors: 'none' as const, id: 'normal' }),
  Object.freeze({ forcedColors: 'active' as const, id: 'forced' }),
]);
```

**Named project/snapshot pattern** (lines 32-64, 128-138):

```typescript
const browserProjects: Project[] = viewports.flatMap((viewport) =>
  locales.flatMap((locale) =>
    motions.flatMap((motion) =>
      contrasts.map((contrast) => ({
        name: ['browser', viewport.id, locale.id, motion.id, contrast.id].join('-'),
        testMatch: '**/*.browser.spec.ts',
        use: {
          baseURL: 'http://127.0.0.1:4173',
          locale: locale.browserLocale,
          reducedMotion: motion.reducedMotion,
          forcedColors: contrast.forcedColors,
          viewport: { height: viewport.height, width: viewport.width },
        },
      })),
    ),
  ),
);

export default defineConfig({
  reporter: [['list']],
  retries: 0,
  snapshotPathTemplate:
    '{testDir}/__screenshots__/{testFilePath}/{arg}-{projectName}{ext}',
  timeout: 30_000,
  use: {
    actionTimeout: 5_000,
    colorScheme: 'dark',
    screenshot: 'only-on-failure',
    trace: 'retain-on-failure',
  },
});
```

Phase 3 should define separate public/account/admin projects and three `webServer` entries, with W01-W18, locale, viewport/zoom/text scaling, reduced-motion, forced-colors, and security-origin projections kept deterministic. Avoid an unbounded Cartesian matrix in the quick suite; reserve the full matrix for the phase gate.

---

### `quality/features/WEB-01.json`, `WEB-02.json`, `WEB-03.json`, `WEB-08.json`

**Analog:** `quality/features/ux-01.json`

**Manifest header and evidence pattern** (lines 1-18):

```json
{
  "$schema": "../../architecture/quality-manifest.schema.json",
  "schemaVersion": 1,
  "featureId": "ux-01-installable-desktop-shell",
  "requirements": ["UX-01"],
  "owner": "plan-02-28",
  "acceptance": {
    "security": {
      "status": "tested",
      "evidence": [
        {
          "id": "ux-01-development-signature",
          "command": "pnpm --filter @liiiraa/desktop --grep \"@install-smoke|@native-smoke\"",
          "file": "apps/desktop/tests/packaged/signature.ts",
          "owner": "plan-02-28",
          "status": "planned"
        }
      ]
    }
  }
}
```

Each WEB manifest must name exactly one assigned requirement, contain all five dimensions (security, privacy, accessibility, performance, recovery), use exact non-wildcard evidence paths, use terminating commands, and use the owning plan ID. Start in `planned`; only verified artifacts become `passed`.

## Shared Patterns

### Public Roots and Dependency Direction

**Sources:** `architecture/module-boundaries.json`, `packages/feature-shell/src/index.ts`

Apply to every new package/app:

- Import other modules only from declared public roots.
- Production modules never import fixture modules.
- `web-preview` implements ports declared by `web-core`; `web-core` never knows the preview adapter.
- `web-features` depends on `web-core` and design packages, not on `web-preview`.
- Fixture compositions inject `web-preview`; the production public composition does not.

### Persistent Truth and Provenance

**Sources:** `packages/desktop-simulator/src/scenarios/catalog.test.ts` lines 28-47; `preview-workflows.tsx` lines 95-111 and 319-334

Apply to account/admin preview routes and every simulated commercial/support action:

- Persistent global preview marker plus contextual marker at sensitive actions.
- Deterministic scenario, clock, IDs, locale, and data.
- Final receipt states no remote state changed and names the future authority.
- Cancel paths remain distinct from successful no-change receipts.
- Production/public artifact scans reject fixture markers and development artifacts.

### Validation and Fail-Closed Results

**Sources:** `apps/desktop/src/routes.tsx` lines 171-195; `packages/desktop-simulator/src/scenarios/catalog.test.ts` lines 103-111

Use discriminated results for expected validation/navigation failures and thrown errors only for invalid canonical fixtures or impossible initialization. Unknown route IDs, unsafe return paths, missing translations, stale evidence, unknown scenarios, and artifact disagreements fail closed.

### Localization

The repository analogs use explicit locale unions and test both PT-BR and English. Phase 3 should use `next-intl` catalogs and generated/static locale params per `03-RESEARCH.md`, but retain:

- one canonical message identity per concept;
- exact locale parity tests;
- no hard-coded authoritative English-only failure or receipt copy;
- pseudo-locale only in development/test, not ordinary published selection.

### Accessibility and Responsive Evidence

**Sources:** `apps/desktop/playwright.config.ts` lines 3-30; `preview-workflows.tsx` lines 301-334

Every route family must cover keyboard operation, focus visibility, semantic alerts/statuses, reduced motion, forced colors, 400% zoom/200% text scaling, and responsive disclosure. Dense tables preserve essential columns and expose row detail rather than becoming horizontal-scroll card walls.

### Error Handling

Route errors should render authored 404, 403, 410, and 500 states with locale preservation, safe destinations, redacted correlation IDs, and no automatic redirect that hides failure. Unexpected errors cross the App Router error boundary; expected workflow failures remain typed state-machine states.

## No Analog Found

Planner should use the concrete patterns and citations in `03-RESEARCH.md` for these files:

| File/File Family | Role | Data Flow | Reason |
|---|---|---|---|
| `apps/*/next.config.ts` framework-specific settings | config | batch | No Next.js app exists in the repository. |
| `apps/*/proxy.ts` locale routing and per-surface CSP | middleware | request-response | No Next.js 16 proxy or nonce-CSP implementation exists. Public static CSP and sensitive nonce CSP intentionally differ. |
| `apps/web/src/content/**/*.mdx` | model/content | file-I/O, transform | No MDX pipeline exists. Use repository-only trusted MDX plus validated metadata; do not enable raw untrusted HTML/JS. |
| Static localized metadata/sitemap/robots handlers | route | transform | No Next.js metadata-route analog exists. Derive them from `webRoutes`. |
| Public MiniSearch index build | utility | batch, transform | No search index exists. Admit only canonical public records after locale/version/indexing validation. |

## Planner Copy Matrix

| Planned Area | Copy From | Do Not Copy |
|---|---|---|
| Route authority | `apps/desktop/src/routes.tsx` typed/frozen records and discriminated failures | Parallel route arrays in navigation, sitemap, redirects, and tests |
| Preview scenarios | `packages/desktop-simulator/src/scenarios/catalog.ts` and catalog tests | Public scenario switcher or fixture types in production modules |
| Preview workflows | `packages/feature-shell/src/features/preview-workflows.tsx` | Any final action that implies a real session or mutation |
| Module activation | `architecture/module-boundaries.json` and `check-workspace.test.ts` | Deep imports or production-to-fixture edges |
| Evidence gates | `tooling/fixture-guard/src/fixture-guard.test.ts` | Tests that only inspect source and never built artifacts |
| Browser matrix | `apps/desktop/playwright.config.ts` | Unbounded quick-suite Cartesian product |
| Requirement manifests | `quality/features/ux-01.json` | Wildcard paths, watch commands, missing acceptance dimensions |

## Metadata

**Analog search scope:** `apps/desktop`, `packages/desktop-*`, `packages/feature-shell`, `packages/design-system`, `tooling/architecture-tests`, `tooling/fixture-guard`, `tooling/acceptance-policy`, `quality/features`, `architecture`

**Primary analogs:** 5 pattern families

1. Typed desktop route authority
2. Closed deterministic desktop simulator
3. Preview workflow and no-change receipt UI
4. Module boundary and workspace activation policy
5. Fixture/artifact/evidence and Playwright gates

**Pattern extraction date:** 2026-07-30
