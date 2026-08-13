using TypeSpec.JsonSchema;

namespace Liiiraa.Contracts.Desktop.V1;

@minLength(1)
@maxLength(128)
scalar TransactionIdentifier extends string;

@minLength(1)
@maxLength(512)
scalar TransactionText extends string;

@minLength(71)
@maxLength(71)
@pattern("^sha256:[0-9a-f]{64}$")
scalar TransactionHash extends string;

@minLength(36)
@maxLength(36)
@pattern("^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$")
scalar WindowsSchemeIdentifier extends string;

union TransactionSchemaVersion {
  v1: "1.0",
}

union RiskClass {
  verified: "verified",
  advanced: "advanced",
  experimental: "experimental",
  extremeLocked: "extreme-locked",
}

union PlanLifecycleState {
  composed: "composed",
  awaitingApproval: "awaiting-approval",
  approved: "approved",
  applying: "applying",
  paused: "paused",
  awaitingRestart: "awaiting-restart",
  recovering: "recovering",
  completed: "completed",
  restored: "restored",
  blocked: "blocked",
}

union CompatibilityVerdict {
  compatible: "compatible",
  incompatible: "incompatible",
  unknownVerdict: "unknown",
  degraded: "degraded",
}

union RestartEffect {
  none: "none",
  recommended: "recommended",
  required: "required",
}

union RecoveryMethod {
  exactPriorScheme: "exact-prior-scheme",
  ownedSchemeRemoval: "owned-scheme-removal",
  systemRestoreComplement: "system-restore-complement",
}

union TransactionIntent {
  apply: "apply",
  restoreOperation: "restore-operation",
  restorePlan: "restore-plan",
  restoreCheckpoint: "restore-checkpoint",
  retryAfterObservation: "retry-after-observation",
}

union PromotionStage {
  deterministicSimulation: "deterministic-simulation",
  cleanWindowsVm: "clean-windows-vm",
  ownerPc: "owner-pc",
  friendsPc: "friends-pc",
}

union PromotionVerdict {
  pending: "pending",
  passed: "passed",
  failed: "failed",
  blocked: "blocked",
  revoked: "revoked",
}

union RecoveryCoverage {
  ready: "ready",
  partial: "partial",
  unavailable: "unavailable",
  failed: "failed",
}

union ProgressState {
  queued: "queued",
  preparing: "preparing",
  applying: "applying",
  observing: "observing",
  verifying: "verifying",
  awaitingRestart: "awaiting-restart",
  paused: "paused",
  recovering: "recovering",
  completed: "completed",
  blocked: "blocked",
}

union BrokerOutcome {
  observed: "observed",
  accepted: "accepted",
  rejected: "rejected",
  unavailable: "unavailable",
}

union AdvancedPreferenceState {
  disabled: "disabled",
  enabled: "enabled",
  revalidationRequired: "revalidation-required",
}

union AdvancedPreferenceIntentKind {
  enable: "enable",
  revoke: "revoke",
  postureInvalidate: "posture-invalidate",
  revalidate: "revalidate",
}

union AdvancedPreferenceEventKind {
  enabled: "enabled",
  revoked: "revoked",
  postureInvalidated: "posture-invalidated",
  revalidated: "revalidated",
}

model AuditReference {
  auditId: TransactionIdentifier;
  recordedAt: utcDateTime;
}

model DeviceAuthorityBinding {
  deviceBindingId: TransactionIdentifier;
  hardwareFingerprint: TransactionHash;
  securityPostureFingerprint: TransactionHash;
}

model ActionProofReference {
  proofReference: TransactionIdentifier;
  action: TransactionText;
  issuedAt: utcDateTime;
  expiresAt: utcDateTime;
}

model EvidenceReference {
  evidenceId: EvidenceIdentifier;
  evidenceHash: EvidenceHash;
  capturedAt: utcDateTime;
  validUntil: utcDateTime;
  quality: EvidenceQuality;
}

model ExactPowerSchemeState {
  state: "observed";
  schemeId: WindowsSchemeIdentifier;
  canonicalStateHash: TransactionHash;
  observedAt: utcDateTime;
}

model UnavailablePowerSchemeState {
  state: "unavailable";
  reason: TransactionText;
  observedAt: utcDateTime;
}

