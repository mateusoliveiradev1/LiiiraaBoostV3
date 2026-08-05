import type {
  AccountMutationRepository,
  AccountMutationTransaction,
  AccountProjectionRepository,
  AccountProjectionSnapshot,
} from '@liiiraa/control-plane-application';
import Fastify from 'fastify';
import { describe, expect, it } from 'vitest';

import { registerAccountRoutes } from './routes.js';

const now = '2026-08-05T00:00:00.000Z';

const initialSnapshot = (): AccountProjectionSnapshot => ({
  account: {
    accountId: 'account-1',
    version: 7n,
    state: 'active',
    displayName: 'Original',
    email: 'owner@example.com',
    locale: 'en',
    createdAt: now,
    updatedAt: now,
  },
  securityMethods: [],
  sessions: [],
  subscription: {
    accountId: 'account-1',
    version: 0n,
    plan: 'free',
    status: 'free',
    cancelAtPeriodEnd: false,
    checkoutStatus: 'none',
    capabilities: { newPremiumActions: false, safetyHistoryRestoration: true },
  },
  invoices: [],
  supportCases: [],
  activeDevice: null,
});

class RouteAccountStore implements AccountProjectionRepository, AccountMutationRepository {
  private current = initialSnapshot();
  private tail: Promise<void> = Promise.resolve();

  snapshot<T>(
    _accountId: string,
    operation: (reader: AccountMutationTransaction) => Promise<T>,
  ): Promise<T> {
    return operation({
      loadSnapshot: () => Promise.resolve(this.current),
      saveAccount: () => Promise.reject(new Error('read-only snapshot')),
    });
  }

  async transaction<T>(
    _accountId: string,
    operation: (transaction: AccountMutationTransaction) => Promise<T>,
  ): Promise<T> {
    const previous = this.tail;
    let release = (): void => undefined;
    this.tail = new Promise<void>((resolve) => {
      release = resolve;
    });
    await previous;
    try {
      return await operation({
        loadSnapshot: () => Promise.resolve(this.current),
        saveAccount: (account) => {
          this.current = { ...this.current, account };
          return Promise.resolve();
        },
      });
    } finally {
      release();
    }
  }
}

const command = (commandId: string, expectedVersion: string) => ({
  schemaVersion: '1.0' as const,
  kind: 'account-command' as const,
  commandId,
  accountId: 'account-1',
  action: 'update-profile' as const,
  expectedVersion,
  correlationId: `correlation-${commandId}`,
  requestedAt: now,
});

const createApp = async () => {
  const app = Fastify();
  const store = new RouteAccountStore();
  const authorizer = { authorizeOwner: () => Promise.resolve(true) };
  await registerAccountRoutes(app, {
    projection: { authorizer, repository: store },
    mutation: {
      authorizer,
      repository: store,
      clock: { now: () => new Date('2026-08-05T00:01:00.000Z') },
    },
    resolveSessionActor: () => Promise.resolve({ accountId: 'account-1' }),
  });
  await app.ready();
  return app;
};

describe('account-projection API authority', () => {
  it('WEB-04 rejects a stale expected version without projecting the rejected mutation', async () => {
    const app = await createApp();
    const original = await app.inject({ method: 'GET', url: '/v1/account' });
    expect(original.statusCode).toBe(200);
    expect(original.headers.etag).toBe('"account-account-1-v7"');
    const accepted = await app.inject({
      method: 'PATCH',
      url: '/v1/account',
      headers: { 'if-match': original.headers.etag },
      payload: {
        command: command('accepted', '7'),
        patch: { displayName: 'Authoritative' },
        localDraftToken: 'draft-accepted',
      },
    });
    expect(accepted.statusCode).toBe(200);

    const stale = await app.inject({
      method: 'PATCH',
      url: '/v1/account',
      headers: { 'if-match': original.headers.etag },
      payload: {
        command: command('stale', '7'),
        patch: { displayName: 'Rejected draft' },
        localDraftToken: 'draft-stale-opaque',
      },
    });
    expect(stale.statusCode).toBe(409);
    expect(stale.json()).toMatchObject({
      code: 'CONFLICT',
      localDraftToken: 'draft-stale-opaque',
      projection: {
        account: { aggregateVersion: '8', displayName: 'Authoritative' },
        provenance: 'conflict',
      },
    });
    expect(stale.body).not.toContain('Rejected draft');
    await app.close();
  });

  it('WEB-04 returns one truthful account projection version across web and desktop reads', async () => {
    const app = await createApp();
    const accepted = await app.inject({
      method: 'PATCH',
      url: '/v1/account',
      headers: { 'if-match': '7', 'x-client-surface': 'web' },
      payload: {
        command: command('shared', '7'),
        patch: { locale: 'pt-BR' },
        localDraftToken: 'draft-shared',
      },
    });
    expect(accepted.statusCode).toBe(200);

    const [web, desktop] = await Promise.all([
      app.inject({ method: 'GET', url: '/v1/account', headers: { 'x-client-surface': 'web' } }),
      app.inject({ method: 'GET', url: '/v1/account', headers: { 'x-client-surface': 'desktop' } }),
    ]);
    expect(web.statusCode).toBe(200);
    expect(desktop.statusCode).toBe(200);
    expect(web.body).toBe(desktop.body);
    expect(web.body).toContain('"aggregateVersion":"8"');
    expect(web.body).toContain('"locale":"pt-BR"');
    expect(web.body).toContain('"provenance":"online"');
    expect(web.headers.etag).toBe('"account-account-1-v8"');
    await app.close();
  });
});
