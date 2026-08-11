import {
  ADMIN_FUNCTION_POLICIES,
  decideAdminDelegation,
  decideAdminFunctionSwitch,
  decideAdminMembershipActivation,
  decideAdminOffboarding,
  evaluateAdminAccessGovernance,
  evaluateAdminDelegation,
  projectAdminAuditField,
  projectAdminFunctionSimulation,
  type AdminFunction,
  type AdminGovernedSession,
  type AdminRiskLevel,
} from '@liiiraa/control-plane-domain/admin/governance';

import type {
  AdminAccessReviewRecord,
  AdminApprovalRequest,
  AdminGovernanceCapability,
  AdminGovernanceCommandResult,
  AdminGovernanceDependencies,
  AdminGovernanceStepUpEvidence,
  AdminGovernanceTransaction,
  AdminPermissionAssignment,
  AdminPermissionImpact,
  PersistedAdminMembership,
} from '../ports/admin-governance.js';

const STEP_UP_FRESHNESS_MS = 5 * 60 * 1_000;
const APPROVAL_WINDOW_MS = 15 * 60 * 1_000;

const failure = (code: string): AdminGovernanceCommandResult => Object.freeze({ ok: false, code });

const timestamp = (value: string): number | null => {
  const parsed = Date.parse(value);
  return Number.isFinite(parsed) ? parsed : null;
};

const authorize = (
  dependencies: AdminGovernanceDependencies,
  actorId: string,
  capability: AdminGovernanceCapability,
): Promise<boolean> => dependencies.authorization.authorize({ actorId, capability });

interface StepUpBinding {
  readonly actorId: string;
  readonly authorizationContextId: string;
  readonly action: string;
  readonly resource: string;
  readonly redactedTarget: string;
}

const admitStepUp = async (
  dependencies: AdminGovernanceDependencies,
  evidence: AdminGovernanceStepUpEvidence | undefined,
  binding: StepUpBinding,
  now: string,
): Promise<boolean> => {
  if (evidence === undefined) return false;
  const current = timestamp(now);
  const verifiedAt = timestamp(evidence.verifiedAt);
  const expiresAt = timestamp(evidence.expiresAt);
  if (
    current === null ||
    verifiedAt === null ||
    expiresAt === null ||
    verifiedAt > current ||
    current - verifiedAt > STEP_UP_FRESHNESS_MS ||
    expiresAt <= current ||
    evidence.actorId !== binding.actorId ||
    evidence.authorizationContextId !== binding.authorizationContextId ||
    evidence.action !== binding.action ||
    evidence.resource !== binding.resource ||
    evidence.redactedTarget !== binding.redactedTarget
  ) {
    return false;
  }
  return dependencies.stepUp.verify(evidence);
};

const unique = <Value>(values: readonly Value[]): readonly Value[] => [...new Set(values)];

const snapshotAssignment = (assignment: AdminPermissionAssignment): AdminPermissionAssignment =>
  Object.freeze({
    functions: Object.freeze([...assignment.functions]),
    capabilities: Object.freeze([...assignment.capabilities]),
    scopes: Object.freeze([...assignment.scopes]),
  });

const assignmentForFunctions = (functions: readonly AdminFunction[]): AdminPermissionAssignment =>
  snapshotAssignment({
    functions: unique(functions),
    capabilities: unique(
      functions.flatMap((adminFunction) => [
        ...ADMIN_FUNCTION_POLICIES[adminFunction].capabilities,
      ]),
    ),
    scopes: unique(
      functions.flatMap((adminFunction) => [...ADMIN_FUNCTION_POLICIES[adminFunction].dataScopes]),
    ),
  });

const difference = <Value>(left: readonly Value[], right: readonly Value[]): readonly Value[] =>
  left.filter((value) => !right.includes(value));

const projectPermissionImpact = (
  dependencies: AdminGovernanceDependencies,
  membership: PersistedAdminMembership,
  proposed: AdminPermissionAssignment,
  projectedAt: string,
): AdminPermissionImpact =>
  Object.freeze({
    impactId: dependencies.ids.next(),
    identityId: membership.identityId,
    membershipVersion: membership.version,
    before: snapshotAssignment(membership.permissions),
    after: snapshotAssignment(proposed),
    gainedFunctions: difference(proposed.functions, membership.permissions.functions),
    lostFunctions: difference(membership.permissions.functions, proposed.functions),
    gainedCapabilities: difference(proposed.capabilities, membership.permissions.capabilities),
    lostCapabilities: difference(membership.permissions.capabilities, proposed.capabilities),
    gainedScopes: difference(proposed.scopes, membership.permissions.scopes),
    lostScopes: difference(membership.permissions.scopes, proposed.scopes),
    affectedSessions: true,
    invalidatesPendingApprovals: true,
    projectedAt,
  });

