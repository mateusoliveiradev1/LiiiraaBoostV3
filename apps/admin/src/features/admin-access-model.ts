import type {
  AdminFreshnessStateJson,
  AdminFunctionJson,
  AdminRiskLevelJson,
} from '@liiiraa/contracts-ts';

export type AccessAuthorityState = Readonly<{
  canMutate: boolean;
  requiresRefetch: boolean;
  state: AdminFreshnessStateJson;
}>;

type PresentationFunction = Extract<
  AdminFunctionJson,
  'support' | 'operations' | 'security' | 'audit'
>;

const FUNCTION_POLICIES = Object.freeze({
  audit: Object.freeze({
    capabilities: Object.freeze(['audit:export', 'audit:reveal-sensitive']),
    dataScopes: Object.freeze(['audit-events']),
    navigation: Object.freeze(['security']),
  }),
  operations: Object.freeze({
    capabilities: Object.freeze(['device:manage', 'entitlement:correct']),
    dataScopes: Object.freeze(['devices', 'entitlements']),
    navigation: Object.freeze(['operation']),
  }),
  security: Object.freeze({
    capabilities: Object.freeze(['session:revoke', 'diagnostics:view', 'audit:reveal-sensitive']),
    dataScopes: Object.freeze(['sessions', 'diagnostic-metadata']),
    navigation: Object.freeze(['security']),
  }),
  support: Object.freeze({
    capabilities: Object.freeze(['support:reply', 'support:view']),
    dataScopes: Object.freeze(['support-cases']),
    navigation: Object.freeze(['support']),
  }),
} satisfies Readonly<
  Record<
    PresentationFunction,
    Readonly<{
      capabilities: readonly string[];
      dataScopes: readonly string[];
      navigation: readonly string[];
    }>
  >
>);

const isPresentationFunction = (value: string): value is PresentationFunction =>
  Object.hasOwn(FUNCTION_POLICIES, value);

const timestamp = (value: string, code: string): number => {
  const parsed = Date.parse(value);
  if (!Number.isFinite(parsed)) throw new Error(code);
  return parsed;
};

const reasonValid = (value: string): boolean => {
  const length = value.trim().length;
  return length >= 8 && length <= 512;
};

const boundedReferences = (values: readonly string[], maximum = 128): boolean =>
  values.length <= maximum &&
  new Set(values).size === values.length &&
  values.every((value) => value.length >= 1 && value.length <= 256);

const difference = (left: readonly string[], right: readonly string[]): readonly string[] =>
  Object.freeze(left.filter((value) => !right.includes(value)));

export const deriveAccessAuthorityState = (
  input: Readonly<{
    freshness: AdminFreshnessStateJson;
    invalidated: boolean;
  }>,
): AccessAuthorityState => {
  if (input.invalidated || input.freshness === 'stale') {
    return Object.freeze({ canMutate: false, requiresRefetch: true, state: 'stale' });
  }
  if (input.freshness === 'live') {
    return Object.freeze({ canMutate: true, requiresRefetch: false, state: 'live' });
  }
  return Object.freeze({
    canMutate: false,
    requiresRefetch: input.freshness === 'reconnecting' || input.freshness === 'degraded',
    state: input.freshness,
  });
};

export const projectFunctionSwitch = (
  input: Readonly<{
    assignedFunctions: readonly string[];
    currentFunction: string;
    targetFunction: string;
  }>,
) => {
  if (!isPresentationFunction(input.targetFunction)) {
    return Object.freeze({ admitted: false as const, code: 'FUNCTION_INVALID' as const });
  }
  if (!input.assignedFunctions.includes(input.targetFunction)) {
    return Object.freeze({ admitted: false as const, code: 'FUNCTION_NOT_ASSIGNED' as const });
  }
  if (input.currentFunction === input.targetFunction) {
    return Object.freeze({ admitted: false as const, code: 'FUNCTION_ALREADY_ACTIVE' as const });
  }
  const policy = FUNCTION_POLICIES[input.targetFunction];
  const sensitive = input.targetFunction === 'security' || input.targetFunction === 'audit';
  return Object.freeze({
    admitted: true as const,
    activeFunction: input.targetFunction,
    capabilities: policy.capabilities,
    dataScopes: policy.dataScopes,
    focusTarget: 'admin-main' as const,
    navigation: policy.navigation,
    reasonRequired: sensitive,
    reauthenticationRequired: sensitive,
  });
};

