import { createHmac, timingSafeEqual } from 'node:crypto';

import type { AdminInvitationDependencies } from '@liiiraa/control-plane-application';
import {
  issueBetaInvitation,
  manageBetaInvitation,
  preflightBetaInvitations,
  startBetaInvitationBatch,
} from '@liiiraa/control-plane-application/admin-invitations';
import { controlPlaneDocumentValidator } from '@liiiraa/contracts-ts/runtime-control-plane-validator';
import type { FastifyInstance, FastifyReply, FastifyRequest } from 'fastify';

type InvitationCapability =
  | 'beta-invitations:preflight'
  | 'beta-invitations:issue'
  | 'beta-invitations:manage'
  | 'beta-invitations:batch';

export interface AdminInvitationRouteSession {
  readonly actorId: string;
  readonly activeFunction: string;
  readonly capabilities: readonly InvitationCapability[];
  readonly scopes: readonly string[];
}

export interface AdminInvitationQueryPort {
  list(
    input: Readonly<{
      limit: number;
      cursor?: string;
    }>,
  ): Promise<
    Readonly<{ records: readonly Readonly<Record<string, unknown>>[]; nextCursor: string | null }>
  >;
  load(invitationId: string): Promise<Readonly<Record<string, unknown>> | null>;
  timeline(invitationId: string): Promise<readonly Readonly<Record<string, unknown>>[]>;
}

export interface AdminInvitationRouteOperations {
  readonly preflight: typeof preflightBetaInvitations;
  readonly issue: typeof issueBetaInvitation;
  readonly manage: typeof manageBetaInvitation;
  readonly batch: typeof startBetaInvitationBatch;
}

export interface AdminInvitationRouteDependencies {
  readonly allowedOrigin: string;
  readonly csrfSecret: string;
  readonly invitations: AdminInvitationDependencies;
  readonly operations?: AdminInvitationRouteOperations;
  readonly queries: AdminInvitationQueryPort;
  readonly resolveSession: (request: FastifyRequest) => Promise<AdminInvitationRouteSession | null>;
  readonly rateLimit: (key: string) => Promise<boolean>;
}

const defaultOperations: AdminInvitationRouteOperations = Object.freeze({
  preflight: preflightBetaInvitations,
  issue: issueBetaInvitation,
  manage: manageBetaInvitation,
  batch: startBetaInvitationBatch,
});

const isRecord = (value: unknown): value is Readonly<Record<string, unknown>> =>
  typeof value === 'object' && value !== null && !Array.isArray(value);

const stringValue = (record: Readonly<Record<string, unknown>>, key: string): string =>
  typeof record[key] === 'string' ? record[key] : '';

const noStore = (reply: FastifyReply): FastifyReply =>
  reply.header('cache-control', 'no-store, private');

const hidden = (reply: FastifyReply) => noStore(reply).code(404).send({ code: 'NOT_FOUND' });

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
  dependencies: AdminInvitationRouteDependencies,
  capability: InvitationCapability,
  mutation: boolean,
): Promise<AdminInvitationRouteSession | null> => {
  if (request.headers.origin !== dependencies.allowedOrigin) return null;
  if (mutation && !verifyCsrf(dependencies.csrfSecret, request.headers['x-csrf-token']))
    return null;
  const session = await dependencies.resolveSession(request);
  if (
    session?.activeFunction !== 'operations' ||
    !session.capabilities.includes(capability) ||
    !session.scopes.includes('invitations')
  ) {
    return null;
  }
  return session;
};

const limited = async (
  request: FastifyRequest,
  dependencies: AdminInvitationRouteDependencies,
  actorId: string,
  operation: string,
): Promise<boolean> => dependencies.rateLimit(`${actorId}:${operation}:${request.ip}`);

const emailPattern = /^[^\s@]{1,64}@[^\s@]{1,190}$/u;

interface PreflightRow {
  readonly rowId: string;
  readonly recipient: string;
  readonly emailValid: boolean;
  readonly eligible: boolean;
}

