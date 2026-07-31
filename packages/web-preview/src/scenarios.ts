import {
  WEB_CHANNELS,
  WEB_LOCALES,
  WEB_VERSIONS,
  isWebRouteId,
  type WebChannel,
  type WebLocale,
  type WebRouteId,
  type WebVersion,
} from '@liiiraa/web-core';

import manifest from '../../../contracts/scenarios/web-scenarios.json' with {
  type: 'json',
};

const WEB_SCENARIO_FAMILIES = [
  'public',
  'documentation',
  'account',
  'admin',
  'accessibility',
] as const;
const WEB_SCENARIO_ROLES = [
  'visitor',
  'account-preview',
  'support',
  'operations',
  'security',
  'audit',
] as const;
const WEB_SCENARIO_CONSENT = [
  'not-applicable',
  'preview-granted',
  'preview-denied',
  'expired',
] as const;
const WEB_SCENARIO_VIEWPORTS = [
  '1440x900',
  '1280x800',
  '960x900',
  '390x844',
  '320x800',
] as const;
const WEB_SCENARIO_TERMINAL_STATES = [
  'distribution-gated',
  'mobile-ready',
  'current-documentation',
  'historical-unsupported',
  'recovery-escalation',
  'search-no-results',
  'artifact-unavailable',
  'integrity-blocked',
  'partial-outage',
  'sign-in-preview',
  'account-ready-preview',
  'authority-unavailable',
  'no-change-receipt',
  'admin-support-review',
  'diagnostic-consent-blocked',
  'high-risk-viewport-blocked',
  'authored-errors',
  'accessible-no-change-receipt',
] as const;
const WEB_SCENARIO_DELTA_PATHS = [
  'family',
  'locale',
  'routeId',
  'requiredRouteIds',
  'latencyMs',
  'version',
  'channel',
  'role',
  'consent',
  'viewport',
  'terminalState',
] as const;
const WEB_SCENARIO_KEYS = [
  'id',
  'name',
  'family',
  'clock',
  'locale',
  'routeId',
  'requiredRouteIds',
  'latencyMs',
  'provenance',
  'version',
  'channel',
  'role',
  'consent',
  'viewport',
  'terminalState',
  'requiredProof',
  'deltaPaths',
] as const;

type WebScenarioFamily = (typeof WEB_SCENARIO_FAMILIES)[number];
type WebScenarioRole = (typeof WEB_SCENARIO_ROLES)[number];
type WebScenarioConsent = (typeof WEB_SCENARIO_CONSENT)[number];
type WebScenarioViewport = (typeof WEB_SCENARIO_VIEWPORTS)[number];
type WebScenarioTerminalState =
  (typeof WEB_SCENARIO_TERMINAL_STATES)[number];
type WebScenarioDeltaPath = (typeof WEB_SCENARIO_DELTA_PATHS)[number];

export type WebScenarioId = `W${string}`;

export type WebScenario = Readonly<{
  channel: WebChannel;
  clock: string;
  consent: WebScenarioConsent;
  deltaPaths: readonly WebScenarioDeltaPath[];
  family: WebScenarioFamily;
  id: WebScenarioId;
  latencyMs: number;
  locale: WebLocale;
  name: string;
  provenance: Readonly<{
    fixtureVersion: 'web-scenarios-v1';
    kind: 'fixture';
    scenarioId: WebScenarioId;
    value: 'SIMULATED SCENARIO';
  }>;
  requiredProof: readonly string[];
  requiredRouteIds: readonly WebRouteId[];
  role: WebScenarioRole;
  routeId: WebRouteId;
  terminalState: WebScenarioTerminalState;
  version: WebVersion;
  viewport: WebScenarioViewport;
}>;

type UnknownRecord = Record<string, unknown>;

const fail = (path: string, expected: string): never => {
  throw new Error(`Invalid web scenario manifest at ${path}; expected ${expected}`);
};

const isRecord = (value: unknown): value is UnknownRecord =>
  typeof value === 'object' && value !== null && !Array.isArray(value);

const requireRecord = (value: unknown, path: string): UnknownRecord => {
  if (!isRecord(value)) {
    return fail(path, 'object');
  }
  return value;
};

