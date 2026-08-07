using TypeSpec.JsonSchema;

namespace Liiiraa.Contracts.Desktop.V1;

@minLength(1)
@maxLength(128)
scalar ControlPlaneIdentifier extends string;

@minLength(1)
@maxLength(256)
scalar ControlPlaneShortText extends string;

@minLength(1)
@maxLength(512)
scalar RedactedAuthorityText extends string;

@minLength(1)
@maxLength(128)
scalar AuthorityEtag extends string;

@minLength(1)
@maxLength(32)
scalar ContractSchemaVersion extends string;

@minLength(1)
@maxLength(16384)
@pattern("^[A-Za-z0-9_-]+={0,2}$")
scalar OpaquePayloadBytes extends string;

@minLength(64)
@maxLength(512)
@pattern("^[A-Za-z0-9_-]+={0,2}$")
scalar DetachedSignature extends string;

@minLength(3)
@maxLength(3)
@pattern("^[A-Z]{3}$")
scalar CurrencyCode extends string;

@minValue(0)
@maxValue(9007199254740991)
scalar MoneyMinorUnits extends int64;

union AuthorityProvenance {
  postgresAuthority: "postgres-authority",
  providerVerified: "provider-verified",
  deviceVerified: "device-verified",
}

union AccountState {
  active: "active",
  locked: "locked",
  pendingDeletion: "pending-deletion",
  disabled: "disabled",
}

union SessionState {
  active: "active",
  challengeRequired: "challenge-required",
  revoked: "revoked",
  expired: "expired",
}

union AuthenticationStrength {
  password: "password",
  mfa: "mfa",
  passkey: "passkey",
}

union SubscriptionState {
  none: "none",
  trialing: "trialing",
  active: "active",
  pastDue: "past-due",
  canceled: "canceled",
  expired: "expired",
}

union SubscriptionPlan {
  free: "free",
  premium: "premium",
}

union InvoiceState {
  draft: "draft",
  open: "open",
  paid: "paid",
  voided: "void",
  uncollectible: "uncollectible",
}

union DeviceBindingState {
  unbound: "unbound",
  active: "active",
  replacementCooldown: "replacement-cooldown",
  revoked: "revoked",
}

union SupportCaseState {
  open: "open",
  waitingCustomer: "waiting-customer",
  waitingSupport: "waiting-support",
  resolved: "resolved",
  closed: "closed",
}

union ConsentState {
  active: "active",
  revoked: "revoked",
  expired: "expired",
}

union ConsentScope {
  supportDiagnostics: "support-diagnostics",
  cloudAi: "cloud-ai",
  accountSecurity: "account-security",
}

union AdminRole {
  support: "support",
  operations: "operations",
  security: "security",
  audit: "audit",
}

union AdminAction {
  assumeRole: "assume-role",
  viewSupportDiagnostics: "view-support-diagnostics",
  revokeSession: "revoke-session",
  revokeDevice: "revoke-device",
  correctEntitlement: "correct-entitlement",
  exportAuditReference: "export-audit-reference",
}

union AccountCommandAction {
  updateProfile: "update-profile",
  requestDeletion: "request-deletion",
  cancelDeletion: "cancel-deletion",
}

union SessionCommandAction {
  revoke: "revoke",
  revokeOthers: "revoke-others",
}

union CommerceCommandAction {
  startCheckout: "start-checkout",
  reconcileSubscription: "reconcile-subscription",
  cancelSubscription: "cancel-subscription",
}

union DeviceCommandAction {
  bind: "bind",
  replace: "replace",
  revoke: "revoke",
}

union SupportCommandAction {
  create: "create",
  reply: "reply",
  close: "close",
}

union ConsentCommandAction {
  grant: "grant",
  revoke: "revoke",
}

union AuthorityReceiptOutcome {
  applied: "applied",
  accepted: "accepted",
  noOp: "no-op",
}

union AuthorityErrorCode {
  unauthenticated: "unauthenticated",
  unauthorized: "unauthorized",
  stepUpRequired: "step-up-required",
  conflict: "conflict",
  stale: "stale",
  consentExpired: "consent-expired",
  offline: "offline",
  providerUnavailable: "provider-unavailable",
  invalidRequest: "invalid-request",
  internal: "internal",
}

union ProviderIdentity {
  identity: "identity",
  commerce: "commerce",
  email: "email",
  objectStorage: "object-storage",
}

