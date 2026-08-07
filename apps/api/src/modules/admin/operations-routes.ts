import { createHmac, timingSafeEqual } from 'node:crypto';

import type {
  AdminOperationsCapability,
  AdminOperationsDependencies,
  ChangeAdminConfigurationInput,
  ExecuteAdminIncidentRecoveryInput,
  ExecuteAdminPrivacyCaseInput,
  ResolveAdminOperationalConflictInput,
  SearchAdminOperationsInput,
  StartAdminSensitiveExportInput,
  StopAdminCapabilityInput,
  TransitionAdminOperationalJobInput,
} from '@liiiraa/control-plane-application';
import {
  changeAdminConfiguration,
  executeAdminIncidentRecovery,
  executeAdminPrivacyCase,
  resolveAdminOperationalConflict,
  searchAdminOperations,
  startAdminSensitiveExport,
  stopAdminCapability,
  transitionAdminOperationalJob,
} from '@liiiraa/control-plane-application/admin-operations';
import { controlPlaneDocumentValidator } from '@liiiraa/contracts-ts/runtime-control-plane-validator';
import type { AdminEnvironment } from '@liiiraa/control-plane-domain/admin/operations';
import type { FastifyInstance, FastifyReply, FastifyRequest } from 'fastify';

export interface AdminOperationsRouteSession {
  readonly sessionId: string;
  readonly actorId: string;
  readonly activeFunction: string;
  readonly capabilities: readonly AdminOperationsCapability[];
  readonly scopes: readonly string[];
}

export type AdminOperationsQueryResource =
  | 'queues'
  | 'views'
  | 'inbox'
  | 'jobs'
  | 'incidents'
  | 'exports'
  | 'configurations'
  | 'capacity'
  | 'environments'
  | 'audit-events'
  | 'alerts'
  | 'privacy-cases'
  | 'emergency-stops';

export interface AdminOperationsQueryPort {
  list(
    input: Readonly<{
      resource: AdminOperationsQueryResource;
      actorId: string;
      scopes: readonly string[];
      targetEnvironment: AdminEnvironment;
      limit: number;
      cursor?: string;
    }>,
  ): Promise<
    Readonly<{
      records: readonly Readonly<Record<string, unknown>>[];
      nextCursor: string | null;
      freshness: Readonly<Record<string, unknown>>;
    }>
  >;
}

export interface AdminOperationsFreshnessPort {
  current(
    input: Readonly<{
      actorId: string;
      scopes: readonly string[];
      targetEnvironment: AdminEnvironment;
      reconnectCursor?: string;
    }>,
  ): Promise<
    Readonly<{
      cursor: string;
      version: string;
      updatedAt: string;
      resources: readonly string[];
    }>
  >;
}

export interface AdminOperationsRouteHandlers {
  readonly search: typeof searchAdminOperations;
  readonly transitionJob: typeof transitionAdminOperationalJob;
  readonly resolveConflict: typeof resolveAdminOperationalConflict;
  readonly recoverIncident: typeof executeAdminIncidentRecovery;
  readonly startExport: typeof startAdminSensitiveExport;
  readonly changeConfiguration: typeof changeAdminConfiguration;
  readonly executePrivacy: typeof executeAdminPrivacyCase;
  readonly stopCapability: typeof stopAdminCapability;
}

export interface AdminOperationsRouteDependencies {
  readonly allowedOrigin: string;
  readonly csrfSecret: string;
  readonly operations: AdminOperationsDependencies;
  readonly handlers?: AdminOperationsRouteHandlers;
  readonly queries: AdminOperationsQueryPort;
  readonly freshness: AdminOperationsFreshnessPort;
  readonly resolveSession: (request: FastifyRequest) => Promise<AdminOperationsRouteSession | null>;
  readonly rateLimit: (key: string) => Promise<boolean>;
  readonly clock: Readonly<{ now(): Date }>;
}

const defaultHandlers: AdminOperationsRouteHandlers = Object.freeze({
  search: searchAdminOperations,
  transitionJob: transitionAdminOperationalJob,
  resolveConflict: resolveAdminOperationalConflict,
  recoverIncident: executeAdminIncidentRecovery,
  startExport: startAdminSensitiveExport,
  changeConfiguration: changeAdminConfiguration,
  executePrivacy: executeAdminPrivacyCase,
  stopCapability: stopAdminCapability,
});

