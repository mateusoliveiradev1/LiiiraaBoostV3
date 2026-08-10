import { chmod, open, readFile } from 'node:fs/promises';
import { isAbsolute } from 'node:path';
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

export interface StripeBrandAuthorityResult {
  readonly accountId: string;
  readonly status: 'verified';
}

const WEBHOOK_EVENTS = Object.freeze([
  'charge.dispute.created',
  'charge.refunded',
  'checkout.session.completed',
  'customer.subscription.deleted',
  'customer.subscription.updated',
  'invoice.paid',
  'invoice.payment_failed',
] as const);
const MANAGED_WEBHOOK_DESCRIPTION = 'Liiiraa Boost staging managed';

interface ProtectedStripeRuntime {
  readonly previousWebhookEndpointIds: readonly string[];
  readonly webhookEndpointId: string;
  readonly webhookSecret: string;
}

export interface PrepareStripeRuntimeInput {
  readonly webhookUrl: string;
  readonly writeProtected: (runtime: ProtectedStripeRuntime) => Promise<void>;
}

export interface PreparedStripeRuntime {
  readonly portalConfigurationId: string;
  readonly previousWebhookEndpointIds: readonly string[];
  readonly status: 'prepared';
  readonly webhookEndpointId: string;
}

const managedProduct = (product: Stripe.Product): boolean =>
  product.metadata['liiiraa_product'] === MANAGED_METADATA.liiiraa_product &&
  product.metadata['managed_environment'] === MANAGED_METADATA.managed_environment;

const atStage = async <T>(code: string, operation: () => Promise<T>): Promise<T> => {
  try {
    return await operation();
  } catch {
    throw new Error(`STRIPE_TEST_PROVISIONING_REJECTED:${code}`);
  }
};

const descriptorIdentity = (value: string | null | undefined): string =>
  value?.replaceAll(/[^A-Za-z0-9]/gu, '').toUpperCase() ?? '';

export const assertStripeBrandAuthority = async (
  stripe: Stripe,
): Promise<StripeBrandAuthorityResult> => {
  const account = await atStage('ACCOUNT_RETRIEVE', () => stripe.accounts.retrieve(null));
  const customerName = account.business_profile?.name?.trim();
  const dashboardName = account.settings?.dashboard.display_name?.trim();
  const statementDescriptor = descriptorIdentity(account.settings?.payments.statement_descriptor);
  const customerIdentity = descriptorIdentity(customerName);
  const branding = account.settings?.branding;
  const publicUrl = account.business_profile?.url?.toLowerCase() ?? '';
  const observedIdentity = [customerName, dashboardName, statementDescriptor, publicUrl]
    .filter((value): value is string => typeof value === 'string')
    .join('|')
    .toLowerCase();
  if (
    !customerIdentity.includes('LIIIRAABOOST') ||
    dashboardName !== 'Liiiraa Boost' ||
    (statementDescriptor !== '' && statementDescriptor !== 'LIIIRAABOOST') ||
    branding?.primary_color?.toLowerCase() !== '#090a0d' ||
    branding.secondary_color?.toLowerCase() !== '#315efb' ||
    branding.icon === null ||
    branding.logo === null ||
    observedIdentity.includes('frescari')
  ) {
    throw new Error('STRIPE_TEST_BRAND_REJECTED:ACCOUNT_IDENTITY');
  }
  return { accountId: account.id, status: 'verified' };
};