const sameValues = (left: readonly unknown[], right: readonly unknown[]): boolean =>
  left.length === right.length && left.every((value, index) => value === right[index]);

const matchesImpact = (expected: AdminPermissionImpact, supplied: AdminPermissionImpact): boolean =>
  expected.identityId === supplied.identityId &&
  expected.membershipVersion === supplied.membershipVersion &&
  sameValues(expected.before.functions, supplied.before.functions) &&
  sameValues(expected.before.capabilities, supplied.before.capabilities) &&
  sameValues(expected.before.scopes, supplied.before.scopes) &&
  sameValues(expected.after.functions, supplied.after.functions) &&
  sameValues(expected.after.capabilities, supplied.after.capabilities) &&
  sameValues(expected.after.scopes, supplied.after.scopes);

const hasIndependentApproval = async (
  transaction: AdminGovernanceTransaction,
  requestIds: readonly string[],
  input: Readonly<{
    actorId: string;
    beneficiaryId: string;
    capability: string;
    scope: string;
    now: string;
  }>,
): Promise<boolean> => {
  if (requestIds.length === 0) return false;
  const now = timestamp(input.now);
  if (now === null) return false;
  for (const requestId of unique(requestIds)) {
    const approval = await transaction.loadApproval(requestId);
    const expiresAt = approval === null ? null : timestamp(approval.expiresAt);
    if (
      approval?.status !== 'approved' ||
      approval.approverId === undefined ||
      approval.approverId === input.actorId ||
      approval.approverId === input.beneficiaryId ||
      approval.authorId === approval.approverId ||
      approval.capability !== input.capability ||
      approval.scope !== input.scope ||
      expiresAt === null ||
      expiresAt <= now
    ) {
      return false;
    }
  }
  return true;
};

const rememberOutcome = async (
  dependencies: AdminGovernanceDependencies,
  transaction: AdminGovernanceTransaction,
  input: Readonly<{
    actorId: string;
    commandId: string;
    subjectId: string;
    outcome: string;
    occurredAt: string;
    audit: Readonly<Record<string, unknown>>;
    result?: Readonly<Record<string, unknown>>;
  }>,
): Promise<AdminGovernanceCommandResult> => {
  const auditReference = await transaction.appendAudit({
    eventId: dependencies.ids.next(),
    actorId: input.actorId,
    subjectId: input.subjectId,
    action: input.outcome,
    occurredAt: input.occurredAt,
    ...input.audit,
  });
  await transaction.enqueueOutbox({
    outboxId: dependencies.ids.next(),
    topic: 'admin.governance.changed',
    commandId: input.commandId,
    subjectId: input.subjectId,
    outcome: input.outcome,
    auditReference,
    availableAt: input.occurredAt,
  });
  await transaction.saveReceipt({
    receiptId: dependencies.ids.next(),
    commandId: input.commandId,
    actorId: input.actorId,
    subjectId: input.subjectId,
    outcome: input.outcome,
    occurredAt: input.occurredAt,
    auditReference,
  });
  const result = Object.freeze({
    ok: true,
    outcome: input.outcome,
    auditReference,
    ...input.result,
  });
  await transaction.rememberCommandResult(input.commandId, result);
  return result;
};

export interface ActivateAdminMembershipInput {
  readonly actorId: string;
  readonly commandId: string;
  readonly identityId: string;
  readonly membershipId: string;
  readonly administrativeInvitationKind: string;
  readonly invitationVerified: boolean;
  readonly emailVerified: boolean;
  readonly strongFactor: string;
  readonly sharedCredential: boolean;
  readonly functions: readonly string[];
}

export const activateAdminMembership = async (
  dependencies: AdminGovernanceDependencies,
  input: ActivateAdminMembershipInput,
): Promise<AdminGovernanceCommandResult> => {
  if (!(await authorize(dependencies, input.actorId, 'admin-membership:activate'))) {
    return failure('FORBIDDEN');
  }
  const occurredAt = dependencies.clock.now().toISOString();
  const decision = decideAdminMembershipActivation({ ...input, now: occurredAt });
  if (!decision.allowed) return failure(decision.code);
  try {
    return await dependencies.repository.transaction(input.identityId, async (transaction) => {
      const replay = await transaction.findCommandResult(input.commandId);
      if (replay !== null) return replay;
      if ((await transaction.loadMembership(input.identityId)) !== null) {
        return failure('MEMBERSHIP_EXISTS');
      }
      const state: PersistedAdminMembership = {
        ...decision.state,
        permissions: assignmentForFunctions(decision.state.functions),
      };
      await transaction.saveMembership(state);
      return rememberOutcome(dependencies, transaction, {
        actorId: input.actorId,
        commandId: input.commandId,
        subjectId: input.identityId,
        outcome: 'membership-activated',
        occurredAt,
        audit: { membershipId: state.membershipId, functions: state.functions },
        result: { state },
      });
    });
  } catch {
    return failure('GOVERNANCE_UNAVAILABLE');
  }
};

