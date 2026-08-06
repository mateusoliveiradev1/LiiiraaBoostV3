import type {
  CommerceProviderPort,
  CommerceProviderResult,
  ProviderInvoiceReconciliation,
  ProviderReconciliation,
  ProviderSubscriptionReconciliation,
  SubscriptionMutationProvider,
} from '@liiiraa/control-plane-application';
import type Stripe from 'stripe';

import type { ControlPlaneTransaction } from '../postgres/database.ts';

const LOOKUP_CATALOG = Object.freeze({
  'BRL:monthly:2990': 'liiiraa_boost_brl_monthly',
  'BRL:annual:24990': 'liiiraa_boost_brl_annual',
  'USD:monthly:699': 'liiiraa_boost_usd_monthly',
  'USD:annual:5999': 'liiiraa_boost_usd_annual',
} as const);

type CatalogReference = keyof typeof LOOKUP_CATALOG;

interface StripeProviderDatabase extends Pick<ControlPlaneTransaction, 'query'> {}

export interface StripeCommerceProviderInput {
  readonly database: StripeProviderDatabase;
  readonly stripe: Stripe;
}

export interface StripeCommerceProvider extends CommerceProviderPort, SubscriptionMutationProvider {
  createBillingPortal(input: Readonly<{ accountId: string; returnUrl: string }>): Promise<
    CommerceProviderResult<Readonly<{ portalUrl: string }>>
  >;
}

const failure = <T>(
  code: 'PROVIDER_UNAVAILABLE' | 'INVALID_PROVIDER_REFERENCE' | 'INVALID_MUTATION',
  retryable = false,
): CommerceProviderResult<T> => ({ code, ok: false, retryable });

const epoch = (value: unknown): string | undefined =>
  typeof value === 'number' && Number.isFinite(value)
    ? new Date(value * 1_000).toISOString()
    : undefined;

const catalogTerms = (
  lookupKey: unknown,
  unitAmount: unknown,
): Readonly<{ cadence: 'monthly' | 'annual'; currency: 'BRL' | 'USD'; priceMinor: number }> | null => {
  if (typeof lookupKey !== 'string' || typeof unitAmount !== 'number') return null;
  const entry = Object.entries(LOOKUP_CATALOG).find(([, key]) => key === lookupKey);
  if (entry === undefined) return null;
  const [currency, cadence, amount] = entry[0].split(':');
  if (Number(amount) !== unitAmount) return null;
  if ((currency !== 'BRL' && currency !== 'USD') || (cadence !== 'monthly' && cadence !== 'annual')) {
    return null;
  }
  return { cadence, currency, priceMinor: unitAmount };
};

const providerState = (status: string): ProviderSubscriptionReconciliation['state'] => {
  if (status === 'active' || status === 'trialing') return 'active';
  if (status === 'past_due' || status === 'unpaid') return 'past-due';
  if (status === 'canceled') return 'canceled';
  return 'expired';
};

const invoiceState = (status: unknown): ProviderInvoiceReconciliation['state'] => {
  if (
    status === 'draft' ||
    status === 'open' ||
    status === 'paid' ||
    status === 'void' ||
    status === 'uncollectible'
  ) {
    return status;
  }
  return 'open';
};

const stripeId = (value: unknown): string | null => {
  if (typeof value === 'string') return value;
  if (typeof value === 'object' && value !== null && 'id' in value) {
    const id = (value as Readonly<{ id?: unknown }>).id;
    return typeof id === 'string' ? id : null;
  }
  return null;
};

const accountCustomer = async (
  database: StripeProviderDatabase,
  stripe: Stripe,
  accountId: string,
): Promise<string> => {
  const existing = await database.query<{ provider_customer_id: string }>(
    `SELECT provider_customer_id
       FROM stripe_customer_links
      WHERE identity_id = $1`,
    [accountId],
  );
  const current = existing.rows[0]?.provider_customer_id;
  if (current !== undefined) return current;
  const customer = await stripe.customers.create(
    { metadata: { liiiraa_account_id: accountId } },
    { idempotencyKey: `liiiraa-customer:${accountId}` },
  );
  await database.query(
    `INSERT INTO stripe_customer_links (identity_id, provider_customer_id)
     VALUES ($1, $2)
     ON CONFLICT (identity_id) DO UPDATE
       SET provider_customer_id = EXCLUDED.provider_customer_id,
           updated_at = CURRENT_TIMESTAMP`,
    [accountId, customer.id],
  );
  return customer.id;
};