model UnknownPowerSchemeState {
  state: "unknown";
  reason: TransactionText;
  observedAt: utcDateTime;
}

@oneOf
union ExactOperationState {
  observed: ExactPowerSchemeState,
  unavailable: UnavailablePowerSchemeState,
  unknownState: UnknownPowerSchemeState,
}

model CompatibilityAssessment {
  verdict: CompatibilityVerdict;

  @minItems(1)
  @maxItems(16)
  reasons: TransactionText[];
}

model DependencyGroup {
  dependencyGroupId: TransactionIdentifier;

  @minItems(1)
  @maxItems(64)
  @uniqueItems
  operationVersionIds: TransactionIdentifier[];

  @minItems(0)
  @maxItems(16)
  @uniqueItems
  dependsOnGroupIds: TransactionIdentifier[];
}

model PlanOperation {
  operationVersionId: TransactionIdentifier;
  operationKind: "managed-power-scheme-v1";
  purpose: TransactionText;
  expectedImpact: TransactionText;
  risk: RiskClass;

  @minItems(1)
  @maxItems(16)
  evidence: EvidenceReference[];

  compatibility: CompatibilityAssessment;
  restartEffect: RestartEffect;
  previousValue: ExactOperationState;
  requestedValue: ExactOperationState;
  recoveryMethod: RecoveryMethod;
  dependencyGroupId: TransactionIdentifier;
}

model TransactionalPlanDocument {
  kind: "transactional-plan";
  schemaVersion: TransactionSchemaVersion;
  planId: TransactionIdentifier;

  @minValue(1)
  revision: uint32;

  revisionFingerprint: TransactionHash;
  evidenceFingerprint: TransactionHash;
  device: DeviceAuthorityBinding;
  lifecycle: PlanLifecycleState;
  riskCeiling: RiskClass;
  effectiveRisk: RiskClass;
  createdAt: utcDateTime;

  @minItems(1)
  @maxItems(64)
  operations: PlanOperation[];

  @minItems(1)
  @maxItems(32)
  dependencyGroups: DependencyGroup[];
}

model PlanApprovalDocument {
  kind: "plan-approval";
  schemaVersion: TransactionSchemaVersion;
  approvalId: TransactionIdentifier;
  planId: TransactionIdentifier;

  @minValue(1)
  planRevision: uint32;

  revisionFingerprint: TransactionHash;
  evidenceFingerprint: TransactionHash;
  device: DeviceAuthorityBinding;
  approvedRisk: RiskClass;
  compatibility: CompatibilityVerdict;
  recoveryCoverage: RecoveryCoverage;
  intent: TransactionIntent;
  proof: ActionProofReference;
  approvedAt: utcDateTime;
  audit: AuditReference;

  @minItems(1)
  @maxItems(64)
  @uniqueItems
  operationVersionIds: TransactionIdentifier[];
}

model PlanTransactionDocument {
  kind: "plan-transaction";
  schemaVersion: TransactionSchemaVersion;
  transactionId: TransactionIdentifier;
  planId: TransactionIdentifier;

  @minValue(1)
  planRevision: uint32;

  revisionFingerprint: TransactionHash;
  approvalId: TransactionIdentifier;
  intent: TransactionIntent;
  startedAt: utcDateTime;
  parentTransactionId?: TransactionIdentifier;
  audit: AuditReference;
}

model RecoveryCheckpointDocument {
  kind: "recovery-checkpoint";
  schemaVersion: TransactionSchemaVersion;
  checkpointId: TransactionIdentifier;
  transactionId: TransactionIdentifier;
  planId: TransactionIdentifier;
  createdAt: utcDateTime;
  coverage: RecoveryCoverage;
  exactPriorState: ExactOperationState;
  restartRequired: boolean;
  restorePointSequence?: uint64;
  restorePointStatus?: TransactionText;
  audit: AuditReference;
}

model JournalEventBase {
  kind: "journal-event";
  schemaVersion: TransactionSchemaVersion;
  eventId: TransactionIdentifier;
  transactionId: TransactionIdentifier;
  operationVersionId: TransactionIdentifier;

  @minValue(0)
  sequence: uint64;

  occurredAt: utcDateTime;
  previousEventHash: TransactionHash;
  eventHash: TransactionHash;
  audit: AuditReference;
}

