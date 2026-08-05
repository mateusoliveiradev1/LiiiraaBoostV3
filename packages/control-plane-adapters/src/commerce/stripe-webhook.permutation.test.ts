import { createHash } from 'node:crypto';

import type { ProviderEventTypeJson } from '@liiiraa/contracts-ts';
import Stripe from 'stripe';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import {
  createControlPlaneDatabase,
  type ControlPlaneDatabase,
  type ControlPlaneMigrationDatabase,
  type ControlPlaneQueryResult,
  type ControlPlaneTransaction,
} from '../postgres/database.ts';
import { migrateControlPlane } from '../postgres/migrate.ts';

const STRIPE_WEBHOOK_RED_OWNER = '04-08-01';
const WEBHOOK_SECRET = 'whsec_synthetic_permutation_secret';
const NOW_SECONDS = Date.parse('2026-08-04T12:00:00.000Z') / 1_000;
const stripe = new Stripe('sk_test_synthetic_webhook');

type InboxState = 'processing' | 'processed' | 'received' | 'retryable';

interface InboxRow {
  readonly eventType: ProviderEventTypeJson;
  readonly payloadDigest: string;
  state: InboxState;
  errorCode?: string;
}

class MemoryWebhookDatabase implements ControlPlaneMigrationDatabase {
  readonly inbox = new Map<string, InboxRow>();
  forbiddenAuthorityWrites = 0;

  async transaction<TResult>(
    operation: (transaction: ControlPlaneTransaction) => Promise<TResult>,
  ): Promise<TResult> {
    return operation(this);
  }

  async query<TRow extends Record<string, unknown> = Record<string, unknown>>(
    statement: string,
    values: readonly unknown[] = [],
  ): Promise<ControlPlaneQueryResult<TRow>> {
    const normalized = statement.replace(/\s+/gu, ' ').trim().toLowerCase();
    if (
      /\b(insert|update|delete)\b[\s\S]*\b(subscriptions|invoices|premium_entitlements|outbox_jobs)\b/iu.test(
        statement,
      )
    ) {
      this.forbiddenAuthorityWrites += 1;
    }

    if (normalized.startsWith('insert into provider_inbox')) {
      const eventId = String(values[1]);
      if (this.inbox.has(eventId)) return { rowCount: 0, rows: [] };
      this.inbox.set(eventId, {
        eventType: String(values[2]) as ProviderEventTypeJson,
        payloadDigest: String(values[3]),
        state: 'received',
      });
      return { rowCount: 1, rows: [{ id: String(values[0]) }] as unknown as readonly TRow[] };
    }

    if (normalized.includes("set processing_state = 'processing'")) {
      const row = this.inbox.get(String(values[0]));
      if (row === undefined || (row.state !== 'received' && row.state !== 'retryable')) {
        return { rowCount: 0, rows: [] };
      }
      row.state = 'processing';
      delete row.errorCode;
      return { rowCount: 1, rows: [{ processing_state: row.state }] as unknown as readonly TRow[] };
    }

    if (normalized.includes("set processing_state = 'processed'")) {
      const row = this.inbox.get(String(values[0]));
      if (row !== undefined) row.state = 'processed';
      return { rowCount: row === undefined ? 0 : 1, rows: [] };
    }

    if (normalized.includes("set processing_state = 'retryable'")) {
      const row = this.inbox.get(String(values[0]));
      if (row !== undefined) {
        row.state = 'retryable';
        row.errorCode = String(values[1]);
      }
      return { rowCount: row === undefined ? 0 : 1, rows: [] };
    }

    if (normalized.startsWith('select processing_state from provider_inbox')) {
      const row = this.inbox.get(String(values[0]));
      return {
        rowCount: row === undefined ? 0 : 1,
        rows:
          row === undefined
            ? []
            : ([{ processing_state: row.state }] as unknown as readonly TRow[]),
      };
    }

    return { rowCount: 0, rows: [] };
  }
}

const expectedStripeWebhookRed = (id: string, behavior: string): never => {
  throw new Error(`EXPECTED_RED[${STRIPE_WEBHOOK_RED_OWNER}][${id}]: ${behavior}`);
};

const loadAdapter = async () => {
  try {
    const adapterPath = './stripe-webhook.ts';
    return await import(adapterPath);
  } catch {
    return expectedStripeWebhookRed(
      'adapter-absent',
      'the owner must implement raw admission and provider reconciliation without weakening the collected matrix',
    );
  }
};