const requireExactKeys = (
  record: UnknownRecord,
  expectedKeys: readonly string[],
  path: string,
): void => {
  const actualKeys = Object.keys(record).sort();
  const sortedExpected = [...expectedKeys].sort();
  if (
    actualKeys.length !== sortedExpected.length ||
    actualKeys.some((key, index) => key !== sortedExpected[index])
  ) {
    fail(path, `exact keys ${sortedExpected.join(', ')}`);
  }
};

const requireString = (value: unknown, path: string): string => {
  if (typeof value !== 'string' || value.length === 0) {
    return fail(path, 'non-empty string');
  }
  return value;
};

const requireLiteral = <const Values extends readonly string[]>(
  value: unknown,
  values: Values,
  path: string,
): Values[number] => {
  if (
    typeof value !== 'string' ||
    !(values as readonly string[]).includes(value)
  ) {
    return fail(path, values.join(' | '));
  }
  return value;
};

const requireArray = (value: unknown, path: string): readonly unknown[] => {
  if (!Array.isArray(value)) {
    return fail(path, 'array');
  }
  return value;
};

const requireUniqueNonEmptyStrings = (
  value: unknown,
  path: string,
): readonly string[] => {
  const values = requireArray(value, path).map((entry, index) =>
    requireString(entry, `${path}[${String(index)}]`),
  );
  if (values.length === 0 || new Set(values).size !== values.length) {
    return fail(path, 'non-empty unique strings');
  }
  return values;
};

const requireWebRoute = (value: unknown, path: string): WebRouteId => {
  if (typeof value !== 'string' || !isWebRouteId(value)) {
    return fail(path, 'canonical web route ID');
  }
  return value;
};

const requireClock = (value: unknown, path: string): string => {
  const clock = requireString(value, path);
  if (!clock.endsWith('Z') || Number.isNaN(Date.parse(clock))) {
    return fail(path, 'UTC ISO-8601 timestamp');
  }
  return clock;
};

const deepFreeze = <Value>(
  value: Value,
  visited = new Set<object>(),
): Readonly<Value> => {
  if (typeof value !== 'object' || value === null || visited.has(value)) {
    return value;
  }
  visited.add(value);
  for (const nested of Object.values(value)) {
    deepFreeze(nested, visited);
  }
  return Object.freeze(value);
};

const parseScenario = (value: unknown, index: number): WebScenario => {
  const path = `$.scenarios[${String(index)}]`;
  const record = requireRecord(value, path);
  requireExactKeys(record, WEB_SCENARIO_KEYS, path);

  const id = requireString(record['id'], `${path}.id`) as WebScenarioId;
  const routeId = requireWebRoute(record['routeId'], `${path}.routeId`);
  const requiredRouteIds = requireArray(
    record['requiredRouteIds'],
    `${path}.requiredRouteIds`,
  ).map((route, routeIndex) =>
    requireWebRoute(route, `${path}.requiredRouteIds[${String(routeIndex)}]`),
  );
  if (
    requiredRouteIds.length === 0 ||
    new Set(requiredRouteIds).size !== requiredRouteIds.length ||
    !requiredRouteIds.includes(routeId)
  ) {
    return fail(
      `${path}.requiredRouteIds`,
      'unique canonical routes including routeId',
    );
  }

  const latencyMs = record['latencyMs'];
  if (
    typeof latencyMs !== 'number' ||
    !Number.isInteger(latencyMs) ||
    latencyMs < 0 ||
    latencyMs > 5_000
  ) {
    return fail(`${path}.latencyMs`, 'integer from 0 through 5000');
  }

  const provenance = requireRecord(record['provenance'], `${path}.provenance`);
  requireExactKeys(
    provenance,
    ['kind', 'value', 'scenarioId', 'fixtureVersion'],
    `${path}.provenance`,
  );
  if (
    provenance['kind'] !== 'fixture' ||
    provenance['value'] !== 'SIMULATED SCENARIO' ||
    provenance['scenarioId'] !== id ||
    provenance['fixtureVersion'] !== 'web-scenarios-v1'
  ) {
    return fail(
      `${path}.provenance`,
      'matching SIMULATED SCENARIO fixture provenance',
    );
  }

  const deltaPaths = requireArray(
    record['deltaPaths'],
    `${path}.deltaPaths`,
  ).map((deltaPath, deltaIndex) =>
    requireLiteral(
      deltaPath,
      WEB_SCENARIO_DELTA_PATHS,
      `${path}.deltaPaths[${String(deltaIndex)}]`,
    ),
  );
  if (deltaPaths.length === 0 || new Set(deltaPaths).size !== deltaPaths.length) {
    return fail(`${path}.deltaPaths`, 'non-empty unique declared axes');
  }

  return deepFreeze({
    id,
    name: requireString(record['name'], `${path}.name`),
    family: requireLiteral(
      record['family'],
      WEB_SCENARIO_FAMILIES,
      `${path}.family`,
    ),
    clock: requireClock(record['clock'], `${path}.clock`),
    locale: requireLiteral(record['locale'], WEB_LOCALES, `${path}.locale`),
    routeId,
    requiredRouteIds,
    latencyMs,
    provenance: {
      kind: 'fixture',
      value: 'SIMULATED SCENARIO',
      scenarioId: id,
      fixtureVersion: 'web-scenarios-v1',
    },
    version: requireLiteral(
      record['version'],
      WEB_VERSIONS,
      `${path}.version`,
    ),
    channel: requireLiteral(
      record['channel'],
      WEB_CHANNELS,
      `${path}.channel`,
    ),
    role: requireLiteral(
      record['role'],
      WEB_SCENARIO_ROLES,
      `${path}.role`,
    ),
    consent: requireLiteral(
      record['consent'],
      WEB_SCENARIO_CONSENT,
      `${path}.consent`,
    ),
    viewport: requireLiteral(
      record['viewport'],
      WEB_SCENARIO_VIEWPORTS,
      `${path}.viewport`,
    ),
    terminalState: requireLiteral(
      record['terminalState'],
      WEB_SCENARIO_TERMINAL_STATES,
      `${path}.terminalState`,
    ),
    requiredProof: requireUniqueNonEmptyStrings(
      record['requiredProof'],
      `${path}.requiredProof`,
    ),
    deltaPaths,
  });
};

