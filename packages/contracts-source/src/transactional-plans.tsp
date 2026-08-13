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
  sequence: uint32;

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
  sequence: uint32;

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
  sequence: uint32;

  previousSequence?: uint32;

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

model PromotionDocumentBase {
  kind: "operation-promotion";
  schemaVersion: TransactionSchemaVersion;
  promotionId: TransactionIdentifier;
  operationVersionId: TransactionIdentifier;
  verdict: PromotionVerdict;

  @minItems(1)
  @maxItems(64)
  evidence: PromotionEvidenceReference[];

  recordedAt: utcDateTime;
  audit: AuditReference;
}

model SimulationPromotionDocument {
  ...PromotionDocumentBase;
  stage: "deterministic-simulation";
}

model VmPromotionDocument {
  ...PromotionDocumentBase;
  stage: "clean-windows-vm";
  previousStage: "deterministic-simulation";
  previousPromotionId: TransactionIdentifier;
}

model OwnerPromotionDocument {
  ...PromotionDocumentBase;
  stage: "owner-pc";
  previousStage: "clean-windows-vm";
  previousPromotionId: TransactionIdentifier;
}

model FriendsPromotionDocument {
  ...PromotionDocumentBase;
  stage: "friends-pc";
  previousStage: "owner-pc";
  previousPromotionId: TransactionIdentifier;
}

@oneOf
union OperationPromotionDocument {
  simulation: SimulationPromotionDocument,
  vm: VmPromotionDocument,
  owner: OwnerPromotionDocument,
  friends: FriendsPromotionDocument,
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
  counter: uint32;
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
  counter: uint32;
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
  counter: uint32;
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
  counter: uint32;
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
  counter: uint32;
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
  sequence: uint32;

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
  expectedSequence: uint32;

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
  sequence: uint32;

  occurredAt: utcDateTime;
  audit: AuditReference;
}

@minLength(40)
@maxLength(40)
@pattern("^[0-9a-f]{40}$")
scalar PhysicalSourceCommit extends string;

@minLength(1)
@maxLength(64)
@pattern("^[0-9A-Za-z][0-9A-Za-z.+-]*$")
scalar PhysicalVersion extends string;

@minLength(9)
@maxLength(9)
@pattern("^friend-[0-9]{2}$")
scalar PhysicalMachineSlot extends string;

@minValue(0)
@maxValue(0)
scalar PhysicalSequence0 extends uint32;

@minValue(1)
@maxValue(1)
scalar PhysicalSequence1 extends uint32;

@minValue(2)
@maxValue(2)
scalar PhysicalSequence2 extends uint32;

@minValue(3)
@maxValue(3)
scalar PhysicalSequence3 extends uint32;

@minValue(4)
@maxValue(4)
scalar PhysicalSequence4 extends uint32;

@minValue(5)
@maxValue(5)
scalar PhysicalSequence5 extends uint32;

union InstalledFileRole {
  desktop: "desktop",
  service: "service",
  runner: "runner",
}

union PortableFileRole {
  msi: "msi",
  installationManifest: "installation-manifest",
  installationManifestSignature: "installation-manifest-signature",
  cleanWindowsVmConfig: "clean-windows-vm-config",
  ownerPcConfig: "owner-pc-config",
  friendsPcConfig: "friends-pc-config",
  runner: "runner",
  tauriDriver: "tauri-driver",
  msedgeDriver: "msedgedriver",
}

union PhysicalVersionPolicy {
  packageVersion: "package-version",
  fileVersion: "file-version",
  schemaVersion: "schema-version",
  notApplicable: "not-applicable",
}

union PhysicalSignaturePolicy {
  authenticodeRequired: "authenticode-required",
  detachedCmsRequired: "detached-cms-required",
  manifestAuthenticated: "manifest-authenticated",
}

union PhysicalStage {
  cleanWindowsVm: "clean-windows-vm",
  ownerPc: "owner-pc",
  friendsPc: "friends-pc",
}

