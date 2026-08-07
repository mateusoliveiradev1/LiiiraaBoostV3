import { createHmac } from 'node:crypto';

import Fastify from 'fastify';
import { describe, expect, it, vi } from 'vitest';

import { registerAdminApprovalRoutes } from './approval-routes.js';
import type { AdminGovernanceRouteSession } from './governance-routes.js';

const origin = 'https://admin.test.liiiraa.dev';
const csrfSecret = 'synthetic-approval-csrf-secret-123456789012';
const now = '2030-02-01T12:00:00.000Z';

const csrf = () => {
  const nonce = 'approval-nonce-abcdefghijklmnopqrstuvwxyz';
  return `${nonce}.${createHmac('sha256', csrfSecret).update(nonce).digest('base64url')}`;
};

const command = (action: 'update-access' | 'request-approval', target: string) => ({
  schemaVersion: '1.0',
  kind: 'admin-operation-command',
  commandId: `command-${action}`,
  actorId: 'approver-one',
  activeFunction: 'security',
  action,
  targetReferences: [target],
  reason: 'Reviewed independent access decision',
  expectedVersion: '1',
  expectedEtag: `${target}-v1`,
  approvalReferences: [],
  correlationId: `correlation-${action}`,
  requestedAt: now,
});

const session: AdminGovernanceRouteSession = {
  sessionId: 'session-approver',
  actorId: 'approver-one',
  activeFunction: 'security',
  navigation: ['security'],
  dataScopes: ['sessions'],
  capabilities: ['session:revoke'],
  governanceCapabilities: ['admin-permissions:manage', 'admin-approval:manage'],
  governanceScopes: ['team', 'reviews'],
  simulation: false,
  version: 1n,
};

const stepUp = (overrides: Readonly<Record<string, unknown>> = {}) => ({
  evidenceId: 'step-up-one',
  actorId: 'approver-one',
  authorizationContextId: 'context-one',
  action: 'admin.approval.approve',
  resource: 'approval',
  redactedTarget: 'approval:approval-one',
  method: 'passkey' as const,
  verifiedAt: '2030-02-01T11:58:00.000Z',
  expiresAt: '2030-02-01T12:03:00.000Z',
  ...overrides,
});

const buildApp = async (options: Readonly<{ stepUp?: ReturnType<typeof stepUp> | null }> = {}) => {
  const impact = {
    impactId: 'impact-one',
    identityId: 'beneficiary-one',
    membershipVersion: 1n,
    before: { functions: ['support'], capabilities: ['support:view'], scopes: ['support-cases'] },
    after: { functions: ['security'], capabilities: ['session:revoke'], scopes: ['sessions'] },
    gainedFunctions: ['security'],
    lostFunctions: ['support'],
    gainedCapabilities: ['session:revoke'],
    lostCapabilities: ['support:view'],
    gainedScopes: ['sessions'],
    lostScopes: ['support-cases'],
    affectedSessions: true as const,
    invalidatesPendingApprovals: true as const,
    projectedAt: now,
  };
  const operations = {
    preview: vi.fn(() =>
      Promise.resolve({ ok: true as const, outcome: 'impact-projected' as const, impact }),
    ),
    request: vi.fn(() =>
      Promise.resolve({ ok: true, outcome: 'approval-requested', receiptId: 'receipt-request' }),
    ),
    approve: vi.fn(() =>
      Promise.resolve({ ok: true, outcome: 'approval-recorded', receiptId: 'receipt-approve' }),
    ),
    cancel: vi.fn(() =>
      Promise.resolve({ ok: true, outcome: 'approval-cancelled', receiptId: 'receipt-cancel' }),
    ),
    reassign: vi.fn(() =>
      Promise.resolve({ ok: true, outcome: 'approval-reassigned', receiptId: 'receipt-reassign' }),
    ),
  };
  const executeBreakGlass = vi.fn(() =>
    Promise.resolve({
      ok: true as const,
      outcome: 'break-glass-scheduled',
      receiptId: 'receipt-break-glass',
    }),
  );
  const app = Fastify();
  await registerAdminApprovalRoutes(app, {
    allowedOrigin: origin,
    csrfSecret,
    governance: {} as never,
    operations: operations as never,
    resolveSession: () => Promise.resolve(session),
    resolveStepUp: () => Promise.resolve(options.stepUp === undefined ? stepUp() : options.stepUp),
    loadBreakGlassContext: () =>
      Promise.resolve({
        administratorCount: 1,
        risk: 'critical' as const,
        massAction: false,
        strongFactor: 'passkey',
        safetyDelayUntil: '2030-02-01T12:01:00.000Z',
        alertsSent: true,
      }),
    executeBreakGlass,
    rateLimit: () => Promise.resolve(true),
    clock: { now: () => new Date(now) },
  });
  await app.ready();
  return { app, operations, executeBreakGlass };
};