export const parseWebScenarioManifest = (
  value: unknown,
): readonly WebScenario[] => {
  const root = requireRecord(value, '$');
  requireExactKeys(root, ['schemaVersion', 'scenarios'], '$');
  if (root['schemaVersion'] !== 1) {
    return fail('$.schemaVersion', '1');
  }

  const scenarios = requireArray(root['scenarios'], '$.scenarios').map(
    parseScenario,
  );
  const expectedIds = Array.from(
    { length: 18 },
    (_, index) => `W${String(index + 1).padStart(2, '0')}`,
  );
  const actualIds = scenarios.map(({ id }) => id);
  if (
    actualIds.length !== expectedIds.length ||
    new Set(actualIds).size !== expectedIds.length ||
    actualIds.some((id, index) => id !== expectedIds[index])
  ) {
    return fail('$.scenarios', 'exact ordered identities W01-W18');
  }

  if (
    new Set(scenarios.map(({ locale }) => locale)).size !== WEB_LOCALES.length ||
    WEB_SCENARIO_FAMILIES.some(
      (family) => !scenarios.some((scenario) => scenario.family === family),
    )
  ) {
    return fail(
      '$.scenarios',
      'both shipping locales and every locked scenario family',
    );
  }

  return deepFreeze(scenarios);
};

export const WEB_SCENARIOS = parseWebScenarioManifest(manifest);
export const WEB_SCENARIO_IDS = deepFreeze(
  WEB_SCENARIOS.map(({ id }) => id),
);

const scenarioById = new Map<string, WebScenario>(
  WEB_SCENARIOS.map((scenario) => [scenario.id, scenario]),
);

export const getWebScenario = (id: string): WebScenario => {
  const scenario = scenarioById.get(id);
  if (scenario === undefined) {
    throw new Error(`Unknown web scenario: ${id}`);
  }
  return scenario;
};

export const publishedPreviewScenarioId = 'W01' as const;

export type WebPreviewComposition =
  | Readonly<{ kind: 'published' }>
  | Readonly<{ kind: 'test'; scenarioId: string }>;

export const resolveWebPreviewScenario = (
  composition: WebPreviewComposition,
): WebScenario => {
  if (composition.kind === 'published') {
    if (
      Object.keys(composition).length !== 1 ||
      'scenarioId' in composition
    ) {
      throw new Error('Published preview scenario cannot be overridden');
    }
    return getWebScenario(publishedPreviewScenarioId);
  }

  if (
    composition.kind === 'test' &&
    Object.keys(composition).length === 2
  ) {
    return getWebScenario(composition.scenarioId);
  }
  return fail('$.composition', 'published or explicit test composition');
};
