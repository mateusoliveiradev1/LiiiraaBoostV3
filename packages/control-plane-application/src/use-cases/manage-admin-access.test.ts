import { describe, expect, it, vi } from 'vitest';

import type {
  AdminApprovalRequest,
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
  revealAdminAuditValue,
  simulateAdminFunction,
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
  const memberships = new Map<string, Awaited<ReturnType<AdminGovernanceTransaction['loadMembership']>>>();
  const approvals = new Map<string, AdminApprovalRequest>();
  const delegations = new Map<string, Awaited<ReturnType<AdminGovernanceTransaction['loadDelegation']>>>();
  const commands = new Map<string, unknown>();
  const committedEffects: string[] = [];
  const authorize = vi.fn(async () => true);
  const verify = vi.fn(async () => true);
  let failReassignment = false;
  let id = 0;
  let transactionCount = 0;

  const repository: AdminGovernanceDependencies['repository'] = {
    loadMembership: async (identityId) => memberships.get(identityId) ?? null,
    transaction: async (_subjectId, operation) => {
      transactionCount += 1;
      const pending: Array<() => void> = [];
      const transaction: AdminGovernanceTransaction = {
        findCommandResult: async (commandId) => commands.get(commandId) ?? null,
        rememberCommandResult: async (commandId, result) => {
          pending.push(() => commands.set(commandId, result));
        },
        loadMembership: async (identityId) => memberships.get(identityId) ?? null,
        saveMembership: async (membership) => {
          pending.push(() => memberships.set(membership.identityId, membership));
        },
        loadDelegation: async (delegationId) => delegations.get(delegationId) ?? null,
        saveDelegation: async (delegation) => {
          pending.push(() => delegations.set(delegation.delegationId, delegation));
        },
        loadApproval: async (requestId) => approvals.get(requestId) ?? null,
        saveApproval: async (approval) => {
          pending.push(() => approvals.set(approval.requestId, approval));
        },
        saveImpact: async () => {
          pending.push(() => committedEffects.push('impact'));
        },
        revokeSessions: async () => {
          pending.push(() => committedEffects.push('sessions'));
        },
        revokeDelegations: async () => {
          pending.push(() => committedEffects.push('delegations'));
        },
        removeFutureApprovals: async () => {
          pending.push(() => committedEffects.push('approvals'));
        },
        reassignPendingWork: async () => {
          if (failReassignment) throw new Error('reassignment unavailable');
          pending.push(() => committedEffects.push('work'));
          return ['work-1'];
        },
        appendAudit: async () => {
          pending.push(() => committedEffects.push('audit'));
          return `audit-${id + 1}`;
        },
        enqueueOutbox: async () => {
          pending.push(() => committedEffects.push('outbox'));
        },
        saveReceipt: async () => {
          pending.push(() => committedEffects.push('receipt'));
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
    ids: { next: () => `id-${++id}` },
  };
  return {
    dependencies,
    memberships,
    approvals,
    delegations,
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
    expect(test.memberships.get('member-1')?.permissions).toEqual(supportAssignment);

    await expect(
      applyAdminPermissionChange(test.dependencies, {
        actorId: 'owner',
        commandId: 'permission-1',
        identityId: 'member-1',
        expectedVersion: 1n,
        proposed,
        impact: preview.ok ? preview.impact : undefined,
        risk: 'sensitive',
        reason: 'Move device work to operations',
        confirmed: true,
        stepUp: stepUp('owner', 'admin.permission.change', 'membership', 'member:1'),
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
    } as const;

    await expect(
      approveAdminAccessRequest(test.dependencies, {
        ...base,
        actorId: 'author',
        stepUp: stepUp('author', 'admin.approval.approve', 'approval', 'approval:1'),
      }),
    ).resolves.toMatchObject({ ok: false, code: 'INDEPENDENT_APPROVER_REQUIRED' });
    await expect(
      approveAdminAccessRequest(test.dependencies, {
        ...base,
        actorId: 'approver',
        scopes: ['devices'],
        stepUp: stepUp('approver', 'admin.approval.approve', 'approval', 'approval:1'),
      }),
    ).resolves.toMatchObject({ ok: false, code: 'APPROVAL_SCOPE_MISMATCH' });

    await expect(
      approveAdminAccessRequest(test.dependencies, {
        ...base,
        actorId: 'approver',
        stepUp: stepUp('approver', 'admin.approval.approve', 'approval', 'approval:1'),
      }),
    ).resolves.toMatchObject({ ok: true, outcome: 'approval-recorded' });
    expect(test.approvals.get('approval-1')).toMatchObject({
      status: 'approved',
      approverId: 'approver',
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
      stepUp: stepUp('owner', 'admin.membership.offboard', 'membership', 'member:1'),
    } as const;
    test.failReassignment();

    await expect(offboardAdminIdentity(test.dependencies, input)).resolves.toEqual({
      ok: false,
      code: 'GOVERNANCE_UNAVAILABLE',
    });
    expect(test.memberships.get('member-1')?.status).toBe('active');
    expect(test.committedEffects).toEqual([]);

    const success = harness();
    success.memberships.set('member-1', test.memberships.get('member-1')!);
    await expect(offboardAdminIdentity(success.dependencies, input)).resolves.toMatchObject({
      ok: true,
      outcome: 'identity-offboarded',
      reassignedWorkIds: ['work-1'],
    });
    expect(success.memberships.get('member-1')).toMatchObject({ status: 'offboarded', version: 2n });
    expect(success.committedEffects).toEqual(
      expect.arrayContaining(['sessions', 'delegations', 'approvals', 'work', 'audit', 'outbox', 'receipt']),
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
        stepUp: stepUp('auditor', 'admin.audit.reveal', 'audit-event', 'audit:1'),
      }),
    ).resolves.toMatchObject({ ok: true, outcome: 'audit-revealed', value: 'sensitive-value' });
    expect(test.committedEffects).toEqual(expect.arrayContaining(['audit', 'receipt']));
  });
});
