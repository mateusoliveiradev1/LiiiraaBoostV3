export const SUBSCRIPTION_GRACE_PERIOD_MS = 7 * 24 * 60 * 60 * 1_000;
export const SELF_SERVICE_REFUND_WINDOW_MS = 7 * 24 * 60 * 60 * 1_000;
export const PRICE_CHANGE_NOTICE_MS = 30 * 24 * 60 * 60 * 1_000;

export const COMMERCIAL_PRICE_CATALOG = Object.freeze({
  BRL: Object.freeze({ monthly: 2_990, annual: 24_990 }),
  USD: Object.freeze({ monthly: 699, annual: 5_999 }),
});

export type CommerceCurrency = keyof typeof COMMERCIAL_PRICE_CATALOG;
export type BillingCadence = 'monthly' | 'annual';
export type CommercePaymentMethod = 'card' | 'pix';
export type SubscriptionLifecycleStatus =
  | 'free'
  | 'payment-pending'
  | 'active'
  | 'grace'
  | 'canceled'
  | 'expired'
  | 'refund-review'
  | 'disputed';

export interface SubscriptionCapabilities {
  readonly newPremiumActions: boolean;
  readonly safetyHistoryRestoration: true;
}

export interface SubscriptionPriceChange {
  readonly newPriceMinor: number;
  readonly noticeAt: string;
  readonly effectiveAt: string;
}

export interface SubscriptionState {
  readonly accountId: string;
  readonly subscriptionId?: string;
  readonly providerCustomerId?: string;
  readonly version: bigint;
  readonly plan: 'free' | 'premium';
  readonly status: SubscriptionLifecycleStatus;
  readonly currency?: CommerceCurrency;
  readonly cadence?: BillingCadence;
  readonly scheduledCadence?: BillingCadence;
  readonly paymentMethod?: CommercePaymentMethod;
  readonly priceMinor?: number;
  readonly currentPeriodStart?: string;
  readonly currentPeriodEnd?: string;
  readonly firstPaymentAt?: string;
  readonly graceEndsAt?: string;
  readonly cancelAtPeriodEnd: boolean;
  readonly checkoutStatus: 'none' | 'pending-reconciliation' | 'reconciled';
  readonly checkoutReference?: string;
  readonly priceChange?: SubscriptionPriceChange;
  readonly disputeOpenedAt?: string;
  readonly capabilities: SubscriptionCapabilities;
}

export type RefundReason = 'customer-request' | 'duplicate-charge' | 'fraud' | 'service-failure';

export type SubscriptionCommand =
  | Readonly<{ kind: 'checkout-returned'; checkoutReference: string; now: string }>
  | Readonly<{ kind: 'payment-failed'; failedAt: string }>
  | Readonly<{ kind: 'grace-elapsed'; now: string }>
  | Readonly<{ kind: 'change-cadence'; targetCadence: BillingCadence; now: string }>
  | Readonly<{ kind: 'refund-requested'; reason: RefundReason; now: string }>
  | Readonly<{ kind: 'refund-confirmed'; refundedAt: string }>
  | Readonly<{ kind: 'cancel-requested'; now: string }>
  | Readonly<{ kind: 'cancel-undone'; now: string }>
  | Readonly<{ kind: 'pix-renewal-reminder'; now: string }>
  | Readonly<{
      kind: 'price-change-announced';
      newPriceMinor: number;
      noticeAt: string;
      effectiveAt: string;
    }>
  | Readonly<{ kind: 'dispute-opened'; openedAt: string }>
  | Readonly<{
      kind: 'dispute-resolved';
      resolution: 'won' | 'lost';
      resolvedAt: string;
    }>;

export interface SubscriptionTransition {
  readonly state: SubscriptionState;
  readonly outcome:
    'applied' | 'no-op' | 'provider-action-required' | 'review-required' | 'notice-only';
  readonly notices: readonly (
    | 'payment-retry'
    | 'grace-started'
    | 'premium-expired'
    | 'refund-confirmed'
    | 'refund-review'
    | 'pix-renewal-required'
    | 'price-change'
    | 'dispute-opened'
    | 'dispute-resolved'
  )[];
  readonly creditMinor?: number;
  readonly effectiveAt?: string;
  readonly refundDisposition?: 'self-service-full' | 'prioritized-review';
  readonly chargeRequired?: boolean;
  readonly providerRenewalAllowed?: boolean;
}

