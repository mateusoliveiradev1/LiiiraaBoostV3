import type {
  RecoverAccountResult,
  RecoveryDependencies,
  SecurityMethodDependencies,
} from '@liiiraa/control-plane-application';
import {
  authorizeScopedSensitiveAction,
  disableSecurityMethod,
  enrollSecurityMethod,
  recoverAccount,
  type RecoveryState,
  type SensitiveAction,
  type StepUpEvidence,
} from '@liiiraa/control-plane-application';
import type { FastifyInstance, FastifyReply, FastifyRequest } from 'fastify';

export interface SecurityRouteDependencies {
  readonly recovery: RecoveryDependencies;
  readonly securityMethods: SecurityMethodDependencies;
  readonly resolveSessionActor: (
    request: FastifyRequest,
  ) => Promise<Readonly<{ accountId: string; sessionId: string }> | null>;
  readonly resolveSecurityReviewer: (
    request: FastifyRequest,
  ) => Promise<Readonly<{ reviewerId: string }> | null>;
  readonly verifyRecoveryEmailEvidence: (
    input: Readonly<{
      accountId: string;
      email: string;
      evidenceValue: string;
    }>,
  ) => Promise<boolean>;
}

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null && !Array.isArray(value);

const stringValue = (record: Record<string, unknown>, key: string): string =>
  typeof record[key] === 'string' ? record[key] : '';

const sensitiveActions = new Set<SensitiveAction>([
  'ordinary-access',
  'security-method-change',
  'device-transfer',
  'refund',
  'protected-data-access',
]);

const sensitiveAction = (value: unknown): SensitiveAction | null =>
  typeof value === 'string' && sensitiveActions.has(value as SensitiveAction)
    ? (value as SensitiveAction)
    : null;

const stepUpEvidence = (value: unknown): StepUpEvidence | undefined => {
  if (!isRecord(value)) return undefined;
  const action = sensitiveAction(value['action']);
  const factor = stringValue(value, 'factor');
  const verifiedAt = stringValue(value, 'verifiedAt');
  const expiresAt = stringValue(value, 'expiresAt');
  if (!action || !factor || !verifiedAt || !expiresAt) return undefined;
  return { action, factor, verifiedAt, expiresAt };
};

const serializeState = (state: RecoveryState) => ({
  ...state,
  version: state.version.toString(),
});

const sendRecovery = (reply: FastifyReply, result: RecoverAccountResult, successStatus: number) => {
  if (!result.ok) {
    const status =
      result.code === 'RECOVERY_NOT_FOUND'
        ? 404
        : result.code === 'RECOVERY_CODE_ALREADY_USED'
          ? 409
          : 422;
    return reply.code(status).send(result);
  }
  return reply.code(successStatus).send({ ...result, state: serializeState(result.state) });
};

