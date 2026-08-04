import type { ProviderEventTypeJson } from '@liiiraa/contracts-ts';
import { describe, expect, it } from 'vitest';

const STRIPE_WEBHOOK_RED_OWNER = '04-08-01';

const signatureAdmissionMatrix = [
  {
    id: 'raw-signature-missing',
    behavior:
      'a missing Stripe signature must be rejected before parsing and create no provider inbox row',
  },
  {
    id: 'raw-signature-invalid',
    behavior:
      'an invalid raw-body signature must be rejected before parsing and create no provider inbox row',
  },
  {
    id: 'raw-signature-stale',
    behavior:
      'a correctly formed but stale signature must fail timestamp admission before parsing or reconciliation',
  },
] as const;

const deliveryPermutationMatrix = [
  {
    id: 'duplicate-delivery',
    contractEvents: [
      'checkout-completed',
      'checkout-completed',
    ] satisfies readonly ProviderEventTypeJson[],
    providerEventIds: ['evt_checkout_1', 'evt_checkout_1'],
    behavior:
      'a duplicate provider event ID is acknowledged once and cannot duplicate inbox rows, internal objects, outbox jobs, or Premium authority',
  },
  {
    id: 'delayed-delivery',
    contractEvents: [
      'subscription-updated',
      'invoice-updated',
    ] satisfies readonly ProviderEventTypeJson[],
    providerEventIds: ['evt_subscription_current', 'evt_invoice_older'],
    behavior:
      'a delayed older delivery must reconcile current provider objects instead of overwriting a newer subscription, invoice, or entitlement projection',
  },
  {
    id: 'replayed-delivery',
    contractEvents: [
      'invoice-updated',
      'invoice-updated',
    ] satisfies readonly ProviderEventTypeJson[],
    providerEventIds: ['evt_invoice_paid_1', 'evt_invoice_paid_1'],
    behavior:
      'a replayed signed delivery must converge through unique admission and provider retrieval without granting another paid period',
  },
  {
    id: 'reordered-delivery',
    contractEvents: [
      'invoice-updated',
      'subscription-updated',
      'checkout-completed',
    ] satisfies readonly ProviderEventTypeJson[],
    providerEventIds: ['evt_invoice_final', 'evt_subscription_mid', 'evt_checkout_initial'],
    behavior:
      'reverse arrival of checkout, invoice, and subscription events must converge to retrieved provider truth and never grant from checkout navigation',
  },
] as const;

const expectedStripeWebhookRed = (id: string, behavior: string): never => {
  throw new Error(`EXPECTED_RED[${STRIPE_WEBHOOK_RED_OWNER}][${id}]: ${behavior}`);
};

describe('Stripe webhook pre-implementation signature and delivery matrix', () => {
  it.each(signatureAdmissionMatrix)('$id', ({ id, behavior }) => {
    expectedStripeWebhookRed(id, behavior);
  });

  it.each(deliveryPermutationMatrix)(
    '$id',
    ({ id, contractEvents, providerEventIds, behavior }) => {
      expect(contractEvents).toHaveLength(providerEventIds.length);
      expectedStripeWebhookRed(id, behavior);
    },
  );
});