const customerFromReference = async (stripe: Stripe, reference: string): Promise<string | null> => {
  if (reference.startsWith('cus_')) return reference;
  if (reference.startsWith('sub_')) {
    const subscription = await stripe.subscriptions.retrieve(reference);
    return stripeId(subscription.customer);
  }
  if (reference.startsWith('in_')) {
    const invoice = await stripe.invoices.retrieve(reference);
    return stripeId(invoice.customer);
  }
  if (reference.startsWith('cs_')) {
    const checkout = await stripe.checkout.sessions.retrieve(reference);
    return stripeId(checkout.customer);
  }
  return null;
};

const retrieveAuthority = async (
  stripe: Stripe,
  customerId: string,
): Promise<ProviderReconciliation | null> => {
  const [subscriptions, invoices] = await Promise.all([
    stripe.subscriptions.list({ customer: customerId, limit: 10, status: 'all' }),
    stripe.invoices.list({ customer: customerId, limit: 25 }),
  ]);
  const subscription = subscriptions.data[0];
  if (subscription === undefined) return null;
  const raw = subscription as unknown as Record<string, unknown>;
  const items = raw['items'] as { data?: readonly Record<string, unknown>[] } | undefined;
  const price = items?.data?.[0]?.['price'] as Record<string, unknown> | undefined;
  const terms = catalogTerms(price?.['lookup_key'], price?.['unit_amount']);
  const periodStart = epoch(raw['current_period_start']);
  const periodEnd = epoch(raw['current_period_end']);
  if (terms === null || periodStart === undefined || periodEnd === undefined) return null;
  const status = typeof raw['status'] === 'string' ? raw['status'] : 'incomplete';
  const firstInvoice = invoices.data
    .map((invoice) => epoch((invoice as unknown as Record<string, unknown>)['created']))
    .filter((value): value is string => value !== undefined)
    .sort()[0];
  const mappedSubscription: ProviderSubscriptionReconciliation = {
    providerSubscriptionId: subscription.id,
    state: providerState(status),
    plan: 'premium',
    cadence: terms.cadence,
    currency: terms.currency,
    paymentMethod: 'card',
    priceMinor: terms.priceMinor,
    currentPeriodStart: periodStart,
    currentPeriodEnd: periodEnd,
    ...(firstInvoice === undefined ? {} : { firstPaymentAt: firstInvoice }),
    ...(status === 'past_due' ? { paymentFailedAt: new Date().toISOString() } : {}),
    cancelAtPeriodEnd: raw['cancel_at_period_end'] === true,
  };
  const retrievedAt = new Date().toISOString();
  const mappedInvoices = invoices.data.map<ProviderInvoiceReconciliation>((invoice) => {
    const value = invoice as unknown as Record<string, unknown>;
    const transitions = value['status_transitions'] as Record<string, unknown> | undefined;
    const paidAt = epoch(transitions?.['paid_at']);
    return {
      providerInvoiceId: invoice.id,
      state: invoiceState(value['status']),
      currency: typeof value['currency'] === 'string' ? value['currency'].toUpperCase() : 'BRL',
      amountDueMinor: typeof value['amount_due'] === 'number' ? value['amount_due'] : 0,
      amountPaidMinor: typeof value['amount_paid'] === 'number' ? value['amount_paid'] : 0,
      issuedAt: epoch(value['created']) ?? retrievedAt,
      ...(paidAt === undefined ? {} : { paidAt }),
    };
  });
  return {
    providerCustomerId: customerId,
    retrievedAt,
    subscription: mappedSubscription,
    invoices: mappedInvoices,
  };
};

const subscriptionPrice = async (
  stripe: Stripe,
  currency: 'BRL' | 'USD',
  cadence: 'monthly' | 'annual',
): Promise<string | null> => {
  const reference = Object.entries(LOOKUP_CATALOG).find(
    ([key]) => key.startsWith(`${currency}:${cadence}:`),
  );
  if (reference === undefined) return null;
  const result = await stripe.prices.list({
    active: true,
    limit: 1,
    lookup_keys: [reference[1]],
    type: 'recurring',
  });
  return result.data[0]?.id ?? null;
};

