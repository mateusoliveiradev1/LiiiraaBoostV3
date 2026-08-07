import { createHmac, timingSafeEqual } from 'node:crypto';

import type { AdminInvitationDependencies } from '@liiiraa/control-plane-application';
import {
  issueBetaInvitation,
  manageBetaInvitation,
  preflightBetaInvitations,
  startBetaInvitationBatch,
} from '@liiiraa/control-plane-application/admin-invitations';
import type {
  AdminEnvironmentIdentityJson,
  AdminInvitationCapacityProjectionJson,
  AdminInvitationDeliveryStateJson,
  AdminInvitationLifecycleStateJson,
  AdminInvitationProjectionJson,
  AdminJobProjectionJson,
} from '@liiiraa/contracts-ts';
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
    Readonly<{
      records: readonly Readonly<Record<string, unknown>>[];
      capacity: Readonly<Record<string, unknown>>;
      jobs: readonly Readonly<Record<string, unknown>>[];
      nextCursor: string | null;
    }>
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
  readonly clock: Readonly<{ now(): Date }>;
  readonly csrfSecret: string;
  readonly environment: AdminEnvironmentIdentityJson;
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

const boundedText = (value: unknown, maximum = 128): string | null =>
  typeof value === 'string' && value.trim().length > 0 && value.length <= maximum
    ? value.trim()
    : null;

const versionText = (value: unknown): string | null => {
  if (typeof value === 'bigint') return value >= 0n ? value.toString() : null;
  if (typeof value === 'number')
    return Number.isSafeInteger(value) && value >= 0 ? String(value) : null;
  return boundedText(value);
};

const integerValue = (value: unknown, minimum: number, maximum: number): number | null =>
  typeof value === 'number' && Number.isSafeInteger(value) && value >= minimum && value <= maximum
    ? value
    : null;

const correlationFor = (request: FastifyRequest): string => {
  const header = boundedText(request.headers['x-correlation-id']);
  if (header !== null) return header;
  const requestId = request.id.replace(/[^A-Za-z0-9._:-]/gu, '-').slice(0, 128);
  return requestId.length > 0 ? requestId : 'admin-invitation-request';
};

const projectionMetadata = (
  request: FastifyRequest,
  dependencies: AdminInvitationRouteDependencies,
  aggregateVersion: string,
  recordReference: string,
) => ({
  schemaVersion: '1.0' as const,
  aggregateVersion,
  etag: `admin-${recordReference}-v${aggregateVersion}`,
  correlationId: correlationFor(request),
  provenance: 'postgres-authority' as const,
  environment: dependencies.environment,
  freshness: {
    state: 'live' as const,
    source: 'admin-invitations-api',
    sequence: aggregateVersion,
    observedAt: dependencies.clock.now().toISOString(),
  },
});

const lifecycleState = (value: unknown): AdminInvitationLifecycleStateJson | null => {
  const normalized =
    value === 'pending' ? 'active' : value === 'permanently-bounced' ? 'bounced' : value;
  return typeof normalized === 'string' &&
    ['queued', 'active', 'accepted', 'declined', 'expired', 'revoked', 'bounced'].includes(
      normalized,
    )
    ? (normalized as AdminInvitationLifecycleStateJson)
    : null;
};

const deliveryState = (value: unknown): AdminInvitationDeliveryStateJson | null => {
  const normalized =
    value === undefined || value === null || value === 'not-requested'
      ? 'unavailable'
      : value === 'queued'
        ? 'pending'
        : value === 'permanently-bounced'
          ? 'permanent-bounce'
          : value;
  return typeof normalized === 'string' &&
    ['unavailable', 'pending', 'sent', 'delivered', 'failed', 'permanent-bounce'].includes(
      normalized,
    )
    ? (normalized as AdminInvitationDeliveryStateJson)
    : null;
};

const publicInvitation = (
  record: Readonly<Record<string, unknown>>,
  request: FastifyRequest,
  dependencies: AdminInvitationRouteDependencies,
): AdminInvitationProjectionJson | null => {
  const invitationId = boundedText(record['invitationId']);
  const aggregateVersion = versionText(record['version'] ?? record['aggregateVersion']);
  const state = lifecycleState(record['lifecycleState'] ?? record['status']);
  const locale = record['locale'];
  const delivery = deliveryState(record['deliveryState']);
  const reminderCount = integerValue(record['reminderCount'], 0, 2);
  const lastEventAt = boundedText(record['lastEventAt'] ?? record['updatedAt']);
  const recipientMasked = boundedText(record['recipientMasked'], 256) ?? 'recipient-protected';
  if (
    invitationId === null ||
    aggregateVersion === null ||
    state === null ||
    (locale !== 'en' && locale !== 'pt-BR') ||
    delivery === null ||
    reminderCount === null ||
    lastEventAt === null ||
    Number.isNaN(Date.parse(lastEventAt))
  ) {
    return null;
  }
  const campaignReference = boundedText(record['campaignReference'] ?? record['campaign']);
  const ownerReference = boundedText(record['ownerReference']);
  const expiresAt = boundedText(record['expiresAt']);
  if (expiresAt !== null && Number.isNaN(Date.parse(expiresAt))) return null;
  const projection: AdminInvitationProjectionJson = {
    ...projectionMetadata(request, dependencies, aggregateVersion, invitationId),
    kind: 'admin-invitation-projection',
    invitationId,
    lifecycleState: state,
    recipientMasked,
    ...(campaignReference === null ? {} : { campaignReference }),
    locale,
    deliveryState: delivery,
    reminderCount,
    ...(ownerReference === null ? {} : { ownerReference }),
    ...(expiresAt === null ? {} : { expiresAt }),
    lastEventAt,
  };
  return controlPlaneDocumentValidator(projection) ? Object.freeze(projection) : null;
};

