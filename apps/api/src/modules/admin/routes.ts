import {
  controlPlaneDocumentValidator,
  type AdminCommandJson,
  type AdminRoleJson,
} from '@liiiraa/contracts-ts';
import {
  assumeAdminRole,
  ADMIN_ROLES,
  authorizeAdminProjection,
  executeAdminCommand,
  handoffAdminRole,
  projectBreakGlassMetadata,
  releaseAdminRole,
  type ActiveAdminRoleSession,
  type AdminCommandDependencies,
  type AdminProjectionResource,
  type AdminRoleAuthorityDependencies,
  type AdminStepUpEvidence,
} from '@liiiraa/control-plane-application';
import type { FastifyInstance, FastifyReply, FastifyRequest } from 'fastify';

export interface AdminRouteDependencies {
  readonly allowedOrigin: string;
  readonly resolveDeveloperActor: (
    request: FastifyRequest,
  ) => Promise<Readonly<{ actorId: string; nonProduction: boolean }> | null>;
  readonly resolveAdminSession: (request: FastifyRequest) => Promise<ActiveAdminRoleSession | null>;
  readonly resolveStepUp: (request: FastifyRequest) => Promise<AdminStepUpEvidence | null>;
  readonly roles: AdminRoleAuthorityDependencies;
  readonly commands: AdminCommandDependencies;
  readonly listProjection: (
    resource: AdminProjectionResource,
  ) => Promise<readonly Readonly<Record<string, unknown>>[]>;
  readonly loadProjection: (
    resource: AdminProjectionResource,
    id: string,
  ) => Promise<Readonly<Record<string, unknown>> | null>;
  readonly loadBreakGlassSource?: (
    targetReference: string,
  ) => Promise<Readonly<Record<string, unknown>> | null>;
  readonly alertBreakGlass?: (
    input: Readonly<{ actorId: string; reason: string; expiresAt: string }>,
  ) => Promise<boolean>;
  readonly appendBreakGlassAudit?: (event: Readonly<Record<string, unknown>>) => Promise<void>;
}

const COLLECTION_RESOURCE = Object.freeze({
  'support-cases': 'support-case',
  devices: 'device',
  entitlements: 'entitlement',
  sessions: 'session',
  'diagnostic-metadata': 'diagnostic-metadata',
  'audit-events': 'audit-event',
} as const satisfies Readonly<Record<string, AdminProjectionResource>>);

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null && !Array.isArray(value);

const stringValue = (record: Record<string, unknown>, key: string): string =>
  typeof record[key] === 'string' ? record[key] : '';

const isAdminOrigin = (request: FastifyRequest, allowedOrigin: string): boolean =>
  request.headers.origin === allowedOrigin;

const isRole = (value: unknown): value is AdminRoleJson =>
  typeof value === 'string' && ADMIN_ROLES.includes(value as AdminRoleJson);

const collectionResource = (request: FastifyRequest): AdminProjectionResource | null => {
  if (!isRecord(request.params)) return null;
  const collection = request.params['collection'];
  return typeof collection === 'string'
    ? (COLLECTION_RESOURCE[collection as keyof typeof COLLECTION_RESOURCE] ?? null)
    : null;
};

const noStore = (reply: FastifyReply): FastifyReply =>
  reply.header('Cache-Control', 'no-store, private');

const hideDeniedProjection = (reply: FastifyReply) =>
  noStore(reply).code(404).send({ records: [] });

const commandBody = (
  value: unknown,
): Readonly<{ command: AdminCommandJson; impactReviewed: boolean; confirmed: boolean }> | null => {
  if (!isRecord(value) || !controlPlaneDocumentValidator(value['command'])) return null;
  const command = value['command'];
  if (!isRecord(command) || command['kind'] !== 'admin-command') return null;
  return {
    command: command as unknown as AdminCommandJson,
    impactReviewed: value['impactReviewed'] === true,
    confirmed: value['confirmed'] === true,
  };
};

const roleMutation = async (
  request: FastifyRequest,
  reply: FastifyReply,
  dependencies: AdminRouteDependencies,
  handoff: boolean,
) => {
  if (!isAdminOrigin(request, dependencies.allowedOrigin) || !isRecord(request.body)) {
    return reply.code(404).send({ code: 'NOT_FOUND' });
  }
  const actor = await dependencies.resolveDeveloperActor(request);
  const role = request.body['role'];
  if (actor === null || !isRole(role)) return reply.code(403).send({ code: 'ROLE_INVALID' });
  const input = {
    actorId: actor.actorId,
    actorIsNonProduction: actor.nonProduction,
    role,
    reason: stringValue(request.body, 'reason'),
    premiumTestGrant: request.body['premiumTestGrant'] === true,
  };
  const result = handoff
    ? await handoffAdminRole(dependencies.roles, input)
    : await assumeAdminRole(dependencies.roles, input);
  if (!result.ok) return reply.code(403).send(result);
  return reply.code(handoff ? 200 : 201).send(result.session);
};

