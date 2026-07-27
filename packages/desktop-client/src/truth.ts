import type { DiagnosticPrimitiveJson, DiagnosticValueJson } from '@liiiraa/contracts-ts';

export type NativeDiagnosticValue =
  | Readonly<{
      kind: 'fixture';
      value: DiagnosticPrimitiveJson;
      provenance: Readonly<{
        scenarioId: string;
        fixtureVersion: string;
      }>;
    }>
  | Readonly<{
      kind: 'observed';
      value: DiagnosticPrimitiveJson;
      provenance: Readonly<{
        source: string;
        observedAt: string;
      }>;
    }>
  | Readonly<{
      kind: 'measured';
      value: DiagnosticPrimitiveJson;
      provenance: Readonly<{
        method: string;
        measuredAt: string;
        quality: 'valid' | 'degraded' | 'insufficient';
      }>;
    }>
  | Readonly<{
      kind: 'modeled';
      value: DiagnosticPrimitiveJson;
      provenance: Readonly<{
        modelId: string;
        confidence: number;
        assumptions: readonly string[];
      }>;
    }>
  | Readonly<{
      kind: 'unavailable';
      provenance: Readonly<{
        reason: string;
      }>;
    }>;

export interface NativeSystemInspection {
  readonly inspectionId: string;
  readonly inspectedAt: string;
  readonly deviceLabel: NativeDiagnosticValue;
  readonly logicalProcessorCount: NativeDiagnosticValue;
  readonly totalMemoryBytes: NativeDiagnosticValue;
}

const freeze = <Value extends object>(value: Value): Readonly<Value> => Object.freeze(value);

export const mapDiagnosticValue = (transport: DiagnosticValueJson): NativeDiagnosticValue => {
  switch (transport.kind) {
    case 'fixture':
      return freeze({
        kind: transport.kind,
        value: transport.value,
        provenance: freeze({
          scenarioId: transport.scenarioId,
          fixtureVersion: transport.fixtureVersion,
        }),
      });
    case 'observed':
      return freeze({
        kind: transport.kind,
        value: transport.value,
        provenance: freeze({
          source: transport.source,
          observedAt: transport.observedAt,
        }),
      });
    case 'measured':
      return freeze({
        kind: transport.kind,
        value: transport.value,
        provenance: freeze({
          method: transport.method,
          measuredAt: transport.measuredAt,
          quality: transport.quality,
        }),
      });
    case 'modeled':
      return freeze({
        kind: transport.kind,
        value: transport.value,
        provenance: freeze({
          modelId: transport.modelId,
          confidence: transport.confidence,
          assumptions: freeze([...transport.assumptions]),
        }),
      });
    case 'unavailable':
      return freeze({
        kind: transport.kind,
        provenance: freeze({
          reason: transport.reason,
        }),
      });
  }
};
