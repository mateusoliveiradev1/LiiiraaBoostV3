export const QUALITY_DIMENSIONS = [
  'security',
  'privacy',
  'accessibility',
  'performance',
  'recovery',
] as const;

export type QualityDimension = (typeof QUALITY_DIMENSIONS)[number];
export type PolicyMode = 'planned' | 'final';

export interface PolicyDiagnostic {
  code: string;
  path: string;
  message: string;
}

export interface PolicyResult {
  ok: boolean;
  diagnostics: PolicyDiagnostic[];
}

export interface QualityPolicyContext {
  mode: PolicyMode;
  knownRequirements: readonly string[];
  requiredRequirements?: readonly string[];
  asOf: string;
  availableFiles?: readonly string[];
  availableCommands?: readonly string[];
}

export const evaluateQualityManifest = (
  _input: unknown,
  _context: QualityPolicyContext,
): PolicyResult => ({
  ok: true,
  diagnostics: [],
});

export const parsePolicyMode = (_arguments: readonly string[]): PolicyMode => 'planned';
