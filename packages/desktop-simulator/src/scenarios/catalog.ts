import {
  ACTIVITY_STATES,
  CALIBRATION_PROGRESS_STATES,
  ENTITLEMENT_STATES,
  EVIDENCE_FRESHNESS_STATES,
  EVIDENCE_QUALITY_STATES,
  isDesktopRoute,
  isOperationalState,
  type ActivityState,
  type CalibrationProgress,
  type DesktopRoute,
  type DesktopScenario,
  type DesktopScenarioId,
  type EntitlementState,
  type EvidenceFreshness,
  type EvidenceQuality,
  type GameFixture,
  type HardwareFixture,
  type ProfileFixture,
  type RecommendationState,
  type RouteRequirement,
  type ScenarioAdapterIdentity,
  type ScenarioFamilyId,
} from '@liiiraa/desktop-client';

import manifest from '../../../../contracts/scenarios/desktop-scenarios.json' with { type: 'json' };
import { isScenarioFamilyId } from './families.js';

export type { DesktopScenario } from '@liiiraa/desktop-client';

type UnknownRecord = Record<string, unknown>;

const isRecord = (value: unknown): value is UnknownRecord =>
  typeof value === 'object' && value !== null && !Array.isArray(value);

const fail = (path: string, expected: string): never => {
  throw new Error(`Invalid desktop scenario manifest at ${path}: expected ${expected}`);
};

const requireRecord = (value: unknown, path: string): UnknownRecord => {
  if (!isRecord(value)) {
    return fail(path, 'object');
  }
  return value;
};

const requireString = (value: unknown, path: string): string => {
  if (typeof value !== 'string' || value.length === 0) {
    return fail(path, 'non-empty string');
  }
  return value;
};

const requireNumber = (value: unknown, path: string): number => {
  if (typeof value !== 'number' || !Number.isFinite(value)) {
    return fail(path, 'finite number');
  }
  return value;
};

const requireInteger = (value: unknown, path: string): number => {
  const parsed = requireNumber(value, path);
  if (!Number.isInteger(parsed)) {
    return fail(path, 'integer');
  }
  return parsed;
};

const requireArray = (value: unknown, path: string): readonly unknown[] => {
  if (!Array.isArray(value)) {
    return fail(path, 'array');
  }
  return value;
};

const requireLiteral = <const Values extends readonly string[]>(
  value: unknown,
  values: Values,
  path: string,
): Values[number] => {
  if (typeof value !== 'string' || !(values as readonly string[]).includes(value)) {
    return fail(path, values.join(' | '));
  }
  return value as Values[number];
};

const requireFalse = (value: unknown, path: string): false => {
  if (value !== false) {
    return fail(path, 'false');
  }
  return value;
};

const deepFreeze = <Value>(value: Value, seen = new Set<object>()): Readonly<Value> => {
  if (typeof value !== 'object' || value === null || seen.has(value)) {
    return value;
  }
  seen.add(value);
  for (const nested of Object.values(value)) {
    deepFreeze(nested, seen);
  }
  return Object.freeze(value);
};

const parseAdapterIdentity = (value: unknown, path: string): ScenarioAdapterIdentity => {
  const record = requireRecord(value, path);
  if (record['kind'] !== 'fixture') {
    return fail(`${path}.kind`, 'fixture');
  }
  if (record['scenarioMarker'] !== 'SIMULATED SCENARIO') {
    return fail(`${path}.scenarioMarker`, 'SIMULATED SCENARIO');
  }
  return {
    kind: 'fixture',
    adapterId: requireString(record['adapterId'], `${path}.adapterId`),
    adapterVersion: requireString(record['adapterVersion'], `${path}.adapterVersion`),
    scenarioMarker: 'SIMULATED SCENARIO',
  };
};

const parseHardware = (value: unknown, path: string): HardwareFixture => {
  const record = requireRecord(value, path);
  return {
    id: requireString(record['id'], `${path}.id`),
    platform: requireLiteral(
      record['platform'],
      ['windows-10', 'windows-11'] as const,
      `${path}.platform`,
    ),
    build: requireString(record['build'], `${path}.build`),
    cpuVendor: requireLiteral(record['cpuVendor'], ['AMD', 'Intel'] as const, `${path}.cpuVendor`),
    cpuModel: requireString(record['cpuModel'], `${path}.cpuModel`),
    gpuVendor: requireLiteral(
      record['gpuVendor'],
      ['AMD', 'Intel', 'NVIDIA'] as const,
      `${path}.gpuVendor`,
    ),
    gpuModel: requireString(record['gpuModel'], `${path}.gpuModel`),
    tier: requireLiteral(record['tier'], ['mid-range', 'high-end'] as const, `${path}.tier`),
  };
};

