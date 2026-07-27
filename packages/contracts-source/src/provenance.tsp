using TypeSpec.JsonSchema;

namespace Liiiraa.Contracts.Desktop.V1;

@minLength(1)
@maxLength(128)
scalar ProvenanceIdentifier extends string;

@minLength(1)
@maxLength(512)
scalar ProvenanceDescription extends string;

union DiagnosticPrimitive {
  string,
  int32,
  float64,
  boolean,
}

model FixtureDiagnosticValue {
  kind: "fixture";
  value: DiagnosticPrimitive;
  scenarioId: ProvenanceIdentifier;
  fixtureVersion: ProvenanceIdentifier;
}

model ObservedDiagnosticValue {
  kind: "observed";
  value: DiagnosticPrimitive;
  source: ProvenanceDescription;
  observedAt: utcDateTime;
}

model MeasuredDiagnosticValue {
  kind: "measured";
  value: DiagnosticPrimitive;
  method: ProvenanceDescription;
  measuredAt: utcDateTime;
  quality: "valid" | "degraded" | "insufficient";
}

model ModeledDiagnosticValue {
  kind: "modeled";
  value: DiagnosticPrimitive;
  modelId: ProvenanceIdentifier;

  @minValue(0)
  @maxValue(1)
  confidence: float32;

  @minItems(1)
  @maxItems(16)
  assumptions: ProvenanceDescription[];
}

model UnavailableDiagnosticValue {
  kind: "unavailable";
  reason: ProvenanceDescription;
}

@jsonSchema
@oneOf
union DiagnosticValue {
  fixture: FixtureDiagnosticValue,
  observed: ObservedDiagnosticValue,
  measured: MeasuredDiagnosticValue,
  modeled: ModeledDiagnosticValue,
  unavailable: UnavailableDiagnosticValue,
}