const publicCapacity = (
  record: Readonly<Record<string, unknown>>,
  request: FastifyRequest,
  dependencies: AdminInvitationRouteDependencies,
): AdminInvitationCapacityProjectionJson | null => {
  const aggregateVersion = versionText(record['version'] ?? record['aggregateVersion']);
  const activeCount = integerValue(record['activeCount'], 0, 25);
  const activeLimit = integerValue(record['activeLimit'], 25, 25);
  const queuedCount = integerValue(record['queuedCount'], 0, 100_000);
  if (
    aggregateVersion === null ||
    activeCount === null ||
    activeLimit !== 25 ||
    queuedCount === null
  ) {
    return null;
  }
  const projection: AdminInvitationCapacityProjectionJson = {
    ...projectionMetadata(request, dependencies, aggregateVersion, 'invitation-capacity'),
    kind: 'admin-invitation-capacity-projection',
    capacityId: 'beta-invitations',
    activeCount,
    activeLimit: 25,
    queuedCount,
  };
  return controlPlaneDocumentValidator(projection) ? Object.freeze(projection) : null;
};

const publicJob = (
  record: Readonly<Record<string, unknown>>,
  ownerReference: string,
  request: FastifyRequest,
  dependencies: AdminInvitationRouteDependencies,
): AdminJobProjectionJson | null => {
  const jobId = boundedText(record['jobId']);
  const action = record['action'];
  const stateValue = record['state'] ?? record['status'];
  const state =
    stateValue === 'completed-with-failures'
      ? 'partial'
      : ['queued', 'running', 'paused', 'completed', 'partial', 'failed', 'cancelled'].includes(
            String(stateValue),
          )
        ? stateValue
        : null;
  const totalItems = integerValue(record['totalItems'], 1, 1_000);
  const completedItems = integerValue(record['completedItems'], 0, totalItems ?? 0);
  const failedItems = integerValue(record['failedItems'], 0, totalItems ?? 0);
  const aggregateVersion = versionText(record['version'] ?? record['aggregateVersion']);
  if (
    jobId === null ||
    (action !== 'resend' && action !== 'revoke') ||
    state === null ||
    totalItems === null ||
    completedItems === null ||
    failedItems === null ||
    completedItems + failedItems > totalItems ||
    aggregateVersion === null
  ) {
    return null;
  }
  const progressPercent = Math.floor(((completedItems + failedItems) / totalItems) * 100);
  const startedAt = boundedText(record['startedAt']);
  const completedAt = boundedText(record['completedAt']);
  const receiptReference = boundedText(record['receiptReference']);
  const projection: AdminJobProjectionJson = {
    ...projectionMetadata(request, dependencies, aggregateVersion, jobId),
    kind: 'admin-job-projection',
    jobId,
    jobType: action === 'resend' ? 'invitation-resend' : 'invitation-revoke',
    state: state as AdminJobProjectionJson['state'],
    progressPercent,
    totalItems,
    completedItems,
    failedItems,
    ownerReference,
    ...(startedAt === null ? {} : { startedAt }),
    ...(completedAt === null ? {} : { completedAt }),
    ...(receiptReference === null ? {} : { receiptReference }),
  };
  return controlPlaneDocumentValidator(projection) ? Object.freeze(projection) : null;
};

const publicResult = (
  result: Readonly<Record<string, unknown>>,
  session: AdminInvitationRouteSession,
  request: FastifyRequest,
  dependencies: AdminInvitationRouteDependencies,
): Readonly<Record<string, unknown>> | null => {
  if (result['ok'] !== true) {
    return {
      ok: false,
      code: typeof result['code'] === 'string' ? result['code'] : 'INVITATION_OPERATION_FAILED',
    };
  }
  const state = isRecord(result['state']) ? result['state'] : null;
  const document =
    state === null
      ? typeof result['jobId'] === 'string' && isRecord(result['results'])
        ? (() => {
            const results = result['results'];
            const values = ['issued', 'queued', 'skipped', 'failed'].map((key) =>
              Array.isArray(results[key]) ? results[key].length : -1,
            );
            if (values.some((value) => value < 0)) return null;
            const totalItems = values.reduce((sum, value) => sum + value, 0);
            return publicJob(
              {
                jobId: result['jobId'],
                action: result['batchAction'],
                state: 'queued',
                totalItems,
                completedItems: 0,
                failedItems: 0,
                version: 'queued:0:0',
                startedAt: dependencies.clock.now().toISOString(),
                receiptReference: result['receiptId'],
              },
              session.actorId,
              request,
              dependencies,
            );
          })()
        : null
      : publicInvitation(state, request, dependencies);
  if (document === null) return null;
  return Object.freeze({
    ok: true,
    outcome: result['outcome'],
    receiptId: result['receiptId'],
    document,
    ...(result['jobId'] === undefined ? {} : { jobId: result['jobId'] }),
    ...(result['results'] === undefined ? {} : { results: result['results'] }),
  });
};

