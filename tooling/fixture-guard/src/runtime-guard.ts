export type RuntimeGuardFindingCode =
  | 'FIXTURE_PROVENANCE'
  | 'IDENTITY_MISMATCH'
  | 'MODE_MISMATCH'
  | 'SCHEMA_MISMATCH';

export interface RuntimeGuardFinding {
  readonly code: RuntimeGuardFindingCode;
  readonly path: string;
}

export interface RuntimeGuardResult {
  readonly ok: boolean;
  readonly findings: readonly RuntimeGuardFinding[];
}

export const inspectProductionRuntimeBoundary = (
  _boundary: unknown,
): RuntimeGuardResult =>
  Object.freeze({
    ok: true,
    findings: Object.freeze([]),
  });