export type PermissionAssignment = Readonly<{
  capabilities: readonly string[];
  functions: readonly string[];
  scopes: readonly string[];
}>;

export const projectPermissionImpact = (
  input: Readonly<{
    after: PermissionAssignment;
    before: PermissionAssignment;
    conflicts: readonly string[];
    sessionReferences: readonly string[];
  }>,
) => {
  if (
    !boundedReferences(input.after.capabilities, 64) ||
    !boundedReferences(input.after.functions, 16) ||
    !boundedReferences(input.after.scopes, 64) ||
    !boundedReferences(input.before.capabilities, 64) ||
    !boundedReferences(input.before.functions, 16) ||
    !boundedReferences(input.before.scopes, 64) ||
    !boundedReferences(input.conflicts, 32) ||
    !boundedReferences(input.sessionReferences, 100)
  ) {
    throw new Error('GOVERNANCE_IMPACT_INVALID');
  }
  return Object.freeze({
    affectedData: Object.freeze(
      [...new Set([...input.after.scopes, ...input.before.scopes])].sort(),
    ),
    conflicts: Object.freeze([...input.conflicts]),
    gainedCapabilities: difference(input.after.capabilities, input.before.capabilities),
    gainedFunctions: difference(input.after.functions, input.before.functions),
    gainedScopes: difference(input.after.scopes, input.before.scopes),
    lostCapabilities: difference(input.before.capabilities, input.after.capabilities),
    lostFunctions: difference(input.before.functions, input.after.functions),
    lostScopes: difference(input.before.scopes, input.after.scopes),
    sessionRevocationRequired: input.sessionReferences.length > 0,
    sessionsToRevoke: Object.freeze([...input.sessionReferences]),
  });
};

export type GovernanceApproverCandidate = Readonly<{
  actorReference: string;
  capabilities: readonly string[];
  expiresAt?: string;
  scopes: readonly string[];
  state: 'active' | 'suspended' | 'offboarded';
}>;

export const eligibleGovernanceApprovers = (
  input: Readonly<{
    authorReference: string;
    beneficiaryReference: string;
    candidates: readonly GovernanceApproverCandidate[];
    capability: string;
    now: string;
    scope: string;
  }>,
): readonly string[] => {
  const current = timestamp(input.now, 'GOVERNANCE_APPROVER_NOW_INVALID');
  const eligible = input.candidates
    .filter(
      (candidate) =>
        candidate.state === 'active' &&
        candidate.actorReference !== input.authorReference &&
        candidate.actorReference !== input.beneficiaryReference &&
        candidate.capabilities.includes(input.capability) &&
        candidate.scopes.includes(input.scope) &&
        (candidate.expiresAt === undefined ||
          timestamp(candidate.expiresAt, 'GOVERNANCE_APPROVER_EXPIRY_INVALID') > current),
    )
    .map((candidate) => candidate.actorReference);
  return Object.freeze([...new Set(eligible)]);
};

const APPROVAL_WINDOW_MS = 15 * 60 * 1_000;

