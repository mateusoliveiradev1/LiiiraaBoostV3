import type { AdminActionJson, AdminCommandJson, AdminRoleJson } from '@liiiraa/contracts-ts';

export const ADMIN_ROLES = Object.freeze([
  'support',
  'operations',
  'security',
  'audit',
] as const satisfies readonly AdminRoleJson[]);

export type AdminProjectionResource =
  'support-case' | 'device' | 'entitlement' | 'session' | 'diagnostic-metadata' | 'audit-event';

export type AdminProjectionAction = 'list' | 'search' | 'detail';

export interface AdminSessionClaim {
  readonly actorId: string;
  readonly role: AdminRoleJson;
  readonly expiresAt: string;
}

export interface AdminStepUpEvidence {
  readonly method: 'passkey' | 'totp';
  readonly verifiedAt: string;
  readonly expiresAt: string;
  readonly authorizationContextId: string;
  readonly actorId: string;
  readonly action: AdminActionJson;
  readonly resource: AdminProjectionResource;
  readonly redactedTarget: string;
}

export interface AdminCommandAuthorizationContext {
  readonly now: string;
  readonly impactReviewed: boolean;
  readonly confirmed: boolean;
  readonly stepUp?: AdminStepUpEvidence;
}

export type AdminAuthorizationCode =
  | 'AUTHORIZED'
  | 'ACTION_UNAVAILABLE'
  | 'ALERT_REQUIRED'
  | 'BREAK_GLASS_EXPIRY_INVALID'
  | 'CONFIRMATION_REQUIRED'
  | 'IMPACT_REVIEW_REQUIRED'
  | 'REASON_REQUIRED'
  | 'ROLE_FORBIDDEN'
  | 'ROLE_INVALID'
  | 'ROLE_MISMATCH'
  | 'SESSION_EXPIRED'
  | 'STEP_UP_REQUIRED'
  | 'STEP_UP_SCOPE_MISMATCH'
  | 'STEP_UP_STALE';

export type AdminAuthorizationResult = Readonly<{
  allowed: boolean;
  code: AdminAuthorizationCode;
  resource?: AdminProjectionResource;
}>;

export interface AdminCommandPolicy {
  readonly role: AdminRoleJson;
  readonly resource: AdminProjectionResource;
  readonly critical: true;
}

export const ADMIN_COMMAND_POLICIES = Object.freeze({
  'view-support-diagnostics': Object.freeze({
    role: 'security',
    resource: 'diagnostic-metadata',
    critical: true,
  }),
  'revoke-session': Object.freeze({ role: 'security', resource: 'session', critical: true }),
  'revoke-device': Object.freeze({ role: 'security', resource: 'device', critical: true }),
  'correct-entitlement': Object.freeze({
    role: 'operations',
    resource: 'entitlement',
    critical: true,
  }),
  'export-audit-reference': Object.freeze({
    role: 'audit',
    resource: 'audit-event',
    critical: true,
  }),
} as const satisfies Partial<Record<AdminActionJson, AdminCommandPolicy>>);

const ADMIN_PROJECTION_ACCESS = Object.freeze({
  support: Object.freeze(['support-case']),
  operations: Object.freeze(['device', 'entitlement']),
  security: Object.freeze(['session', 'diagnostic-metadata']),
  audit: Object.freeze(['audit-event']),
} as const satisfies Readonly<Record<AdminRoleJson, readonly AdminProjectionResource[]>>);

const ADMIN_STEP_UP_FRESHNESS_MS = 5 * 60 * 1_000;
const BREAK_GLASS_MAX_MS = 15 * 60 * 1_000;
const REDACTED_METADATA_FIELDS = Object.freeze([
  'caseId',
  'accountReference',
  'sessionReference',
  'riskClass',
] as const);

const deny = (code: AdminAuthorizationCode): AdminAuthorizationResult =>
  Object.freeze({ allowed: false, code });

const allow = (resource?: AdminProjectionResource): AdminAuthorizationResult =>
  Object.freeze({ allowed: true, code: 'AUTHORIZED', ...(resource ? { resource } : {}) });

const timestamp = (value: string): number => Date.parse(value);

const isRole = (value: unknown): value is AdminRoleJson =>
  typeof value === 'string' && ADMIN_ROLES.includes(value as AdminRoleJson);

const sessionAdmission = (session: AdminSessionClaim, now: string): AdminAuthorizationResult => {
  if (!isRole(session.role)) return deny('ROLE_INVALID');
  const currentTime = timestamp(now);
  const expiresAt = timestamp(session.expiresAt);
  if (!Number.isFinite(currentTime) || !Number.isFinite(expiresAt) || expiresAt <= currentTime) {
    return deny('SESSION_EXPIRED');
  }
  return allow();
};

