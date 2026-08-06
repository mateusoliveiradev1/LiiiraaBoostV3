import type { CommerceCommandJson } from '@liiiraa/contracts-ts';
import {
  decideSubscriptionTransition,
  initialSubscriptionState,
  validateCheckoutSelection,
  type BillingCadence,
  type CheckoutSelection,
  type RefundReason,
  type SubscriptionState,
  type SubscriptionTransition,
} from '@liiiraa/control-plane-domain/runtime-control-plane';

import type { CommerceProviderPort, CommerceProviderResult } from '../ports/commerce.js';

export type { SubscriptionState } from '@liiiraa/control-plane-domain/runtime-control-plane';

export type ManageSubscriptionAction =
  | Readonly<{
      kind: 'start-checkout';
      selection: CheckoutSelection;
      successUrl: string;
      cancelUrl: string;
    }>
  | Readonly<{ kind: 'checkout-returned'; checkoutReference: string }>
  | Readonly<{ kind: 'change-cadence'; targetCadence: BillingCadence }>
  | Readonly<{ kind: 'cancel' }>
  | Readonly<{ kind: 'undo-cancel' }>
  | Readonly<{ kind: 'refund'; reason: RefundReason }>;

export interface SubscriptionMutationProvider {
  changeCadence?(
    input: Readonly<{
      providerSubscriptionId: string;
      targetCadence: BillingCadence;
      creditMinor?: number;
      effectiveAt?: string;
      idempotencyKey: string;
    }>,
  ): Promise<CommerceProviderResult<Readonly<{ accepted: true }>>>;
  cancelSubscription?(
    input: Readonly<{
      providerSubscriptionId: string;
      idempotencyKey: string;
    }>,
  ): Promise<CommerceProviderResult<Readonly<{ accepted: true }>>>;
  undoCancellation?(
    input: Readonly<{
      providerSubscriptionId: string;
      idempotencyKey: string;
    }>,
  ): Promise<CommerceProviderResult<Readonly<{ accepted: true }>>>;
  requestRefund?(
    input: Readonly<{
      providerSubscriptionId: string;
      disposition: 'self-service-full';
      idempotencyKey: string;
    }>,
  ): Promise<CommerceProviderResult<Readonly<{ accepted: true }>>>;
}

export interface SubscriptionManagementTransaction {
  findCommandResult(commandId: string): Promise<ManageSubscriptionResult | null>;
  loadSubscription(accountId: string): Promise<SubscriptionState | null>;
  saveIntent(state: SubscriptionState): Promise<void>;
  appendAudit(
    input: Readonly<{
      accountId: string;
      commandId: string;
      action: string;
      occurredAt: string;
    }>,
  ): Promise<void>;
  enqueueOutbox(
    input: Readonly<{
      jobId: string;
      topic: 'commerce.command-notice' | 'commerce.refund-review';
      accountId: string;
      commandId: string;
      availableAt: string;
    }>,
  ): Promise<void>;
  rememberCommandResult(commandId: string, result: ManageSubscriptionResult): Promise<void>;
}

export interface SubscriptionManagementRepository {
  transaction<T>(
    accountId: string,
    operation: (transaction: SubscriptionManagementTransaction) => Promise<T>,
  ): Promise<T>;
}

export interface ManageSubscriptionDependencies {
  readonly provider: CommerceProviderPort & SubscriptionMutationProvider;
  readonly repository: SubscriptionManagementRepository;
  readonly clock: Readonly<{ now(): Date }>;
  readonly ids: Readonly<{ next(): string }>;
}

export interface ManageSubscriptionInput {
  readonly command: CommerceCommandJson;
  readonly action: ManageSubscriptionAction;
}

export type ManageSubscriptionResult =
  | Readonly<{
      ok: true;
      outcome: 'pending-reconciliation' | 'review-required' | 'free-selected';
      state: SubscriptionState;
      checkoutUrl?: string;
      transition?: SubscriptionTransition;
    }>
  | Readonly<{
      ok: false;
      code:
        | 'INVALID_SELECTION'
        | 'STALE'
        | 'SUBSCRIPTION_NOT_FOUND'
        | 'PROVIDER_UNAVAILABLE'
        | 'MUTATION_UNSUPPORTED';
      retryable: boolean;
    }>;

const providerFailure = (retryable = false): ManageSubscriptionResult => ({
  ok: false,
  code: 'PROVIDER_UNAVAILABLE',
  retryable,
});