export const reviewGovernanceTransition = (
  input: Readonly<{
    approvalExpiresAt?: string;
    approvalReferences: readonly string[];
    authority: AdminFreshnessStateJson;
    impactReviewed: boolean;
    massAction: boolean;
    now: string;
    reason: string;
    reauthenticated: boolean;
    risk: AdminRiskLevelJson;
  }>,
) => {
  if (input.authority !== 'live') {
    return Object.freeze({
      admitted: false as const,
      code: 'AUTHORITATIVE_REFRESH_REQUIRED' as const,
    });
  }
  const routine = input.risk === 'low';
  if (!routine && !reasonValid(input.reason)) {
    return Object.freeze({ admitted: false as const, code: 'REASON_REQUIRED' as const });
  }
  if (!routine && !input.reauthenticated) {
    return Object.freeze({ admitted: false as const, code: 'REAUTHENTICATION_REQUIRED' as const });
  }
  const requiresImpact =
    input.risk === 'critical' || input.risk === 'irreversible' || input.massAction;
  if (requiresImpact && !input.impactReviewed) {
    return Object.freeze({ admitted: false as const, code: 'IMPACT_REVIEW_REQUIRED' as const });
  }
  const requiresApproval =
    input.risk === 'high' ||
    input.risk === 'critical' ||
    input.risk === 'irreversible' ||
    input.massAction;
  if (requiresApproval) {
    if (!boundedReferences(input.approvalReferences, 16) || input.approvalReferences.length === 0) {
      return Object.freeze({
        admitted: false as const,
        code: 'INDEPENDENT_APPROVER_REQUIRED' as const,
      });
    }
    if (input.approvalExpiresAt === undefined) {
      return Object.freeze({ admitted: false as const, code: 'APPROVAL_WINDOW_INVALID' as const });
    }
    const current = timestamp(input.now, 'GOVERNANCE_NOW_INVALID');
    const expires = timestamp(input.approvalExpiresAt, 'GOVERNANCE_APPROVAL_EXPIRY_INVALID');
    if (expires <= current || expires - current > APPROVAL_WINDOW_MS) {
      return Object.freeze({ admitted: false as const, code: 'APPROVAL_WINDOW_INVALID' as const });
    }
  }
  return Object.freeze({
    admitted: true as const,
    auditRequired: true as const,
    independentApprovalRequired: requiresApproval,
    sessionRevocationRequired: true as const,
    twoPersonRequired: input.risk === 'irreversible' || input.massAction,
  });
};

export const projectDelegationWindow = (
  input: Readonly<{
    capabilities: readonly string[];
    expiresAt: string;
    now: string;
    scopes: readonly string[];
    state: 'active' | 'expired' | 'revoked';
  }>,
) => {
  if (!boundedReferences(input.capabilities, 64) || !boundedReferences(input.scopes, 64)) {
    throw new Error('GOVERNANCE_DELEGATION_INVALID');
  }
  const remaining = Math.max(
    0,
    timestamp(input.expiresAt, 'GOVERNANCE_DELEGATION_EXPIRY_INVALID') -
      timestamp(input.now, 'GOVERNANCE_DELEGATION_NOW_INVALID'),
  );
  const active = input.state === 'active' && remaining > 0;
  return Object.freeze({
    active,
    ...(active
      ? {
          capabilities: Object.freeze([...input.capabilities]),
          scopes: Object.freeze([...input.scopes]),
        }
      : {
          consequences: Object.freeze([
            'capabilities-revoked',
            'scopes-revoked',
            'sessions-revalidated',
          ]),
          expired: input.state === 'expired' || remaining === 0,
        }),
    expiresInMinutes: Math.ceil(remaining / (60 * 1_000)),
  });
};

const DAY_MS = 24 * 60 * 60 * 1_000;

