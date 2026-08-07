export const ADMIN_FUNCTIONS = Object.freeze([
  'support',
  'operations',
  'security',
  'audit',
] as const);

export type AdminFunction = (typeof ADMIN_FUNCTIONS)[number];
export type AdminRiskLevel = 'routine' | 'sensitive' | 'critical' | 'irreversible';
export type AdminCapability =
  | 'support:reply'
  | 'support:view'
  | 'device:manage'
  | 'entitlement:correct'
  | 'session:revoke'
  | 'diagnostics:view'
  | 'audit:reveal-sensitive'
  | 'audit:export';
export type AdminDataScope =
  | 'support-cases'
  | 'devices'
  | 'entitlements'
  | 'sessions'
  | 'diagnostic-metadata'
  | 'audit-events';

export interface AdminFunctionPolicy {
  readonly navigation: readonly string[];
  readonly dataScopes: readonly AdminDataScope[];
  readonly capabilities: readonly AdminCapability[];
}

export const ADMIN_FUNCTION_POLICIES = Object.freeze({
  support: Object.freeze({
    navigation: Object.freeze(['support'] as const),
    dataScopes: Object.freeze(['support-cases'] as const),
    capabilities: Object.freeze(['support:reply', 'support:view'] as const),
  }),
  operations: Object.freeze({
    navigation: Object.freeze(['operation'] as const),
    dataScopes: Object.freeze(['devices', 'entitlements'] as const),
    capabilities: Object.freeze(['device:manage', 'entitlement:correct'] as const),
  }),
  security: Object.freeze({
    navigation: Object.freeze(['security'] as const),
    dataScopes: Object.freeze(['sessions', 'diagnostic-metadata'] as const),
    capabilities: Object.freeze([
      'session:revoke',
      'diagnostics:view',
      'audit:reveal-sensitive',
    ] as const),
  }),
  audit: Object.freeze({
    navigation: Object.freeze(['security'] as const),
    dataScopes: Object.freeze(['audit-events'] as const),
    capabilities: Object.freeze(['audit:export', 'audit:reveal-sensitive'] as const),
  }),
} as const satisfies Readonly<Record<AdminFunction, AdminFunctionPolicy>>);

export interface AdminMembershipState {
  readonly membershipId: string;
  readonly identityId: string;
  readonly status: 'active' | 'suspended' | 'offboarded';
  readonly functions: readonly AdminFunction[];
  readonly strongFactor: 'passkey' | 'mfa';
  readonly version: bigint;
  readonly activatedAt: string;
}

export type AdminMembershipDecision =
  | Readonly<{ allowed: true; state: AdminMembershipState }>
  | Readonly<{
      allowed: false;
      code:
        | 'ADMIN_INVITATION_REQUIRED'
        | 'VERIFIED_INVITATION_REQUIRED'
        | 'VERIFIED_IDENTITY_REQUIRED'
        | 'STRONG_FACTOR_REQUIRED'
        | 'SHARED_CREDENTIAL_FORBIDDEN'
        | 'FUNCTION_INVALID';
    }>;

const timestamp = (value: string): number => {
  const parsed = Date.parse(value);
  if (!Number.isFinite(parsed)) throw new Error('admin governance requires ISO date-time values');
  return parsed;
};

const nonEmpty = (value: string): boolean => value.trim().length > 0;

const isAdminFunction = (value: unknown): value is AdminFunction =>
  typeof value === 'string' && ADMIN_FUNCTIONS.some((candidate) => candidate === value);

const unique = (values: readonly unknown[]): boolean => new Set(values).size === values.length;

export const decideAdminMembershipActivation = (input: Readonly<{
  membershipId: string;
  identityId: string;
  administrativeInvitationKind: string;
  invitationVerified: boolean;
  emailVerified: boolean;
  strongFactor: string;
  sharedCredential: boolean;
  functions: readonly string[];
  now: string;
}>): AdminMembershipDecision => {
  timestamp(input.now);
  if (input.administrativeInvitationKind !== 'administrative-team') {
    return { allowed: false, code: 'ADMIN_INVITATION_REQUIRED' };
  }
  if (!input.invitationVerified) return { allowed: false, code: 'VERIFIED_INVITATION_REQUIRED' };
  if (!input.emailVerified || !nonEmpty(input.identityId)) {
    return { allowed: false, code: 'VERIFIED_IDENTITY_REQUIRED' };
  }
  if (input.strongFactor !== 'passkey' && input.strongFactor !== 'mfa') {
    return { allowed: false, code: 'STRONG_FACTOR_REQUIRED' };
  }
  if (input.sharedCredential) return { allowed: false, code: 'SHARED_CREDENTIAL_FORBIDDEN' };
  if (
    !nonEmpty(input.membershipId) ||
    input.functions.length === 0 ||
    !unique(input.functions) ||
    input.functions.some((candidate) => !isAdminFunction(candidate))
  ) {
    return { allowed: false, code: 'FUNCTION_INVALID' };
  }
  return {
    allowed: true,
    state: {
      membershipId: input.membershipId,
      identityId: input.identityId,
      status: 'active',
      functions: [...input.functions] as AdminFunction[],
      strongFactor: input.strongFactor,
      version: 1n,
      activatedAt: input.now,
    },
  };
};

