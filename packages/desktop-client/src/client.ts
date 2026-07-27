import {
  DIAGNOSTIC_VALUE_SCHEMA_ID,
  validateDiagnosticValue,
  type DiagnosticValueJson,
} from '@liiiraa/contracts-ts';

import type {
  DesktopCapability,
  DesktopInspectionError,
  DesktopSchemaVersion,
  InspectionField,
  Result,
} from './errors.js';
import { mapDiagnosticValue, type NativeSystemInspection } from './truth.js';

export const DESKTOP_SCHEMA_VERSION = '1.0' as const satisfies DesktopSchemaVersion;
export const DESKTOP_INSPECTION_CAPABILITY =
  'system.inspect.summary' as const satisfies DesktopCapability;

export interface DesktopClientIdentity {
  readonly adapterId: string;
  readonly adapterVersion: string;
}

export interface InspectSystemInput {
  readonly requestId: string;
  readonly issuedAt: string;
  readonly correlationId?: string;
  readonly signal?: AbortSignal;
}

export interface DesktopInspectionTransport {
  readonly identity: DesktopClientIdentity;
  readonly schemaVersion: string;
  readonly capabilities: readonly string[];
  inspectSystem(input: InspectSystemInput): Promise<unknown>;
}

export interface DesktopInspectionClient {
  readonly identity: DesktopClientIdentity;
  readonly schemaVersion: DesktopSchemaVersion;
  readonly capabilities: readonly DesktopCapability[];
  inspectSystem(
    input: InspectSystemInput,
  ): Promise<Result<NativeSystemInspection, DesktopInspectionError>>;
}

type UnknownRecord = Record<string, unknown>;

interface ParsedEnvelope {
  readonly inspectionId: string;
  readonly inspectedAt: string;
  readonly deviceLabel: unknown;
  readonly logicalProcessorCount: unknown;
  readonly totalMemoryBytes: unknown;
}

const isRecord = (value: unknown): value is UnknownRecord =>
  typeof value === 'object' && value !== null && !Array.isArray(value);

const isNonEmptyString = (value: unknown): value is string =>
  typeof value === 'string' && value.length > 0;

const invalidEnvelope = (): Result<never, DesktopInspectionError> => ({
  ok: false,
  error: {
    code: 'INVALID_TRANSPORT',
    field: 'envelope',
    issues: Object.freeze([{ path: '$', keyword: 'shape' }]),
  },
});

const parseEnvelope = (
  input: unknown,
  request: InspectSystemInput,
): Result<ParsedEnvelope, DesktopInspectionError> => {
  if (!isRecord(input)) {
    return invalidEnvelope();
  }
  if (input['schemaVersion'] !== DESKTOP_SCHEMA_VERSION) {
    return {
      ok: false,
      error: {
        code: 'SCHEMA_UNSUPPORTED',
        expected: DESKTOP_SCHEMA_VERSION,
      },
    };
  }
  if (
    input['messageType'] !== 'desktop.inspect-system.result' ||
    !isNonEmptyString(input['requestId']) ||
    input['requestId'] !== request.requestId ||
    !isNonEmptyString(input['issuedAt']) ||
    !isRecord(input['payload'])
  ) {
    return invalidEnvelope();
  }
  if (request.correlationId !== undefined && input['correlationId'] !== request.correlationId) {
    return { ok: false, error: { code: 'REQUEST_MISMATCH' } };
  }

  const payload = input['payload'];
  if (!isNonEmptyString(payload['inspectionId']) || !isNonEmptyString(payload['inspectedAt'])) {
    return invalidEnvelope();
  }

  return {
    ok: true,
    value: {
      inspectionId: payload['inspectionId'],
      inspectedAt: payload['inspectedAt'],
      deviceLabel: payload['deviceLabel'],
      logicalProcessorCount: payload['logicalProcessorCount'],
      totalMemoryBytes: payload['totalMemoryBytes'],
    },
  };
};

