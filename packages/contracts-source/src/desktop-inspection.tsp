using TypeSpec.JsonSchema;

namespace Liiiraa.Contracts.Desktop.V1;

@minLength(1)
@maxLength(128)
scalar InspectionId extends string;

model InspectSystemRequestPayload {
  scope: "summary";
}

model InspectSystemResultPayload {
  inspectionId: InspectionId;
  inspectedAt: utcDateTime;
  deviceLabel: DiagnosticValue;
  logicalProcessorCount: DiagnosticValue;
  totalMemoryBytes: DiagnosticValue;
}

@jsonSchema
model InspectSystemRequest
  is MessageEnvelope<"desktop.inspect-system.request", InspectSystemRequestPayload>;

@jsonSchema
model InspectSystemResult
  is MessageEnvelope<"desktop.inspect-system.result", InspectSystemResultPayload>;