model InstalledFileIdentityBase {
  @minValue(1)
  sizeBytes: uint32;
  sha256: TransactionHash;
  version: PhysicalVersion;
  authenticodePublisher: "Liiiraa Boost Development";
  authenticodeThumbprint: TransactionHash;
}

model InstalledDesktopFileIdentity {
  ...InstalledFileIdentityBase;
  role: InstalledFileRole.desktop;
  relativePath: "liiiraa-desktop.exe";
}

model InstalledServiceFileIdentity {
  ...InstalledFileIdentityBase;
  role: InstalledFileRole.service;
  relativePath: "liiiraa-optimizer-service.exe";
}

model InstalledRunnerFileIdentity {
  ...InstalledFileIdentityBase;
  role: InstalledFileRole.runner;
  relativePath: "phase6-physical-runner.exe";
}

model InstalledFileSet {
  desktop: InstalledDesktopFileIdentity;
  service: InstalledServiceFileIdentity;
  runner: InstalledRunnerFileIdentity;
}

model InstallationManifestDocument {
  kind: "installation-manifest";
  schemaVersion: TransactionSchemaVersion;
  manifestId: TransactionIdentifier;
  productCode: WindowsSchemeIdentifier;
  packageVersion: PhysicalVersion;
  sourceCommit: PhysicalSourceCommit;
  inputTreeHash: TransactionHash;
  buildId: TransactionIdentifier;
  operationVersionId: TransactionIdentifier;
  createdAt: utcDateTime;
  signerSpkiSha256: TransactionHash;
  files: InstalledFileSet;
}

model PortableFileIdentityBase {
  @minValue(1)
  sizeBytes: uint32;
  sha256: TransactionHash;
  version: PhysicalVersion;
  versionPolicy: PhysicalVersionPolicy;
  signaturePolicy: PhysicalSignaturePolicy;
}

model PortableMsiFileIdentity {
  ...PortableFileIdentityBase;
  role: PortableFileRole.msi;
  relativePath: "liiiraa-boost.msi";
}

model PortableInstallationManifestFileIdentity {
  ...PortableFileIdentityBase;
  role: PortableFileRole.installationManifest;
  relativePath: "installation-manifest.json";
}

model PortableInstallationManifestSignatureFileIdentity {
  ...PortableFileIdentityBase;
  role: PortableFileRole.installationManifestSignature;
  relativePath: "installation-manifest.json.p7s";
}

model PortableCleanWindowsVmConfigFileIdentity {
  ...PortableFileIdentityBase;
  role: PortableFileRole.cleanWindowsVmConfig;
  relativePath: "configs/clean-windows-vm.run-config.json";
}

model PortableOwnerPcConfigFileIdentity {
  ...PortableFileIdentityBase;
  role: PortableFileRole.ownerPcConfig;
  relativePath: "configs/owner-pc.run-config.json";
}

model PortableFriendsPcConfigFileIdentity {
  ...PortableFileIdentityBase;
  role: PortableFileRole.friendsPcConfig;
  relativePath: "configs/friends-pc.run-config.json";
}

model PortableRunnerFileIdentity {
  ...PortableFileIdentityBase;
  role: PortableFileRole.runner;
  relativePath: "phase6-physical-runner.exe";
}

model PortableTauriDriverFileIdentity {
  ...PortableFileIdentityBase;
  role: PortableFileRole.tauriDriver;
  relativePath: "tauri-driver.exe";
}

model PortableMsedgeDriverFileIdentity {
  ...PortableFileIdentityBase;
  role: PortableFileRole.msedgeDriver;
  relativePath: "msedgedriver.exe";
}

model PortableFileSet {
  msi: PortableMsiFileIdentity;
  installationManifest: PortableInstallationManifestFileIdentity;
  installationManifestSignature: PortableInstallationManifestSignatureFileIdentity;
  cleanWindowsVmConfig: PortableCleanWindowsVmConfigFileIdentity;
  ownerPcConfig: PortableOwnerPcConfigFileIdentity;
  friendsPcConfig: PortableFriendsPcConfigFileIdentity;
  runner: PortableRunnerFileIdentity;
  tauriDriver: PortableTauriDriverFileIdentity;
  msedgeDriver: PortableMsedgeDriverFileIdentity;
}