export interface PreviewAdminPermissionChangeInput {
  readonly actorId: string;
  readonly identityId: string;
  readonly proposed: AdminPermissionAssignment;
}

export type AdminPermissionPreviewResult =
  | Readonly<{ ok: true; outcome: 'impact-projected'; impact: AdminPermissionImpact }>
  | Readonly<{ ok: false; code: string }>;

export const previewAdminPermissionChange = async (
  dependencies: AdminGovernanceDependencies,
  input: PreviewAdminPermissionChangeInput,
): Promise<AdminPermissionPreviewResult> => {
  if (!(await authorize(dependencies, input.actorId, 'admin-permissions:manage'))) {
    return { ok: false, code: 'FORBIDDEN' };
  }
  const membership = await dependencies.repository.loadMembership(input.identityId);
  if (membership === null) return { ok: false, code: 'MEMBERSHIP_NOT_FOUND' };
  return {
    ok: true,
    outcome: 'impact-projected',
    impact: projectPermissionImpact(
      dependencies,
      membership,
      input.proposed,
      dependencies.clock.now().toISOString(),
    ),
  };
};

export interface ApplyAdminPermissionChangeInput extends PreviewAdminPermissionChangeInput {
  readonly commandId: string;
  readonly expectedVersion: bigint;
  readonly impact?: AdminPermissionImpact;
  readonly risk: AdminRiskLevel;
  readonly reason: string;
  readonly confirmed: boolean;
  readonly authorizationContextId: string;
  readonly stepUp?: AdminGovernanceStepUpEvidence;
  readonly independentApprovalIds?: readonly string[];
  readonly massAction?: boolean;
}

export const applyAdminPermissionChange = async (
  dependencies: AdminGovernanceDependencies,
  input: ApplyAdminPermissionChangeInput,
): Promise<AdminGovernanceCommandResult> => {
  if (!(await authorize(dependencies, input.actorId, 'admin-permissions:manage'))) {
    return failure('FORBIDDEN');
  }
  if (input.reason.trim().length === 0) return failure('REASON_REQUIRED');
  const suppliedImpact = input.impact;
  if (!input.confirmed || suppliedImpact === undefined) return failure('IMPACT_REVIEW_REQUIRED');
  const requiresIndependentApproval =
    input.risk === 'critical' || input.risk === 'irreversible' || input.massAction === true;
  if (requiresIndependentApproval && (input.independentApprovalIds?.length ?? 0) === 0) {
    return failure('INDEPENDENT_APPROVER_REQUIRED');
  }
  const occurredAt = dependencies.clock.now().toISOString();
  if (
    input.risk !== 'routine' &&
    !(await admitStepUp(
      dependencies,
      input.stepUp,
      {
        actorId: input.actorId,
        authorizationContextId: input.authorizationContextId,
        action: 'admin.permission.change',
        resource: 'membership',
        redactedTarget: `membership:${input.identityId}`,
      },
      occurredAt,
    ))
  ) {
    return failure('STEP_UP_INVALID');
  }
  try {
    return await dependencies.repository.transaction(input.identityId, async (transaction) => {
      const replay = await transaction.findCommandResult(input.commandId);
      if (replay !== null) return replay;
      const current = await transaction.loadMembership(input.identityId);
      if (current === null) return failure('MEMBERSHIP_NOT_FOUND');
      if (current.version !== input.expectedVersion) return failure('STALE');
      if (
        requiresIndependentApproval &&
        !(await hasIndependentApproval(transaction, input.independentApprovalIds ?? [], {
          actorId: input.actorId,
          beneficiaryId: input.identityId,
          capability: 'admin-permissions:manage',
          scope: 'membership',
          now: occurredAt,
        }))
      ) {
        return failure('INDEPENDENT_APPROVER_REQUIRED');
      }
      const authoritativeImpact = projectPermissionImpact(
        dependencies,
        current,
        input.proposed,
        occurredAt,
      );
      if (!matchesImpact(authoritativeImpact, suppliedImpact)) return failure('IMPACT_STALE');
      await transaction.saveImpact(authoritativeImpact);
      const permissions = snapshotAssignment(input.proposed);
      const state: PersistedAdminMembership = {
        ...current,
        functions: permissions.functions,
        permissions,
        version: current.version + 1n,
      };
      await transaction.saveMembership(state);
      await transaction.revokeSessions(input.identityId, occurredAt);
      await transaction.removeFutureApprovals(input.identityId, occurredAt);
      return rememberOutcome(dependencies, transaction, {
        actorId: input.actorId,
        commandId: input.commandId,
        subjectId: input.identityId,
        outcome: 'permissions-changed',
        occurredAt,
        audit: {
          reason: input.reason.trim(),
          impactId: authoritativeImpact.impactId,
          risk: input.risk,
          independentApprovalIds: input.independentApprovalIds ?? [],
        },
        result: { state, impact: authoritativeImpact },
      });
    });
  } catch {
    return failure('GOVERNANCE_UNAVAILABLE');
  }
};

