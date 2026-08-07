import { createHmac, timingSafeEqual } from 'node:crypto';

import type {
  AdminGovernanceCapability,
  AdminGovernanceDependencies,
  AdminGovernanceStepUpEvidence,
} from '@liiiraa/control-plane-application';
import {
  activateAdminMembership,
  createAdminDelegation,
  offboardAdminIdentity,
  reviewAdminAccess,
  simulateAdminFunction,
  switchAdminFunction,
} from '@liiiraa/control-plane-application/admin-governance';
import { controlPlaneDocumentValidator } from '@liiiraa/contracts-ts/runtime-control-plane-validator';
import type { AdminCapability, AdminDataScope, AdminFunction } from '@liiiraa/control-plane-domain';
import type { FastifyInstance, FastifyReply, FastifyRequest } from 'fastify';

export interface AdminGovernanceRouteSession {
  readonly sessionId: string;
  readonly actorId: string;
  readonly activeFunction: AdminFunction;
  readonly navigation: readonly string[];
  readonly dataScopes: readonly AdminDataScope[];
  readonly capabilities: readonly AdminCapability[];
  readonly governanceCapabilities: readonly AdminGovernanceCapability[];
  readonly governanceScopes: readonly ('team' | 'delegations' | 'reviews' | 'history')[];
  readonly simulation: boolean;
  readonly version: bigint;
}

export interface AdminGovernanceQueryPort {
  listTeam(
    input: Readonly<{ limit: number; cursor?: string }>,
  ): Promise<
    Readonly<{ records: readonly Readonly<Record<string, unknown>>[]; nextCursor: string | null }>
  >;
  loadTeamMember(identityId: string): Promise<Readonly<Record<string, unknown>> | null>;
  history(identityId: string): Promise<readonly Readonly<Record<string, unknown>>[]>;
}

export interface AdminGovernanceRouteOperations {
  readonly activate: typeof activateAdminMembership;
  readonly switchFunction: typeof switchAdminFunction;
  readonly delegate: typeof createAdminDelegation;
  readonly offboard: typeof offboardAdminIdentity;
  readonly review: typeof reviewAdminAccess;
  readonly simulate: typeof simulateAdminFunction;
}

export interface AdminGovernanceRouteDependencies {
  readonly allowedOrigin: string;
  readonly csrfSecret: string;
  readonly governance: AdminGovernanceDependencies;
  readonly operations?: AdminGovernanceRouteOperations;
  readonly queries: AdminGovernanceQueryPort;
  readonly resolveSession: (request: FastifyRequest) => Promise<AdminGovernanceRouteSession | null>;
  readonly resolveStepUp: (
    request: FastifyRequest,
  ) => Promise<AdminGovernanceStepUpEvidence | null>;
  readonly rateLimit: (key: string) => Promise<boolean>;
}

const defaultOperations: AdminGovernanceRouteOperations = Object.freeze({
  activate: activateAdminMembership,
  switchFunction: switchAdminFunction,
  delegate: createAdminDelegation,
  offboard: offboardAdminIdentity,
  review: reviewAdminAccess,
  simulate: simulateAdminFunction,
});

const isRecord = (value: unknown): value is Readonly<Record<string, unknown>> =>
  typeof value === 'object' && value !== null && !Array.isArray(value);

const stringValue = (record: Readonly<Record<string, unknown>>, key: string): string =>
  typeof record[key] === 'string' ? record[key] : '';

const stringArray = (value: unknown): readonly string[] | null =>
  Array.isArray(value) && value.every((item: unknown) => typeof item === 'string') ? value : null;

const noStore = (reply: FastifyReply): FastifyReply =>
  reply.header('cache-control', 'no-store, private');

const hidden = (reply: FastifyReply, collection = false) =>
  noStore(reply)
    .code(404)
    .send(collection ? { records: [] } : { code: 'NOT_FOUND' });

const verifyCsrf = (secret: string, candidate: unknown): boolean => {
  if (typeof candidate !== 'string' || candidate.length > 256) return false;
  const [nonce, signature, extra] = candidate.split('.');
  if (!nonce || !signature || extra !== undefined) return false;
  const expected = Buffer.from(createHmac('sha256', secret).update(nonce).digest('base64url'));
  const actual = Buffer.from(signature);
  return expected.length === actual.length && timingSafeEqual(expected, actual);
};