export const projectAccessReview = (
  input: Readonly<{
    accessClass: 'critical' | 'read-only' | 'other';
    deviationDetected: boolean;
    lastActiveAt: string;
    lastReviewedAt: string;
    now: string;
  }>,
) => {
  const current = timestamp(input.now, 'GOVERNANCE_REVIEW_NOW_INVALID');
  const reviewAge = current - timestamp(input.lastReviewedAt, 'GOVERNANCE_REVIEW_AT_INVALID');
  const inactivityAge = current - timestamp(input.lastActiveAt, 'GOVERNANCE_ACTIVITY_INVALID');
  if (reviewAge < 0 || inactivityAge < 0) throw new Error('GOVERNANCE_REVIEW_CLOCK_INVALID');
  const critical = input.accessClass === 'critical';
  const reviewDue = reviewAge >= (critical ? 30 : 90) * DAY_MS;
  const inactivityAction =
    inactivityAge >= (critical ? 45 : 90) * DAY_MS
      ? ('suspend' as const)
      : inactivityAge >= (critical ? 38 : 80) * DAY_MS
        ? ('warn' as const)
        : ('none' as const);
  return Object.freeze({
    deviationAlertRequired: input.deviationDetected,
    inactivityAction,
    reviewDue,
  });
};

export const projectAdminOffboarding = (
  input: Readonly<{
    identityReference: string;
    reason: string;
  }>,
) => {
  if (input.identityReference.length < 1 || !reasonValid(input.reason)) {
    return Object.freeze({ admitted: false as const, code: 'OFFBOARDING_INPUT_INVALID' as const });
  }
  return Object.freeze({
    admitted: true as const,
    effects: Object.freeze([
      'suspend-membership',
      'revoke-sessions',
      'revoke-delegations',
      'remove-future-approvals',
      'reassign-pending-work',
      'preserve-immutable-history',
    ]),
    irreversible: true as const,
  });
};

export const projectFunctionSimulation = (
  input: Readonly<{
    assignedFunctions: readonly string[];
    targetFunction: string;
  }>,
) => {
  if (!isPresentationFunction(input.targetFunction)) {
    return Object.freeze({ admitted: false as const, code: 'FUNCTION_INVALID' as const });
  }
  if (!input.assignedFunctions.includes(input.targetFunction)) {
    return Object.freeze({ admitted: false as const, code: 'FUNCTION_NOT_ASSIGNED' as const });
  }
  const policy = FUNCTION_POLICIES[input.targetFunction];
  return Object.freeze({
    admitted: true as const,
    activeFunction: input.targetFunction,
    canAuthorizeAction: false as const,
    capabilities: policy.capabilities,
    dataScopes: policy.dataScopes,
    navigation: policy.navigation,
    secretsInherited: false as const,
    simulation: true as const,
  });
};

const BREAK_GLASS_WINDOW_MS = 15 * 60 * 1_000;
const REAUTHENTICATION_WINDOW_MS = 5 * 60 * 1_000;

export const reviewBreakGlass = (
  input: Readonly<{
    administratorCount: number;
    alertsSent: boolean;
    executeAt: string;
    expiresAt: string;
    massAction: boolean;
    now: string;
    reason: string;
    reauthenticatedAt: string;
    risk: AdminRiskLevelJson;
    safetyDelayUntil: string;
    strongFactor: string;
  }>,
) => {
  if (input.administratorCount !== 1) {
    return Object.freeze({ admitted: false as const, code: 'SOLO_OWNER_REQUIRED' as const });
  }
  if (input.risk !== 'critical' || input.massAction) {
    return Object.freeze({ admitted: false as const, code: 'BREAK_GLASS_PROHIBITED' as const });
  }
  if (input.strongFactor !== 'passkey' && input.strongFactor !== 'mfa') {
    return Object.freeze({ admitted: false as const, code: 'STRONG_FACTOR_REQUIRED' as const });
  }
  const current = timestamp(input.now, 'BREAK_GLASS_NOW_INVALID');
  const reauthenticated = timestamp(input.reauthenticatedAt, 'BREAK_GLASS_REAUTH_INVALID');
  if (reauthenticated > current || current - reauthenticated > REAUTHENTICATION_WINDOW_MS) {
    return Object.freeze({
      admitted: false as const,
      code: 'FRESH_REAUTHENTICATION_REQUIRED' as const,
    });
  }
  if (!reasonValid(input.reason)) {
    return Object.freeze({ admitted: false as const, code: 'REASON_REQUIRED' as const });
  }
  const executeAt = timestamp(input.executeAt, 'BREAK_GLASS_EXECUTE_INVALID');
  if (executeAt < timestamp(input.safetyDelayUntil, 'BREAK_GLASS_DELAY_INVALID')) {
    return Object.freeze({ admitted: false as const, code: 'SAFETY_DELAY_ACTIVE' as const });
  }
  if (!input.alertsSent) {
    return Object.freeze({ admitted: false as const, code: 'ALERT_REQUIRED' as const });
  }
  const expiresAt = timestamp(input.expiresAt, 'BREAK_GLASS_EXPIRY_INVALID');
  if (expiresAt <= current || expiresAt - current > BREAK_GLASS_WINDOW_MS) {
    return Object.freeze({ admitted: false as const, code: 'BREAK_GLASS_WINDOW_INVALID' as const });
  }
  return Object.freeze({
    admitted: true as const,
    enhancedAuditRequired: true as const,
    executeAt: input.executeAt,
    expiresAt: input.expiresAt,
    standingAuthority: false as const,
  });
};