export interface SwitchAdminFunctionInput {
  readonly actorId: string;
  readonly commandId: string;
  readonly sessionId: string;
  readonly targetFunction: string;
  readonly reason: string;
  readonly authorizationContextId?: string;
  readonly stepUp?: AdminGovernanceStepUpEvidence;
}

export const switchAdminFunction = async (
  dependencies: AdminGovernanceDependencies,
  input: SwitchAdminFunctionInput,
): Promise<AdminGovernanceCommandResult> => {
  if (!(await authorize(dependencies, input.actorId, 'admin-function:switch-self'))) {
    return failure('FORBIDDEN');
  }
  const occurredAt = dependencies.clock.now().toISOString();
  const sensitive = input.targetFunction === 'security' || input.targetFunction === 'audit';
  const reauthenticated =
    !sensitive ||
    (input.authorizationContextId !== undefined &&
      (await admitStepUp(
        dependencies,
        input.stepUp,
        {
          actorId: input.actorId,
          authorizationContextId: input.authorizationContextId,
          action: 'admin.function.switch',
          resource: 'admin-session',
          redactedTarget: `session:${input.sessionId}`,
        },
        occurredAt,
      )));
  try {
    return await dependencies.repository.transaction(input.actorId, async (transaction) => {
      const replay = await transaction.findCommandResult(input.commandId);
      if (replay !== null) return replay;
      const membership = await transaction.loadMembership(input.actorId);
      const session = await transaction.loadSession(input.sessionId);
      if (membership === null || session === null) return failure('ADMIN_SESSION_NOT_FOUND');
      const decision = decideAdminFunctionSwitch(membership, session, {
        targetFunction: input.targetFunction,
        reason: input.reason,
        reauthenticated,
        now: occurredAt,
      });
      if (!decision.allowed) return failure(decision.code);
      await transaction.saveSession(decision.session);
      return rememberOutcome(dependencies, transaction, {
        actorId: input.actorId,
        commandId: input.commandId,
        subjectId: input.sessionId,
        outcome: 'function-switched',
        occurredAt,
        audit: { targetFunction: input.targetFunction, reason: input.reason },
        result: { session: decision.session },
      });
    });
  } catch {
    return failure('GOVERNANCE_UNAVAILABLE');
  }
};

export interface CreateAdminDelegationInput {
  readonly actorId: string;
  readonly commandId: string;
  readonly delegationId: string;
  readonly delegateId: string;
  readonly capabilities: readonly string[];
  readonly scopes: readonly string[];
  readonly purpose: string;
  readonly risk: AdminRiskLevel;
  readonly expiresAt: string;
  readonly approvalRequestIds?: readonly string[];
  readonly authorizationContextId?: string;
  readonly stepUp?: AdminGovernanceStepUpEvidence;
}

export const createAdminDelegation = async (
  dependencies: AdminGovernanceDependencies,
  input: CreateAdminDelegationInput,
): Promise<AdminGovernanceCommandResult> => {
  if (!(await authorize(dependencies, input.actorId, 'admin-delegation:manage'))) {
    return failure('FORBIDDEN');
  }
  const occurredAt = dependencies.clock.now().toISOString();
  if (
    input.risk !== 'routine' &&
    (input.authorizationContextId === undefined ||
      !(await admitStepUp(
        dependencies,
        input.stepUp,
        {
          actorId: input.actorId,
          authorizationContextId: input.authorizationContextId,
          action: 'admin.delegation.create',
          resource: 'delegation',
          redactedTarget: `delegation:${input.delegationId}`,
        },
        occurredAt,
      )))
  ) {
    return failure('STEP_UP_INVALID');
  }
  try {
    return await dependencies.repository.transaction(input.delegationId, async (transaction) => {
      const replay = await transaction.findCommandResult(input.commandId);
      if (replay !== null) return replay;
      const approved =
        input.risk === 'routine' ||
        (await hasIndependentApproval(transaction, input.approvalRequestIds ?? [], {
          actorId: input.actorId,
          beneficiaryId: input.delegateId,
          capability: 'admin-delegation:manage',
          scope: 'delegation',
          now: occurredAt,
        }));
      const decision = decideAdminDelegation({
        delegationId: input.delegationId,
        delegatorId: input.actorId,
        delegateId: input.delegateId,
        capabilities: input.capabilities,
        scopes: input.scopes,
        purpose: input.purpose,
        risk: input.risk,
        approved,
        now: occurredAt,
        expiresAt: input.expiresAt,
      });
      if (!decision.allowed) return failure(decision.code);
      await transaction.saveDelegation(decision.state);
      return rememberOutcome(dependencies, transaction, {
        actorId: input.actorId,
        commandId: input.commandId,
        subjectId: input.delegationId,
        outcome: 'delegation-created',
        occurredAt,
        audit: { delegateId: input.delegateId, purpose: input.purpose, risk: input.risk },
        result: { state: decision.state },
      });
    });
  } catch {
    return failure('GOVERNANCE_UNAVAILABLE');
  }
};

