export type * from './generated/index.js';
export {
  DIAGNOSTIC_VALUE_SCHEMA_ID,
  HOST_TO_RENDERER_SHELL_EVENT_SCHEMA_ID,
  RENDERER_TO_HOST_SHELL_COMMAND_SCHEMA_ID,
  validateDiagnosticValue,
  validateHostToRendererShellEvent,
  validateRendererToHostShellCommand,
} from './validation.js';
export type {
  ContractValidationError,
  ContractValidationIssue,
  ContractValidationResult,
  DiagnosticValueValidationResult,
  HostToRendererShellEventValidationResult,
  RendererToHostShellCommandValidationResult,
} from './validation.js';