const parseGame = (value: unknown, path: string): GameFixture => {
  const record = requireRecord(value, path);
  const id = requireString(record['id'], `${path}.id`);
  const displayName = requireString(record['displayName'], `${path}.displayName`);
  const kind = requireLiteral(
    record['kind'],
    ['fictional-anchor', 'real-discovery', 'none-detected'] as const,
    `${path}.kind`,
  );
  const integrationValidated = requireFalse(
    record['integrationValidated'],
    `${path}.integrationValidated`,
  );

  switch (kind) {
    case 'fictional-anchor':
      if (record['integrationQualification'] !== 'deterministic-fixture') {
        return fail(`${path}.integrationQualification`, 'deterministic-fixture');
      }
      return {
        id,
        displayName,
        kind,
        integrationQualification: 'deterministic-fixture',
        integrationValidated,
      };
    case 'real-discovery':
      if (record['integrationQualification'] !== 'discovery-only-unqualified') {
        return fail(`${path}.integrationQualification`, 'discovery-only-unqualified');
      }
      return {
        id,
        displayName,
        kind,
        integrationQualification: 'discovery-only-unqualified',
        integrationValidated,
      };
    case 'none-detected':
      if (record['integrationQualification'] !== 'not-applicable') {
        return fail(`${path}.integrationQualification`, 'not-applicable');
      }
      return {
        id,
        displayName,
        kind,
        integrationQualification: 'not-applicable',
        integrationValidated,
      };
  }
};

const parseProfile = (value: unknown, path: string): ProfileFixture => {
  const record = requireRecord(value, path);
  return {
    id: requireString(record['id'], `${path}.id`),
    displayName: requireString(record['displayName'], `${path}.displayName`),
    riskPolicy: requireLiteral(
      record['riskPolicy'],
      ['verified', 'advanced', 'experimental', 'extreme'] as const,
      `${path}.riskPolicy`,
    ),
  };
};

const parseEvidence = (value: unknown, path: string): DesktopScenario['evidence'] => {
  const record = requireRecord(value, path);
  return {
    freshness: requireLiteral(
      record['freshness'],
      EVIDENCE_FRESHNESS_STATES,
      `${path}.freshness`,
    ) as EvidenceFreshness,
    quality: requireLiteral(
      record['quality'],
      EVIDENCE_QUALITY_STATES,
      `${path}.quality`,
    ) as EvidenceQuality,
    completeness: requireLiteral(
      record['completeness'],
      ['partial', 'complete'] as const,
      `${path}.completeness`,
    ),
    unavailableSources: requireArray(
      record['unavailableSources'],
      `${path}.unavailableSources`,
    ).map((source, index) => requireString(source, `${path}.unavailableSources[${String(index)}]`)),
  };
};

const parseRecommendation = (value: unknown, path: string): RecommendationState => {
  const record = requireRecord(value, path);
  return {
    id: requireString(record['id'], `${path}.id`),
    risk: requireLiteral(
      record['risk'],
      ['verified', 'advanced', 'experimental', 'extreme'] as const,
      `${path}.risk`,
    ),
    eligibility: requireLiteral(
      record['eligibility'],
      ['ready', 'review-required', 'excluded'] as const,
      `${path}.eligibility`,
    ),
    evidenceQuality: requireLiteral(
      record['evidenceQuality'],
      EVIDENCE_QUALITY_STATES,
      `${path}.evidenceQuality`,
    ) as EvidenceQuality,
  };
};

const parseRoute = (value: unknown, path: string): DesktopRoute => {
  if (!isDesktopRoute(value)) {
    return fail(path, 'known desktop route');
  }
  return value;
};

const parseRouteRequirement = (value: unknown, path: string): RouteRequirement => {
  const record = requireRecord(value, path);
  const state = record['state'];
  if (!isOperationalState(state)) {
    return fail(`${path}.state`, 'known operational state');
  }
  return {
    route: parseRoute(record['route'], `${path}.route`),
    state,
  };
};

