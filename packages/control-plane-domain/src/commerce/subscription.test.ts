import { describe, expect, it } from 'vitest';

import {
  COMMERCIAL_PRICE_CATALOG,
  decideSubscriptionTransition,
  initialSubscriptionState,
  validateCheckoutSelection,
  type SubscriptionState,
} from './subscription.js';

const DAY_MS = 24 * 60 * 60 * 1_000;
const NOW = '2026-08-05T12:00:00.000Z';
const PERIOD_END = '2026-09-05T12:00:00.000Z';

const premiumState = (overrides: Partial<SubscriptionState> = {}): SubscriptionState => ({
  ...initialSubscriptionState('account-commerce'),
  version: 7n,
  plan: 'premium',
  status: 'active',
  currency: 'BRL',
  cadence: 'monthly',
  paymentMethod: 'card',
  priceMinor: 2_990,
  currentPeriodStart: NOW,
  currentPeriodEnd: PERIOD_END,
  firstPaymentAt: NOW,
  checkoutStatus: 'reconciled',
  capabilities: {
    newPremiumActions: true,
    safetyHistoryRestoration: true,
  },
  ...overrides,
});

describe('D-11 exact commercial catalog', () => {
  it('admits Free without a trial or payment method and pins exact BRL/USD prices', () => {
    expect(COMMERCIAL_PRICE_CATALOG).toEqual({
      BRL: { monthly: 2_990, annual: 24_990 },
      USD: { monthly: 699, annual: 5_999 },
    });
    expect(validateCheckoutSelection({ plan: 'free' })).toEqual({ ok: true });
    expect(
      validateCheckoutSelection({
        plan: 'premium',
        currency: 'BRL',
        cadence: 'monthly',
        paymentMethod: 'card',
        priceMinor: 2_990,
      }),
    ).toEqual({ ok: true });
    expect(
      validateCheckoutSelection({
        plan: 'premium',
        currency: 'USD',
        cadence: 'annual',
        paymentMethod: 'pix',
        priceMinor: 5_999,
      }),
    ).toEqual({ ok: true });
    expect(
      validateCheckoutSelection({
        plan: 'premium',
        currency: 'BRL',
        cadence: 'monthly',
        paymentMethod: 'pix',
        priceMinor: 2_990,
      }),
    ).toEqual({ ok: false, code: 'PIX_ANNUAL_ONLY' });
  });
});