const TIMELINE_KINDS = new Set([
  'created',
  'queued',
  'sent',
  'delivered',
  'delivery-failed',
  'resent',
  'reminded',
  'accepted',
  'expired',
  'declined',
  'revoked',
  'permanently-bounced',
  'suspicious-attempt',
]);

const publicTimeline = (event: Readonly<Record<string, unknown>>) => {
  const kind = boundedText(event['kind']);
  const at = boundedText(event['at']);
  const outcome = event['outcome'] === undefined ? null : boundedText(event['outcome']);
  if (
    kind === null ||
    !TIMELINE_KINDS.has(kind) ||
    at === null ||
    Number.isNaN(Date.parse(at)) ||
    (event['outcome'] !== undefined && outcome === null) ||
    outcome?.includes('@') === true
  ) {
    return null;
  }
  return Object.freeze({ kind, at, ...(outcome === null ? {} : { outcome }) });
};

const publicRetention = (record: Readonly<Record<string, unknown>>) => {
  switch (record['retentionState']) {
    case 'operational':
      return Object.freeze({ action: 'retain' as const, basis: 'operational' as const });
    case 'retained':
      return Object.freeze({ action: 'retain' as const, basis: 'purpose' as const });
    case 'pseudonymized':
      return Object.freeze({
        action: 'pseudonymize-personal-data' as const,
        preserveMinimumAuditReceipt: true as const,
      });
    case 'personal-data-deleted':
      return Object.freeze({
        action: 'delete-personal-data' as const,
        preserveMinimumAuditReceipt: true as const,
      });
    default:
      return null;
  }
};

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
    const invitationRecords = result.records.map((record) =>
      publicInvitation(record, request, dependencies),
    );
    const capacity = publicCapacity(result.capacity, request, dependencies);
    const jobs = result.jobs.map((job) => publicJob(job, session.actorId, request, dependencies));
    if (
      invitationRecords.some((record) => record === null) ||
      capacity === null ||
      jobs.some((job) => job === null)
    ) {
      return noStore(reply).code(503).send({ code: 'INVITATION_AUTHORITY_INVALID' });
    }
    return noStore(reply)
      .code(200)
      .send({
        records: [...invitationRecords, capacity, ...jobs],
        freshness: capacity.freshness,
        nextCursor: result.nextCursor,
      });
  });

  app.get<{ Params: { invitationId: string } }>(
    '/v1/admin/invitations/:invitationId',
    async (request, reply) => {
      const session = await authorize(request, dependencies, 'beta-invitations:manage', false);
      if (session === null) return hidden(reply);
      const record = await dependencies.queries.load(request.params.invitationId);
      if (record === null) return hidden(reply);
      const document = publicInvitation(record, request, dependencies);
      const timeline = (await dependencies.queries.timeline(request.params.invitationId)).map(
        publicTimeline,
      );
      const retention = publicRetention(record);
      if (document === null || timeline.some((event) => event === null) || retention === null) {
        return noStore(reply).code(503).send({ code: 'INVITATION_AUTHORITY_INVALID' });
      }
      return noStore(reply).code(200).send({ document, retention, timeline });
    },
  );

  app.get<{ Params: { invitationId: string } }>(
    '/v1/admin/invitations/:invitationId/timeline',
    async (request, reply) => {
      const session = await authorize(request, dependencies, 'beta-invitations:manage', false);
      if (session === null) return hidden(reply);
      const events = (await dependencies.queries.timeline(request.params.invitationId)).map(
        publicTimeline,
      );
      if (events.some((event) => event === null)) {
        return noStore(reply).code(503).send({ code: 'INVITATION_AUTHORITY_INVALID' });
      }
      return noStore(reply).code(200).send({ events });
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
    const projected = publicResult(result, session, request, dependencies);
    return projected === null
      ? noStore(reply).code(503).send({ code: 'INVITATION_AUTHORITY_INVALID' })
      : noStore(reply).code(resultStatus(result, 201)).send(projected);
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
      const projected = publicResult(result, session, request, dependencies);
      return projected === null
        ? noStore(reply).code(503).send({ code: 'INVITATION_AUTHORITY_INVALID' })
        : noStore(reply).code(resultStatus(result, 200)).send(projected);
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
    const projected = publicResult(
      { ...result, batchAction: action },
      session,
      request,
      dependencies,
    );
    return projected === null
      ? noStore(reply).code(503).send({ code: 'INVITATION_AUTHORITY_INVALID' })
      : noStore(reply).code(resultStatus(result, 202)).send(projected);
  });
  return Promise.resolve();
};
