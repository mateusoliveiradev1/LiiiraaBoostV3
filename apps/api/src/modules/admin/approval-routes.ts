import { createHmac, timingSafeEqual } from 'node:crypto';

import type {
  AdminGovernanceDependencies,
  AdminGovernanceStepUpEvidence,
  AdminPermissionImpact,
} from '@liiiraa/control-plane-application';
import {
  approveAdminAccessRequest,
  cancelAdminApproval,
  previewAdminPermissionChange,
  reassignAdminApproval,
  requestAdminApproval,
} from '@liiiraa/control-plane-application/admin-governance';
import { controlPlaneDocumentValidator } from '@liiiraa/contracts-ts/runtime-control-plane-validator';
import type {
  AdminEnvironmentIdentityJson,
  AdminGovernanceProjectionJson,
  AdminPermissionImpactProjectionJson,
  AdminRiskLevelJson,
} from '@liiiraa/contracts-ts';
import { decideBreakGlassAdmission } from '@liiiraa/control-plane-domain/admin/governance';
import type { FastifyInstance, FastifyReply, FastifyRequest } from 'fastify';

import type { AdminGovernanceRouteSession } from './governance-routes.js';

export interface AdminApprovalRouteOperations {
  readonly preview: typeof previewAdminPermissionChange;
  readonly request: typeof requestAdminApproval;
  readonly approve: typeof approveAdminAccessRequest;
  readonly cancel: typeof cancelAdminApproval;
  readonly reassign: typeof reassignAdminApproval;
}

export interface AdminBreakGlassContext {
  readonly administratorCount: number;
  readonly risk: 'routine' | 'sensitive' | 'critical' | 'irreversible';
  readonly massAction: boolean;
  readonly strongFactor: string;
  readonly safetyDelayUntil: string;
  readonly alertsSent: boolean;
}

export interface AdminApprovalRouteDependencies {
  readonly allowedOrigin: string;
  readonly csrfSecret: string;
  readonly environment: AdminEnvironmentIdentityJson;
  readonly governance: AdminGovernanceDependencies;
  readonly operations?: AdminApprovalRouteOperations;
  readonly queries: Readonly<{
    listApprovals(input: Readonly<{ cursor?: string; limit: number }>): Promise<
      Readonly<{
        nextCursor: string | null;
        records: readonly Readonly<Record<string, unknown>>[];
      }>
    >;
    loadApproval(requestId: string): Promise<Readonly<Record<string, unknown>> | null>;
  }>;
  readonly resolveSession: (request: FastifyRequest) => Promise<AdminGovernanceRouteSession | null>;
  readonly resolveStepUp: (
    request: FastifyRequest,
  ) => Promise<AdminGovernanceStepUpEvidence | null>;
  readonly loadBreakGlassContext: (
    targetReference: string,
  ) => Promise<AdminBreakGlassContext | null>;
  readonly executeBreakGlass: (
    input: Readonly<{
      actorId: string;
      commandId: string;
      targetReference: string;
      reason: string;
      executeAt: string;
      expiresAt: string;
      authorizationContextId: string;
    }>,
  ) => Promise<Readonly<Record<string, unknown>>>;
  readonly rateLimit: (key: string) => Promise<boolean>;
  readonly clock: Readonly<{ now(): Date }>;
}

const defaultOperations: AdminApprovalRouteOperations = Object.freeze({
  preview: previewAdminPermissionChange,
  request: requestAdminApproval,
  approve: approveAdminAccessRequest,
  cancel: cancelAdminApproval,
  reassign: reassignAdminApproval,
});

const isRecord = (value: unknown): value is Readonly<Record<string, unknown>> =>
  typeof value === 'object' && value !== null && !Array.isArray(value);

const stringValue = (record: Readonly<Record<string, unknown>>, key: string): string =>
  typeof record[key] === 'string' ? record[key] : '';

const stringArray = (value: unknown): readonly string[] | null =>
  Array.isArray(value) && value.every((item: unknown) => typeof item === 'string') ? value : null;

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
  dependencies: AdminApprovalRouteDependencies,
  capability: 'admin-permissions:manage' | 'admin-approval:manage',
  mutation = true,
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
    session.simulation ||
    !session.governanceCapabilities.includes(capability)
  ) {
    return null;
  }
  return session;
};

const boundedText = (value: unknown, maximum = 256): string | null =>
  typeof value === 'string' && value.length >= 1 && value.length <= maximum ? value : null;

