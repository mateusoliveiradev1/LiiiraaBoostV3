import { createHash, createHmac, timingSafeEqual } from 'node:crypto';

import type { IdentityActor } from '@liiiraa/control-plane-adapters';
import type { FastifyInstance, FastifyReply, FastifyRequest } from 'fastify';

import type { StagingStrongAuth } from '../../staging/strong-auth.ts';

export interface StrongAuthRouteDependencies {
  readonly allowedOrigins: readonly string[];
  readonly authority: StagingStrongAuth;
  readonly clock?: Readonly<{ now(): Date }>;
  readonly csrfSecret: string;
  readonly resolveActor: (request: FastifyRequest) => Promise<IdentityActor | null>;
}

type PlanProofAction =
  'apply-transactional-plan' | 'enable-advanced-preference' | 'revoke-advanced-preference';

interface OperationVersionBinding {
  readonly operationId: string;
  readonly version: string;
}

interface TransactionalPlanBinding {
  readonly kind: 'transactional-plan';
  readonly deviceId: string;
  readonly operationVersions: readonly OperationVersionBinding[];
  readonly planFingerprint: string;
}

interface AdvancedPreferenceBinding {
  readonly kind: 'advanced-preference';
  readonly deviceId: string;
  readonly hardwareFingerprint: string;
  readonly securityPostureFingerprint: string;
}

type PlanProofBinding = TransactionalPlanBinding | AdvancedPreferenceBinding;

interface ClosedPlanProofScope {
  readonly action: PlanProofAction;
  readonly authorizationContextId: string;
  readonly binding: PlanProofBinding;
  readonly resource: 'desktop-plan' | 'desktop-risk-preference';
  readonly targetFingerprint: string;
}

const isRecord = (value: unknown): value is Readonly<Record<string, unknown>> =>
  typeof value === 'object' && value !== null && !Array.isArray(value);
const text = (record: Readonly<Record<string, unknown>>, key: string): string =>
  typeof record[key] === 'string' ? record[key] : '';
const exactKeys = (record: Readonly<Record<string, unknown>>, keys: readonly string[]): boolean => {
  const actual = Object.keys(record).sort();
  const expected = [...keys].sort();
  return actual.length === expected.length && actual.every((key, index) => key === expected[index]);
};
const noStore = (reply: FastifyReply): FastifyReply =>
  reply.header('cache-control', 'no-store, private');

const BOUNDED_PROOF_VALUE = /^[A-Za-z0-9._:-]{1,128}$/u;
const PLAN_PROOF_ACTIONS = new Set<PlanProofAction>([
  'apply-transactional-plan',
  'enable-advanced-preference',
  'revoke-advanced-preference',
]);
const boundedProofValue = (value: unknown): value is string =>
  typeof value === 'string' && BOUNDED_PROOF_VALUE.test(value);
const fingerprint = (canonical: string): string =>
  createHash('sha256').update(canonical, 'utf8').digest('hex');

const parseOperationVersions = (value: unknown): readonly OperationVersionBinding[] | null => {
  if (!Array.isArray(value) || value.length < 1 || value.length > 64) return null;
  const versions: OperationVersionBinding[] = [];
  const operationIds = new Set<string>();
  for (const candidate of value) {
    if (
      !isRecord(candidate) ||
      !exactKeys(candidate, ['operationId', 'version']) ||
      !boundedProofValue(candidate['operationId']) ||
      !boundedProofValue(candidate['version']) ||
      operationIds.has(candidate['operationId'])
    )
      return null;
    operationIds.add(candidate['operationId']);
    versions.push({ operationId: candidate['operationId'], version: candidate['version'] });
  }
  return versions.sort((left, right) =>
    left.operationId < right.operationId ? -1 : left.operationId > right.operationId ? 1 : 0,
  );
};