export const registerSecurityRoutes = (
  app: FastifyInstance,
  dependencies: SecurityRouteDependencies,
): Promise<void> => {
  app.post('/v1/identity/security-methods/enroll', async (request, reply) => {
    const actor = await dependencies.resolveSessionActor(request);
    if (!actor || !isRecord(request.body)) {
      return reply.code(401).send({ code: 'AUTHORIZATION_FAILED' });
    }
    const result = await enrollSecurityMethod(dependencies.securityMethods, {
      accountId: actor.accountId,
      sessionId: actor.sessionId,
      factor: stringValue(request.body, 'factor'),
      credentialReference: stringValue(request.body, 'credentialReference'),
      stepUpFactor: stringValue(request.body, 'stepUpFactor'),
      stepUpProof: stringValue(request.body, 'stepUpProof'),
      ...(stringValue(request.body, 'recoveryHoldUntil')
        ? { recoveryHoldUntil: stringValue(request.body, 'recoveryHoldUntil') }
        : {}),
    });
    if (!result.ok) return reply.code(422).send(result);
    return reply.code(201).send({
      ok: true,
      method: { ...result.method, version: result.method.version.toString() },
      stepUp: result.stepUp,
    });
  });

  app.post<{ Params: { methodId: string } }>(
    '/v1/identity/security-methods/:methodId/disable',
    async (request, reply) => {
      const actor = await dependencies.resolveSessionActor(request);
      if (!actor || !isRecord(request.body)) {
        return reply.code(401).send({ code: 'AUTHORIZATION_FAILED' });
      }
      const result = await disableSecurityMethod(dependencies.securityMethods, {
        accountId: actor.accountId,
        sessionId: actor.sessionId,
        methodId: request.params.methodId,
        stepUpFactor: stringValue(request.body, 'stepUpFactor'),
        stepUpProof: stringValue(request.body, 'stepUpProof'),
        ...(stringValue(request.body, 'recoveryHoldUntil')
          ? { recoveryHoldUntil: stringValue(request.body, 'recoveryHoldUntil') }
          : {}),
      });
      return result.ok ? reply.code(200).send(result) : reply.code(422).send(result);
    },
  );

  app.post('/v1/identity/security/authorize', async (request, reply) => {
    const actor = await dependencies.resolveSessionActor(request);
    if (!actor || !isRecord(request.body)) {
      return reply.code(401).send({ code: 'AUTHORIZATION_FAILED' });
    }
    const action = sensitiveAction(request.body['action']);
    if (!action) return reply.code(400).send({ code: 'INVALID_ACTION' });
    const stepUp = stepUpEvidence(request.body['stepUp']);
    const authorization = authorizeScopedSensitiveAction(dependencies.securityMethods.clock, {
      action,
      ...(stringValue(request.body, 'recoveryHoldUntil')
        ? { recoveryHoldUntil: stringValue(request.body, 'recoveryHoldUntil') }
        : {}),
      ...(stepUp ? { stepUp } : {}),
    });
    return authorization.allowed
      ? reply.code(200).send(authorization)
      : reply.code(403).send(authorization);
  });

  app.post('/v1/identity/recoveries', async (request, reply) => {
    if (!isRecord(request.body)) return reply.code(400).send({ code: 'INVALID_REQUEST' });
    const evidence = stringValue(request.body, 'evidence');
    if (!['verified-email', 'recovery-code', 'all-factors-lost'].includes(evidence)) {
      return reply.code(400).send({ code: 'INVALID_REQUEST' });
    }
    const accountId = stringValue(request.body, 'accountId');
    const email = stringValue(request.body, 'email');
    const evidenceValue = stringValue(request.body, 'evidenceValue');
    const verifiedEmail =
      evidence === 'verified-email'
        ? await dependencies.verifyRecoveryEmailEvidence({ accountId, email, evidenceValue })
        : false;
    const result = await recoverAccount(dependencies.recovery, {
      kind: 'request',
      accountId,
      email,
      evidence: evidence as 'verified-email' | 'recovery-code' | 'all-factors-lost',
      ...(evidenceValue ? { evidenceValue } : {}),
      verifiedEmail,
    });
    return sendRecovery(
      reply,
      result,
      result.ok && result.state.status === 'pending-review' ? 202 : 200,
    );
  });

  app.post<{ Params: { accountId: string } }>(
    '/v1/identity/recoveries/:accountId/review',
    async (request, reply) => {
      const reviewer = await dependencies.resolveSecurityReviewer(request);
      if (!reviewer || !isRecord(request.body)) {
        return reply.code(401).send({ code: 'SECURITY_REVIEW_REQUIRED' });
      }
      return sendRecovery(
        reply,
        await recoverAccount(dependencies.recovery, {
          kind: 'review',
          accountId: request.params.accountId,
          reviewedBy: reviewer.reviewerId,
          approved: request.body['approved'] === true,
        }),
        200,
      );
    },
  );

  app.post<{ Params: { accountId: string } }>(
    '/v1/identity/recoveries/:accountId/contest',
    async (request, reply) => {
      const actor = await dependencies.resolveSessionActor(request);
      if (actor?.accountId !== request.params.accountId || !isRecord(request.body)) {
        return reply.code(401).send({ code: 'AUTHORIZATION_FAILED' });
      }
      return sendRecovery(
        reply,
        await recoverAccount(dependencies.recovery, {
          kind: 'contest',
          accountId: request.params.accountId,
          extendUntil: stringValue(request.body, 'extendUntil'),
        }),
        200,
      );
    },
  );

  app.post<{ Params: { accountId: string } }>(
    '/v1/identity/recoveries/:accountId/risk-extension',
    async (request, reply) => {
      const reviewer = await dependencies.resolveSecurityReviewer(request);
      if (!reviewer || !isRecord(request.body)) {
        return reply.code(401).send({ code: 'SECURITY_REVIEW_REQUIRED' });
      }
      return sendRecovery(
        reply,
        await recoverAccount(dependencies.recovery, {
          kind: 'extend-risk',
          accountId: request.params.accountId,
          extendUntil: stringValue(request.body, 'extendUntil'),
        }),
        200,
      );
    },
  );
  return Promise.resolve();
};
