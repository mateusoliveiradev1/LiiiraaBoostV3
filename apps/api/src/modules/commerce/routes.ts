import type { CommerceCommandJson, ProviderEventJson } from '@liiiraa/contracts-ts';
import { controlPlaneDocumentValidator } from '@liiiraa/contracts-ts/runtime-control-plane-validator';
import {
  manageSubscription,
  reconcileCommerce,
  type ManageSubscriptionAction,
  type ManageSubscriptionDependencies,
  type ReconcileCommerceDependencies,
  type SubscriptionState,
} from '@liiiraa/control-plane-application/runtime-control-plane';
import type { FastifyInstance, FastifyReply, FastifyRequest } from 'fastify';

export interface CommerceRouteDependencies {
  readonly management: ManageSubscriptionDependencies;
  readonly reconciliation: ReconcileCommerceDependencies;
  readonly resolveSessionActor: (
    request: FastifyRequest,
  ) => Promise<Readonly<{ accountId: string }> | null>;
  readonly projectSubscription: (accountId: string) => Promise<SubscriptionState>;
  readonly listInvoices: (accountId: string) => Promise<readonly unknown[]>;
  readonly admitSignedWebhook: (request: FastifyRequest) => Promise<ProviderEventJson | null>;
  readonly createBillingPortal?: (
    accountId: string,
  ) => Promise<Readonly<{ ok: true; portalUrl: string }> | Readonly<{ ok: false }>>;
}

interface CommerceMutationBody {
  readonly command: CommerceCommandJson;
  readonly selection?: Extract<ManageSubscriptionAction, { kind: 'start-checkout' }>['selection'];
  readonly successUrl?: string;
  readonly cancelUrl?: string;
  readonly checkoutReference?: string;
  readonly targetCadence?: 'monthly' | 'annual';
  readonly refundReason?: Extract<ManageSubscriptionAction, { kind: 'refund' }>['reason'];
}

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null && !Array.isArray(value);

const commerceBody = (value: unknown): CommerceMutationBody | null => {
  if (!isRecord(value) || !controlPlaneDocumentValidator(value['command'])) return null;
  const command = value['command'];
  if (!isRecord(command) || command.kind !== 'commerce-command') return null;
  return value as unknown as CommerceMutationBody;
};

const ownerContext = async (request: FastifyRequest, dependencies: CommerceRouteDependencies) => {
  const actor = await dependencies.resolveSessionActor(request);
  const body = commerceBody(request.body);
  if (body === null || actor?.accountId !== body.command.accountId) return null;
  return { actor, body };
};

const sendManagement = async (
  reply: FastifyReply,
  dependencies: CommerceRouteDependencies,
  body: CommerceMutationBody,
  action: ManageSubscriptionAction,
) => {
  const result = await manageSubscription(dependencies.management, {
    command: body.command,
    action,
  });
  if (result.ok)
    return reply.code(result.outcome === 'pending-reconciliation' ? 202 : 200).send(result);
  const status =
    result.code === 'STALE' ? 409 : result.code === 'SUBSCRIPTION_NOT_FOUND' ? 404 : 422;
  return reply.code(status).send(result);
};

export const registerCommerceRoutes = async (
  app: FastifyInstance,
  dependencies: CommerceRouteDependencies,
): Promise<void> => {
  app.get('/v1/commerce/subscription', async (request, reply) => {
    const actor = await dependencies.resolveSessionActor(request);
    if (actor === null) return reply.code(401).send({ code: 'UNAUTHORIZED' });
    return reply.code(200).send(await dependencies.projectSubscription(actor.accountId));
  });

  app.get('/v1/commerce/invoices', async (request, reply) => {
    const actor = await dependencies.resolveSessionActor(request);
    if (actor === null) return reply.code(401).send({ code: 'UNAUTHORIZED' });
    return reply.code(200).send(await dependencies.listInvoices(actor.accountId));
  });

  app.post('/v1/commerce/portal', async (request, reply) => {
    const actor = await dependencies.resolveSessionActor(request);
    if (actor === null) return reply.code(401).send({ code: 'UNAUTHORIZED' });
    if (dependencies.createBillingPortal === undefined) {
      return reply.code(503).send({ code: 'PROVIDER_UNAVAILABLE' });
    }
    const portal = await dependencies.createBillingPortal(actor.accountId);
    return portal.ok
      ? reply.code(200).send({ url: portal.portalUrl })
      : reply.code(503).send({ code: 'PROVIDER_UNAVAILABLE' });
  });

  app.post('/v1/commerce/checkout', async (request, reply) => {
    const context = await ownerContext(request, dependencies);
    if (
      context?.body.command.action !== 'start-checkout' ||
      context.body.selection === undefined ||
      context.body.successUrl === undefined ||
      context.body.cancelUrl === undefined
    ) {
      return reply.code(400).send({ code: 'INVALID_REQUEST' });
    }
    return sendManagement(reply, dependencies, context.body, {
      kind: 'start-checkout',
      selection: context.body.selection,
      successUrl: context.body.successUrl,
      cancelUrl: context.body.cancelUrl,
    });
  });

  app.post('/v1/commerce/checkout/status', async (request, reply) => {
    const context = await ownerContext(request, dependencies);
    if (context?.body.checkoutReference === undefined) {
      return reply.code(400).send({ code: 'INVALID_REQUEST' });
    }
    return sendManagement(reply, dependencies, context.body, {
      kind: 'checkout-returned',
      checkoutReference: context.body.checkoutReference,
    });
  });

  app.post('/v1/commerce/subscription/change', async (request, reply) => {
    const context = await ownerContext(request, dependencies);
    if (context?.body.targetCadence === undefined) {
      return reply.code(400).send({ code: 'INVALID_REQUEST' });
    }
    return sendManagement(reply, dependencies, context.body, {
      kind: 'change-cadence',
      targetCadence: context.body.targetCadence,
    });
  });

  app.post('/v1/commerce/subscription/cancel', async (request, reply) => {
    const context = await ownerContext(request, dependencies);
    if (context?.body.command.action !== 'cancel-subscription') {
      return reply.code(400).send({ code: 'INVALID_REQUEST' });
    }
    return sendManagement(reply, dependencies, context.body, { kind: 'cancel' });
  });

  app.post('/v1/commerce/subscription/undo-cancel', async (request, reply) => {
    const context = await ownerContext(request, dependencies);
    if (!context) return reply.code(400).send({ code: 'INVALID_REQUEST' });
    return sendManagement(reply, dependencies, context.body, { kind: 'undo-cancel' });
  });

  app.post('/v1/commerce/refunds', async (request, reply) => {
    const context = await ownerContext(request, dependencies);
    if (context?.body.refundReason === undefined) {
      return reply.code(400).send({ code: 'INVALID_REQUEST' });
    }
    return sendManagement(reply, dependencies, context.body, {
      kind: 'refund',
      reason: context.body.refundReason,
    });
  });

  await app.register(async (webhook) => {
    webhook.removeContentTypeParser('application/json');
    webhook.addContentTypeParser(
      'application/json',
      { parseAs: 'buffer' },
      (_request, body, done) => done(null, body),
    );
    webhook.post('/v1/commerce/provider-webhook', async (request, reply) => {
      const providerEvent = await dependencies.admitSignedWebhook(request);
      if (providerEvent === null) return reply.code(400).send({ code: 'SIGNATURE_REJECTED' });
      const result = await reconcileCommerce(dependencies.reconciliation, { providerEvent });
      return reply.code(result.ok ? 202 : result.retryable ? 503 : 422).send(result);
    });
  });
};