export const manageSubscription = async (
  dependencies: ManageSubscriptionDependencies,
  input: ManageSubscriptionInput,
): Promise<ManageSubscriptionResult> =>
  dependencies.repository.transaction(input.command.accountId, async (transaction) => {
    const existing = await transaction.findCommandResult(input.command.commandId);
    if (existing !== null) return existing;
    const current =
      (await transaction.loadSubscription(input.command.accountId)) ??
      initialSubscriptionState(input.command.accountId);
    if (current.version !== BigInt(input.command.expectedVersion)) {
      return { ok: false, code: 'STALE', retryable: false };
    }
    const now = dependencies.clock.now().toISOString();
    let result: ManageSubscriptionResult;

    if (input.action.kind === 'start-checkout') {
      const selection = validateCheckoutSelection(input.action.selection);
      if (!selection.ok) return { ok: false, code: 'INVALID_SELECTION', retryable: false };
      if (input.action.selection.plan === 'free') {
        result = { ok: true, outcome: 'free-selected', state: current };
      } else {
        let checkout: Awaited<ReturnType<CommerceProviderPort['createCheckout']>>;
        try {
          checkout = await dependencies.provider.createCheckout({
            accountId: input.command.accountId,
            priceReference: `${input.action.selection.currency}:${input.action.selection.cadence}:${String(input.action.selection.priceMinor)}`,
            successUrl: input.action.successUrl,
            cancelUrl: input.action.cancelUrl,
            idempotencyKey: input.command.commandId,
          });
        } catch {
          return providerFailure(true);
        }
        if (!checkout.ok) return providerFailure(checkout.retryable);
        const transition = decideSubscriptionTransition(current, {
          kind: 'checkout-returned',
          checkoutReference: input.command.commandId,
          now,
        });
        await transaction.saveIntent(transition.state);
        result = {
          ok: true,
          outcome: 'pending-reconciliation',
          state: transition.state,
          checkoutUrl: checkout.value.checkoutUrl,
          transition,
        };
      }
    } else if (input.action.kind === 'checkout-returned') {
      const transition = decideSubscriptionTransition(current, {
        kind: 'checkout-returned',
        checkoutReference: input.action.checkoutReference,
        now,
      });
      await transaction.saveIntent(transition.state);
      result = { ok: true, outcome: 'pending-reconciliation', state: transition.state, transition };
    } else {
      if (current.subscriptionId === undefined) {
        return { ok: false, code: 'SUBSCRIPTION_NOT_FOUND', retryable: false };
      }
      const transition =
        input.action.kind === 'change-cadence'
          ? decideSubscriptionTransition(current, {
              kind: 'change-cadence',
              targetCadence: input.action.targetCadence,
              now,
            })
          : input.action.kind === 'cancel'
            ? decideSubscriptionTransition(current, { kind: 'cancel-requested', now })
            : input.action.kind === 'undo-cancel'
              ? decideSubscriptionTransition(current, { kind: 'cancel-undone', now })
              : decideSubscriptionTransition(current, {
                  kind: 'refund-requested',
                  reason: input.action.reason,
                  now,
                });

      if (transition.outcome === 'review-required') {
        await transaction.saveIntent(transition.state);
        await transaction.enqueueOutbox({
          jobId: dependencies.ids.next(),
          topic: 'commerce.refund-review',
          accountId: input.command.accountId,
          commandId: input.command.commandId,
          availableAt: now,
        });
        result = { ok: true, outcome: 'review-required', state: transition.state, transition };
      } else {
        const mutation =
          input.action.kind === 'change-cadence'
            ? dependencies.provider.changeCadence?.({
                providerSubscriptionId: current.subscriptionId,
                targetCadence: input.action.targetCadence,
                ...(transition.creditMinor === undefined
                  ? {}
                  : { creditMinor: transition.creditMinor }),
                ...(transition.effectiveAt === undefined
                  ? {}
                  : { effectiveAt: transition.effectiveAt }),
                idempotencyKey: input.command.commandId,
              })
            : input.action.kind === 'cancel'
              ? dependencies.provider.cancelSubscription?.({
                  providerSubscriptionId: current.subscriptionId,
                  idempotencyKey: input.command.commandId,
                })
              : input.action.kind === 'undo-cancel'
                ? dependencies.provider.undoCancellation?.({
                    providerSubscriptionId: current.subscriptionId,
                    idempotencyKey: input.command.commandId,
                  })
                : dependencies.provider.requestRefund?.({
                    providerSubscriptionId: current.subscriptionId,
                    disposition: 'self-service-full',
                    idempotencyKey: input.command.commandId,
                  });
        if (mutation === undefined) {
          return { ok: false, code: 'MUTATION_UNSUPPORTED', retryable: false };
        }
        let providerResult: Awaited<typeof mutation>;
        try {
          providerResult = await mutation;
        } catch {
          return providerFailure(true);
        }
        if (!providerResult.ok) return providerFailure(providerResult.retryable);
        await transaction.saveIntent(transition.state);
        result = {
          ok: true,
          outcome: 'pending-reconciliation',
          state: transition.state,
          transition,
        };
      }
    }

    await transaction.appendAudit({
      accountId: input.command.accountId,
      commandId: input.command.commandId,
      action: `commerce.${input.action.kind}`,
      occurredAt: now,
    });
    await transaction.enqueueOutbox({
      jobId: dependencies.ids.next(),
      topic: 'commerce.command-notice',
      accountId: input.command.accountId,
      commandId: input.command.commandId,
      availableAt: now,
    });
    await transaction.rememberCommandResult(input.command.commandId, result);
    return result;
  });
