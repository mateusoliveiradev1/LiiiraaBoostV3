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
  readonly governance: AdminGovernanceDependencies;
  readonly operations?: AdminApprovalRouteOperations;
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
): Promise<AdminGovernanceRouteSession | null> => {
  if (
    request.headers.origin !== dependencies.allowedOrigin ||
    !verifyCsrf(dependencies.csrfSecret, request.headers['x-csrf-token'])
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

const publicResult = (result: Readonly<Record<string, unknown>>) => ({
  ok: result['ok'] === true,
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
    return noStore(reply)
      .code(200)
      .send({ ok: true, outcome: result.outcome, impact: publicImpact(result.impact) });
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
    return noStore(reply).code(resultStatus(result)).send(publicResult(result));
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
      return noStore(reply).code(resultStatus(result)).send(publicResult(result));
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
    return noStore(reply).code(resultStatus(result)).send(publicResult(result));
  });

  return Promise.resolve();
};