export const expireAdminDelegation = async (
  dependencies: AdminGovernanceDependencies,
  input: Readonly<{ actorId: string; commandId: string; delegationId: string }>,
): Promise<AdminGovernanceCommandResult> => {
  if (!(await authorize(dependencies, input.actorId, 'admin-delegation:manage'))) {
    return failure('FORBIDDEN');
  }
  const occurredAt = dependencies.clock.now().toISOString();
  try {
    return await dependencies.repository.transaction(input.delegationId, async (transaction) => {
      const replay = await transaction.findCommandResult(input.commandId);
      if (replay !== null) return replay;
      const current = await transaction.loadDelegation(input.delegationId);
      if (current === null) return failure('DELEGATION_NOT_FOUND');
      const evaluated = evaluateAdminDelegation(current, occurredAt);
      if (evaluated.active) return failure('DELEGATION_NOT_DUE');
      await transaction.saveDelegation(evaluated.state);
      return rememberOutcome(dependencies, transaction, {
        actorId: input.actorId,
        commandId: input.commandId,
        subjectId: input.delegationId,
        outcome: 'delegation-expired',
        occurredAt,
        audit: { delegateId: evaluated.state.delegateId },
        result: { state: evaluated.state },
      });
    });
  } catch {
    return failure('GOVERNANCE_UNAVAILABLE');
  }
};

export interface RequestAdminApprovalInput {
  readonly actorId: string;
  readonly commandId: string;
  readonly requestId: string;
  readonly beneficiaryId: string;
  readonly capability: string;
  readonly scope: string;
  readonly risk: AdminRiskLevel;
  readonly expiresAt: string;
  readonly assignedApproverId?: string;
}

export const requestAdminApproval = async (
  dependencies: AdminGovernanceDependencies,
  input: RequestAdminApprovalInput,
): Promise<AdminGovernanceCommandResult> => {
  if (!(await authorize(dependencies, input.actorId, 'admin-approval:manage'))) {
    return failure('FORBIDDEN');
  }
  const occurredAt = dependencies.clock.now().toISOString();
  const current = timestamp(occurredAt);
  const expiresAt = timestamp(input.expiresAt);
  if (
    current === null ||
    expiresAt === null ||
    expiresAt <= current ||
    expiresAt - current > APPROVAL_WINDOW_MS ||
    input.assignedApproverId === input.actorId ||
    input.assignedApproverId === input.beneficiaryId
  ) {
    return failure('APPROVAL_WINDOW_INVALID');
  }
  const state: AdminApprovalRequest = {
    requestId: input.requestId,
    commandId: input.commandId,
    authorId: input.actorId,
    beneficiaryId: input.beneficiaryId,
    capability: input.capability,
    scope: input.scope,
    risk: input.risk,
    status: 'pending',
    createdAt: occurredAt,
    expiresAt: input.expiresAt,
    version: 1n,
    ...(input.assignedApproverId === undefined
      ? {}
      : { assignedApproverId: input.assignedApproverId }),
  };
  try {
    return await dependencies.repository.transaction(input.requestId, async (transaction) => {
      const replay = await transaction.findCommandResult(input.commandId);
      if (replay !== null) return replay;
      await transaction.saveApproval(state);
      return rememberOutcome(dependencies, transaction, {
        actorId: input.actorId,
        commandId: input.commandId,
        subjectId: input.requestId,
        outcome: 'approval-requested',
        occurredAt,
        audit: { beneficiaryId: input.beneficiaryId, risk: input.risk },
        result: { state },
      });
    });
  } catch {
    return failure('GOVERNANCE_UNAVAILABLE');
  }
};

export interface ApproveAdminAccessRequestInput {
  readonly actorId: string;
  readonly commandId: string;
  readonly requestId: string;
  readonly capability: string;
  readonly scopes: readonly string[];
  readonly reason: string;
  readonly authorizationContextId: string;
  readonly stepUp: AdminGovernanceStepUpEvidence;
}

