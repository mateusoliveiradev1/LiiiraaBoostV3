import {
  createProductionDesktopComposition,
  type ProductionDesktopComposition,
  type ProductionUnavailableOptions,
} from '@liiiraa/desktop-production-reference';

export const DESKTOP_TEST_SCENARIO_STORAGE_KEY = 'liiiraa.desktop.test-scenario-selection.v1';

export type DesktopTestScenarioId =
  | 'S01'
  | 'S02'
  | 'S03'
  | 'S04'
  | 'S05'
  | 'S06'
  | 'S07'
  | 'S08'
  | 'S09'
  | 'S10'
  | 'S11'
  | 'S12'
  | 'S13'
  | 'S14'
  | 'S15'
  | 'S16'
  | 'S17'
  | 'S18'
  | 'S19'
  | 'S20'
  | 'S21'
  | 'S22'
  | 'S23'
  | 'S24';

export interface DesktopScenarioStorage {
  readonly getItem: (key: string) => string | null;
  readonly setItem: (key: string, value: string) => void;
}

export interface DesktopScenarioSelection {
  readonly current: () => DesktopTestScenarioId;
  readonly select: (scenarioId: string) => DesktopScenarioSelectionResult;
}

export type DesktopScenarioSelectionResult =
  | Readonly<{ ok: true; value: DesktopTestScenarioId }>
  | Readonly<{
      ok: false;
      error: Readonly<{ code: 'INVALID_TEST_SCENARIO'; path: '$.scenarioSelection' }>;
    }>;

export interface DevelopmentDesktopComposition {
  readonly mode: 'development' | 'test';
  readonly initialPath: '/calibration/welcome';
  readonly scenarioSelection: DesktopScenarioSelection;
}

export type DesktopComposition = DevelopmentDesktopComposition | ProductionDesktopComposition;

export interface DevelopmentDesktopCompositionOptions {
  readonly mode: 'development' | 'test';
  readonly storage?: DesktopScenarioStorage;
}

export interface ProductionDesktopCompositionOptions {
  readonly mode: 'production';
  readonly productionOptions: ProductionUnavailableOptions;
  readonly productionReferenceFactory?: (options: ProductionUnavailableOptions) => unknown;
}

export type CreateDesktopCompositionOptions =
  DevelopmentDesktopCompositionOptions | ProductionDesktopCompositionOptions;

export type DesktopCompositionRefusalCode =
  'FIXTURE_IDENTITY_REFUSED' | 'FIXTURE_PROVENANCE_REFUSED' | 'PRODUCTION_REFERENCE_INVALID';

export class DesktopCompositionRefusedError extends Error {
  public override readonly name = 'DesktopCompositionRefusedError';

  public constructor(
    public readonly code: DesktopCompositionRefusalCode,
    public readonly path: string,
  ) {
    super(`Desktop production composition refused: ${code} at ${path}`);
  }
}

const SCENARIO_IDS = new Set<string>(
  Array.from({ length: 24 }, (_, index) => `S${String(index + 1).padStart(2, '0')}`),
);

const isTestScenarioId = (value: unknown): value is DesktopTestScenarioId =>
  typeof value === 'string' && SCENARIO_IDS.has(value);

const invalidScenario = (): DesktopScenarioSelectionResult =>
  Object.freeze({
    ok: false,
    error: Object.freeze({
      code: 'INVALID_TEST_SCENARIO',
      path: '$.scenarioSelection',
    }),
  });

const createScenarioSelection = (
  storage: DesktopScenarioStorage | undefined,
): DesktopScenarioSelection => {
  const stored = storage?.getItem(DESKTOP_TEST_SCENARIO_STORAGE_KEY);
  let currentScenario: DesktopTestScenarioId = isTestScenarioId(stored) ? stored : 'S01';

  return Object.freeze({
    current: () => currentScenario,
    select: (scenarioId: string): DesktopScenarioSelectionResult => {
      if (!isTestScenarioId(scenarioId)) {
        return invalidScenario();
      }
      currentScenario = scenarioId;
      storage?.setItem(DESKTOP_TEST_SCENARIO_STORAGE_KEY, scenarioId);
      return Object.freeze({ ok: true, value: scenarioId });
    },
  });
};

const isRecord = (value: unknown): value is Readonly<Record<string, unknown>> =>
  typeof value === 'object' && value !== null && !Array.isArray(value);

const findFixtureProvenance = (
  value: unknown,
  path: string,
  seen: WeakSet<object>,
): string | undefined => {
  if (typeof value !== 'object' || value === null) {
    return undefined;
  }
  if (seen.has(value)) {
    return undefined;
  }
  seen.add(value);
  if (Array.isArray(value)) {
    for (const [index, entry] of value.entries()) {
      const finding = findFixtureProvenance(entry, `${path}[${String(index)}]`, seen);
      if (finding !== undefined) {
        return finding;
      }
    }
    return undefined;
  }

  const record = value as Readonly<Record<string, unknown>>;
  if (
    record['kind'] === 'fixture' ||
    Object.hasOwn(record, 'scenarioId') ||
    Object.hasOwn(record, 'fixtureVersion')
  ) {
    return path;
  }
  for (const key of Object.keys(record).toSorted()) {
    const finding = findFixtureProvenance(record[key], `${path}.${key}`, seen);
    if (finding !== undefined) {
      return finding;
    }
  }
  return undefined;
};

function assertProductionComposition(
  candidate: unknown,
): asserts candidate is ProductionDesktopComposition {
  if (!isRecord(candidate) || candidate['mode'] !== 'production') {
    throw new DesktopCompositionRefusedError('PRODUCTION_REFERENCE_INVALID', '$.mode');
  }
  const client = candidate['client'];
  if (!isRecord(client)) {
    throw new DesktopCompositionRefusedError('PRODUCTION_REFERENCE_INVALID', '$.client');
  }
  const identity = client['identity'];
  if (!isRecord(identity) || identity['adapterId'] !== 'liiiraa-desktop-production-unavailable') {
    throw new DesktopCompositionRefusedError('FIXTURE_IDENTITY_REFUSED', '$.client.identity');
  }
  if (
    typeof identity['adapterVersion'] !== 'string' ||
    identity['adapterVersion'].length === 0 ||
    client['schemaVersion'] !== '1.0' ||
    !Array.isArray(client['capabilities']) ||
    typeof client['inspectSystem'] !== 'function'
  ) {
    throw new DesktopCompositionRefusedError('PRODUCTION_REFERENCE_INVALID', '$.client');
  }
  const fixturePath = findFixtureProvenance(client, '$.client', new WeakSet());
  if (fixturePath !== undefined) {
    throw new DesktopCompositionRefusedError('FIXTURE_PROVENANCE_REFUSED', fixturePath);
  }
}

export function createDesktopComposition(
  options: DevelopmentDesktopCompositionOptions,
): DevelopmentDesktopComposition;
export function createDesktopComposition(
  options: ProductionDesktopCompositionOptions,
): ProductionDesktopComposition;
export function createDesktopComposition(
  options: CreateDesktopCompositionOptions,
): DesktopComposition {
  if (options.mode !== 'production') {
    return Object.freeze({
      mode: options.mode,
      initialPath: '/calibration/welcome',
      scenarioSelection: createScenarioSelection(options.storage),
    });
  }

  const factory = options.productionReferenceFactory ?? createProductionDesktopComposition;
  const composition = factory(options.productionOptions);
  assertProductionComposition(composition);
  return composition;
}