export interface AdminGovernedSession {
  readonly sessionId: string;
  readonly actorId: string;
  readonly activeFunction: AdminFunction;
  readonly navigation: readonly string[];
  readonly dataScopes: readonly AdminDataScope[];
  readonly capabilities: readonly AdminCapability[];
  readonly simulation: boolean;
  readonly version: bigint;
}

export type AdminFunctionSwitchDecision =
  | Readonly<{ allowed: true; session: AdminGovernedSession }>
  | Readonly<{
      allowed: false;
      code:
        | 'MEMBERSHIP_INACTIVE'
        | 'FUNCTION_INVALID'
        | 'FUNCTION_NOT_ASSIGNED'
        | 'REASON_REQUIRED'
        | 'REAUTHENTICATION_REQUIRED';
    }>;

const projectSession = (
  source: Readonly<Pick<AdminGovernedSession, 'sessionId' | 'actorId' | 'version'>>,
  activeFunction: AdminFunction,
  simulation: boolean,
): AdminGovernedSession => {
  const policy = ADMIN_FUNCTION_POLICIES[activeFunction];
  return {
    sessionId: source.sessionId,
    actorId: source.actorId,
    activeFunction,
    navigation: [...policy.navigation],
    dataScopes: [...policy.dataScopes],
    capabilities: [...policy.capabilities],
    simulation,
    version: source.version + 1n,
  };
};

export const decideAdminFunctionSwitch = (
  membership: Readonly<AdminMembershipState>,
  session: Readonly<
    Pick<AdminGovernedSession, 'sessionId' | 'actorId' | 'activeFunction' | 'simulation' | 'version'>
  >,
  input: Readonly<{
    targetFunction: string;
    reason: string;
    reauthenticated: boolean;
    now: string;
  }>,
): AdminFunctionSwitchDecision => {
  timestamp(input.now);
  if (membership.status !== 'active' || membership.identityId !== session.actorId) {
    return { allowed: false, code: 'MEMBERSHIP_INACTIVE' };
  }
  if (!isAdminFunction(input.targetFunction)) return { allowed: false, code: 'FUNCTION_INVALID' };
  if (!membership.functions.includes(input.targetFunction)) {
    return { allowed: false, code: 'FUNCTION_NOT_ASSIGNED' };
  }
  if (
    (input.targetFunction === 'security' || input.targetFunction === 'audit') &&
    !nonEmpty(input.reason)
  ) {
    return { allowed: false, code: 'REASON_REQUIRED' };
  }
  if (
    (input.targetFunction === 'security' || input.targetFunction === 'audit') &&
    !input.reauthenticated
  ) {
    return { allowed: false, code: 'REAUTHENTICATION_REQUIRED' };
  }
  return { allowed: true, session: projectSession(session, input.targetFunction, false) };
};

export type AdminCapabilityDecision = Readonly<{
  allowed: boolean;
  code: 'AUTHORIZED' | 'SIMULATION_READ_ONLY' | 'CAPABILITY_FORBIDDEN' | 'SCOPE_FORBIDDEN';
}>;

export const authorizeAdminCapability = (
  session: Readonly<AdminGovernedSession>,
  input: Readonly<{ capability: string; scope: string }>,
): AdminCapabilityDecision => {
  if (session.simulation) return { allowed: false, code: 'SIMULATION_READ_ONLY' };
  if (!session.capabilities.some((candidate) => candidate === input.capability)) {
    return { allowed: false, code: 'CAPABILITY_FORBIDDEN' };
  }
  if (!session.dataScopes.some((candidate) => candidate === input.scope)) {
    return { allowed: false, code: 'SCOPE_FORBIDDEN' };
  }
  return { allowed: true, code: 'AUTHORIZED' };
};