const authorize = async (
  request: FastifyRequest,
  dependencies: AdminGovernanceRouteDependencies,
  capability: AdminGovernanceCapability,
  scope: AdminGovernanceRouteSession['governanceScopes'][number],
  mutation: boolean,
): Promise<AdminGovernanceRouteSession | null> => {
  if (
    request.headers.origin !== dependencies.allowedOrigin ||
    (mutation && !verifyCsrf(dependencies.csrfSecret, request.headers['x-csrf-token']))
  ) {
    return null;
  }
  const session = await dependencies.resolveSession(request);
  if (
    session === null ||
    (mutation && session.simulation) ||
    !session.governanceCapabilities.includes(capability) ||
    !session.governanceScopes.includes(scope)
  ) {
    return null;
  }
  return session;
};

interface GovernanceCommand {
  readonly commandId: string;
  readonly reason: string;
  readonly expectedVersion: bigint;
  readonly targetReferences: readonly string[];
  readonly approvalReferences: readonly string[];
}

const governanceCommand = (
  value: unknown,
  session: AdminGovernanceRouteSession,
  target?: string,
): GovernanceCommand | null => {
  if (!controlPlaneDocumentValidator(value) || !isRecord(value)) return null;
  const targets = stringArray(value.targetReferences);
  const approvals = stringArray(value.approvalReferences);
  const expected = value.expectedVersion;
  if (
    value.kind !== 'admin-operation-command' ||
    value.actorId !== session.actorId ||
    value.activeFunction !== session.activeFunction ||
    value.action !== 'update-access' ||
    targets === null ||
    approvals === null ||
    (target !== undefined && !targets.includes(target)) ||
    typeof expected !== 'string' ||
    !/^(?:0|[1-9][0-9]{0,18})$/u.test(expected)
  ) {
    return null;
  }
  return {
    commandId: stringValue(value, 'commandId'),
    reason: stringValue(value, 'reason'),
    expectedVersion: BigInt(expected),
    targetReferences: targets,
    approvalReferences: approvals,
  };
};

const publicMember = (record: Readonly<Record<string, unknown>>) => ({
  identityReference: record['identityReference'],
  displayName: record['displayName'],
  status: record['status'],
  functions: record['functions'],
  version: typeof record['version'] === 'bigint' ? record['version'].toString() : record['version'],
});

const publicHistory = (record: Readonly<Record<string, unknown>>) => ({
  kind: record['kind'],
  at: record['at'],
  ...(record['outcome'] === undefined ? {} : { outcome: record['outcome'] }),
});

const publicResult = (result: Readonly<Record<string, unknown>>) => {
  if (result['ok'] !== true) {
    return {
      ok: false,
      code: typeof result['code'] === 'string' ? result['code'] : 'GOVERNANCE_UNAVAILABLE',
    };
  }
  const projectedSession = isRecord(result['session'])
    ? {
        sessionId: result['session']['sessionId'],
        activeFunction: result['session']['activeFunction'],
        navigation: result['session']['navigation'],
        dataScopes: result['session']['dataScopes'],
        capabilities: result['session']['capabilities'],
        simulation: result['session']['simulation'],
        version:
          typeof result['session']['version'] === 'bigint'
            ? result['session']['version'].toString()
            : result['session']['version'],
      }
    : undefined;
  return {
    ok: true,
    outcome: result['outcome'],
    ...(result['receiptId'] === undefined ? {} : { receiptId: result['receiptId'] }),
    ...(projectedSession === undefined ? {} : { session: projectedSession }),
    ...(result['canAuthorizeAction'] === false ? { canAuthorizeAction: false } : {}),
  };
};

const resultStatus = (result: Readonly<Record<string, unknown>>): number =>
  result['ok'] === true ? 200 : result['code'] === 'STALE' ? 409 : 403;

const listQuery = (query: unknown): Readonly<{ limit: number; cursor?: string }> | null => {
  if (!isRecord(query)) return { limit: 25 };
  const limitValue = typeof query['limit'] === 'string' ? query['limit'] : '25';
  if (!/^[0-9]{1,3}$/u.test(limitValue)) return null;
  const limit = Number(limitValue);
  const cursor = typeof query['cursor'] === 'string' ? query['cursor'] : undefined;
  if (limit < 1 || limit > 100 || (cursor !== undefined && cursor.length > 256)) return null;
  return { limit, ...(cursor === undefined ? {} : { cursor }) };
};