export const approveAdminAccessRequest = async (
  dependencies: AdminGovernanceDependencies,
  input: ApproveAdminAccessRequestInput,
): Promise<AdminGovernanceCommandResult> => {
  if (!(await authorize(dependencies, input.actorId, 'admin-approval:manage'))) {
    return failure('FORBIDDEN');
  }
  if (input.reason.trim().length === 0) return failure('REASON_REQUIRED');
  const occurredAt = dependencies.clock.now().toISOString();
  if (
    !(await admitStepUp(
      dependencies,
      input.stepUp,
      {
        actorId: input.actorId,
        authorizationContextId: input.authorizationContextId,
        action: 'admin.approval.approve',
        resource: 'approval',
        redactedTarget: `approval:${input.requestId}`,
      },
      occurredAt,
    ))
  ) {
    return failure('STEP_UP_INVALID');
  }
  try {
    return await dependencies.repository.transaction(input.requestId, async (transaction) => {
      const replay = await transaction.findCommandResult(input.commandId);
      if (replay !== null) return replay;
      const current = await transaction.loadApproval(input.requestId);
      if (current?.status !== 'pending') return failure('APPROVAL_UNAVAILABLE');
      const expiresAt = timestamp(current.expiresAt);
      const currentTime = timestamp(occurredAt);
      if (expiresAt === null || currentTime === null || expiresAt <= currentTime) {
        return failure('APPROVAL_EXPIRED');
      }
      if (input.actorId === current.authorId || input.actorId === current.beneficiaryId) {
        return failure('INDEPENDENT_APPROVER_REQUIRED');
      }
      if (
        input.capability !== current.capability ||
        !input.scopes.includes(current.scope) ||
        (current.assignedApproverId !== undefined && current.assignedApproverId !== input.actorId)
      ) {
        return failure('APPROVAL_SCOPE_MISMATCH');
      }
      const state: AdminApprovalRequest = {
        ...current,
        status: 'approved',
        version: current.version + 1n,
        approverId: input.actorId,
        approvedAt: occurredAt,
        decisionReason: input.reason.trim(),
      };
      await transaction.saveApproval(state);
      return rememberOutcome(dependencies, transaction, {
        actorId: input.actorId,
        commandId: input.commandId,
        subjectId: input.requestId,
        outcome: 'approval-recorded',
        occurredAt,
        audit: {
          reason: input.reason.trim(),
          capability: current.capability,
          scope: current.scope,
        },
        result: { state },
      });
    });
  } catch {
    return failure('GOVERNANCE_UNAVAILABLE');
  }
};

export interface ReassignAdminApprovalInput {
  readonly actorId: string;
  readonly commandId: string;
  readonly requestId: string;
  readonly newApproverId: string;
  readonly reason: string;
  readonly authorizationContextId: string;
  readonly stepUp: AdminGovernanceStepUpEvidence;
}

export interface CancelAdminApprovalInput {
  readonly actorId: string;
  readonly commandId: string;
  readonly requestId: string;
  readonly reason: string;
  readonly authorizationContextId: string;
  readonly stepUp: AdminGovernanceStepUpEvidence;
}

export const cancelAdminApproval = async (
  dependencies: AdminGovernanceDependencies,
  input: CancelAdminApprovalInput,
): Promise<AdminGovernanceCommandResult> => {
  if (!(await authorize(dependencies, input.actorId, 'admin-approval:manage'))) {
    return failure('FORBIDDEN');
  }
  if (input.reason.trim().length === 0) return failure('REASON_REQUIRED');
  const occurredAt = dependencies.clock.now().toISOString();
  if (
    !(await admitStepUp(
      dependencies,
      input.stepUp,
      {
        actorId: input.actorId,
        authorizationContextId: input.authorizationContextId,
        action: 'admin.approval.cancel',
        resource: 'approval',
        redactedTarget: `approval:${input.requestId}`,
      },
      occurredAt,
    ))
  ) {
    return failure('STEP_UP_INVALID');
  }
  try {
    return await dependencies.repository.transaction(input.requestId, async (transaction) => {
      const replay = await transaction.findCommandResult(input.commandId);
      if (replay !== null) return replay;
      const current = await transaction.loadApproval(input.requestId);
      if (current?.status !== 'pending') return failure('APPROVAL_UNAVAILABLE');
      const state: AdminApprovalRequest = {
        ...current,
        status: 'cancelled',
        version: current.version + 1n,
        cancelledAt: occurredAt,
      };
      await transaction.saveApproval(state);
      return rememberOutcome(dependencies, transaction, {
        actorId: input.actorId,
        commandId: input.commandId,
        subjectId: input.requestId,
        outcome: 'approval-cancelled',
        occurredAt,
        audit: { reason: input.reason.trim() },
        result: { state },
      });
    });
  } catch {
    return failure('GOVERNANCE_UNAVAILABLE');
  }
};