const versionText = (value: unknown): string | null => {
  const normalized = typeof value === 'bigint' ? value.toString() : value;
  return typeof normalized === 'string' && /^(?:0|[1-9][0-9]{0,18})$/u.test(normalized)
    ? normalized
    : typeof normalized === 'number' && Number.isSafeInteger(normalized) && normalized >= 0
      ? String(normalized)
      : null;
};

const correlationFor = (request: FastifyRequest): string => {
  const header = boundedText(request.headers['x-correlation-id'], 128);
  if (header !== null) return header;
  const requestId = request.id.replace(/[^A-Za-z0-9._:-]/gu, '-').slice(0, 128);
  return requestId.length > 0 ? requestId : 'admin-approval-request';
};

const projectionMetadata = (
  request: FastifyRequest,
  dependencies: AdminApprovalRouteDependencies,
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
    source: 'admin-approvals-api',
    sequence: aggregateVersion,
    observedAt: dependencies.clock.now().toISOString(),
  },
});

const riskLevel = (value: unknown): AdminRiskLevelJson =>
  value === 'irreversible'
    ? 'irreversible'
    : value === 'critical'
      ? 'critical'
      : value === 'sensitive'
        ? 'medium'
        : 'low';

const approvalProjection = (
  record: Readonly<Record<string, unknown>>,
  request: FastifyRequest,
  dependencies: AdminApprovalRouteDependencies,
): AdminGovernanceProjectionJson | null => {
  const id = boundedText(record['requestId'] ?? record['id'], 128);
  const version = versionText(record['version']);
  const author = boundedText(record['authorId'], 128);
  const beneficiary = boundedText(record['beneficiaryId'], 128);
  const capability = boundedText(record['capability'], 128);
  const scope = boundedText(record['scope'], 128);
  const status = record['status'];
  const expiresAt = boundedText(record['expiresAt']);
  if (
    id === null ||
    version === null ||
    author === null ||
    beneficiary === null ||
    capability === null ||
    scope === null ||
    !['pending', 'approved', 'cancelled', 'expired'].includes(String(status)) ||
    expiresAt === null ||
    Number.isNaN(Date.parse(expiresAt))
  ) {
    return null;
  }
  const approver = boundedText(record['assignedApproverId'], 128);
  const projection: AdminGovernanceProjectionJson = {
    ...projectionMetadata(request, dependencies, version, id),
    kind: 'admin-governance-projection',
    governanceRecordId: id,
    governanceKind: 'approval',
    state: status === 'cancelled' ? 'revoked' : (status as never),
    risk: riskLevel(record['risk']),
    authorReference: author,
    beneficiaryReference: beneficiary,
    eligibleApproverReferences: approver === null ? [] : [approver],
    impactedReferences: [capability, scope],
    expiresAt,
  };
  return controlPlaneDocumentValidator(projection) ? Object.freeze(projection) : null;
};

const impactProjection = (
  impact: Readonly<AdminPermissionImpact>,
  request: FastifyRequest,
  dependencies: AdminApprovalRouteDependencies,
): AdminPermissionImpactProjectionJson => ({
  ...projectionMetadata(
    request,
    dependencies,
    impact.membershipVersion.toString(),
    impact.impactId,
  ),
  kind: 'admin-permission-impact-projection',
  impactId: impact.impactId,
  identityReference: impact.identityId,
  before: {
    functions: [
      ...impact.before.functions,
    ] as AdminPermissionImpactProjectionJson['before']['functions'],
    capabilities: [
      ...impact.before.capabilities,
    ] as AdminPermissionImpactProjectionJson['before']['capabilities'],
    scopes: [...impact.before.scopes] as AdminPermissionImpactProjectionJson['before']['scopes'],
  },
  after: {
    functions: [
      ...impact.after.functions,
    ] as AdminPermissionImpactProjectionJson['after']['functions'],
    capabilities: [
      ...impact.after.capabilities,
    ] as AdminPermissionImpactProjectionJson['after']['capabilities'],
    scopes: [...impact.after.scopes] as AdminPermissionImpactProjectionJson['after']['scopes'],
  },
  conflicts: [],
  affectedData: [
    ...new Set([...impact.before.scopes, ...impact.after.scopes]),
  ] as AdminPermissionImpactProjectionJson['affectedData'],
  sessionReferences: [],
  invalidatesPendingApprovals: impact.invalidatesPendingApprovals,
  projectedAt: impact.projectedAt,
});

