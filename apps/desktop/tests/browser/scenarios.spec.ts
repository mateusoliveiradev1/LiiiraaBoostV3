import { expect, test } from '@playwright/test';

import scenarioCatalogJson from '../../../../contracts/scenarios/desktop-scenarios.json' with { type: 'json' };
import storyManifestJson from '../../../../tooling/desktop-evidence/story-manifest.json' with { type: 'json' };
import type { ShellOperationalState } from '../../src/app.tsx';
import { DESKTOP_APP_URL, DESKTOP_SCENARIO_MARKER, openDesktopTestCase } from './fixtures.ts';

interface CatalogScenario {
  readonly activity: string;
  readonly adapterIdentity: Readonly<{
    kind: string;
    scenarioMarker: string;
  }>;
  readonly calibration: string;
  readonly clock: string;
  readonly deltaPaths: readonly string[];
  readonly entitlement: string;
  readonly evidence: Readonly<{
    completeness: string;
    freshness: string;
    quality: string;
    unavailableSources: readonly string[];
  }>;
  readonly familyId: string;
  readonly game: Readonly<{
    integrationValidated: boolean;
    kind: string;
  }>;
  readonly hardware: Readonly<{
    cpuVendor: string;
    gpuVendor: string;
    platform: string;
    tier: string;
  }>;
  readonly id: string;
  readonly locale: 'en-US' | 'pt-BR';
  readonly latencyMs: number;
  readonly noEffect: Readonly<{
    changed: boolean;
    receiptKind: string;
    summary: string;
  }>;
  readonly recommendations: readonly Readonly<{
    eligibility: string;
    evidenceQuality: string;
    risk: string;
  }>[];
  readonly requiredRoutes: readonly string[];
  readonly requiredStates: readonly Readonly<{
    route: string;
    state: string;
  }>[];
  readonly seed: number;
}

interface ScenarioCatalog {
  readonly fixtureVersion: string;
  readonly scenarios: CatalogScenario[];
}

interface StoryManifest {
  readonly canonicalCatalog: Readonly<{
    path: string;
    requiredRoutesField: string;
    requiredStatesField: string;
    scenarioIdField: string;
  }>;
  readonly coverage: Readonly<{
    scenarioRange: Readonly<{
      first: number;
      last: number;
      pad: number;
      prefix: string;
    }>;
    strategy: string;
  }>;
}

const catalog = scenarioCatalogJson as unknown as ScenarioCatalog;
const manifest = storyManifestJson as unknown as StoryManifest;

const OPERATIONAL_STATES = new Set<ShellOperationalState>([
  'loading',
  'empty',
  'offline',
  'permission',
  'unsupported',
  'partial-failure',
  'restart-pending',
  'recovery',
  'expired-entitlement',
  'stale-evidence',
  'contradictory-evidence',
  'fixture',
]);

const CANONICAL_ROUTE_PATHS: Readonly<Partial<Record<string, string>>> = Object.freeze({
  '/activity': '/activity',
  '/ai': '/assistant',
  '/calibration': '/calibration/welcome',
  '/games': '/games',
  '/games/detail': '/games/vector-strike-arena/overview',
  '/home': '/home',
  '/improve/component': '/components/cpu-power',
  '/measure': '/measure/overview',
  '/measure/comparison': '/measure/compare',
  '/plans/review': '/plans/scenario-plan/review',
  '/recover': '/recover/overview',
  '/restart': '/plans/scenario-plan/restart',
  '/session/active': '/session/scenario-session/active',
  '/settings/appearance': '/settings/appearance',
  '/startup': '/documentation/local-startup',
  '/support': '/documentation/support-boundary',
  '/updates': '/settings/updates',
});

const expectedScenarioIds = (): readonly string[] => {
  const { first, last, pad, prefix } = manifest.coverage.scenarioRange;
  return Array.from({ length: last - first + 1 }, (_value, index) => {
    return `${prefix}${String(first + index).padStart(pad, '0')}`;
  });
};