union ProviderEventType {
  sessionRevoked: "session-revoked",
  checkoutCompleted: "checkout-completed",
  subscriptionUpdated: "subscription-updated",
  invoiceUpdated: "invoice-updated",
  deliveryUpdated: "delivery-updated",
}

union AuditResult {
  succeeded: "succeeded",
  denied: "denied",
  failed: "failed",
}

model AuthorityProjectionMetadata {
  schemaVersion: "1.0";
  aggregateVersion: uint64;
  etag: AuthorityEtag;
  correlationId: CorrelationId;
  provenance: AuthorityProvenance;
}

model AccountProjection is AuthorityProjectionMetadata {
  kind: "account-projection";
  accountId: ControlPlaneIdentifier;
  state: AccountState;
  displayName: ControlPlaneShortText;
  emailRedacted: RedactedAuthorityText;
  administrativeRole?: AdminRole;
  locale: ShellLocale;
  createdAt: utcDateTime;
  updatedAt: utcDateTime;
}

model SessionProjection is AuthorityProjectionMetadata {
  kind: "session-projection";
  sessionId: ControlPlaneIdentifier;
  accountId: ControlPlaneIdentifier;
  state: SessionState;
  authenticationStrength: AuthenticationStrength;
  @minItems(1)
  @maxItems(16)
  @uniqueItems
  scopes: ControlPlaneIdentifier[];
  authenticatedAt: utcDateTime;
  expiresAt: utcDateTime;
  lastSeenAt: utcDateTime;
}

model SubscriptionProjection is AuthorityProjectionMetadata {
  kind: "subscription-projection";
  subscriptionId: ControlPlaneIdentifier;
  accountId: ControlPlaneIdentifier;
  state: SubscriptionState;
  plan: SubscriptionPlan;
  @minItems(0)
  @maxItems(16)
  @uniqueItems
  entitlements: ControlPlaneIdentifier[];
  currentPeriodEndsAt?: utcDateTime;
  cancelAtPeriodEnd: boolean;
}

model InvoiceProjection is AuthorityProjectionMetadata {
  kind: "invoice-projection";
  invoiceId: ControlPlaneIdentifier;
  accountId: ControlPlaneIdentifier;
  subscriptionId?: ControlPlaneIdentifier;
  state: InvoiceState;
  currency: CurrencyCode;
  amountDueMinor: MoneyMinorUnits;
  amountPaidMinor: MoneyMinorUnits;
  issuedAt: utcDateTime;
  settledAt?: utcDateTime;
}

model DeviceBindingProjection is AuthorityProjectionMetadata {
  kind: "device-binding-projection";
  deviceBindingId: ControlPlaneIdentifier;
  accountId: ControlPlaneIdentifier;
  state: DeviceBindingState;
  deviceLabel: RedactedAuthorityText;
  evidenceVersion: ContractSchemaVersion;
  boundAt?: utcDateTime;
  replacementEligibleAt?: utcDateTime;
}

model SupportCaseProjection is AuthorityProjectionMetadata {
  kind: "support-case-projection";
  supportCaseId: ControlPlaneIdentifier;
  accountId: ControlPlaneIdentifier;
  state: SupportCaseState;
  subjectRedacted: RedactedAuthorityText;
  consentId?: ControlPlaneIdentifier;
  auditReference: ControlPlaneIdentifier;
  createdAt: utcDateTime;
  updatedAt: utcDateTime;
}

model DiagnosticConsent is AuthorityProjectionMetadata {
  kind: "diagnostic-consent";
  consentId: ControlPlaneIdentifier;
  accountId: ControlPlaneIdentifier;
  state: ConsentState;
  @minItems(1)
  @maxItems(3)
  @uniqueItems
  scopes: ConsentScope[];
  purpose: RedactedAuthorityText;
  grantedAt: utcDateTime;
  expiresAt: utcDateTime;
  revokedAt?: utcDateTime;
}

model AccountCommand {
  schemaVersion: "1.0";
  kind: "account-command";
  commandId: ControlPlaneIdentifier;
  accountId: ControlPlaneIdentifier;
  action: AccountCommandAction;
  expectedVersion: uint64;
  correlationId: CorrelationId;
  requestedAt: utcDateTime;
}

