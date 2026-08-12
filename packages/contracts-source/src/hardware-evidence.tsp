using TypeSpec.JsonSchema;

namespace Liiiraa.Contracts.Desktop.V1;

@minLength(1)
@maxLength(128)
scalar EvidenceIdentifier extends string;

@minLength(1)
@maxLength(512)
scalar EvidenceText extends string;

@minLength(71)
@maxLength(71)
@pattern("^sha256:[0-9a-f]{64}$")
scalar EvidenceHash extends string;

union EvidenceSchemaVersion {
  v1: "1.0",
}

union SourceCapability {
  nativeReadonly: "native-readonly",
  nativePerformanceCounter: "native-performance-counter",
  windowsManagement: "windows-management",
  directStorageQuery: "direct-storage-query",
  derivedLocalEvidence: "derived-local-evidence",
}

union CancellationState {
  notRequested: "not-requested",
  requested: "requested",
  acknowledged: "acknowledged",
  deadlineExceeded: "deadline-exceeded",
}

union CollectorHealthState {
  healthy: "healthy",
  degraded: "degraded",
  unavailable: "unavailable",
}

union EvidenceQuality {
  valid: "valid",
  degraded: "degraded",
  insufficient: "insufficient",
  invalid: "invalid",
}

union HardwareUnavailableReason {
  notReported: "not-reported",
  notPresent: "not-present",
  permissionDenied: "permission-denied",
  unsupported: "unsupported",
  timedOut: "timed-out",
  cancelled: "cancelled",
  notDiscovered: "not-discovered",
  collectorUnavailable: "collector-unavailable",
}

union MetricKind {
  frameTime: "frame-time-ms",
  cpuUtilization: "cpu-utilization-percent",
  gpuUtilization: "gpu-utilization-percent",
  memoryWorkingSet: "memory-working-set-bytes",
  diskLatency: "disk-latency-ms",
  networkLatency: "network-latency-ms",
}

union MetricUnit {
  milliseconds: "milliseconds",
  percent: "percent",
  bytes: "bytes",
}

union ComparisonBlockerCode {
  hardwareDrift: "hardware-drift",
  workloadDrift: "workload-drift",
  insufficientSamples: "insufficient-samples",
  invalidBefore: "invalid-before",
  invalidAfter: "invalid-after",
  incompatibleMetric: "incompatible-metric",
  unsupportedQuality: "unsupported-quality",
}

union ClaimAdmissionState {
  admitted: "admitted",
  rejected: "rejected",
}

model CollectorHealth {
  state: CollectorHealthState;
  checkedAt: utcDateTime;
  detail: EvidenceText;
}

model CollectorOverhead {
  @minValue(1)
  @maxValue(60000)
  sampleWindowMs: uint32;

  @minValue(0)
  @maxValue(60000)
  cpuTimeMs: uint32;

  @minValue(0)
  peakWorkingSetBytes: uint64;
  quality: EvidenceQuality;
}

model CollectorExecutionContext {
  sourceCapability: SourceCapability;
  deadlineAt: utcDateTime;
  cancellationState: CancellationState;
  health: CollectorHealth;
  overhead: CollectorOverhead;
}

model ObservedHardwareFact {
  state: "observed";
  value: EvidenceText;
  source: EvidenceText;
  observedAt: utcDateTime;
  stableDerivedId?: EvidenceIdentifier;
}

model UnavailableHardwareFact {
  state: "unavailable";
  reasonCode: HardwareUnavailableReason;
  detail: EvidenceText;
}

@oneOf
union HardwareFact {
  observed: ObservedHardwareFact,
  unavailable: UnavailableHardwareFact,
}

model InventorySnapshot {
  kind: "inventory-snapshot";
  schemaVersion: EvidenceSchemaVersion;
  evidenceId: EvidenceIdentifier;

  @minValue(1)
  evidenceVersion: uint32;

  collectedAt: utcDateTime;
  evidenceHash: EvidenceHash;
  execution: CollectorExecutionContext;
  cpu: HardwareFact;
  gpu: HardwareFact;
  memory: HardwareFact;
  storage: HardwareFact;
  network: HardwareFact;
  display: HardwareFact;
  audio: HardwareFact;
  usb: HardwareFact;
  windows: HardwareFact;
  drivers: HardwareFact;
  security: HardwareFact;
  games: HardwareFact;
}

model MeasurementBaseline {
  baselineId: EvidenceIdentifier;
  inventoryEvidenceId: EvidenceIdentifier;
  inventoryEvidenceHash: EvidenceHash;
  capturedAt: utcDateTime;
}

model MetricChunk {
  chunkId: EvidenceIdentifier;

  @minValue(0)
  sequence: uint32;

  startedAt: utcDateTime;
  endedAt: utcDateTime;
  metric: MetricKind;
  unit: MetricUnit;

  @minItems(1)
  @maxItems(4096)
  values: float64[];

  evidenceHash: EvidenceHash;
  quality: EvidenceQuality;
}

