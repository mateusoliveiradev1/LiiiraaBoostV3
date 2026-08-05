import { initialSubscriptionState } from '@liiiraa/control-plane-domain';
import { describe, expect, it } from 'vitest';

import {
  assembleAccountProjection,
  projectAccount,
  type AccountAuthorityRecord,
  type AccountProjectionRepository,
  type AccountProjectionSnapshot,
} from './project-account.js';
import {
  updateAccount,
  type AccountMutationRepository,
  type AccountMutationTransaction,
} from './update-account.js';

const now = '2026-08-05T00:00:00.000Z';

const account = (version = 1n): AccountAuthorityRecord => ({
  accountId: 'account-1',
  version,
  state: 'active',
  displayName: 'Liiiraa',
  email: 'player@example.com',
  locale: 'pt-BR',
  createdAt: now,
  updatedAt: now,
});

const snapshot = (): AccountProjectionSnapshot => ({
  account: account(),
  securityMethods: [
    {
      methodId: 'method-1',
      accountId: 'account-1',
      factor: 'passkey',
      credentialReference: 'must-not-leak',
      verifiedAt: now,
      revokedAt: null,
      version: 1n,
    },
  ],
  sessions: [
    {
      sessionId: 'session-1',
      accountId: 'account-1',
      providerSessionId: 'must-not-leak',
      kind: 'web',
      tokenDigest: 'must-not-leak',
      method: 'passkey',
      state: 'active',
      issuedAt: now,
      expiresAt: '2026-09-05T00:00:00.000Z',
      lastSeenAt: now,
      version: 2n,
    },
  ],
  subscription: {
    ...initialSubscriptionState('account-1'),
    subscriptionId: 'subscription-1',
    version: 3n,
    plan: 'premium',
    status: 'active',
    checkoutStatus: 'reconciled',
    currentPeriodEnd: '2026-09-05T00:00:00.000Z',
    capabilities: { newPremiumActions: true, safetyHistoryRestoration: true },
  },
  invoices: [
    {
      invoiceId: 'invoice-1',
      providerInvoiceId: 'must-not-leak',
      accountId: 'account-1',
      subscriptionId: 'subscription-1',
      state: 'paid',
      currency: 'BRL',
      amountDueMinor: 2_990,
      amountPaidMinor: 2_990,
      issuedAt: now,
      settledAt: now,
      version: 1n,
    },
  ],
  supportCases: [
    {
      caseId: 'case-1',
      accountId: 'account-1',
      version: 1n,
      status: 'open',
      plan: 'premium',
      category: 'general',
      priority: 'normal',
      subjectRedacted: 'Performance question',
      responseTargetBusinessHours: 24,
      expectedResponseAt: '2026-08-06T00:00:00.000Z',
      history: [],
      attachments: [],
      createdAt: now,
      updatedAt: now,
    },
  ],
  activeDevice: {
    bindingId: 'device-1',
    deviceDigest: 'must-not-leak',
    deviceLabel: 'Astra-PC',
    evidence: {
      deviceClass: 'physical',
      keyVersion: 1,
      components: [{ componentClass: 'cpu', protectedDigest: 'must-not-leak' }],
    },
    boundAt: now,
    replacementEligibleAt: '2026-09-04T00:00:00.000Z',
    accountId: 'account-1',
    entitlementId: 'entitlement-1',
    revokedAt: null,
    version: 4n,
  },
});

class MemoryAccountStore implements AccountProjectionRepository, AccountMutationRepository {
  private current: AccountProjectionSnapshot;
  private tail: Promise<void> = Promise.resolve();

  constructor(initial: AccountProjectionSnapshot) {
    this.current = initial;
  }

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
        saveAccount: (next) => {
          this.current = { ...this.current, account: next };
          return Promise.resolve();
        },
      });
    } finally {
      release();
    }
  }
}

const authorizer = {
  authorizeOwner: ({ actorAccountId, accountId }: { actorAccountId: string; accountId: string }) =>
    Promise.resolve(actorAccountId === accountId),
};

const command = (id: string, expectedVersion: string) => ({
  schemaVersion: '1.0' as const,
  kind: 'account-command' as const,
  commandId: id,
  accountId: 'account-1',
  action: 'update-profile' as const,
  expectedVersion,
  correlationId: `correlation-${id}`,
  requestedAt: now,
});

