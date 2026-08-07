import { createHmac, timingSafeEqual } from 'node:crypto';

import type { IdentityActor } from '@liiiraa/control-plane-adapters';
import type { FastifyInstance, FastifyReply, FastifyRequest } from 'fastify';

import type { StagingStrongAuth } from '../../staging/strong-auth.ts';

export interface StrongAuthRouteDependencies {
  readonly allowedOrigins: readonly string[];
  readonly authority: StagingStrongAuth;
  readonly csrfSecret: string;
  readonly resolveActor: (request: FastifyRequest) => Promise<IdentityActor | null>;
}

const isRecord = (value: unknown): value is Readonly<Record<string, unknown>> =>
  typeof value === 'object' && value !== null && !Array.isArray(value);
const text = (record: Readonly<Record<string, unknown>>, key: string): string =>
  typeof record[key] === 'string' ? record[key] : '';
const noStore = (reply: FastifyReply): FastifyReply =>
  reply.header('cache-control', 'no-store, private');

const csrfSignature = (secret: string, nonce: string): string =>
  createHmac('sha256', secret).update(nonce, 'utf8').digest('base64url');
const verifyCsrf = (secret: string, candidate: unknown): boolean => {
  if (typeof candidate !== 'string' || candidate.length > 256) return false;
  const [nonce, signature, extra] = candidate.split('.');
  if (!nonce || !signature || extra !== undefined) return false;
  const expected = Buffer.from(csrfSignature(secret, nonce), 'utf8');
  const actual = Buffer.from(signature, 'utf8');
  return expected.length === actual.length && timingSafeEqual(expected, actual);
};

export const registerStrongAuthRoutes = (
  app: FastifyInstance,
  dependencies: StrongAuthRouteDependencies,
): Promise<void> => {
  const origins = new Set(dependencies.allowedOrigins);
  const admittedMutation = (request: FastifyRequest): boolean =>
    typeof request.headers.origin === 'string' &&
    origins.has(request.headers.origin) &&
    verifyCsrf(dependencies.csrfSecret, request.headers['x-csrf-token']);

  app.get('/v1/identity/strong-auth/status', async (request, reply) => {
    const actor = await dependencies.resolveActor(request);
    return actor === null
      ? noStore(reply).code(401).send({ code: 'AUTHENTICATION_REQUIRED' })
      : noStore(reply).code(200).send(await dependencies.authority.status(actor));
  });

  app.post('/v1/identity/strong-auth/totp/enrollment', async (request, reply) => {
    const actor = await dependencies.resolveActor(request);
    if (actor === null || !admittedMutation(request))
      return noStore(reply).code(403).send({ code: 'REQUEST_DENIED' });
    return noStore(reply).code(201).send(dependencies.authority.beginTotpEnrollment(actor));
  });

  app.post('/v1/identity/strong-auth/totp/confirm', async (request, reply) => {
    const actor = await dependencies.resolveActor(request);
    if (actor === null || !admittedMutation(request) || !isRecord(request.body))
      return noStore(reply).code(403).send({ code: 'REQUEST_DENIED' });
    const result = await dependencies.authority.confirmTotpEnrollment(
      actor,
      text(request.body, 'enrollmentToken'),
      text(request.body, 'code'),
    );
    return result.ok
      ? noStore(reply).code(200).send(result)
      : noStore(reply).code(422).send(result);
  });

  app.post('/v1/identity/strong-auth/step-up', async (request, reply) => {
    const actor = await dependencies.resolveActor(request);
    if (actor === null || !admittedMutation(request) || !isRecord(request.body))
      return noStore(reply).code(403).send({ code: 'REQUEST_DENIED' });
    const result = await dependencies.authority.verifyTotpStepUp(actor, {
      action: text(request.body, 'action'),
      authorizationContextId: text(request.body, 'authorizationContextId'),
      code: text(request.body, 'code'),
      redactedTarget: text(request.body, 'redactedTarget'),
      resource: text(request.body, 'resource'),
    });
    return result.ok
      ? noStore(reply).code(200).send(result)
      : noStore(reply).code(422).send(result);
  });
  return Promise.resolve();
};
