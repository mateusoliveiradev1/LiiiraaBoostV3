import { Ajv2020, type ErrorObject } from 'ajv/dist/2020.js';

import qualityManifestSchema from '../../../architecture/quality-manifest.schema.json' with {
  type: 'json',
};

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

interface QualityEvidence {
  id: string;
  command: string;
  file: string;
  owner: string;
  status: 'planned' | 'passed';
}

interface TestedDimension {
  status: 'tested';
  evidence: QualityEvidence[];
}

interface ExemptDimension {
  status: 'not_applicable';
  exemption: {
    rationale: string;
    residualRisk: string;
    reviewer: string;
    reopeningTrigger: {
      condition: string;
      reviewBy: string;
    };
  };
}

interface QualityManifest {
  schemaVersion: 1;
  featureId: string;
  requirements: string[];
  owner: string;
  acceptance: Record<QualityDimension, TestedDimension | ExemptDimension>;
}

const ajv = new Ajv2020({
  allErrors: true,
  strict: true,
});
const validateManifestSchema = ajv.compile<QualityManifest>(qualityManifestSchema);

const diagnostic = (code: string, path: string, message: string): PolicyDiagnostic => ({
  code,
  path,
  message,
});

const sortDiagnostics = (diagnostics: PolicyDiagnostic[]): PolicyDiagnostic[] =>
  diagnostics.toSorted(
    (left, right) =>
      left.path.localeCompare(right.path) ||
      left.code.localeCompare(right.code) ||
      left.message.localeCompare(right.message),
  );

const pointerToPath = (pointer: string): string => {
  if (pointer.length === 0) {
    return '$';
  }

  const segments = pointer
    .slice(1)
    .split('/')
    .map((segment) => segment.replaceAll('~1', '/').replaceAll('~0', '~'));

  return segments.reduce(
    (path, segment) =>
      /^[0-9]+$/.test(segment) ? `${path}[${segment}]` : `${path}.${segment}`,
    '$',
  );
};

const schemaErrorPath = (error: ErrorObject): string => {
  const basePath = pointerToPath(error.instancePath);
  const missingProperty = error.params['missingProperty'];

  return error.keyword === 'required' && typeof missingProperty === 'string'
    ? `${basePath}.${missingProperty}`
    : basePath;
};

const schemaErrorMessage = (error: ErrorObject): string => {
  const missingProperty = error.params['missingProperty'];
  if (error.keyword === 'required' && typeof missingProperty === 'string') {
    return `Required property "${missingProperty}" is missing.`;
  }

  return error.message === undefined
    ? `Manifest violates schema keyword "${error.keyword}".`
    : `Manifest ${error.message}.`;
};

const firstSchemaDiagnostic = (): PolicyDiagnostic => {
  const errors = (validateManifestSchema.errors ?? []).toSorted(
    (left, right) =>
      schemaErrorPath(left).localeCompare(schemaErrorPath(right)) ||
      left.keyword.localeCompare(right.keyword) ||
      schemaErrorMessage(left).localeCompare(schemaErrorMessage(right)),
  );
  const firstError = errors[0];

  return firstError === undefined
    ? diagnostic('MANIFEST_SCHEMA_INVALID', '$', 'Manifest does not match the canonical schema.')
    : diagnostic(
        'MANIFEST_SCHEMA_INVALID',
        schemaErrorPath(firstError),
        schemaErrorMessage(firstError),
      );
};

const isExactRepositoryPath = (path: string): boolean =>
  !path.includes('\\') &&
  !/[*?[\]{}]/.test(path) &&
  !path.startsWith('/') &&
  !/^[A-Za-z]:/.test(path) &&
  path.split('/').every((segment) => segment.length > 0 && segment !== '.' && segment !== '..');

const isTerminatingCommand = (command: string): boolean =>
  !/(^|\s)(?:--watch(?:All)?(?:=|\s|$)|-w(?:\s|$))/i.test(command);

const isExactCommand = (command: string): boolean =>
  !/[\r\n]/.test(command) && !/(?:&&|\|\||[;<>])/.test(command);

const dateValue = (value: string): number => Date.parse(`${value}T00:00:00.000Z`);

const validateContext = (context: QualityPolicyContext): PolicyDiagnostic[] => {
  if (context.mode !== 'planned' && context.mode !== 'final') {
    return [
      diagnostic(
        'POLICY_CONTEXT_INVALID',
        '$context.mode',
        'Policy mode must be explicitly set to "planned" or "final".',
      ),
    ];
  }

  if (!Number.isFinite(dateValue(context.asOf))) {
    return [
      diagnostic(
        'POLICY_CONTEXT_INVALID',
        '$context.asOf',
        'Policy asOf must be an ISO calendar date.',
      ),
    ];
  }

  return [];
};

const validateRequirementCoverage = (
  manifest: QualityManifest,
  context: QualityPolicyContext,
): PolicyDiagnostic[] => {
  const diagnostics: PolicyDiagnostic[] = [];
  const knownRequirements = new Set(context.knownRequirements);
  const manifestRequirements = new Set(manifest.requirements);

  for (const requirement of manifest.requirements.toSorted()) {
    if (!knownRequirements.has(requirement)) {
      diagnostics.push(
        diagnostic(
          'UNKNOWN_REQUIREMENT',
          `$.requirements.${requirement}`,
          `Requirement "${requirement}" is not declared by the policy context.`,
        ),
      );
    }
  }

  if (diagnostics.length > 0) {
    return diagnostics;
  }

  for (const requirement of [...(context.requiredRequirements ?? [])].toSorted()) {
    if (!manifestRequirements.has(requirement)) {
      diagnostics.push(
        diagnostic(
          'MISSING_REQUIREMENT',
          `$.requirements.${requirement}`,
          `Required acceptance target "${requirement}" is not covered.`,
        ),
      );
    }
  }

  return diagnostics;
};