const parityDiagnostics = (candidate: ScenarioCatalog): readonly string[] => {
  const diagnostics: string[] = [];
  const expectedIds = expectedScenarioIds();
  const expectedIdSet = new Set(expectedIds);
  const canonicalById = new Map(catalog.scenarios.map((scenario) => [scenario.id, scenario]));
  const seenIds = new Set<string>();

  for (const scenario of candidate.scenarios) {
    if (seenIds.has(scenario.id)) {
      diagnostics.push(`scenario parity: duplicate scenario ${scenario.id}`);
      continue;
    }
    seenIds.add(scenario.id);

    if (!expectedIdSet.has(scenario.id)) {
      diagnostics.push(`scenario parity: extra scenario ${scenario.id}`);
    }

    const canonical = canonicalById.get(scenario.id);
    const canonicalRoutes = new Set(canonical?.requiredRoutes ?? []);
    const canonicalPairs = new Set(
      canonical?.requiredStates.map(({ route, state }) => `${route}::${state}`) ?? [],
    );
    const declaredRoutes = new Set<string>();
    const stateRoutes = new Set<string>();
    const pairKeys = new Set<string>();

    for (const route of scenario.requiredRoutes) {
      if (declaredRoutes.has(route)) {
        diagnostics.push(`scenario parity: duplicate route ${route} in ${scenario.id}`);
      }
      declaredRoutes.add(route);
      if (!canonicalRoutes.has(route)) {
        diagnostics.push(`scenario parity: unknown route ${route} in ${scenario.id}`);
      }
    }

    for (const { route, state } of scenario.requiredStates) {
      const pairKey = `${route}::${state}`;
      if (pairKeys.has(pairKey)) {
        diagnostics.push(`scenario parity: duplicate route/state ${pairKey} in ${scenario.id}`);
      }
      pairKeys.add(pairKey);
      stateRoutes.add(route);
      if (!canonicalPairs.has(pairKey)) {
        diagnostics.push(`scenario parity: unknown route/state ${pairKey} in ${scenario.id}`);
      }
      if (!OPERATIONAL_STATES.has(state)) {
        diagnostics.push(`scenario parity: unsupported state ${state} in ${scenario.id}`);
      }
      if (CANONICAL_ROUTE_PATHS[route] === undefined) {
        diagnostics.push(`scenario parity: unmapped browser route ${route} in ${scenario.id}`);
      }
    }

    for (const route of declaredRoutes) {
      if (!stateRoutes.has(route)) {
        diagnostics.push(`scenario parity: route ${route} has no state in ${scenario.id}`);
      }
    }
    for (const route of stateRoutes) {
      if (!declaredRoutes.has(route)) {
        diagnostics.push(`scenario parity: undeclared state route ${route} in ${scenario.id}`);
      }
    }
  }

  for (const scenarioId of expectedIds) {
    if (!seenIds.has(scenarioId)) {
      diagnostics.push(`scenario parity: missing scenario ${scenarioId}`);
    }
  }

  return diagnostics.toSorted();
};

const cloneCatalog = (): ScenarioCatalog => JSON.parse(JSON.stringify(catalog)) as ScenarioCatalog;

const scenario = (id: string): CatalogScenario => {
  const value = catalog.scenarios.find((candidate) => candidate.id === id);
  if (value === undefined) {
    throw new Error(`Missing canonical scenario ${id}.`);
  }
  return value;
};

test('@route-scenario-smoke reports stable missing, extra, and duplicate parity diagnostics', () => {
  expect(manifest.coverage.strategy).toBe('derive-required-states');
  expect(manifest.canonicalCatalog.path).toBe('../../contracts/scenarios/desktop-scenarios.json');
  expect(parityDiagnostics(catalog)).toEqual([]);

  const missing = cloneCatalog();
  missing.scenarios.shift();
  expect(parityDiagnostics(missing)).toContain('scenario parity: missing scenario S01');

  const extra = cloneCatalog();
  const lastScenario = extra.scenarios.at(-1);
  if (lastScenario === undefined) {
    throw new Error('Canonical scenario catalog cannot be empty.');
  }
  extra.scenarios.push({
    ...lastScenario,
    id: 'S25',
  });
  expect(parityDiagnostics(extra)).toContain('scenario parity: extra scenario S25');

  const duplicate = cloneCatalog();
  duplicate.scenarios.push(scenario('S01'));
  expect(parityDiagnostics(duplicate)).toContain('scenario parity: duplicate scenario S01');
});

