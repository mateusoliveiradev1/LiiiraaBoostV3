import {
  DESKTOP_INSPECTION_CAPABILITY,
  DESKTOP_SCHEMA_VERSION,
  type DesktopInspectionClient,
  type InspectSystemInput,
} from './client.js';
import type { NativeDiagnosticValue, NativeSystemInspection } from './truth.js';

export type ConformanceGroup = 'metadata' | 'lifecycle' | 'truth' | 'determinism';

export type ConformanceFailure =
  | 'CAPABILITY_MISMATCH'
  | 'CANCELLATION_NOT_HONORED'
  | 'IDENTITY_INVALID'
  | 'INVALID_INPUT_NOT_REJECTED'
  | 'MUTABLE_RESULT'
  | 'NONDETERMINISTIC'
  | 'PROVENANCE_INVALID'
  | 'RAW_THROW'
  | 'SCHEMA_MISMATCH'
  | 'SUCCESS_UNAVAILABLE_MISSING';

export interface ConformanceCaseResult {
  readonly group: ConformanceGroup;
  readonly name: string;
  readonly ok: boolean;
  readonly failures: readonly ConformanceFailure[];
}

export interface DesktopClientConformanceReport {
  readonly ok: boolean;
  readonly passed: number;
  readonly failed: number;
  readonly results: readonly ConformanceCaseResult[];
}

export interface DesktopClientConformanceCase {
  readonly group: ConformanceGroup;
  readonly name: string;
  run(): Promise<ConformanceCaseResult>;
}

export interface DesktopClientConformanceDependencies {
  readonly createClient: () => DesktopInspectionClient;
  readonly clock: () => string;
  readonly requestIds: () => string;
}

export interface DesktopClientConformanceSuite {
  readonly cases: readonly DesktopClientConformanceCase[];
  readonly groupCounts: Readonly<Record<ConformanceGroup, number>>;
  run(): Promise<DesktopClientConformanceReport>;
}

export const CONFORMANCE_GROUP_COUNTS = Object.freeze({
  metadata: 3,
  lifecycle: 4,
  truth: 2,
  determinism: 1,
}) satisfies Readonly<Record<ConformanceGroup, number>>;

type UnknownRecord = Record<string, unknown>;

const isRecord = (value: unknown): value is UnknownRecord =>
  typeof value === 'object' && value !== null && !Array.isArray(value);

const isNonEmptyString = (value: unknown): value is string =>
  typeof value === 'string' && value.length > 0;

const isPrimitive = (value: unknown): value is string | number | boolean =>
  typeof value === 'string' || typeof value === 'number' || typeof value === 'boolean';

const isDeepFrozen = (
  value: unknown,
  visited: ReadonlySet<object> = new Set<object>(),
): boolean => {
  if (!isRecord(value) && !Array.isArray(value)) {
    return true;
  }
  if (visited.has(value)) {
    return true;
  }
  if (!Object.isFrozen(value)) {
    return false;
  }
  const nextVisited = new Set(visited);
  nextVisited.add(value);
  return Object.values(value).every((nested) => isDeepFrozen(nested, nextVisited));
};

const hasExactKeys = (value: UnknownRecord, keys: readonly string[]): boolean => {
  const expected = keys.toSorted();
  const actual = Object.keys(value).toSorted();
  return actual.length === expected.length && actual.every((key, index) => key === expected[index]);
};

const hasValidProvenance = (value: unknown): value is NativeDiagnosticValue => {
  if (!isRecord(value) || !isRecord(value['provenance']) || typeof value['kind'] !== 'string') {
    return false;
  }
  const provenance = value['provenance'];

  switch (value['kind']) {
    case 'fixture':
      return (
        hasExactKeys(value, ['kind', 'provenance', 'value']) &&
        isPrimitive(value['value']) &&
        hasExactKeys(provenance, ['fixtureVersion', 'scenarioId']) &&
        isNonEmptyString(provenance['scenarioId']) &&
        isNonEmptyString(provenance['fixtureVersion'])
      );
    case 'observed':
      return (
        hasExactKeys(value, ['kind', 'provenance', 'value']) &&
        isPrimitive(value['value']) &&
        hasExactKeys(provenance, ['observedAt', 'source']) &&
        isNonEmptyString(provenance['source']) &&
        isNonEmptyString(provenance['observedAt'])
      );
    case 'measured':
      return (
        hasExactKeys(value, ['kind', 'provenance', 'value']) &&
        isPrimitive(value['value']) &&
        hasExactKeys(provenance, ['measuredAt', 'method', 'quality']) &&
        isNonEmptyString(provenance['method']) &&
        isNonEmptyString(provenance['measuredAt']) &&
        ['valid', 'degraded', 'insufficient'].includes(String(provenance['quality']))
      );
    case 'modeled':
      return (
        hasExactKeys(value, ['kind', 'provenance', 'value']) &&
        isPrimitive(value['value']) &&
        hasExactKeys(provenance, ['assumptions', 'confidence', 'modelId']) &&
        isNonEmptyString(provenance['modelId']) &&
        typeof provenance['confidence'] === 'number' &&
        provenance['confidence'] >= 0 &&
        provenance['confidence'] <= 1 &&
        Array.isArray(provenance['assumptions']) &&
        provenance['assumptions'].length >= 1 &&
        provenance['assumptions'].length <= 16 &&
        provenance['assumptions'].every(isNonEmptyString)
      );
    case 'unavailable':
      return (
        hasExactKeys(value, ['kind', 'provenance']) &&
        hasExactKeys(provenance, ['reason']) &&
        isNonEmptyString(provenance['reason'])
      );
    default:
      return false;
  }
};