model PreparedJournalEvent {
  ...JournalEventBase;
  state: "prepared";
  exactPriorState: ExactOperationState;
  exactRequestedState: ExactOperationState;
  recoveryMethod: RecoveryMethod;
}

model DispatchReturnedJournalEvent {
  ...JournalEventBase;
  state: "dispatch-returned";
  brokerRequestId: TransactionIdentifier;
  brokerResponseId: TransactionIdentifier;
  outcome: BrokerOutcome;
}

model ObservedJournalEvent {
  ...JournalEventBase;
  state: "observed";
  exactObservedState: ExactOperationState;
}

model VerifiedJournalEvent {
  ...JournalEventBase;
  state: "verified";
  exactPriorState: ExactOperationState;
  exactRequestedState: ExactOperationState;
  exactObservedState: ExactOperationState;
}

model NotAppliedJournalEvent {
  ...JournalEventBase;
  state: "not-applied";
  exactPriorState: ExactOperationState;
  exactRequestedState: ExactOperationState;
  exactObservedState: ExactOperationState;
}

model UnknownJournalEvent {
  ...JournalEventBase;
  state: "unknown";
  exactPriorState: ExactOperationState;
  exactRequestedState: ExactOperationState;
  exactObservedState: ExactOperationState;
  reason: TransactionText;
}

model DriftJournalEvent {
  ...JournalEventBase;
  state: "drift";
  exactPriorState: ExactOperationState;
  exactRequestedState: ExactOperationState;
  exactObservedState: ExactOperationState;
  differenceSummary: TransactionText;
}

model ConflictJournalEvent {
  ...JournalEventBase;
  state: "conflict";
  exactPriorState: ExactOperationState;
  exactRequestedState: ExactOperationState;
  exactObservedState: ExactOperationState;
  differenceSummary: TransactionText;
}

model RestorePreparedJournalEvent {
  ...JournalEventBase;
  state: "restore-prepared";
  exactAppliedState: ExactOperationState;
  exactRestoreTargetState: ExactOperationState;
  recoveryMethod: RecoveryMethod;
}

model RestoredJournalEvent {
  ...JournalEventBase;
  state: "restored";
  exactPriorState: ExactOperationState;
  exactRequestedState: ExactOperationState;
  exactObservedState: ExactOperationState;
}

@oneOf
union DurableJournalEvent {
  prepared: PreparedJournalEvent,
  dispatchReturned: DispatchReturnedJournalEvent,
  observed: ObservedJournalEvent,
  verified: VerifiedJournalEvent,
  notApplied: NotAppliedJournalEvent,
  unknownOutcome: UnknownJournalEvent,
  drift: DriftJournalEvent,
  conflict: ConflictJournalEvent,
  restorePrepared: RestorePreparedJournalEvent,
  restored: RestoredJournalEvent,
}

model VerificationReceipt {
  state: "verified";
  verifiedAt: utcDateTime;
  exactObservedState: ExactOperationState;
}

model TransactionReceiptDocument {
  kind: "transaction-receipt";
  schemaVersion: TransactionSchemaVersion;
  receiptId: TransactionIdentifier;
  transactionId: TransactionIdentifier;
  planId: TransactionIdentifier;
  operationVersionId: TransactionIdentifier;
  completedAt: utcDateTime;
  exactPriorState: ExactOperationState;
  exactRequestedState: ExactOperationState;
  exactObservedState: ExactOperationState;
  verification: VerificationReceipt;
  recoveryMethod: RecoveryMethod;
  journalHeadHash: TransactionHash;
  humanSummary: TransactionText;
  technicalSummary: TransactionText;
  audit: AuditReference;
}

model ProgressSnapshotDocument {
  kind: "progress-snapshot";
  schemaVersion: TransactionSchemaVersion;
  transactionId: TransactionIdentifier;

  @minValue(0)
  sequence: uint64;

  state: ProgressState;
  completedOperations: uint32;
  totalOperations: uint32;
  currentOperationVersionId?: TransactionIdentifier;
  updatedAt: utcDateTime;
  displayText: TransactionText;
}

model ProgressEventDocument {
  kind: "progress-event";
  schemaVersion: TransactionSchemaVersion;
  eventId: TransactionIdentifier;
  transactionId: TransactionIdentifier;

  @minValue(0)
  sequence: uint64;

  state: ProgressState;
  occurredAt: utcDateTime;
  operationVersionId?: TransactionIdentifier;
  displayText: TransactionText;
}

