import type { SubscriptionProjectionJson } from '@liiiraa/contracts-ts';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { createAccountCommerce, subscriptionBillingKind } from './account-commerce';
import { primeAccountCsrfToken } from './account-auth';

const subscription = {
  schemaVersion: '1.0',
  aggregateVersion: '7',
  etag: 'subscription-v7',
  correlationId: 'projection-correlation',
  provenance: 'postgres-authority',
  kind: 'subscription-projection',
  subscriptionId: 'subscription-test',
  accountId: '00000000-0000-4000-8000-000000000001',
  state: 'none',
  plan: 'free',
  entitlements: [],
  cancelAtPeriodEnd: false,
} satisfies SubscriptionProjectionJson;

describe('real account commerce client', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it('issues the exact authoritative Premium selection and admits only Stripe Checkout', async () => {
    const transport = vi
      .fn()
      .mockResolvedValueOnce(
        new Response(JSON.stringify({ token: 'a'.repeat(43) }), {
          headers: { 'content-type': 'application/json' },
          status: 200,
        }),
      )
      .mockResolvedValueOnce(
        new Response(JSON.stringify({ checkoutUrl: 'https://checkout.stripe.com/c/pay/test' }), {
          headers: { 'content-type': 'application/json' },
          status: 202,
        }),
      );
    const commerce = createAccountCommerce({
      baseUrl: 'https://checkout-authority.example',
      clock: () => '2026-08-06T12:00:00.000Z',
      commandId: () => 'command-checkout-1',
      correlationId: () => 'correlation-checkout-1',
      transport,
    });

    await expect(
      commerce.startCheckout({ cadence: 'annual', currency: 'BRL', locale: 'pt-BR', subscription }),
    ).resolves.toEqual({
      status: 'redirect',
      url: 'https://checkout.stripe.com/c/pay/test',
    });
    const checkoutRequest = transport.mock.calls[1]?.[1] as RequestInit | undefined;
    if (typeof checkoutRequest?.body !== 'string') throw new Error('EXPECTED_JSON_BODY');
    expect(JSON.parse(checkoutRequest.body)).toEqual({
      command: {
        schemaVersion: '1.0',
        kind: 'commerce-command',
        commandId: 'command-checkout-1',
        accountId: subscription.accountId,
        action: 'start-checkout',
        expectedVersion: '7',
        correlationId: 'correlation-checkout-1',
        requestedAt: '2026-08-06T12:00:00.000Z',
      },
      locale: 'pt-BR',
      selection: {
        cadence: 'annual',
        currency: 'BRL',
        paymentMethod: 'card',
        plan: 'premium',
        priceMinor: 24_990,
      },
    });
  });

  it('rejects a non-Stripe redirect returned by the authority', async () => {
    const transport = vi
      .fn()
      .mockResolvedValueOnce(
        new Response(JSON.stringify({ token: 'b'.repeat(43) }), {
          headers: { 'content-type': 'application/json' },
          status: 200,
        }),
      )
      .mockResolvedValueOnce(
        new Response(JSON.stringify({ url: 'https://attacker.example/session' }), {
          headers: { 'content-type': 'application/json' },
          status: 200,
        }),
      );
    await primeAccountCsrfToken('https://portal-authority.example', transport);
    const commerce = createAccountCommerce({
      baseUrl: 'https://portal-authority.example',
      transport,
    });

    await expect(commerce.openPortal('en')).resolves.toEqual({
      code: 'invalid-response',
      status: 'error',
    });
  });

  it('distinguishes permanent Premium authority from a Stripe-backed subscription', () => {
    expect(
      subscriptionBillingKind({
        ...subscription,
        state: 'active',
        plan: 'premium',
        entitlements: ['premium-actions'],
      }),
    ).toBe('permanent');
    expect(
      subscriptionBillingKind({
        ...subscription,
        state: 'active',
        plan: 'premium',
        entitlements: ['premium-actions'],
        currentPeriodEndsAt: '2030-01-01T00:00:00.000Z',
      }),
    ).toBe('stripe');
    expect(subscriptionBillingKind(subscription)).toBe('free');
  });
});