export const provisionStripeTestCatalog = async (
  stripe: Stripe,
): Promise<StripeCatalogProvisioningResult> => {
  const products = await atStage('PRODUCT_LIST', () =>
    stripe.products.list({ active: true, limit: 100 }),
  );
  let product = products.data.find(managedProduct);
  let createdProducts = 0;
  if (product === undefined) {
    product = await atStage('PRODUCT_CREATE', () =>
      stripe.products.create(
        {
          name: 'Liiiraa Boost Premium',
          description: 'Plano Premium do Liiiraa Boost — ambiente interno de testes.',
          metadata: MANAGED_METADATA,
        },
        { idempotencyKey: 'liiiraa-boost-staging-product-v1' },
      ),
    );
    createdProducts = 1;
  }

  let createdPrices = 0;
  let reusedPrices = 0;
  for (const price of PRICES) {
    const existing = await atStage('PRICE_LIST', () =>
      stripe.prices.list({
        active: true,
        limit: 1,
        lookup_keys: [price.lookupKey],
        type: 'recurring',
      }),
    );
    if (existing.data[0] !== undefined) {
      reusedPrices += 1;
      continue;
    }
    await atStage('PRICE_CREATE', () =>
      stripe.prices.create(
        {
          currency: price.currency,
          lookup_key: price.lookupKey,
          metadata: MANAGED_METADATA,
          product: product.id,
          recurring: { interval: price.interval },
          unit_amount: price.unitAmount,
        },
        { idempotencyKey: `liiiraa-boost-price-${price.lookupKey}-v1` },
      ),
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

const exactWebhookUrl = (value: string): string => {
  const url = new URL(value);
  if (
    url.protocol !== 'https:' ||
    url.username.length > 0 ||
    url.password.length > 0 ||
    url.search.length > 0 ||
    url.hash.length > 0 ||
    url.pathname !== '/v1/commerce/provider-webhook'
  ) {
    throw new Error('STRIPE_TEST_RUNTIME_REJECTED:WEBHOOK_URL');
  }
  return url.toString();
};

export const prepareStripeTestRuntime = async (
  stripe: Stripe,
  input: PrepareStripeRuntimeInput,
): Promise<PreparedStripeRuntime> => {
  const webhookUrl = exactWebhookUrl(input.webhookUrl);
  const configurations = await atStage('PORTAL_LIST', () =>
    stripe.billingPortal.configurations.list({
      active: true,
      limit: 100,
    }),
  );
  let portal = configurations.data.find(
    (configuration) => configuration.name === 'Liiiraa Boost staging managed',
  );
  portal ??= await atStage('PORTAL_CREATE', () =>
    stripe.billingPortal.configurations.create({
      name: 'Liiiraa Boost staging managed',
      business_profile: {
        headline: 'Gerencie sua assinatura Liiiraa Boost Premium',
      },
      features: {
        customer_update: { allowed_updates: ['email'], enabled: true },
        invoice_history: { enabled: true },
        payment_method_update: { enabled: true },
        subscription_cancel: { enabled: true, mode: 'at_period_end' },
      },
    }),
  );

  const existing = await atStage('WEBHOOK_LIST', () =>
    stripe.webhookEndpoints.list({ limit: 100 }),
  );
  const retiredWebhookEndpointIds = existing.data
    .filter(
      (endpoint) =>
        endpoint.url === webhookUrl &&
        endpoint.status === 'disabled' &&
        endpoint.description === MANAGED_WEBHOOK_DESCRIPTION,
    )
    .map(({ id }) => id);
  for (const endpointId of retiredWebhookEndpointIds) {
    await atStage('WEBHOOK_DELETE', () => stripe.webhookEndpoints.del(endpointId));
  }
  const previousWebhookEndpointIds = existing.data
    .filter((endpoint) => endpoint.url === webhookUrl && endpoint.status === 'enabled')
    .map(({ id }) => id);
  const webhook = await atStage('WEBHOOK_CREATE', () =>
    stripe.webhookEndpoints.create(
      {
        description: MANAGED_WEBHOOK_DESCRIPTION,
        enabled_events: [...WEBHOOK_EVENTS],
        url: webhookUrl,
      },
      { idempotencyKey: `liiiraa-webhook-${Date.now().toString(36)}` },
    ),
  );
  if (typeof webhook.secret !== 'string' || !webhook.secret.startsWith('whsec_')) {
    throw new Error('STRIPE_TEST_RUNTIME_REJECTED:WEBHOOK_SECRET');
  }
  const webhookSecret = webhook.secret;
  await atStage('PROTECTED_OUTPUT', () =>
    input.writeProtected({
      previousWebhookEndpointIds,
      webhookEndpointId: webhook.id,
      webhookSecret,
    }),
  );
  return {
    portalConfigurationId: portal.id,
    previousWebhookEndpointIds,
    status: 'prepared',
    webhookEndpointId: webhook.id,
  };
};

export const finalizeStripeTestRuntime = async (
  stripe: Stripe,
  runtime: ProtectedStripeRuntime,
): Promise<Readonly<{ disabledWebhookEndpoints: number; status: 'finalized' }>> => {
  const oldEndpoints = runtime.previousWebhookEndpointIds.filter(
    (endpointId) => endpointId !== runtime.webhookEndpointId,
  );
  for (const endpointId of oldEndpoints) {
    await stripe.webhookEndpoints.update(endpointId, { disabled: true });
  }
  return { disabledWebhookEndpoints: oldEndpoints.length, status: 'finalized' };
};

const protectedWriter =
  (path: string) =>
  async (runtime: ProtectedStripeRuntime): Promise<void> => {
    if (!isAbsolute(path)) throw new Error('STRIPE_TEST_RUNTIME_REJECTED:OUTPUT_PATH');
    const handle = await open(path, 'wx', 0o600);
    try {
      await chmod(path, 0o600);
      await handle.writeFile(`${JSON.stringify(runtime)}\n`, 'utf8');
      await handle.sync();
    } finally {
      await handle.close();
    }
  };

const run = async (): Promise<void> => {
  const secretKey = process.env['STRIPE_SECRET_KEY'];
  if (typeof secretKey !== 'string' || !/^sk_test_[A-Za-z0-9_]+$/u.test(secretKey)) {
    throw new Error('STRIPE_TEST_CATALOG_REJECTED:STRIPE_SECRET_KEY');
  }
  const stripe = new Stripe(secretKey, { typescript: true });
  await assertStripeBrandAuthority(stripe);
  const catalog = await provisionStripeTestCatalog(stripe);
  const outputPath = process.env['STRIPE_RUNTIME_OUTPUT_PATH'];
  const action = process.env['STRIPE_PROVISION_ACTION'] ?? 'catalog';
  if (action === 'prepare') {
    if (typeof outputPath !== 'string') {
      throw new Error('STRIPE_TEST_RUNTIME_REJECTED:OUTPUT_PATH');
    }
    const apiOrigin = process.env['STAGING_API_ORIGIN'];
    if (typeof apiOrigin !== 'string') {
      throw new Error('STRIPE_TEST_RUNTIME_REJECTED:API_ORIGIN');
    }
    const runtime = await prepareStripeTestRuntime(stripe, {
      webhookUrl: new URL('/v1/commerce/provider-webhook', apiOrigin).toString(),
      writeProtected: protectedWriter(outputPath),
    });
    process.stdout.write(`${JSON.stringify({ catalog, runtime })}\n`);
    return;
  }
  if (action === 'finalize') {
    if (typeof outputPath !== 'string' || !isAbsolute(outputPath)) {
      throw new Error('STRIPE_TEST_RUNTIME_REJECTED:OUTPUT_PATH');
    }
    const runtime = JSON.parse(await readFile(outputPath, 'utf8')) as ProtectedStripeRuntime;
    const finalized = await finalizeStripeTestRuntime(stripe, runtime);
    process.stdout.write(`${JSON.stringify({ catalog, finalized })}\n`);
    return;
  }
  process.stdout.write(`${JSON.stringify(catalog)}\n`);
};

const invokedPath = process.argv[1];
if (invokedPath && import.meta.url === pathToFileURL(invokedPath).href) {
  run().catch((error: unknown) => {
    const message = error instanceof Error ? error.message : '';
    const safe = /^STRIPE_TEST_(?:BRAND|CATALOG|RUNTIME|PROVISIONING)_REJECTED:[A-Z_]+$/u.test(
      message,
    )
      ? message
      : 'STRIPE_TEST_PROVISIONING_REJECTED:UNKNOWN';
    process.stderr.write(`${safe}\n`);
    process.exitCode = 1;
  });
}

export const STRIPE_TEST_PRICE_CATALOG = PRICES;