model PromotionEvidenceReference {
  evidenceId: EvidenceIdentifier;
  evidenceHash: EvidenceHash;
  capturedAt: utcDateTime;
}

model OperationPromotionDocument {
  kind: "operation-promotion";
  schemaVersion: TransactionSchemaVersion;
  promotionId: TransactionIdentifier;
  operationVersionId: TransactionIdentifier;
  stage: PromotionStage;
  verdict: PromotionVerdict;

  @minItems(1)
  @maxItems(64)
  evidence: PromotionEvidenceReference[];

  recordedAt: utcDateTime;
  audit: AuditReference;
}

model SignedOperationRevocationDocument {
  kind: "operation-revocation";
  schemaVersion: TransactionSchemaVersion;
  revocationId: TransactionIdentifier;
  operationVersionId: TransactionIdentifier;
  reason: TransactionText;
  issuedAt: utcDateTime;
  signatureKeyId: TransactionIdentifier;
  signedPayloadHash: TransactionHash;
  signature: TransactionIdentifier;
  recoveryRemainsAvailable: true;
  audit: AuditReference;
}

model ObservePowerSchemeRequest {
  kind: "observe-power-scheme-request";
  schemaVersion: TransactionSchemaVersion;
  requestId: TransactionIdentifier;
  deviceBindingId: TransactionIdentifier;
  issuedAt: utcDateTime;
  nonce: TransactionIdentifier;

  @minValue(0)
  counter: uint64;
}

model DuplicateManagedPowerSchemeRequest {
  kind: "duplicate-managed-power-scheme-request";
  schemaVersion: TransactionSchemaVersion;
  requestId: TransactionIdentifier;
  deviceBindingId: TransactionIdentifier;
  sourceSchemeId: WindowsSchemeIdentifier;
  destinationSchemeId: WindowsSchemeIdentifier;
  friendlyName: "Liiiraa Verificado";
  issuedAt: utcDateTime;
  nonce: TransactionIdentifier;

  @minValue(0)
  counter: uint64;
}

model ActivateManagedPowerSchemeRequest {
  kind: "activate-managed-power-scheme-request";
  schemaVersion: TransactionSchemaVersion;
  requestId: TransactionIdentifier;
  deviceBindingId: TransactionIdentifier;
  schemeId: WindowsSchemeIdentifier;
  expectedCurrentSchemeId: WindowsSchemeIdentifier;
  issuedAt: utcDateTime;
  nonce: TransactionIdentifier;

  @minValue(0)
  counter: uint64;
}

model DeleteOwnedPowerSchemeRequest {
  kind: "delete-owned-power-scheme-request";
  schemaVersion: TransactionSchemaVersion;
  requestId: TransactionIdentifier;
  deviceBindingId: TransactionIdentifier;
  schemeId: WindowsSchemeIdentifier;
  expectedCanonicalStateHash: TransactionHash;
  issuedAt: utcDateTime;
  nonce: TransactionIdentifier;

  @minValue(0)
  counter: uint64;
}

model PrepareRestorePointRequest {
  kind: "prepare-restore-point-request";
  schemaVersion: TransactionSchemaVersion;
  requestId: TransactionIdentifier;
  deviceBindingId: TransactionIdentifier;
  transactionId: TransactionIdentifier;
  displaySummary: TransactionText;
  issuedAt: utcDateTime;
  nonce: TransactionIdentifier;

  @minValue(0)
  counter: uint64;
}

@oneOf
union PrivilegedBrokerRequest {
  observePowerScheme: ObservePowerSchemeRequest,
  duplicateManagedPowerScheme: DuplicateManagedPowerSchemeRequest,
  activateManagedPowerScheme: ActivateManagedPowerSchemeRequest,
  deleteOwnedPowerScheme: DeleteOwnedPowerSchemeRequest,
  prepareRestorePoint: PrepareRestorePointRequest,
}

model BrokerObservationResponse {
  kind: "broker-observation-response";
  schemaVersion: TransactionSchemaVersion;
  responseId: TransactionIdentifier;
  requestId: TransactionIdentifier;
  outcome: "observed";
  exactObservedState: ExactOperationState;
  completedAt: utcDateTime;
}