describe('projectAccount', () => {
  it('authorizes the owner before loading and minimizes complete shared truth', async () => {
    let reads = 0;
    const store = new MemoryAccountStore(snapshot());
    const denied = await projectAccount(
      {
        authorizer,
        repository: {
          snapshot: async (...args) => {
            reads += 1;
            return store.snapshot(...args);
          },
        },
      },
      {
        actorAccountId: 'account-other',
        accountId: 'account-1',
        correlationId: 'correlation-denied',
      },
    );
    expect(denied).toEqual({ ok: false, code: 'UNAUTHORIZED' });
    expect(reads).toBe(0);

    const result = await projectAccount(
      { authorizer, repository: store },
      {
        actorAccountId: 'account-1',
        accountId: 'account-1',
        correlationId: 'correlation-read',
      },
    );
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.projection).toMatchObject({
      account: { aggregateVersion: '1', emailRedacted: 'p***@example.com' },
      provenance: 'online',
      securityMethods: [{ methodId: 'method-1', factor: 'passkey' }],
      sessions: [{ sessionId: 'session-1' }],
      subscription: { plan: 'premium', state: 'active' },
      invoices: [{ invoiceId: 'invoice-1', state: 'paid' }],
      supportCases: [{ supportCaseId: 'case-1', state: 'open' }],
      activeDevice: { deviceBindingId: 'device-1', state: 'active' },
    });
    const serialized = JSON.stringify(result.projection);
    for (const forbidden of [
      'credentialReference',
      'providerSessionId',
      'tokenDigest',
      'providerInvoiceId',
      'deviceDigest',
      'components',
      'technicalActivity',
      'diagnostics',
      'history',
      'restoration',
    ]) {
      expect(serialized).not.toContain(forbidden);
    }
  });

  it.each([
    [
      'pending checkout reported as reconciled',
      (value: AccountProjectionSnapshot) => ({
        ...value,
        subscription: {
          ...value.subscription,
          plan: 'free' as const,
          status: 'payment-pending' as const,
          checkoutStatus: 'reconciled' as const,
        },
      }),
    ],
    [
      'active plan without Premium capability',
      (value: AccountProjectionSnapshot) => ({
        ...value,
        subscription: {
          ...value.subscription,
          capabilities: { newPremiumActions: false, safetyHistoryRestoration: true as const },
        },
      }),
    ],
    [
      'active device without authoritative Premium',
      (value: AccountProjectionSnapshot) => ({
        ...value,
        subscription: initialSubscriptionState('account-1'),
      }),
    ],
    [
      'cross-account session',
      (value: AccountProjectionSnapshot) => ({
        ...value,
        sessions: value.sessions.map((session) => ({ ...session, accountId: 'account-other' })),
      }),
    ],
  ])('rejects the contradictory snapshot: %s', (_name, mutate) => {
    expect(() =>
      assembleAccountProjection(mutate(snapshot()), 'correlation-contradiction'),
    ).toThrow(/^ACCOUNT_PROJECTION_CONTRADICTION:/u);
  });
});

describe('updateAccount', () => {
  it('serializes concurrent writes and preserves the rejected draft with remote truth', async () => {
    const store = new MemoryAccountStore(snapshot());
    const dependencies = {
      authorizer,
      repository: store,
      clock: { now: () => new Date('2026-08-05T00:01:00.000Z') },
    };
    const [first, second] = await Promise.all([
      updateAccount(dependencies, {
        actorAccountId: 'account-1',
        command: command('write-a', '1'),
        patch: { displayName: 'First accepted' },
        localDraftToken: 'draft-a',
      }),
      updateAccount(dependencies, {
        actorAccountId: 'account-1',
        command: command('write-b', '1'),
        patch: { displayName: 'Second rejected' },
        localDraftToken: 'draft-b',
      }),
    ]);

    const accepted = [first, second].filter((result) => result.ok);
    const conflicts = [first, second].filter(
      (result): result is Extract<typeof result, { code: 'CONFLICT' }> =>
        !result.ok && result.code === 'CONFLICT',
    );
    expect(accepted).toHaveLength(1);
    expect(conflicts).toHaveLength(1);
    expect(conflicts[0]?.localDraftToken).toBe('draft-b');
    expect(conflicts[0]?.projection).toMatchObject({
      account: { aggregateVersion: '2', displayName: 'First accepted' },
      provenance: 'conflict',
    });
  });
});
