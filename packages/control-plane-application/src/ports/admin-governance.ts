import type {
  AdminCapability,
  AdminDataScope,
  AdminDelegationState,
  AdminFunction,
  AdminGovernedSession,
  AdminMembershipState,
  AdminRiskLevel,
} from '@liiiraa/control-plane-domain';

export type AdminGovernanceCapability =
  | 'admin-membership:activate'
  | 'admin-membership:manage'
  | 'admin-permissions:manage'
  | 'admin-delegation:manage'
  | 'admin-approval:manage'
  | 'admin-access:review'
  | 'admin-audit:reveal'
  | 'admin-function:simulate'
  | 'admin-function:switch-self';

export interface AdminGovernanceAuthorizationPort {
  authorize(
    input: Readonly<{
      actorId: string;
      capability: AdminGovernanceCapability;
    }>,
  ): Promise<boolean>;
}

export interface AdminGovernanceStepUpEvidence {
  readonly evidenceId: string;
  readonly actorId: string;
  readonly authorizationContextId: string;
  readonly action: string;
  readonly resource: string;
  readonly redactedTarget: string;
  readonly method: 'passkey' | 'totp';
  readonly verifiedAt: string;
  readonly expiresAt: string;
}

export interface AdminGovernanceStepUpPort {
  verify(evidence: AdminGovernanceStepUpEvidence): Promise<boolean>;
}

export interface AdminPermissionAssignment {
  readonly functions: readonly AdminFunction[];
  readonly capabilities: readonly AdminCapability[];
  readonly scopes: readonly AdminDataScope[];
}

export interface PersistedAdminMembership extends AdminMembershipState {
  readonly permissions: AdminPermissionAssignment;
  readonly offboardedAt?: string;
  readonly offboardingReason?: string;
}

export interface AdminPermissionImpact {
  readonly impactId: string;
  readonly identityId: string;
  readonly membershipVersion: bigint;
  readonly before: AdminPermissionAssignment;
  readonly after: AdminPermissionAssignment;
  readonly gainedFunctions: readonly AdminFunction[];
  readonly lostFunctions: readonly AdminFunction[];
  readonly gainedCapabilities: readonly AdminCapability[];
  readonly lostCapabilities: readonly AdminCapability[];
  readonly gainedScopes: readonly AdminDataScope[];
  readonly lostScopes: readonly AdminDataScope[];
  readonly affectedSessions: true;
  readonly invalidatesPendingApprovals: true;
  readonly projectedAt: string;
}

export interface AdminApprovalRequest {
  readonly requestId: string;
  readonly commandId: string;
  readonly authorId: string;
  readonly beneficiaryId: string;
  readonly capability: string;
  readonly scope: string;
  readonly risk: AdminRiskLevel;
  readonly status: 'pending' | 'approved' | 'cancelled' | 'expired';
  readonly createdAt: string;
  readonly expiresAt: string;
  readonly version: bigint;
  readonly assignedApproverId?: string;
  readonly approverId?: string;
  readonly approvedAt?: string;
  readonly decisionReason?: string;
  readonly cancelledAt?: string;
}

export interface AdminAccessReviewRecord {
  readonly reviewId: string;
  readonly identityId: string;
  readonly reviewerId: string;
  readonly accessClass: 'critical' | 'read-only' | 'other';
  readonly outcome: 'retained' | 'suspended';
  readonly reason: string;
  readonly reviewedAt: string;
}

export interface AdminGovernanceReceipt {
  readonly receiptId: string;
  readonly commandId: string;
  readonly actorId: string;
  readonly subjectId: string;
  readonly outcome: string;
  readonly occurredAt: string;
  readonly auditReference: string;
}

export type AdminGovernanceCommandResult = Readonly<{
  ok: boolean;
  outcome?: string;
  code?: string;
  [key: string]: unknown;
}>;

export interface AdminGovernanceTransaction {
  findCommandResult(commandId: string): Promise<AdminGovernanceCommandResult | null>;
  rememberCommandResult(commandId: string, result: AdminGovernanceCommandResult): Promise<void>;
  loadMembership(identityId: string): Promise<PersistedAdminMembership | null>;
  saveMembership(membership: PersistedAdminMembership): Promise<void>;
  loadSession(sessionId: string): Promise<AdminGovernedSession | null>;
  saveSession(session: AdminGovernedSession): Promise<void>;
  loadDelegation(delegationId: string): Promise<AdminDelegationState | null>;
  saveDelegation(delegation: AdminDelegationState): Promise<void>;
  loadApproval(requestId: string): Promise<AdminApprovalRequest | null>;
  saveApproval(approval: AdminApprovalRequest): Promise<void>;
  saveImpact(impact: AdminPermissionImpact): Promise<void>;
  saveAccessReview(review: AdminAccessReviewRecord): Promise<void>;
  revokeSessions(identityId: string, occurredAt: string): Promise<void>;
  revokeDelegations(identityId: string, occurredAt: string): Promise<void>;
  removeFutureApprovals(identityId: string, occurredAt: string): Promise<void>;
  reassignPendingWork(identityId: string, occurredAt: string): Promise<readonly string[]>;
  appendAudit(event: Readonly<Record<string, unknown>>): Promise<string>;
  enqueueOutbox(event: Readonly<Record<string, unknown>>): Promise<void>;
  saveReceipt(receipt: AdminGovernanceReceipt): Promise<void>;
}

export interface AdminGovernanceRepositoryPort {
  loadMembership(identityId: string): Promise<PersistedAdminMembership | null>;
  transaction<T>(
    subjectId: string,
    operation: (transaction: AdminGovernanceTransaction) => Promise<T>,
  ): Promise<T>;
}

export interface AdminGovernanceDependencies {
  readonly authorization: AdminGovernanceAuthorizationPort;
  readonly stepUp: AdminGovernanceStepUpPort;
  readonly repository: AdminGovernanceRepositoryPort;
  readonly clock: Readonly<{ now(): Date }>;
  readonly ids: Readonly<{ next(): string }>;
}