model BrokerAcceptedResponse {
  kind: "broker-accepted-response";
  schemaVersion: TransactionSchemaVersion;
  responseId: TransactionIdentifier;
  requestId: TransactionIdentifier;
  outcome: "accepted";
  completedAt: utcDateTime;
}

model BrokerRejectedResponse {
  kind: "broker-rejected-response";
  schemaVersion: TransactionSchemaVersion;
  responseId: TransactionIdentifier;
  requestId: TransactionIdentifier;
  outcome: "rejected";
  reasonCode: TransactionIdentifier;
  completedAt: utcDateTime;
}

model BrokerUnavailableResponse {
  kind: "broker-unavailable-response";
  schemaVersion: TransactionSchemaVersion;
  responseId: TransactionIdentifier;
  requestId: TransactionIdentifier;
  outcome: "unavailable";
  reasonCode: TransactionIdentifier;
  completedAt: utcDateTime;
}

@oneOf
union PrivilegedBrokerResponse {
  observation: BrokerObservationResponse,
  accepted: BrokerAcceptedResponse,
  rejected: BrokerRejectedResponse,
  unavailable: BrokerUnavailableResponse,
}

model RedactedDiagnosticEntry {
  eventId: TransactionIdentifier;
  transactionId: TransactionIdentifier;
  operationVersionId: TransactionIdentifier;
  state: ProgressState;
  occurredAt: utcDateTime;
  reasonCode?: TransactionIdentifier;
  eventHash: TransactionHash;
}

model RedactedDiagnosticExportDocument {
  kind: "redacted-diagnostic-export";
  schemaVersion: TransactionSchemaVersion;
  exportId: TransactionIdentifier;
  planId: TransactionIdentifier;
  generatedAt: utcDateTime;
  journalHeadHash: TransactionHash;

  @minItems(1)
  @maxItems(512)
  entries: RedactedDiagnosticEntry[];

  @minItems(1)
  @maxItems(32)
  redactionsApplied: TransactionIdentifier[];

  audit: AuditReference;
}

model AdvancedPreferenceProjectionDocument {
  kind: "advanced-preference-projection";
  schemaVersion: TransactionSchemaVersion;
  preferenceId: TransactionIdentifier;
  device: DeviceAuthorityBinding;
  state: AdvancedPreferenceState;

  @minValue(0)
  sequence: uint64;

  lastEventId: TransactionIdentifier;
  updatedAt: utcDateTime;
  audit: AuditReference;
}

model AdvancedPreferenceIntentDocument {
  kind: "advanced-preference-intent";
  schemaVersion: TransactionSchemaVersion;
  intentId: TransactionIdentifier;
  preferenceId: TransactionIdentifier;
  device: DeviceAuthorityBinding;
  intent: AdvancedPreferenceIntentKind;
  proof: ActionProofReference;

  @minValue(0)
  expectedSequence: uint64;

  requestedAt: utcDateTime;
  audit: AuditReference;
}

model AdvancedPreferenceEventDocument {
  kind: "advanced-preference-event";
  schemaVersion: TransactionSchemaVersion;
  eventId: TransactionIdentifier;
  preferenceId: TransactionIdentifier;
  device: DeviceAuthorityBinding;
  event: AdvancedPreferenceEventKind;
  proof: ActionProofReference;

  @minValue(0)
  sequence: uint64;

  occurredAt: utcDateTime;
  audit: AuditReference;
}

@jsonSchema
@oneOf
union TransactionalRecoveryDocument {
  plan: TransactionalPlanDocument,
  approval: PlanApprovalDocument,
  transaction: PlanTransactionDocument,
  checkpoint: RecoveryCheckpointDocument,
  journal: DurableJournalEvent,
  receipt: TransactionReceiptDocument,
  progressSnapshot: ProgressSnapshotDocument,
  progressEvent: ProgressEventDocument,
  promotion: OperationPromotionDocument,
  revocation: SignedOperationRevocationDocument,
  brokerRequest: PrivilegedBrokerRequest,
  brokerResponse: PrivilegedBrokerResponse,
  diagnosticExport: RedactedDiagnosticExportDocument,
  advancedPreference: AdvancedPreferenceProjectionDocument,
  advancedPreferenceIntent: AdvancedPreferenceIntentDocument,
  advancedPreferenceEvent: AdvancedPreferenceEventDocument,
}