export interface AdminApprovalEvidence {
  readonly actorId: string;
  readonly capabilities: readonly string[];
  readonly scopes: readonly string[];
  readonly approvedAt: string;
}

export type AdminRiskDecision =
  | Readonly<{
      allowed: true;
      auditRequired: true;
      independentApproverIds: readonly string[];
      twoPersonRequired?: true;
      shortApprovalWindow?: true;
    }>
  | Readonly<{
      allowed: false;
      code:
        | 'REASON_REQUIRED'
        | 'REAUTHENTICATION_REQUIRED'
        | 'IMPACT_REVIEW_REQUIRED'
        | 'APPROVAL_WINDOW_INVALID'
        | 'INDEPENDENT_APPROVER_REQUIRED';
    }>;

const APPROVAL_WINDOW_MAX_MS = 15 * 60 * 1_000;

export const decideAdminRiskAdmission = (input: Readonly<{
  risk: AdminRiskLevel;
  actorId: string;
  beneficiaryId: string;
  capability: string;
  scope: string;
  reason: string;
  reauthenticated: boolean;
  impactReviewed: boolean;
  now: string;
  approvalExpiresAt: string;
  massAction: boolean;
  approvers: readonly AdminApprovalEvidence[];
}>): AdminRiskDecision => {
  if (input.risk === 'routine') {
    return { allowed: true, auditRequired: true, independentApproverIds: [] };
  }
  if (!nonEmpty(input.reason)) return { allowed: false, code: 'REASON_REQUIRED' };
  if (!input.reauthenticated) return { allowed: false, code: 'REAUTHENTICATION_REQUIRED' };
  if (input.risk === 'sensitive' && !input.massAction) {
    return { allowed: true, auditRequired: true, independentApproverIds: [] };
  }
  if (!input.impactReviewed) return { allowed: false, code: 'IMPACT_REVIEW_REQUIRED' };
  const now = timestamp(input.now);
  const approvalExpiresAt = timestamp(input.approvalExpiresAt);
  if (
    approvalExpiresAt <= now ||
    approvalExpiresAt - now > APPROVAL_WINDOW_MAX_MS
  ) {
    return { allowed: false, code: 'APPROVAL_WINDOW_INVALID' };
  }
  const eligibleApprovers = input.approvers.filter(
    (approver) =>
      approver.actorId !== input.actorId &&
      approver.actorId !== input.beneficiaryId &&
      approver.capabilities.includes(input.capability) &&
      approver.scopes.includes(input.scope) &&
      timestamp(approver.approvedAt) <= approvalExpiresAt,
  );
  if (eligibleApprovers.length === 0) {
    return { allowed: false, code: 'INDEPENDENT_APPROVER_REQUIRED' };
  }
  const independentApproverIds = [...new Set(eligibleApprovers.map(({ actorId }) => actorId))];
  if (input.risk === 'irreversible' || input.massAction) {
    return {
      allowed: true,
      auditRequired: true,
      independentApproverIds,
      twoPersonRequired: true,
      shortApprovalWindow: true,
    };
  }
  return { allowed: true, auditRequired: true, independentApproverIds };
};

export type AdminBreakGlassDecision =
  | Readonly<{
      allowed: true;
      standingAuthority: false;
      enhancedAuditRequired: true;
    }>
  | Readonly<{
      allowed: false;
      code:
        | 'SOLO_OWNER_REQUIRED'
        | 'BREAK_GLASS_PROHIBITED'
        | 'STRONG_FACTOR_REQUIRED'
        | 'FRESH_REAUTHENTICATION_REQUIRED'
        | 'REASON_REQUIRED'
        | 'SAFETY_DELAY_ACTIVE'
        | 'ALERT_REQUIRED'
        | 'BREAK_GLASS_WINDOW_INVALID';
    }>;

const BREAK_GLASS_MAX_MS = 15 * 60 * 1_000;
const REAUTHENTICATION_FRESH_MS = 5 * 60 * 1_000;

