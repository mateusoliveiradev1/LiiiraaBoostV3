import { createHmac } from 'node:crypto';

import Fastify from 'fastify';
import { describe, expect, it, vi } from 'vitest';

import { registerAdminOperationsRoutes } from './operations-routes.js';

const origin = 'https://admin.test.liiiraa.dev';
const csrfSecret = 'synthetic-operations-csrf-secret-1234567890';
const now = '2030-02-01T12:00:00.000Z';

const csrf = () => {
  const nonce = 'operations-nonce-abcdefghijklmnopqrstuvwxyz';
  return `${nonce}.${createHmac('sha256', csrfSecret).update(nonce).digest('base64url')}`;
};

const command = (
  action:
    | 'resolve-incident'
    | 'publish-configuration'
    | 'rollback-configuration'
    | 'execute-privacy-case'
    | 'export-sensitive-data',
  target: string,
) => ({
  schemaVersion: '1.0',
  kind: 'admin-operation-command',
  commandId: `command-${action}`,
  actorId: 'operator-one',
  activeFunction: 'operations',
  action,
  targetReferences: [target],
  reason: `Reviewed ${action}`,
  expectedVersion: '1',
  expectedEtag: `${target}-v1`,
  approvalReferences: [],
  correlationId: `correlation-${action}`,
  requestedAt: now,
});

const session = {
  sessionId: 'session-operations',
  actorId: 'operator-one',
  activeFunction: 'operations',
  capabilities: [
    'admin-operations:search',
    'admin-operations:jobs',
    'admin-operations:conflicts',
    'admin-operations:incidents',
    'admin-operations:exports',
    'admin-operations:configuration',
    'admin-operations:privacy',
    'admin-operations:emergency',
  ] as const,
  scopes: ['support-cases', 'jobs', 'incidents', 'configuration', 'privacy'],
};

const buildApp = async (
  overrides: Readonly<Record<string, unknown>> = {},
  rateLimit = true,
) => {
  const operations = {
    search: vi.fn(() =>
      Promise.resolve({
        ok: true,
        freshness: 'current',
        records: [{ recordId: 'case-one', scope: 'support-cases', maskedTitle: 'Case #1' }],
      }),
    ),
    transitionJob: vi.fn(() =>
      Promise.resolve({ ok: true, outcome: 'job-transitioned', state: { status: 'completed' } }),
    ),
    resolveConflict: vi.fn(() => Promise.resolve({ ok: true, outcome: 'conflict-merged' })),
    recoverIncident: vi.fn(() =>
      Promise.resolve({ ok: true, outcome: 'recovery-started', incident: { incidentId: 'one' } }),
    ),
    startExport: vi.fn(() =>
      Promise.resolve({ ok: true, outcome: 'export-started', export: { exportId: 'export-one' } }),
    ),
    changeConfiguration: vi.fn(() =>
      Promise.resolve({ ok: true, outcome: 'configuration-transitioned' }),
    ),
    executePrivacy: vi.fn(() =>
      Promise.resolve({ ok: true, outcome: 'privacy-case-started' }),
    ),
    stopCapability: vi.fn(() =>
      Promise.resolve({ ok: true, outcome: 'capability-paused', globalStop: false }),
    ),
    ...overrides,
  };
  const queries = {
    list: vi.fn(() =>
      Promise.resolve({
        records: [{ recordId: 'job-one', status: 'running', secret: 'must-not-be-returned' }],
        nextCursor: null,
        freshness: { state: 'live', sequence: '8', observedAt: now },
      }),
    ),
  };
  const freshness = {
    current: vi.fn(() =>
      Promise.resolve({ cursor: 'cursor-9', version: '9', updatedAt: now, resources: ['jobs'] }),
    ),
  };
  const app = Fastify();
  await registerAdminOperationsRoutes(app, {
    allowedOrigin: origin,
    csrfSecret,
    operations: {} as never,
    handlers: operations as never,
    queries,
    freshness,
    resolveSession: () => Promise.resolve(session),
    rateLimit: () => Promise.resolve(rateLimit),
    clock: { now: () => new Date(now) },
  });
  await app.ready();
  return { app, operations, queries, freshness };
};

