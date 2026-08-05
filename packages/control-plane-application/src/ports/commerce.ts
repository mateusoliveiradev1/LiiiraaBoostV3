import type {
  InvoiceStateJson,
  ProviderEventJson,
  SubscriptionStateJson,
} from '@liiiraa/contracts-ts';

export type CommerceProviderFailureCode =
  'PROVIDER_UNAVAILABLE' | 'INVALID_PROVIDER_REFERENCE' | 'INVALID_MUTATION';

export type CommerceProviderResult<T> =
  | Readonly<{ ok: true; value: T }>
  | Readonly<{
      ok: false;
      code: CommerceProviderFailureCode;
      retryable: boolean;
    }>;

export interface ProviderMutationContext {
  readonly idempotencyKey: string;
}

export interface ProviderSubscriptionReconciliation {
  readonly providerSubscriptionId: string;
  readonly state: SubscriptionStateJson;
  readonly currentPeriodStart: string;
  readonly currentPeriodEnd: string;
  readonly cancelAtPeriodEnd: boolean;
}

export interface ProviderInvoiceReconciliation {
  readonly providerInvoiceId: string;
  readonly state: InvoiceStateJson;
  readonly currency: string;
  readonly amountDueMinor: number;
  readonly amountPaidMinor: number;
}

export interface ProviderReconciliation {
  readonly providerCustomerId: string;
  readonly retrievedAt: string;
  readonly subscription?: ProviderSubscriptionReconciliation;
  readonly invoices: readonly ProviderInvoiceReconciliation[];
}

export interface CommerceProviderPort {
  createCheckout(
    input: Readonly<{
      accountId: string;
      priceReference: string;
      successUrl: string;
      cancelUrl: string;
    }> &
      ProviderMutationContext,
  ): Promise<CommerceProviderResult<Readonly<{ checkoutUrl: string }>>>;

  retrieveCurrentState(input: {
    readonly providerEvent: ProviderEventJson;
  }): Promise<CommerceProviderResult<ProviderReconciliation>>;
}