export const reassignAdminApproval = async (
  dependencies: AdminGovernanceDependencies,
  input: ReassignAdminApprovalInput,
): Promise<AdminGovernanceCommandResult> => {
  if (!(await authorize(dependencies, input.actorId, 'admin-approval:manage'))) {
    return failure('FORBIDDEN');
  }
  if (input.reason.trim().length === 0) return failure('REASON_REQUIRED');
  const occurredAt = dependencies.clock.now().toISOString();
  if (
    !(await admitStepUp(
      dependencies,
      input.stepUp,
      {
        actorId: input.actorId,
        authorizationContextId: input.authorizationContextId,
        action: 'admin.approval.reassign',
        resource: 'approval',
        redactedTarget: `approval:${input.requestId}`,
      },
      occurredAt,
    ))
  ) {
    return failure('STEP_UP_INVALID');
  }
  try {
    return await dependencies.repository.transaction(input.requestId, async (transaction) => {
      const replay = await transaction.findCommandResult(input.commandId);
      if (replay !== null) return replay;
      const current = await transaction.loadApproval(input.requestId);
      if (current?.status !== 'pending') return failure('APPROVAL_UNAVAILABLE');
      const expiresAt = timestamp(current.expiresAt);
      const currentTime = timestamp(occurredAt);
      if (
        input.newApproverId === current.authorId ||
        input.newApproverId === current.beneficiaryId ||
        expiresAt === null ||
        currentTime === null ||
        expiresAt <= currentTime
      ) {
        return failure('INDEPENDENT_APPROVER_REQUIRED');
      }
      const state = {
        ...current,
        assignedApproverId: input.newApproverId,
        version: current.version + 1n,
      };
      await transaction.saveApproval(state);
      return rememberOutcome(dependencies, transaction, {
        actorId: input.actorId,
        commandId: input.commandId,
        subjectId: input.requestId,
        outcome: 'approval-reassigned',
        occurredAt,
        audit: { reason: input.reason.trim(), newApproverId: input.newApproverId },
        result: { state },
      });
    });
  } catch {
    return failure('GOVERNANCE_UNAVAILABLE');
  }
};

export interface OffboardAdminIdentityInput {
  readonly actorId: string;
  readonly commandId: string;
  readonly identityId: string;
  readonly expectedVersion: bigint;
  readonly reason: string;
  readonly compromise: boolean;
  readonly authorizationContextId: string;
  readonly stepUp: AdminGovernanceStepUpEvidence;
}

export const offboardAdminIdentity = async (
  dependencies: AdminGovernanceDependencies,
  input: OffboardAdminIdentityInput,
): Promise<AdminGovernanceCommandResult> => {
  if (!(await authorize(dependencies, input.actorId, 'admin-membership:manage'))) {
    return failure('FORBIDDEN');
  }
  const occurredAt = dependencies.clock.now().toISOString();
  if (
    !(await admitStepUp(
      dependencies,
      input.stepUp,
      {
        actorId: input.actorId,
        authorizationContextId: input.authorizationContextId,
        action: 'admin.membership.offboard',
        resource: 'membership',
        redactedTarget: `membership:${input.identityId}`,
      },
      occurredAt,
    ))
  ) {
    return failure('STEP_UP_INVALID');
  }
  const decision = decideAdminOffboarding({
    identityId: input.identityId,
    now: occurredAt,
    reason: input.reason,
  });
  if (!decision.allowed) return failure(decision.code);
  try {
    return await dependencies.repository.transaction(input.identityId, async (transaction) => {
      const replay = await transaction.findCommandResult(input.commandId);
      if (replay !== null) return replay;
      const current = await transaction.loadMembership(input.identityId);
      if (current === null) return failure('MEMBERSHIP_NOT_FOUND');
      if (current.version !== input.expectedVersion) return failure('STALE');
      const state: PersistedAdminMembership = {
        ...current,
        status: 'offboarded',
        version: current.version + 1n,
        offboardedAt: occurredAt,
        offboardingReason: input.reason.trim(),
      };
      await transaction.saveMembership(state);
      await transaction.revokeSessions(input.identityId, occurredAt);
      await transaction.revokeDelegations(input.identityId, occurredAt);
      const reassignedWorkIds = await transaction.reassignPendingWork(input.identityId, occurredAt);
      await transaction.removeFutureApprovals(input.identityId, occurredAt);
      return rememberOutcome(dependencies, transaction, {
        actorId: input.actorId,
        commandId: input.commandId,
        subjectId: input.identityId,
        outcome: 'identity-offboarded',
        occurredAt,
        audit: {
          reason: input.reason.trim(),
          compromise: input.compromise,
          effects: decision.effects.map(({ kind }) => kind),
        },
        result: { state, reassignedWorkIds },
      });
    });
  } catch {
    return failure('GOVERNANCE_UNAVAILABLE');
  }
};

export interface ReviewAdminAccessInput {
  readonly actorId: string;
  readonly commandId: string;
  readonly identityId: string;
  readonly accessClass: 'critical' | 'read-only' | 'other';
  readonly lastReviewedAt: string;
  readonly lastActiveAt: string;
  readonly deviationDetected: boolean;
  readonly retainAccess: boolean;
  readonly reason: string;
}