export type CheckoutSelection =
  | Readonly<{ plan: 'free' }>
  | Readonly<{
      plan: 'premium';
      currency: CommerceCurrency;
      cadence: BillingCadence;
      paymentMethod: CommercePaymentMethod;
      priceMinor: number;
    }>;

export type CheckoutSelectionResult =
  | Readonly<{ ok: true }>
  | Readonly<{
      ok: false;
      code: 'PIX_ANNUAL_ONLY' | 'PRICE_MISMATCH' | 'UNSUPPORTED_PAYMENT_METHOD';
    }>;

const preservedCapabilities = (newPremiumActions: boolean): SubscriptionCapabilities => ({
  newPremiumActions,
  safetyHistoryRestoration: true,
});

export const initialSubscriptionState = (accountId: string): SubscriptionState => ({
  accountId,
  version: 0n,
  plan: 'free',
  status: 'free',
  cancelAtPeriodEnd: false,
  checkoutStatus: 'none',
  capabilities: preservedCapabilities(false),
});

export const validateCheckoutSelection = (
  selection: CheckoutSelection,
): CheckoutSelectionResult => {
  if (selection.plan === 'free') return { ok: true };
  if (selection.paymentMethod === 'pix' && selection.cadence !== 'annual') {
    return { ok: false, code: 'PIX_ANNUAL_ONLY' };
  }
  if (COMMERCIAL_PRICE_CATALOG[selection.currency][selection.cadence] !== selection.priceMinor) {
    return { ok: false, code: 'PRICE_MISMATCH' };
  }
  return { ok: true };
};

const timestamp = (value: string): number => {
  const parsed = Date.parse(value);
  if (!Number.isFinite(parsed)) throw new Error('subscription-transition-invalid-timestamp');
  return parsed;
};

const nextState = (
  state: SubscriptionState,
  patch: Partial<SubscriptionState>,
): SubscriptionState => ({ ...state, ...patch, version: state.version + 1n });

const noOp = (state: SubscriptionState): SubscriptionTransition => ({
  state,
  outcome: 'no-op',
  notices: [],
});

