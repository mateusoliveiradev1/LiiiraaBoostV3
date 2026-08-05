import {
  issueOfflineEntitlement,
  revokeOfflineEntitlement,
  type OfflineEntitlementCommandResult,
  type OfflineEntitlementDependencies,
} from '@liiiraa/control-plane-application';
import type { FastifyInstance, FastifyReply, FastifyRequest } from 'fastify';

export interface EntitlementVersionProjection {
  readonly accountId: string;
  readonly entitlementVersion: string;
  readonly deviceVersion: string;
  readonly revoked: boolean;
}

export interface EntitlementRouteDependencies {
  readonly authority: OfflineEntitlementDependencies;
  readonly resolveSessionActor: (
    request: FastifyRequest,
  ) => Promise<Readonly<{ accountId: string }> | null>;
  readonly projectVersion: (accountId: string) => Promise<EntitlementVersionProjection | null>;
}

interface EntitlementBody {
  readonly commandId: string;
  readonly accountId: string;
  readonly deviceBinding: string;
  readonly audience?: string;
  readonly expectedEntitlementVersion: string;
  readonly expectedDeviceVersion: string;
  readonly correlationId: string;
  readonly reason?: 'customer-request' | 'security' | 'commerce';
}

const isRecord = (value: unknown): value is Readonly<Record<string, unknown>> =>
  typeof value === 'object' && value !== null && !Array.isArray(value);

const stringValue = (value: Readonly<Record<string, unknown>>, key: string): string | undefined => {
  const candidate = value[key];
  return typeof candidate === 'string' && candidate.length > 0 ? candidate : undefined;
};

const bodyValue = (value: unknown): EntitlementBody | null => {
  if (!isRecord(value)) return null;
  const commandId = stringValue(value, 'commandId');
  const accountId = stringValue(value, 'accountId');
  const deviceBinding = stringValue(value, 'deviceBinding');
  const expectedEntitlementVersion = stringValue(value, 'expectedEntitlementVersion');
  const expectedDeviceVersion = stringValue(value, 'expectedDeviceVersion');
  const correlationId = stringValue(value, 'correlationId');
  if (
    commandId === undefined ||
    accountId === undefined ||
    deviceBinding === undefined ||
    expectedEntitlementVersion === undefined ||
    expectedDeviceVersion === undefined ||
    correlationId === undefined
  ) {
    return null;
  }
  const audience = stringValue(value, 'audience');
  const reason = stringValue(value, 'reason');
  if (
    reason !== undefined &&
    reason !== 'customer-request' &&
    reason !== 'security' &&
    reason !== 'commerce'
  ) {
    return null;
  }
  return {
    commandId,
    accountId,
    deviceBinding,
    expectedEntitlementVersion,
    expectedDeviceVersion,
    correlationId,
    ...(audience === undefined ? {} : { audience }),
    ...(reason === undefined ? {} : { reason }),
  };
};

const versionValue = (value: string): bigint | null =>
  /^(?:0|[1-9][0-9]*)$/u.test(value) ? BigInt(value) : null;

const sendResult = (reply: FastifyReply, result: OfflineEntitlementCommandResult) => {
  if (result.ok) {
    return result.outcome === 'revoked'
      ? reply.code(200).send(result)
      : reply.code(200).send(result.envelope);
  }
  const status =
    result.code === 'UNAUTHORIZED'
      ? 401
      : result.code === 'NOT_FOUND'
        ? 404
        : result.code === 'STALE'
          ? 409
          : result.code === 'SIGNING_UNAVAILABLE' || result.code === 'PERSISTENCE_FAILED'
            ? 503
            : 422;
  return reply.code(status).send(result);
};

const mutationContext = async (
  request: FastifyRequest,
  dependencies: EntitlementRouteDependencies,
) => {
  const actor = await dependencies.resolveSessionActor(request);
  if (actor === null) return { ok: false as const, status: 401 as const };
  const body = bodyValue(request.body);
  if (body === null) return { ok: false as const, status: 400 as const };
  const entitlementVersion = versionValue(body.expectedEntitlementVersion);
  const deviceVersion = versionValue(body.expectedDeviceVersion);
  if (entitlementVersion === null || deviceVersion === null) {
    return { ok: false as const, status: 400 as const };
  }
  return { ok: true as const, actor, body, entitlementVersion, deviceVersion };
};

export const registerEntitlementRoutes = async (
  app: FastifyInstance,
  dependencies: EntitlementRouteDependencies,
): Promise<void> => {
  const issue =
    (operation: 'issue' | 'renew') => async (request: FastifyRequest, reply: FastifyReply) => {
      const context = await mutationContext(request, dependencies);
      if (!context.ok || context.body.audience === undefined) {
        return reply.code(context.ok ? 400 : context.status).send({
          code: !context.ok && context.status === 401 ? 'UNAUTHORIZED' : 'INVALID_REQUEST',
        });
      }
      return sendResult(
        reply,
        await issueOfflineEntitlement(dependencies.authority, {
          operation,
          commandId: context.body.commandId,
          actorAccountId: context.actor.accountId,
          accountId: context.body.accountId,
          deviceBinding: context.body.deviceBinding,
          audience: context.body.audience,
          expectedEntitlementVersion: context.entitlementVersion,
          expectedDeviceVersion: context.deviceVersion,
          correlationId: context.body.correlationId,
        }),
      );
    };

  app.post('/v1/entitlements/offline/issue', issue('issue'));
  app.post('/v1/entitlements/offline/renew', issue('renew'));
  app.post('/v1/entitlements/offline/revoke', async (request, reply) => {
    const context = await mutationContext(request, dependencies);
    if (!context.ok || context.body.reason === undefined) {
      return reply.code(context.ok ? 400 : context.status).send({
        code: !context.ok && context.status === 401 ? 'UNAUTHORIZED' : 'INVALID_REQUEST',
      });
    }
    return sendResult(
      reply,
      await revokeOfflineEntitlement(dependencies.authority, {
        commandId: context.body.commandId,
        actorAccountId: context.actor.accountId,
        accountId: context.body.accountId,
        deviceBinding: context.body.deviceBinding,
        expectedEntitlementVersion: context.entitlementVersion,
        expectedDeviceVersion: context.deviceVersion,
        correlationId: context.body.correlationId,
        reason: context.body.reason,
      }),
    );
  });

  app.get('/v1/entitlements/offline/version', async (request, reply) => {
    const actor = await dependencies.resolveSessionActor(request);
    if (actor === null) return reply.code(401).send({ code: 'UNAUTHORIZED' });
    const projection = await dependencies.projectVersion(actor.accountId);
    return projection === null
      ? reply.code(404).send({ code: 'NOT_FOUND' })
      : reply.code(200).send(projection);
  });

  app.get('/v1/entitlements/offline/verification-keys', async (request, reply) => {
    const actor = await dependencies.resolveSessionActor(request);
    if (actor === null) return reply.code(401).send({ code: 'UNAUTHORIZED' });
    return reply.code(200).send(await dependencies.authority.signer.publicVerificationData());
  });
};
