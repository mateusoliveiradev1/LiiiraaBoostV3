import { createHmac } from 'node:crypto';

import Fastify from 'fastify';
import { describe, expect, it, vi } from 'vitest';

import {
  registerAdminInvitationRoutes,
  type AdminInvitationRouteOperations,
  type AdminInvitationRouteSession,
} from './invitation-routes.js';

const origin = 'https://admin.test.liiiraa.dev';
const secret = 'synthetic-admin-invitation-csrf-secret-123456789';
const now = '2030-01-01T00:00:00.000Z';

const csrf = (nonce = 'invitation-nonce-abcdefghijklmnopqrstuvwxyz') =>
  `${nonce}.${createHmac('sha256', secret).update(nonce).digest('base64url')}`;

const command = (
  action: 'issue-invitations' | 'resend-invitations' | 'revoke-invitations',
  expectedVersion = '0',
) => ({
  schemaVersion: '1.0',
  kind: 'admin-operation-command',
  commandId: `command-${action}`,
  actorId: 'operator-1',
  activeFunction: 'operations',
  action,
  targetReferences: ['invitation-1'],
  reason: 'Reviewed private beta operation',
  expectedVersion,
  expectedEtag: `invitation-invitation-1-v${expectedVersion}`,
  approvalReferences: [],
  correlationId: `correlation-${action}`,
  requestedAt: now,
});

const buildApp = async (
  authorized = true,
  activeFunction: AdminInvitationRouteSession['activeFunction'] = 'operations',
) => {
  const operations: AdminInvitationRouteOperations = {
    preflight: vi.fn(() =>
      Promise.resolve({
        ok: true as const,
        rows: [
          {
            rowId: 'row-1',
            recipientKey: 'digest-must-not-leak',
            classification: 'valid' as const,
          },
        ],
      }),
    ),
    issue: vi.fn(() =>
      Promise.resolve({
        ok: true as const,
        outcome: 'issued' as const,
        receiptId: 'receipt-1',
        state: {
          kind: 'beta' as const,
          invitationId: 'invitation-1',
          recipientKey: 'digest-must-not-leak',
          locale: 'pt-BR' as const,
          version: 1n,
          status: 'pending' as const,
          reminderCount: 0,
          reminderWindowStartedAt: now,
          createdAt: now,
          updatedAt: now,
          events: [],
        },
      }),
    ),
    manage: vi.fn(() =>
      Promise.resolve({
        ok: true as const,
        outcome: 'resent' as const,
        receiptId: 'receipt-2',
        state: {
          kind: 'beta' as const,
          invitationId: 'invitation-1',
          recipientKey: 'digest-must-not-leak',
          locale: 'pt-BR' as const,
          version: 2n,
          status: 'pending' as const,
          reminderCount: 0,
          reminderWindowStartedAt: now,
          createdAt: now,
          updatedAt: now,
          expiresAt: '2030-01-15T00:00:00.000Z',
          events: [],
        },
      }),
    ),
    batch: vi.fn(() =>
      Promise.resolve({
        ok: true as const,
        outcome: 'batch-started' as const,
        receiptId: 'receipt-3',
        jobId: 'job-1',
        results: { issued: ['invitation-1'], queued: [], skipped: [], failed: [] },
      }),
    ),
  };
  const queries = {
    list: vi.fn(() =>
      Promise.resolve({
        records: [
          {
            invitationId: 'invitation-1',
            recipientMasked: 'w***@example.com',
            lifecycleState: 'active',
            deliveryState: 'delivered',
            reminderCount: 0,
            locale: 'pt-BR',
            campaignReference: 'private-beta',
            ownerReference: 'operator-1',
            expiresAt: '2030-01-15T00:00:00.000Z',
            lastEventAt: now,
            version: 1n,
          },
        ],
        capacity: { activeCount: 1, activeLimit: 25, queuedCount: 0, version: 4n, updatedAt: now },
        jobs: [
          {
            jobId: 'job-1',
            action: 'resend',
            state: 'queued',
            totalItems: 1,
            completedItems: 0,
            failedItems: 0,
            version: 'queued:0:0',
            startedAt: now,
          },
        ],
        nextCursor: null,
      }),
    ),
    load: vi.fn(() =>
      Promise.resolve({
        invitationId: 'invitation-1',
        recipientMasked: 'w***@example.com',
        lifecycleState: 'active',
        deliveryState: 'delivered',
        reminderCount: 0,
        locale: 'pt-BR',
        campaignReference: 'private-beta',
        ownerReference: 'operator-1',
        expiresAt: '2030-01-15T00:00:00.000Z',
        lastEventAt: now,
        retentionState: 'operational',
        version: 1n,
      }),
    ),
    timeline: vi.fn(() => Promise.resolve([{ kind: 'sent', at: now }])),
  };
  const app = Fastify({ bodyLimit: 256 * 1024 });
  const session: AdminInvitationRouteSession | null = authorized
    ? {
        actorId: 'operator-1',
        activeFunction,
        capabilities: [
          'beta-invitations:preflight',
          'beta-invitations:issue',
          'beta-invitations:manage',
          'beta-invitations:batch',
        ],
        scopes: ['invitations'],
      }
    : null;
  await registerAdminInvitationRoutes(app, {
    allowedOrigin: origin,
    csrfSecret: secret,
    invitations: {} as never,
    clock: { now: () => new Date(now) },
    environment: {
      environmentId: 'staging-brasil',
      kind: 'staging',
      label: 'Staging Brasil',
    },
    operations,
    queries,
    rateLimit: vi.fn(() => Promise.resolve(true)),
    resolveSession: vi.fn(() => Promise.resolve(session)),
  });
  await app.ready();
  return { app, operations, queries };
};

