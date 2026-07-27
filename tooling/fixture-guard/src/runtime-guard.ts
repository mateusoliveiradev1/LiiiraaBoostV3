export type RuntimeGuardFindingCode =
  'FIXTURE_PROVENANCE' | 'IDENTITY_MISMATCH' | 'MODE_MISMATCH' | 'SCHEMA_MISMATCH';

export interface RuntimeGuardFinding {
  readonly code: RuntimeGuardFindingCode;
  readonly path: string;
}

export interface RuntimeGuardResult {
  readonly ok: boolean;
  readonly findings: readonly RuntimeGuardFinding[];
}

const PRODUCTION_ADAPTER_ID = 'liiiraa-desktop-production-unavailable';
const PRODUCTION_MODE = 'production';
const PRODUCTION_SCHEMA_VERSION = '1.0';

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null && !Array.isArray(value);

const isNonEmptyString = (value: unknown): value is string =>
  typeof value === 'string' && value.length > 0;

const findFixtureProvenance = (
  value: unknown,
  path: string,
  findings: RuntimeGuardFinding[],
): void => {
  if (Array.isArray(value)) {
    value.forEach((entry, index) => {
      findFixtureProvenance(entry, `${path}[${String(index)}]`, findings);
    });
    return;
  }

  if (!isRecord(value)) {
    return;
  }

  if (
    value['kind'] === 'fixture' ||
    Object.hasOwn(value, 'scenarioId') ||
    Object.hasOwn(value, 'fixtureVersion')
  ) {
    findings.push(
      Object.freeze({
        code: 'FIXTURE_PROVENANCE',
        path,
      }),
    );
    return;
  }

  for (const key of Object.keys(value).toSorted()) {
    findFixtureProvenance(value[key], `${path}.${key}`, findings);
  }
};

export const inspectProductionRuntimeBoundary = (boundary: unknown): RuntimeGuardResult => {
  const findings: RuntimeGuardFinding[] = [];
  const boundaryRecord = isRecord(boundary) ? boundary : {};
  const identity = isRecord(boundaryRecord['identity']) ? boundaryRecord['identity'] : {};

  if (boundaryRecord['mode'] !== PRODUCTION_MODE) {
    findings.push(
      Object.freeze({
        code: 'MODE_MISMATCH',
        path: '$.mode',
      }),
    );
  }

  if (
    identity['adapterId'] !== PRODUCTION_ADAPTER_ID ||
    !isNonEmptyString(identity['adapterVersion'])
  ) {
    findings.push(
      Object.freeze({
        code: 'IDENTITY_MISMATCH',
        path: '$.identity',
      }),
    );
  }

  if (boundaryRecord['schemaVersion'] !== PRODUCTION_SCHEMA_VERSION) {
    findings.push(
      Object.freeze({
        code: 'SCHEMA_MISMATCH',
        path: '$.schemaVersion',
      }),
    );
  }

  findFixtureProvenance(boundaryRecord['result'], '$.result', findings);

  return Object.freeze({
    ok: findings.length === 0,
    findings: Object.freeze(findings),
  });
};