const validateExemption = (
  manifest: QualityManifest,
  dimension: QualityDimension,
  value: ExemptDimension,
  context: QualityPolicyContext,
): PolicyDiagnostic[] => {
  const path = `$.acceptance.${dimension}.exemption`;

  if (value.exemption.reviewer === manifest.owner) {
    return [
      diagnostic(
        'UNACCOUNTABLE_EXEMPTION',
        `${path}.reviewer`,
        'Exemption reviewer must be independent from the manifest owner.',
      ),
    ];
  }

  if (dateValue(value.exemption.reopeningTrigger.reviewBy) <= dateValue(context.asOf)) {
    return [
      diagnostic(
        'STALE_REOPENING_TRIGGER',
        `${path}.reopeningTrigger.reviewBy`,
        'Exemption reviewBy must be later than the policy asOf date.',
      ),
    ];
  }

  return [];
};

const validateEvidence = (
  manifest: QualityManifest,
  dimension: QualityDimension,
  evidence: QualityEvidence,
  index: number,
  context: QualityPolicyContext,
  evidenceIds: Set<string>,
): PolicyDiagnostic[] => {
  const diagnostics: PolicyDiagnostic[] = [];
  const path = `$.acceptance.${dimension}.evidence[${String(index)}]`;

  if (evidenceIds.has(evidence.id)) {
    diagnostics.push(
      diagnostic(
        'DUPLICATE_EVIDENCE_ID',
        `${path}.id`,
        `Evidence id "${evidence.id}" must be unique across all dimensions.`,
      ),
    );
  } else {
    evidenceIds.add(evidence.id);
  }

  if (evidence.owner !== manifest.owner) {
    diagnostics.push(
      diagnostic(
        'EVIDENCE_OWNER_MISMATCH',
        `${path}.owner`,
        `Evidence owner "${evidence.owner}" must equal manifest owner "${manifest.owner}".`,
      ),
    );
  }

  if (!isExactRepositoryPath(evidence.file)) {
    diagnostics.push(
      diagnostic(
        'EVIDENCE_PATH_NOT_EXACT',
        `${path}.file`,
        'Evidence file must be one exact repository-relative path without wildcards.',
      ),
    );
  }

  if (!isTerminatingCommand(evidence.command)) {
    diagnostics.push(
      diagnostic(
        'EVIDENCE_COMMAND_NOT_TERMINATING',
        `${path}.command`,
        'Evidence command must terminate and cannot enable watch mode.',
      ),
    );
  } else if (!isExactCommand(evidence.command)) {
    diagnostics.push(
      diagnostic(
        'EVIDENCE_COMMAND_NOT_EXACT',
        `${path}.command`,
        'Evidence command must be one exact command without shell chaining or redirection.',
      ),
    );
  }

  if (context.mode === 'final') {
    if (evidence.status !== 'passed') {
      diagnostics.push(
        diagnostic(
          'EVIDENCE_NOT_FINAL',
          `${path}.status`,
          'Final mode requires every evidence status to be "passed".',
        ),
      );
    }

    if (!(context.availableFiles ?? []).includes(evidence.file)) {
      diagnostics.push(
        diagnostic(
          'EVIDENCE_FILE_MISSING',
          `${path}.file`,
          `Final evidence file "${evidence.file}" is not available.`,
        ),
      );
    }

    if (!(context.availableCommands ?? []).includes(evidence.command)) {
      diagnostics.push(
        diagnostic(
          'EVIDENCE_COMMAND_UNRESOLVED',
          `${path}.command`,
          `Final evidence command "${evidence.command}" is not resolved.`,
        ),
      );
    }
  }

  return diagnostics;
};

export const evaluateQualityManifest = (
  input: unknown,
  context: QualityPolicyContext,
): PolicyResult => {
  const contextDiagnostics = validateContext(context);
  if (contextDiagnostics.length > 0) {
    return {
      ok: false,
      diagnostics: contextDiagnostics,
    };
  }

  if (!validateManifestSchema(input)) {
    return {
      ok: false,
      diagnostics: [firstSchemaDiagnostic()],
    };
  }

  const diagnostics = validateRequirementCoverage(input, context);
  const evidenceIds = new Set<string>();

  for (const dimension of QUALITY_DIMENSIONS) {
    const value = input.acceptance[dimension];
    if (value.status === 'not_applicable') {
      diagnostics.push(...validateExemption(input, dimension, value, context));
      continue;
    }

    for (const [index, evidence] of value.evidence.entries()) {
      diagnostics.push(
        ...validateEvidence(input, dimension, evidence, index, context, evidenceIds),
      );
    }
  }

  const sortedDiagnostics = sortDiagnostics(diagnostics);
  return {
    ok: sortedDiagnostics.length === 0,
    diagnostics: sortedDiagnostics,
  };
};

export const parsePolicyMode = (arguments_: readonly string[]): PolicyMode => {
  const modeIndexes = arguments_
    .map((argument, index) => (argument === '--mode' ? index : -1))
    .filter((index) => index >= 0);

  if (modeIndexes.length === 0) {
    throw new Error('Missing required --mode planned|final.');
  }
  if (modeIndexes.length > 1) {
    throw new Error('--mode must be provided exactly once.');
  }

  const value = arguments_[modeIndexes[0]! + 1];
  if (value !== 'planned' && value !== 'final') {
    throw new Error('--mode must be followed by planned or final.');
  }

  return value;
};