const listQuery = (query: unknown): Readonly<{ cursor?: string; limit: number }> | null => {
  if (!isRecord(query)) return { limit: 25 };
  const value = typeof query['limit'] === 'string' ? query['limit'] : '25';
  if (!/^[0-9]{1,3}$/u.test(value)) return null;
  const limit = Number(value);
  const cursor = typeof query['cursor'] === 'string' ? query['cursor'] : undefined;
  return limit >= 1 && limit <= 100 && (cursor === undefined || cursor.length <= 256)
    ? { limit, ...(cursor === undefined ? {} : { cursor }) }
    : null;
};

interface ApprovalCommand {
  readonly commandId: string;
  readonly targetReference: string;
  readonly reason: string;
  readonly expectedVersion: bigint;
}

const approvalCommand = (
  value: unknown,
  session: AdminGovernanceRouteSession,
  action: 'update-access' | 'request-approval',
  target?: string,
): ApprovalCommand | null => {
  if (!controlPlaneDocumentValidator(value) || !isRecord(value)) return null;
  const targets = stringArray(value.targetReferences);
  const expected = value.expectedVersion;
  if (
    value.kind !== 'admin-operation-command' ||
    value.actorId !== session.actorId ||
    value.activeFunction !== session.activeFunction ||
    value.action !== action ||
    targets?.length !== 1 ||
    (target !== undefined && targets[0] !== target) ||
    typeof expected !== 'string' ||
    !/^(?:0|[1-9][0-9]{0,18})$/u.test(expected)
  ) {
    return null;
  }
  return {
    commandId: stringValue(value, 'commandId'),
    targetReference: targets[0] ?? '',
    reason: stringValue(value, 'reason'),
    expectedVersion: BigInt(expected),
  };
};

const freshStepUp = (
  evidence: AdminGovernanceStepUpEvidence | null,
  session: AdminGovernanceRouteSession,
  authorizationContextId: string,
  now: string,
): evidence is AdminGovernanceStepUpEvidence => {
  if (
    evidence?.actorId !== session.actorId ||
    evidence.authorizationContextId !== authorizationContextId
  ) {
    return false;
  }
  const at = Date.parse(now);
  const verified = Date.parse(evidence.verifiedAt);
  const expires = Date.parse(evidence.expiresAt);
  return (
    Number.isFinite(at) &&
    Number.isFinite(verified) &&
    Number.isFinite(expires) &&
    verified <= at &&
    at - verified <= 5 * 60 * 1_000 &&
    at < expires
  );
};

const publicResult = (
  result: Readonly<Record<string, unknown>>,
  document?: AdminGovernanceProjectionJson,
) => ({
  ok: result['ok'] === true,
  ...(document === undefined ? {} : { document }),
  ...(result['outcome'] === undefined ? {} : { outcome: result['outcome'] }),
  ...(result['receiptId'] === undefined ? {} : { receiptId: result['receiptId'] }),
  ...(result['code'] === undefined ? {} : { code: result['code'] }),
});

const resultStatus = (result: Readonly<Record<string, unknown>>): number =>
  result['ok'] === true ? 200 : result['code'] === 'STALE' ? 409 : 403;

const publicImpact = (impact: Readonly<AdminPermissionImpact>) => ({
  impactId: impact.impactId,
  identityId: impact.identityId,
  membershipVersion:
    typeof impact.membershipVersion === 'bigint'
      ? impact.membershipVersion.toString()
      : impact.membershipVersion,
  before: impact.before,
  after: impact.after,
  gainedFunctions: impact.gainedFunctions,
  lostFunctions: impact.lostFunctions,
  gainedCapabilities: impact.gainedCapabilities,
  lostCapabilities: impact.lostCapabilities,
  gainedScopes: impact.gainedScopes,
  lostScopes: impact.lostScopes,
  affectedSessions: impact.affectedSessions,
  invalidatesPendingApprovals: impact.invalidatesPendingApprovals,
  projectedAt: impact.projectedAt,
});