const validateField = (
  field: Exclude<InspectionField, 'envelope'>,
  input: unknown,
): Result<DiagnosticValueJson, DesktopInspectionError> => {
  const validation = validateDiagnosticValue(DIAGNOSTIC_VALUE_SCHEMA_ID, input);
  if (!validation.ok) {
    return {
      ok: false,
      error: {
        code: 'INVALID_TRANSPORT',
        field,
        issues: Object.freeze([...validation.error.issues]),
      },
    };
  }
  return { ok: true, value: validation.value };
};

const hasInspectionCapability = (
  capabilities: readonly string[],
): capabilities is readonly DesktopCapability[] =>
  capabilities.length === 1 && capabilities[0] === DESKTOP_INSPECTION_CAPABILITY;

const isCancelled = (signal: AbortSignal | undefined): boolean => signal?.aborted === true;

export const createDesktopInspectionClient = (
  transport: DesktopInspectionTransport,
): DesktopInspectionClient => {
  const identity = Object.freeze({ ...transport.identity });
  const capabilities = Object.freeze(
    transport.capabilities.filter(
      (capability): capability is DesktopCapability => capability === DESKTOP_INSPECTION_CAPABILITY,
    ),
  );

  return Object.freeze({
    identity,
    schemaVersion: DESKTOP_SCHEMA_VERSION,
    capabilities,
    async inspectSystem(
      input: InspectSystemInput,
    ): Promise<Result<NativeSystemInspection, DesktopInspectionError>> {
      if (input.requestId.length === 0) {
        return {
          ok: false,
          error: { code: 'INVALID_INPUT', field: 'requestId' },
        };
      }
      if (input.issuedAt.length === 0) {
        return {
          ok: false,
          error: { code: 'INVALID_INPUT', field: 'issuedAt' },
        };
      }
      if (input.correlationId === '') {
        return {
          ok: false,
          error: { code: 'INVALID_INPUT', field: 'correlationId' },
        };
      }
      if (isCancelled(input.signal)) {
        return { ok: false, error: { code: 'CANCELLED' } };
      }
      if (transport.schemaVersion !== DESKTOP_SCHEMA_VERSION) {
        return {
          ok: false,
          error: {
            code: 'SCHEMA_UNSUPPORTED',
            expected: DESKTOP_SCHEMA_VERSION,
          },
        };
      }
      if (!hasInspectionCapability(transport.capabilities)) {
        return {
          ok: false,
          error: {
            code: 'CAPABILITY_UNAVAILABLE',
            capability: DESKTOP_INSPECTION_CAPABILITY,
          },
        };
      }

      let raw: unknown;
      try {
        raw = await transport.inspectSystem(input);
      } catch {
        return { ok: false, error: { code: 'TRANSPORT_FAILURE' } };
      }
      if (isCancelled(input.signal)) {
        return { ok: false, error: { code: 'CANCELLED' } };
      }

      const envelope = parseEnvelope(raw, input);
      if (!envelope.ok) {
        return envelope;
      }
      const deviceLabel = validateField('deviceLabel', envelope.value.deviceLabel);
      if (!deviceLabel.ok) {
        return deviceLabel;
      }
      const logicalProcessorCount = validateField(
        'logicalProcessorCount',
        envelope.value.logicalProcessorCount,
      );
      if (!logicalProcessorCount.ok) {
        return logicalProcessorCount;
      }
      const totalMemoryBytes = validateField('totalMemoryBytes', envelope.value.totalMemoryBytes);
      if (!totalMemoryBytes.ok) {
        return totalMemoryBytes;
      }

      return {
        ok: true,
        value: Object.freeze({
          inspectionId: envelope.value.inspectionId,
          inspectedAt: envelope.value.inspectedAt,
          deviceLabel: mapDiagnosticValue(deviceLabel.value),
          logicalProcessorCount: mapDiagnosticValue(logicalProcessorCount.value),
          totalMemoryBytes: mapDiagnosticValue(totalMemoryBytes.value),
        }),
      };
    },
  });
};
