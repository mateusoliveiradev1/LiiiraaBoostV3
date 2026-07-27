namespace Liiiraa.Contracts.Desktop.V1;

@minLength(1)
@maxLength(128)
scalar RequestId extends string;

@minLength(1)
@maxLength(128)
scalar CorrelationId extends string;

model MessageEnvelope<TMessageType, TPayload> {
  schemaVersion: "1.0";
  messageType: TMessageType;
  requestId: RequestId;
  correlationId?: CorrelationId;
  issuedAt: utcDateTime;
  payload: TPayload;
}