export const registerAdminRoutes = (
  app: FastifyInstance,
  dependencies: AdminRouteDependencies,
): Promise<void> => {
  app.get('/v1/admin/session', async (request, reply) => {
    if (!isAdminOrigin(request, dependencies.allowedOrigin)) {
      return noStore(reply).code(404).send({ code: 'NOT_FOUND' });
    }
    const session = await dependencies.resolveAdminSession(request);
    return session === null
      ? noStore(reply).code(401).send({ code: 'AUTHORIZATION_FAILED' })
      : noStore(reply).code(200).send({
          actorId: session.actorId,
          expiresAt: session.expiresAt,
          role: session.role,
        });
  });

  app.post('/v1/admin/roles/assume', (request, reply) =>
    roleMutation(request, reply, dependencies, false),
  );
  app.post('/v1/admin/roles/handoff', (request, reply) =>
    roleMutation(request, reply, dependencies, true),
  );
  app.post('/v1/admin/roles/release', async (request, reply) => {
    if (!isAdminOrigin(request, dependencies.allowedOrigin) || !isRecord(request.body)) {
      return reply.code(404).send({ code: 'NOT_FOUND' });
    }
    const actor = await dependencies.resolveDeveloperActor(request);
    if (actor === null) return reply.code(403).send({ code: 'AUTHORIZATION_FAILED' });
    const result = await releaseAdminRole(dependencies.roles, {
      actorId: actor.actorId,
      reason: stringValue(request.body, 'reason'),
    });
    return result.ok ? reply.code(204).send() : reply.code(403).send(result);
  });

  app.get<{ Params: { collection: string } }>('/v1/admin/:collection', async (request, reply) => {
    if (!isAdminOrigin(request, dependencies.allowedOrigin)) return hideDeniedProjection(reply);
    const session = await dependencies.resolveAdminSession(request);
    const resource = collectionResource(request);
    if (
      session === null ||
      resource === null ||
      !authorizeAdminProjection(
        session,
        { resource, action: 'list' },
        dependencies.roles.clock.now().toISOString(),
      ).allowed
    ) {
      return hideDeniedProjection(reply);
    }
    return noStore(reply)
      .code(200)
      .send({ records: await dependencies.listProjection(resource) });
  });

  app.get<{ Params: { collection: string; id: string } }>(
    '/v1/admin/:collection/:id',
    async (request, reply) => {
      if (!isAdminOrigin(request, dependencies.allowedOrigin)) return hideDeniedProjection(reply);
      const session = await dependencies.resolveAdminSession(request);
      const resource = collectionResource(request);
      if (
        session === null ||
        resource === null ||
        !authorizeAdminProjection(
          session,
          { resource, action: 'detail' },
          dependencies.roles.clock.now().toISOString(),
        ).allowed
      ) {
        return hideDeniedProjection(reply);
      }
      const projection = await dependencies.loadProjection(resource, request.params.id);
      return projection === null
        ? noStore(reply).code(404).send({ code: 'NOT_FOUND' })
        : noStore(reply).code(200).send(projection);
    },
  );

  app.post('/v1/admin/commands', async (request, reply) => {
    if (!isAdminOrigin(request, dependencies.allowedOrigin)) {
      return reply.code(404).send({ code: 'NOT_FOUND' });
    }
    const session = await dependencies.resolveAdminSession(request);
    const body = commandBody(request.body);
    const stepUp = await dependencies.resolveStepUp(request);
    if (session === null || body === null) {
      return reply.code(403).send({ ok: false, code: 'AUTHORIZATION_FAILED' });
    }
    const result = await executeAdminCommand(dependencies.commands, {
      session,
      command: body.command,
      impactReviewed: body.impactReviewed,
      confirmed: body.confirmed,
      ...(stepUp === null ? {} : { stepUp }),
    });
    if (result.ok) return reply.code(200).send(result);
    const status = result.code === 'NOT_FOUND' ? 404 : result.code === 'STALE' ? 409 : 403;
    return reply.code(status).send(result);
  });

  app.post('/v1/admin/break-glass/metadata', async (request, reply) => {
    if (
      !isAdminOrigin(request, dependencies.allowedOrigin) ||
      !isRecord(request.body) ||
      dependencies.loadBreakGlassSource === undefined ||
      dependencies.alertBreakGlass === undefined ||
      dependencies.appendBreakGlassAudit === undefined
    ) {
      return reply.code(404).send({ code: 'NOT_FOUND' });
    }
    const session = await dependencies.resolveAdminSession(request);
    const stepUp = await dependencies.resolveStepUp(request);
    if (session === null || stepUp === null) {
      return reply.code(403).send({ code: 'STEP_UP_REQUIRED' });
    }
    const reason = stringValue(request.body, 'reason');
    const expiresAt = stringValue(request.body, 'expiresAt');
    const targetReference = stringValue(request.body, 'targetReference');
    const now = dependencies.roles.clock.now().toISOString();
    const alerted = await dependencies.alertBreakGlass({
      actorId: session.actorId,
      reason,
      expiresAt,
    });
    const admission = projectBreakGlassMetadata({
      session,
      now,
      reason,
      expiresAt,
      alerted,
      stepUp,
      source: {},
    });
    if (!admission.allowed) return reply.code(403).send(admission);
    const source = await dependencies.loadBreakGlassSource(targetReference);
    if (source === null) return reply.code(404).send({ code: 'NOT_FOUND' });
    const projection = projectBreakGlassMetadata({
      session,
      now,
      reason,
      expiresAt,
      alerted,
      stepUp,
      source,
    });
    if (!projection.allowed) return reply.code(403).send(projection);
    await dependencies.appendBreakGlassAudit({
      actorId: session.actorId,
      assumedRole: session.role,
      action: 'admin.break-glass.metadata',
      redactedTarget: targetReference,
      reason,
      authorizationContextId: stepUp.authorizationContextId,
      expiresAt,
      occurredAt: now,
    });
    return reply.code(200).send(projection.metadata);
  });

  return Promise.resolve();
};