model ArtifactManifestDocument {
  kind: "artifact-manifest";
  schemaVersion: TransactionSchemaVersion;
  manifestId: TransactionIdentifier;
  sourceCommit: PhysicalSourceCommit;
  inputTreeHash: TransactionHash;
  buildId: TransactionIdentifier;
  operationVersionId: TransactionIdentifier;
  createdAt: utcDateTime;
  files: PortableFileSet;
}

model FriendsRosterParticipant {
  participantId: TransactionHash;
  machineSlot: PhysicalMachineSlot;
}

model FriendsRosterDocument {
  kind: "friends-roster";
  schemaVersion: TransactionSchemaVersion;
  rosterId: TransactionIdentifier;
  artifactManifestSha256: TransactionHash;
  friendsConfigSha256: TransactionHash;
  operationVersionId: TransactionIdentifier;
  buildId: TransactionIdentifier;
  sourceCommit: PhysicalSourceCommit;
  purpose: "phase6-friends-physical-validation";
  createdAt: utcDateTime;

  @minItems(1)
  @maxItems(32)
  @uniqueItems
  @extension("x-liiiraa-unique-roster-bindings", true)
  participants: FriendsRosterParticipant[];
}

model PhysicalScenarioSet {
  prepareRecovery: true;
  apply: true;
  verifyApplied: true;
  rebootWhenRequired: true;
  restore: true;
  verifyRestored: true;
}

model PhysicalTauriCommandAllowlist {
  composePlan: "compose_plan";
  revisePlan: "revise_plan";
  approvePlan: "approve_plan";
  applyPlan: "apply_plan";
  restorePlanOperation: "restore_plan_operation";
  restorePlan: "restore_plan";
  restoreRecoveryCheckpoint: "restore_recovery_checkpoint";
  readPlanExecution: "read_plan_execution";
  subscribePlanExecution: "subscribe_plan_execution";
  previewPlanDiagnostic: "preview_plan_diagnostic";
  exportPlanDiagnostic: "export_plan_diagnostic";
  readAdvancedPreference: "read_advanced_preference";
  enableAdvancedPreference: "enable_advanced_preference";
  revokeAdvancedPreference: "revoke_advanced_preference";
}

model CleanWindowsVmPhysicalPaths {
  runRecordPath: "state/clean-windows-vm/run-record.json";
  installedReadyRecordPath: "state/clean-windows-vm/installed-ready.json";
  checkpointReadyRecordPath: "state/clean-windows-vm/checkpoint-ready.json";
  continuationPath: "state/clean-windows-vm/physical-continuation.json";
  rawEnvelopePath: "evidence/clean-windows-vm/raw-run-envelope.json";
}

model OwnerPcPhysicalPaths {
  runRecordPath: "state/owner-pc/run-record.json";
  installedReadyRecordPath: "state/owner-pc/installed-ready.json";
  checkpointReadyRecordPath: "state/owner-pc/checkpoint-ready.json";
  continuationPath: "state/owner-pc/physical-continuation.json";
  rawEnvelopePath: "evidence/owner-pc/raw-run-envelope.json";
}

model FriendsPcPhysicalPaths {
  runRecordPath: "state/friends-pc/run-record.json";
  installedReadyRecordPath: "state/friends-pc/installed-ready.json";
  checkpointReadyRecordPath: "state/friends-pc/checkpoint-ready.json";
  continuationPath: "state/friends-pc/physical-continuation.json";
  rawEnvelopePath: "evidence/friends-pc/raw-run-envelope.json";
}