model SessionCommand {
  schemaVersion: "1.0";
  kind: "session-command";
  commandId: ControlPlaneIdentifier;
  accountId: ControlPlaneIdentifier;
  sessionId: ControlPlaneIdentifier;
  action: SessionCommandAction;
  expectedVersion: uint64;
  correlationId: CorrelationId;
  requestedAt: utcDateTime;
}

model CommerceCommand {
  schemaVersion: "1.0";
  kind: "commerce-command";
  commandId: ControlPlaneIdentifier;
  accountId: ControlPlaneIdentifier;
  action: CommerceCommandAction;
  expectedVersion: uint64;
  correlationId: CorrelationId;
  requestedAt: utcDateTime;
}

model DeviceCommand {
  schemaVersion: "1.0";
  kind: "device-command";
  commandId: ControlPlaneIdentifier;
  accountId: ControlPlaneIdentifier;
  deviceBindingId: ControlPlaneIdentifier;
  action: DeviceCommandAction;
  expectedVersion: uint64;
  correlationId: CorrelationId;
  requestedAt: utcDateTime;
}

model SupportCommand {
  schemaVersion: "1.0";
  kind: "support-command";
  commandId: ControlPlaneIdentifier;
  accountId: ControlPlaneIdentifier;
  supportCaseId: ControlPlaneIdentifier;
  action: SupportCommandAction;
  expectedVersion: uint64;
  correlationId: CorrelationId;
  requestedAt: utcDateTime;
}

model ConsentCommand {
  schemaVersion: "1.0";
  kind: "consent-command";
  commandId: ControlPlaneIdentifier;
  accountId: ControlPlaneIdentifier;
  consentId: ControlPlaneIdentifier;
  action: ConsentCommandAction;
  @minItems(1)
  @maxItems(3)
  @uniqueItems
  scopes: ConsentScope[];
  expectedVersion: uint64;
  correlationId: CorrelationId;
  requestedAt: utcDateTime;
}

model AdminCommand {
  schemaVersion: "1.0";
  kind: "admin-command";
  commandId: ControlPlaneIdentifier;
  actorId: ControlPlaneIdentifier;
  assumedRole: AdminRole;
  action: AdminAction;
  redactedTarget: RedactedAuthorityText;
  reason: RedactedAuthorityText;
  authorizationContextId: ControlPlaneIdentifier;
  expectedVersion: uint64;
  correlationId: CorrelationId;
  requestedAt: utcDateTime;
}

@oneOf
union AuthorityCommand {
  account: AccountCommand,
  session: SessionCommand,
  commerce: CommerceCommand,
  device: DeviceCommand,
  support: SupportCommand,
  consent: ConsentCommand,
  admin: AdminCommand,
}

model AuthorityReceipt {
  schemaVersion: "1.0";
  kind: "authority-receipt";
  receiptId: ControlPlaneIdentifier;
  commandId: ControlPlaneIdentifier;
  aggregateId: ControlPlaneIdentifier;
  aggregateVersion: uint64;
  etag: AuthorityEtag;
  correlationId: CorrelationId;
  auditReference: ControlPlaneIdentifier;
  outcome: AuthorityReceiptOutcome;
  provenance: AuthorityProvenance;
  recordedAt: utcDateTime;
}

model AuthorityError {
  schemaVersion: "1.0";
  kind: "authority-error";
  code: AuthorityErrorCode;
  message: RedactedAuthorityText;
  correlationId: CorrelationId;
  retryable: boolean;
  currentVersion?: uint64;
  currentEtag?: AuthorityEtag;
  auditReference?: ControlPlaneIdentifier;
}

model ProviderEvent {
  schemaVersion: "1.0";
  kind: "provider-event";
  provider: ProviderIdentity;
  providerEventId: ControlPlaneIdentifier;
  eventType: ProviderEventType;
  aggregateReference?: ControlPlaneIdentifier;
  payloadDigest: Sha256Digest;
  correlationId: CorrelationId;
  receivedAt: utcDateTime;
}

model AuditEvent {
  schemaVersion: "1.0";
  kind: "audit-event";
  auditEventId: ControlPlaneIdentifier;
  actorReference: ControlPlaneIdentifier;
  assumedRole?: AdminRole;
  action: ControlPlaneIdentifier;
  redactedTarget: RedactedAuthorityText;
  reason: RedactedAuthorityText;
  result: AuditResult;
  aggregateVersion: uint64;
  correlationId: CorrelationId;
  previousEventHash?: Sha256Digest;
  eventHash: Sha256Digest;
  occurredAt: utcDateTime;
}