const parseClosedPlanProofScope = (
  body: Readonly<Record<string, unknown>>,
  credentialField: 'code' | 'receipt',
): ClosedPlanProofScope | null => {
  const action = body['action'];
  if (typeof action !== 'string' || !PLAN_PROOF_ACTIONS.has(action as PlanProofAction)) return null;
  if (
    !exactKeys(body, [
      'action',
      'authorizationContextId',
      'binding',
      'resource',
      credentialField,
    ]) ||
    !boundedProofValue(body['authorizationContextId']) ||
    !isRecord(body['binding'])
  )
    return null;
  const binding = body['binding'];
  if (action === 'apply-transactional-plan') {
    if (
      body['resource'] !== 'desktop-plan' ||
      !exactKeys(binding, ['deviceId', 'kind', 'operationVersions', 'planFingerprint']) ||
      binding['kind'] !== 'transactional-plan' ||
      !boundedProofValue(binding['deviceId']) ||
      !boundedProofValue(binding['planFingerprint'])
    )
      return null;
    const operationVersions = parseOperationVersions(binding['operationVersions']);
    if (operationVersions === null) return null;
    const targetFingerprint = fingerprint(
      [
        action,
        binding['deviceId'],
        binding['planFingerprint'],
        operationVersions.map(({ operationId, version }) => `${operationId}@${version}`).join(';'),
      ].join('|'),
    );
    return {
      action,
      authorizationContextId: body['authorizationContextId'],
      binding: {
        kind: 'transactional-plan',
        deviceId: binding['deviceId'],
        operationVersions,
        planFingerprint: binding['planFingerprint'],
      },
      resource: 'desktop-plan',
      targetFingerprint,
    };
  }
  if (
    body['resource'] !== 'desktop-risk-preference' ||
    !exactKeys(binding, [
      'deviceId',
      'hardwareFingerprint',
      'kind',
      'securityPostureFingerprint',
    ]) ||
    binding['kind'] !== 'advanced-preference' ||
    !boundedProofValue(binding['deviceId']) ||
    !boundedProofValue(binding['hardwareFingerprint']) ||
    !boundedProofValue(binding['securityPostureFingerprint'])
  )
    return null;
  const targetFingerprint = fingerprint(
    [
      action,
      binding['deviceId'],
      binding['hardwareFingerprint'],
      binding['securityPostureFingerprint'],
    ].join('|'),
  );
  return {
    action: action as Exclude<PlanProofAction, 'apply-transactional-plan'>,
    authorizationContextId: body['authorizationContextId'],
    binding: {
      kind: 'advanced-preference',
      deviceId: binding['deviceId'],
      hardwareFingerprint: binding['hardwareFingerprint'],
      securityPostureFingerprint: binding['securityPostureFingerprint'],
    },
    resource: 'desktop-risk-preference',
    targetFingerprint,
  };
};

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
      : noStore(reply)
          .code(200)
          .send(await dependencies.authority.status(actor));
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
    const requestedAction = text(request.body, 'action');
    const closedScope = PLAN_PROOF_ACTIONS.has(requestedAction as PlanProofAction)
      ? parseClosedPlanProofScope(request.body, 'code')
      : null;
    if (PLAN_PROOF_ACTIONS.has(requestedAction as PlanProofAction) && closedScope === null)
      return noStore(reply).code(422).send({ code: 'PROOF_SCOPE_REJECTED' });
    const result = await dependencies.authority.verifyTotpStepUp(
      actor,
      closedScope === null
        ? {
            action: requestedAction,
            authorizationContextId: text(request.body, 'authorizationContextId'),
            code: text(request.body, 'code'),
            redactedTarget: text(request.body, 'redactedTarget'),
            resource: text(request.body, 'resource'),
          }
        : {
            action: closedScope.action,
            authorizationContextId: closedScope.authorizationContextId,
            code: text(request.body, 'code'),
            redactedTarget: closedScope.targetFingerprint,
            resource: closedScope.resource,
          },
    );
    return result.ok
      ? noStore(reply).code(200).send(result)
      : noStore(reply).code(422).send(result);
  });

  app.post('/v1/identity/strong-auth/plan-proof/consume', async (request, reply) => {
    const actor = await dependencies.resolveActor(request);
    if (
      actor === null ||
      (!admittedMutation(request) && actor.sessionKind !== 'desktop') ||
      !isRecord(request.body)
    )
      return noStore(reply).code(403).send({ code: 'REQUEST_DENIED' });
    const scope = parseClosedPlanProofScope(request.body, 'receipt');
    if (scope === null) return noStore(reply).code(422).send({ code: 'PROOF_SCOPE_REJECTED' });
    const consumed = await dependencies.authority.consumeStepUpReceipt(actor, {
      action: scope.action,
      authorizationContextId: scope.authorizationContextId,
      receipt: text(request.body, 'receipt'),
      redactedTarget: scope.targetFingerprint,
      resource: scope.resource,
    });
    if (consumed === null) return noStore(reply).code(422).send({ code: 'PROOF_REJECTED' });
    const verifiedAtUnixMs = Date.parse(consumed.verifiedAt);
    const expiresAtUnixMs = Date.parse(consumed.expiresAt);
    const consumedAtUnixMs = (dependencies.clock?.now() ?? new Date()).getTime();
    if (
      !Number.isSafeInteger(verifiedAtUnixMs) ||
      !Number.isSafeInteger(expiresAtUnixMs) ||
      expiresAtUnixMs <= consumedAtUnixMs ||
      verifiedAtUnixMs > consumedAtUnixMs ||
      expiresAtUnixMs - verifiedAtUnixMs > 5 * 60_000
    )
      return noStore(reply).code(422).send({ code: 'PROOF_REJECTED' });
    return noStore(reply)
      .code(200)
      .send({
        ok: true,
        proof: {
          kind:
            scope.binding.kind === 'transactional-plan'
              ? 'consumed-plan-approval'
              : 'consumed-advanced-preference',
          action: scope.action,
          resource: scope.resource,
          authorizationContextId: scope.authorizationContextId,
          evidenceId: consumed.evidenceId,
          deviceId: scope.binding.deviceId,
          targetFingerprint: scope.targetFingerprint,
          verifiedAtUnixMs,
          expiresAtUnixMs,
          consumedAtUnixMs,
        },
      });
  });
  return Promise.resolve();
};