describe('admin operations routes', () => {
  it('authorizes and filters search server-side without accepting client scopes or owner', async () => {
    const { app, operations } = await buildApp();
    const response = await app.inject({
      method: 'GET',
      url: '/v1/admin/operations/search?q=mateus&environment=staging&viewKind=personal&viewId=my-view&allowedScopes=audit&ownerId=other',
      headers: { origin },
    });
    expect(response.statusCode).toBe(200);
    expect(operations.search).toHaveBeenCalledWith(
      expect.anything(),
      {
        actorId: 'operator-one',
        query: 'mateus',
        targetEnvironment: 'staging',
        view: { kind: 'personal', viewId: 'my-view' },
      },
    );
    expect(JSON.stringify(operations.search.mock.calls)).not.toMatch(/allowedScopes|ownerId/u);

    const hidden = await app.inject({
      method: 'GET',
      url: '/v1/admin/operations/search?q=mateus&environment=staging',
      headers: { origin: 'https://evil.example' },
    });
    expect(hidden.statusCode).toBe(404);
    await app.close();
  });

  it('emits bounded invalidation-only freshness with a reconnect cursor', async () => {
    const { app, freshness } = await buildApp();
    const response = await app.inject({
      method: 'GET',
      url: '/v1/admin/operations/live?environment=staging',
      headers: { origin, 'last-event-id': 'cursor-8' },
    });
    expect(response.statusCode).toBe(200);
    expect(response.headers['content-type']).toContain('text/event-stream');
    expect(response.body).toContain('id: cursor-9');
    expect(response.body).toContain('event: invalidate');
    expect(response.body).not.toMatch(/secret|payload|email/u);
    expect(freshness.current).toHaveBeenCalledWith(
      expect.objectContaining({ reconnectCursor: 'cursor-8', actorId: 'operator-one' }),
    );
    await app.close();
  });

  it('keeps stale, partial, rate-limit and degraded outcomes distinct and never secretly queues', async () => {
    for (const [result, status] of [
      [{ ok: false, code: 'STALE', secretlyQueued: false }, 409],
      [{ ok: false, code: 'PARTIAL', secretlyQueued: false }, 207],
      [{ ok: false, code: 'RATE_LIMITED', secretlyQueued: false }, 429],
      [{ ok: false, code: 'OPERATIONS_UNAVAILABLE', secretlyQueued: false }, 503],
    ] as const) {
      const { app } = await buildApp({ transitionJob: vi.fn(() => Promise.resolve(result)) });
      const response = await app.inject({
        method: 'POST',
        url: '/v1/admin/operations/jobs/job-one/transitions',
        headers: { origin, 'x-csrf-token': csrf() },
        payload: {
          commandId: 'job-command-one',
          correlationId: 'job-correlation-one',
          idempotencyKey: 'job-idempotency-one',
          expectedVersion: '1',
          transition: 'complete',
          connection: 'connected',
          lastUpdatedAt: now,
          targetEnvironment: 'staging',
          reason: 'Verified job completion',
        },
      });
      expect(response.statusCode).toBe(status);
      expect(response.json()).toMatchObject({ ok: false, secretlyQueued: false });
      await app.close();
    }

    const limited = await buildApp({}, false);
    const response = await limited.app.inject({
      method: 'POST',
      url: '/v1/admin/operations/jobs/job-one/transitions',
      headers: { origin, 'x-csrf-token': csrf() },
      payload: {},
    });
    expect(response.statusCode).toBe(429);
    expect(limited.operations.transitionJob).not.toHaveBeenCalled();
    await limited.app.close();
  });

  it('starts only minimum-scope masked encrypted exports from generated commands', async () => {
    const { app, operations } = await buildApp();
    const response = await app.inject({
      method: 'POST',
      url: '/v1/admin/operations/exports',
      headers: { origin, 'x-csrf-token': csrf() },
      payload: {
        command: command('export-sensitive-data', 'export-one'),
        idempotencyKey: 'export-idempotency-one',
        purpose: 'Resolve verified support request',
        fields: ['accountId'],
        minimumFields: ['accountId'],
        previewed: true,
        masked: true,
        approved: true,
        encrypted: true,
        expiresAt: '2030-02-01T12:15:00.000Z',
        targetEnvironment: 'staging',
      },
    });
    expect(response.statusCode).toBe(202);
    expect(operations.startExport).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({
        actorId: 'operator-one',
        fields: ['accountId'],
        minimumFields: ['accountId'],
        masked: true,
        encrypted: true,
      }),
    );
    await app.close();
  });

  it('routes allowlisted incident recovery, rollback, privacy and expiring emergency controls', async () => {
    const { app, operations } = await buildApp();
    const incident = await app.inject({
      method: 'POST',
      url: '/v1/admin/operations/incidents/incident-one/recover',
      headers: { origin, 'x-csrf-token': csrf() },
      payload: {
        command: command('resolve-incident', 'incident-one'),
        idempotencyKey: 'incident-idempotency',
        severity: 'critical',
        ownerId: 'owner-one',
        substituteId: 'substitute-one',
        ownerAvailable: false,
        deadline: '2030-02-01T12:05:00.000Z',
        procedureVersion: 'recover-provider-v1',
        boundedOperation: true,
        previewed: true,
        rehearsed: true,
        riskApproved: true,
        validationDefined: true,
        compensationDefined: true,
        targetEnvironment: 'staging',
      },
    });
    const rollback = await app.inject({
      method: 'POST',
      url: '/v1/admin/operations/configurations/config-one/transitions',
      headers: { origin, 'x-csrf-token': csrf() },
      payload: {
        command: command('rollback-configuration', 'config-one'),
        idempotencyKey: 'config-idempotency',
        transition: 'rollback',
        rollbackVersion: 'release-previous',
        sessionEnvironment: 'staging',
        targetEnvironment: 'staging',
        integrationEnvironment: 'staging',
        productionStrongAccess: false,
      },
    });
    const emergency = await app.inject({
      method: 'POST',
      url: '/v1/admin/operations/emergency-stops',
      headers: { origin, 'x-csrf-token': csrf() },
      payload: {
        commandId: 'emergency-command-one',
        correlationId: 'emergency-correlation-one',
        idempotencyKey: 'emergency-idempotency-one',
        capability: 'provider-checkout',
        strongAuth: true,
        reason: 'Stop degraded provider writes',
        expiresAt: '2030-02-01T12:10:00.000Z',
        safeRestorationDefined: true,
        targetEnvironment: 'staging',
      },
    });
    expect([incident.statusCode, rollback.statusCode, emergency.statusCode]).toEqual([202, 200, 202]);
    expect(operations.recoverIncident).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({ procedureVersion: 'recover-provider-v1' }),
    );
    expect(operations.changeConfiguration).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({ command: 'rollback', expectedVersion: 1n }),
    );
    expect(operations.stopCapability).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({ expiresAt: '2030-02-01T12:10:00.000Z' }),
    );
    await app.close();
  });
});
