import type {
  RecoveryDependencies,
  SecurityMethodDependencies,
} from '@liiiraa/control-plane-application';
import type { FastifyInstance, FastifyReply, FastifyRequest } from 'fastify';

export interface SecurityRouteDependencies {
  readonly recovery: RecoveryDependencies;
  readonly securityMethods: SecurityMethodDependencies;
  readonly resolveSessionActor: (
    request: FastifyRequest,
  ) => Promise<Readonly<{ accountId: string; sessionId: string }> | null>;
}

export const registerSecurityRoutes = (
  app: FastifyInstance,
  _dependencies: SecurityRouteDependencies,
): Promise<void> => {
  const notImplemented = (_request: FastifyRequest, reply: FastifyReply) =>
    reply.code(501).send({ code: 'NOT_IMPLEMENTED' });
  app.post('/v1/identity/security-methods/enroll', notImplemented);
  app.post('/v1/identity/security-methods/:methodId/disable', notImplemented);
  app.post('/v1/identity/security/authorize', notImplemented);
  app.post('/v1/identity/recoveries', notImplemented);
  app.post('/v1/identity/recoveries/:accountId/review', notImplemented);
  app.post('/v1/identity/recoveries/:accountId/contest', notImplemented);
  app.post('/v1/identity/recoveries/:accountId/risk-extension', notImplemented);
  return Promise.resolve();
};