test('@route-scenario-smoke executes every canonical S01-S24 route/state pair in Chromium', async ({
  browser,
}) => {
  test.setTimeout(120_000);

  const context = await browser.newContext({
    baseURL: DESKTOP_APP_URL,
    locale: 'en-US',
    viewport: { height: 900, width: 1440 },
  });
  const executedPairs: string[] = [];

  try {
    for (const catalogScenario of catalog.scenarios) {
      for (const requirement of catalogScenario.requiredStates) {
        const initialPath = CANONICAL_ROUTE_PATHS[requirement.route];
        if (
          initialPath === undefined ||
          !OPERATIONAL_STATES.has(requirement.state as ShellOperationalState)
        ) {
          throw new Error(
            `Unmapped canonical browser case ${catalogScenario.id}::${requirement.route}::${requirement.state}`,
          );
        }

        const page = await context.newPage();
        try {
          await openDesktopTestCase(
            page,
            {
              initialPath,
              operationalState: requirement.state as ShellOperationalState,
              scenarioId: catalogScenario.id,
              windowsLocale: catalogScenario.locale,
            },
            {
              clock: catalogScenario.clock,
              id: catalogScenario.id,
              latencyMs: catalogScenario.latencyMs,
              marker: DESKTOP_SCENARIO_MARKER,
              seed: catalogScenario.seed,
            },
          );

          const shell = page.locator('.desktop-app-shell');
          await expect(shell).toHaveAttribute('data-route-path', initialPath);
          await expect(shell).toHaveAttribute('data-operational-state', requirement.state);
          await expect(page.locator('main')).toHaveCount(1);
          await expect(page.locator('h1')).toHaveCount(1);
          await expect(page.locator('body')).toContainText(
            new RegExp(`DEMO.*${catalogScenario.id}`, 'iu'),
          );

          const frozenRuntime = await page.evaluate(() => {
            const testState = Reflect.get(globalThis, '__LIIIRAA_DESKTOP_TEST__') as {
              scenario?: {
                clock?: string;
                id?: string;
                latencyMs?: number;
                marker?: string;
                seed?: number;
              };
            };
            return {
              now: new Date().toISOString(),
              scenario: testState.scenario,
            };
          });
          expect(frozenRuntime).toEqual({
            now: catalogScenario.clock,
            scenario: {
              clock: catalogScenario.clock,
              id: catalogScenario.id,
              latencyMs: catalogScenario.latencyMs,
              marker: DESKTOP_SCENARIO_MARKER,
              seed: catalogScenario.seed,
            },
          });

          executedPairs.push(`${catalogScenario.id}::${requirement.route}::${requirement.state}`);
        } finally {
          await page.close();
        }
      }
    }
  } finally {
    await context.close();
  }

  const expectedPairs = catalog.scenarios.flatMap((catalogScenario) =>
    catalogScenario.requiredStates.map(
      ({ route, state }) => `${catalogScenario.id}::${route}::${state}`,
    ),
  );
  expect(executedPairs).toEqual(expectedPairs);
  expect(executedPairs).toHaveLength(59);
});

