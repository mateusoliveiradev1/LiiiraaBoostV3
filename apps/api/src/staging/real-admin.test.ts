import type { IdentityActor } from '@liiiraa/control-plane-adapters';
import { controlPlaneDocumentValidator } from '@liiiraa/contracts-ts';
import Fastify from 'fastify';
import { describe, expect, it, vi } from 'vitest';

import { registerAdminRoutes, registerCompleteAdminRoutes } from '../modules/admin/routes.js';
import {
  createPersistentStagingAdminAuthority,
  createPersistentStagingAdminDependencies,
  REAL_STAGING_CAPABILITIES,
} from './runtime.js';
import { runAdminControlPlaneWorkersOnce } from '../worker.js';

const adminOrigin = 'https://admin.staging.example';
const operatorCredential = 'operator-credential-abcdefghijklmnopqrstuvwxyz0123456789';
const testerCredential = 'tester-credential-abcdefghijklmnopqrstuvwxyz0123456789AB';

const actor = (
  role: IdentityActor['role'],
  sessionKind: IdentityActor['sessionKind'],
): IdentityActor => ({
  accountId:
    role === 'tester'
      ? '00000000-0000-4000-8000-000000000001'
      : '00000000-0000-4000-8000-000000000002',
  authenticationMethod: 'password',
  authenticatedAt: '2030-01-15T12:00:00.000Z',
  createdAt: '2030-01-01T00:00:00.000Z',
  displayName: role === 'tester' ? 'Invited Tester' : 'Security Operator',
  email: role === 'tester' ? 'tester@example.com' : 'operator@example.com',
  expiresAt: '2030-02-15T12:00:00.000Z',
  identityVersion: 1n,
  lastSeenAt: '2030-01-15T12:00:00.000Z',
  locale: 'pt-BR',
  role,
  sessionId:
    role === 'tester'
      ? '00000000-0000-4000-8000-000000000011'
      : '00000000-0000-4000-8000-000000000012',
  sessionKind,
  sessionVersion: 1n,
  updatedAt: '2030-01-15T12:00:00.000Z',
});

const createApp = async () => {
  const queries: string[] = [];
  const database = {
    query: vi.fn((statement: string) => {
      queries.push(statement);
      return Promise.resolve(
        statement.includes('FROM sessions')
          ? {
              rowCount: 1,
              rows: [
                {
                  expires_at: '2030-02-15T12:00:00.000Z',
                  id: '00000000-0000-4000-8000-000000000099',
                  revoked_at: null,
                  session_kind: 'admin',
                  token_digest: 'must-never-leave-postgres',
                },
              ],
            }
          : { rowCount: 0, rows: [] },
      );
    }),
  };
  const identity = {
    resolveCredential: vi.fn((credential: string) =>
      Promise.resolve(
        credential === operatorCredential
          ? actor('security', 'admin')
          : credential === testerCredential
            ? actor('tester', 'web')
            : null,
      ),
    ),
  };
  const app = Fastify();
  await registerAdminRoutes(
    app,
    createPersistentStagingAdminDependencies({
      adminOrigin,
      clock: { now: () => new Date('2030-01-15T12:05:00.000Z') },
      database,
      identity,
    }),
  );
  await app.ready();
  return { app, database, identity, queries };
};

const cookie = (credential: string): string =>
  `__Host-liiiraa_session=${encodeURIComponent(credential)}`;

