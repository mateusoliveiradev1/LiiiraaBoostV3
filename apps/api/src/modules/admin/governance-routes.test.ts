import { createHmac } from 'node:crypto';

import Fastify from 'fastify';
import { describe, expect, it, vi } from 'vitest';

import {
  registerAdminGovernanceRoutes,
  type AdminGovernanceRouteSession,
} from './governance-routes.js';

const origin = 'https://admin.test.liiiraa.dev';
const csrfSecret = 'synthetic-governance-csrf-secret-1234567890';
const now = '2030-02-01T12:00:00.000Z';

const csrf = (nonce = 'governance-nonce-abcdefghijklmnopqrstuvwxyz') =>
  `${nonce}.${createHmac('sha256', csrfSecret).update(nonce).digest('base64url')}`;

const command = (target = 'identity-one') => ({
  schemaVersion: '1.0',
  kind: 'admin-operation-command',
  commandId: 'governance-command-one',
  actorId: 'operator-one',
  activeFunction: 'security',
  action: 'update-access',
  targetReferences: [target],
  reason: 'Reviewed access governance change',
  expectedVersion: '7',
  expectedEtag: `${target}-v7`,
  approvalReferences: ['approval-one'],
  correlationId: 'governance-correlation-one',
  requestedAt: now,
});

const session: AdminGovernanceRouteSession = {
  sessionId: 'session-one',
  actorId: 'operator-one',
  activeFunction: 'security',
  navigation: ['security'],
  dataScopes: ['sessions', 'diagnostic-metadata'],
  capabilities: ['session:revoke', 'diagnostics:view', 'audit:reveal-sensitive'],
  governanceCapabilities: [
    'admin-membership:activate',
    'admin-membership:manage',
    'admin-delegation:manage',
    'admin-access:review',
    'admin-function:simulate',
  ],
  governanceScopes: ['team', 'delegations', 'reviews', 'history'],
  simulation: false,
  version: 4n,
};

const buildApp = async (authorized = true) => {
  const queries = {
    listTeam: vi.fn(() =>
      Promise.resolve({
        records: [
          {
            identityReference: 'identity-one',
            displayName: 'M*** O*******',
            status: 'active',
            functions: ['security'],
            version: 7n,
          },
        ],
        nextCursor: null,
      }),
    ),
    loadTeamMember: vi.fn(() =>
      Promise.resolve({
        identityReference: 'identity-one',
        displayName: 'M*** O*******',
        status: 'active',
        functions: ['security'],
        version: 7n,
      }),
    ),
    history: vi.fn(() => Promise.resolve([{ kind: 'membership-activated', at: now }])),
  };
  const ok = (outcome: string) => Promise.resolve({ ok: true, outcome, receiptId: 'receipt-one' });
  const operations = {
    activate: vi.fn(() => ok('membership-activated')),
    switchFunction: vi.fn(() =>
      Promise.resolve({
        ok: true,
        outcome: 'function-switched',
        session: { ...session, activeFunction: 'operations', version: 5n },
      }),
    ),
    delegate: vi.fn(() => ok('delegation-created')),
    offboard: vi.fn(() => ok('identity-offboarded')),
    review: vi.fn(() => ok('access-reviewed')),
    simulate: vi.fn(() =>
      Promise.resolve({
        ok: true,
        outcome: 'simulation-projected',
        session: { ...session, simulation: true },
        canAuthorizeAction: false,
      }),
    ),
  };
  const app = Fastify();
  await registerAdminGovernanceRoutes(app, {
    allowedOrigin: origin,
    csrfSecret,
    governance: {} as never,
    queries,
    operations: operations as never,
    resolveSession: () => Promise.resolve(authorized ? session : null),
    resolveStepUp: () =>
      Promise.resolve({
        evidenceId: 'step-up-one',
        actorId: 'operator-one',
        authorizationContextId: 'context-one',
        action: 'admin.membership.offboard',
        resource: 'membership',
        redactedTarget: 'membership:identity-one',
        method: 'passkey' as const,
        verifiedAt: '2030-02-01T11:58:00.000Z',
        expiresAt: '2030-02-01T12:03:00.000Z',
      }),
    rateLimit: () => Promise.resolve(true),
  });
  await app.ready();
  return { app, operations, queries };
};

describe('admin governance routes', () => {
  it('authorizes before team queries and returns only masked bounded projections', async () => {
    const denied = await buildApp(false);
    const hidden = await denied.app.inject({
      method: 'GET',
      url: '/v1/admin/governance/team?limit=25',
      headers: { origin },
    });
    expect(hidden.statusCode).toBe(404);
    expect(hidden.json()).toEqual({ records: [] });
    expect(denied.queries.listTeam).not.toHaveBeenCalled();
    await denied.app.close();

    const allowed = await buildApp();
    const response = await allowed.app.inject({
      method: 'GET',
      url: '/v1/admin/governance/team?limit=25',
      headers: { origin },
    });
    expect(response.statusCode).toBe(200);
    expect(response.body).toContain('M*** O*******');
    expect(response.body).not.toMatch(/@|password|credential|token/iu);
    await allowed.app.close();
  });

  it('rejects hostile origin, forged CSRF, and simulation before mutation access', async () => {
    const { app, operations } = await buildApp();
    for (const headers of [
      { origin: 'https://attacker.example', 'x-csrf-token': csrf() },
      { origin, 'x-csrf-token': 'forged' },
    ]) {
      const response = await app.inject({
        method: 'POST',
        url: '/v1/admin/governance/offboard',
        headers,
        payload: { command: command(), compromise: true, authorizationContextId: 'context-one' },
      });
      expect(response.statusCode).toBe(404);
    }
    expect(operations.offboard).not.toHaveBeenCalled();

    const simulation = await app.inject({
      method: 'POST',
      url: '/v1/admin/governance/simulate',
      headers: { origin, 'x-csrf-token': csrf() },
      payload: { identityId: 'identity-one', targetFunction: 'operations' },
    });
    expect(simulation.statusCode).toBe(200);
    expect(simulation.json()).toMatchObject({ canAuthorizeAction: false });
    expect(simulation.body).not.toMatch(/authorizationContextId|approvalReferences/iu);
    await app.close();
  });

  it('uses generated commands and server session/version authority for switch and offboarding', async () => {
    const { app, operations } = await buildApp();
    const switched = await app.inject({
      method: 'POST',
      url: '/v1/admin/governance/functions/switch',
      headers: { origin, 'x-csrf-token': csrf() },
      payload: {
        command: command('session-one'),
        targetFunction: 'operations',
        authorizationContextId: 'context-one',
      },
    });
    expect(switched.statusCode).toBe(200);
    expect(operations.switchFunction).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({ actorId: 'operator-one', sessionId: 'session-one' }),
    );

    const offboarded = await app.inject({
      method: 'POST',
      url: '/v1/admin/governance/offboard',
      headers: { origin, 'x-csrf-token': csrf() },
      payload: { command: command(), compromise: true, authorizationContextId: 'context-one' },
    });
    expect(offboarded.statusCode).toBe(200);
    expect(operations.offboard).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({
        actorId: 'operator-one',
        identityId: 'identity-one',
        expectedVersion: 7n,
      }),
    );
    await app.close();
  });
});
