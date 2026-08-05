import type { ProviderEventJson } from '@liiiraa/contracts-ts';
import {
  SUBSCRIPTION_GRACE_PERIOD_MS,
  initialSubscriptionState,
  subscriptionAuthorityFingerprint,
  validateCheckoutSelection,
  type SubscriptionState,
} from '@liiiraa/control-plane-domain';

import type {
  CommerceProviderPort,
  ProviderInvoiceReconciliation,
  ProviderReconciliation,
  ProviderSubscriptionReconciliation,
} from '../ports/commerce.js';

export interface CommerceSubscriptionRecord extends SubscriptionState {
  readonly providerSubscriptionId: string;
  readonly reconciliationFingerprint: string;
}

export interface CommerceInvoiceRecord {
  readonly invoiceId: string;
  readonly providerInvoiceId: string;
  readonly accountId: string;
  readonly subscriptionId: string;
  readonly state: ProviderInvoiceReconciliation['state'] | 'refunded' | 'disputed';
  readonly currency: string;
  readonly amountDueMinor: number;
  readonly amountPaidMinor: number;
  readonly issuedAt: string;
  readonly settledAt?: string;
  readonly version: bigint;
}

export interface CommerceEntitlementRecord {
  readonly entitlementId: string;
  readonly accountId: string;
  readonly subscriptionId: string;
  readonly status: 'active' | 'grace' | 'expired' | 'revoked';
  readonly allowNewPremiumActions: boolean;
  readonly safetyHistoryRestoration: true;
  readonly validFrom: string;
  readonly validUntil?: string;
  readonly version: bigint;
}

export interface CommerceReconciliationTransaction {
  resolveAccountId(providerCustomerId: string): Promise<string | null>;
  lockSubscription(
    providerCustomerId: string,
    providerSubscriptionId: string,
  ): Promise<CommerceSubscriptionRecord | null>;
  saveSubscription(record: CommerceSubscriptionRecord): Promise<void>;
  upsertInvoice(record: CommerceInvoiceRecord): Promise<void>;
  saveEntitlement(record: CommerceEntitlementRecord): Promise<void>;
  appendAudit(
    input: Readonly<{
      auditReference: string;
      accountId: string;
      eventType: 'commerce.reconciled';
      aggregateVersion: bigint;
      providerEventId: string;
      occurredAt: string;
    }>,
  ): Promise<void>;
  enqueueOutbox(
    input: Readonly<{
      jobId: string;
      topic: 'commerce.lifecycle-notification';
      accountId: string;
      subscriptionId: string;
      aggregateVersion: bigint;
      notices: readonly string[];
      availableAt: string;
    }>,
  ): Promise<void>;
  markProviderEventProcessed(providerEventId: string, aggregateVersion: bigint): Promise<void>;
}

export interface CommerceAuthorityRepository {
  claimProviderEvent(providerEvent: ProviderEventJson): Promise<'claimed' | 'duplicate'>;
  markProviderEventRetryable(providerEventId: string, errorCode: string): Promise<void>;
  transaction<T>(
    providerCustomerId: string,
    operation: (transaction: CommerceReconciliationTransaction) => Promise<T>,
  ): Promise<T>;
}

export interface ReconcileCommerceDependencies {
  readonly provider: CommerceProviderPort;
  readonly repository: CommerceAuthorityRepository;
  readonly clock: Readonly<{ now(): Date }>;
  readonly ids: Readonly<{ next(): string }>;
}

export interface ReconcileCommerceInput {
  readonly providerEvent: ProviderEventJson;
}

export type ReconcileCommerceResult =
  | Readonly<{
      ok: true;
      outcome: 'applied' | 'converged' | 'duplicate';
      aggregateVersion?: bigint;
    }>
  | Readonly<{
      ok: false;
      code: 'PROVIDER_UNAVAILABLE' | 'ACCOUNT_NOT_FOUND' | 'RECONCILIATION_FAILED';
      retryable: boolean;
    }>;

const parseTime = (value: string): number => {
  const parsed = Date.parse(value);
  if (!Number.isFinite(parsed)) throw new Error('provider-reconciliation-invalid-timestamp');
  return parsed;
};

const hasRefund = (invoices: readonly ProviderInvoiceReconciliation[]): boolean =>
  invoices.some((invoice) => invoice.refundedAt !== undefined);

const openDispute = (
  invoices: readonly ProviderInvoiceReconciliation[],
): ProviderInvoiceReconciliation | undefined =>
  invoices.find(
    (invoice) => invoice.disputeOpenedAt !== undefined && invoice.disputeResolvedAt === undefined,
  );

const noticesFor = (state: SubscriptionState): readonly string[] => {
  const notices: string[] = [];
  if (state.status === 'grace') notices.push('payment-retry', 'grace-started');
  if (state.status === 'expired') notices.push('premium-expired');
  if (state.status === 'disputed') notices.push('dispute-opened');
  if (state.paymentMethod === 'pix' && state.cadence === 'annual') {
    notices.push('pix-renewal-required');
  }
  return notices;
};