export const createStripeCommerceProvider = ({
  database,
  stripe,
}: StripeCommerceProviderInput): StripeCommerceProvider => ({
  async createCheckout(input) {
    const lookupKey = LOOKUP_CATALOG[input.priceReference as CatalogReference];
    if (lookupKey === undefined) return failure('INVALID_PROVIDER_REFERENCE');
    try {
      const prices = await stripe.prices.list({
        active: true,
        limit: 1,
        lookup_keys: [lookupKey],
        type: 'recurring',
      });
      const price = prices.data[0];
      if (price === undefined) return failure('INVALID_PROVIDER_REFERENCE');
      const customer = await accountCustomer(database, stripe, input.accountId);
      const session = await stripe.checkout.sessions.create(
        {
          mode: 'subscription',
          customer,
          client_reference_id: input.accountId,
          line_items: [{ price: price.id, quantity: 1 }],
          metadata: { liiiraa_account_id: input.accountId },
          subscription_data: { metadata: { liiiraa_account_id: input.accountId } },
          success_url: input.successUrl,
          cancel_url: input.cancelUrl,
          allow_promotion_codes: true,
        },
        { idempotencyKey: input.idempotencyKey },
      );
      return session.url === null
        ? failure('PROVIDER_UNAVAILABLE', true)
        : { ok: true, value: { checkoutUrl: session.url } };
    } catch {
      return failure('PROVIDER_UNAVAILABLE', true);
    }
  },

  async retrieveCurrentState({ providerEvent }) {
    const reference = providerEvent.aggregateReference;
    if (reference === undefined) return failure('INVALID_PROVIDER_REFERENCE');
    try {
      const customerId = await customerFromReference(stripe, reference);
      if (customerId === null) return failure('INVALID_PROVIDER_REFERENCE');
      const authority = await retrieveAuthority(stripe, customerId);
      return authority === null
        ? failure('INVALID_PROVIDER_REFERENCE')
        : { ok: true, value: authority };
    } catch {
      return failure('PROVIDER_UNAVAILABLE', true);
    }
  },

  async changeCadence(input) {
    try {
      const subscription = await stripe.subscriptions.retrieve(input.providerSubscriptionId);
      const raw = subscription as unknown as Record<string, unknown>;
      const items = raw['items'] as { data?: readonly Record<string, unknown>[] } | undefined;
      const item = items?.data?.[0];
      const price = item?.['price'] as Record<string, unknown> | undefined;
      const currency =
        typeof price?.['currency'] === 'string' ? price['currency'].toUpperCase() : undefined;
      const itemId = typeof item?.['id'] === 'string' ? item['id'] : undefined;
      if ((currency !== 'BRL' && currency !== 'USD') || itemId === undefined) {
        return failure('INVALID_PROVIDER_REFERENCE');
      }
      const priceId = await subscriptionPrice(stripe, currency, input.targetCadence);
      if (priceId === null) return failure('INVALID_PROVIDER_REFERENCE');
      await stripe.subscriptions.update(
        input.providerSubscriptionId,
        { items: [{ id: itemId, price: priceId }], proration_behavior: 'create_prorations' },
        { idempotencyKey: input.idempotencyKey },
      );
      return { ok: true, value: { accepted: true } };
    } catch {
      return failure('PROVIDER_UNAVAILABLE', true);
    }
  },

  async cancelSubscription(input) {
    try {
      await stripe.subscriptions.update(
        input.providerSubscriptionId,
        { cancel_at_period_end: true },
        { idempotencyKey: input.idempotencyKey },
      );
      return { ok: true, value: { accepted: true } };
    } catch {
      return failure('PROVIDER_UNAVAILABLE', true);
    }
  },

  async undoCancellation(input) {
    try {
      await stripe.subscriptions.update(
        input.providerSubscriptionId,
        { cancel_at_period_end: false },
        { idempotencyKey: input.idempotencyKey },
      );
      return { ok: true, value: { accepted: true } };
    } catch {
      return failure('PROVIDER_UNAVAILABLE', true);
    }
  },

  async requestRefund(input) {
    try {
      const invoices = await stripe.invoices.list({
        limit: 1,
        status: 'paid',
        subscription: input.providerSubscriptionId,
      });
      const invoice = invoices.data[0] as unknown as Record<string, unknown> | undefined;
      const paymentIntent = stripeId(invoice?.['payment_intent']);
      if (paymentIntent === null) return failure('INVALID_MUTATION');
      await stripe.refunds.create(
        { payment_intent: paymentIntent, reason: 'requested_by_customer' },
        { idempotencyKey: input.idempotencyKey },
      );
      return { ok: true, value: { accepted: true } };
    } catch {
      return failure('PROVIDER_UNAVAILABLE', true);
    }
  },

  async createBillingPortal(input) {
    try {
      const customer = await accountCustomer(database, stripe, input.accountId);
      const session = await stripe.billingPortal.sessions.create({
        customer,
        return_url: input.returnUrl,
      });
      return { ok: true, value: { portalUrl: session.url } };
    } catch {
      return failure('PROVIDER_UNAVAILABLE', true);
    }
  },
});

export const STRIPE_LOOKUP_CATALOG = LOOKUP_CATALOG;
