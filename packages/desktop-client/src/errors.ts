import type { ContractValidationIssue } from '@liiiraa/contracts-ts';

export type Result<Value, ErrorValue> =
  Readonly<{ ok: true; value: Value }> | Readonly<{ ok: false; error: ErrorValue }>;

export type InspectionField =
  'envelope' | 'deviceLabel' | 'logicalProcessorCount' | 'totalMemoryBytes';

export type DesktopInspectionError =
  | Readonly<{ code: 'CAPABILITY_UNAVAILABLE'; capability: DesktopCapability }>
  | Readonly<{ code: 'CANCELLED' }>
  | Readonly<{
      code: 'INVALID_TRANSPORT';
      field: InspectionField;
      issues: readonly ContractValidationIssue[];
    }>
  | Readonly<{ code: 'REQUEST_MISMATCH' }>
  | Readonly<{ code: 'SCHEMA_UNSUPPORTED'; expected: DesktopSchemaVersion }>
  | Readonly<{ code: 'TRANSPORT_FAILURE' }>;

export type DesktopCapability = 'system.inspect.summary';
export type DesktopSchemaVersion = '1.0';