export const decideBreakGlassAdmission = (input: Readonly<{
  actorId: string;
  administratorCount: number;
  risk: AdminRiskLevel;
  massAction: boolean;
  strongFactor: string;
  reauthenticatedAt: string;
  reason: string;
  requestedAt: string;
  safetyDelayUntil: string;
  executeAt: string;
  expiresAt: string;
  alertsSent: boolean;
}>): AdminBreakGlassDecision => {
  if (input.administratorCount !== 1) return { allowed: false, code: 'SOLO_OWNER_REQUIRED' };
  if (input.risk !== 'critical' || input.massAction) {
    return { allowed: false, code: 'BREAK_GLASS_PROHIBITED' };
  }
  if (input.strongFactor !== 'passkey' && input.strongFactor !== 'mfa') {
    return { allowed: false, code: 'STRONG_FACTOR_REQUIRED' };
  }
  const requestedAt = timestamp(input.requestedAt);
  const reauthenticatedAt = timestamp(input.reauthenticatedAt);
  if (
    reauthenticatedAt > requestedAt ||
    requestedAt - reauthenticatedAt > REAUTHENTICATION_FRESH_MS
  ) {
    return { allowed: false, code: 'FRESH_REAUTHENTICATION_REQUIRED' };
  }
  if (!nonEmpty(input.reason)) return { allowed: false, code: 'REASON_REQUIRED' };
  if (timestamp(input.executeAt) < timestamp(input.safetyDelayUntil)) {
    return { allowed: false, code: 'SAFETY_DELAY_ACTIVE' };
  }
  if (!input.alertsSent) return { allowed: false, code: 'ALERT_REQUIRED' };
  const expiresAt = timestamp(input.expiresAt);
  if (expiresAt <= requestedAt || expiresAt - requestedAt > BREAK_GLASS_MAX_MS) {
    return { allowed: false, code: 'BREAK_GLASS_WINDOW_INVALID' };
  }
  return { allowed: true, standingAuthority: false, enhancedAuditRequired: true };
};

export interface AdminDelegationState {
  readonly delegationId: string;
  readonly delegatorId: string;
  readonly delegateId: string;
  readonly capabilities: readonly string[];
  readonly scopes: readonly string[];
  readonly purpose: string;
  readonly status: 'active' | 'expired' | 'revoked';
  readonly version: bigint;
  readonly createdAt: string;
  readonly expiresAt: string;
  readonly expiredAt?: string;
}

export type AdminDelegationDecision =
  | Readonly<{ allowed: true; state: AdminDelegationState }>
  | Readonly<{
      allowed: false;
      code:
        | 'DELEGATION_INPUT_INVALID'
        | 'DELEGATION_PURPOSE_REQUIRED'
        | 'DELEGATION_APPROVAL_REQUIRED'
        | 'DELEGATION_WINDOW_INVALID';
    }>;

const DELEGATION_MAX_MS = 30 * 24 * 60 * 60 * 1_000;

export const decideAdminDelegation = (input: Readonly<{
  delegationId: string;
  delegatorId: string;
  delegateId: string;
  capabilities: readonly string[];
  scopes: readonly string[];
  purpose: string;
  risk: AdminRiskLevel;
  approved: boolean;
  now: string;
  expiresAt: string;
}>): AdminDelegationDecision => {
  if (
    !nonEmpty(input.delegationId) ||
    !nonEmpty(input.delegatorId) ||
    !nonEmpty(input.delegateId) ||
    input.delegatorId === input.delegateId ||
    input.capabilities.length === 0 ||
    input.scopes.length === 0
  ) {
    return { allowed: false, code: 'DELEGATION_INPUT_INVALID' };
  }
  if (!nonEmpty(input.purpose)) return { allowed: false, code: 'DELEGATION_PURPOSE_REQUIRED' };
  if (input.risk !== 'routine' && !input.approved) {
    return { allowed: false, code: 'DELEGATION_APPROVAL_REQUIRED' };
  }
  const now = timestamp(input.now);
  const expiresAt = timestamp(input.expiresAt);
  if (expiresAt <= now || expiresAt - now > DELEGATION_MAX_MS) {
    return { allowed: false, code: 'DELEGATION_WINDOW_INVALID' };
  }
  return {
    allowed: true,
    state: {
      delegationId: input.delegationId,
      delegatorId: input.delegatorId,
      delegateId: input.delegateId,
      capabilities: [...input.capabilities],
      scopes: [...input.scopes],
      purpose: input.purpose,
      status: 'active',
      version: 1n,
      createdAt: input.now,
      expiresAt: input.expiresAt,
    },
  };
};

export const evaluateAdminDelegation = (
  state: Readonly<AdminDelegationState>,
  now: string,
): Readonly<{ active: boolean; state: AdminDelegationState }> => {
  if (state.status !== 'active' || timestamp(now) < timestamp(state.expiresAt)) {
    return { active: state.status === 'active', state };
  }
  return {
    active: false,
    state: {
      ...state,
      status: 'expired',
      version: state.version + 1n,
      expiredAt: now,
    },
  };
};

