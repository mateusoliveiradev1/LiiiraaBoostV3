import { createHash, randomUUID } from 'node:crypto';

import type { ProviderEventJson, ProviderEventTypeJson } from '@liiiraa/contracts-ts';
import type {
  CommerceProviderFailureCode,
  CommerceProviderPort,
  CommerceProviderResult,
  ProviderReconciliation,
} from '@liiiraa/control-plane-application';
import type Stripe from 'stripe';

import type { ControlPlaneMigrationDatabase } from '../postgres/database.ts';

const STRIPE_EVENT_TYPES = Object.freeze({
  'charge.dispute.created': 'invoice-updated',
  'charge.refunded': 'invoice-updated',
  'checkout.session.completed': 'checkout-completed',
  'customer.subscription.deleted': 'subscription-updated',
  'customer.subscription.updated': 'subscription-updated',
  'invoice.paid': 'invoice-updated',
  'invoice.payment_failed': 'invoice-updated',
} as const satisfies Readonly<Record<string, ProviderEventTypeJson>>);

export type StripeWebhookFailureCode = 'SIGNATURE_REJECTED' | 'UNSUPPORTED_EVENT';

export type StripeWebhookVerificationResult =
  | Readonly<{ ok: true; value: VerifiedStripeWebhook }>
  | Readonly<{
      ok: false;
      code: StripeWebhookFailureCode;
      retryable: false;
    }>;

export interface VerifiedStripeWebhook {
  readonly providerEvent: ProviderEventJson;
  readonly rawBody: Uint8Array;
}

export interface ProviderReconciliationReceipt {
  readonly outcome: 'duplicate' | 'processed';
  readonly providerEvent: ProviderEventJson;
  readonly reconciliation?: ProviderReconciliation;
}

interface StripeWebhookVerifier {
  readonly webhooks: Pick<Stripe['webhooks'], 'constructEventAsync'>;
}

const verificationFailure = (code: StripeWebhookFailureCode): StripeWebhookVerificationResult =>
  Object.freeze({ code, ok: false, retryable: false });

const providerFailure = (
  code: CommerceProviderFailureCode = 'PROVIDER_UNAVAILABLE',
): CommerceProviderResult<ProviderReconciliationReceipt> =>
  Object.freeze({ code, ok: false, retryable: true });

const aggregateReferenceFrom = (event: Stripe.Event): string | undefined => {
  const object = event.data.object as unknown as Record<string, unknown>;
  for (const candidate of [object['customer'], object['subscription'], object['id']]) {
    if (typeof candidate === 'string' && candidate.length > 0) return candidate;
  }
  return undefined;
};

export const verifyRawWebhook = async (input: {
  readonly rawBody: Uint8Array;
  readonly signatureHeader?: string;
  readonly webhookSecret: string;
  readonly stripe: StripeWebhookVerifier;
  readonly receivedAt?: Date;
  readonly toleranceSeconds?: number;
}): Promise<StripeWebhookVerificationResult> => {
  if (
    input.signatureHeader === undefined ||
    input.signatureHeader.length === 0 ||
    input.webhookSecret.length === 0
  ) {
    return verificationFailure('SIGNATURE_REJECTED');
  }

  const receivedAt = input.receivedAt ?? new Date();
  let stripeEvent: Stripe.Event;
  try {
    stripeEvent = await input.stripe.webhooks.constructEventAsync(
      input.rawBody,
      input.signatureHeader,
      input.webhookSecret,
      input.toleranceSeconds,
      undefined,
      Math.floor(receivedAt.getTime() / 1_000),
    );
  } catch {
    return verificationFailure('SIGNATURE_REJECTED');
  }

  const eventType = STRIPE_EVENT_TYPES[stripeEvent.type as keyof typeof STRIPE_EVENT_TYPES];
  if (eventType === undefined) return verificationFailure('UNSUPPORTED_EVENT');

  const rawBody = Uint8Array.from(input.rawBody);
  const aggregateReference = aggregateReferenceFrom(stripeEvent);
  const providerEvent: ProviderEventJson = Object.freeze({
    schemaVersion: '1.0',
    kind: 'provider-event',
    provider: 'commerce',
    providerEventId: stripeEvent.id,
    eventType,
    ...(aggregateReference === undefined ? {} : { aggregateReference }),
    payloadDigest: createHash('sha256').update(rawBody).digest('hex'),
    correlationId: stripeEvent.request?.id ?? stripeEvent.id,
    receivedAt: receivedAt.toISOString(),
  });

  return Object.freeze({
    ok: true,
    value: Object.freeze({ providerEvent, rawBody }),
  });
};