const QUERY_CAPABILITY = Object.freeze({
  queues: 'admin-operations:jobs',
  views: 'admin-operations:search',
  inbox: 'admin-operations:search',
  jobs: 'admin-operations:jobs',
  incidents: 'admin-operations:incidents',
  exports: 'admin-operations:exports',
  configurations: 'admin-operations:configuration',
  capacity: 'admin-operations:search',
  environments: 'admin-operations:search',
  'audit-events': 'admin-operations:search',
  alerts: 'admin-operations:incidents',
  'privacy-cases': 'admin-operations:privacy',
  'emergency-stops': 'admin-operations:emergency',
} as const satisfies Readonly<Record<AdminOperationsQueryResource, AdminOperationsCapability>>);

const isRecord = (value: unknown): value is Readonly<Record<string, unknown>> =>
  typeof value === 'object' && value !== null && !Array.isArray(value);

const stringValue = (record: Readonly<Record<string, unknown>>, key: string): string =>
  typeof record[key] === 'string' ? record[key] : '';

const booleanValue = (record: Readonly<Record<string, unknown>>, key: string): boolean =>
  record[key] === true;

const noStore = (reply: FastifyReply): FastifyReply =>
  reply.header('cache-control', 'no-store, private');

const hidden = (reply: FastifyReply) => noStore(reply).code(404).send({ code: 'NOT_FOUND' });

const environmentValue = (value: unknown): AdminEnvironment | null =>
  value === 'development' || value === 'staging' || value === 'production' ? value : null;

const boundedString = (value: unknown, maximum = 256): string | null =>
  typeof value === 'string' && value.trim().length > 0 && value.length <= maximum
    ? value.trim()
    : null;

const boundedStringArray = (value: unknown, maximum = 32): readonly string[] | null =>
  Array.isArray(value) &&
  value.length <= maximum &&
  value.every((item) => typeof item === 'string' && item.length > 0 && item.length <= 128)
    ? value
    : null;

const firstTargetReference = (value: unknown): string | null => {
  if (!isRecord(value)) return null;
  const references = value['targetReferences'];
  if (!Array.isArray(references)) return null;
  const first: unknown = references[0];
  return typeof first === 'string' ? first : null;
};

const bigintValue = (value: unknown): bigint | null =>
  typeof value === 'string' && /^(?:0|[1-9][0-9]{0,18})$/u.test(value) ? BigInt(value) : null;

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
  dependencies: AdminOperationsRouteDependencies,
  capability: AdminOperationsCapability,
  mutation: boolean,
): Promise<AdminOperationsRouteSession | null> => {
  if (request.headers.origin !== dependencies.allowedOrigin) return null;
  if (mutation && !verifyCsrf(dependencies.csrfSecret, request.headers['x-csrf-token']))
    return null;
  const session = await dependencies.resolveSession(request);
  return session?.activeFunction === 'operations' && session.capabilities.includes(capability)
    ? session
    : null;
};

const limited = (
  request: FastifyRequest,
  dependencies: AdminOperationsRouteDependencies,
  actorId: string,
  operation: string,
) => dependencies.rateLimit(`${actorId}:${operation}:${request.ip}`);

const unsafeProjectionKey = (key: string): boolean =>
  !/(?:masked|redacted)/iu.test(key) && /(?:secret|token|password|raw|payload|email)/iu.test(key);

const publicValue = (value: unknown): unknown => {
  if (typeof value === 'bigint') return value.toString();
  if (Array.isArray(value)) return value.map(publicValue);
  if (!isRecord(value)) return value;
  return Object.fromEntries(
    Object.entries(value)
      .filter(([key]) => !unsafeProjectionKey(key))
      .map(([key, entry]) => [key, publicValue(entry)]),
  );
};

