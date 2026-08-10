import type Stripe from 'stripe';
import { describe, expect, it, vi } from 'vitest';

import {
  assertStripeBrandAuthority,
  prepareStripeTestRuntime,
  provisionStripeTestCatalog,
} from './provision-stripe.js';

describe('Stripe brand authority', () => {
  it('admits only the dedicated Liiiraa Boost customer-facing account identity', async () => {
    const stripe = {
      accounts: {
        retrieve: vi.fn(() =>
          Promise.resolve({
            id: 'acct_liiiraa',
            business_profile: { name: 'Liiiraa Boost', url: 'https://liiiraa-boost.vercel.app' },
            settings: {
              branding: {
                icon: 'file_liiiraa_icon',
                logo: 'file_liiiraa_logo',
                primary_color: '#090a0d',
                secondary_color: '#315efb',
              },
              dashboard: { display_name: 'Liiiraa Boost' },
              payments: { statement_descriptor: 'LIIIRAA BOOST' },
            },
          }),
        ),
      },
    } as unknown as Stripe;

    await expect(assertStripeBrandAuthority(stripe)).resolves.toEqual({
      accountId: 'acct_liiiraa',
      status: 'verified',
    });
  });

  it('admits the dedicated branded test account while live activation is still pending', async () => {
    const stripe = {
      accounts: {
        retrieve: vi.fn(() =>
          Promise.resolve({
            id: 'acct_liiiraa_test',
            business_profile: { name: 'Área restrita de Liiiraa Boost', url: null },
            settings: {
              branding: {
                icon: 'file_liiiraa_icon',
                logo: 'file_liiiraa_logo',
                primary_color: '#090a0d',
                secondary_color: '#315efb',
              },
              dashboard: { display_name: 'Liiiraa Boost' },
              payments: { statement_descriptor: null },
            },
          }),
        ),
      },
    } as unknown as Stripe;

    await expect(assertStripeBrandAuthority(stripe)).resolves.toEqual({
      accountId: 'acct_liiiraa_test',
      status: 'verified',
    });
  });

  it('rejects the unrelated Frescari account before creating any Liiiraa object', async () => {
    const stripe = {
      accounts: {
        retrieve: vi.fn(() =>
          Promise.resolve({
            id: 'acct_frescari',
            business_profile: { name: null, url: 'https://frescari.example' },
            settings: {
              dashboard: { display_name: 'Frescari' },
              payments: { statement_descriptor: 'FRESCARI' },
            },
          }),
        ),
      },
    } as unknown as Stripe;

    await expect(assertStripeBrandAuthority(stripe)).rejects.toThrow(
      'STRIPE_TEST_BRAND_REJECTED:ACCOUNT_IDENTITY',
    );
  });
});

