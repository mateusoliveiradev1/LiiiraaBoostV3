using TypeSpec.JsonSchema;

namespace Liiiraa.Contracts.Desktop.V1;

@minLength(1)
@maxLength(128)
scalar ProvenanceIdentifier extends string;

@minLength(1)
@maxLength(512)
scalar ProvenanceDescription extends string;

@pattern("^[a-f0-9]{64}$")
scalar Phase6EvidenceSha256 extends string;

@pattern("^managed-power-scheme-v[1-9][0-9]*$")
scalar Phase6OperationVersion extends string;

enum Phase6DeterministicAdmissionStatus {
  superseded: "superseded",
  active: "active",
}

model Phase6EvidenceArtifactReference {
  @minLength(1)
  @maxLength(512)
  path: string;
  sha256: Phase6EvidenceSha256;
}

@jsonSchema
model Phase6DeterministicAdmission {
  status: Phase6DeterministicAdmissionStatus;
  operationVersion: Phase6OperationVersion;
  buildId: ProvenanceIdentifier;
  artifactManifestSha256: Phase6EvidenceSha256;
  runEvidenceId: ProvenanceIdentifier;
  runEvidenceSha256: Phase6EvidenceSha256;
  predecessorEvidenceSha256: Phase6EvidenceSha256 | null;
  successorEvidenceSha256: Phase6EvidenceSha256 | null;
  manifestRecord: Phase6EvidenceArtifactReference | null;
}

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