describe('admin invitation management routes', () => {
  it('admits invitation authority for security and operations but hides unsupported functions', async () => {
    for (const activeFunction of ['security', 'operations'] as const) {
      const allowed = await buildApp(true, activeFunction);
      const response = await allowed.app.inject({
        method: 'GET',
        url: '/v1/admin/invitations?limit=25',
        headers: { origin },
      });
      expect(response.statusCode).toBe(200);
      expect(allowed.queries.list).toHaveBeenCalledOnce();
      await allowed.app.close();
    }

    const denied = await buildApp(true, 'support');
    const response = await denied.app.inject({
      method: 'GET',
      url: '/v1/admin/invitations?limit=25',
      headers: { origin },
    });
    expect(response.statusCode).toBe(404);
    expect(denied.queries.list).not.toHaveBeenCalled();
    await denied.app.close();
  });

  it('authorizes before recipient preflight and never returns recipient identity or digest', async () => {
    const denied = await buildApp(false);
    const deniedResponse = await denied.app.inject({
      method: 'POST',
      url: '/v1/admin/invitations/preflight',
      headers: { origin, 'x-csrf-token': csrf() },
      payload: { rows: [{ rowId: 'row-1', recipient: 'private@example.com' }] },
    });
    expect(deniedResponse.statusCode).toBe(404);
    expect(denied.operations.preflight).not.toHaveBeenCalled();
    expect(deniedResponse.body).not.toContain('private@example.com');
    await denied.app.close();

    const allowed = await buildApp();
    const response = await allowed.app.inject({
      method: 'POST',
      url: '/v1/admin/invitations/preflight',
      headers: { origin, 'x-csrf-token': csrf() },
      payload: { rows: [{ rowId: 'row-1', recipient: 'private@example.com' }] },
    });
    expect(response.statusCode).toBe(200);
    expect(response.json()).toEqual({
      ok: true,
      rows: [{ rowId: 'row-1', classification: 'valid' }],
    });
    expect(response.body).not.toMatch(/private@example\.com|digest-must-not-leak/iu);
    await allowed.app.close();
  });

  it('requires exact origin, CSRF, and generated command validation before issue/resend/revoke', async () => {
    const { app, operations } = await buildApp();
    for (const headers of [
      { origin: 'https://attacker.example', 'x-csrf-token': csrf() },
      { origin, 'x-csrf-token': 'forged' },
    ]) {
      const denied = await app.inject({
        method: 'POST',
        url: '/v1/admin/invitations',
        headers,
        payload: {
          command: command('issue-invitations'),
          idempotencyKey: 'issue-idem',
          invitationId: 'invitation-1',
          recipient: 'private@example.com',
          locale: 'pt-BR',
        },
      });
      expect(denied.statusCode).toBe(404);
    }
    const invalid = await app.inject({
      method: 'POST',
      url: '/v1/admin/invitations',
      headers: { origin, 'x-csrf-token': csrf() },
      payload: { command: { kind: 'admin-operation-command' }, recipient: 'private@example.com' },
    });
    expect(invalid.statusCode).toBe(400);
    expect(operations.issue).not.toHaveBeenCalled();

    const issued = await app.inject({
      method: 'POST',
      url: '/v1/admin/invitations',
      headers: { origin, 'x-csrf-token': csrf() },
      payload: {
        command: command('issue-invitations'),
        idempotencyKey: 'issue-idem',
        invitationId: 'invitation-1',
        recipient: 'private@example.com',
        locale: 'pt-BR',
      },
    });
    expect(issued.statusCode).toBe(201);
    expect(issued.json()).toMatchObject({
      document: {
        kind: 'admin-invitation-projection',
        invitationId: 'invitation-1',
        aggregateVersion: '1',
      },
    });
    expect(issued.body).not.toMatch(/private@example\.com|digest-must-not-leak|secret/iu);
    expect(operations.issue).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({ actorId: 'operator-1', expectedVersion: 0n }),
    );

    for (const [path, action] of [
      ['/v1/admin/invitations/invitation-1/resend', 'resend-invitations'],
      ['/v1/admin/invitations/invitation-1/revoke', 'revoke-invitations'],
    ] as const) {
      const response = await app.inject({
        method: 'POST',
        url: path,
        headers: { origin, 'x-csrf-token': csrf() },
        payload: {
          command: command(action, '1'),
          idempotencyKey: `${action}-idem`,
          expiryMode: 'preserve',
        },
      });
      expect(response.statusCode).toBe(200);
    }
    expect(operations.manage).toHaveBeenCalledTimes(2);
    await app.close();
  });

  it('bounds list pagination and preflight CSV/row content before repository or use-case access', async () => {
    const { app, operations, queries } = await buildApp();
    const oversizedList = await app.inject({
      method: 'GET',
      url: '/v1/admin/invitations?limit=101',
      headers: { origin },
    });
    expect(oversizedList.statusCode).toBe(400);
    expect(queries.list).not.toHaveBeenCalled();

    const rows = Array.from({ length: 101 }, (_, index) => ({
      rowId: `row-${String(index)}`,
      recipient: `person-${String(index)}@example.com`,
    }));
    const oversizedRows = await app.inject({
      method: 'POST',
      url: '/v1/admin/invitations/preflight',
      headers: { origin, 'x-csrf-token': csrf() },
      payload: { rows },
    });
    expect(oversizedRows.statusCode).toBe(400);
    expect(operations.preflight).not.toHaveBeenCalled();

    const csv = await app.inject({
      method: 'POST',
      url: '/v1/admin/invitations/preflight',
      headers: {
        origin,
        'x-csrf-token': csrf(),
        'content-type': 'text/csv',
      },
      payload: 'recipient\nfirst@example.com\nsecond@example.com',
    });
    expect(csv.statusCode).toBe(200);
    const preflightCall = vi.mocked(operations.preflight).mock.calls.at(-1);
    expect(preflightCall?.[1].rows).toHaveLength(2);
    await app.close();
  });

  it('returns masked list/detail/timeline projections and bounded governed batches', async () => {
    const { app, operations } = await buildApp();
    const list = await app.inject({
      method: 'GET',
      url: '/v1/admin/invitations?limit=25',
      headers: { origin },
    });
    expect(list.statusCode).toBe(200);
    const listBody = list.json<{ records: { kind: string }[] }>();
    expect(listBody.records.map((record) => record.kind)).toEqual([
      'admin-invitation-projection',
      'admin-invitation-capacity-projection',
      'admin-job-projection',
    ]);
    expect(list.body).toContain('w***@example.com');
    expect(list.body).not.toContain('digest');

    const detail = await app.inject({
      method: 'GET',
      url: '/v1/admin/invitations/invitation-1',
      headers: { origin },
    });
    expect(detail.statusCode).toBe(200);
    expect(detail.json()).toMatchObject({
      document: { kind: 'admin-invitation-projection', invitationId: 'invitation-1' },
      retention: { action: 'retain', basis: 'operational' },
      timeline: [{ kind: 'sent', at: now }],
    });

    const timeline = await app.inject({
      method: 'GET',
      url: '/v1/admin/invitations/invitation-1/timeline',
      headers: { origin },
    });
    expect(timeline.statusCode).toBe(200);
    expect(timeline.json()).toEqual({ events: [{ kind: 'sent', at: now }] });

    const batch = await app.inject({
      method: 'POST',
      url: '/v1/admin/invitations/batches',
      headers: { origin, 'x-csrf-token': csrf() },
      payload: {
        command: command('resend-invitations'),
        idempotencyKey: 'batch-idem',
        action: 'resend',
        impactReviewed: true,
        risk: 'standard',
        approvalGranted: true,
        items: [{ invitationId: 'invitation-1' }],
      },
    });
    expect(batch.statusCode).toBe(202);
    expect(operations.batch).toHaveBeenCalledOnce();
    await app.close();
  });
});