describe('Stripe test catalog provisioning', () => {
  it('creates one managed product and four recurring prices without touching unrelated products', async () => {
    const createProduct = vi.fn(() =>
      Promise.resolve({ id: 'prod_liiiraa', name: 'Liiiraa Boost Premium' }),
    );
    const createPrice = vi.fn(({ lookup_key: lookupKey }: { lookup_key: string }) =>
      Promise.resolve({ id: `price_${lookupKey}`, lookup_key: lookupKey }),
    );
    const stripe = {
      products: {
        list: vi.fn(() => Promise.resolve({ data: [{ id: 'prod_unrelated', metadata: {} }] })),
        create: createProduct,
      },
      prices: {
        list: vi.fn(() => Promise.resolve({ data: [] })),
        create: createPrice,
      },
    } as unknown as Stripe;

    await expect(provisionStripeTestCatalog(stripe)).resolves.toMatchObject({
      createdPrices: 4,
      createdProducts: 1,
      mode: 'test',
      reusedPrices: 0,
    });
    expect(createProduct).toHaveBeenCalledWith(
      expect.objectContaining({
        metadata: { liiiraa_product: 'liiiraa_boost', managed_environment: 'staging' },
      }),
      { idempotencyKey: 'liiiraa-boost-staging-product-v1' },
    );
    expect(createPrice).toHaveBeenCalledTimes(4);
    expect(createPrice).toHaveBeenCalledWith(
      expect.objectContaining({
        currency: 'brl',
        lookup_key: 'liiiraa_boost_brl_monthly',
        recurring: { interval: 'month' },
        unit_amount: 2990,
      }),
      { idempotencyKey: 'liiiraa-boost-price-liiiraa_boost_brl_monthly-v1' },
    );
  });

  it('reuses the exact managed product and prices on subsequent runs', async () => {
    const createProduct = vi.fn();
    const createPrice = vi.fn();
    const stripe = {
      products: {
        list: vi.fn(() =>
          Promise.resolve({
            data: [
              {
                id: 'prod_liiiraa',
                metadata: { liiiraa_product: 'liiiraa_boost', managed_environment: 'staging' },
              },
            ],
          }),
        ),
        create: createProduct,
      },
      prices: {
        list: vi.fn(({ lookup_keys: lookupKeys }: { lookup_keys: string[] }) =>
          Promise.resolve({
            data: [
              {
                id: `price_${lookupKeys[0] ?? 'missing'}`,
                lookup_key: lookupKeys[0],
                active: true,
              },
            ],
          }),
        ),
        create: createPrice,
      },
    } as unknown as Stripe;

    await expect(provisionStripeTestCatalog(stripe)).resolves.toMatchObject({
      createdPrices: 0,
      createdProducts: 0,
      reusedPrices: 4,
    });
    expect(createProduct).not.toHaveBeenCalled();
    expect(createPrice).not.toHaveBeenCalled();
  });
});

describe('Stripe staging runtime provisioning', () => {
  it('creates a managed portal and a fresh signed webhook without exposing the secret', async () => {
    const writeProtected = vi.fn(() => Promise.resolve());
    const deleteWebhook = vi.fn(() => Promise.resolve({ deleted: true, id: 'we_retired' }));
    const stripe = {
      billingPortal: {
        configurations: {
          list: vi.fn(() => Promise.resolve({ data: [] })),
          create: vi.fn(() => Promise.resolve({ id: 'bpc_liiiraa' })),
        },
      },
      webhookEndpoints: {
        list: vi.fn(() =>
          Promise.resolve({
            data: [
              {
                id: 'we_old',
                description: 'Liiiraa Boost staging managed',
                url: 'https://api.staging.example/v1/commerce/provider-webhook',
                status: 'enabled',
              },
              {
                id: 'we_retired',
                description: 'Liiiraa Boost staging managed',
                url: 'https://api.staging.example/v1/commerce/provider-webhook',
                status: 'disabled',
              },
              {
                id: 'we_unmanaged',
                description: 'Another integration',
                url: 'https://api.staging.example/v1/commerce/provider-webhook',
                status: 'disabled',
              },
            ],
          }),
        ),
        del: deleteWebhook,
        create: vi.fn(() =>
          Promise.resolve({
            id: 'we_new',
            secret: 'whsec_synthetic_secret',
            url: 'https://api.staging.example/v1/commerce/provider-webhook',
          }),
        ),
      },
    } as unknown as Stripe;

    await expect(
      prepareStripeTestRuntime(stripe, {
        webhookUrl: 'https://api.staging.example/v1/commerce/provider-webhook',
        writeProtected,
      }),
    ).resolves.toEqual({
      portalConfigurationId: 'bpc_liiiraa',
      previousWebhookEndpointIds: ['we_old'],
      status: 'prepared',
      webhookEndpointId: 'we_new',
    });
    expect(writeProtected).toHaveBeenCalledWith({
      previousWebhookEndpointIds: ['we_old'],
      webhookEndpointId: 'we_new',
      webhookSecret: 'whsec_synthetic_secret',
    });
    expect(deleteWebhook).toHaveBeenCalledTimes(1);
    expect(deleteWebhook).toHaveBeenCalledWith('we_retired');
  });
});