export const decideSubscriptionTransition = (
  state: SubscriptionState,
  command: SubscriptionCommand,
): SubscriptionTransition => {
  if (command.kind === 'checkout-returned') {
    if (state.plan === 'premium' && state.status === 'active') return noOp(state);
    return {
      state: nextState(state, {
        plan: 'free',
        status: 'payment-pending',
        checkoutStatus: 'pending-reconciliation',
        checkoutReference: command.checkoutReference,
        capabilities: preservedCapabilities(false),
      }),
      outcome: 'applied',
      notices: [],
    };
  }

  if (command.kind === 'payment-failed') {
    const graceEndsAt = new Date(
      timestamp(command.failedAt) + SUBSCRIPTION_GRACE_PERIOD_MS,
    ).toISOString();
    return {
      state: nextState(state, {
        status: 'grace',
        graceEndsAt,
        capabilities: preservedCapabilities(true),
      }),
      outcome: 'applied',
      notices: ['payment-retry', 'grace-started'],
    };
  }

  if (command.kind === 'grace-elapsed') {
    if (state.status !== 'grace' || state.graceEndsAt === undefined) return noOp(state);
    if (timestamp(command.now) < timestamp(state.graceEndsAt)) return noOp(state);
    return {
      state: nextState(state, {
        status: 'expired',
        capabilities: preservedCapabilities(false),
      }),
      outcome: 'applied',
      notices: ['premium-expired'],
    };
  }

  if (command.kind === 'change-cadence') {
    if (
      state.plan !== 'premium' ||
      state.cadence === undefined ||
      state.priceMinor === undefined ||
      state.currentPeriodStart === undefined ||
      state.currentPeriodEnd === undefined ||
      state.cadence === command.targetCadence
    ) {
      return noOp(state);
    }
    if (state.cadence === 'monthly' && command.targetCadence === 'annual') {
      const start = timestamp(state.currentPeriodStart);
      const end = timestamp(state.currentPeriodEnd);
      const now = Math.min(end, Math.max(start, timestamp(command.now)));
      const unusedRatio = (end - now) / (end - start);
      const withoutScheduledCadence = { ...state };
      delete withoutScheduledCadence.scheduledCadence;
      return {
        state: { ...withoutScheduledCadence, version: state.version + 1n },
        outcome: 'provider-action-required',
        notices: [],
        creditMinor: Math.round(state.priceMinor * unusedRatio),
        effectiveAt: command.now,
      };
    }
    return {
      state: nextState(state, { scheduledCadence: 'monthly' }),
      outcome: 'provider-action-required',
      notices: [],
      effectiveAt: state.currentPeriodEnd,
    };
  }

  if (command.kind === 'refund-requested') {
    const firstPaymentAt = state.firstPaymentAt;
    const withinWindow =
      firstPaymentAt !== undefined &&
      timestamp(command.now) - timestamp(firstPaymentAt) < SELF_SERVICE_REFUND_WINDOW_MS;
    if (withinWindow) {
      return {
        state,
        outcome: 'provider-action-required',
        notices: [],
        refundDisposition: 'self-service-full',
      };
    }
    return {
      state: nextState(state, { status: 'refund-review' }),
      outcome: 'review-required',
      notices: ['refund-review'],
      refundDisposition: 'prioritized-review',
    };
  }

  if (command.kind === 'refund-confirmed') {
    timestamp(command.refundedAt);
    return {
      state: nextState(state, {
        status: 'expired',
        cancelAtPeriodEnd: false,
        capabilities: preservedCapabilities(false),
      }),
      outcome: 'applied',
      notices: ['refund-confirmed'],
    };
  }

  if (command.kind === 'cancel-requested') {
    timestamp(command.now);
    if (state.plan !== 'premium' || state.currentPeriodEnd === undefined) return noOp(state);
    return {
      state: nextState(state, { cancelAtPeriodEnd: true }),
      outcome: 'provider-action-required',
      notices: [],
      effectiveAt: state.currentPeriodEnd,
    };
  }

  if (command.kind === 'cancel-undone') {
    if (
      !state.cancelAtPeriodEnd ||
      state.currentPeriodEnd === undefined ||
      timestamp(command.now) >= timestamp(state.currentPeriodEnd)
    ) {
      return noOp(state);
    }
    return {
      state: nextState(state, { cancelAtPeriodEnd: false }),
      outcome: 'provider-action-required',
      notices: [],
      chargeRequired: false,
    };
  }

  if (command.kind === 'pix-renewal-reminder') {
    timestamp(command.now);
    if (state.paymentMethod !== 'pix' || state.cadence !== 'annual') return noOp(state);
    return {
      state,
      outcome: 'notice-only',
      notices: ['pix-renewal-required'],
      providerRenewalAllowed: false,
    };
  }

  if (command.kind === 'price-change-announced') {
    if (command.newPriceMinor < 0) throw new Error('price-change-invalid-price');
    if (timestamp(command.effectiveAt) - timestamp(command.noticeAt) < PRICE_CHANGE_NOTICE_MS) {
      throw new Error('price-change-notice-too-short');
    }
    return {
      state: nextState(state, {
        priceChange: {
          newPriceMinor: command.newPriceMinor,
          noticeAt: command.noticeAt,
          effectiveAt: command.effectiveAt,
        },
      }),
      outcome: 'notice-only',
      notices: ['price-change'],
    };
  }

  if (command.kind === 'dispute-opened') {
    timestamp(command.openedAt);
    return {
      state: nextState(state, {
        status: 'disputed',
        disputeOpenedAt: command.openedAt,
        capabilities: preservedCapabilities(false),
      }),
      outcome: 'applied',
      notices: ['dispute-opened'],
    };
  }

  timestamp(command.resolvedAt);
  const won = command.resolution === 'won';
  const withoutDispute = { ...state };
  delete withoutDispute.disputeOpenedAt;
  return {
    state: {
      ...withoutDispute,
      version: state.version + 1n,
      status: won ? 'active' : 'expired',
      capabilities: preservedCapabilities(won),
    },
    outcome: 'applied',
    notices: ['dispute-resolved'],
  };
};

export const subscriptionAuthorityFingerprint = (state: SubscriptionState): string =>
  JSON.stringify({
    subscriptionId: state.subscriptionId,
    providerCustomerId: state.providerCustomerId,
    plan: state.plan,
    status: state.status,
    currency: state.currency,
    cadence: state.cadence,
    scheduledCadence: state.scheduledCadence,
    paymentMethod: state.paymentMethod,
    priceMinor: state.priceMinor,
    currentPeriodStart: state.currentPeriodStart,
    currentPeriodEnd: state.currentPeriodEnd,
    firstPaymentAt: state.firstPaymentAt,
    graceEndsAt: state.graceEndsAt,
    cancelAtPeriodEnd: state.cancelAtPeriodEnd,
    priceChange: state.priceChange,
    disputeOpenedAt: state.disputeOpenedAt,
  });