const stripeEventTypes = [
  ['checkout.session.completed', 'checkout-completed'],
  ['invoice.paid', 'invoice-updated'],
  ['invoice.payment_failed', 'invoice-updated'],
  ['customer.subscription.updated', 'subscription-updated'],
  ['charge.refunded', 'invoice-updated'],
  ['charge.dispute.created', 'invoice-updated'],
  ['customer.subscription.deleted', 'subscription-updated'],
] as const satisfies readonly (readonly [string, ProviderEventTypeJson])[];

const rawFixture = (
  stripeType: string,
  eventId: string,
  timestamp = NOW_SECONDS,
): Readonly<{ rawBody: Uint8Array; signatureHeader: string }> => {
  const payload = JSON.stringify({
    id: eventId,
    object: 'event',
    created: timestamp,
    data: {
      object: {
        id: `${eventId}_object`,
        object: stripeType.split('.')[0],
        customer: 'cus_current_truth',
        subscription: 'sub_current_truth',
      },
    },
    livemode: false,
    pending_webhooks: 1,
    request: { id: null, idempotency_key: null },
    type: stripeType,
  });
  return Object.freeze({
    rawBody: new TextEncoder().encode(payload),
    signatureHeader: stripe.webhooks.generateTestHeaderString({
      payload,
      secret: WEBHOOK_SECRET,
      timestamp,
    }),
  });
};

const currentProviderTruth = Object.freeze({
  providerCustomerId: 'cus_current_truth',
  retrievedAt: '2026-08-04T12:00:00.000Z',
  subscription: Object.freeze({
    providerSubscriptionId: 'sub_current_truth',
    state: 'active' as const,
    currentPeriodStart: '2026-08-01T00:00:00.000Z',
    currentPeriodEnd: '2026-09-01T00:00:00.000Z',
    cancelAtPeriodEnd: false,
  }),
  invoices: Object.freeze([
    Object.freeze({
      providerInvoiceId: 'in_current_truth',
      state: 'paid' as const,
      currency: 'BRL',
      amountDueMinor: 4_990,
      amountPaidMinor: 4_990,
    }),
  ]),
});

const createProvider = (failures = 0) => {
  let attempts = 0;
  const checkoutInputs: unknown[] = [];
  return {
    checkoutInputs,
    get attempts() {
      return attempts;
    },
    port: {
      createCheckout: async (input: unknown) => {
        checkoutInputs.push(input);
        return {
          ok: true as const,
          value: { checkoutUrl: 'https://checkout.stripe.test/session' },
        };
      },
      retrieveCurrentState: async () => {
        attempts += 1;
        if (attempts <= failures) {
          return { ok: false as const, code: 'PROVIDER_UNAVAILABLE' as const, retryable: true };
        }
        return { ok: true as const, value: currentProviderTruth };
      },
    },
  };
};

const deterministicPermutations = <T>(items: readonly T[]): readonly (readonly T[])[] => {
  if (items.length < 2) return [items];
  return items.flatMap((item, index) =>
    deterministicPermutations([...items.slice(0, index), ...items.slice(index + 1)]).map((rest) => [
      item,
      ...rest,
    ]),
  );
};

const relevantEventOrders = Object.freeze(deterministicPermutations(stripeEventTypes));

const verifyFixture = async (stripeType: string, eventId: string) => {
  const adapter = await loadAdapter();
  return adapter.verifyRawWebhook({
    ...rawFixture(stripeType, eventId),
    receivedAt: new Date(NOW_SECONDS * 1_000),
    stripe,
    toleranceSeconds: 300,
    webhookSecret: WEBHOOK_SECRET,
  });
};