model OfflineEntitlementEnvelope {
  schemaVersion: "1.0";
  kind: "offline-entitlement-envelope";
  payloadBytes: OpaquePayloadBytes;
  signature: DetachedSignature;
  algorithm: "Ed25519";
  keyId: ControlPlaneIdentifier;
  audience: ControlPlaneIdentifier;
  deviceBinding: ControlPlaneIdentifier;
  issuedAt: utcDateTime;
  expiresAt: utcDateTime;
  validitySeconds: 604800;
}

union AdminEnvironmentKind {
  development: "development",
  staging: "staging",
  production: "production",
}

union AdminDomain {
  overview: "overview",
  people: "people",
  revenue: "revenue",
  operation: "operation",
  support: "support",
  security: "security",
  system: "system",
}

union AdminFunction {
  owner: "owner",
  support: "support",
  finance: "finance",
  operations: "operations",
  security: "security",
  audit: "audit",
  productConfiguration: "product-configuration",
}

union AdminFreshnessState {
  live: "live",
  reconnecting: "reconnecting",
  stale: "stale",
  offline: "offline",
  degraded: "degraded",
}

union AdminDensity {
  comfortable: "comfortable",
  compact: "compact",
}

union AdminSavedViewVisibility {
  official: "official",
  personal: "personal",
}

union AdminSeverity {
  information: "information",
  warning: "warning",
  critical: "critical",
}

union AdminInboxState {
  open: "open",
  acknowledged: "acknowledged",
  resolved: "resolved",
}

union AdminInvitationLifecycleState {
  queued: "queued",
  active: "active",
  accepted: "accepted",
  declined: "declined",
  expired: "expired",
  revoked: "revoked",
  bounced: "bounced",
}

union AdminInvitationDeliveryState {
  unavailable: "unavailable",
  pending: "pending",
  sent: "sent",
  delivered: "delivered",
  failed: "failed",
  permanentBounce: "permanent-bounce",
}

union AdminGovernanceKind {
  approval: "approval",
  delegation: "delegation",
  accessReview: "access-review",
  permissionChange: "permission-change",
}

union AdminGovernanceState {
  pending: "pending",
  approved: "approved",
  denied: "denied",
  expired: "expired",
  revoked: "revoked",
  suspended: "suspended",
  completed: "completed",
}

union AdminMembershipState {
  active: "active",
  suspended: "suspended",
  offboarded: "offboarded",
}

union AdminStrongFactor {
  passkey: "passkey",
  mfa: "mfa",
}

union AdminRiskLevel {
  low: "low",
  medium: "medium",
  high: "high",
  critical: "critical",
  irreversible: "irreversible",
}

union AdminJobType {
  invitationImport: "invitation-import",
  invitationExport: "invitation-export",
  invitationResend: "invitation-resend",
  invitationRevoke: "invitation-revoke",
  reconciliation: "reconciliation",
  recalculation: "recalculation",
  release: "release",
  configurationExport: "configuration-export",
  privacyExport: "privacy-export",
}

union AdminJobState {
  queued: "queued",
  running: "running",
  paused: "paused",
  completed: "completed",
  partial: "partial",
  failed: "failed",
  cancelled: "cancelled",
}

union AdminIncidentState {
  open: "open",
  acknowledged: "acknowledged",
  contained: "contained",
  resolved: "resolved",
  review: "review",
}

union AdminConfigurationState {
  draft: "draft",
  validated: "validated",
  approvalPending: "approval-pending",
  published: "published",
  paused: "paused",
  rolledBack: "rolled-back",
}

union AdminPrivacyRequestType {
  access: "access",
  correction: "correction",
  deletion: "deletion",
  portability: "portability",
  restriction: "restriction",
  unspecified: "unspecified",
}

union AdminPrivacyCaseState {
  submitted: "submitted",
  verified: "verified",
  discovery: "discovery",
  review: "review",
  approvalPending: "approval-pending",
  executing: "executing",
  completed: "completed",
  denied: "denied",
}

union AdminOperationalHealth {
  healthy: "healthy",
  degraded: "degraded",
  unavailable: "unavailable",
  unknownState: "unknown",
}