describe('admin approval and impact routes', () => {
  it('projects server-owned impact and ignores client-computed before/after authority', async () => {
    const { app, operations } = await buildApp();
    const response = await app.inject({
      method: 'POST',
      url: '/v1/admin/governance/impact',
      headers: { origin, 'x-csrf-token': csrf() },
      payload: {
        command: command('update-access', 'beneficiary-one'),
        identityId: 'beneficiary-one',
        proposed: {
          functions: ['security'],
          capabilities: ['session:revoke'],
          scopes: ['sessions'],
        },
        before: { functions: ['audit'] },
        gainedCapabilities: ['audit:export'],
      },
    });
    expect(response.statusCode).toBe(200);
    expect(JSON.stringify(operations.preview.mock.calls)).not.toMatch(
      /"before"|"gainedCapabilities"/u,
    );
    expect(response.json<{ impact: Readonly<Record<string, unknown>> }>().impact).toMatchObject({
      affectedSessions: true,
      invalidatesPendingApprovals: true,
    });
    await app.close();
  });

  it('binds approval to independent actor capability/scope and fresh action-specific step-up', async () => {
    const { app, operations } = await buildApp();
    const response = await app.inject({
      method: 'POST',
      url: '/v1/admin/governance/approvals/approval-one/approve',
      headers: { origin, 'x-csrf-token': csrf() },
      payload: {
        command: command('request-approval', 'approval-one'),
        authorizationContextId: 'context-one',
        capability: 'admin-permissions:manage',
        scopes: ['membership'],
        authorId: 'approver-one',
        eligible: true,
      },
    });
    expect(response.statusCode).toBe(200);
    expect(operations.approve).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({ actorId: 'approver-one', requestId: 'approval-one' }),
    );

    const stale = await buildApp({ stepUp: stepUp({ verifiedAt: '2030-02-01T11:50:00.000Z' }) });
    const denied = await stale.app.inject({
      method: 'POST',
      url: '/v1/admin/governance/approvals/approval-one/approve',
      headers: { origin, 'x-csrf-token': csrf() },
      payload: {
        command: command('request-approval', 'approval-one'),
        authorizationContextId: 'context-one',
        capability: 'admin-permissions:manage',
        scopes: ['membership'],
      },
    });
    expect(denied.statusCode).toBe(403);
    expect(stale.operations.approve).not.toHaveBeenCalled();
    await app.close();
    await stale.app.close();
  });

  it('supports governed cancellation and reassignment without accepting client eligibility', async () => {
    const { app, operations } = await buildApp();
    for (const action of ['cancel', 'reassign'] as const) {
      const response = await app.inject({
        method: 'POST',
        url: `/v1/admin/governance/approvals/approval-one/${action}`,
        headers: { origin, 'x-csrf-token': csrf() },
        payload: {
          command: command('request-approval', 'approval-one'),
          authorizationContextId: 'context-one',
          newApproverId: 'approver-two',
          eligible: true,
        },
      });
      expect(response.statusCode).toBe(200);
    }
    expect(operations.cancel).toHaveBeenCalledOnce();
    expect(operations.reassign).toHaveBeenCalledOnce();
    await app.close();
  });

  it('admits only delayed alerted solo critical break-glass and blocks mass or irreversible work', async () => {
    const { app, executeBreakGlass } = await buildApp();
    const admitted = await app.inject({
      method: 'POST',
      url: '/v1/admin/governance/break-glass',
      headers: { origin, 'x-csrf-token': csrf() },
      payload: {
        command: command('request-approval', 'critical-one'),
        authorizationContextId: 'context-one',
        executeAt: '2030-02-01T12:01:00.000Z',
        expiresAt: '2030-02-01T12:10:00.000Z',
      },
    });
    expect(admitted.statusCode).toBe(200);
    expect(executeBreakGlass).toHaveBeenCalledOnce();

    const blocked = await app.inject({
      method: 'POST',
      url: '/v1/admin/governance/break-glass',
      headers: { origin, 'x-csrf-token': csrf() },
      payload: {
        command: command('request-approval', 'critical-one'),
        authorizationContextId: 'context-one',
        executeAt: '2030-02-01T12:00:00.000Z',
        expiresAt: '2030-02-01T12:20:00.000Z',
        massAction: true,
        risk: 'irreversible',
      },
    });
    expect(blocked.statusCode).toBe(403);
    expect(executeBreakGlass).toHaveBeenCalledOnce();
    await app.close();
  });
});