export const reviewAdminAccess = async (
  dependencies: AdminGovernanceDependencies,
  input: ReviewAdminAccessInput,
): Promise<AdminGovernanceCommandResult> => {
  if (!(await authorize(dependencies, input.actorId, 'admin-access:review'))) {
    return failure('FORBIDDEN');
  }
  if (input.reason.trim().length === 0) return failure('REASON_REQUIRED');
  const occurredAt = dependencies.clock.now().toISOString();
  const governance = evaluateAdminAccessGovernance({ ...input, now: occurredAt });
  try {
    return await dependencies.repository.transaction(input.identityId, async (transaction) => {
      const replay = await transaction.findCommandResult(input.commandId);
      if (replay !== null) return replay;
      const membership = await transaction.loadMembership(input.identityId);
      if (membership === null) return failure('MEMBERSHIP_NOT_FOUND');
      const suspend = !input.retainAccess || governance.inactivityAction === 'suspend';
      const state: PersistedAdminMembership = suspend
        ? { ...membership, status: 'suspended', version: membership.version + 1n }
        : membership;
      if (suspend) {
        await transaction.saveMembership(state);
        await transaction.revokeSessions(input.identityId, occurredAt);
        await transaction.revokeDelegations(input.identityId, occurredAt);
        await transaction.removeFutureApprovals(input.identityId, occurredAt);
      }
      const review: AdminAccessReviewRecord = {
        reviewId: dependencies.ids.next(),
        identityId: input.identityId,
        reviewerId: input.actorId,
        accessClass: input.accessClass,
        outcome: suspend ? 'suspended' : 'retained',
        reason: input.reason.trim(),
        reviewedAt: occurredAt,
      };
      await transaction.saveAccessReview(review);
      return rememberOutcome(dependencies, transaction, {
        actorId: input.actorId,
        commandId: input.commandId,
        subjectId: input.identityId,
        outcome: 'access-reviewed',
        occurredAt,
        audit: { governance, reviewId: review.reviewId },
        result: { state, review, governance },
      });
    });
  } catch {
    return failure('GOVERNANCE_UNAVAILABLE');
  }
};

export const simulateAdminFunction = async (
  dependencies: AdminGovernanceDependencies,
  input: Readonly<{ actorId: string; identityId: string; targetFunction: string }>,
): Promise<AdminGovernanceCommandResult> => {
  if (!(await authorize(dependencies, input.actorId, 'admin-function:simulate'))) {
    return failure('FORBIDDEN');
  }
  const membership = await dependencies.repository.loadMembership(input.identityId);
  if (membership === null) return failure('MEMBERSHIP_NOT_FOUND');
  const projection = projectAdminFunctionSimulation(membership, input.targetFunction);
  if (!projection.allowed) return failure(projection.code);
  return Object.freeze({
    ok: true,
    outcome: 'simulation-projected',
    session: projection.session,
    canAuthorizeAction: false,
  });
};

export interface RevealAdminAuditValueInput {
  readonly actorId: string;
  readonly commandId: string;
  readonly redactedTarget: string;
  readonly value: string;
  readonly reveal: boolean;
  readonly reason?: string;
  readonly activeFunction?: string;
  readonly capabilities?: readonly string[];
  readonly authorizationContextId?: string;
  readonly stepUp?: AdminGovernanceStepUpEvidence;
}

export const revealAdminAuditValue = async (
  dependencies: AdminGovernanceDependencies,
  input: RevealAdminAuditValueInput,
): Promise<AdminGovernanceCommandResult> => {
  if (!(await authorize(dependencies, input.actorId, 'admin-audit:reveal'))) {
    return failure('FORBIDDEN');
  }
  const projection = projectAdminAuditField(input);
  if (!projection.allowed) return failure(projection.code);
  if (!input.reveal) {
    return Object.freeze({ ok: true, outcome: 'audit-masked', value: projection.value });
  }
  const occurredAt = dependencies.clock.now().toISOString();
  if (
    input.authorizationContextId === undefined ||
    !(await admitStepUp(
      dependencies,
      input.stepUp,
      {
        actorId: input.actorId,
        authorizationContextId: input.authorizationContextId,
        action: 'admin.audit.reveal',
        resource: 'audit-event',
        redactedTarget: input.redactedTarget,
      },
      occurredAt,
    ))
  ) {
    return failure('STEP_UP_INVALID');
  }
  try {
    return await dependencies.repository.transaction(input.redactedTarget, async (transaction) => {
      const replay = await transaction.findCommandResult(input.commandId);
      if (replay !== null) return replay;
      return rememberOutcome(dependencies, transaction, {
        actorId: input.actorId,
        commandId: input.commandId,
        subjectId: input.redactedTarget,
        outcome: 'audit-revealed',
        occurredAt,
        audit: {
          reason: input.reason,
          activeFunction: input.activeFunction,
          authorizationContextId: input.authorizationContextId,
        },
        result: { value: projection.value },
      });
    });
  } catch {
    return failure('GOVERNANCE_UNAVAILABLE');
  }
};

export type { AdminGovernedSession };