const preflightRows = (body: unknown): readonly PreflightRow[] | null => {
  let candidates: readonly unknown[];
  if (typeof body === 'string') {
    if (Buffer.byteLength(body, 'utf8') > 128 * 1024) return null;
    const lines = body
      .split(/\r?\n/u)
      .map((line) => line.trim())
      .filter((line) => line.length > 0);
    if (lines[0]?.toLowerCase() === 'recipient') lines.shift();
    candidates = lines.map((recipient, index) => ({
      rowId: `csv-${String(index + 1)}`,
      recipient,
    }));
  } else if (isRecord(body) && Array.isArray(body['rows'])) {
    candidates = body['rows'];
  } else {
    return null;
  }
  if (candidates.length < 1 || candidates.length > 100) return null;
  const rows: PreflightRow[] = [];
  for (const candidate of candidates) {
    if (!isRecord(candidate)) return null;
    const rowId = stringValue(candidate, 'rowId').trim();
    const recipient = stringValue(candidate, 'recipient').trim().toLowerCase();
    if (rowId.length < 1 || rowId.length > 128 || recipient.length < 3 || recipient.length > 254) {
      return null;
    }
    rows.push({ rowId, recipient, emailValid: emailPattern.test(recipient), eligible: true });
  }
  return rows;
};

interface OperationCommand {
  readonly commandId: string;
  readonly actorId: string;
  readonly activeFunction: string;
  readonly action: string;
  readonly targetReferences: readonly string[];
  readonly reason: string;
  readonly expectedVersion: bigint;
}

const isStringArray = (value: unknown): value is readonly string[] =>
  Array.isArray(value) && value.every((item: unknown) => typeof item === 'string');

const operationCommand = (
  value: unknown,
  session: AdminInvitationRouteSession,
  action: string,
  target?: string,
): OperationCommand | null => {
  if (!controlPlaneDocumentValidator(value) || !isRecord(value)) return null;
  const targetReferences = value.targetReferences;
  if (
    value.kind !== 'admin-operation-command' ||
    value.actorId !== session.actorId ||
    value.activeFunction !== session.activeFunction ||
    value.action !== action ||
    !isStringArray(targetReferences) ||
    (target !== undefined && !targetReferences.includes(target))
  ) {
    return null;
  }
  const expected = value.expectedVersion;
  if (typeof expected !== 'string' || !/^(?:0|[1-9][0-9]{0,18})$/u.test(expected)) return null;
  return {
    commandId: stringValue(value, 'commandId'),
    actorId: session.actorId,
    activeFunction: session.activeFunction,
    action,
    targetReferences,
    reason: stringValue(value, 'reason'),
    expectedVersion: BigInt(expected),
  };
};

const idempotencyKey = (body: Readonly<Record<string, unknown>>): string | null => {
  const value = stringValue(body, 'idempotencyKey').trim();
  return /^[A-Za-z0-9_-]{1,128}$/u.test(value) ? value : null;
};

const publicResult = (
  result: Readonly<Record<string, unknown>>,
): Readonly<Record<string, unknown>> => {
  if (result['ok'] !== true) {
    return {
      ok: false,
      code: typeof result['code'] === 'string' ? result['code'] : 'INVITATION_OPERATION_FAILED',
    };
  }
  const state = isRecord(result['state']) ? result['state'] : null;
  return Object.freeze({
    ok: true,
    outcome: result['outcome'],
    receiptId: result['receiptId'],
    ...(result['jobId'] === undefined ? {} : { jobId: result['jobId'] }),
    ...(result['results'] === undefined ? {} : { results: result['results'] }),
    ...(state === null
      ? {}
      : {
          invitation: {
            invitationId: state['invitationId'],
            locale: state['locale'],
            status: state['status'],
            version:
              typeof state['version'] === 'bigint' ? state['version'].toString() : state['version'],
            expiresAt: state['expiresAt'],
            reminderCount: state['reminderCount'],
          },
        }),
  });
};

const publicInvitation = (record: Readonly<Record<string, unknown>>) => ({
  invitationId: record['invitationId'],
  recipientMasked: record['recipientMasked'],
  lifecycleState: record['lifecycleState'],
  ...(record['deliveryState'] === undefined ? {} : { deliveryState: record['deliveryState'] }),
  ...(record['locale'] === undefined ? {} : { locale: record['locale'] }),
  ...(record['campaignReference'] === undefined
    ? {}
    : { campaignReference: record['campaignReference'] }),
  ...(record['version'] === undefined
    ? {}
    : {
        version:
          typeof record['version'] === 'bigint' ? record['version'].toString() : record['version'],
      }),
  ...(record['expiresAt'] === undefined ? {} : { expiresAt: record['expiresAt'] }),
  ...(record['lastEventAt'] === undefined ? {} : { lastEventAt: record['lastEventAt'] }),
});

const publicTimeline = (event: Readonly<Record<string, unknown>>) => ({
  kind: event['kind'],
  at: event['at'],
  ...(event['outcome'] === undefined ? {} : { outcome: event['outcome'] }),
});