describe('real staging administrative authority', () => {
  it('composes every PostgreSQL registrar before advertising complete Admin readiness', async () => {
    const database = {
      query: vi.fn(() => Promise.resolve({ rowCount: 0, rows: [] })),
      transaction: vi.fn(),
    };
    const identity = { resolveCredential: vi.fn(() => Promise.resolve(null)) };
    const authority = createPersistentStagingAdminAuthority({
      adminOrigin,
      authSecret: 'synthetic-admin-authority-secret-abcdefghijklmnopqrstuvwxyz',
      clock: { now: () => new Date('2030-01-15T12:05:00.000Z') },
      database: database as never,
      environmentId: 'staging',
      identity,
    });
    expect(Object.keys(authority).sort()).toEqual([
      'approvals',
      'core',
      'governance',
      'invitations',
      'operations',
    ]);

    const app = Fastify();
    await registerCompleteAdminRoutes(app, authority);
    await app.ready();
    const routes = app.printRoutes();
    expect(routes).toContain('invitations');
    expect(routes).toContain('governance');
    expect(routes).toContain('operations');
    expect(REAL_STAGING_CAPABILITIES).toEqual(
      expect.arrayContaining([
        'admin-invitation-authority',
        'admin-governance-authority',
        'admin-operations-authority',
        'admin-worker-authority',
      ]),
    );
    await app.close();
  });

  it('runs invitation and operational claims through one bounded worker entrypoint', async () => {
    const invitations = vi.fn(() =>
      Promise.resolve({ claimed: 2, completed: 2, failed: 0, retried: 0 }),
    );
    const operations = { claim: vi.fn(() => Promise.resolve([{ itemId: 'item-one' }])) };
    await expect(
      runAdminControlPlaneWorkersOnce(
        { invitations, operations },
        {
          batchSize: 10,
          leaseUntil: '2030-01-15T12:10:00.000Z',
          now: '2030-01-15T12:05:00.000Z',
          workerId: 'admin-worker-one',
        },
      ),
    ).resolves.toEqual({ invitationJobs: 2, operationalItems: 1 });
    expect(operations.claim).toHaveBeenCalledWith({
      leaseUntil: '2030-01-15T12:10:00.000Z',
      maximumItems: 10,
      workerId: 'admin-worker-one',
    });
  });

  it('persists an operator role transition, audit and outbox in one database transaction', async () => {
    const statements: string[] = [];
    const transaction = {
      query: vi.fn((statement: string) => {
        statements.push(statement);
        return Promise.resolve({ rowCount: 0, rows: [] });
      }),
    };
    const database = {
      query: transaction.query,
      transaction: <T>(operation: (value: typeof transaction) => Promise<T>) =>
        operation(transaction),
    };
    const identity = {
      resolveCredential: vi.fn(() => Promise.resolve(actor('security', 'admin'))),
    };
    const app = Fastify();
    await registerAdminRoutes(
      app,
      createPersistentStagingAdminDependencies({
        adminOrigin,
        clock: { now: () => new Date('2030-01-15T12:05:00.000Z') },
        database,
        identity,
      }),
    );
    await app.ready();
    const response = await app.inject({
      headers: { cookie: cookie(operatorCredential), origin: adminOrigin },
      method: 'POST',
      payload: { reason: 'Activate reviewed security function', role: 'security' },
      url: '/v1/admin/roles/assume',
    });
    expect(response.statusCode).toBe(201);
    expect(statements.join('\n')).toMatch(/INSERT INTO admin_function_sessions/iu);
    expect(statements.join('\n')).toMatch(/INSERT INTO admin_governance_audit/iu);
    expect(statements.join('\n')).toMatch(/INSERT INTO outbox_jobs/iu);
    await app.close();
  });

  it('resolves a persisted operator session and returns only redacted PostgreSQL projections', async () => {
    const { app, database } = await createApp();
    const headers = { cookie: cookie(operatorCredential), origin: adminOrigin };

    const session = await app.inject({ headers, method: 'GET', url: '/v1/admin/session' });
    expect(session.statusCode).toBe(200);
    expect(session.headers['cache-control']).toContain('no-store');
    expect(session.json()).toMatchObject({ role: 'security' });

    const collection = await app.inject({ headers, method: 'GET', url: '/v1/admin/sessions' });
    expect(collection.statusCode).toBe(200);
    expect(collection.headers['cache-control']).toContain('no-store');
    expect(collection.json()).toEqual({
      records: [
        {
          id: '00000000-0000-4000-8000-000000000099',
          summary: 'admin · active · expires 2030-02-15T12:00:00.000Z',
        },
      ],
    });
    expect(collection.body).not.toContain('must-never-leave-postgres');
    expect(collection.body).not.toContain('operator@example.com');
    expect(database.query).toHaveBeenCalledTimes(1);
    await app.close();
  });

  it('projects revenue and support authority without raw subject or provider payload', async () => {
    const database = {
      query: vi.fn((statement: string) =>
        Promise.resolve(
          statement.includes('WHERE id = $1::uuid')
            ? {
                rowCount: 1,
                rows: [
                  {
                    access_reason: 'Review the consented diagnostic package.',
                    expires_at: '2030-01-15T12:15:00.000Z',
                    granted_at: '2030-01-15T12:00:00.000Z',
                    id: '00000000-0000-4000-8000-000000000072',
                    identity_id: '00000000-0000-4000-8000-000000000073',
                    revoked_at: null,
                    version: '3',
                  },
                ],
              }
            : statement.includes('FROM premium_entitlements pe')
              ? {
                  rowCount: 1,
                  rows: [
                    {
                      amount_minor: '9990',
                      currency: 'BRL',
                      id: '00000000-0000-4000-8000-000000000070',
                      invoice_currency: 'BRL',
                      pending_provider_events: true,
                      provider: 'stripe',
                      source: 'subscription',
                      status: 'active',
                      subscription_status: 'active',
                      updated_at: '2030-01-15T12:00:00.000Z',
                      version: '7',
                    },
                  ],
                }
              : {
                  rowCount: 1,
                  rows: [
                    {
                      assigned_role: 'support',
                      consent_expires_at: '2030-01-15T12:15:00.000Z',
                      consent_id: '00000000-0000-4000-8000-000000000072',
                      consent_revoked_at: null,
                      consent_scope: 'case-session',
                      consent_version: '3',
                      created_at: '2030-01-15T11:30:00.000Z',
                      id: '00000000-0000-4000-8000-000000000071',
                      priority: 'urgent',
                      status: 'awaiting-support',
                      subject: 'raw customer subject must never leave postgres',
                      updated_at: '2030-01-15T12:00:00.000Z',
                      version: '5',
                    },
                  ],
                },
        ),
      ),
    };
    const dependencies = createPersistentStagingAdminDependencies({
      adminOrigin,
      clock: { now: () => new Date('2030-01-15T12:05:00.000Z') },
      database,
      identity: { resolveCredential: vi.fn(() => Promise.resolve(null)) },
    });
    await expect(dependencies.listProjection('entitlement')).resolves.toEqual([
      expect.objectContaining({
        amountMinor: '9990',
        providerState: 'unknown',
        reconciliationState: 'pending',
        subscriptionState: 'paid',
        version: '7',
      }),
    ]);
    const support = await dependencies.listProjection('support-case');
    expect(support).toEqual([
      expect.objectContaining({
        ownerReference: 'support',
        state: 'awaiting-support',
        version: '5',
      }),
    ]);
    expect(support[0]?.['consent']).toMatchObject({ state: 'active', version: '3' });
    expect(JSON.stringify(support)).not.toContain('raw customer subject');
    const diagnostic = await dependencies.loadProjection(
      'diagnostic-metadata',
      '00000000-0000-4000-8000-000000000072',
    );
    expect(diagnostic).toMatchObject({
      auditEvents: [],
      consent: {
        aggregateVersion: '3',
        consentId: '00000000-0000-4000-8000-000000000072',
        kind: 'diagnostic-consent',
        provenance: 'postgres-authority',
        state: 'active',
      },
      fields: {},
    });
    expect(controlPlaneDocumentValidator(diagnostic?.['consent'])).toBe(true);
  });

  it('hides collections from tester sessions and every non-admin origin without touching records', async () => {
    const { app, database } = await createApp();
    for (const headers of [
      { cookie: cookie(testerCredential), origin: adminOrigin },
      { cookie: cookie(operatorCredential), origin: 'https://account.staging.example' },
    ]) {
      const session = await app.inject({ headers, method: 'GET', url: '/v1/admin/session' });
      expect([401, 404]).toContain(session.statusCode);
      const collection = await app.inject({ headers, method: 'GET', url: '/v1/admin/sessions' });
      expect(collection.statusCode).toBe(404);
      expect(collection.json()).toEqual({ records: [] });
    }
    expect(database.query).not.toHaveBeenCalled();
    await app.close();
  });

  it('does not let an invited tester acquire an administrative role', async () => {
    const { app } = await createApp();
    const response = await app.inject({
      headers: { cookie: cookie(testerCredential), origin: adminOrigin },
      method: 'POST',
      payload: { reason: 'attempt privilege escalation', role: 'security' },
      url: '/v1/admin/roles/assume',
    });
    expect(response.statusCode).toBe(403);
    await app.close();
  });
});