model PhysicalRunConfigBase {
  kind: "physical-run-config";
  schemaVersion: TransactionSchemaVersion;
  configId: TransactionIdentifier;
  artifactManifestPath: "artifact-manifest.json";
  artifactManifestSha256: TransactionHash;
  operationVersionId: TransactionIdentifier;
  buildId: TransactionIdentifier;
  sourceCommit: PhysicalSourceCommit;
  participantIdentityMode: "purpose-bound-local-hash";
  scenarios: PhysicalScenarioSet;
  tauriCommands: PhysicalTauriCommandAllowlist;
}

model CleanWindowsVmRunConfigDocument {
  ...PhysicalRunConfigBase;
  stage: "clean-windows-vm";
  configPath: "configs/clean-windows-vm.run-config.json";
  paths: CleanWindowsVmPhysicalPaths;
}

model OwnerPcRunConfigDocument {
  ...PhysicalRunConfigBase;
  stage: "owner-pc";
  configPath: "configs/owner-pc.run-config.json";
  paths: OwnerPcPhysicalPaths;
}

model FriendsPcRunConfigDocument {
  ...PhysicalRunConfigBase;
  stage: "friends-pc";
  configPath: "configs/friends-pc.run-config.json";
  paths: FriendsPcPhysicalPaths;
  friendsRosterPath: "friends/friends-roster.json";
  friendsRosterSignaturePath: "friends/friends-roster.json.p7s";
}

@oneOf
union PhysicalRunConfigDocument {
  cleanWindowsVm: CleanWindowsVmRunConfigDocument,
  ownerPc: OwnerPcRunConfigDocument,
  friendsPc: FriendsPcRunConfigDocument,
}

model PhysicalContinuationBase {
  kind: "physical-continuation";
  schemaVersion: TransactionSchemaVersion;
  continuationId: TransactionIdentifier;
  artifactManifestSha256: TransactionHash;
  configSha256: TransactionHash;
  runnerSha256: TransactionHash;
  stage: PhysicalStage;
  operationVersionId: TransactionIdentifier;
  buildId: TransactionIdentifier;
  runId: TransactionIdentifier;
  transactionId: TransactionIdentifier;
  previousRecordHash: TransactionHash;
  recordHash: TransactionHash;
  observedJournalHeadHash: TransactionHash;
  recordedAt: utcDateTime;
}

model InstalledReadyContinuationDocument {
  ...PhysicalContinuationBase;
  state: "installed-ready";
  sequence: PhysicalSequence0;
}

model CheckpointReadyContinuationDocument {
  ...PhysicalContinuationBase;
  state: "checkpoint-ready";
  sequence: PhysicalSequence1;
  previousState: "installed-ready";
}

model RunningContinuationDocument {
  ...PhysicalContinuationBase;
  state: "running";
  sequence: PhysicalSequence2;
  previousState: "checkpoint-ready";
}

model RebootPendingContinuationDocument {
  ...PhysicalContinuationBase;
  state: "reboot-pending";
  sequence: PhysicalSequence3;
  previousState: "running";
}

model ResumedObservationContinuationDocument {
  ...PhysicalContinuationBase;
  state: "resumed-observation";
  sequence: PhysicalSequence4;
  previousState: "reboot-pending";
  observationRequired: true;
  mutationAuthorized: false;
}

model RestoredCompleteContinuationDocument {
  ...PhysicalContinuationBase;
  state: "restored-complete";
  sequence: PhysicalSequence5;
  previousState: "resumed-observation";
}

@oneOf
union PhysicalContinuationDocument {
  installedReady: InstalledReadyContinuationDocument,
  checkpointReady: CheckpointReadyContinuationDocument,
  running: RunningContinuationDocument,
  rebootPending: RebootPendingContinuationDocument,
  resumedObservation: ResumedObservationContinuationDocument,
  restoredComplete: RestoredCompleteContinuationDocument,
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
  installationManifest: InstallationManifestDocument,
  artifactManifest: ArtifactManifestDocument,
  friendsRoster: FriendsRosterDocument,
  physicalRunConfig: PhysicalRunConfigDocument,
  physicalContinuation: PhysicalContinuationDocument,
}