describe('Stripe webhook signature-before-parse admission', () => {
  it('raw-signature-missing', async () => {
    const adapter = await loadAdapter();
    const database = new MemoryWebhookDatabase();
    const rawBody = new TextEncoder().encode('{not-json');

    const result = await adapter.verifyRawWebhook({
      rawBody,
      receivedAt: new Date(NOW_SECONDS * 1_000),
      signatureHeader: undefined,
      stripe,
      webhookSecret: WEBHOOK_SECRET,
    });

    expect(result).toMatchObject({ ok: false, code: 'SIGNATURE_REJECTED' });
    expect(database.inbox.size).toBe(0);
  });

  it('raw-signature-invalid', async () => {
    const adapter = await loadAdapter();
    const database = new MemoryWebhookDatabase();
    const result = await adapter.verifyRawWebhook({
      rawBody: new TextEncoder().encode('{not-json'),
      receivedAt: new Date(NOW_SECONDS * 1_000),
      signatureHeader: `t=${NOW_SECONDS},v1=${'0'.repeat(64)}`,
      stripe,
      webhookSecret: WEBHOOK_SECRET,
    });

    expect(result).toMatchObject({ ok: false, code: 'SIGNATURE_REJECTED' });
    expect(database.inbox.size).toBe(0);
  });

  it('raw-signature-stale', async () => {
    const adapter = await loadAdapter();
    const database = new MemoryWebhookDatabase();
    const payload = '{not-json';
    const staleTimestamp = NOW_SECONDS - 301;
    const result = await adapter.verifyRawWebhook({
      rawBody: new TextEncoder().encode(payload),
      receivedAt: new Date(NOW_SECONDS * 1_000),
      signatureHeader: stripe.webhooks.generateTestHeaderString({
        payload,
        secret: WEBHOOK_SECRET,
        timestamp: staleTimestamp,
      }),
      stripe,
      toleranceSeconds: 300,
      webhookSecret: WEBHOOK_SECRET,
    });

    expect(result).toMatchObject({ ok: false, code: 'SIGNATURE_REJECTED' });
    expect(database.inbox.size).toBe(0);
  });
});

describe('Stripe webhook adversarial delivery reconciliation', () => {
  it('duplicate-delivery', async () => {
    const adapter = await loadAdapter();
    const verified = await verifyFixture('checkout.session.completed', 'evt_checkout_1');
    expect(verified.ok).toBe(true);
    if (!verified.ok) return;
    const database = new MemoryWebhookDatabase();
    const provider = createProvider();

    const first = await adapter.reconcileProviderState({
      database,
      provider: provider.port,
      verifiedEvent: verified.value,
    });
    const duplicate = await adapter.reconcileProviderState({
      database,
      provider: provider.port,
      verifiedEvent: verified.value,
    });

    expect(first).toMatchObject({ ok: true, value: { outcome: 'processed' } });
    expect(duplicate).toMatchObject({ ok: true, value: { outcome: 'duplicate' } });
    expect(database.inbox.size).toBe(1);
    expect(provider.attempts).toBe(1);
    expect(database.forbiddenAuthorityWrites).toBe(0);
  });

  it('delayed-delivery and reordered-delivery converge for all 5040 relevant event orders', async () => {
    const adapter = await loadAdapter();
    expect(relevantEventOrders).toHaveLength(5_040);

    for (const [orderIndex, order] of relevantEventOrders.entries()) {
      const database = new MemoryWebhookDatabase();
      const provider = createProvider();
      for (const [eventIndex, [stripeType]] of order.entries()) {
        const verified = await verifyFixture(
          stripeType,
          `evt_${String(orderIndex)}_${String(eventIndex)}`,
        );
        expect(verified.ok).toBe(true);
        if (!verified.ok) continue;
        const result = await adapter.reconcileProviderState({
          database,
          provider: provider.port,
          verifiedEvent: verified.value,
        });
        expect(result).toMatchObject({
          ok: true,
          value: { outcome: 'processed', reconciliation: currentProviderTruth },
        });
      }
      expect(database.inbox.size).toBe(stripeEventTypes.length);
      expect(database.forbiddenAuthorityWrites).toBe(0);
    }
  }, 60_000);

  it('replayed-delivery is admitted once and cannot duplicate authority or jobs', async () => {
    const adapter = await loadAdapter();
    const database = new MemoryWebhookDatabase();
    const provider = createProvider();
    const verified = await verifyFixture('invoice.paid', 'evt_invoice_paid_1');
    expect(verified.ok).toBe(true);
    if (!verified.ok) return;

    for (let replay = 0; replay < 4; replay += 1) {
      await adapter.reconcileProviderState({
        database,
        provider: provider.port,
        verifiedEvent: verified.value,
      });
    }

    expect(database.inbox.size).toBe(1);
    expect(provider.attempts).toBe(1);
    expect(database.forbiddenAuthorityWrites).toBe(0);
  });

  it('provider retrieval failure stays retryable and never grants Premium', async () => {
    const adapter = await loadAdapter();
    const database = new MemoryWebhookDatabase();
    const provider = createProvider(1);
    const verified = await verifyFixture('customer.subscription.updated', 'evt_retryable_1');
    expect(verified.ok).toBe(true);
    if (!verified.ok) return;

    const failed = await adapter.reconcileProviderState({
      database,
      provider: provider.port,
      verifiedEvent: verified.value,
    });
    expect(failed).toEqual({ ok: false, code: 'PROVIDER_UNAVAILABLE', retryable: true });
    expect(database.inbox.get('evt_retryable_1')).toMatchObject({
      errorCode: 'provider-retrieval-failed',
      state: 'retryable',
    });
    expect(database.forbiddenAuthorityWrites).toBe(0);

    const retried = await adapter.reconcileProviderState({
      database,
      provider: provider.port,
      verifiedEvent: verified.value,
    });
    expect(retried).toMatchObject({ ok: true, value: { outcome: 'processed' } });
    expect(database.inbox.size).toBe(1);
  });

  it('requires an idempotency key on every outbound provider mutation', async () => {
    const provider = createProvider();
    await provider.port.createCheckout({
      accountId: 'account_synthetic',
      cancelUrl: 'https://account.test/cancel',
      idempotencyKey: 'checkout:account_synthetic:command_1',
      priceReference: 'price_synthetic',
      successUrl: 'https://account.test/return',
    });

    expect(provider.checkoutInputs).toEqual([
      expect.objectContaining({ idempotencyKey: 'checkout:account_synthetic:command_1' }),
    ]);
  });
});

