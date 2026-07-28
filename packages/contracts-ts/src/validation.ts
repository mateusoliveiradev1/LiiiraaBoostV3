import type { ErrorObject, ValidateFunction } from 'ajv';
import {
  diagnosticValueValidator,
  hostToRendererValidator,
  rendererToHostValidator,
} from './generated/standalone-validators.js';
import type {
  DiagnosticValueJson,
  HostToRendererShellEventJson,
  RendererToHostShellCommandJson,
  ShellNavigationIntentJson,
} from './generated/index.js';

export const DIAGNOSTIC_VALUE_SCHEMA_ID = 'desktop.diagnostic-value.v1' as const;
export const HOST_TO_RENDERER_SHELL_EVENT_SCHEMA_ID =
  'desktop.shell.host-to-renderer.v1' as const;
export const RENDERER_TO_HOST_SHELL_COMMAND_SCHEMA_ID =
  'desktop.shell.renderer-to-host.v1' as const;

type ContractSchemaId =
  | typeof DIAGNOSTIC_VALUE_SCHEMA_ID
  | typeof HOST_TO_RENDERER_SHELL_EVENT_SCHEMA_ID
  | typeof RENDERER_TO_HOST_SHELL_COMMAND_SCHEMA_ID;

const MAX_ISSUES = 8;
const MAX_PATH_LENGTH = 256;
const MAX_KEYWORD_LENGTH = 64;

export interface ContractValidationIssue {
  readonly path: string;
  readonly keyword: string;
}

export interface ContractValidationError {
  readonly code: 'SCHEMA_UNSUPPORTED' | 'PAYLOAD_INVALID';
  readonly schemaId: ContractSchemaId | null;
  readonly issues: readonly ContractValidationIssue[];
  readonly truncated: boolean;
}

export type ContractValidationResult<Value> =
  | {
      readonly ok: true;
      readonly value: Value;
    }
  | {
      readonly ok: false;
      readonly error: ContractValidationError;
    };

export type DiagnosticValueValidationResult =
  ContractValidationResult<DiagnosticValueJson>;
export type HostToRendererShellEventValidationResult =
  ContractValidationResult<HostToRendererShellEventJson>;
export type RendererToHostShellCommandValidationResult =
  ContractValidationResult<RendererToHostShellCommandJson>;

const diagnosticValidator =
  diagnosticValueValidator as ValidateFunction<DiagnosticValueJson>;
const shellMessageValidators = {
  hostToRenderer:
    hostToRendererValidator as ValidateFunction<HostToRendererShellEventJson>,
  rendererToHost:
    rendererToHostValidator as ValidateFunction<RendererToHostShellCommandJson>,
};

const bounded = (value: string, maximum: number): string =>
  value.length <= maximum ? value : value.slice(0, maximum);

const issuePath = (error: ErrorObject): string =>
  bounded(
    error.instancePath.length === 0 ? '$' : `$${error.instancePath}`,
    MAX_PATH_LENGTH,
  );

const structuralIssues = (
  errors: ErrorObject[] | null | undefined,
): ContractValidationIssue[] => {
  const unique = new Map<string, ContractValidationIssue>();

  for (const error of errors ?? []) {
    const issue = {
      path: issuePath(error),
      keyword: bounded(error.keyword, MAX_KEYWORD_LENGTH),
    };
    unique.set(`${issue.path}\u0000${issue.keyword}`, issue);
  }

  return [...unique.values()]
    .sort(
      (left, right) =>
        left.path.localeCompare(right.path) ||
        left.keyword.localeCompare(right.keyword),
    )
    .slice(0, MAX_ISSUES);
};

const unsupportedSchema = (): ContractValidationResult<never> => ({
  ok: false,
  error: {
    code: 'SCHEMA_UNSUPPORTED',
    schemaId: null,
    issues: [{ path: '$', keyword: 'schema' }],
    truncated: false,
  },
});

const invalidPayload = (
  schemaId: ContractSchemaId,
  errors: ErrorObject[] | null | undefined,
): ContractValidationResult<never> => ({
  ok: false,
  error: {
    code: 'PAYLOAD_INVALID',
    schemaId,
    issues: structuralIssues(errors),
    truncated: (errors?.length ?? 0) > MAX_ISSUES,
  },
});

const invalidSemanticPayload = (
  schemaId: ContractSchemaId,
  path: string,
  keyword: string,
): ContractValidationResult<never> => ({
  ok: false,
  error: {
    code: 'PAYLOAD_INVALID',
    schemaId,
    issues: [{ path, keyword }],
    truncated: false,
  },
});

const isSafeNavigationIntent = (intent: ShellNavigationIntentJson): boolean => {
  if (intent.kind !== 'documentation') {
    return true;
  }

  const documentId = intent.documentId;
  return (
    !documentId.includes('..') &&
    !documentId.includes('\\') &&
    !documentId.includes('://') &&
    !documentId.startsWith('/')
  );
};

const hostEventHasSafeNavigation = (
  event: HostToRendererShellEventJson,
): boolean =>
  event.messageType !== 'desktop.shell.navigation-requested.event' ||
  isSafeNavigationIntent(event.payload.intent);

const rendererCommandHasSafeNavigation = (
  command: RendererToHostShellCommandJson,
): boolean => {
  if (command.messageType === 'desktop.shell.navigate.command') {
    return isSafeNavigationIntent(command.payload.intent);
  }
  if (command.messageType === 'desktop.shell.show-notification.command') {
    return isSafeNavigationIntent(command.payload.action);
  }
  return true;
};

const validateGeneratedValue = <Value>(
  expectedSchemaId: ContractSchemaId,
  schemaId: string,
  input: unknown,
  validator: ValidateFunction<Value>,
): ContractValidationResult<Value> => {
  if (schemaId !== expectedSchemaId) {
    return unsupportedSchema();
  }

  if (!validator(input)) {
    return invalidPayload(expectedSchemaId, validator.errors);
  }

  return {
    ok: true,
    value: input,
  };
};

export const validateDiagnosticValue = (
  schemaId: string,
  input: unknown,
): DiagnosticValueValidationResult =>
  validateGeneratedValue(
    DIAGNOSTIC_VALUE_SCHEMA_ID,
    schemaId,
    input,
    diagnosticValidator,
  );

export const validateHostToRendererShellEvent = (
  schemaId: string,
  input: unknown,
): HostToRendererShellEventValidationResult => {
  const result = validateGeneratedValue(
    HOST_TO_RENDERER_SHELL_EVENT_SCHEMA_ID,
    schemaId,
    input,
    shellMessageValidators.hostToRenderer,
  );
  if (result.ok && !hostEventHasSafeNavigation(result.value)) {
    return invalidSemanticPayload(
      HOST_TO_RENDERER_SHELL_EVENT_SCHEMA_ID,
      '$/payload/intent/documentId',
      'safeNavigation',
    );
  }
  return result;
};

export const validateRendererToHostShellCommand = (
  schemaId: string,
  input: unknown,
): RendererToHostShellCommandValidationResult => {
  const result = validateGeneratedValue(
    RENDERER_TO_HOST_SHELL_COMMAND_SCHEMA_ID,
    schemaId,
    input,
    shellMessageValidators.rendererToHost,
  );
  if (result.ok && !rendererCommandHasSafeNavigation(result.value)) {
    return invalidSemanticPayload(
      RENDERER_TO_HOST_SHELL_COMMAND_SCHEMA_ID,
      '$/payload',
      'safeNavigation',
    );
  }
  return result;
};