const inspectionValues = (inspection: NativeSystemInspection): readonly NativeDiagnosticValue[] => [
  inspection.deviceLabel,
  inspection.logicalProcessorCount,
  inspection.totalMemoryBytes,
];

const validInput = (dependencies: DesktopClientConformanceDependencies): InspectSystemInput => ({
  requestId: dependencies.requestIds(),
  issuedAt: dependencies.clock(),
});

const createResult = (
  group: ConformanceGroup,
  name: string,
  failures: readonly ConformanceFailure[],
): ConformanceCaseResult =>
  Object.freeze({
    group,
    name,
    ok: failures.length === 0,
    failures: Object.freeze([...failures]),
  });

const createCase = (
  group: ConformanceGroup,
  name: string,
  execute: () => readonly ConformanceFailure[] | Promise<readonly ConformanceFailure[]>,
): DesktopClientConformanceCase =>
  Object.freeze({
    group,
    name,
    async run() {
      try {
        return createResult(group, name, await execute());
      } catch {
        return createResult(group, name, ['RAW_THROW']);
      }
    },
  });

export const createDesktopClientConformance = (
  dependencies: DesktopClientConformanceDependencies,
): DesktopClientConformanceSuite => {
  const cases: readonly DesktopClientConformanceCase[] = Object.freeze([
    createCase('metadata', 'immutable identity', () => {
      const identity = dependencies.createClient().identity;
      return Object.isFrozen(identity) &&
        isNonEmptyString(identity.adapterId) &&
        isNonEmptyString(identity.adapterVersion)
        ? []
        : ['IDENTITY_INVALID'];
    }),
    createCase('metadata', 'canonical schema version', () => {
      const schemaVersion: string = dependencies.createClient().schemaVersion;
      return schemaVersion === DESKTOP_SCHEMA_VERSION ? [] : ['SCHEMA_MISMATCH'];
    }),
    createCase('metadata', 'declared inspection capability', () => {
      const capabilities = dependencies.createClient().capabilities;
      return Object.isFrozen(capabilities) &&
        capabilities.length === 1 &&
        capabilities[0] === DESKTOP_INSPECTION_CAPABILITY
        ? []
        : ['CAPABILITY_MISMATCH'];
    }),
    createCase('lifecycle', 'invalid input', async () => {
      const result = await dependencies.createClient().inspectSystem({
        requestId: '',
        issuedAt: '',
      });
      return !result.ok && result.error.code === 'INVALID_INPUT'
        ? []
        : ['INVALID_INPUT_NOT_REJECTED'];
    }),
    createCase('lifecycle', 'pre-cancelled request', async () => {
      const controller = new AbortController();
      controller.abort();
      const result = await dependencies.createClient().inspectSystem({
        ...validInput(dependencies),
        signal: controller.signal,
      });
      return !result.ok && result.error.code === 'CANCELLED' ? [] : ['CANCELLATION_NOT_HONORED'];
    }),
    createCase('lifecycle', 'structured result without raw throw', async () => {
      const result: unknown = await dependencies
        .createClient()
        .inspectSystem(validInput(dependencies));
      return isRecord(result) && typeof result['ok'] === 'boolean' ? [] : ['RAW_THROW'];
    }),
    createCase('lifecycle', 'success with explicit unavailable truth', async () => {
      const result = await dependencies.createClient().inspectSystem(validInput(dependencies));
      return result.ok &&
        inspectionValues(result.value).some((value) => value.kind === 'unavailable')
        ? []
        : ['SUCCESS_UNAVAILABLE_MISSING'];
    }),
    createCase('truth', 'deeply immutable inspection', async () => {
      const result = await dependencies.createClient().inspectSystem(validInput(dependencies));
      return result.ok && isDeepFrozen(result.value) ? [] : ['MUTABLE_RESULT'];
    }),
    createCase('truth', 'exhaustive provenance', async () => {
      const result = await dependencies.createClient().inspectSystem(validInput(dependencies));
      return result.ok && inspectionValues(result.value).every(hasValidProvenance)
        ? []
        : ['PROVENANCE_INVALID'];
    }),
    createCase('determinism', 'repeated call equality', async () => {
      const client = dependencies.createClient();
      const input = validInput(dependencies);
      const first = await client.inspectSystem(input);
      const second = await client.inspectSystem(input);
      return JSON.stringify(first) === JSON.stringify(second) ? [] : ['NONDETERMINISTIC'];
    }),
  ]);

  return Object.freeze({
    cases,
    groupCounts: CONFORMANCE_GROUP_COUNTS,
    async run(): Promise<DesktopClientConformanceReport> {
      const results = Object.freeze(
        await Promise.all(cases.map(async (testCase) => testCase.run())),
      );
      const passed = results.filter((result) => result.ok).length;
      const failed = results.length - passed;
      return Object.freeze({
        ok: failed === 0,
        passed,
        failed,
        results,
      });
    },
  });
};