const stateFromProvider = (
  accountId: string,
  providerCustomerId: string,
  current: CommerceSubscriptionRecord | null,
  subscription: ProviderSubscriptionReconciliation,
  invoices: readonly ProviderInvoiceReconciliation[],
  retrievedAt: string,
): SubscriptionState => {
  const base = current ?? initialSubscriptionState(accountId);
  const cleanBase = { ...base };
  delete cleanBase.disputeOpenedAt;
  delete cleanBase.graceEndsAt;
  const refunded = hasRefund(invoices);
  const dispute = openDispute(invoices);
  const periodEnd = parseTime(subscription.currentPeriodEnd);
  const retrieved = parseTime(retrievedAt);
  let status: SubscriptionState['status'];
  let allowNewPremiumActions: boolean;
  let graceEndsAt: string | undefined;

  if (
    subscription.plan !== 'premium' ||
    subscription.currency === undefined ||
    subscription.cadence === undefined ||
    subscription.paymentMethod === undefined ||
    subscription.priceMinor === undefined ||
    !validateCheckoutSelection({
      plan: 'premium',
      currency: subscription.currency,
      cadence: subscription.cadence,
      paymentMethod: subscription.paymentMethod,
      priceMinor: subscription.priceMinor,
    }).ok
  ) {
    throw new Error('provider-reconciliation-commercial-terms-invalid');
  }

  if (refunded) {
    status = 'expired';
    allowNewPremiumActions = false;
  } else if (dispute !== undefined) {
    status = 'disputed';
    allowNewPremiumActions = false;
  } else if (subscription.state === 'active') {
    status = 'active';
    allowNewPremiumActions = true;
  } else if (subscription.state === 'past-due' && subscription.paymentFailedAt !== undefined) {
    graceEndsAt = new Date(
      parseTime(subscription.paymentFailedAt) + SUBSCRIPTION_GRACE_PERIOD_MS,
    ).toISOString();
    const inGrace = retrieved < parseTime(graceEndsAt);
    status = inGrace ? 'grace' : 'expired';
    allowNewPremiumActions = inGrace;
  } else if (
    subscription.state === 'canceled' &&
    subscription.cancelAtPeriodEnd &&
    retrieved < periodEnd
  ) {
    status = 'active';
    allowNewPremiumActions = true;
  } else {
    status = subscription.state === 'canceled' ? 'canceled' : 'expired';
    allowNewPremiumActions = false;
  }

  return {
    ...cleanBase,
    accountId,
    subscriptionId: subscription.providerSubscriptionId,
    providerCustomerId,
    plan: subscription.plan,
    status,
    currency: subscription.currency,
    cadence: subscription.cadence,
    paymentMethod: subscription.paymentMethod,
    priceMinor: subscription.priceMinor,
    currentPeriodStart: subscription.currentPeriodStart,
    currentPeriodEnd: subscription.currentPeriodEnd,
    ...(subscription.firstPaymentAt === undefined
      ? {}
      : { firstPaymentAt: subscription.firstPaymentAt }),
    ...(graceEndsAt === undefined ? {} : { graceEndsAt }),
    cancelAtPeriodEnd: subscription.cancelAtPeriodEnd,
    checkoutStatus: 'reconciled',
    ...(dispute?.disputeOpenedAt === undefined ? {} : { disputeOpenedAt: dispute.disputeOpenedAt }),
    capabilities: {
      newPremiumActions: allowNewPremiumActions,
      safetyHistoryRestoration: true,
    },
  };
};

const reconciliationFingerprint = (
  state: SubscriptionState,
  reconciliation: ProviderReconciliation,
): string =>
  JSON.stringify({
    state: subscriptionAuthorityFingerprint(state),
    invoices: reconciliation.invoices.map((invoice) => ({
      providerInvoiceId: invoice.providerInvoiceId,
      state: invoice.state,
      currency: invoice.currency,
      amountDueMinor: invoice.amountDueMinor,
      amountPaidMinor: invoice.amountPaidMinor,
      issuedAt: invoice.issuedAt,
      paidAt: invoice.paidAt,
      refundedAt: invoice.refundedAt,
      disputeOpenedAt: invoice.disputeOpenedAt,
      disputeResolvedAt: invoice.disputeResolvedAt,
    })),
  });

const invoiceState = (invoice: ProviderInvoiceReconciliation): CommerceInvoiceRecord['state'] => {
  if (invoice.refundedAt !== undefined) return 'refunded';
  if (invoice.disputeOpenedAt !== undefined && invoice.disputeResolvedAt === undefined) {
    return 'disputed';
  }
  return invoice.state;
};

