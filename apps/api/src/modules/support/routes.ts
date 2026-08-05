import {
  controlPlaneDocumentValidator,
  type AccountCommandJson,
  type ConsentCommandJson,
  type SupportCommandJson,
} from '@liiiraa/contracts-ts';
import {
  deleteAccount,
  manageConsent,
  manageSupportCase,
  type DeleteAccountDependencies,
  type ManageConsentDependencies,
  type ManageSupportCaseAction,
  type ManageSupportCaseDependencies,
  type AccountDeletionState,
  type SupportAttachmentMetadata,
  type SupportCaseState,
  type SupportDiagnosticFieldClass,
} from '@liiiraa/control-plane-application';
import type { FastifyInstance, FastifyReply, FastifyRequest } from 'fastify';

export interface SupportRouteDependencies {
  readonly cases: ManageSupportCaseDependencies;
  readonly consents: ManageConsentDependencies;
  readonly deletion: DeleteAccountDependencies;
  readonly resolveSessionActor: (
    request: FastifyRequest,
  ) => Promise<Readonly<{ accountId: string }> | null>;
  readonly verifyStrongReauthentication: (request: FastifyRequest) => Promise<boolean>;
  readonly listCases: (accountId: string) => Promise<readonly SupportCaseState[]>;
  readonly listAttachmentMetadata: (
    accountId: string,
    caseId: string,
  ) => Promise<readonly SupportAttachmentMetadata[]>;
  readonly projectDeletion: (accountId: string) => Promise<AccountDeletionState | null>;
}

interface SupportBody {
  readonly command: SupportCommandJson;
  readonly plan?: 'free' | 'premium';
  readonly category?: 'general' | 'billing' | 'security' | 'restoration';
  readonly subjectRedacted?: string;
  readonly message?: string;
  readonly attachment?: SupportAttachmentMetadata;
  readonly relatedCaseId?: string;
}

interface ConsentBody {
  readonly command: ConsentCommandJson;
  readonly caseId?: string;
  readonly purpose?: string;
  readonly fieldClasses?: readonly SupportDiagnosticFieldClass[];
  readonly expiresAt?: string;
}

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null && !Array.isArray(value);

const validatedCommand = <TKind extends 'support-command' | 'consent-command' | 'account-command'>(
  value: unknown,
  kind: TKind,
): Extract<
  SupportCommandJson | ConsentCommandJson | AccountCommandJson,
  { kind: TKind }
> | null => {
  if (!isRecord(value) || !controlPlaneDocumentValidator(value)) return null;
  return value['kind'] === kind
    ? (value as unknown as Extract<
        SupportCommandJson | ConsentCommandJson | AccountCommandJson,
        { kind: TKind }
      >)
    : null;
};

const version = (value: string): bigint | null =>
  /^(?:0|[1-9][0-9]*)$/u.test(value) ? BigInt(value) : null;

const jsonSafe = (value: unknown): unknown =>
  JSON.parse(
    JSON.stringify(value, (_key, item: unknown) =>
      typeof item === 'bigint' ? String(item) : item,
    ),
  );

const sendResult = (
  reply: FastifyReply,
  result: Readonly<{ ok: boolean; code?: string }>,
  success: number,
) => {
  if (result.ok) return reply.code(success).send(jsonSafe(result));
  const status =
    result.code === 'STALE'
      ? 409
      : result.code === 'UNAUTHORIZED'
        ? 401
        : result.code?.includes('NOT_FOUND') === true
          ? 404
          : result.code === 'STRONG_AUTH_REQUIRED'
            ? 403
            : 422;
  return reply.code(status).send(jsonSafe(result));
};

