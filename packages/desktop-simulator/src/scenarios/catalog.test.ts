import { describe, expect, it } from 'vitest';

import manifest from '../../../../contracts/scenarios/desktop-scenarios.json' with { type: 'json' };
import {
  DESKTOP_SCENARIOS,
  getDesktopScenario,
  parseDesktopScenarioManifest,
  type DesktopScenario,
} from './catalog.js';

const EXPECTED_IDS = Object.freeze(
  Array.from({ length: 24 }, (_, index) => `S${String(index + 1).padStart(2, '0')}`),
);

const isDeeplyFrozen = (value: unknown, visited = new Set<object>()): boolean => {
  if (typeof value !== 'object' || value === null || visited.has(value)) {
    return true;
  }
  visited.add(value);
  return (
    Object.isFrozen(value) &&
    Object.values(value).every((nested) => isDeeplyFrozen(nested, visited))
  );
};

const assertCompleteScenario = (scenario: DesktopScenario): void => {
  expect(scenario.seed).toBeTypeOf('number');
  expect(scenario.clock).toMatch(/Z$/);
  expect(['en-US', 'pt-BR']).toContain(scenario.locale);
  expect(scenario.familyId.length).toBeGreaterThan(0);
  expect(scenario.deltaPaths.length).toBeGreaterThan(0);
  expect(scenario.adapterIdentity.kind).toBe('fixture');
  expect(scenario.adapterIdentity.scenarioMarker).toBe('SIMULATED SCENARIO');
  expect(scenario.hardware.id.length).toBeGreaterThan(0);
  expect(scenario.game.id.length).toBeGreaterThan(0);
  expect(scenario.profile.id.length).toBeGreaterThan(0);
  expect(scenario.latencyMs).toBeGreaterThanOrEqual(0);
  expect(scenario.requiredRoutes.length).toBeGreaterThan(0);
  expect(scenario.requiredStates.length).toBeGreaterThan(0);
  expect(
    scenario.requiredStates.every(({ route }) => scenario.requiredRoutes.includes(route)),
  ).toBe(true);
  expect(scenario.noEffect.changed).toBe(false);
  expect(scenario.noEffect.receiptKind).toBe('scenario-preview');
  expect(scenario.noEffect.scenarioId).toBe(scenario.id);
  expect(isDeeplyFrozen(scenario)).toBe(true);
};

describe('S01-S24 deterministic scenario catalog and operational state coverage', () => {
  it('projects exactly 24 stable manifest identities into complete frozen scenarios', () => {
    expect(manifest.schemaVersion).toBe(1);
    expect(manifest.scenarios.map(({ id }) => id)).toEqual(EXPECTED_IDS);
    expect(DESKTOP_SCENARIOS.map(({ id }) => id)).toEqual(EXPECTED_IDS);
    expect(new Set(DESKTOP_SCENARIOS.map(({ id }) => id))).toHaveLength(24);

    DESKTOP_SCENARIOS.forEach(assertCompleteScenario);
  });

  it('anchors S01 in the approved golden journey and no-effect boundary', () => {
    const scenario = getDesktopScenario('S01');

    expect(scenario.hardware).toMatchObject({
      platform: 'windows-11',
      cpuVendor: 'Intel',
      gpuVendor: 'NVIDIA',
      tier: 'mid-range',
    });
    expect(scenario.game).toMatchObject({
      kind: 'fictional-anchor',
      integrationQualification: 'deterministic-fixture',
    });
    expect(scenario.evidence.completeness).toBe('partial');
    expect(scenario.recommendations).toEqual([
      expect.objectContaining({ risk: 'verified', eligibility: 'ready' }),
      expect.objectContaining({ risk: 'advanced', eligibility: 'review-required' }),
      expect.objectContaining({
        risk: 'advanced',
        eligibility: 'excluded',
        evidenceQuality: 'insufficient',
      }),
    ]);
    expect(scenario.noEffect).toMatchObject({
      changed: false,
      receiptKind: 'scenario-preview',
    });
  });

  it('allows real games only in explicitly unqualified discovery scenarios', () => {
    const realGames = DESKTOP_SCENARIOS.filter(({ game }) => game.kind === 'real-discovery');

    expect(realGames.length).toBeGreaterThan(0);
    expect(
      realGames.every(
        ({ game }) =>
          game.integrationQualification === 'discovery-only-unqualified' &&
          game.integrationValidated === false,
      ),
    ).toBe(true);
  });

  it('fails closed for unknown scenario identities and keeps serialized evidence stable', () => {
    expect(() => getDesktopScenario('S25')).toThrowError('Unknown desktop scenario: S25');
    expect(JSON.stringify(DESKTOP_SCENARIOS)).toBe(JSON.stringify(DESKTOP_SCENARIOS));
  });

  it.each([
    ['operational state', 'requiredStates', 'invented-loading-flag'],
    ['route', 'requiredRoutes', '/invented-route'],
    ['provenance', 'adapterIdentity', 'observed'],
  ] as const)('rejects unknown %s values before projection', (_, target, unknownValue) => {
    const candidate = structuredClone(manifest) as unknown as {
      scenarios: Array<{
        adapterIdentity: { kind: string };
        requiredRoutes: string[];
        requiredStates: Array<{ state: string }>;
      }>;
    };
    const first = candidate.scenarios[0];
    expect(first).toBeDefined();
    if (first === undefined) {
      return;
    }

    if (target === 'requiredStates') {
      const firstRequirement = first.requiredStates[0];
      expect(firstRequirement).toBeDefined();
      if (firstRequirement !== undefined) {
        firstRequirement.state = unknownValue;
      }
    } else if (target === 'requiredRoutes') {
      first.requiredRoutes[0] = unknownValue;
    } else {
      first.adapterIdentity.kind = unknownValue;
    }

    expect(() => parseDesktopScenarioManifest(candidate)).toThrowError(
      'Invalid desktop scenario manifest',
    );
  });
});