const claimInboxEvent = async (
  database: ControlPlaneMigrationDatabase,
  verifiedEvent: VerifiedStripeWebhook,
): Promise<boolean> =>
  database.transaction(async (transaction) => {
    const { providerEvent } = verifiedEvent;
    await transaction.query(
      `INSERT INTO provider_inbox
         (id, provider, provider_event_id, event_type, payload_digest, received_at, processing_state)
       VALUES ($1, 'stripe', $2, $3, $4, $5, 'received')
       ON CONFLICT (provider, provider_event_id) DO NOTHING
       RETURNING id`,
      [
        randomUUID(),
        providerEvent.providerEventId,
        providerEvent.eventType,
        providerEvent.payloadDigest,
        providerEvent.receivedAt,
      ],
    );

    const claimed = await transaction.query<{ processing_state: string }>(
      `UPDATE provider_inbox
       SET processing_state = 'processing', error_code = NULL
       WHERE provider = 'stripe'
         AND provider_event_id = $1
         AND processing_state IN ('received', 'retryable')
       RETURNING processing_state`,
      [providerEvent.providerEventId],
    );
    return claimed.rowCount === 1;
  });

const markInbox = async (
  database: ControlPlaneMigrationDatabase,
  providerEventId: string,
  state: 'processed' | 'retryable',
): Promise<void> => {
  if (state === 'processed') {
    await database.query(
      `UPDATE provider_inbox
       SET processing_state = 'processed', processed_at = CURRENT_TIMESTAMP, error_code = NULL
       WHERE provider = 'stripe' AND provider_event_id = $1`,
      [providerEventId],
    );
    return;
  }

  await database.query(
    `UPDATE provider_inbox
     SET processing_state = 'retryable', error_code = $2
     WHERE provider = 'stripe' AND provider_event_id = $1`,
    [providerEventId, 'provider-retrieval-failed'],
  );
};

export const reconcileProviderState = async (input: {
  readonly database: ControlPlaneMigrationDatabase;
  readonly provider: CommerceProviderPort;
  readonly verifiedEvent: VerifiedStripeWebhook;
}): Promise<CommerceProviderResult<ProviderReconciliationReceipt>> => {
  const claimed = await claimInboxEvent(input.database, input.verifiedEvent);
  if (!claimed) {
    return Object.freeze({
      ok: true,
      value: Object.freeze({
        outcome: 'duplicate',
        providerEvent: input.verifiedEvent.providerEvent,
      }),
    });
  }

  let reconciliation: Awaited<ReturnType<CommerceProviderPort['retrieveCurrentState']>>;
  try {
    reconciliation = await input.provider.retrieveCurrentState({
      providerEvent: input.verifiedEvent.providerEvent,
    });
  } catch {
    await markInbox(input.database, input.verifiedEvent.providerEvent.providerEventId, 'retryable');
    return providerFailure();
  }

  if (!reconciliation.ok) {
    await markInbox(input.database, input.verifiedEvent.providerEvent.providerEventId, 'retryable');
    return Object.freeze({
      code: reconciliation.code,
      ok: false,
      retryable: reconciliation.retryable,
    });
  }

  await markInbox(input.database, input.verifiedEvent.providerEvent.providerEventId, 'processed');
  return Object.freeze({
    ok: true,
    value: Object.freeze({
      outcome: 'processed',
      providerEvent: input.verifiedEvent.providerEvent,
      reconciliation: reconciliation.value,
    }),
  });
};