const resultStatus = (result: Readonly<Record<string, unknown>>, success: number): number => {
  if (result['ok'] === true) return success;
  switch (result['code']) {
    case 'STALE':
    case 'CONFLICT':
    case 'CONFLICT_PRESERVED':
      return 409;
    case 'PARTIAL':
    case 'PARTIAL_FAILURE':
      return 207;
    case 'RATE_LIMITED':
      return 429;
    case 'OPERATIONS_UNAVAILABLE':
    case 'DEGRADED':
    case 'FRESHNESS_UNCERTAIN':
      return 503;
    case 'NOT_FOUND':
    case 'JOB_NOT_FOUND':
    case 'CONFIGURATION_NOT_FOUND':
      return 404;
    default:
      return 403;
  }
};

const sendResult = (
  reply: FastifyReply,
  result: Readonly<Record<string, unknown>>,
  success: number,
) => {
  const projected = publicValue(result) as Readonly<Record<string, unknown>>;
  const failure = result['ok'] !== true;
  return noStore(reply)
    .code(resultStatus(result, success))
    .send(failure ? { ...projected, secretlyQueued: false } : projected);
};

interface ParsedAdminCommand {
  readonly commandId: string;
  readonly correlationId: string;
  readonly expectedVersion: bigint;
  readonly reason: string;
}

const adminCommand = (
  value: unknown,
  session: AdminOperationsRouteSession,
  action: string,
  target: string,
): ParsedAdminCommand | null => {
  if (!controlPlaneDocumentValidator(value) || !isRecord(value)) return null;
  const targets = value.targetReferences;
  const expectedVersion = bigintValue(value.expectedVersion);
  if (
    value.kind !== 'admin-operation-command' ||
    value.actorId !== session.actorId ||
    value.activeFunction !== session.activeFunction ||
    value.action !== action ||
    !Array.isArray(targets) ||
    !targets.includes(target) ||
    expectedVersion === null
  ) {
    return null;
  }
  const commandId = boundedString(value.commandId, 128);
  const correlationId = boundedString(value.correlationId, 128);
  const reason = boundedString(value.reason, 512);
  return commandId === null || correlationId === null || reason === null
    ? null
    : { commandId, correlationId, expectedVersion, reason };
};

const queryRecord = (value: unknown): Readonly<Record<string, unknown>> | null =>
  isRecord(value) ? value : null;

const queryEnvironment = (query: Readonly<Record<string, unknown>>): AdminEnvironment | null =>
  environmentValue(query['environment'] ?? query['targetEnvironment']);

const listQuery = (
  value: unknown,
): Readonly<{ limit: number; cursor?: string; environment: AdminEnvironment }> | null => {
  const query = queryRecord(value);
  if (query === null) return null;
  const environment = queryEnvironment(query);
  const limitText = typeof query['limit'] === 'string' ? query['limit'] : '25';
  const cursor = typeof query['cursor'] === 'string' ? query['cursor'] : undefined;
  if (
    environment === null ||
    !/^[0-9]{1,3}$/u.test(limitText) ||
    (cursor !== undefined && (cursor.length < 1 || cursor.length > 256))
  ) {
    return null;
  }
  const limit = Number(limitText);
  return limit < 1 || limit > 100
    ? null
    : { limit, environment, ...(cursor === undefined ? {} : { cursor }) };
};

const requireMutation = async (
  request: FastifyRequest,
  reply: FastifyReply,
  dependencies: AdminOperationsRouteDependencies,
  capability: AdminOperationsCapability,
  operation: string,
): Promise<AdminOperationsRouteSession | null> => {
  const session = await authorize(request, dependencies, capability, true);
  if (session === null) {
    hidden(reply);
    return null;
  }
  if (!(await limited(request, dependencies, session.actorId, operation))) {
    noStore(reply).code(429).send({ ok: false, code: 'RATE_LIMITED', secretlyQueued: false });
    return null;
  }
  return session;
};

