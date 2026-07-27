import "@typespec/json-schema";

using TypeSpec.JsonSchema;

model SystemProvenance {
  kind: "system";
  @minLength(1)
  component: string;
}

model BenchmarkProvenance {
  kind: "benchmark";
  @minLength(1)
  benchmarkId: string;
}

model UserProvenance {
  kind: "user";
  @minLength(1)
  userId: string;
}

model ProfileProvenance {
  kind: "profile";
  @minLength(1)
  profileId: string;
}

model AiProvenance {
  kind: "ai";
  @minLength(1)
  modelId: string;
}

@discriminator("kind")
union Provenance {
  system: SystemProvenance,
  benchmark: BenchmarkProvenance,
  user: UserProvenance,
  profile: ProfileProvenance,
  ai: AiProvenance,
}

model EnvelopeMetadata {
  @minLength(1)
  correlationId: string;
  @minLength(1)
  createdAt: string;
  provenance: Provenance;
}

model SpikePayload {
  @minValue(0)
  @maxValue(100)
  confidence: int32;

  @minItems(1)
  @maxItems(3)
  samples: int32[];
}

model VersionedEnvelope<TKind, TPayload> {
  version: "1";
  kind: TKind;
  metadata: EnvelopeMetadata;
  payload: TPayload;
}

@jsonSchema
model SpikeEnvelope is VersionedEnvelope<"spike", SpikePayload>;