test('@route-scenario-smoke executes explicit D-01 through D-20 decision assertions', () => {
  const s01 = scenario('S01');
  const s03 = scenario('S03');
  const s06 = scenario('S06');
  const s07 = scenario('S07');
  const s14 = scenario('S14');
  const s15 = scenario('S15');
  const s19 = scenario('S19');
  const s20 = scenario('S20');
  const s21 = scenario('S21');
  const s22 = scenario('S22');
  const s23 = scenario('S23');
  const s24 = scenario('S24');

  const decisions: Readonly<Record<`D-${string}`, boolean>> = Object.freeze({
    'D-01': s01.calibration === 'complete' && s01.evidence.completeness === 'partial',
    'D-02':
      s06.requiredStates.some(
        ({ route, state }) => route === '/plans/review' && state === 'contradictory-evidence',
      ) && s06.calibration === 'paused',
    'D-03':
      s22.calibration === 'cancelled' && s22.requiredStates.some(({ route }) => route === '/home'),
    'D-04':
      s01.evidence.quality === 'verified' &&
      s06.evidence.unavailableSources.includes('gpu-driver-source'),
    'D-05':
      s14.requiredStates.some(
        ({ route, state }) => route === '/calibration' && state === 'permission',
      ) && s14.recommendations.length === 0,
    'D-06':
      s19.evidence.unavailableSources.includes('cloud-ai') &&
      s19.noEffect.summary.includes('consent stayed disabled'),
    'D-07':
      s06.requiredStates.some(({ state }) => state === 'stale-evidence') &&
      s06.deltaPaths.includes('evidence'),
    'D-08':
      s07.calibration === 'deferred' && s07.requiredStates.some(({ state }) => state === 'empty'),
    'D-09':
      s01.hardware.platform === 'windows-11' &&
      s01.hardware.cpuVendor === 'Intel' &&
      s01.hardware.gpuVendor === 'NVIDIA' &&
      s01.hardware.tier === 'mid-range',
    'D-10':
      s01.game.kind === 'fictional-anchor' &&
      !s01.game.integrationValidated &&
      catalog.scenarios.some(({ game }) => game.kind !== 'fictional-anchor'),
    'D-11':
      s01.recommendations.some(
        ({ eligibility, risk }) => eligibility === 'ready' && risk === 'verified',
      ) &&
      s01.recommendations.some(
        ({ eligibility, risk }) => eligibility === 'review-required' && risk === 'advanced',
      ) &&
      s01.recommendations.some(
        ({ eligibility, evidenceQuality }) =>
          eligibility === 'excluded' && evidenceQuality === 'insufficient',
      ) &&
      !s01.noEffect.changed,
    'D-12':
      new Set(catalog.scenarios.map(({ familyId }) => familyId)).size === 3 &&
      catalog.scenarios.every(({ deltaPaths }) => deltaPaths.length <= 3),
    'D-13':
      s15.requiredStates.some(({ state }) => state === 'partial-failure') &&
      s15.requiredStates.some(({ state }) => state === 'recovery') &&
      !s15.noEffect.changed,
    'D-14':
      ['/ai', '/support', '/updates'].every((route) =>
        catalog.scenarios.some(({ requiredRoutes }) => requiredRoutes.includes(route)),
      ) && [s19, s20, s21].every(({ noEffect }) => !noEffect.changed),
    'D-15': catalog.scenarios.every(
      ({ noEffect }) => noEffect.receiptKind === 'scenario-preview' && !noEffect.changed,
    ),
    'D-16':
      s20.noEffect.summary.includes('no bundle was uploaded') &&
      s21.noEffect.summary.includes('current version remains active'),
    'D-17': s23.locale === 'pt-BR' && s01.locale === 'en-US',
    'D-18':
      s03.requiredRoutes.includes('/settings/appearance') &&
      s23.requiredRoutes.includes('/settings/appearance'),
    'D-19':
      catalog.scenarios.every(({ noEffect }) => !noEffect.changed) &&
      s24.requiredRoutes.includes('/settings/appearance'),
    'D-20':
      catalog.scenarios[0]?.id === 'S01' &&
      expectedScenarioIds().at(-1) === 'S24' &&
      expectedScenarioIds().length === 24,
  });

  expect(Object.keys(decisions)).toEqual(
    Array.from({ length: 20 }, (_value, index) => `D-${String(index + 1).padStart(2, '0')}`),
  );
  expect(
    Object.entries(decisions)
      .filter(([, executed]) => !executed)
      .map(([decision]) => decision),
  ).toEqual([]);
});