export const authorizeAdminProjection = (
  session: AdminSessionClaim,
  request: Readonly<{
    resource: AdminProjectionResource;
    action: AdminProjectionAction;
  }>,
  now: string,
): AdminAuthorizationResult => {
  const admission = sessionAdmission(session, now);
  if (!admission.allowed) return admission;
  return ADMIN_PROJECTION_ACCESS[session.role].includes(request.resource as never)
    ? allow(request.resource)
    : deny('ROLE_FORBIDDEN');
};

const validateStepUp = (
  session: AdminSessionClaim,
  command: AdminCommandJson,
  policy: AdminCommandPolicy,
  context: AdminCommandAuthorizationContext,
): AdminAuthorizationResult => {
  const stepUp = context.stepUp;
  if (stepUp === undefined) return deny('STEP_UP_REQUIRED');
  const now = timestamp(context.now);
  const verifiedAt = timestamp(stepUp.verifiedAt);
  const expiresAt = timestamp(stepUp.expiresAt);
  if (
    !Number.isFinite(verifiedAt) ||
    !Number.isFinite(expiresAt) ||
    verifiedAt > now ||
    now - verifiedAt > ADMIN_STEP_UP_FRESHNESS_MS ||
    expiresAt <= now
  ) {
    return deny('STEP_UP_STALE');
  }
  if (
    stepUp.actorId !== session.actorId ||
    stepUp.actorId !== command.actorId ||
    stepUp.authorizationContextId !== command.authorizationContextId ||
    stepUp.action !== command.action ||
    stepUp.resource !== policy.resource ||
    stepUp.redactedTarget !== command.redactedTarget
  ) {
    return deny('STEP_UP_SCOPE_MISMATCH');
  }
  return allow(policy.resource);
};

export const authorizeAdminCommand = (
  session: AdminSessionClaim,
  command: AdminCommandJson,
  context: AdminCommandAuthorizationContext,
): AdminAuthorizationResult => {
  const admission = sessionAdmission(session, context.now);
  if (!admission.allowed) return admission;
  const policy = ADMIN_COMMAND_POLICIES[command.action as keyof typeof ADMIN_COMMAND_POLICIES] as
    AdminCommandPolicy | undefined;
  if (policy === undefined) return deny('ACTION_UNAVAILABLE');
  if (command.actorId !== session.actorId || command.assumedRole !== session.role) {
    return deny('ROLE_MISMATCH');
  }
  if (policy.role !== session.role) return deny('ROLE_FORBIDDEN');
  if (command.reason.trim().length === 0) return deny('REASON_REQUIRED');
  if (!context.impactReviewed) return deny('IMPACT_REVIEW_REQUIRED');
  if (!context.confirmed) return deny('CONFIRMATION_REQUIRED');
  return validateStepUp(session, command, policy, context);
};

export const filterAdminProjection = <RecordValue>(
  session: AdminSessionClaim,
  resource: AdminProjectionResource,
  records: readonly RecordValue[],
  now: string,
): readonly RecordValue[] =>
  authorizeAdminProjection(session, { resource, action: 'list' }, now).allowed
    ? records
    : Object.freeze([]);

export interface BreakGlassMetadataInput {
  readonly session: AdminSessionClaim;
  readonly now: string;
  readonly reason: string;
  readonly expiresAt: string;
  readonly alerted: boolean;
  readonly stepUp: AdminStepUpEvidence;
  readonly source: Readonly<Record<string, unknown>>;
}

export type BreakGlassMetadataResult = Readonly<{
  allowed: boolean;
  code: AdminAuthorizationCode;
  metadata?: Readonly<Record<string, unknown>>;
}>;

export const projectBreakGlassMetadata = (
  input: BreakGlassMetadataInput,
): BreakGlassMetadataResult => {
  if (!input.alerted) return deny('ALERT_REQUIRED');
  const now = timestamp(input.now);
  const expiresAt = timestamp(input.expiresAt);
  if (
    !Number.isFinite(now) ||
    !Number.isFinite(expiresAt) ||
    expiresAt <= now ||
    expiresAt - now > BREAK_GLASS_MAX_MS
  ) {
    return deny('BREAK_GLASS_EXPIRY_INVALID');
  }
  const authorization = authorizeAdminCommand(
    input.session,
    {
      schemaVersion: '1.0',
      kind: 'admin-command',
      commandId: 'break-glass-admission',
      actorId: input.session.actorId,
      assumedRole: input.session.role,
      action: 'revoke-session',
      redactedTarget: input.stepUp.redactedTarget,
      reason: input.reason,
      authorizationContextId: input.stepUp.authorizationContextId,
      expectedVersion: '0',
      correlationId: 'break-glass-admission',
      requestedAt: input.now,
    },
    { now: input.now, impactReviewed: true, confirmed: true, stepUp: input.stepUp },
  );
  if (!authorization.allowed) return authorization;
  const metadata: Record<string, unknown> = {};
  for (const field of REDACTED_METADATA_FIELDS) {
    const value = input.source[field];
    if (typeof value === 'string') metadata[field] = value;
  }
  return Object.freeze({ allowed: true, code: 'AUTHORIZED', metadata: Object.freeze(metadata) });
};
