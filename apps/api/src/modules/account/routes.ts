import { controlPlaneDocumentValidator, type AccountCommandJson } from '@liiiraa/contracts-ts';
import {
  projectAccount,
  updateAccount,
  type ProjectAccountDependencies,
  type UpdateAccountDependencies,
} from '@liiiraa/control-plane-application';
import type { FastifyInstance, FastifyReply, FastifyRequest } from 'fastify';

export interface AccountRouteDependencies {
  readonly projection: ProjectAccountDependencies;
  readonly mutation: UpdateAccountDependencies;
  readonly resolveSessionActor: (
    request: FastifyRequest,
  ) => Promise<Readonly<{ accountId: string }> | null>;
}

interface AccountMutationBody {
  readonly command: AccountCommandJson;
  readonly patch: Readonly<{ displayName?: string; locale?: 'pt-BR' | 'en' }>;
  readonly localDraftToken: string;
}

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null && !Array.isArray(value);

const mutationBody = (value: unknown): AccountMutationBody | null => {
  if (!isRecord(value) || !controlPlaneDocumentValidator(value['command'])) return null;
  const command = value['command'];
  if (!isRecord(command) || command.kind !== 'account-command') return null;
  if (!isRecord(value['patch']) || typeof value['localDraftToken'] !== 'string') return null;
  return value as unknown as AccountMutationBody;
};

const correlationId = (request: FastifyRequest): string => {
  const value = request.headers['x-correlation-id'];
  return typeof value === 'string' && value.length > 0 ? value : 'account-route';
};

const ifMatchVersion = (request: FastifyRequest): string | null => {
  const value = request.headers['if-match'];
  if (typeof value !== 'string') return null;
  const match = /^(?:W\/)?"?account-.+-v([0-9]+)"?$/u.exec(value);
  return match?.[1] ?? (/^(?:0|[1-9][0-9]*)$/u.test(value) ? value : null);
};

const sendProjection = (reply: FastifyReply, projection: { account: { etag: string } }) =>
  reply.header('etag', `"${projection.account.etag}"`).code(200).send(projection);

export const registerAccountRoutes = (
  app: FastifyInstance,
  dependencies: AccountRouteDependencies,
): Promise<void> => {
  app.get('/v1/account', async (request, reply) => {
    const actor = await dependencies.resolveSessionActor(request);
    if (actor === null) return reply.code(401).send({ code: 'UNAUTHORIZED' });
    const result = await projectAccount(dependencies.projection, {
      actorAccountId: actor.accountId,
      accountId: actor.accountId,
      correlationId: correlationId(request),
    });
    if (result.ok) return sendProjection(reply, result.projection);
    const status = result.code === 'NOT_FOUND' ? 404 : result.code === 'UNAUTHORIZED' ? 401 : 409;
    return reply.code(status).send({ code: result.code });
  });

  app.patch('/v1/account', async (request, reply) => {
    const actor = await dependencies.resolveSessionActor(request);
    const body = mutationBody(request.body);
    const matchedVersion = ifMatchVersion(request);
    if (
      actor === null ||
      body === null ||
      matchedVersion === null ||
      matchedVersion !== body.command.expectedVersion
    ) {
      return reply.code(actor === null ? 401 : 400).send({
        code: actor === null ? 'UNAUTHORIZED' : 'INVALID_REQUEST',
      });
    }
    const result = await updateAccount(dependencies.mutation, {
      actorAccountId: actor.accountId,
      command: body.command,
      patch: body.patch,
      localDraftToken: body.localDraftToken,
    });
    if (result.ok) return sendProjection(reply, result.projection);
    if (result.code === 'CONFLICT') {
      return reply.header('etag', `"${result.projection.account.etag}"`).code(409).send(result);
    }
    const status = result.code === 'UNAUTHORIZED' ? 401 : result.code === 'NOT_FOUND' ? 404 : 422;
    return reply.code(status).send({ code: result.code });
  });

  return Promise.resolve();
};