describe('D-12 through D-21 subscription lifecycle state table', () => {
  it('D-12 grants seven days of grace and expires Premium only after the boundary', () => {
    const failedAt = NOW;
    const grace = decideSubscriptionTransition(premiumState(), {
      kind: 'payment-failed',
      failedAt,
    });
    expect(grace.state).toMatchObject({
      status: 'grace',
      graceEndsAt: new Date(Date.parse(failedAt) + 7 * DAY_MS).toISOString(),
      capabilities: { newPremiumActions: true, safetyHistoryRestoration: true },
    });
    expect(grace.notices).toEqual(['payment-retry', 'grace-started']);

    const beforeBoundary = decideSubscriptionTransition(grace.state, {
      kind: 'grace-elapsed',
      now: new Date(Date.parse(failedAt) + 7 * DAY_MS - 1).toISOString(),
    });
    expect(beforeBoundary.state.status).toBe('grace');

    const expired = decideSubscriptionTransition(grace.state, {
      kind: 'grace-elapsed',
      now: new Date(Date.parse(failedAt) + 7 * DAY_MS).toISOString(),
    });
    expect(expired.state).toMatchObject({
      status: 'expired',
      capabilities: { newPremiumActions: false, safetyHistoryRestoration: true },
    });
  });

  it('D-13 applies monthly-to-annual now with proportional credit and schedules annual-to-monthly', () => {
    const halfway = new Date((Date.parse(NOW) + Date.parse(PERIOD_END)) / 2).toISOString();
    const upgrade = decideSubscriptionTransition(premiumState(), {
      kind: 'change-cadence',
      targetCadence: 'annual',
      now: halfway,
    });
    expect(upgrade).toMatchObject({
      outcome: 'provider-action-required',
      creditMinor: 1_495,
      effectiveAt: halfway,
    });
    expect(upgrade.state.scheduledCadence).toBeUndefined();

    const downgrade = decideSubscriptionTransition(
      premiumState({ cadence: 'annual', priceMinor: 24_990 }),
      { kind: 'change-cadence', targetCadence: 'monthly', now: halfway },
    );
    expect(downgrade).toMatchObject({
      outcome: 'provider-action-required',
      effectiveAt: PERIOD_END,
      state: { cadence: 'annual', scheduledCadence: 'monthly' },
    });
  });

  it('D-14/D-15 accepts first-payment self-service refund for seven days and prioritizes later claims', () => {
    const insideWindow = decideSubscriptionTransition(premiumState(), {
      kind: 'refund-requested',
      reason: 'customer-request',
      now: new Date(Date.parse(NOW) + 7 * DAY_MS - 1).toISOString(),
    });
    expect(insideWindow).toMatchObject({
      outcome: 'provider-action-required',
      refundDisposition: 'self-service-full',
    });

    const outsideWindow = decideSubscriptionTransition(premiumState(), {
      kind: 'refund-requested',
      reason: 'duplicate-charge',
      now: new Date(Date.parse(NOW) + 7 * DAY_MS).toISOString(),
    });
    expect(outsideWindow).toMatchObject({
      outcome: 'review-required',
      refundDisposition: 'prioritized-review',
      state: { status: 'refund-review' },
    });

    const confirmed = decideSubscriptionTransition(premiumState(), {
      kind: 'refund-confirmed',
      refundedAt: new Date(Date.parse(NOW) + DAY_MS).toISOString(),
    });
    expect(confirmed.state).toMatchObject({
      status: 'expired',
      capabilities: { newPremiumActions: false, safetyHistoryRestoration: true },
    });
  });

  it('D-16 never grants Premium from checkout navigation or return intent', () => {
    const pending = decideSubscriptionTransition(initialSubscriptionState('account-commerce'), {
      kind: 'checkout-returned',
      checkoutReference: 'checkout-intent-1',
      now: NOW,
    });
    expect(pending.state).toMatchObject({
      plan: 'free',
      status: 'payment-pending',
      checkoutStatus: 'pending-reconciliation',
      capabilities: { newPremiumActions: false, safetyHistoryRestoration: true },
    });
  });

  it('D-18 preserves the paid cycle on cancel and undoes before period end without another charge', () => {
    const canceled = decideSubscriptionTransition(premiumState(), {
      kind: 'cancel-requested',
      now: new Date(Date.parse(NOW) + DAY_MS).toISOString(),
    });
    expect(canceled.state).toMatchObject({
      status: 'active',
      cancelAtPeriodEnd: true,
      currentPeriodEnd: PERIOD_END,
      capabilities: { newPremiumActions: true },
    });
    const undone = decideSubscriptionTransition(canceled.state, {
      kind: 'cancel-undone',
      now: new Date(Date.parse(NOW) + 2 * DAY_MS).toISOString(),
    });
    expect(undone).toMatchObject({
      outcome: 'provider-action-required',
      chargeRequired: false,
      state: { cancelAtPeriodEnd: false, currentPeriodEnd: PERIOD_END },
    });
  });

  it('D-19 treats Pix as manual annual renewal and emits reminders without silent renewal', () => {
    const reminder = decideSubscriptionTransition(
      premiumState({ cadence: 'annual', paymentMethod: 'pix', priceMinor: 24_990 }),
      { kind: 'pix-renewal-reminder', now: NOW },
    );
    expect(reminder).toMatchObject({
      outcome: 'notice-only',
      providerRenewalAllowed: false,
      notices: ['pix-renewal-required'],
      state: { currentPeriodEnd: PERIOD_END },
    });
  });

  it('D-20 requires 30 days notice and keeps the paid-period price unchanged', () => {
    const effectiveAt = new Date(Date.parse(NOW) + 30 * DAY_MS).toISOString();
    const change = decideSubscriptionTransition(premiumState(), {
      kind: 'price-change-announced',
      newPriceMinor: 3_490,
      noticeAt: NOW,
      effectiveAt,
    });
    expect(change).toMatchObject({
      outcome: 'notice-only',
      state: {
        priceMinor: 2_990,
        priceChange: { newPriceMinor: 3_490, noticeAt: NOW, effectiveAt },
      },
      notices: ['price-change'],
    });
    expect(() =>
      decideSubscriptionTransition(premiumState(), {
        kind: 'price-change-announced',
        newPriceMinor: 3_490,
        noticeAt: NOW,
        effectiveAt: new Date(Date.parse(NOW) + 30 * DAY_MS - 1).toISOString(),
      }),
    ).toThrow('price-change-notice-too-short');
  });

  it('D-21 restricts new Premium actions during dispute while preserving safety/history/restoration', () => {
    const disputed = decideSubscriptionTransition(premiumState(), {
      kind: 'dispute-opened',
      openedAt: NOW,
    });
    expect(disputed.state).toMatchObject({
      status: 'disputed',
      capabilities: { newPremiumActions: false, safetyHistoryRestoration: true },
    });
    const resolved = decideSubscriptionTransition(disputed.state, {
      kind: 'dispute-resolved',
      resolution: 'won',
      resolvedAt: new Date(Date.parse(NOW) + DAY_MS).toISOString(),
    });
    expect(resolved.state).toMatchObject({
      status: 'active',
      capabilities: { newPremiumActions: true, safetyHistoryRestoration: true },
    });
  });
});