const supportContext = async (
  request: FastifyRequest,
  dependencies: SupportRouteDependencies,
): Promise<Readonly<{ actor: { accountId: string }; body: SupportBody }> | null> => {
  const actor = await dependencies.resolveSessionActor(request);
  if (!actor || !isRecord(request.body)) return null;
  const command = validatedCommand(request.body['command'], 'support-command');
  if (!command || command.accountId !== actor.accountId) return null;
  if (
    isRecord(request.params) &&
    typeof request.params['caseId'] === 'string' &&
    request.params['caseId'] !== command.supportCaseId
  ) {
    return null;
  }
  return { actor, body: { ...(request.body as unknown as SupportBody), command } };
};

const consentContext = async (
  request: FastifyRequest,
  dependencies: SupportRouteDependencies,
): Promise<Readonly<{ actor: { accountId: string }; body: ConsentBody }> | null> => {
  const actor = await dependencies.resolveSessionActor(request);
  if (!actor || !isRecord(request.body)) return null;
  const command = validatedCommand(request.body['command'], 'consent-command');
  if (!command || command.accountId !== actor.accountId) return null;
  if (
    isRecord(request.params) &&
    typeof request.params['consentId'] === 'string' &&
    request.params['consentId'] !== command.consentId
  ) {
    return null;
  }
  return { actor, body: { ...(request.body as unknown as ConsentBody), command } };
};

const supportMutation = async (
  request: FastifyRequest,
  reply: FastifyReply,
  dependencies: SupportRouteDependencies,
  action: (body: SupportBody) => ManageSupportCaseAction | null,
  success: number,
) => {
  const context = await supportContext(request, dependencies);
  if (!context) return reply.code(401).send({ code: 'UNAUTHORIZED' });
  const resolved = action(context.body);
  if (resolved === null) return reply.code(400).send({ code: 'INVALID_REQUEST' });
  return sendResult(
    reply,
    await manageSupportCase(dependencies.cases, {
      command: context.body.command,
      action: resolved,
    }),
    success,
  );
};

