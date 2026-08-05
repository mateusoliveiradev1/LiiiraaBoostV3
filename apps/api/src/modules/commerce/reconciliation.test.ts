import type { ProviderEventJson } from '@liiiraa/contracts-ts';
import {
  reconcileCommerce,
  type CommerceAuthorityRepository,
  type CommerceReconciliationTransaction,
  type CommerceSubscriptionRecord,
} from '@liiiraa/control-plane-application';
import { describe, expect, it } from 'vitest';

import { COMMERCE_WORK_CLAIM_SQL, runCommerceWorkerOnce } from '../../worker.js';

const NOW = '2026-08-05T12:00:00.000Z';
const providerEvent = (id: string): ProviderEventJson => ({
  schemaVersion: '1.0',
  kind: 'provider-event',
  provider: 'commerce',
  providerEventId: id,
  eventType: 'subscription-updated',
  aggregateReference: 'cus_reconciled',
  payloadDigest: 'a'.repeat(64),
  correlationId: `correlation-${id}`,
  receivedAt: NOW,
});

const providerTruth = Object.freeze({
  providerCustomerId: 'cus_reconciled',
  retrievedAt: NOW,
  subscription: Object.freeze({
    providerSubscriptionId: 'sub_reconciled',
    state: 'active' as const,
    plan: 'premium' as const,
    cadence: 'monthly' as const,
    paymentMethod: 'card' as const,
    currency: 'BRL' as const,
    priceMinor: 2_990,
    currentPeriodStart: NOW,
    currentPeriodEnd: '2026-09-05T12:00:00.000Z',
    firstPaymentAt: NOW,
    cancelAtPeriodEnd: false,
  }),
  invoices: Object.freeze([
    Object.freeze({
      providerInvoiceId: 'in_reconciled',
      state: 'paid' as const,
      currency: 'BRL',
      amountDueMinor: 2_990,
      amountPaidMinor: 2_990,
      issuedAt: NOW,
      paidAt: NOW,
    }),
  ]),
});

class MemoryCommerceRepository implements CommerceAuthorityRepository {
  readonly inbox = new Map<string, 'processing' | 'processed' | 'retryable'>();
  readonly subscriptions = new Map<string, CommerceSubscriptionRecord>();
  readonly invoices = new Map<string, unknown>();
  readonly entitlements = new Map<string, unknown>();
  readonly audits: unknown[] = [];
  readonly outbox: unknown[] = [];
  failAt: 'audit' | 'outbox' | null = null;
  private serial = Promise.resolve();

  claimProviderEvent(event: ProviderEventJson) {
    const current = this.inbox.get(event.providerEventId);
    if (current === 'processed' || current === 'processing') {
      return Promise.resolve('duplicate' as const);
    }
    this.inbox.set(event.providerEventId, 'processing');
    return Promise.resolve('claimed' as const);
  }

  markProviderEventRetryable(eventId: string) {
    this.inbox.set(eventId, 'retryable');
    return Promise.resolve();
  }

  async transaction<T>(
    _providerCustomerId: string,
    operation: (transaction: CommerceReconciliationTransaction) => Promise<T>,
  ): Promise<T> {
    let release!: () => void;
    const previous = this.serial;
    this.serial = new Promise<void>((resolve) => {
      release = resolve;
    });
    await previous;
    const staged = {
      subscriptions: new Map(this.subscriptions),
      invoices: new Map(this.invoices),
      entitlements: new Map(this.entitlements),
      audits: [...this.audits],
      outbox: [...this.outbox],
      inbox: new Map(this.inbox),
    };
    const transaction = {
      resolveAccountId: () => Promise.resolve('account-reconciled'),
      lockSubscription: () => Promise.resolve(staged.subscriptions.get('sub_reconciled') ?? null),
      saveSubscription: (record: CommerceSubscriptionRecord) => {
        staged.subscriptions.set(record.providerSubscriptionId, record);
        return Promise.resolve();
      },
      upsertInvoice: (record: { providerInvoiceId: string }) => {
        staged.invoices.set(record.providerInvoiceId, record);
        return Promise.resolve();
      },
      saveEntitlement: (record: { subscriptionId: string }) => {
        staged.entitlements.set(record.subscriptionId, record);
        return Promise.resolve();
      },
      appendAudit: (record: unknown) => {
        if (this.failAt === 'audit') throw new Error('synthetic-audit-failure');
        staged.audits.push(record);
        return Promise.resolve();
      },
      enqueueOutbox: (record: unknown) => {
        if (this.failAt === 'outbox') throw new Error('synthetic-outbox-failure');
        staged.outbox.push(record);
        return Promise.resolve();
      },
      markProviderEventProcessed: (eventId: string) => {
        staged.inbox.set(eventId, 'processed');
        return Promise.resolve();
      },
    } satisfies CommerceReconciliationTransaction;
    try {
      const result = await operation(transaction);
      this.subscriptions.clear();
      staged.subscriptions.forEach((value, key) => this.subscriptions.set(key, value));
      this.invoices.clear();
      staged.invoices.forEach((value, key) => this.invoices.set(key, value));
      this.entitlements.clear();
      staged.entitlements.forEach((value, key) => this.entitlements.set(key, value));
      this.audits.splice(0, this.audits.length, ...staged.audits);
      this.outbox.splice(0, this.outbox.length, ...staged.outbox);
      this.inbox.clear();
      staged.inbox.forEach((value, key) => this.inbox.set(key, value));
      return result;
    } finally {
      release();
    }
  }
}

