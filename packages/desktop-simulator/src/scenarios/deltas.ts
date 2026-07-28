import type { DesktopScenario, DesktopScenarioId, ScenarioFamilyId } from '@liiiraa/desktop-client';

import manifest from '../../../../contracts/scenarios/desktop-scenarios.json' with { type: 'json' };
import { getScenarioFamily } from './families.js';

export interface ScenarioDelta {
  readonly scenarioId: DesktopScenarioId;
  readonly familyId: ScenarioFamilyId;
  readonly paths: readonly string[];
}

const freezeDelta = (delta: ScenarioDelta): ScenarioDelta =>
  Object.freeze({
    ...delta,
    paths: Object.freeze([...delta.paths]),
  });

export const SCENARIO_DELTAS: readonly ScenarioDelta[] = Object.freeze(
  manifest.scenarios.map((scenario) =>
    freezeDelta({
      scenarioId: scenario.id as DesktopScenarioId,
      familyId: scenario.familyId as ScenarioFamilyId,
      paths: scenario.deltaPaths,
    }),
  ),
);

const DELTA_ROOTS = Object.freeze([
  'activity',
  'calibration',
  'entitlement',
  'evidence',
  'game',
  'hardware',
  'latencyMs',
  'locale',
  'profile',
  'recommendations',
  'requiredRoutes',
] as const);

const isKnownDeltaPath = (path: string): boolean =>
  DELTA_ROOTS.some((root) => path === root || path.startsWith(`${root}.`));

const isCoveredByDeclaredPath = (changedPath: string, declaredPaths: readonly string[]): boolean =>
  declaredPaths.some(
    (declaredPath) =>
      changedPath === declaredPath ||
      changedPath.startsWith(`${declaredPath}.`) ||
      declaredPath.startsWith(`${changedPath}.`),
  );

const collectChangedLeafPaths = (
  baseline: unknown,
  candidate: unknown,
  path: string,
): readonly string[] => {
  if (
    typeof baseline !== 'object' ||
    baseline === null ||
    typeof candidate !== 'object' ||
    candidate === null
  ) {
    return Object.is(baseline, candidate) ? [] : [path];
  }

  const baselineRecord = baseline as Record<string, unknown>;
  const candidateRecord = candidate as Record<string, unknown>;
  const keys = new Set([...Object.keys(baselineRecord), ...Object.keys(candidateRecord)]);
  return [...keys].flatMap((key) =>
    collectChangedLeafPaths(
      baselineRecord[key],
      candidateRecord[key],
      path.length === 0 ? key : `${path}.${key}`,
    ),
  );
};

export const assertScenarioFamilyDelta = (scenario: DesktopScenario): void => {
  const family = getScenarioFamily(scenario.familyId);
  if (family === undefined) {
    throw new Error(`Unknown scenario family: ${scenario.familyId}`);
  }
  if (
    scenario.deltaPaths.length === 0 ||
    new Set(scenario.deltaPaths).size !== scenario.deltaPaths.length ||
    scenario.deltaPaths.some((path) => !isKnownDeltaPath(path))
  ) {
    throw new Error(`Invalid scenario delta declaration: ${scenario.id}`);
  }

  const changedPaths = collectChangedLeafPaths(
    family.baseline,
    {
      hardware: scenario.hardware,
      game: scenario.game,
      profile: scenario.profile,
    },
    '',
  );
  const undeclaredPaths = changedPaths.filter(
    (changedPath) => !isCoveredByDeclaredPath(changedPath, scenario.deltaPaths),
  );
  if (undeclaredPaths.length > 0) {
    throw new Error(`Undeclared family mutation in ${scenario.id}: ${undeclaredPaths.join(', ')}`);
  }
};