export const registerSupportRoutes = (
  app: FastifyInstance,
  dependencies: SupportRouteDependencies,
): Promise<void> => {
  app.get('/v1/support/cases', async (request, reply) => {
    const actor = await dependencies.resolveSessionActor(request);
    if (!actor) return reply.code(401).send({ code: 'UNAUTHORIZED' });
    return reply.code(200).send(jsonSafe(await dependencies.listCases(actor.accountId)));
  });

  app.post('/v1/support/cases', (request, reply) =>
    supportMutation(
      request,
      reply,
      dependencies,
      (body) =>
        body.command.action === 'create' &&
        body.plan !== undefined &&
        body.category !== undefined &&
        body.subjectRedacted !== undefined &&
        body.message !== undefined
          ? {
              kind: 'create',
              plan: body.plan,
              category: body.category,
              subjectRedacted: body.subjectRedacted,
              message: body.message,
            }
          : null,
      201,
    ),
  );

  app.post('/v1/support/cases/:caseId/messages', (request, reply) =>
    supportMutation(
      request,
      reply,
      dependencies,
      (body) =>
        body.command.action === 'reply' && body.message !== undefined
          ? { kind: 'reply', author: 'customer', message: body.message }
          : null,
      200,
    ),
  );

  app.post('/v1/support/cases/:caseId/close', (request, reply) =>
    supportMutation(
      request,
      reply,
      dependencies,
      (body) => (body.command.action === 'close' ? { kind: 'close' } : null),
      200,
    ),
  );

  app.post('/v1/support/cases/:caseId/reopen', (request, reply) =>
    supportMutation(
      request,
      reply,
      dependencies,
      (body) =>
        body.command.action === 'create'
          ? {
              kind: 'reopen',
              ...(body.relatedCaseId === undefined ? {} : { relatedCaseId: body.relatedCaseId }),
            }
          : null,
      200,
    ),
  );

  app.post('/v1/support/cases/:caseId/attachments', (request, reply) =>
    supportMutation(
      request,
      reply,
      dependencies,
      (body) =>
        body.command.action === 'reply' && body.attachment !== undefined
          ? { kind: 'attach-metadata', attachment: body.attachment }
          : null,
      201,
    ),
  );

  app.get('/v1/support/cases/:caseId/attachments', async (request, reply) => {
    const actor = await dependencies.resolveSessionActor(request);
    if (!actor || !isRecord(request.params) || typeof request.params['caseId'] !== 'string') {
      return reply.code(401).send({ code: 'UNAUTHORIZED' });
    }
    return reply
      .code(200)
      .send(await dependencies.listAttachmentMetadata(actor.accountId, request.params['caseId']));
  });

  app.post('/v1/support/consents', async (request, reply) => {
    const context = await consentContext(request, dependencies);
    if (!context) return reply.code(401).send({ code: 'UNAUTHORIZED' });
    const { body } = context;
    if (
      body.command.action !== 'grant' ||
      body.caseId === undefined ||
      body.purpose === undefined ||
      body.fieldClasses === undefined ||
      body.expiresAt === undefined
    ) {
      return reply.code(400).send({ code: 'INVALID_REQUEST' });
    }
    return sendResult(
      reply,
      await manageConsent(dependencies.consents, {
        command: body.command,
        action: {
          kind: 'grant',
          caseId: body.caseId,
          purpose: body.purpose,
          fieldClasses: body.fieldClasses,
          expiresAt: body.expiresAt,
        },
      }),
      201,
    );
  });

  app.post('/v1/support/consents/:consentId/revoke', async (request, reply) => {
    const context = await consentContext(request, dependencies);
    if (!context || context.body.command.action !== 'revoke') {
      return reply.code(401).send({ code: 'UNAUTHORIZED' });
    }
    return sendResult(
      reply,
      await manageConsent(dependencies.consents, {
        command: context.body.command,
        action: { kind: 'revoke' },
      }),
      200,
    );
  });

  app.post('/v1/privacy/deletion', async (request, reply) => {
    const actor = await dependencies.resolveSessionActor(request);
    if (!actor || !isRecord(request.body)) return reply.code(401).send({ code: 'UNAUTHORIZED' });
    const command = validatedCommand(request.body['command'], 'account-command');
    const expectedVersion = command === null ? null : version(command.expectedVersion);
    if (
      command?.action !== 'request-deletion' ||
      command.accountId !== actor.accountId ||
      expectedVersion === null
    ) {
      return reply.code(400).send({ code: 'INVALID_REQUEST' });
    }
    const strongAuthVerified = await dependencies.verifyStrongReauthentication(request);
    return sendResult(
      reply,
      await deleteAccount(dependencies.deletion, {
        commandId: command.commandId,
        accountId: command.accountId,
        expectedVersion,
        action: { kind: 'request', requestId: command.commandId, strongAuthVerified },
      }),
      202,
    );
  });

  app.post('/v1/privacy/deletion/cancel', async (request, reply) => {
    const actor = await dependencies.resolveSessionActor(request);
    if (!actor || !isRecord(request.body)) return reply.code(401).send({ code: 'UNAUTHORIZED' });
    const command = validatedCommand(request.body['command'], 'account-command');
    const expectedVersion = command === null ? null : version(command.expectedVersion);
    if (
      command?.action !== 'cancel-deletion' ||
      command.accountId !== actor.accountId ||
      expectedVersion === null
    ) {
      return reply.code(400).send({ code: 'INVALID_REQUEST' });
    }
    return sendResult(
      reply,
      await deleteAccount(dependencies.deletion, {
        commandId: command.commandId,
        accountId: command.accountId,
        expectedVersion,
        action: { kind: 'cancel' },
      }),
      200,
    );
  });

  app.get('/v1/privacy/deletion', async (request, reply) => {
    const actor = await dependencies.resolveSessionActor(request);
    if (!actor) return reply.code(401).send({ code: 'UNAUTHORIZED' });
    const state = await dependencies.projectDeletion(actor.accountId);
    return state === null
      ? reply.code(404).send({ code: 'DELETION_NOT_FOUND' })
      : reply.code(200).send(jsonSafe(state));
  });

  return Promise.resolve();
};
