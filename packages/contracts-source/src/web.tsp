using TypeSpec.JsonSchema;

namespace Liiiraa.Contracts.Desktop.V1;

@minLength(1)
@maxLength(128)
scalar WebIdentifier extends string;

@minLength(1)
@maxLength(1024)
scalar WebText extends string;

@minLength(1)
@maxLength(512)
scalar WebPathnameTemplate extends string;

@minLength(1)
@maxLength(2048)
scalar WebUri extends string;

@minLength(64)
@maxLength(64)
scalar Sha256Digest extends string;

union WebSurface {
  public: "public",
  account: "account",
  admin: "admin",
}

union WebShell {
  public: "public",
  account: "account",
  admin: "admin",
}

union IndexingPolicy {
  index: "index",
  noindex: "noindex",
}

union ValidationState {
  validated: "validated",
  underValidation: "under-validation",
  unproven: "unproven",
  stale: "stale",
}

union CapabilityAvailability {
  available: "available",
  demonstrativePreview: "demonstrative-preview",
  underValidation: "under-validation",
  planned: "planned",
  unsupported: "unsupported",
  unavailable: "unavailable",
}

union SafeContextKey {
  locale: "locale",
  version: "version",
  channel: "channel",
  destination: "destination",
  returnPath: "return-path",
}

union LocalePolicy {
  required: "required",
  optional: "optional",
  forbidden: "forbidden",
}

union WebSecurityBoundary {
  publicOrigin: "public-origin",
  accountOrigin: "account-origin",
  adminOrigin: "admin-origin",
}

union OfficialReleaseOrigin {
  download: "liiiraa-download-origin",
  releases: "liiiraa-release-origin",
}

union SignatureState {
  verified: "verified",
  mismatch: "mismatch",
  unavailable: "unavailable",
}

union ScreenshotReviewState {
  approved: "approved",
  rejected: "rejected",
  pending: "pending",
}

@jsonSchema
model WebRouteRecord {
  id: WebIdentifier;
  surface: WebSurface;
  shell: WebShell;
  pathnameTemplate: WebPathnameTemplate;
  localePolicy: LocalePolicy;
  indexing: IndexingPolicy;
  owner: WebIdentifier;
  scenarioRequirement: CapabilityAvailability;
  securityBoundary: WebSecurityBoundary;
  @minItems(0)
  @maxItems(5)
  safeContextKeys: SafeContextKey[];
}

@jsonSchema
model ClaimEvidence {
  source: WebUri;
  provenance: DiagnosticValue;
  scope: WebText;
  applicableVersion: ShellVersion;
  validationState: ValidationState;
  unproven: boolean;
}

@jsonSchema
model ContentRecord {
  id: WebIdentifier;
  routeId: WebIdentifier;
  locale: ShellLocale;
  version: ShellVersion;
  channel: ShellReleaseChannel;
  owner: WebIdentifier;
  lastReviewedAt: utcDateTime;
  validationState: ValidationState;
  @minItems(1)
  @maxItems(16)
  evidence: ClaimEvidence[];
  indexing: IndexingPolicy;
  staleTreatment: WebText;
}

@jsonSchema
model ScreenshotProvenance {
  version: ShellVersion;
  locale: ShellLocale;
  scenarioId: ProvenanceIdentifier;
  viewport: WebIdentifier;
  captureCommand: WebText;
  sourceCommit: WebIdentifier;
  checksum: Sha256Digest;
  crop: WebText;
  reviewState: ScreenshotReviewState;
}

@jsonSchema
model ReleaseArtifactEvidence {
  publisher: WebText;
  sha256: Sha256Digest;
  @minValue(1)
  @maxValue(10737418240)
  sizeBytes: uint64;
  signatureState: SignatureState;
  origin: OfficialReleaseOrigin;
}

@jsonSchema
model ReleaseRecord {
  channel: ShellReleaseChannel;
  version: ShellVersion;
  @minItems(1)
  @maxItems(16)
  compatibility: WebText[];
  manifest: WebIdentifier;
  artifactEvidence?: ReleaseArtifactEvidence;
  availability: CapabilityAvailability;
  publicDistributionApproved: false;
  officialArtifact: "unavailable";
}

@jsonSchema
model FutureAuthorityCommand {
  phase: "Phase 4";
  surface: WebSurface;
  command: WebIdentifier;
  description: WebText;
}

@jsonSchema
model NoChangeReceipt {
  receiptVersion: ShellVersion;
  authority: FutureAuthorityCommand;
  requestedAction: WebIdentifier;
  @minItems(1)
  @maxItems(32)
  reviewedInputs: WebIdentifier[];
  reviewedAt: utcDateTime;
  correlationId: CorrelationId;
  provenance: FixtureDiagnosticValue;
  remoteStateChanged: false;
  nextPhase: "Phase 4";
}

@jsonSchema
model AdminAuditEvent {
  eventId: WebIdentifier;
  actor: WebIdentifier;
  role: WebIdentifier;
  action: WebIdentifier;
  redactedTarget: WebText;
  reason: WebText;
  consentReference?: WebIdentifier;
  occurredAt: utcDateTime;
  result: "simulated-no-change";
  correlationId: CorrelationId;
  receipt: NoChangeReceipt;
}
