import type Stripe from 'stripe';
import { describe, expect, it, vi } from 'vitest';

import { createStripeCommerceProvider } from './stripe-provider.js';

const accountId = '00000000-0000-4000-8000-000000000001';

describe('real Stripe commerce provider', () => {
  it('creates an account-bound subscription Checkout from the managed lookup key', async () => {
    const listPrices = vi.fn(() =>
      Promise.resolve({ data: [{ id: 'price_brl_monthly', active: true }] }),
    );
    const createCustomer = vi.fn(() => Promise.resolve({ id: 'cus_liiiraa' }));
    const createCheckout = vi.fn(() =>
      Promise.resolve({ id: 'cs_test_liiiraa', url: 'https://checkout.stripe.com/c/pay/test' }),
    );
    const database = {
      query: vi
        .fn()
        .mockResolvedValueOnce({ rowCount: 0, rows: [] })
        .mockResolvedValueOnce({ rowCount: 1, rows: [] }),
    };
    const provider = createStripeCommerceProvider({
      checkoutBranding: {
        iconUrl: 'https://account.example/icon.svg',
      },
      database,
      stripe: {
        billingPortal: {
          configurations: { list: vi.fn() },
          sessions: { create: vi.fn() },
        },
        checkout: { sessions: { create: createCheckout, retrieve: vi.fn() } },
        customers: { create: createCustomer },
        invoices: { list: vi.fn(), retrieve: vi.fn() },
        prices: { list: listPrices },
        refunds: { create: vi.fn() },
        subscriptions: { list: vi.fn(), retrieve: vi.fn(), update: vi.fn() },
      } as unknown as Stripe,
    });

    await expect(
      provider.createCheckout({
        accountId,
        priceReference: 'BRL:monthly:2990',
        successUrl: 'https://account.example/pt-BR/account/subscription?checkout=success',
        cancelUrl: 'https://account.example/pt-BR/account/subscription?checkout=cancel',
        idempotencyKey: 'command-checkout-1',
      }),
    ).resolves.toEqual({
      ok: true,
      value: { checkoutUrl: 'https://checkout.stripe.com/c/pay/test' },
    });
    expect(listPrices).toHaveBeenCalledWith({
      active: true,
      limit: 1,
      lookup_keys: ['liiiraa_boost_brl_monthly'],
      type: 'recurring',
    });
    expect(createCustomer).toHaveBeenCalledWith(
      { metadata: { liiiraa_account_id: accountId } },
      { idempotencyKey: `liiiraa-customer:${accountId}` },
    );
    expect(createCheckout).toHaveBeenCalledWith(
      expect.objectContaining({
        client_reference_id: accountId,
        customer: 'cus_liiiraa',
        line_items: [{ price: 'price_brl_monthly', quantity: 1 }],
        metadata: { liiiraa_account_id: accountId },
        mode: 'subscription',
        branding_settings: {
          background_color: '#090a0d',
          border_style: 'rounded',
          button_color: '#315efb',
          display_name: 'Liiiraa Boost',
          font_family: 'inter',
          icon: { type: 'url', url: 'https://account.example/icon.svg' },
        },
        subscription_data: { metadata: { liiiraa_account_id: accountId } },
      }),
      { idempotencyKey: 'command-checkout-1' },
    );
  });

  it('opens the managed Liiiraa Boost portal configuration only', async () => {
    const createPortal = vi.fn(() =>
      Promise.resolve({ id: 'bps_liiiraa', url: 'https://billing.stripe.com/p/session/test' }),
    );
    const provider = createStripeCommerceProvider({
      checkoutBranding: { iconUrl: 'https://account.example/icon.svg' },
      database: {
        query: vi.fn(() => Promise.resolve({ rows: [{ provider_customer_id: 'cus_liiiraa' }] })),
      },
      stripe: {
        billingPortal: {
          configurations: {
            list: vi.fn(() =>
              Promise.resolve({
                data: [
                  { id: 'bpc_other', name: 'Other portal' },
                  { id: 'bpc_liiiraa', name: 'Liiiraa Boost staging managed' },
                ],
              }),
            ),
          },
          sessions: { create: createPortal },
        },
      } as unknown as Stripe,
    });

    await expect(
      provider.createBillingPortal({
        accountId,
        returnUrl: 'https://account.example/pt-BR/account/subscription',
      }),
    ).resolves.toEqual({
      ok: true,
      value: { portalUrl: 'https://billing.stripe.com/p/session/test' },
    });
    expect(createPortal).toHaveBeenCalledWith({
      configuration: 'bpc_liiiraa',
      customer: 'cus_liiiraa',
      return_url: 'https://account.example/pt-BR/account/subscription',
    });
  });

  it('rejects an unknown or price-mismatched catalog reference before contacting Stripe', async () => {
    const listPrices = vi.fn();
    const provider = createStripeCommerceProvider({
      checkoutBranding: { iconUrl: 'https://account.example/icon.svg' },
      database: { query: vi.fn() },
      stripe: { prices: { list: listPrices } } as unknown as Stripe,
    });
    await expect(
      provider.createCheckout({
        accountId,
        priceReference: 'BRL:monthly:1990',
        successUrl: 'https://account.example/success',
        cancelUrl: 'https://account.example/cancel',
        idempotencyKey: 'command-invalid-price',
      }),
    ).resolves.toMatchObject({ ok: false, code: 'INVALID_PROVIDER_REFERENCE' });
    expect(listPrices).not.toHaveBeenCalled();
  });

  it('retrieves provider authority from a webhook customer and maps subscription terms', async () => {
    const provider = createStripeCommerceProvider({
      checkoutBranding: { iconUrl: 'https://account.example/icon.svg' },
      database: { query: vi.fn() },
      stripe: {
        invoices: {
          list: vi.fn(() =>
            Promise.resolve({
              data: [
                {
                  id: 'in_test_1',
                  status: 'paid',
                  currency: 'brl',
                  amount_due: 2990,
                  amount_paid: 2990,
                  created: 1_893_456_000,
                  status_transitions: { paid_at: 1_893_456_100 },
                },
              ],
            }),
          ),
        },
        subscriptions: {
          list: vi.fn(() =>
            Promise.resolve({
              data: [
                {
                  id: 'sub_test_1',
                  customer: 'cus_liiiraa',
                  status: 'active',
                  cancel_at_period_end: false,
                  current_period_start: 1_893_456_000,
                  current_period_end: 1_896_134_400,
                  items: {
                    data: [
                      {
                        price: {
                          unit_amount: 2990,
                          currency: 'brl',
                          lookup_key: 'liiiraa_boost_brl_monthly',
                        },
                      },
                    ],
                  },
                },
              ],
            }),
          ),
        },
      } as unknown as Stripe,
    });

    await expect(
      provider.retrieveCurrentState({
        providerEvent: {
          schemaVersion: '1.0',
          kind: 'provider-event',
          provider: 'commerce',
          providerEventId: 'evt_test_1',
          eventType: 'subscription-updated',
          aggregateReference: 'cus_liiiraa',
          payloadDigest: 'a'.repeat(64),
          correlationId: 'evt_test_1',
          receivedAt: '2030-01-01T00:00:00.000Z',
        },
      }),
    ).resolves.toMatchObject({
      ok: true,
      value: {
        providerCustomerId: 'cus_liiiraa',
        subscription: {
          providerSubscriptionId: 'sub_test_1',
          state: 'active',
          plan: 'premium',
          cadence: 'monthly',
          currency: 'BRL',
          paymentMethod: 'card',
          priceMinor: 2990,
        },
        invoices: [{ providerInvoiceId: 'in_test_1', state: 'paid' }],
      },
    });
  });
});