union AdminAlertState {
  open: "open",
  acknowledged: "acknowledged",
  resolved: "resolved",
  failed: "failed",
}

union AdminEmergencyStopState {
  active: "active",
  expired: "expired",
  restored: "restored",
}

union AdminExportState {
  pending: "pending",
  ready: "ready",
  expired: "expired",
  revoked: "revoked",
}

union AdminConflictState {
  reviewRequired: "review-required",
  mergeAvailable: "merge-available",
  resolved: "resolved",
}

union AdminOperationOutcome {
  applied: "applied",
  partial: "partial",
  failed: "failed",
  denied: "denied",
  cancelled: "cancelled",
}

union AdminOperationAction {
  issueInvitations: "issue-invitations",
  resendInvitations: "resend-invitations",
  revokeInvitations: "revoke-invitations",
  promoteInvitationQueue: "promote-invitation-queue",
  updateAccess: "update-access",
  requestApproval: "request-approval",
  resolveIncident: "resolve-incident",
  publishConfiguration: "publish-configuration",
  rollbackConfiguration: "rollback-configuration",
  executePrivacyCase: "execute-privacy-case",
  exportSensitiveData: "export-sensitive-data",
}

model AdminEnvironmentIdentity {
  environmentId: ControlPlaneIdentifier;
  kind: AdminEnvironmentKind;
  label: ControlPlaneShortText;
}

model AdminFreshness {
  state: AdminFreshnessState;
  source: ControlPlaneIdentifier;
  sequence: uint64;
  observedAt: utcDateTime;
}

model AdminProjectionMetadata is AuthorityProjectionMetadata {
  environment: AdminEnvironmentIdentity;
  freshness: AdminFreshness;
}

model AdminSafeRouteState {
  @minItems(0)
  @maxItems(16)
  @uniqueItems
  filters: ControlPlaneShortText[];
  @minItems(0)
  @maxItems(8)
  @uniqueItems
  sort: ControlPlaneShortText[];
  tab?: ControlPlaneIdentifier;
  cursor?: ControlPlaneIdentifier;
  recordId?: ControlPlaneIdentifier;
  savedViewId?: ControlPlaneIdentifier;
  density: AdminDensity;
}

model AdminAccessContextProjection is AdminProjectionMetadata {
  kind: "admin-access-context-projection";
  actorId: ControlPlaneIdentifier;
  activeFunction: AdminFunction;
  @minItems(1)
  @maxItems(7)
  @uniqueItems
  domains: AdminDomain[];
  @minItems(1)
  @maxItems(64)
  @uniqueItems
  capabilities: ControlPlaneIdentifier[];
  @minItems(1)
  @maxItems(64)
  @uniqueItems
  scopes: ControlPlaneIdentifier[];
  authenticationStrength: AuthenticationStrength;
  breakGlassExpiresAt?: utcDateTime;
}

model AdminSavedViewProjection is AdminProjectionMetadata {
  kind: "admin-saved-view-projection";
  savedViewId: ControlPlaneIdentifier;
  domain: AdminDomain;
  name: ControlPlaneShortText;
  visibility: AdminSavedViewVisibility;
  state: AdminSafeRouteState;
}

model AdminInboxItemProjection is AdminProjectionMetadata {
  kind: "admin-inbox-item-projection";
  inboxItemId: ControlPlaneIdentifier;
  severity: AdminSeverity;
  state: AdminInboxState;
  title: ControlPlaneShortText;
  ownerReference?: ControlPlaneIdentifier;
  relatedRecordReference: ControlPlaneIdentifier;
  deadlineAt?: utcDateTime;
  updatedAt: utcDateTime;
}

model AdminInvitationProjection is AdminProjectionMetadata {
  kind: "admin-invitation-projection";
  invitationId: ControlPlaneIdentifier;
  lifecycleState: AdminInvitationLifecycleState;
  recipientMasked: RedactedAuthorityText;
  campaignReference?: ControlPlaneIdentifier;
  locale: ShellLocale;
  deliveryState: AdminInvitationDeliveryState;
  @minValue(0)
  @maxValue(2)
  reminderCount: uint8;
  ownerReference?: ControlPlaneIdentifier;
  expiresAt?: utcDateTime;
  lastEventAt: utcDateTime;
}