const dependencies = (repository: MemoryCommerceRepository) => ({
  repository,
  provider: {
    createCheckout: () =>
      Promise.resolve({
        ok: false as const,
        code: 'INVALID_MUTATION' as const,
        retryable: false,
      }),
    retrieveCurrentState: () => Promise.resolve({ ok: true as const, value: providerTruth }),
  },
  clock: { now: () => new Date(NOW) },
  ids: {
    next: (() => {
      let id = 0;
      return () => `commerce-id-${String(++id)}`;
    })(),
  },
});

describe('provider-authoritative commerce reconciliation', () => {
  it('commits subscription, invoice, entitlement, audit, outbox, and processed inbox atomically', async () => {
    const repository = new MemoryCommerceRepository();
    const result = await reconcileCommerce(dependencies(repository), {
      providerEvent: providerEvent('event-atomic'),
    });

    expect(result).toMatchObject({ ok: true, outcome: 'applied' });
    expect(repository.subscriptions.size).toBe(1);
    expect(repository.invoices.size).toBe(1);
    expect(repository.entitlements.size).toBe(1);
    expect(repository.audits).toHaveLength(1);
    expect(repository.outbox).toHaveLength(1);
    expect(repository.inbox.get('event-atomic')).toBe('processed');
  });

  it('rolls back every authority write and leaves the inbox retryable when an atomic write fails', async () => {
    const repository = new MemoryCommerceRepository();
    repository.failAt = 'outbox';
    const result = await reconcileCommerce(dependencies(repository), {
      providerEvent: providerEvent('event-rollback'),
    });

    expect(result).toEqual({ ok: false, code: 'RECONCILIATION_FAILED', retryable: true });
    expect(repository.subscriptions.size).toBe(0);
    expect(repository.invoices.size).toBe(0);
    expect(repository.entitlements.size).toBe(0);
    expect(repository.audits).toHaveLength(0);
    expect(repository.outbox).toHaveLength(0);
    expect(repository.inbox.get('event-rollback')).toBe('retryable');
  });

  it('converges duplicate, replayed, reordered, and concurrent jobs to one authority result', async () => {
    const repository = new MemoryCommerceRepository();
    const eventIds = [
      'event-paid',
      'event-subscription',
      'event-checkout',
      'event-paid',
      'event-subscription',
    ];
    const results = await Promise.all(
      eventIds.map((eventId) =>
        reconcileCommerce(dependencies(repository), { providerEvent: providerEvent(eventId) }),
      ),
    );

    expect(results.every((result) => result.ok)).toBe(true);
    expect(repository.subscriptions.size).toBe(1);
    expect(repository.invoices.size).toBe(1);
    expect(repository.entitlements.size).toBe(1);
    expect(repository.audits).toHaveLength(1);
    expect(repository.outbox).toHaveLength(1);
  });

  it('never grants Premium when provider retrieval fails', async () => {
    const repository = new MemoryCommerceRepository();
    const result = await reconcileCommerce(
      {
        ...dependencies(repository),
        provider: {
          createCheckout: () =>
            Promise.resolve({
              ok: false as const,
              code: 'INVALID_MUTATION' as const,
              retryable: false,
            }),
          retrieveCurrentState: () =>
            Promise.resolve({
              ok: false as const,
              code: 'PROVIDER_UNAVAILABLE' as const,
              retryable: true,
            }),
        },
      },
      { providerEvent: providerEvent('event-unavailable') },
    );
    expect(result).toEqual({ ok: false, code: 'PROVIDER_UNAVAILABLE', retryable: true });
    expect(repository.entitlements.size).toBe(0);
    expect(repository.inbox.get('event-unavailable')).toBe('retryable');
  });

  it('reconciles grace, paid-period cancellation, refund, and dispute from fresh provider truth', async () => {
    const paidInvoice = providerTruth.invoices[0];
    if (paidInvoice === undefined) throw new Error('synthetic-paid-invoice-required');
    const cases = [
      {
        id: 'grace',
        truth: {
          ...providerTruth,
          subscription: {
            ...providerTruth.subscription,
            state: 'past-due' as const,
            paymentFailedAt: NOW,
          },
        },
        expected: { status: 'grace', allowNewPremiumActions: true },
      },
      {
        id: 'cancel-paid-period',
        truth: {
          ...providerTruth,
          subscription: {
            ...providerTruth.subscription,
            state: 'canceled' as const,
            cancelAtPeriodEnd: true,
          },
        },
        expected: { status: 'active', allowNewPremiumActions: true },
      },
      {
        id: 'refund',
        truth: {
          ...providerTruth,
          invoices: [{ ...paidInvoice, refundedAt: NOW }],
        },
        expected: { status: 'expired', allowNewPremiumActions: false },
      },
      {
        id: 'dispute',
        truth: {
          ...providerTruth,
          invoices: [{ ...paidInvoice, disputeOpenedAt: NOW }],
        },
        expected: { status: 'disputed', allowNewPremiumActions: false },
      },
    ] as const;

    for (const lifecycleCase of cases) {
      const repository = new MemoryCommerceRepository();
      const result = await reconcileCommerce(
        {
          ...dependencies(repository),
          provider: {
            createCheckout: () =>
              Promise.resolve({
                ok: false as const,
                code: 'INVALID_MUTATION' as const,
                retryable: false,
              }),
            retrieveCurrentState: () =>
              Promise.resolve({
                ok: true as const,
                value: lifecycleCase.truth,
              }),
          },
        },
        { providerEvent: providerEvent(`event-${lifecycleCase.id}`) },
      );
      expect(result).toMatchObject({ ok: true, outcome: 'applied' });
      const subscription = repository.subscriptions.get('sub_reconciled');
      expect(subscription).toMatchObject({ status: lifecycleCase.expected.status });
      expect(subscription?.capabilities).toEqual({
        newPremiumActions: lifecycleCase.expected.allowNewPremiumActions,
        safetyHistoryRestoration: true,
      });
      expect(repository.inbox.get(`event-${lifecycleCase.id}`)).toBe('processed');
    }
  });
});

