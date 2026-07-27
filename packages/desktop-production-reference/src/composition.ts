import type {
  DesktopClientIdentity,
  DesktopInspectionClient,
  DesktopInspectionError,
  InspectSystemInput,
  NativeDiagnosticValue,
  NativeSystemInspection,
  Result,
} from '@liiiraa/desktop-client';

import {
  createProductionUnavailableClient,
  type ProductionUnavailableOptions,
} from './unavailable-client.js';

export type ProductionDiagnosticValue =
  | Extract<NativeDiagnosticValue, Readonly<{ kind: 'observed' }>>
  | Extract<NativeDiagnosticValue, Readonly<{ kind: 'measured' }>>
  | Extract<NativeDiagnosticValue, Readonly<{ kind: 'modeled' }>>
  | Extract<NativeDiagnosticValue, Readonly<{ kind: 'unavailable' }>>;

export interface ProductionSystemInspection extends Omit<
  NativeSystemInspection,
  'deviceLabel' | 'logicalProcessorCount' | 'totalMemoryBytes'
> {
  readonly deviceLabel: ProductionDiagnosticValue;
  readonly logicalProcessorCount: ProductionDiagnosticValue;
  readonly totalMemoryBytes: ProductionDiagnosticValue;
}

export interface ProductionDesktopClientIdentity extends DesktopClientIdentity {
  readonly adapterId: 'liiiraa-desktop-production-unavailable';
}

export interface ProductionDesktopInspectionClient extends Omit<
  DesktopInspectionClient,
  'identity' | 'inspectSystem'
> {
  readonly identity: ProductionDesktopClientIdentity;
  inspectSystem(
    input: InspectSystemInput,
  ): Promise<Result<ProductionSystemInspection, DesktopInspectionError>>;
}

export interface ProductionDesktopComposition {
  readonly mode: 'production';
  readonly client: ProductionDesktopInspectionClient;
}

export const createProductionDesktopComposition = (
  options: ProductionUnavailableOptions,
): ProductionDesktopComposition =>
  Object.freeze({
    mode: 'production',
    client: createProductionUnavailableClient(options),
  });