export const reconcileCommerce = async (
  dependencies: ReconcileCommerceDependencies,
  input: ReconcileCommerceInput,
): Promise<ReconcileCommerceResult> => {
  const claimed = await dependencies.repository.claimProviderEvent(input.providerEvent);
  if (claimed === 'duplicate') return { ok: true, outcome: 'duplicate' };

  let providerResult: Awaited<ReturnType<CommerceProviderPort['retrieveCurrentState']>>;
  try {
    providerResult = await dependencies.provider.retrieveCurrentState({
      providerEvent: input.providerEvent,
    });
  } catch {
    await dependencies.repository.markProviderEventRetryable(
      input.providerEvent.providerEventId,
      'provider-retrieval-failed',
    );
    return { ok: false, code: 'PROVIDER_UNAVAILABLE', retryable: true };
  }
  if (!providerResult.ok) {
    await dependencies.repository.markProviderEventRetryable(
      input.providerEvent.providerEventId,
      'provider-retrieval-failed',
    );
    return {
      ok: false,
      code: 'PROVIDER_UNAVAILABLE',
      retryable: providerResult.retryable,
    };
  }

  const reconciliation = providerResult.value;
  const subscription = reconciliation.subscription;
  if (subscription === undefined) {
    await dependencies.repository.markProviderEventRetryable(
      input.providerEvent.providerEventId,
      'provider-subscription-missing',
    );
    return { ok: false, code: 'RECONCILIATION_FAILED', retryable: true };
  }

  try {
    return await dependencies.repository.transaction(
      reconciliation.providerCustomerId,
      async (transaction) => {
        const accountId = await transaction.resolveAccountId(reconciliation.providerCustomerId);
        if (accountId === null) {
          throw new Error('provider-customer-account-not-found');
        }
        const current = await transaction.lockSubscription(
          reconciliation.providerCustomerId,
          subscription.providerSubscriptionId,
        );
        const providerState = stateFromProvider(
          accountId,
          reconciliation.providerCustomerId,
          current,
          subscription,
          reconciliation.invoices,
          reconciliation.retrievedAt,
        );
        const fingerprint = reconciliationFingerprint(providerState, reconciliation);
        if (current?.reconciliationFingerprint === fingerprint) {
          await transaction.markProviderEventProcessed(
            input.providerEvent.providerEventId,
            current.version,
          );
          return { ok: true, outcome: 'converged', aggregateVersion: current.version } as const;
        }

        const aggregateVersion = (current?.version ?? 0n) + 1n;
        const record: CommerceSubscriptionRecord = {
          ...providerState,
          providerCustomerId: reconciliation.providerCustomerId,
          providerSubscriptionId: subscription.providerSubscriptionId,
          version: aggregateVersion,
          reconciliationFingerprint: fingerprint,
        };
        await transaction.saveSubscription(record);
        for (const invoice of reconciliation.invoices) {
          await transaction.upsertInvoice({
            invoiceId: invoice.providerInvoiceId,
            providerInvoiceId: invoice.providerInvoiceId,
            accountId,
            subscriptionId: subscription.providerSubscriptionId,
            state: invoiceState(invoice),
            currency: invoice.currency,
            amountDueMinor: invoice.amountDueMinor,
            amountPaidMinor: invoice.amountPaidMinor,
            issuedAt: invoice.issuedAt ?? reconciliation.retrievedAt,
            ...(invoice.paidAt === undefined ? {} : { settledAt: invoice.paidAt }),
            version: aggregateVersion,
          });
        }
        await transaction.saveEntitlement({
          entitlementId: `premium:${subscription.providerSubscriptionId}`,
          accountId,
          subscriptionId: subscription.providerSubscriptionId,
          status:
            record.status === 'active' ? 'active' : record.status === 'grace' ? 'grace' : 'expired',
          allowNewPremiumActions: record.capabilities.newPremiumActions,
          safetyHistoryRestoration: true,
          validFrom: record.currentPeriodStart ?? reconciliation.retrievedAt,
          ...(record.currentPeriodEnd === undefined ? {} : { validUntil: record.currentPeriodEnd }),
          version: aggregateVersion,
        });
        await transaction.appendAudit({
          auditReference: dependencies.ids.next(),
          accountId,
          eventType: 'commerce.reconciled',
          aggregateVersion,
          providerEventId: input.providerEvent.providerEventId,
          occurredAt: dependencies.clock.now().toISOString(),
        });
        await transaction.enqueueOutbox({
          jobId: dependencies.ids.next(),
          topic: 'commerce.lifecycle-notification',
          accountId,
          subscriptionId: subscription.providerSubscriptionId,
          aggregateVersion,
          notices: noticesFor(record),
          availableAt: dependencies.clock.now().toISOString(),
        });
        await transaction.markProviderEventProcessed(
          input.providerEvent.providerEventId,
          aggregateVersion,
        );
        return { ok: true, outcome: 'applied', aggregateVersion } as const;
      },
    );
  } catch {
    await dependencies.repository.markProviderEventRetryable(
      input.providerEvent.providerEventId,
      'reconciliation-transaction-failed',
    );
    return { ok: false, code: 'RECONCILIATION_FAILED', retryable: true };
  }
};
