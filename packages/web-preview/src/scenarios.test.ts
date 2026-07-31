import { describe, expect, it } from 'vitest';

import manifest from '../../../contracts/scenarios/web-scenarios.json' with {
  type: 'json',
};

import {
  WEB_SCENARIOS,
  WEB_SCENARIO_IDS,
  getWebScenario,
  parseWebScenarioManifest,
  publishedPreviewScenarioId,
  resolveWebPreviewScenario,
  type WebScenario,
} from './scenarios.js';

const EXPECTED_IDS = Object.freeze(
  Array.from(
    { length: 18 },
    (_, index) => `W${String(index + 1).padStart(2, '0')}`,
  ),
);

const clone = <Value>(value: Value): Value =>
  JSON.parse(JSON.stringify(value)) as Value;

const isDeeplyFrozen = (
  value: unknown,
  visited = new Set<object>(),
): boolean => {
  if (typeof value !== 'object' || value === null || visited.has(value)) {
    return true;
  }

  visited.add(value);
  return (
    Object.isFrozen(value) &&
    Object.values(value).every((nested) => isDeeplyFrozen(nested, visited))
  );
};

const assertCompleteScenario = (scenario: WebScenario): void => {
  expect(scenario.clock).toMatch(/Z$/u);
  expect(['pt-BR', 'en']).toContain(scenario.locale);
  expect(scenario.routeId.length).toBeGreaterThan(0);
  expect(scenario.requiredRouteIds).toContain(scenario.routeId);
  expect(scenario.latencyMs).toBeGreaterThanOrEqual(0);
  expect(scenario.provenance).toMatchObject({
    kind: 'fixture',
    value: 'SIMULATED SCENARIO',
    scenarioId: scenario.id,
  });
  expect(scenario.version.length).toBeGreaterThan(0);
  expect(scenario.channel.length).toBeGreaterThan(0);
  expect(scenario.role.length).toBeGreaterThan(0);
  expect(scenario.consent.length).toBeGreaterThan(0);
  expect(scenario.viewport).toMatch(/^\d+x\d+$/u);
  expect(scenario.terminalState.length).toBeGreaterThan(0);
  expect(scenario.requiredProof.length).toBeGreaterThan(0);
  expect(scenario.deltaPaths.length).toBeGreaterThan(0);
};

describe('W01-W18 catalog', () => {
  it('publishes exactly eighteen ordered, complete, deeply frozen fixtures', () => {
    expect(manifest.schemaVersion).toBe(1);
    expect(WEB_SCENARIO_IDS).toEqual(EXPECTED_IDS);
    expect(WEB_SCENARIOS.map(({ id }) => id)).toEqual(EXPECTED_IDS);
    expect(new Set(WEB_SCENARIO_IDS)).toHaveLength(18);
    expect(isDeeplyFrozen(WEB_SCENARIOS)).toBe(true);

    WEB_SCENARIOS.forEach(assertCompleteScenario);
  });

  it('covers both shipping locales and every locked scenario family', () => {
    expect(new Set(WEB_SCENARIOS.map(({ locale }) => locale))).toEqual(
      new Set(['pt-BR', 'en']),
    );
    expect(new Set(WEB_SCENARIOS.map(({ family }) => family))).toEqual(
      new Set(['public', 'documentation', 'account', 'admin', 'accessibility']),
    );

    const errorScenario = getWebScenario('W17');
    expect(errorScenario.requiredRouteIds).toEqual([
      'public-error-404',
      'public-error-403',
      'public-error-410',
      'public-error-500',
      'account-error-404',
      'account-error-403',
      'account-error-410',
      'account-error-500',
      'admin-error-404',
      'admin-error-403',
      'admin-error-410',
      'admin-error-500',
    ]);
  });

  it('keeps stable serialization and rejects unknown identities', () => {
    expect(() => getWebScenario('W19')).toThrow('Unknown web scenario: W19');

    const first = JSON.stringify(
      parseWebScenarioManifest(clone(manifest)),
    );
    const second = JSON.stringify(
      parseWebScenarioManifest(clone(manifest)),
    );
    expect(first).toBe(second);
    expect(first).toBe(JSON.stringify(WEB_SCENARIOS));
  });

  it.each([
    ['duplicate', (candidate: typeof manifest) => {
      const first = candidate.scenarios[0];
      const second = candidate.scenarios[1];
      if (first !== undefined && second !== undefined) {
        second.id = first.id;
      }
    }],
    ['missing', (candidate: typeof manifest) => {
      candidate.scenarios.pop();
    }],
    ['unknown', (candidate: typeof manifest) => {
      const first = candidate.scenarios[0];
      if (first !== undefined) {
        first.id = 'W99';
      }
    }],
    ['undeclared', (candidate: typeof manifest) => {
      const first = candidate.scenarios[0] as
        | (typeof candidate.scenarios)[number] & { customerId?: string }
        | undefined;
      if (first !== undefined) {
        first.customerId = 'customer-like-value';
      }
    }],
  ])('rejects %s catalog mutations', (_, mutate) => {
    const candidate = clone(manifest);
    mutate(candidate);
    expect(() => parseWebScenarioManifest(candidate)).toThrow(
      'Invalid web scenario manifest',
    );
  });

  it('rejects undeclared family deltas and non-fixture provenance', () => {
    const unknownDelta = clone(manifest);
    const firstUnknown = unknownDelta.scenarios[0];
    if (firstUnknown !== undefined) {
      firstUnknown.deltaPaths.push('customer.session');
    }

    const changedProvenance = clone(manifest);
    const firstChanged = changedProvenance.scenarios[0];
    if (firstChanged !== undefined) {
      firstChanged.provenance.kind = 'observed';
    }

    expect(() => parseWebScenarioManifest(unknownDelta)).toThrow(
      'Invalid web scenario manifest',
    );
    expect(() => parseWebScenarioManifest(changedProvenance)).toThrow(
      'Invalid web scenario manifest',
    );
  });

  it('fixes the published composition at build time and permits test selection only', () => {
    expect(publishedPreviewScenarioId).toBe('W01');
    expect(resolveWebPreviewScenario({ kind: 'published' }).id).toBe('W01');
    expect(
      resolveWebPreviewScenario({ kind: 'test', scenarioId: 'W18' }).id,
    ).toBe('W18');

    expect(() =>
      resolveWebPreviewScenario({
        kind: 'published',
        scenarioId: 'W02',
      } as never),
    ).toThrow('Published preview scenario cannot be overridden');
  });
});
