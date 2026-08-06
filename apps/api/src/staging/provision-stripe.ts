import { pathToFileURL } from 'node:url';

import Stripe from 'stripe';

const MANAGED_METADATA = Object.freeze({
  liiiraa_product: 'liiiraa_boost',
  managed_environment: 'staging',
});

const PRICES = Object.freeze([
  {
    currency: 'brl',
    interval: 'month',
    lookupKey: 'liiiraa_boost_brl_monthly',
    unitAmount: 2_990,
  },
  {
    currency: 'brl',
    interval: 'year',
    lookupKey: 'liiiraa_boost_brl_annual',
    unitAmount: 24_990,
  },
  {
    currency: 'usd',
    interval: 'month',
    lookupKey: 'liiiraa_boost_usd_monthly',
    unitAmount: 699,
  },
  {
    currency: 'usd',
    interval: 'year',
    lookupKey: 'liiiraa_boost_usd_annual',
    unitAmount: 5_999,
  },
] as const);

export interface StripeCatalogProvisioningResult {
  readonly createdPrices: number;
  readonly createdProducts: number;
  readonly mode: 'test';
  readonly reusedPrices: number;
  readonly status: 'complete';
}

const managedProduct = (product: Stripe.Product): boolean =>
  product.metadata['liiiraa_product'] === MANAGED_METADATA.liiiraa_product &&
  product.metadata['managed_environment'] === MANAGED_METADATA.managed_environment;

export const provisionStripeTestCatalog = async (
  stripe: Stripe,
): Promise<StripeCatalogProvisioningResult> => {
  const products = await stripe.products.list({ active: true, limit: 100 });
  let product = products.data.find(managedProduct);
  let createdProducts = 0;
  if (product === undefined) {
    product = await stripe.products.create(
      {
        name: 'Liiiraa Boost Premium',
        description: 'Plano Premium do Liiiraa Boost — ambiente interno de testes.',
        metadata: MANAGED_METADATA,
      },
      { idempotencyKey: 'liiiraa-boost-staging-product-v1' },
    );
    createdProducts = 1;
  }

  let createdPrices = 0;
  let reusedPrices = 0;
  for (const price of PRICES) {
    const existing = await stripe.prices.list({
      active: true,
      limit: 1,
      lookup_keys: [price.lookupKey],
      type: 'recurring',
    });
    if (existing.data[0] !== undefined) {
      reusedPrices += 1;
      continue;
    }
    await stripe.prices.create(
      {
        currency: price.currency,
        lookup_key: price.lookupKey,
        metadata: MANAGED_METADATA,
        product: product.id,
        recurring: { interval: price.interval },
        unit_amount: price.unitAmount,
      },
      { idempotencyKey: `liiiraa-boost-price-${price.lookupKey}-v1` },
    );
    createdPrices += 1;
  }

  return {
    createdPrices,
    createdProducts,
    mode: 'test',
    reusedPrices,
    status: 'complete',
  };
};

const run = async (): Promise<void> => {
  const secretKey = process.env['STRIPE_SECRET_KEY'];
  if (typeof secretKey !== 'string' || !/^sk_test_[A-Za-z0-9_]+$/u.test(secretKey)) {
    throw new Error('STRIPE_TEST_CATALOG_REJECTED:STRIPE_SECRET_KEY');
  }
  const stripe = new Stripe(secretKey, { typescript: true });
  const result = await provisionStripeTestCatalog(stripe);
  process.stdout.write(`${JSON.stringify(result)}\n`);
};

const invokedPath = process.argv[1];
if (invokedPath && import.meta.url === pathToFileURL(invokedPath).href) {
  run().catch(() => {
    process.stderr.write('STRIPE_TEST_CATALOG_REJECTED:PROVISIONING_FAILED\n');
    process.exitCode = 1;
  });
}

export const STRIPE_TEST_PRICE_CATALOG = PRICES;
