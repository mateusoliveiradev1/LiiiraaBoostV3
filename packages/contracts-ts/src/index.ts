export type * from './generated/index.ts';
export {
  DIAGNOSTIC_VALUE_SCHEMA_ID,
  HOST_TO_RENDERER_SHELL_EVENT_SCHEMA_ID,
  RENDERER_TO_HOST_SHELL_COMMAND_SCHEMA_ID,
  WEB_DOCUMENT_SCHEMA_ID,
  validateDiagnosticValue,
  validateHostToRendererShellEvent,
  validateRendererToHostShellCommand,
  validateWebDocument,
} from './validation.ts';
export type {
  ContractValidationError,
  ContractValidationIssue,
  ContractValidationResult,
  DiagnosticValueValidationResult,
  HostToRendererShellEventValidationResult,
  RendererToHostShellCommandValidationResult,
  WebDocumentValidationError,
  WebDocumentValidationResult,
} from './validation.ts';