describe('bounded commerce worker claiming', () => {
  it('uses SKIP LOCKED, bounded batches, and bounded retry attempts', async () => {
    expect(COMMERCE_WORK_CLAIM_SQL).toMatch(/FOR UPDATE SKIP LOCKED/iu);
    const claimedLimits: number[] = [];
    const completed: string[] = [];
    const retried: { id: string; delayMs: number }[] = [];
    await runCommerceWorkerOnce(
      {
        claim: ({ limit }) => {
          claimedLimits.push(limit);
          return Promise.resolve([
            {
              id: 'job-success',
              attemptCount: 0,
              providerEvent: providerEvent('worker-success'),
            },
            {
              id: 'job-retry',
              attemptCount: 2,
              providerEvent: providerEvent('worker-retry'),
            },
            {
              id: 'job-dead',
              attemptCount: 4,
              providerEvent: providerEvent('worker-dead'),
            },
          ]);
        },
        complete: (id) => Promise.resolve(void completed.push(id)),
        retry: (id, delayMs) => Promise.resolve(void retried.push({ id, delayMs })),
        fail: (id) => Promise.resolve(void completed.push(`failed:${id}`)),
      },
      (event) =>
        Promise.resolve(
          event.providerEventId !== 'worker-retry' && event.providerEventId !== 'worker-dead',
        ),
      { workerId: 'commerce-worker-1', batchSize: 10, maxAttempts: 5 },
    );

    expect(claimedLimits).toEqual([10]);
    expect(completed).toEqual(['job-success', 'failed:job-dead']);
    expect(retried).toEqual([{ id: 'job-retry', delayMs: 4_000 }]);
  });
});
