import { Ajv2020, type ErrorObject, type ValidateFunction } from 'ajv/dist/2020.js';
import webDocumentSchema from '../../../contracts/generated/web/v1/web-document.schema.json' with { type: 'json' };
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
  WebDocument,
} from './generated/index.js';

export const DIAGNOSTIC_VALUE_SCHEMA_ID = 'desktop.diagnostic-value.v1' as const;
export const HOST_TO_RENDERER_SHELL_EVENT_SCHEMA_ID = 'desktop.shell.host-to-renderer.v1' as const;
export const RENDERER_TO_HOST_SHELL_COMMAND_SCHEMA_ID =
  'desktop.shell.renderer-to-host.v1' as const;
export const WEB_DOCUMENT_SCHEMA_ID =
  'https://schemas.liiiraa.dev/web/v1/web-document.schema.json' as const;

type ContractSchemaId =
  | typeof DIAGNOSTIC_VALUE_SCHEMA_ID
  | typeof HOST_TO_RENDERER_SHELL_EVENT_SCHEMA_ID
  | typeof RENDERER_TO_HOST_SHELL_COMMAND_SCHEMA_ID
  | typeof WEB_DOCUMENT_SCHEMA_ID;

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

export type DiagnosticValueValidationResult = ContractValidationResult<DiagnosticValueJson>;
export type HostToRendererShellEventValidationResult =
  ContractValidationResult<HostToRendererShellEventJson>;
export type RendererToHostShellCommandValidationResult =
  ContractValidationResult<RendererToHostShellCommandJson>;
export type WebDocumentValidationError = ContractValidationError;
export type WebDocumentValidationResult = ContractValidationResult<WebDocument>;

const diagnosticValidator = diagnosticValueValidator;
const shellMessageValidators = {
  hostToRenderer: hostToRendererValidator,
  rendererToHost: rendererToHostValidator,
};
let cachedWebDocumentValidator: ValidateFunction<WebDocument> | undefined;

const getWebDocumentValidator = (): ValidateFunction<WebDocument> => {
  if (cachedWebDocumentValidator === undefined) {
    const ajv = new Ajv2020({
      allErrors: true,
      strict: true,
      strictTypes: false,
      validateFormats: false,
    });
    ajv.addKeyword('x-liiiraa-generated');
    cachedWebDocumentValidator = ajv.compile<WebDocument>(webDocumentSchema);
  }

  return cachedWebDocumentValidator;
};

const bounded = (value: string, maximum: number): string =>
  value.length <= maximum ? value : value.slice(0, maximum);

const issuePath = (error: ErrorObject): string =>
  bounded(error.instancePath.length === 0 ? '$' : `$${error.instancePath}`, MAX_PATH_LENGTH);

const structuralIssues = (errors: ErrorObject[] | null | undefined): ContractValidationIssue[] => {
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
        left.path.localeCompare(right.path) || left.keyword.localeCompare(right.keyword),
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

const hostEventHasSafeNavigation = (event: HostToRendererShellEventJson): boolean =>
  event.messageType !== 'desktop.shell.navigation-requested.event' ||
  isSafeNavigationIntent(event.payload.intent);

const rendererCommandHasSafeNavigation = (command: RendererToHostShellCommandJson): boolean => {
  if (command.messageType === 'desktop.shell.navigate.command') {
    return isSafeNavigationIntent(command.payload.intent);
  }
  if (command.messageType === 'desktop.shell.show-notification.command') {
    return isSafeNavigationIntent(command.payload.action);
  }
  return true;
};

const isSafeWebUri = (input: string): boolean => {
  if (input.includes('\\') || /\s/u.test(input)) {
    return false;
  }

  try {
    const uri = new URL(input);
    return (
      uri.protocol === 'https:' &&
      uri.hostname.length > 0 &&
      uri.username.length === 0 &&
      uri.password.length === 0
    );
  } catch {
    return false;
  }
};

const unsafeWebDocumentUriPath = (document: WebDocument): string | null => {
  if ('source' in document && !isSafeWebUri(document.source)) {
    return '$/source';
  }

  if ('evidence' in document) {
    const unsafeIndex = document.evidence.findIndex((evidence) => !isSafeWebUri(evidence.source));
    if (unsafeIndex !== -1) {
      return `$/evidence/${String(unsafeIndex)}/source`;
    }
  }

  return null;
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
  validateGeneratedValue(DIAGNOSTIC_VALUE_SCHEMA_ID, schemaId, input, diagnosticValidator);

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

export const validateWebDocument = (input: unknown): WebDocumentValidationResult => {
  const validator = getWebDocumentValidator();
  if (!validator(input)) {
    return invalidPayload(WEB_DOCUMENT_SCHEMA_ID, validator.errors);
  }

  const unsafeUriPath = unsafeWebDocumentUriPath(input);
  if (unsafeUriPath !== null) {
    return invalidSemanticPayload(WEB_DOCUMENT_SCHEMA_ID, unsafeUriPath, 'safeUri');
  }

  return {
    ok: true,
    value: input,
  };
};
