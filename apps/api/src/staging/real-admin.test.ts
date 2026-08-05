import type { IdentityActor } from '@liiiraa/control-plane-adapters';
import Fastify from 'fastify';
import { describe, expect, it, vi } from 'vitest';

import { registerAdminRoutes } from '../modules/admin/routes.js';
import { createPersistentStagingAdminDependencies } from './runtime.js';

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