const GOVERNANCE_HISTORY_KINDS = new Set([
  'approval',
  'delegation',
  'access-review',
  'permission-change',
  'function-switch',
  'offboarding',
  'break-glass',
]);

export const maskGovernanceHistory = (
  events: readonly Readonly<Record<string, unknown>>[],
): readonly Readonly<{ at: string; kind: string; outcome?: string }>[] =>
  Object.freeze(
    events.map((event) => {
      const at = event['at'];
      const kind = event['kind'];
      const outcome = event['outcome'];
      if (
        typeof at !== 'string' ||
        Number.isNaN(Date.parse(at)) ||
        typeof kind !== 'string' ||
        !GOVERNANCE_HISTORY_KINDS.has(kind) ||
        (outcome !== undefined && typeof outcome !== 'string')
      ) {
        throw new Error('GOVERNANCE_HISTORY_INVALID');
      }
      const safeOutcome =
        outcome === undefined
          ? undefined
          : outcome.includes('@') || outcome.length > 128
            ? '[masked]'
            : outcome;
      return Object.freeze({
        at,
        kind,
        ...(safeOutcome === undefined ? {} : { outcome: safeOutcome }),
      });
    }),
  );

export type GovernanceDraft = Readonly<{ reason: string; risk: AdminRiskLevelJson }>;

export const reconcileGovernanceDraft = (
  input: Readonly<{
    base: GovernanceDraft;
    current: GovernanceDraft;
    currentVersion: string;
    draft: GovernanceDraft;
    expectedVersion: string;
  }>,
) => {
  if (input.currentVersion === input.expectedVersion) {
    return Object.freeze({ draft: input.draft, status: 'current' as const });
  }
  const fields = ['reason', 'risk'] as const;
  const conflicting = fields.filter(
    (field) =>
      input.current[field] !== input.base[field] &&
      input.draft[field] !== input.base[field] &&
      input.current[field] !== input.draft[field],
  );
  if (conflicting.length > 0) {
    return Object.freeze({
      currentVersion: input.currentVersion,
      expectedVersion: input.expectedVersion,
      preservedDraft: Object.freeze(
        Object.fromEntries(
          conflicting.map((field) => [field, input.draft[field]]),
        ) as Partial<GovernanceDraft>,
      ),
      status: 'review' as const,
    });
  }
  return Object.freeze({
    currentVersion: input.currentVersion,
    expectedVersion: input.expectedVersion,
    merged: Object.freeze({
      reason: input.draft.reason !== input.base.reason ? input.draft.reason : input.current.reason,
      risk: input.draft.risk !== input.base.risk ? input.draft.risk : input.current.risk,
    }),
    status: 'merged' as const,
  });
};