export const registerAdminGovernanceRoutes = (
  app: FastifyInstance,
  dependencies: AdminGovernanceRouteDependencies,
): Promise<void> => {
  if (dependencies.csrfSecret.length < 32) throw new Error('ADMIN_GOVERNANCE_CSRF_REJECTED');
  const operations = dependencies.operations ?? defaultOperations;

  app.get('/v1/admin/governance/team', async (request, reply) => {
    const session = await authorize(
      request,
      dependencies,
      'admin-membership:manage',
      'team',
      false,
    );
    if (session === null) return hidden(reply, true);
    const parsed = listQuery(request.query);
    if (parsed === null) return noStore(reply).code(400).send({ code: 'REQUEST_INVALID' });
    if (!(await dependencies.rateLimit(`${session.actorId}:governance-team:${request.ip}`))) {
      return noStore(reply).code(429).send({ code: 'RATE_LIMITED' });
    }
    const result = await dependencies.queries.listTeam(parsed);
    return noStore(reply)
      .code(200)
      .send({ records: result.records.map(publicMember), nextCursor: result.nextCursor });
  });

  app.get<{ Params: { identityId: string } }>(
    '/v1/admin/governance/team/:identityId',
    async (request, reply) => {
      const session = await authorize(
        request,
        dependencies,
        'admin-membership:manage',
        'team',
        false,
      );
      if (session === null) return hidden(reply);
      const member = await dependencies.queries.loadTeamMember(request.params.identityId);
      return member === null ? hidden(reply) : noStore(reply).code(200).send(publicMember(member));
    },
  );

  app.get<{ Params: { identityId: string } }>(
    '/v1/admin/governance/team/:identityId/history',
    async (request, reply) => {
      const session = await authorize(
        request,
        dependencies,
        'admin-access:review',
        'history',
        false,
      );
      if (session === null) return hidden(reply);
      return noStore(reply)
        .code(200)
        .send({
          events: (await dependencies.queries.history(request.params.identityId)).map(
            publicHistory,
          ),
        });
    },
  );

  app.post('/v1/admin/governance/simulate', async (request, reply) => {
    const session = await authorize(
      request,
      dependencies,
      'admin-function:simulate',
      'team',
      false,
    );
    if (session === null || !isRecord(request.body)) return hidden(reply);
    const result = await operations.simulate(dependencies.governance, {
      actorId: session.actorId,
      identityId: stringValue(request.body, 'identityId'),
      targetFunction: stringValue(request.body, 'targetFunction'),
    });
    return noStore(reply).code(resultStatus(result)).send(publicResult(result));
  });

  app.post('/v1/admin/governance/functions/switch', async (request, reply) => {
    const session = await authorize(request, dependencies, 'admin-membership:manage', 'team', true);
    if (session === null || !isRecord(request.body)) return hidden(reply);
    const parsed = governanceCommand(request.body['command'], session, session.sessionId);
    if (parsed === null) return noStore(reply).code(400).send({ code: 'REQUEST_INVALID' });
    const stepUp = await dependencies.resolveStepUp(request);
    const authorizationContextId = stringValue(request.body, 'authorizationContextId');
    const result = await operations.switchFunction(dependencies.governance, {
      actorId: session.actorId,
      commandId: parsed.commandId,
      sessionId: session.sessionId,
      targetFunction: stringValue(request.body, 'targetFunction'),
      reason: parsed.reason,
      ...(authorizationContextId === '' ? {} : { authorizationContextId }),
      ...(stepUp === null ? {} : { stepUp }),
    });
    return noStore(reply).code(resultStatus(result)).send(publicResult(result));
  });

  app.post('/v1/admin/governance/offboard', async (request, reply) => {
    const session = await authorize(request, dependencies, 'admin-membership:manage', 'team', true);
    if (session === null || !isRecord(request.body)) return hidden(reply);
    const target = isRecord(request.body['command'])
      ? stringArray(request.body['command']['targetReferences'])?.[0]
      : undefined;
    const parsed = governanceCommand(request.body['command'], session, target);
    const stepUp = await dependencies.resolveStepUp(request);
    const authorizationContextId = stringValue(request.body, 'authorizationContextId');
    if (
      parsed === null ||
      target === undefined ||
      stepUp === null ||
      authorizationContextId === ''
    ) {
      return noStore(reply).code(400).send({ code: 'REQUEST_INVALID' });
    }
    const result = await operations.offboard(dependencies.governance, {
      actorId: session.actorId,
      commandId: parsed.commandId,
      identityId: target,
      expectedVersion: parsed.expectedVersion,
      reason: parsed.reason,
      compromise: request.body['compromise'] === true,
      authorizationContextId,
      stepUp,
    });
    return noStore(reply).code(resultStatus(result)).send(publicResult(result));
  });

  app.post('/v1/admin/governance/activate', async (request, reply) => {
    const session = await authorize(
      request,
      dependencies,
      'admin-membership:activate',
      'team',
      true,
    );
    if (session === null || !isRecord(request.body)) return hidden(reply);
    const target = stringValue(request.body, 'identityId');
    const parsed = governanceCommand(request.body['command'], session, target);
    const functions = stringArray(request.body['functions']);
    if (parsed === null || functions === null) {
      return noStore(reply).code(400).send({ code: 'REQUEST_INVALID' });
    }
    const result = await operations.activate(dependencies.governance, {
      actorId: session.actorId,
      commandId: parsed.commandId,
      identityId: target,
      membershipId: stringValue(request.body, 'membershipId'),
      administrativeInvitationKind: stringValue(request.body, 'administrativeInvitationKind'),
      invitationVerified: request.body['invitationVerified'] === true,
      emailVerified: request.body['emailVerified'] === true,
      strongFactor: stringValue(request.body, 'strongFactor'),
      sharedCredential: request.body['sharedCredential'] === true,
      functions,
    });
    return noStore(reply).code(resultStatus(result)).send(publicResult(result));
  });

  app.post('/v1/admin/governance/delegations', async (request, reply) => {
    const session = await authorize(
      request,
      dependencies,
      'admin-delegation:manage',
      'delegations',
      true,
    );
    if (session === null || !isRecord(request.body)) return hidden(reply);
    const delegationId = stringValue(request.body, 'delegationId');
    const parsed = governanceCommand(request.body['command'], session, delegationId);
    const capabilities = stringArray(request.body['capabilities']);
    const scopes = stringArray(request.body['scopes']);
    const stepUp = await dependencies.resolveStepUp(request);
    if (parsed === null || capabilities === null || scopes === null) {
      return noStore(reply).code(400).send({ code: 'REQUEST_INVALID' });
    }
    const authorizationContextId = stringValue(request.body, 'authorizationContextId');
    const result = await operations.delegate(dependencies.governance, {
      actorId: session.actorId,
      commandId: parsed.commandId,
      delegationId,
      delegateId: stringValue(request.body, 'delegateId'),
      capabilities,
      scopes,
      purpose: parsed.reason,
      risk: stringValue(request.body, 'risk') as
        'routine' | 'sensitive' | 'critical' | 'irreversible',
      expiresAt: stringValue(request.body, 'expiresAt'),
      approvalRequestIds: parsed.approvalReferences,
      ...(authorizationContextId === '' ? {} : { authorizationContextId }),
      ...(stepUp === null ? {} : { stepUp }),
    });
    return noStore(reply).code(resultStatus(result)).send(publicResult(result));
  });

  app.post('/v1/admin/governance/reviews', async (request, reply) => {
    const session = await authorize(request, dependencies, 'admin-access:review', 'reviews', true);
    if (session === null || !isRecord(request.body)) return hidden(reply);
    const target = stringValue(request.body, 'identityId');
    const parsed = governanceCommand(request.body['command'], session, target);
    if (parsed === null) return noStore(reply).code(400).send({ code: 'REQUEST_INVALID' });
    const result = await operations.review(dependencies.governance, {
      actorId: session.actorId,
      commandId: parsed.commandId,
      identityId: target,
      accessClass: stringValue(request.body, 'accessClass') as 'critical' | 'read-only' | 'other',
      lastReviewedAt: stringValue(request.body, 'lastReviewedAt'),
      lastActiveAt: stringValue(request.body, 'lastActiveAt'),
      deviationDetected: request.body['deviationDetected'] === true,
      retainAccess: request.body['retainAccess'] === true,
      reason: parsed.reason,
    });
    return noStore(reply).code(resultStatus(result)).send(publicResult(result));
  });

  return Promise.resolve();
};