const resultStatus = (result: Readonly<Record<string, unknown>>, success: number): number => {
  if (result['ok'] === true) return success;
  return result['code'] === 'STALE' || result['code'] === 'RECIPIENT_ACTIVE' ? 409 : 400;
};

const parseListQuery = (query: unknown): Readonly<{ limit: number; cursor?: string }> | null => {
  if (!isRecord(query)) return { limit: 25 };
  const limitText = typeof query['limit'] === 'string' ? query['limit'] : '25';
  if (!/^[0-9]{1,3}$/u.test(limitText)) return null;
  const limit = Number(limitText);
  if (!Number.isSafeInteger(limit) || limit < 1 || limit > 100) return null;
  const cursor = typeof query['cursor'] === 'string' ? query['cursor'] : undefined;
  if (cursor !== undefined && (cursor.length < 1 || cursor.length > 256)) return null;
  return { limit, ...(cursor === undefined ? {} : { cursor }) };
};

export const registerAdminInvitationRoutes = (
  app: FastifyInstance,
  dependencies: AdminInvitationRouteDependencies,
): Promise<void> => {
  if (dependencies.csrfSecret.length < 32) throw new Error('ADMIN_INVITATION_CSRF_SECRET_REJECTED');
  if (!app.hasContentTypeParser('text/csv')) {
    app.addContentTypeParser(
      'text/csv',
      { bodyLimit: 128 * 1024, parseAs: 'string' },
      (_request, body, done) => {
        done(null, body);
      },
    );
  }
  const operations = dependencies.operations ?? defaultOperations;

  app.get('/v1/admin/invitations', async (request, reply) => {
    const session = await authorize(request, dependencies, 'beta-invitations:manage', false);
    if (session === null) return hidden(reply);
    const query = parseListQuery(request.query);
    if (query === null) return noStore(reply).code(400).send({ code: 'REQUEST_INVALID' });
    if (!(await limited(request, dependencies, session.actorId, 'invitation-list'))) {
      return noStore(reply).code(429).send({ code: 'RATE_LIMITED' });
    }
    const result = await dependencies.queries.list(query);
    return noStore(reply)
      .code(200)
      .send({
        records: result.records.map(publicInvitation),
        nextCursor: result.nextCursor,
      });
  });

  app.get<{ Params: { invitationId: string } }>(
    '/v1/admin/invitations/:invitationId',
    async (request, reply) => {
      const session = await authorize(request, dependencies, 'beta-invitations:manage', false);
      if (session === null) return hidden(reply);
      const record = await dependencies.queries.load(request.params.invitationId);
      return record === null
        ? hidden(reply)
        : noStore(reply).code(200).send(publicInvitation(record));
    },
  );

  app.get<{ Params: { invitationId: string } }>(
    '/v1/admin/invitations/:invitationId/timeline',
    async (request, reply) => {
      const session = await authorize(request, dependencies, 'beta-invitations:manage', false);
      if (session === null) return hidden(reply);
      return noStore(reply)
        .code(200)
        .send({
          events: (await dependencies.queries.timeline(request.params.invitationId)).map(
            publicTimeline,
          ),
        });
    },
  );

  app.post('/v1/admin/invitations/preflight', async (request, reply) => {
    const session = await authorize(request, dependencies, 'beta-invitations:preflight', true);
    if (session === null) return hidden(reply);
    if (!(await limited(request, dependencies, session.actorId, 'invitation-preflight'))) {
      return noStore(reply).code(429).send({ code: 'RATE_LIMITED' });
    }
    const rows = preflightRows(request.body);
    if (rows === null) return noStore(reply).code(400).send({ code: 'REQUEST_INVALID' });
    const result = await operations.preflight(dependencies.invitations, {
      actorId: session.actorId,
      rows,
    });
    return result.ok
      ? noStore(reply)
          .code(200)
          .send({
            ok: true,
            rows: result.rows.map(({ rowId, classification }) => ({ rowId, classification })),
          })
      : noStore(reply).code(400).send({ ok: false, code: result.code });
  });

  app.post('/v1/admin/invitations', async (request, reply) => {
    const session = await authorize(request, dependencies, 'beta-invitations:issue', true);
    if (session === null) return hidden(reply);
    if (!isRecord(request.body)) return noStore(reply).code(400).send({ code: 'REQUEST_INVALID' });
    const body = request.body;
    const invitationId = stringValue(body, 'invitationId');
    const parsed = operationCommand(body['command'], session, 'issue-invitations', invitationId);
    const key = idempotencyKey(body);
    const recipient = stringValue(body, 'recipient').trim().toLowerCase();
    const locale = body['locale'];
    if (
      parsed === null ||
      key === null ||
      invitationId.length < 1 ||
      !emailPattern.test(recipient) ||
      (locale !== 'pt-BR' && locale !== 'en')
    ) {
      return noStore(reply).code(400).send({ code: 'REQUEST_INVALID' });
    }
    const result = await operations.issue(dependencies.invitations, {
      actorId: session.actorId,
      commandId: parsed.commandId,
      idempotencyKey: key,
      expectedVersion: parsed.expectedVersion,
      invitationId,
      recipient,
      locale,
      ...(typeof body['campaign'] === 'string' ? { campaign: body['campaign'] } : {}),
      ...(typeof body['cohort'] === 'string' ? { cohort: body['cohort'] } : {}),
    });
    return noStore(reply).code(resultStatus(result, 201)).send(publicResult(result));
  });

  const transition =
    (action: 'resend-invitations' | 'revoke-invitations') =>
    async (request: FastifyRequest<{ Params: { invitationId: string } }>, reply: FastifyReply) => {
      const session = await authorize(request, dependencies, 'beta-invitations:manage', true);
      if (session === null) return hidden(reply);
      if (!isRecord(request.body))
        return noStore(reply).code(400).send({ code: 'REQUEST_INVALID' });
      const parsed = operationCommand(
        request.body['command'],
        session,
        action,
        request.params.invitationId,
      );
      const key = idempotencyKey(request.body);
      if (parsed === null || key === null) {
        return noStore(reply).code(400).send({ code: 'REQUEST_INVALID' });
      }
      const result = await operations.manage(dependencies.invitations, {
        actorId: session.actorId,
        commandId: parsed.commandId,
        idempotencyKey: key,
        invitationId: request.params.invitationId,
        expectedVersion: parsed.expectedVersion,
        action:
          action === 'resend-invitations'
            ? {
                kind: 'resend',
                expiryMode: request.body['expiryMode'] === 'restart' ? 'restart' : 'preserve',
                justification: parsed.reason,
              }
            : { kind: 'revoke', reason: parsed.reason },
      });
      return noStore(reply).code(resultStatus(result, 200)).send(publicResult(result));
    };

  app.post<{ Params: { invitationId: string } }>(
    '/v1/admin/invitations/:invitationId/resend',
    transition('resend-invitations'),
  );
  app.post<{ Params: { invitationId: string } }>(
    '/v1/admin/invitations/:invitationId/revoke',
    transition('revoke-invitations'),
  );

  app.post('/v1/admin/invitations/batches', async (request, reply) => {
    const session = await authorize(request, dependencies, 'beta-invitations:batch', true);
    if (session === null) return hidden(reply);
    if (!isRecord(request.body) || !Array.isArray(request.body['items'])) {
      return noStore(reply).code(400).send({ code: 'REQUEST_INVALID' });
    }
    const body = request.body;
    const action = body['action'];
    const commandAction = action === 'resend' ? 'resend-invitations' : 'revoke-invitations';
    const parsed = operationCommand(body['command'], session, commandAction);
    const key = idempotencyKey(body);
    const items = body['items'] as readonly unknown[];
    const risk = body['risk'];
    if (
      parsed === null ||
      key === null ||
      (action !== 'resend' && action !== 'revoke') ||
      (risk !== 'standard' && risk !== 'high') ||
      items.length < 1 ||
      items.length > 1_000 ||
      !items.every(
        (item) =>
          isRecord(item) &&
          typeof item['invitationId'] === 'string' &&
          item['invitationId'].length <= 128,
      )
    ) {
      return noStore(reply).code(400).send({ code: 'REQUEST_INVALID' });
    }
    const result = await operations.batch(dependencies.invitations, {
      actorId: session.actorId,
      commandId: parsed.commandId,
      idempotencyKey: key,
      action,
      impactReviewed: body['impactReviewed'] === true,
      reason: parsed.reason,
      risk,
      approvalGranted: body['approvalGranted'] === true,
      items: items.map((item) => ({
        invitationId: stringValue(item as Readonly<Record<string, unknown>>, 'invitationId'),
      })),
    });
    return noStore(reply).code(resultStatus(result, 202)).send(publicResult(result));
  });
  return Promise.resolve();
};
