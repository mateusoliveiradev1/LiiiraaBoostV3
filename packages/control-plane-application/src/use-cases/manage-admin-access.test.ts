import { describe, expect, it, vi } from 'vitest';

import type {
  AdminApprovalRequest,
  AdminGovernanceCommandResult,
  AdminGovernanceDependencies,
  AdminGovernanceTransaction,
  AdminPermissionAssignment,
} from '../ports/admin-governance.js';
import {
  activateAdminMembership,
  applyAdminPermissionChange,
  approveAdminAccessRequest,
  expireAdminDelegation,
  offboardAdminIdentity,
  previewAdminPermissionChange,
  reassignAdminApproval,
  requestAdminApproval,
  revealAdminAuditValue,
  simulateAdminFunction,
  switchAdminFunction,
} from './manage-admin-access.js';

const now = '2030-01-01T00:00:00.000Z';
const fiveMinutesLater = '2030-01-01T00:05:00.000Z';
const fifteenMinutesLater = '2030-01-01T00:15:00.000Z';

const supportAssignment: AdminPermissionAssignment = {
  functions: ['support'],
  capabilities: ['support:view', 'support:reply'],
  scopes: ['support-cases'],
};

const stepUp = (actorId: string, action: string, resource: string, target: string) => ({
  evidenceId: `step-${actorId}-${action}`,
  actorId,
  authorizationContextId: `context-${action}`,
  action,
  resource,
  redactedTarget: target,
  method: 'passkey' as const,
  verifiedAt: now,
  expiresAt: fiveMinutesLater,
});

const harness = () => {
  const memberships = new Map<
    string,
    Awaited<ReturnType<AdminGovernanceTransaction['loadMembership']>>
  >();
  const approvals = new Map<string, AdminApprovalRequest>();
  const delegations = new Map<
    string,
    Awaited<ReturnType<AdminGovernanceTransaction['loadDelegation']>>
  >();
  const sessions = new Map<
    string,
    Awaited<ReturnType<AdminGovernanceTransaction['loadSession']>>
  >();
  const commands = new Map<string, AdminGovernanceCommandResult>();
  const committedEffects: string[] = [];
  const authorize = vi.fn(() => Promise.resolve(true));
  const verify = vi.fn(() => Promise.resolve(true));
  let failReassignment = false;
  let id = 0;
  let transactionCount = 0;

  const repository: AdminGovernanceDependencies['repository'] = {
    loadMembership: (identityId) => Promise.resolve(memberships.get(identityId) ?? null),
    transaction: async (_subjectId, operation) => {
      transactionCount += 1;
      const pending: (() => void)[] = [];
      const transaction: AdminGovernanceTransaction = {
        findCommandResult: (commandId) => Promise.resolve(commands.get(commandId) ?? null),
        rememberCommandResult: (commandId, result) => {
          pending.push(() => commands.set(commandId, result));
          return Promise.resolve();
        },
        loadMembership: (identityId) => Promise.resolve(memberships.get(identityId) ?? null),
        saveMembership: (membership) => {
          pending.push(() => memberships.set(membership.identityId, membership));
          return Promise.resolve();
        },
        loadSession: (sessionId) => Promise.resolve(sessions.get(sessionId) ?? null),
        saveSession: (session) => {
          pending.push(() => sessions.set(session.sessionId, session));
          return Promise.resolve();
        },
        loadDelegation: (delegationId) => Promise.resolve(delegations.get(delegationId) ?? null),
        saveDelegation: (delegation) => {
          pending.push(() => delegations.set(delegation.delegationId, delegation));
          return Promise.resolve();
        },
        loadApproval: (requestId) => Promise.resolve(approvals.get(requestId) ?? null),
        saveApproval: (approval) => {
          pending.push(() => approvals.set(approval.requestId, approval));
          return Promise.resolve();
        },
        saveImpact: () => {
          pending.push(() => committedEffects.push('impact'));
          return Promise.resolve();
        },
        saveAccessReview: () => {
          pending.push(() => committedEffects.push('review'));
          return Promise.resolve();
        },
        revokeSessions: () => {
          pending.push(() => committedEffects.push('sessions'));
          return Promise.resolve();
        },
        revokeDelegations: () => {
          pending.push(() => committedEffects.push('delegations'));
          return Promise.resolve();
        },
        removeFutureApprovals: () => {
          pending.push(() => committedEffects.push('approvals'));
          return Promise.resolve();
        },
        reassignPendingWork: () => {
          if (failReassignment) throw new Error('reassignment unavailable');
          pending.push(() => committedEffects.push('work'));
          return Promise.resolve(['work-1']);
        },
        appendAudit: () => {
          pending.push(() => committedEffects.push('audit'));
          return Promise.resolve(`audit-${String(id + 1)}`);
        },
        enqueueOutbox: () => {
          pending.push(() => committedEffects.push('outbox'));
          return Promise.resolve();
        },
        saveReceipt: () => {
          pending.push(() => committedEffects.push('receipt'));
          return Promise.resolve();
        },
      };
      const result = await operation(transaction);
      for (const commit of pending) commit();
      return result;
    },
  };
  const dependencies: AdminGovernanceDependencies = {
    authorization: { authorize },
    stepUp: { verify },
    repository,
    clock: { now: () => new Date(now) },
    ids: { next: () => `id-${String(++id)}` },
  };
  return {
    dependencies,
    memberships,
    approvals,
    delegations,
    sessions,
    committedEffects,
    authorize,
    verify,
    get transactionCount() {
      return transactionCount;
    },
    failReassignment: () => {
      failReassignment = true;
    },
  };
};

