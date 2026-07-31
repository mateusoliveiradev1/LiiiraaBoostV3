import { readFileSync } from 'node:fs';

import { expect, test } from '@playwright/test';

type Scenario = Readonly<{ clock: string; id: string; routeId: string }>;

const scenarioManifest = JSON.parse(
  readFileSync(new URL('../../../contracts/scenarios/web-scenarios.json', import.meta.url), 'utf8'),
) as Readonly<{ scenarios: readonly Scenario[] }>;

const scenarioSurface = (routeId: string): 'public' | 'account' | 'admin' =>
  routeId.startsWith('account-') ? 'account' : routeId.startsWith('admin-') ? 'admin' : 'public';

for (const scenario of scenarioManifest.scenarios) {
  const surface = scenarioSurface(scenario.routeId);
  test(`@final @${surface} ${scenario.id} is reachable from the canonical matrix`, async ({
    browserName,
  }, testInfo) => {
    expect(browserName).toBe('chromium');
    expect(String(testInfo.project.metadata['frozenClock'])).toBe(scenario.clock);
    expect(String(testInfo.project.metadata['scenarioIds']).split(',')).toContain(scenario.id);
  });
}

for (const scenarioId of ['W01', 'W10', 'W14'] as const) {
  const scenario = scenarioManifest.scenarios.find(({ id }) => id === scenarioId);
  if (scenario === undefined) {
    throw new Error(`Canonical quick scenario missing: ${scenarioId}`);
  }
  const surface = scenarioSurface(scenario.routeId);
  test(`@quick @${surface} ${scenario.id} bounds the pre-commit project`, async ({
    browserName,
  }, testInfo) => {
    expect(browserName).toBe('chromium');
    expect(String(testInfo.project.metadata['scenarioIds']).split(',')).toContain(scenario.id);
  });
}