export const registerAdminApprovalRoutes = (
  app: FastifyInstance,
  dependencies: AdminApprovalRouteDependencies,
): Promise<void> => {
  if (dependencies.csrfSecret.length < 32) throw new Error('ADMIN_APPROVAL_CSRF_REJECTED');
  const operations = dependencies.operations ?? defaultOperations;

  app.get('/v1/admin/governance/approvals', async (request, reply) => {
    const session = await authorize(request, dependencies, 'admin-approval:manage', false);
    if (session === null) return hidden(reply);
    const parsed = listQuery(request.query);
    if (parsed === null) return noStore(reply).code(400).send({ code: 'REQUEST_INVALID' });
    if (!(await dependencies.rateLimit(`${session.actorId}:approval-list:${request.ip}`))) {
      return noStore(reply).code(429).send({ code: 'RATE_LIMITED' });
    }
    const result = await dependencies.queries.listApprovals(parsed);
    const records = result.records.map((record) =>
      approvalProjection(record, request, dependencies),
    );
    if (records.some((record) => record === null)) {
      return noStore(reply).code(503).send({ code: 'APPROVAL_AUTHORITY_INVALID' });
    }
    return noStore(reply).code(200).send({
      records,
      freshness: records[0]?.freshness,
      nextCursor: result.nextCursor,
    });
  });

  app.post('/v1/admin/governance/impact', async (request, reply) => {
    const session = await authorize(request, dependencies, 'admin-permissions:manage');
    if (session === null || !isRecord(request.body)) return hidden(reply);
    const identityId = stringValue(request.body, 'identityId');
    const parsed = approvalCommand(request.body['command'], session, 'update-access', identityId);
    const proposed = isRecord(request.body['proposed']) ? request.body['proposed'] : null;
    const functions = proposed === null ? null : stringArray(proposed['functions']);
    const capabilities = proposed === null ? null : stringArray(proposed['capabilities']);
    const scopes = proposed === null ? null : stringArray(proposed['scopes']);
    if (parsed === null || functions === null || capabilities === null || scopes === null) {
      return noStore(reply).code(400).send({ code: 'REQUEST_INVALID' });
    }
    const result = await operations.preview(dependencies.governance, {
      actorId: session.actorId,
      identityId,
      proposed: {
        functions: functions as never,
        capabilities: capabilities as never,
        scopes: scopes as never,
      },
    });
    if (!result.ok) return noStore(reply).code(403).send(publicResult(result));
    const document = impactProjection(result.impact, request, dependencies);
    if (!controlPlaneDocumentValidator(document)) {
      return noStore(reply).code(503).send({ code: 'IMPACT_AUTHORITY_INVALID' });
    }
    return noStore(reply)
      .code(200)
      .send({
        ok: true,
        outcome: result.outcome,
        impact: publicImpact(result.impact),
        document,
      });
  });

  app.post('/v1/admin/governance/approvals', async (request, reply) => {
    const session = await authorize(request, dependencies, 'admin-approval:manage');
    if (session === null || !isRecord(request.body)) return hidden(reply);
    const requestId = stringValue(request.body, 'requestId');
    const parsed = approvalCommand(request.body['command'], session, 'request-approval', requestId);
    if (parsed === null) return noStore(reply).code(400).send({ code: 'REQUEST_INVALID' });
    const result = await operations.request(dependencies.governance, {
      actorId: session.actorId,
      commandId: parsed.commandId,
      requestId,
      beneficiaryId: stringValue(request.body, 'beneficiaryId'),
      capability: stringValue(request.body, 'capability'),
      scope: stringValue(request.body, 'scope'),
      risk: stringValue(request.body, 'risk') as
        'routine' | 'sensitive' | 'critical' | 'irreversible',
      expiresAt: stringValue(request.body, 'expiresAt'),
      ...(typeof request.body['assignedApproverId'] === 'string'
        ? { assignedApproverId: request.body['assignedApproverId'] }
        : {}),
    });
    const document = approvalProjection(
      {
        requestId,
        version: '1',
        authorId: session.actorId,
        beneficiaryId: stringValue(request.body, 'beneficiaryId'),
        capability: stringValue(request.body, 'capability'),
        scope: stringValue(request.body, 'scope'),
        risk: request.body['risk'],
        status: 'pending',
        expiresAt: stringValue(request.body, 'expiresAt'),
        assignedApproverId: request.body['assignedApproverId'],
      },
      request,
      dependencies,
    );
    return document === null
      ? noStore(reply).code(503).send({ code: 'APPROVAL_AUTHORITY_INVALID' })
      : noStore(reply).code(resultStatus(result)).send(publicResult(result, document));
  });

  const approvalMutation =
    (action: 'approve' | 'cancel' | 'reassign') =>
    async (request: FastifyRequest<{ Params: { requestId: string } }>, reply: FastifyReply) => {
      const session = await authorize(request, dependencies, 'admin-approval:manage');
      if (session === null || !isRecord(request.body)) return hidden(reply);
      const parsed = approvalCommand(
        request.body['command'],
        session,
        'request-approval',
        request.params.requestId,
      );
      const authorizationContextId = stringValue(request.body, 'authorizationContextId');
      const evidence = await dependencies.resolveStepUp(request);
      const at = dependencies.clock.now().toISOString();
      if (
        parsed === null ||
        !freshStepUp(evidence, session, authorizationContextId, at) ||
        !(await dependencies.rateLimit(`${session.actorId}:approval-${action}:${request.ip}`))
      ) {
        return noStore(reply).code(403).send({ ok: false, code: 'STEP_UP_INVALID' });
      }
      const common = {
        actorId: session.actorId,
        commandId: parsed.commandId,
        requestId: request.params.requestId,
        reason: parsed.reason,
        authorizationContextId,
        stepUp: evidence,
      };
      const result =
        action === 'approve'
          ? await operations.approve(dependencies.governance, {
              ...common,
              capability: stringValue(request.body, 'capability'),
              scopes: stringArray(request.body['scopes']) ?? [],
            })
          : action === 'cancel'
            ? await operations.cancel(dependencies.governance, common)
            : await operations.reassign(dependencies.governance, {
                ...common,
                newApproverId: stringValue(request.body, 'newApproverId'),
              });
      const record = await dependencies.queries.loadApproval(request.params.requestId);
      const document = record === null ? null : approvalProjection(record, request, dependencies);
      return document === null
        ? noStore(reply).code(503).send({ code: 'APPROVAL_AUTHORITY_INVALID' })
        : noStore(reply).code(resultStatus(result)).send(publicResult(result, document));
    };

  app.post<{ Params: { requestId: string } }>(
    '/v1/admin/governance/approvals/:requestId/approve',
    approvalMutation('approve'),
  );
  app.post<{ Params: { requestId: string } }>(
    '/v1/admin/governance/approvals/:requestId/cancel',
    approvalMutation('cancel'),
  );
  app.post<{ Params: { requestId: string } }>(
    '/v1/admin/governance/approvals/:requestId/reassign',
    approvalMutation('reassign'),
  );

  app.post('/v1/admin/governance/break-glass', async (request, reply) => {
    const session = await authorize(request, dependencies, 'admin-approval:manage');
    if (session === null || !isRecord(request.body)) return hidden(reply);
    const parsed = approvalCommand(request.body['command'], session, 'request-approval');
    const authorizationContextId = stringValue(request.body, 'authorizationContextId');
    const evidence = await dependencies.resolveStepUp(request);
    const requestedAt = dependencies.clock.now().toISOString();
    if (parsed === null || !freshStepUp(evidence, session, authorizationContextId, requestedAt)) {
      return noStore(reply).code(403).send({ ok: false, code: 'STEP_UP_INVALID' });
    }
    const context = await dependencies.loadBreakGlassContext(parsed.targetReference);
    if (context === null) return hidden(reply);
    const executeAt = stringValue(request.body, 'executeAt');
    const expiresAt = stringValue(request.body, 'expiresAt');
    const admission = decideBreakGlassAdmission({
      actorId: session.actorId,
      administratorCount: context.administratorCount,
      risk: context.risk,
      massAction: context.massAction,
      strongFactor: context.strongFactor,
      reauthenticatedAt: evidence.verifiedAt,
      reason: parsed.reason,
      requestedAt,
      safetyDelayUntil: context.safetyDelayUntil,
      executeAt,
      expiresAt,
      alertsSent: context.alertsSent,
    });
    if (!admission.allowed) return noStore(reply).code(403).send(admission);
    const result = await dependencies.executeBreakGlass({
      actorId: session.actorId,
      commandId: parsed.commandId,
      targetReference: parsed.targetReference,
      reason: parsed.reason,
      executeAt,
      expiresAt,
      authorizationContextId,
    });
    const document = approvalProjection(
      {
        requestId: parsed.commandId,
        version: '1',
        authorId: session.actorId,
        beneficiaryId: parsed.targetReference,
        capability: 'break-glass',
        scope: parsed.targetReference,
        risk: 'critical',
        status: 'approved',
        expiresAt,
      },
      request,
      dependencies,
    );
    return document === null
      ? noStore(reply).code(503).send({ code: 'APPROVAL_AUTHORITY_INVALID' })
      : noStore(reply).code(resultStatus(result)).send(publicResult(result, document));
  });

  return Promise.resolve();
};