export type AdminOffboardingEffect = Readonly<{
  kind:
    | 'suspend-membership'
    | 'revoke-sessions'
    | 'revoke-delegations'
    | 'remove-future-approvals'
    | 'reassign-pending-work'
    | 'preserve-immutable-history';
}>;

export const decideAdminOffboarding = (input: Readonly<{
  identityId: string;
  now: string;
  reason: string;
}>):
  | Readonly<{ allowed: true; effects: readonly AdminOffboardingEffect[] }>
  | Readonly<{ allowed: false; code: 'OFFBOARDING_INPUT_INVALID' }> => {
  timestamp(input.now);
  if (!nonEmpty(input.identityId) || !nonEmpty(input.reason)) {
    return { allowed: false, code: 'OFFBOARDING_INPUT_INVALID' };
  }
  return {
    allowed: true,
    effects: [
      { kind: 'suspend-membership' },
      { kind: 'revoke-sessions' },
      { kind: 'revoke-delegations' },
      { kind: 'remove-future-approvals' },
      { kind: 'reassign-pending-work' },
      { kind: 'preserve-immutable-history' },
    ],
  };
};

const DAY_MS = 24 * 60 * 60 * 1_000;

export const evaluateAdminAccessGovernance = (input: Readonly<{
  accessClass: 'critical' | 'read-only' | 'other';
  now: string;
  lastReviewedAt: string;
  lastActiveAt: string;
  deviationDetected: boolean;
}>): Readonly<{
  reviewDue: boolean;
  inactivityAction: 'none' | 'warn' | 'suspend';
  deviationAlertRequired: boolean;
}> => {
  const now = timestamp(input.now);
  const reviewAge = now - timestamp(input.lastReviewedAt);
  const inactivityAge = now - timestamp(input.lastActiveAt);
  const critical = input.accessClass === 'critical';
  const reviewDue = reviewAge >= (critical ? 30 : 90) * DAY_MS;
  const suspendAt = (critical ? 45 : 90) * DAY_MS;
  const warnAt = (critical ? 38 : 80) * DAY_MS;
  const inactivityAction =
    inactivityAge >= suspendAt ? 'suspend' : inactivityAge >= warnAt ? 'warn' : 'none';
  return {
    reviewDue,
    inactivityAction,
    deviationAlertRequired: input.deviationDetected,
  };
};

export const decideAdminReactivation = (input: Readonly<{
  suspended: boolean;
  freshVerification: boolean;
}>):
  | Readonly<{ allowed: true }>
  | Readonly<{ allowed: false; code: 'ACCESS_NOT_SUSPENDED' | 'FRESH_VERIFICATION_REQUIRED' }> => {
  if (!input.suspended) return { allowed: false, code: 'ACCESS_NOT_SUSPENDED' };
  if (!input.freshVerification) {
    return { allowed: false, code: 'FRESH_VERIFICATION_REQUIRED' };
  }
  return { allowed: true };
};

export const projectAdminFunctionSimulation = (
  membership: Readonly<AdminMembershipState>,
  targetFunction: string,
):
  | Readonly<{
      allowed: true;
      session: AdminGovernedSession;
      canAuthorizeAction: false;
    }>
  | Readonly<{ allowed: false; code: 'FUNCTION_INVALID' | 'FUNCTION_NOT_ASSIGNED' }> => {
  if (!isAdminFunction(targetFunction)) return { allowed: false, code: 'FUNCTION_INVALID' };
  if (!membership.functions.includes(targetFunction)) {
    return { allowed: false, code: 'FUNCTION_NOT_ASSIGNED' };
  }
  return {
    allowed: true,
    session: projectSession(
      {
        sessionId: 'simulation',
        actorId: membership.identityId,
        version: 0n,
      },
      targetFunction,
      true,
    ),
    canAuthorizeAction: false,
  };
};

export const projectAdminAuditField = (input: Readonly<{
  value: string;
  reveal: boolean;
  activeFunction?: string;
  capabilities?: readonly string[];
  reason?: string;
}>):
  | Readonly<{ allowed: true; value: string; auditRequired?: true }>
  | Readonly<{ allowed: false; code: 'AUDIT_REVEAL_FORBIDDEN' }> => {
  if (!input.reveal) return { allowed: true, value: '[masked]' };
  if (
    (input.activeFunction !== 'security' && input.activeFunction !== 'audit') ||
    !input.capabilities?.includes('audit:reveal-sensitive') ||
    input.reason === undefined ||
    !nonEmpty(input.reason)
  ) {
    return { allowed: false, code: 'AUDIT_REVEAL_FORBIDDEN' };
  }
  return { allowed: true, value: input.value, auditRequired: true };
};
