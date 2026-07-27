import { Ajv2020, type ErrorObject, type ValidateFunction } from 'ajv/dist/2020.js';

import diagnosticValueSchema from '../../../contracts/generated/desktop/v1/diagnostic-value.schema.json' with { type: 'json' };
import type { DiagnosticValueJson } from './generated/index.js';

export const DIAGNOSTIC_VALUE_SCHEMA_ID = 'desktop.diagnostic-value.v1' as const;

const MAX_ISSUES = 8;
const MAX_PATH_LENGTH = 256;
const MAX_KEYWORD_LENGTH = 64;

export interface ContractValidationIssue {
  readonly path: string;
  readonly keyword: string;
}

export interface ContractValidationError {
  readonly code: 'SCHEMA_UNSUPPORTED' | 'PAYLOAD_INVALID';
  readonly schemaId: typeof DIAGNOSTIC_VALUE_SCHEMA_ID | null;
  readonly issues: readonly ContractValidationIssue[];
  readonly truncated: boolean;
}

export type DiagnosticValueValidationResult =
  | {
      readonly ok: true;
      readonly value: DiagnosticValueJson;
    }
  | {
      readonly ok: false;
      readonly error: ContractValidationError;
    };

type JsonSchema = Record<string, unknown>;

const isJsonSchema = (value: unknown): value is JsonSchema =>
  typeof value === 'object' && value !== null && !Array.isArray(value);

const compileDiagnosticValueValidator = (): ValidateFunction<DiagnosticValueJson> => {
  const definitions = diagnosticValueSchema.$defs;
  const ajv = new Ajv2020({
    allErrors: true,
    strict: true,
    validateFormats: false,
  });

  for (const definition of Object.values(definitions)) {
    if (!isJsonSchema(definition)) {
      throw new Error('Generated diagnostic schema contains a non-object definition.');
    }
    ajv.addSchema(definition);
  }

  const validator = ajv.getSchema<DiagnosticValueJson>('DiagnosticValue.json');
  if (validator === undefined) {
    throw new Error('Generated diagnostic schema does not expose DiagnosticValue.json.');
  }
  return validator;
};

const diagnosticValueValidator = compileDiagnosticValueValidator();

const bounded = (value: string, maximum: number): string =>
  value.length <= maximum ? value : value.slice(0, maximum);

const errorPath = (error: ErrorObject): string =>
  bounded(error.instancePath.length === 0 ? '$' : `$${error.instancePath}`, MAX_PATH_LENGTH);

const structuralIssues = (
  errors: readonly ErrorObject[] | null | undefined,
): readonly ContractValidationIssue[] => {
  const unique = new Map<string, ContractValidationIssue>();

  for (const error of errors ?? []) {
    const issue = {
      path: errorPath(error),
      keyword: bounded(error.keyword, MAX_KEYWORD_LENGTH),
    };
    unique.set(`${issue.path}\u0000${issue.keyword}`, issue);
  }

  return [...unique.values()]
    .toSorted(
      (left, right) =>
        left.path.localeCompare(right.path) || left.keyword.localeCompare(right.keyword),
    )
    .slice(0, MAX_ISSUES);
};

export const validateDiagnosticValue = (
  schemaId: string,
  input: unknown,
): DiagnosticValueValidationResult => {
  if (schemaId !== DIAGNOSTIC_VALUE_SCHEMA_ID) {
    return {
      ok: false,
      error: {
        code: 'SCHEMA_UNSUPPORTED',
        schemaId: null,
        issues: [{ path: '$', keyword: 'schema' }],
        truncated: false,
      },
    };
  }

  if (!diagnosticValueValidator(input)) {
    const errors = diagnosticValueValidator.errors;
    return {
      ok: false,
      error: {
        code: 'PAYLOAD_INVALID',
        schemaId: DIAGNOSTIC_VALUE_SCHEMA_ID,
        issues: structuralIssues(errors),
        truncated: (errors?.length ?? 0) > MAX_ISSUES,
      },
    };
  }

  return {
    ok: true,
    value: input,
  };
};