model AdminInvitationCapacityProjection is AdminProjectionMetadata {
  kind: "admin-invitation-capacity-projection";
  capacityId: ControlPlaneIdentifier;
  @minValue(0)
  @maxValue(25)
  activeCount: uint8;
  activeLimit: 25;
  @minValue(0)
  @maxValue(100000)
  queuedCount: uint32;
  forecastExhaustionAt?: utcDateTime;
}

model AdminGovernanceProjection is AdminProjectionMetadata {
  kind: "admin-governance-projection";
  governanceRecordId: ControlPlaneIdentifier;
  governanceKind: AdminGovernanceKind;
  state: AdminGovernanceState;
  risk: AdminRiskLevel;
  authorReference: ControlPlaneIdentifier;
  beneficiaryReference: ControlPlaneIdentifier;
  @minItems(0)
  @maxItems(32)
  @uniqueItems
  eligibleApproverReferences: ControlPlaneIdentifier[];
  @minItems(1)
  @maxItems(64)
  @uniqueItems
  impactedReferences: ControlPlaneIdentifier[];
  expiresAt?: utcDateTime;
}

model AdminTeamMemberProjection is AdminProjectionMetadata {
  kind: "admin-team-member-projection";
  identityReference: ControlPlaneIdentifier;
  displayName: ControlPlaneShortText;
  maskedEmail: RedactedAuthorityText;
  state: AdminMembershipState;
  strongFactor: AdminStrongFactor;
  @minItems(1)
  @maxItems(4)
  @uniqueItems
  functions: AdminFunction[];
  activeFunction?: AdminFunction;
  @minItems(1)
  @maxItems(16)
  @uniqueItems
  capabilities: string[];
  @minItems(1)
  @maxItems(16)
  @uniqueItems
  scopes: string[];
  @minItems(0)
  @maxItems(16)
  @uniqueItems
  sessionReferences: ControlPlaneIdentifier[];
  @minItems(0)
  @maxItems(16)
  @uniqueItems
  activeDelegationReferences: ControlPlaneIdentifier[];
  lastActiveAt?: utcDateTime;
  nextReviewAt?: utcDateTime;
}

model AdminPermissionImpactProjection is AdminProjectionMetadata {
  kind: "admin-permission-impact-projection";
  impactId: ControlPlaneIdentifier;
  identityReference: ControlPlaneIdentifier;
  before: {
    @minItems(1)
    @maxItems(4)
    @uniqueItems
    functions: AdminFunction[];
    @minItems(1)
    @maxItems(16)
    @uniqueItems
    capabilities: string[];
    @minItems(1)
    @maxItems(16)
    @uniqueItems
    scopes: string[];
  };
  after: {
    @minItems(1)
    @maxItems(4)
    @uniqueItems
    functions: AdminFunction[];
    @minItems(1)
    @maxItems(16)
    @uniqueItems
    capabilities: string[];
    @minItems(1)
    @maxItems(16)
    @uniqueItems
    scopes: string[];
  };
  @minItems(0)
  @maxItems(32)
  @uniqueItems
  conflicts: string[];
  @minItems(1)
  @maxItems(16)
  @uniqueItems
  affectedData: string[];
  @minItems(0)
  @maxItems(100)
  @uniqueItems
  sessionReferences: ControlPlaneIdentifier[];
  invalidatesPendingApprovals: boolean;
  projectedAt: utcDateTime;
}

model AdminJobProjection is AdminProjectionMetadata {
  kind: "admin-job-projection";
  jobId: ControlPlaneIdentifier;
  jobType: AdminJobType;
  state: AdminJobState;
  @minValue(0)
  @maxValue(100)
  progressPercent: uint8;
  @minValue(0)
  @maxValue(1000000)
  totalItems: uint32;
  @minValue(0)
  @maxValue(1000000)
  completedItems: uint32;
  @minValue(0)
  @maxValue(1000000)
  failedItems: uint32;
  ownerReference: ControlPlaneIdentifier;
  startedAt?: utcDateTime;
  completedAt?: utcDateTime;
  receiptReference?: ControlPlaneIdentifier;
}

model AdminIncidentProjection is AdminProjectionMetadata {
  kind: "admin-incident-projection";
  incidentId: ControlPlaneIdentifier;
  severity: AdminSeverity;
  state: AdminIncidentState;
  title: ControlPlaneShortText;
  ownerReference: ControlPlaneIdentifier;
  substituteReference: ControlPlaneIdentifier;
  @minItems(1)
  @maxItems(64)
  @uniqueItems
  affectedCapabilities: ControlPlaneIdentifier[];
  @minItems(1)
  @maxItems(64)
  @uniqueItems
  impactReferences: ControlPlaneIdentifier[];
  nextUpdateAt: utcDateTime;
}