model IncompleteMeasurementSession {
  kind: "measurement-session";
  schemaVersion: EvidenceSchemaVersion;
  sessionId: EvidenceIdentifier;

  @minValue(1)
  evidenceVersion: uint32;

  status: "incomplete";
  startedAt: utcDateTime;
  execution: CollectorExecutionContext;
  baseline: MeasurementBaseline;

  @minItems(0)
  @maxItems(256)
  chunks: MetricChunk[];

  reason: EvidenceText;
}

model CompletedMeasurementSession {
  kind: "measurement-session";
  schemaVersion: EvidenceSchemaVersion;
  sessionId: EvidenceIdentifier;

  @minValue(1)
  evidenceVersion: uint32;

  status: "completed";
  startedAt: utcDateTime;
  completedAt: utcDateTime;
  execution: CollectorExecutionContext;
  baseline: MeasurementBaseline;

  @minItems(1)
  @maxItems(256)
  chunks: MetricChunk[];

  evidenceHash: EvidenceHash;

  @minItems(1)
  @maxItems(16)
  limitations: EvidenceText[];
}

model DegradedMeasurementSession {
  kind: "measurement-session";
  schemaVersion: EvidenceSchemaVersion;
  sessionId: EvidenceIdentifier;

  @minValue(1)
  evidenceVersion: uint32;

  status: "degraded";
  startedAt: utcDateTime;
  completedAt: utcDateTime;
  execution: CollectorExecutionContext;
  baseline: MeasurementBaseline;

  @minItems(1)
  @maxItems(256)
  chunks: MetricChunk[];

  evidenceHash: EvidenceHash;

  @minItems(1)
  @maxItems(16)
  limitations: EvidenceText[];

  @minItems(1)
  @maxItems(16)
  qualityIssues: EvidenceText[];
}

model InvalidMeasurementSession {
  kind: "measurement-session";
  schemaVersion: EvidenceSchemaVersion;
  sessionId: EvidenceIdentifier;

  @minValue(1)
  evidenceVersion: uint32;

  status: "invalid";
  startedAt: utcDateTime;
  invalidatedAt: utcDateTime;
  execution: CollectorExecutionContext;
  baseline: MeasurementBaseline;
  reason: EvidenceText;
}

@oneOf
union MeasurementSession {
  incomplete: IncompleteMeasurementSession,
  completed: CompletedMeasurementSession,
  degraded: DegradedMeasurementSession,
  invalid: InvalidMeasurementSession,
}

model ComparisonProjection {
  metric: MetricKind;
  unit: MetricUnit;
  before: float64;
  after: float64;
  delta: float64;
  quality: EvidenceQuality;
  evidenceHash: EvidenceHash;
}

model AcceptedComparison {
  kind: "comparison";
  schemaVersion: EvidenceSchemaVersion;
  comparisonId: EvidenceIdentifier;
  state: "accepted";
  beforeSessionId: EvidenceIdentifier;
  afterSessionId: EvidenceIdentifier;
  comparedAt: utcDateTime;
  acceptedResult: ComparisonProjection;
}

model RejectedComparison {
  kind: "comparison";
  schemaVersion: EvidenceSchemaVersion;
  comparisonId: EvidenceIdentifier;
  state: "rejected";
  beforeSessionId: EvidenceIdentifier;
  afterSessionId: EvidenceIdentifier;
  comparedAt: utcDateTime;

  @minItems(1)
  @maxItems(8)
  @uniqueItems
  blockers: ComparisonBlockerCode[];
}

@oneOf
union EvidenceComparison {
  accepted: AcceptedComparison,
  rejected: RejectedComparison,
}

model EvidenceProvenance {
  source: EvidenceText;
  collectedAt: utcDateTime;
}

model EvidenceReport {
  kind: "evidence-report";
  schemaVersion: EvidenceSchemaVersion;
  reportId: EvidenceIdentifier;

  @minValue(1)
  evidenceVersion: uint32;

  generatedAt: utcDateTime;

  @minItems(1)
  @maxItems(128)
  @uniqueItems
  evidenceIds: EvidenceIdentifier[];

  @minItems(1)
  @maxItems(128)
  @uniqueItems
  evidenceHashes: EvidenceHash[];

  provenance: EvidenceProvenance;

  @minItems(1)
  @maxItems(32)
  limitations: EvidenceText[];
}

model ClaimAdmission {
  kind: "claim-admission";
  schemaVersion: EvidenceSchemaVersion;
  claimId: EvidenceIdentifier;
  claim: EvidenceText;
  state: ClaimAdmissionState;

  @minItems(1)
  @maxItems(64)
  @uniqueItems
  evidenceIds: EvidenceIdentifier[];

  @minItems(1)
  @maxItems(64)
  @uniqueItems
  evidenceHashes: EvidenceHash[];

  provenance: EvidenceProvenance;

  @minItems(1)
  @maxItems(16)
  limitations: EvidenceText[];
}

@jsonSchema
@oneOf
union HardwareEvidenceDocument {
  inventory: InventorySnapshot,
  session: MeasurementSession,
  comparison: EvidenceComparison,
  report: EvidenceReport,
  claim: ClaimAdmission,
}
