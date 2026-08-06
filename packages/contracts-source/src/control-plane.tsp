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
}

op getAccount(): AccountProjection | AuthorityError;

op issueAdminCommand(command: AdminCommand): AuthorityReceipt | AuthorityError;