model AdminConfigurationProjection is AdminProjectionMetadata {
  kind: "admin-configuration-projection";
  configurationId: ControlPlaneIdentifier;
  state: AdminConfigurationState;
  version: ContractSchemaVersion;
  cohortReference: ControlPlaneIdentifier;
  validationReference: ControlPlaneIdentifier;
  rollbackVersion?: ContractSchemaVersion;
}

model AdminPrivacyCaseProjection is AdminProjectionMetadata {
  kind: "admin-privacy-case-projection";
  privacyCaseId: ControlPlaneIdentifier;
  state: AdminPrivacyCaseState;
  requestType: AdminPrivacyRequestType;
  subjectReference: ControlPlaneIdentifier;
  legalBasisReference: ControlPlaneIdentifier;
  @minItems(1)
  @maxItems(32)
  @uniqueItems
  dataCategoryReferences: ControlPlaneIdentifier[];
  @minItems(0)
  @maxItems(32)
  @uniqueItems
  retentionReferences: ControlPlaneIdentifier[];
  ownerReference: ControlPlaneIdentifier;
}

model AdminCapacityProjection is AdminProjectionMetadata {
  kind: "admin-capacity-projection";
  capacityId: ControlPlaneIdentifier;
  resourceReference: ControlPlaneIdentifier;
  currentUse: uint64;
  safeLimit: uint64;
  growthPerDay?: uint32;
  forecastExhaustionAt?: utcDateTime;
  recommendedAction: ControlPlaneIdentifier;
  observedAt: utcDateTime;
}

model AdminEnvironmentProjection is AdminProjectionMetadata {
  kind: "admin-environment-projection";
  environmentReference: ControlPlaneIdentifier;
  sessionEnvironment: AdminEnvironmentKind;
  integrationEnvironment: AdminEnvironmentKind;
  health: AdminOperationalHealth;
  updatedAt: utcDateTime;
}

model AdminAuditEventProjection is AdminProjectionMetadata {
  kind: "admin-audit-event-projection";
  auditEventId: ControlPlaneIdentifier;
  action: ControlPlaneIdentifier;
  scope: ControlPlaneIdentifier;
  outcome: AdminOperationOutcome;
  actorReference: ControlPlaneIdentifier;
  subjectReference: ControlPlaneIdentifier;
  occurredAt: utcDateTime;
}

model AdminAlertProjection is AdminProjectionMetadata {
  kind: "admin-alert-projection";
  alertId: ControlPlaneIdentifier;
  severity: AdminSeverity;
  state: AdminAlertState;
  ownerReference: ControlPlaneIdentifier;
  subjectReference: ControlPlaneIdentifier;
  safeSummary: ControlPlaneShortText;
  deadlineAt?: utcDateTime;
  acknowledgedAt?: utcDateTime;
}

model AdminEmergencyStopProjection is AdminProjectionMetadata {
  kind: "admin-emergency-stop-projection";
  stopId: ControlPlaneIdentifier;
  capabilityReference: ControlPlaneIdentifier;
  state: AdminEmergencyStopState;
  actorReference: ControlPlaneIdentifier;
  reasonRedacted: RedactedAuthorityText;
  requestedAt: utcDateTime;
  expiresAt: utcDateTime;
  restoredAt?: utcDateTime;
  safeRestorationDefined: boolean;
}

model AdminExportProjection is AdminProjectionMetadata {
  kind: "admin-export-projection";
  exportId: ControlPlaneIdentifier;
  state: AdminExportState;
  actorReference: ControlPlaneIdentifier;
  purposeRedacted: RedactedAuthorityText;
  @minItems(1)
  @maxItems(32)
  @uniqueItems
  fieldReferences: ControlPlaneIdentifier[];
  encrypted: true;
  masked: true;
  createdAt: utcDateTime;
  expiresAt: utcDateTime;
}