export const registerAdminOperationsRoutes = (
  app: FastifyInstance,
  dependencies: AdminOperationsRouteDependencies,
): Promise<void> => {
  if (dependencies.csrfSecret.length < 32) throw new Error('ADMIN_OPERATIONS_CSRF_SECRET_REJECTED');
  const handlers = dependencies.handlers ?? defaultHandlers;

  app.get('/v1/admin/operations/search', async (request, reply) => {
    const session = await authorize(request, dependencies, 'admin-operations:search', false);
    if (session === null) return hidden(reply);
    if (!(await limited(request, dependencies, session.actorId, 'operations-search'))) {
      return noStore(reply).code(429).send({ ok: false, code: 'RATE_LIMITED' });
    }
    const query = queryRecord(request.query);
    const targetEnvironment = query === null ? null : queryEnvironment(query);
    const text = query === null ? null : boundedString(query['q'], 128);
    const viewKind = query?.['viewKind'] === 'personal' ? 'personal' : 'official';
    const viewId = query === null ? 'default' : (boundedString(query['viewId'], 128) ?? 'default');
    if (targetEnvironment === null || text === null) {
      return noStore(reply).code(400).send({ ok: false, code: 'REQUEST_INVALID' });
    }
    const input: SearchAdminOperationsInput = {
      actorId: session.actorId,
      query: text,
      targetEnvironment,
      view: { kind: viewKind, viewId },
    };
    const result = await handlers.search(dependencies.operations, input);
    return sendResult(reply, result, 200);
  });

  app.get('/v1/admin/operations/live', async (request, reply) => {
    const session = await authorize(request, dependencies, 'admin-operations:search', false);
    if (session === null) return hidden(reply);
    const query = queryRecord(request.query);
    const targetEnvironment = query === null ? null : queryEnvironment(query);
    if (targetEnvironment === null) {
      return noStore(reply).code(400).send({ code: 'REQUEST_INVALID' });
    }
    const headerCursor = request.headers['last-event-id'];
    const queryCursor = query === null ? undefined : query['cursor'];
    const reconnectCursor =
      typeof headerCursor === 'string'
        ? headerCursor
        : typeof queryCursor === 'string'
          ? queryCursor
          : undefined;
    if (reconnectCursor !== undefined && reconnectCursor.length > 256) {
      return noStore(reply).code(400).send({ code: 'REQUEST_INVALID' });
    }
    const current = await dependencies.freshness.current({
      actorId: session.actorId,
      scopes: session.scopes,
      targetEnvironment,
      ...(reconnectCursor === undefined ? {} : { reconnectCursor }),
    });
    const event = {
      cursor: current.cursor,
      version: current.version,
      updatedAt: current.updatedAt,
      resources: current.resources.slice(0, 32),
    };
    return noStore(reply)
      .header('content-type', 'text/event-stream; charset=utf-8')
      .header('connection', 'close')
      .send(`id: ${current.cursor}\nevent: invalidate\ndata: ${JSON.stringify(event)}\n\n`);
  });

  app.get<{ Params: { resource: string } }>(
    '/v1/admin/operations/:resource',
    async (request, reply) => {
      if (!Object.hasOwn(QUERY_CAPABILITY, request.params.resource)) return hidden(reply);
      const resource = request.params.resource as AdminOperationsQueryResource;
      const capability = QUERY_CAPABILITY[resource];
      const session = await authorize(request, dependencies, capability, false);
      if (session === null) return hidden(reply);
      const parsed = listQuery(request.query);
      if (parsed === null) return noStore(reply).code(400).send({ code: 'REQUEST_INVALID' });
      if (!(await limited(request, dependencies, session.actorId, `operations-${resource}`))) {
        return noStore(reply).code(429).send({ code: 'RATE_LIMITED' });
      }
      try {
        const result = await dependencies.queries.list({
          resource,
          actorId: session.actorId,
          scopes: session.scopes,
          targetEnvironment: parsed.environment,
          limit: parsed.limit,
          ...(parsed.cursor === undefined ? {} : { cursor: parsed.cursor }),
        });
        return await noStore(reply).code(200).send(publicValue(result));
      } catch {
        return noStore(reply)
          .code(503)
          .send({ ok: false, code: 'OPERATIONS_UNAVAILABLE', secretlyQueued: false });
      }
    },
  );

  app.post<{ Params: { jobId: string } }>(
    '/v1/admin/operations/jobs/:jobId/transitions',
    async (request, reply) => {
      const session = await requireMutation(
        request,
        reply,
        dependencies,
        'admin-operations:jobs',
        'job-transition',
      );
      if (session === null) return;
      if (!isRecord(request.body))
        return noStore(reply).code(400).send({ code: 'REQUEST_INVALID' });
      const body = request.body;
      const expectedVersion = bigintValue(body['expectedVersion']);
      const targetEnvironment = environmentValue(body['targetEnvironment']);
      const transition = body['transition'];
      if (
        expectedVersion === null ||
        targetEnvironment === null ||
        !['start', 'pause', 'resume', 'complete', 'partial', 'fail', 'cancel', 'retry'].includes(
          String(transition),
        )
      ) {
        return noStore(reply).code(400).send({ code: 'REQUEST_INVALID' });
      }
      const input = {
        actorId: session.actorId,
        commandId: stringValue(body, 'commandId'),
        correlationId: stringValue(body, 'correlationId'),
        jobId: request.params.jobId,
        expectedVersion,
        idempotencyKey: stringValue(body, 'idempotencyKey'),
        command: transition,
        ...(typeof body['progress'] === 'number' ? { progress: body['progress'] } : {}),
        ...(typeof body['receiptId'] === 'string' ? { receiptId: body['receiptId'] } : {}),
        ...(typeof body['safeCancellation'] === 'boolean'
          ? { safeCancellation: body['safeCancellation'] }
          : {}),
        connection: body['connection'],
        lastUpdatedAt: stringValue(body, 'lastUpdatedAt'),
        targetEnvironment,
        reason: stringValue(body, 'reason'),
      } as TransitionAdminOperationalJobInput;
      return sendResult(reply, await handlers.transitionJob(dependencies.operations, input), 200);
    },
  );

  app.post<{ Params: { subjectId: string } }>(
    '/v1/admin/operations/conflicts/:subjectId/resolve',
    async (request, reply) => {
      const session = await requireMutation(
        request,
        reply,
        dependencies,
        'admin-operations:conflicts',
        'conflict-resolve',
      );
      if (session === null) return;
      if (!isRecord(request.body))
        return noStore(reply).code(400).send({ code: 'REQUEST_INVALID' });
      const body = request.body;
      const expectedVersion = bigintValue(body['expectedVersion']);
      const actualVersion = bigintValue(body['actualVersion']);
      const targetEnvironment = environmentValue(body['targetEnvironment']);
      if (
        expectedVersion === null ||
        actualVersion === null ||
        targetEnvironment === null ||
        !isRecord(body['base']) ||
        !isRecord(body['local']) ||
        !isRecord(body['remote'])
      ) {
        return noStore(reply).code(400).send({ code: 'REQUEST_INVALID' });
      }
      const input: ResolveAdminOperationalConflictInput = {
        actorId: session.actorId,
        commandId: stringValue(body, 'commandId'),
        idempotencyKey: stringValue(body, 'idempotencyKey'),
        correlationId: stringValue(body, 'correlationId'),
        subjectId: request.params.subjectId,
        expectedVersion,
        actualVersion,
        base: body['base'],
        local: body['local'],
        remote: body['remote'],
        targetEnvironment,
      };
      return sendResult(reply, await handlers.resolveConflict(dependencies.operations, input), 200);
    },
  );

  app.post<{ Params: { incidentId: string } }>(
    '/v1/admin/operations/incidents/:incidentId/recover',
    async (request, reply) => {
      const session = await requireMutation(
        request,
        reply,
        dependencies,
        'admin-operations:incidents',
        'incident-recovery',
      );
      if (session === null) return;
      if (!isRecord(request.body))
        return noStore(reply).code(400).send({ code: 'REQUEST_INVALID' });
      const body = request.body;
      const parsed = adminCommand(
        body['command'],
        session,
        'resolve-incident',
        request.params.incidentId,
      );
      const targetEnvironment = environmentValue(body['targetEnvironment']);
      const key = boundedString(body['idempotencyKey'], 128);
      if (parsed === null || targetEnvironment === null || key === null) {
        return noStore(reply).code(400).send({ code: 'REQUEST_INVALID' });
      }
      const input: ExecuteAdminIncidentRecoveryInput = {
        actorId: session.actorId,
        commandId: parsed.commandId,
        correlationId: parsed.correlationId,
        incidentId: request.params.incidentId,
        severity: stringValue(body, 'severity'),
        ownerId: stringValue(body, 'ownerId'),
        substituteId: stringValue(body, 'substituteId'),
        ownerAvailable: booleanValue(body, 'ownerAvailable'),
        deadline: stringValue(body, 'deadline'),
        procedureVersion: stringValue(body, 'procedureVersion'),
        boundedOperation: booleanValue(body, 'boundedOperation'),
        previewed: booleanValue(body, 'previewed'),
        rehearsed: booleanValue(body, 'rehearsed'),
        riskApproved: booleanValue(body, 'riskApproved'),
        idempotencyKey: key,
        validationDefined: booleanValue(body, 'validationDefined'),
        compensationDefined: booleanValue(body, 'compensationDefined'),
        targetEnvironment,
      };
      return sendResult(reply, await handlers.recoverIncident(dependencies.operations, input), 202);
    },
  );

  app.post('/v1/admin/operations/exports', async (request, reply) => {
    const session = await requireMutation(
      request,
      reply,
      dependencies,
      'admin-operations:exports',
      'export-start',
    );
    if (session === null) return;
    if (!isRecord(request.body)) return noStore(reply).code(400).send({ code: 'REQUEST_INVALID' });
    const body = request.body;
    const target = firstTargetReference(body['command']);
    const parsed =
      typeof target === 'string'
        ? adminCommand(body['command'], session, 'export-sensitive-data', target)
        : null;
    const targetEnvironment = environmentValue(body['targetEnvironment']);
    const fields = boundedStringArray(body['fields']);
    const minimumFields = boundedStringArray(body['minimumFields']);
    const key = boundedString(body['idempotencyKey'], 128);
    if (
      parsed === null ||
      targetEnvironment === null ||
      fields === null ||
      minimumFields === null ||
      key === null
    ) {
      return noStore(reply).code(400).send({ code: 'REQUEST_INVALID' });
    }
    const input: StartAdminSensitiveExportInput = {
      actorId: session.actorId,
      commandId: parsed.commandId,
      idempotencyKey: key,
      correlationId: parsed.correlationId,
      purpose: stringValue(body, 'purpose'),
      fields,
      minimumFields,
      previewed: booleanValue(body, 'previewed'),
      masked: booleanValue(body, 'masked'),
      approved: booleanValue(body, 'approved'),
      encrypted: booleanValue(body, 'encrypted'),
      expiresAt: stringValue(body, 'expiresAt'),
      targetEnvironment,
    };
    return sendResult(reply, await handlers.startExport(dependencies.operations, input), 202);
  });

  app.post<{ Params: { configurationId: string } }>(
    '/v1/admin/operations/configurations/:configurationId/transitions',
    async (request, reply) => {
      const session = await requireMutation(
        request,
        reply,
        dependencies,
        'admin-operations:configuration',
        'configuration-transition',
      );
      if (session === null) return;
      if (!isRecord(request.body))
        return noStore(reply).code(400).send({ code: 'REQUEST_INVALID' });
      const body = request.body;
      const transition = body['transition'];
      const action = transition === 'rollback' ? 'rollback-configuration' : 'publish-configuration';
      const parsed = adminCommand(body['command'], session, action, request.params.configurationId);
      const sessionEnvironment = environmentValue(body['sessionEnvironment']);
      const targetEnvironment = environmentValue(body['targetEnvironment']);
      const integrationEnvironment = environmentValue(body['integrationEnvironment']);
      const key = boundedString(body['idempotencyKey'], 128);
      if (
        parsed === null ||
        sessionEnvironment === null ||
        targetEnvironment === null ||
        integrationEnvironment === null ||
        key === null ||
        !['publish', 'pause', 'resume', 'complete', 'rollback'].includes(String(transition))
      ) {
        return noStore(reply).code(400).send({ code: 'REQUEST_INVALID' });
      }
      const input = {
        actorId: session.actorId,
        commandId: parsed.commandId,
        idempotencyKey: key,
        correlationId: parsed.correlationId,
        configurationId: request.params.configurationId,
        expectedVersion: parsed.expectedVersion,
        command: transition,
        ...(typeof body['validated'] === 'boolean' ? { validated: body['validated'] } : {}),
        ...(typeof body['impactReviewed'] === 'boolean'
          ? { impactReviewed: body['impactReviewed'] }
          : {}),
        ...(typeof body['approved'] === 'boolean' ? { approved: body['approved'] } : {}),
        ...(typeof body['rollbackVersion'] === 'string'
          ? { rollbackVersion: body['rollbackVersion'] }
          : {}),
        sessionEnvironment,
        targetEnvironment,
        integrationEnvironment,
        productionStrongAccess: booleanValue(body, 'productionStrongAccess'),
        reason: parsed.reason,
      } as ChangeAdminConfigurationInput;
      return sendResult(
        reply,
        await handlers.changeConfiguration(dependencies.operations, input),
        200,
      );
    },
  );

  app.post<{ Params: { caseId: string } }>(
    '/v1/admin/operations/privacy-cases/:caseId/execute',
    async (request, reply) => {
      const session = await requireMutation(
        request,
        reply,
        dependencies,
        'admin-operations:privacy',
        'privacy-execute',
      );
      if (session === null) return;
      if (!isRecord(request.body))
        return noStore(reply).code(400).send({ code: 'REQUEST_INVALID' });
      const body = request.body;
      const parsed = adminCommand(
        body['command'],
        session,
        'execute-privacy-case',
        request.params.caseId,
      );
      const targetEnvironment = environmentValue(body['targetEnvironment']);
      const key = boundedString(body['idempotencyKey'], 128);
      if (parsed === null || targetEnvironment === null || key === null) {
        return noStore(reply).code(400).send({ code: 'REQUEST_INVALID' });
      }
      const input: ExecuteAdminPrivacyCaseInput = {
        actorId: session.actorId,
        commandId: parsed.commandId,
        idempotencyKey: key,
        correlationId: parsed.correlationId,
        caseId: request.params.caseId,
        identityVerified: booleanValue(body, 'identityVerified'),
        legalBasis: stringValue(body, 'legalBasis'),
        dataDiscovered: booleanValue(body, 'dataDiscovered'),
        mandatoryRetentionReviewed: booleanValue(body, 'mandatoryRetentionReviewed'),
        impactReviewed: booleanValue(body, 'impactReviewed'),
        approved: booleanValue(body, 'approved'),
        executionDefined: booleanValue(body, 'executionDefined'),
        finalReceiptRequired: booleanValue(body, 'finalReceiptRequired'),
        targetEnvironment,
      };
      return sendResult(reply, await handlers.executePrivacy(dependencies.operations, input), 202);
    },
  );

  app.post('/v1/admin/operations/emergency-stops', async (request, reply) => {
    const session = await requireMutation(
      request,
      reply,
      dependencies,
      'admin-operations:emergency',
      'emergency-stop',
    );
    if (session === null) return;
    if (!isRecord(request.body)) return noStore(reply).code(400).send({ code: 'REQUEST_INVALID' });
    const body = request.body;
    const targetEnvironment = environmentValue(body['targetEnvironment']);
    const expiresAt = boundedString(body['expiresAt'], 64);
    if (
      targetEnvironment === null ||
      expiresAt === null ||
      !Number.isFinite(Date.parse(expiresAt)) ||
      Date.parse(expiresAt) <= dependencies.clock.now().getTime()
    ) {
      return noStore(reply).code(400).send({ code: 'EMERGENCY_EXPIRY_INVALID' });
    }
    const input: StopAdminCapabilityInput = {
      actorId: session.actorId,
      commandId: stringValue(body, 'commandId'),
      idempotencyKey: stringValue(body, 'idempotencyKey'),
      correlationId: stringValue(body, 'correlationId'),
      capability: stringValue(body, 'capability'),
      strongAuth: booleanValue(body, 'strongAuth'),
      reason: stringValue(body, 'reason'),
      expiresAt,
      safeRestorationDefined: booleanValue(body, 'safeRestorationDefined'),
      targetEnvironment,
    };
    return sendResult(reply, await handlers.stopCapability(dependencies.operations, input), 202);
  });

  return Promise.resolve();
};