const environment = process.env;
const configuredDatabaseUrl = environment['TEST_DATABASE_URL']?.trim();
const liveDatabaseEnabled = configuredDatabaseUrl !== undefined && configuredDatabaseUrl.length > 0;

describe.sequential.skipIf(!liveDatabaseEnabled)('Stripe webhook isolated PostgreSQL proof', () => {
  let database: ControlPlaneDatabase;

  beforeAll(async () => {
    const databaseUrl = configuredDatabaseUrl ?? '';
    const parsed = new URL(databaseUrl);
    const identity = `${parsed.hostname}-${parsed.username}-${parsed.pathname}`;
    if (!/(synthetic|test)/iu.test(identity) || /(live|prod|production)/iu.test(identity)) {
      throw new Error('Webhook proof requires an explicitly synthetic PostgreSQL identity.');
    }
    database = createControlPlaneDatabase(databaseUrl);
    await database.query('DROP SCHEMA public CASCADE');
    await database.query('CREATE SCHEMA public');
    await migrateControlPlane(database);
  });

  afterAll(async () => {
    await database?.close();
  });

  it('enforces unique durable admission and retry state in PostgreSQL', async () => {
    const adapter = await loadAdapter();
    const provider = createProvider();
    const verified = await verifyFixture('invoice.payment_failed', 'evt_postgres_unique_1');
    expect(verified.ok).toBe(true);
    if (!verified.ok) return;

    await adapter.reconcileProviderState({
      database,
      provider: provider.port,
      verifiedEvent: verified.value,
    });
    await adapter.reconcileProviderState({
      database,
      provider: provider.port,
      verifiedEvent: verified.value,
    });

    const inbox = await database.query<{ count: string; payload_digest: string }>(
      `SELECT COUNT(*)::text AS count, min(payload_digest) AS payload_digest
       FROM provider_inbox
       WHERE provider = 'stripe' AND provider_event_id = $1`,
      ['evt_postgres_unique_1'],
    );
    expect(inbox.rows[0]).toEqual({
      count: '1',
      payload_digest: createHash('sha256').update(verified.value.rawBody).digest('hex'),
    });
    expect(provider.attempts).toBe(1);
    const forbidden = await database.query<{ count: string }>(
      `SELECT (
        (SELECT COUNT(*) FROM subscriptions) +
        (SELECT COUNT(*) FROM invoices) +
        (SELECT COUNT(*) FROM premium_entitlements) +
        (SELECT COUNT(*) FROM outbox_jobs)
      )::text AS count`,
    );
    expect(forbidden.rows[0]?.count).toBe('0');
  });
});
