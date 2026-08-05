import {
  controlPlaneDocumentValidator,
  type SessionCommandJson,
  type SessionProjectionJson,
} from '@liiiraa/contracts-ts';
import {
  authenticate,
  beginDesktopAuthorization,
  listSessions,
  revokeSession,
  type AuthenticationDependencies,
} from '@liiiraa/control-plane-application';
import type { FastifyInstance, FastifyRequest } from 'fastify';

export interface IdentityRouteDependencies {
  readonly authentication: AuthenticationDependencies;
  readonly allowedOrigin: string;
  readonly verifyCsrf: (request: FastifyRequest) => boolean;
  readonly resolveSessionActor: (
    request: FastifyRequest,
  ) => Promise<Readonly<{ accountId: string }> | null>;
}

const genericAuthenticationFailure = Object.freeze({
  code: 'AUTHENTICATION_FAILED',
  message: 'Authentication failed',
});

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null && !Array.isArray(value);

const stringValue = (record: Record<string, unknown>, key: string): string =>
  typeof record[key] === 'string' ? record[key] : '';

const origin = (request: FastifyRequest): string =>
  typeof request.headers.origin === 'string' ? request.headers.origin : '';

const correlationId = (request: FastifyRequest): string => {
  const header = request.headers['x-correlation-id'];
  return typeof header === 'string' && header.length > 0 ? header : 'identity-route';
};

const validProjection = (projection: SessionProjectionJson): boolean =>
  controlPlaneDocumentValidator(projection);

const sessionCommand = (input: unknown): SessionCommandJson | null => {
  if (!controlPlaneDocumentValidator(input)) return null;
  if (!isRecord(input) || input.kind !== 'session-command') return null;
  return input;
};

export const registerIdentityRoutes = (
  app: FastifyInstance,
  dependencies: IdentityRouteDependencies,
): Promise<void> => {
  app.post('/v1/identity/authenticate', async (request, reply) => {
    if (!isRecord(request.body)) return reply.code(401).send(genericAuthenticationFailure);
    const result = await authenticate(dependencies.authentication, {
      invitationCode: stringValue(request.body, 'invitationCode'),
      email: stringValue(request.body, 'email'),
      method: stringValue(request.body, 'method'),
      origin: origin(request),
      expectedOrigin: dependencies.allowedOrigin,
      csrfVerified: dependencies.verifyCsrf(request),
      sessionKind: 'web',
      correlationId: correlationId(request),
    });
    if (!result.ok) return reply.code(401).send(genericAuthenticationFailure);
    if (!validProjection(result.session)) {
      return reply.code(500).send({ code: 'INTERNAL', message: 'Request could not be completed' });
    }
    reply.header(
      'set-cookie',
      `__Host-liiiraa_session=${encodeURIComponent(result.credential)}; Path=/; HttpOnly; Secure; SameSite=Lax`,
    );
    return reply.code(201).send(result.session);
  });

  app.post('/v1/identity/desktop/authorizations', async (request, reply) => {
    if (!isRecord(request.body)) return reply.code(401).send(genericAuthenticationFailure);
    const result = await beginDesktopAuthorization(dependencies.authentication, {
      invitationCode: stringValue(request.body, 'invitationCode'),
      email: stringValue(request.body, 'email'),
      method: stringValue(request.body, 'method'),
      origin: origin(request),
      expectedOrigin: dependencies.allowedOrigin,
      csrfVerified: dependencies.verifyCsrf(request),
      issuer: stringValue(request.body, 'issuer'),
      redirectUri: stringValue(request.body, 'redirectUri'),
    });
    return result.ok
      ? reply.code(201).send(result.challenge)
      : reply.code(401).send(genericAuthenticationFailure);
  });

  app.post('/v1/identity/desktop/exchanges', async (request, reply) => {
    if (!isRecord(request.body)) return reply.code(401).send(genericAuthenticationFailure);
    const result = await authenticate(dependencies.authentication, {
      invitationCode: stringValue(request.body, 'invitationCode'),
      email: stringValue(request.body, 'email'),
      method: stringValue(request.body, 'method'),
      origin: origin(request),
      expectedOrigin: dependencies.allowedOrigin,
      csrfVerified: dependencies.verifyCsrf(request),
      sessionKind: 'desktop',
      correlationId: correlationId(request),
      challengeId: stringValue(request.body, 'challengeId'),
      authorizationCode: stringValue(request.body, 'authorizationCode'),
      state: stringValue(request.body, 'state'),
      issuer: stringValue(request.body, 'issuer'),
      redirectUri: stringValue(request.body, 'redirectUri'),
    });
    if (!result.ok) return reply.code(401).send(genericAuthenticationFailure);
    if (!validProjection(result.session)) {
      return reply.code(500).send({ code: 'INTERNAL', message: 'Request could not be completed' });
    }
    return reply.code(201).send({
      session: result.session,
      credentialCustody: {
        kind: 'windows-credential-manager',
        credential: result.credential,
        expiresAt: result.session.expiresAt,
      },
    });
  });

  app.get('/v1/identity/sessions', async (request, reply) => {
    const actor = await dependencies.resolveSessionActor(request);
    if (!actor) {
      return reply
        .code(401)
        .send({ code: 'AUTHENTICATION_REQUIRED', message: 'Authentication required' });
    }
    const result = await listSessions(dependencies.authentication, {
      accountId: actor.accountId,
      correlationId: correlationId(request),
    });
    if (!result.sessions.every(validProjection)) {
      return reply.code(500).send({ code: 'INTERNAL', message: 'Request could not be completed' });
    }
    return reply.code(200).send({ sessions: result.sessions });
  });

  app.post<{ Params: { sessionId: string } }>(
    '/v1/identity/sessions/:sessionId/revoke',
    async (request, reply) => {
      const actor = await dependencies.resolveSessionActor(request);
      const command = sessionCommand(request.body);
      if (!actor || !command) {
        return reply.code(401).send({ code: 'AUTHORIZATION_FAILED', message: 'Request denied' });
      }
      if (
        command.accountId !== actor.accountId ||
        command.sessionId !== request.params.sessionId ||
        command.action !== 'revoke'
      ) {
        return reply.code(401).send({ code: 'AUTHORIZATION_FAILED', message: 'Request denied' });
      }
      const result = await revokeSession(dependencies.authentication, command);
      if (!result.ok) {
        return reply.code(404).send({ code: 'SESSION_NOT_FOUND', message: 'Session not found' });
      }
      if (!validProjection(result.session)) {
        return reply
          .code(500)
          .send({ code: 'INTERNAL', message: 'Request could not be completed' });
      }
      return reply.code(200).send(result.session);
    },
  );
  return Promise.resolve();
};
