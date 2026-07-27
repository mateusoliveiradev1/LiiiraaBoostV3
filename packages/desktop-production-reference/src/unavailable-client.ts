import {
  DESKTOP_INSPECTION_CAPABILITY,
  DESKTOP_SCHEMA_VERSION,
  type DesktopInspectionClient,
  type DesktopInspectionError,
  type InspectSystemInput,
  type NativeDiagnosticValue,
  type NativeSystemInspection,
  type Result,
} from '@liiiraa/desktop-client';

export interface ProductionUnavailableOptions {
  readonly clock: () => string;
  readonly inspectionIds: () => string;
}

const unavailable = (reason: string): NativeDiagnosticValue =>
  Object.freeze({
    kind: 'unavailable',
    provenance: Object.freeze({ reason }),
  });

const invalidInput = (
  field: 'requestId' | 'issuedAt' | 'correlationId',
): Result<never, DesktopInspectionError> =>
  Object.freeze({
    ok: false,
    error: Object.freeze({ code: 'INVALID_INPUT', field }),
  });

const cancelled = (): Result<never, DesktopInspectionError> =>
  Object.freeze({
    ok: false,
    error: Object.freeze({ code: 'CANCELLED' }),
  });

const validateInput = (
  input: InspectSystemInput,
): Result<undefined, DesktopInspectionError> => {
  if (input.requestId.length === 0) {
    return invalidInput('requestId');
  }

  if (input.issuedAt.length === 0) {
    return invalidInput('issuedAt');
  }

  if (input.correlationId === '') {
    return invalidInput('correlationId');
  }

  if (input.signal?.aborted === true) {
    return cancelled();
  }

  return Object.freeze({ ok: true, value: undefined });
};

export const createProductionUnavailableClient = (
  options: ProductionUnavailableOptions,
): DesktopInspectionClient =>
  Object.freeze({
    identity: Object.freeze({
      adapterId: 'liiiraa-desktop-production-unavailable',
      adapterVersion: '1.0.0',
    }),
    schemaVersion: DESKTOP_SCHEMA_VERSION,
    capabilities: Object.freeze([DESKTOP_INSPECTION_CAPABILITY]),
    inspectSystem(
      input: InspectSystemInput,
    ): Promise<Result<NativeSystemInspection, DesktopInspectionError>> {
      const validation = validateInput(input);

      if (!validation.ok) {
        return Promise.resolve(validation);
      }

      const value: NativeSystemInspection = Object.freeze({
        inspectionId: options.inspectionIds(),
        inspectedAt: options.clock(),
        deviceLabel: unavailable(
          'Native device identity inspection is not connected in this build',
        ),
        logicalProcessorCount: unavailable(
          'Native processor inspection is not connected in this build',
        ),
        totalMemoryBytes: unavailable(
          'Native memory inspection is not connected in this build',
        ),
      });

      return Promise.resolve(Object.freeze({ ok: true, value }));
    },
  });