describe('transactional admin access governance', () => {
  it('authorizes a current-session function switch independently from team governance', async () => {
    const test = harness();
    test.memberships.set('owner', {
      membershipId: 'membership-owner',
      identityId: 'owner',
      status: 'active',
      functions: ['operations', 'security'],
      strongFactor: 'passkey',
      version: 1n,
      activatedAt: now,
      permissions: {
        functions: ['operations', 'security'],
        capabilities: ['device:manage', 'session:revoke'],
        scopes: ['devices', 'sessions'],
      },
    });
    test.sessions.set('session-one', {
      sessionId: 'session-one',
      actorId: 'owner',
      activeFunction: 'operations',
      navigation: ['operation'],
      dataScopes: ['devices', 'entitlements'],
      capabilities: ['device:manage', 'entitlement:correct'],
      simulation: false,
      version: 1n,
    });

    await expect(
      switchAdminFunction(test.dependencies, {
        actorId: 'owner',
        commandId: 'switch-one',
        sessionId: 'session-one',
        targetFunction: 'security',
        reason: 'Return to security governance',
        authorizationContextId: 'context-admin.function.switch',
        stepUp: stepUp('owner', 'admin.function.switch', 'admin-session', 'session-one'),
      }),
    ).resolves.toMatchObject({
      ok: true,
      outcome: 'function-switched',
      session: { activeFunction: 'security', version: 2n },
    });
    expect(test.authorize).toHaveBeenCalledWith({
      actorId: 'owner',
      capability: 'admin-function:switch-self',
    });
  });

  it('authorizes before repository access and activates only a verified separate admin invitation', async () => {
    const test = harness();
    test.authorize.mockResolvedValueOnce(false);

    await expect(
      activateAdminMembership(test.dependencies, {
        actorId: 'owner',
        commandId: 'activate-1',
        identityId: 'member-1',
        membershipId: 'membership-1',
        administrativeInvitationKind: 'administrative-team',
        invitationVerified: true,
        emailVerified: true,
        strongFactor: 'passkey',
        sharedCredential: false,
        functions: ['support'],
      }),
    ).resolves.toEqual({ ok: false, code: 'FORBIDDEN' });
    expect(test.transactionCount).toBe(0);

    await expect(
      activateAdminMembership(test.dependencies, {
        actorId: 'owner',
        commandId: 'activate-2',
        identityId: 'member-1',
        membershipId: 'membership-1',
        administrativeInvitationKind: 'administrative-team',
        invitationVerified: true,
        emailVerified: false,
        strongFactor: 'password',
        sharedCredential: false,
        functions: ['support'],
      }),
    ).resolves.toMatchObject({ ok: false, code: 'VERIFIED_IDENTITY_REQUIRED' });

    await expect(
      activateAdminMembership(test.dependencies, {
        actorId: 'owner',
        commandId: 'activate-3',
        identityId: 'member-1',
        membershipId: 'membership-1',
        administrativeInvitationKind: 'administrative-team',
        invitationVerified: true,
        emailVerified: true,
        strongFactor: 'passkey',
        sharedCredential: false,
        functions: ['support'],
      }),
    ).resolves.toMatchObject({ ok: true, outcome: 'membership-activated' });
    expect(test.memberships.get('member-1')).toMatchObject({ status: 'active' });
  });

  it('returns an immutable before/after permission impact before applying a fresh scoped step-up', async () => {
    const test = harness();
    test.memberships.set('member-1', {
      membershipId: 'membership-1',
      identityId: 'member-1',
      status: 'active',
      functions: ['support'],
      strongFactor: 'passkey',
      version: 1n,
      activatedAt: now,
      permissions: supportAssignment,
    });
    const proposed: AdminPermissionAssignment = {
      functions: ['operations'],
      capabilities: ['device:manage'],
      scopes: ['devices'],
    };

    const preview = await previewAdminPermissionChange(test.dependencies, {
      actorId: 'owner',
      identityId: 'member-1',
      proposed,
    });
    expect(preview).toMatchObject({
      ok: true,
      outcome: 'impact-projected',
      impact: {
        gainedCapabilities: ['device:manage'],
        lostCapabilities: ['support:view', 'support:reply'],
      },
    });
    if (!preview.ok) throw new Error('permission impact preview unexpectedly failed');
    expect(test.memberships.get('member-1')?.permissions).toEqual(supportAssignment);

    await expect(
      applyAdminPermissionChange(test.dependencies, {
        actorId: 'owner',
        commandId: 'permission-mismatched-step-up',
        identityId: 'member-1',
        expectedVersion: 1n,
        proposed,
        impact: preview.impact,
        risk: 'sensitive',
        reason: 'Move device work to operations',
        confirmed: true,
        authorizationContextId: 'different-context',
        stepUp: stepUp('owner', 'admin.permission.change', 'membership', 'membership:member-1'),
      }),
    ).resolves.toEqual({ ok: false, code: 'STEP_UP_INVALID' });
    expect(test.memberships.get('member-1')?.permissions).toEqual(supportAssignment);

    await expect(
      applyAdminPermissionChange(test.dependencies, {
        actorId: 'owner',
        commandId: 'permission-1',
        identityId: 'member-1',
        expectedVersion: 1n,
        proposed,
        impact: preview.impact,
        risk: 'sensitive',
        reason: 'Move device work to operations',
        confirmed: true,
        authorizationContextId: 'context-admin.permission.change',
        stepUp: stepUp('owner', 'admin.permission.change', 'membership', 'membership:member-1'),
      }),
    ).resolves.toMatchObject({ ok: true, outcome: 'permissions-changed' });
    expect(test.memberships.get('member-1')).toMatchObject({
      version: 2n,
      functions: ['operations'],
      permissions: proposed,
    });
    expect(test.verify).toHaveBeenCalledOnce();
  });

  it('rejects author, beneficiary, scope mismatch, and expired approval before accepting an independent approver', async () => {
    const test = harness();
    test.approvals.set('approval-1', {
      requestId: 'approval-1',
      commandId: 'critical-1',
      authorId: 'author',
      beneficiaryId: 'beneficiary',
      capability: 'session:revoke',
      scope: 'sessions',
      risk: 'critical',
      status: 'pending',
      createdAt: now,
      expiresAt: fifteenMinutesLater,
      version: 1n,
    });
    const base = {
      commandId: 'approve-command',
      requestId: 'approval-1',
      capability: 'session:revoke',
      scopes: ['sessions'],
      reason: 'Independent critical review',
      authorizationContextId: 'context-admin.approval.approve',
    } as const;

    await expect(
      approveAdminAccessRequest(test.dependencies, {
        ...base,
        actorId: 'author',
        stepUp: stepUp('author', 'admin.approval.approve', 'approval', 'approval:approval-1'),
      }),
    ).resolves.toMatchObject({ ok: false, code: 'INDEPENDENT_APPROVER_REQUIRED' });
    await expect(
      approveAdminAccessRequest(test.dependencies, {
        ...base,
        actorId: 'approver',
        scopes: ['devices'],
        stepUp: stepUp('approver', 'admin.approval.approve', 'approval', 'approval:approval-1'),
      }),
    ).resolves.toMatchObject({ ok: false, code: 'APPROVAL_SCOPE_MISMATCH' });

    await expect(
      approveAdminAccessRequest(test.dependencies, {
        ...base,
        actorId: 'approver',
        stepUp: stepUp('approver', 'admin.approval.approve', 'approval', 'approval:approval-1'),
      }),
    ).resolves.toMatchObject({ ok: true, outcome: 'approval-recorded' });
    expect(test.approvals.get('approval-1')).toMatchObject({
      status: 'approved',
      approverId: 'approver',
      version: 2n,
    });
  });

  it('bounds approval requests to fifteen minutes and reassigns only to an independent actor', async () => {
    const test = harness();
    await expect(
      requestAdminApproval(test.dependencies, {
        actorId: 'author',
        commandId: 'request-too-long',
        requestId: 'approval-too-long',
        beneficiaryId: 'beneficiary',
        capability: 'session:revoke',
        scope: 'sessions',
        risk: 'critical',
        expiresAt: '2030-01-01T00:15:00.001Z',
      }),
    ).resolves.toEqual({ ok: false, code: 'APPROVAL_WINDOW_INVALID' });

    await expect(
      requestAdminApproval(test.dependencies, {
        actorId: 'author',
        commandId: 'request-1',
        requestId: 'approval-2',
        beneficiaryId: 'beneficiary',
        capability: 'session:revoke',
        scope: 'sessions',
        risk: 'critical',
        expiresAt: fifteenMinutesLater,
      }),
    ).resolves.toMatchObject({ ok: true, outcome: 'approval-requested' });

    await expect(
      reassignAdminApproval(test.dependencies, {
        actorId: 'security-lead',
        commandId: 'reassign-self',
        requestId: 'approval-2',
        newApproverId: 'beneficiary',
        reason: 'Move review coverage',
        authorizationContextId: 'context-admin.approval.reassign',
        stepUp: stepUp(
          'security-lead',
          'admin.approval.reassign',
          'approval',
          'approval:approval-2',
        ),
      }),
    ).resolves.toMatchObject({ ok: false, code: 'INDEPENDENT_APPROVER_REQUIRED' });
    await expect(
      reassignAdminApproval(test.dependencies, {
        actorId: 'security-lead',
        commandId: 'reassign-1',
        requestId: 'approval-2',
        newApproverId: 'independent-approver',
        reason: 'Move review coverage',
        authorizationContextId: 'context-admin.approval.reassign',
        stepUp: stepUp(
          'security-lead',
          'admin.approval.reassign',
          'approval',
          'approval:approval-2',
        ),
      }),
    ).resolves.toMatchObject({ ok: true, outcome: 'approval-reassigned' });
    expect(test.approvals.get('approval-2')).toMatchObject({
      assignedApproverId: 'independent-approver',
      version: 2n,
    });
  });

  it('rolls back offboarding unless sessions, delegations, approvals, and urgent work all converge', async () => {
    const test = harness();
    test.memberships.set('member-1', {
      membershipId: 'membership-1',
      identityId: 'member-1',
      status: 'active',
      functions: ['support'],
      strongFactor: 'passkey',
      version: 1n,
      activatedAt: now,
      permissions: supportAssignment,
    });
    const input = {
      actorId: 'owner',
      commandId: 'offboard-1',
      identityId: 'member-1',
      expectedVersion: 1n,
      reason: 'Compromised administrator credential',
      compromise: true,
      authorizationContextId: 'context-admin.membership.offboard',
      stepUp: stepUp('owner', 'admin.membership.offboard', 'membership', 'membership:member-1'),
    } as const;
    test.failReassignment();

    await expect(offboardAdminIdentity(test.dependencies, input)).resolves.toEqual({
      ok: false,
      code: 'GOVERNANCE_UNAVAILABLE',
    });
    expect(test.memberships.get('member-1')?.status).toBe('active');
    expect(test.committedEffects).toEqual([]);

    const success = harness();
    const activeMembership = test.memberships.get('member-1');
    if (activeMembership === undefined) throw new Error('active membership fixture missing');
    success.memberships.set('member-1', activeMembership);
    await expect(offboardAdminIdentity(success.dependencies, input)).resolves.toMatchObject({
      ok: true,
      outcome: 'identity-offboarded',
      reassignedWorkIds: ['work-1'],
    });
    expect(success.memberships.get('member-1')).toMatchObject({
      status: 'offboarded',
      version: 2n,
    });
    expect(success.committedEffects).toEqual(
      expect.arrayContaining([
        'sessions',
        'delegations',
        'approvals',
        'work',
        'audit',
        'outbox',
        'receipt',
      ]),
    );
  });

  it('expires delegation authority and keeps simulation projection-only', async () => {
    const test = harness();
    test.memberships.set('member-1', {
      membershipId: 'membership-1',
      identityId: 'member-1',
      status: 'active',
      functions: ['support'],
      strongFactor: 'passkey',
      version: 1n,
      activatedAt: now,
      permissions: supportAssignment,
    });
    test.delegations.set('delegation-1', {
      delegationId: 'delegation-1',
      delegatorId: 'owner',
      delegateId: 'member-1',
      capabilities: ['support:view'],
      scopes: ['support-cases'],
      purpose: 'Holiday cover',
      status: 'active',
      version: 1n,
      createdAt: '2029-12-01T00:00:00.000Z',
      expiresAt: '2029-12-31T00:00:00.000Z',
    });

    await expect(
      expireAdminDelegation(test.dependencies, {
        actorId: 'system',
        commandId: 'expire-1',
        delegationId: 'delegation-1',
      }),
    ).resolves.toMatchObject({ ok: true, outcome: 'delegation-expired' });
    expect(test.delegations.get('delegation-1')).toMatchObject({ status: 'expired', version: 2n });

    const transactionsBeforeSimulation = test.transactionCount;
    await expect(
      simulateAdminFunction(test.dependencies, {
        actorId: 'owner',
        identityId: 'member-1',
        targetFunction: 'support',
      }),
    ).resolves.toMatchObject({
      ok: true,
      outcome: 'simulation-projected',
      canAuthorizeAction: false,
      session: { simulation: true },
    });
    expect(test.transactionCount).toBe(transactionsBeforeSimulation);
  });

  it('masks audit values by default and audits a reasoned step-up reveal', async () => {
    const test = harness();
    await expect(
      revealAdminAuditValue(test.dependencies, {
        actorId: 'auditor',
        commandId: 'reveal-mask',
        redactedTarget: 'audit:1',
        value: 'sensitive-value',
        reveal: false,
      }),
    ).resolves.toEqual({ ok: true, outcome: 'audit-masked', value: '[masked]' });

    await expect(
      revealAdminAuditValue(test.dependencies, {
        actorId: 'auditor',
        commandId: 'reveal-1',
        redactedTarget: 'audit:1',
        value: 'sensitive-value',
        reveal: true,
        reason: 'Investigate immutable chain discrepancy',
        activeFunction: 'audit',
        capabilities: ['audit:reveal-sensitive'],
        authorizationContextId: 'context-admin.audit.reveal',
        stepUp: stepUp('auditor', 'admin.audit.reveal', 'audit-event', 'audit:1'),
      }),
    ).resolves.toMatchObject({ ok: true, outcome: 'audit-revealed', value: 'sensitive-value' });
    expect(test.committedEffects).toEqual(expect.arrayContaining(['audit', 'receipt']));
  });
});