const parseScenario = (value: unknown, index: number): DesktopScenario => {
  const path = `$.scenarios[${String(index)}]`;
  const record = requireRecord(value, path);
  const id = requireString(record['id'], `${path}.id`) as DesktopScenarioId;
  const familyIdValue = record['familyId'];
  if (!isScenarioFamilyId(familyIdValue)) {
    return fail(`${path}.familyId`, 'known scenario family');
  }

  const requiredRoutes = requireArray(record['requiredRoutes'], `${path}.requiredRoutes`).map(
    (route, routeIndex) => parseRoute(route, `${path}.requiredRoutes[${String(routeIndex)}]`),
  );
  const requiredStates = requireArray(record['requiredStates'], `${path}.requiredStates`).map(
    (requirement, requirementIndex) =>
      parseRouteRequirement(requirement, `${path}.requiredStates[${String(requirementIndex)}]`),
  );
  if (
    requiredRoutes.length === 0 ||
    requiredStates.length === 0 ||
    requiredStates.some(({ route }) => !requiredRoutes.includes(route))
  ) {
    return fail(`${path}.requiredStates`, 'non-empty route/state coverage');
  }

  const noEffect = requireRecord(record['noEffect'], `${path}.noEffect`);
  if (noEffect['receiptKind'] !== 'scenario-preview') {
    return fail(`${path}.noEffect.receiptKind`, 'scenario-preview');
  }

  return deepFreeze({
    id,
    familyId: familyIdValue as ScenarioFamilyId,
    name: requireString(record['name'], `${path}.name`),
    seed: requireInteger(record['seed'], `${path}.seed`),
    clock: requireString(record['clock'], `${path}.clock`),
    locale: requireLiteral(record['locale'], ['en-US', 'pt-BR'] as const, `${path}.locale`),
    latencyMs: requireInteger(record['latencyMs'], `${path}.latencyMs`),
    adapterIdentity: parseAdapterIdentity(record['adapterIdentity'], `${path}.adapterIdentity`),
    hardware: parseHardware(record['hardware'], `${path}.hardware`),
    game: parseGame(record['game'], `${path}.game`),
    profile: parseProfile(record['profile'], `${path}.profile`),
    evidence: parseEvidence(record['evidence'], `${path}.evidence`),
    entitlement: requireLiteral(
      record['entitlement'],
      ENTITLEMENT_STATES,
      `${path}.entitlement`,
    ) as EntitlementState,
    calibration: requireLiteral(
      record['calibration'],
      CALIBRATION_PROGRESS_STATES,
      `${path}.calibration`,
    ) as CalibrationProgress,
    activity: requireLiteral(
      record['activity'],
      ACTIVITY_STATES,
      `${path}.activity`,
    ) as ActivityState,
    recommendations: requireArray(record['recommendations'], `${path}.recommendations`).map(
      (recommendation, recommendationIndex) =>
        parseRecommendation(
          recommendation,
          `${path}.recommendations[${String(recommendationIndex)}]`,
        ),
    ),
    requiredRoutes,
    requiredStates,
    deltaPaths: requireArray(record['deltaPaths'], `${path}.deltaPaths`).map(
      (deltaPath, deltaIndex) =>
        requireString(deltaPath, `${path}.deltaPaths[${String(deltaIndex)}]`),
    ),
    noEffect: {
      receiptKind: 'scenario-preview',
      scenarioId: id,
      changed: requireFalse(noEffect['changed'], `${path}.noEffect.changed`),
      summary: requireString(noEffect['summary'], `${path}.noEffect.summary`),
    },
  });
};

export const parseDesktopScenarioManifest = (value: unknown): readonly DesktopScenario[] => {
  const root = requireRecord(value, '$');
  if (root['schemaVersion'] !== 1) {
    return fail('$.schemaVersion', '1');
  }
  requireString(root['fixtureVersion'], '$.fixtureVersion');

  const scenarios = requireArray(root['scenarios'], '$.scenarios').map(parseScenario);
  const expectedIds = Array.from(
    { length: 24 },
    (_, index) => `S${String(index + 1).padStart(2, '0')}`,
  );
  const actualIds = scenarios.map(({ id }) => id);
  if (
    scenarios.length !== expectedIds.length ||
    new Set(actualIds).size !== expectedIds.length ||
    actualIds.some((id, index) => id !== expectedIds[index])
  ) {
    return fail('$.scenarios', 'exact ordered identities S01-S24');
  }
  return deepFreeze(scenarios);
};

export const DESKTOP_SCENARIOS = parseDesktopScenarioManifest(manifest);

const scenarioById = new Map<string, DesktopScenario>(
  DESKTOP_SCENARIOS.map((scenario) => [scenario.id, scenario]),
);

export const getDesktopScenario = (id: string): DesktopScenario => {
  const scenario = scenarioById.get(id);
  if (scenario === undefined) {
    throw new Error(`Unknown desktop scenario: ${id}`);
  }
  return scenario;
};