model AdminConflictProjection is AdminProjectionMetadata {
  kind: "admin-conflict-projection";
  conflictId: ControlPlaneIdentifier;
  state: AdminConflictState;
  recordReference: ControlPlaneIdentifier;
  localVersion: uint64;
  remoteVersion: uint64;
  @minItems(1)
  @maxItems(64)
  @uniqueItems
  conflictingFieldReferences: ControlPlaneIdentifier[];
  localDraftReference: ControlPlaneIdentifier;
}

model AdminPartialFailureItem {
  recordReference: ControlPlaneIdentifier;
  code: AuthorityErrorCode;
}

model AdminPartialFailureProjection is AdminProjectionMetadata {
  kind: "admin-partial-failure-projection";
  operationId: ControlPlaneIdentifier;
  @minValue(0)
  @maxValue(1000000)
  completedCount: uint32;
  @minValue(1)
  @maxValue(1000000)
  failedCount: uint32;
  @minItems(1)
  @maxItems(100)
  failures: AdminPartialFailureItem[];
}

model AdminOperationReceipt is AdminProjectionMetadata {
  kind: "admin-operation-receipt";
  receiptId: ControlPlaneIdentifier;
  commandId: ControlPlaneIdentifier;
  outcome: AdminOperationOutcome;
  @minItems(1)
  @maxItems(100)
  @uniqueItems
  affectedReferences: ControlPlaneIdentifier[];
  @minItems(0)
  @maxItems(16)
  @uniqueItems
  approvalReferences: ControlPlaneIdentifier[];
  auditReference: ControlPlaneIdentifier;
  recordedAt: utcDateTime;
}

model AdminOperationCommand {
  schemaVersion: "1.0";
  kind: "admin-operation-command";
  commandId: ControlPlaneIdentifier;
  actorId: ControlPlaneIdentifier;
  activeFunction: AdminFunction;
  action: AdminOperationAction;
  @minItems(1)
  @maxItems(100)
  @uniqueItems
  targetReferences: ControlPlaneIdentifier[];
  reason: RedactedAuthorityText;
  expectedVersion: uint64;
  expectedEtag: AuthorityEtag;
  @minItems(0)
  @maxItems(16)
  @uniqueItems
  approvalReferences: ControlPlaneIdentifier[];
  correlationId: CorrelationId;
  requestedAt: utcDateTime;
}

@jsonSchema
@oneOf
union ControlPlaneDocument {
  accountProjection: AccountProjection,
  sessionProjection: SessionProjection,
  subscriptionProjection: SubscriptionProjection,
  invoiceProjection: InvoiceProjection,
  deviceBindingProjection: DeviceBindingProjection,
  supportCaseProjection: SupportCaseProjection,
  diagnosticConsent: DiagnosticConsent,
  authorityCommand: AuthorityCommand,
  authorityReceipt: AuthorityReceipt,
  authorityError: AuthorityError,
  providerEvent: ProviderEvent,
  auditEvent: AuditEvent,
  offlineEntitlementEnvelope: OfflineEntitlementEnvelope,
  adminAccessContextProjection: AdminAccessContextProjection,
  adminSavedViewProjection: AdminSavedViewProjection,
  adminInboxItemProjection: AdminInboxItemProjection,
  adminInvitationProjection: AdminInvitationProjection,
  adminInvitationCapacityProjection: AdminInvitationCapacityProjection,
  adminGovernanceProjection: AdminGovernanceProjection,
  adminTeamMemberProjection: AdminTeamMemberProjection,
  adminPermissionImpactProjection: AdminPermissionImpactProjection,
  adminJobProjection: AdminJobProjection,
  adminIncidentProjection: AdminIncidentProjection,
  adminConfigurationProjection: AdminConfigurationProjection,
  adminPrivacyCaseProjection: AdminPrivacyCaseProjection,
  adminCapacityProjection: AdminCapacityProjection,
  adminEnvironmentProjection: AdminEnvironmentProjection,
  adminAuditEventProjection: AdminAuditEventProjection,
  adminAlertProjection: AdminAlertProjection,
  adminEmergencyStopProjection: AdminEmergencyStopProjection,
  adminExportProjection: AdminExportProjection,
  adminConflictProjection: AdminConflictProjection,
  adminPartialFailureProjection: AdminPartialFailureProjection,
  adminOperationReceipt: AdminOperationReceipt,
  adminOperationCommand: AdminOperationCommand,
}

op getAccount(): AccountProjection | AuthorityError;

op issueAdminCommand(command: AdminCommand): AuthorityReceipt | AuthorityError;
