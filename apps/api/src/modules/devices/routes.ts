import { createHmac } from 'node:crypto';

import type {
  DeviceBindingProjectionJson,
  DeviceCommandJson,
  DeviceEvidenceContextProjectionJson,
  DeviceLocalEvidenceSubmissionJson,
} from '@liiiraa/contracts-ts';
import { controlPlaneDocumentValidator } from '@liiiraa/contracts-ts/runtime-control-plane-validator';
import {
  bindDevice,
  transferDevice,
  type BindDeviceInput,
  type DeviceAuthorityDependencies,
  type DeviceAuthorityResult,
} from '@liiiraa/control-plane-application/runtime-control-plane';
import {
  deriveDeviceDigest,
  deriveProtectedDeviceEvidence,
  type LocalDeviceEvidence,
  type ProtectedDeviceEvidence,
} from '@liiiraa/control-plane-domain/runtime-control-plane';
import type { FastifyInstance, FastifyReply, FastifyRequest } from 'fastify';

export interface DeviceRouteDependencies {
  readonly authority: DeviceAuthorityDependencies;
  readonly evidenceProtector: DeviceEvidenceProtector;
  readonly resolveSessionActor: (
    request: FastifyRequest,
  ) => Promise<Readonly<{ accountId: string }> | null>;
  readonly project: (
    accountId: string,
    correlationId: string,
  ) => Promise<DeviceBindingProjectionJson | null>;
}

interface DeviceMutationBody {
  readonly command: DeviceCommandJson;
  readonly deviceLabel?: string;
  readonly evidenceSubmission?: DeviceLocalEvidenceSubmissionJson;
  readonly deviceDigest?: string;
  readonly evidence?: BindDeviceInput['evidence'];
  readonly confirmedFriendlyIdentity?: boolean;
  readonly confirmedOnePcConsequences?: boolean;
  readonly confirmedByCustomer?: boolean;
  readonly reason?: 'ordinary' | 'theft' | 'customer-request';
  readonly exceptionId?: string;
  readonly observedEvidence?: BindDeviceInput['evidence'];
}

export interface DeviceEvidenceProtector {
  context(accountId: string): Promise<DeviceEvidenceContextProjectionJson>;
  protect(
    accountId: string,
    submission: unknown,
  ): Promise<Readonly<{ deviceDigest: string; evidence: ProtectedDeviceEvidence }>>;
}

export interface DeviceEvidenceProtectorInput {
  readonly contextSecret: string;
  readonly wrappingKey: string;
  readonly contextVersion: string;
  readonly keyVersion: number;
}

const SECRET = /^[A-Za-z0-9_-]{43,256}$/u;
const CONTEXT_VERSION = /^[1-9][0-9]{0,8}$/u;
const BIND_BODY_KEYS = new Set([
  'command',
  'deviceLabel',
  'evidenceSubmission',
  'confirmedFriendlyIdentity',
  'confirmedOnePcConsequences',
]);

const accountSalt = (contextSecret: string, accountId: string): string =>
  createHmac('sha256', contextSecret)
    .update('liiiraa-device-evidence-account-context-v1\0')
    .update(accountId)
    .digest('hex');

const localEvidence = (submission: DeviceLocalEvidenceSubmissionJson): LocalDeviceEvidence => ({
  deviceClass: submission.deviceClass,
  components: submission.components.map(({ componentClass, localDigest }) => ({
    componentClass,
    localDigest,
  })),
});

export const createDeviceEvidenceProtector = ({
  contextSecret,
  wrappingKey,
  contextVersion,
  keyVersion,
}: DeviceEvidenceProtectorInput): DeviceEvidenceProtector => {
  if (
    !SECRET.test(contextSecret) ||
    !SECRET.test(wrappingKey) ||
    contextSecret === wrappingKey ||
    !CONTEXT_VERSION.test(contextVersion) ||
    !Number.isSafeInteger(keyVersion) ||
    keyVersion < 1
  ) {
    throw new Error('DEVICE_EVIDENCE_PROTECTOR_CONFIGURATION_REJECTED');
  }
  const context = async (accountId: string): Promise<DeviceEvidenceContextProjectionJson> => ({
    schemaVersion: '1.0',
    kind: 'device-evidence-context-projection',
    accountId,
    contextVersion,
    accountSalt: accountSalt(contextSecret, accountId),
  });
  return Object.freeze({
    context,
    protect: async (accountId: string, submission: unknown) => {
      if (
        !controlPlaneDocumentValidator(submission) ||
        !isRecord(submission) ||
        submission['kind'] !== 'device-local-evidence-submission'
      ) {
        throw new Error('device evidence rejected: invalid-submission');
      }
      const typed = submission as unknown as DeviceLocalEvidenceSubmissionJson;
      if (typed.accountId !== accountId) {
        throw new Error('device evidence rejected: account-mismatch');
      }
      if (typed.contextVersion !== contextVersion) {
        throw new Error('device evidence rejected: stale-context-version');
      }
      try {
        const evidence = await deriveProtectedDeviceEvidence({
          evidence: localEvidence(typed),
          accountSalt: accountSalt(contextSecret, accountId),
          serverWrappingKey: wrappingKey,
          keyVersion,
        });
        return Object.freeze({ evidence, deviceDigest: await deriveDeviceDigest(evidence) });
      } catch {
        throw new Error('device evidence rejected: invalid-local-evidence');
      }
    },
  });
};

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null && !Array.isArray(value);

const bodyValue = (value: unknown): DeviceMutationBody | null => {
  if (!isRecord(value) || !controlPlaneDocumentValidator(value['command'])) return null;
  const command = value['command'];
  if (!isRecord(command) || (command as { readonly kind?: unknown }).kind !== 'device-command') {
    return null;
  }
  return value as unknown as DeviceMutationBody;
};

const exactBindBody = (value: unknown): value is DeviceMutationBody =>
  isRecord(value) && Object.keys(value).every((key) => BIND_BODY_KEYS.has(key));

const deviceLabel = (value: unknown): string | null =>
  typeof value === 'string' &&
  value.length >= 1 &&
  value.length <= 128 &&
  !/[\u0000-\u001f\u007f]/u.test(value)
    ? value
    : null;

const expectedVersion = (value: string): bigint | null => {
  if (!/^(?:0|[1-9][0-9]*)$/u.test(value)) return null;
  return BigInt(value);
};

const correlationId = (request: FastifyRequest): string => {
  const header = request.headers['x-correlation-id'];
  return typeof header === 'string' && header.length > 0 ? header : 'device-route';
};

const sendAuthorityResult = (reply: FastifyReply, result: DeviceAuthorityResult) => {
  if (result.ok)
    return reply.code(result.outcome === 'applied' ? 200 : 202).send(result.projection);
  const status =
    result.code === 'UNAUTHORIZED'
      ? 401
      : result.code === 'NOT_FOUND'
        ? 404
        : result.code === 'STALE'
          ? 409
          : 422;
  return reply.code(status).send({
    code: result.code,
    reason: result.reason,
    ...(result.projection ? { projection: result.projection } : {}),
  });
};

const mutationContext = async (request: FastifyRequest, dependencies: DeviceRouteDependencies) => {
  const actor = await dependencies.resolveSessionActor(request);
  const body = bodyValue(request.body);
  if (!actor || !body) return null;
  const version = expectedVersion(body.command.expectedVersion);
  if (version === null || actor.accountId !== body.command.accountId) return null;
  return { actor, body, version };
};

export const registerDeviceRoutes = (
  app: FastifyInstance,
  dependencies: DeviceRouteDependencies,
): Promise<void> => {
  app.get('/v1/devices/current', async (request, reply) => {
    const actor = await dependencies.resolveSessionActor(request);
    if (!actor) return reply.code(401).send({ code: 'UNAUTHORIZED', reason: 'owner-required' });
    const current = await dependencies.project(actor.accountId, correlationId(request));
    return current
      ? reply.code(200).send(current)
      : reply.code(404).send({ code: 'NOT_FOUND', reason: 'binding-not-found' });
  });

  app.get('/v1/devices/evidence-context', async (request, reply) => {
    const actor = await dependencies.resolveSessionActor(request);
    if (!actor) return reply.code(401).send({ code: 'UNAUTHORIZED', reason: 'owner-required' });
    return reply.code(200).send(await dependencies.evidenceProtector.context(actor.accountId));
  });

  app.post('/v1/devices/bind', async (request, reply) => {
    const context = await mutationContext(request, dependencies);
    if (context?.body.command.action !== 'bind') {
      return reply.code(401).send({ code: 'UNAUTHORIZED', reason: 'request-denied' });
    }
    const { body, actor, version } = context;
    const label = deviceLabel(body.deviceLabel);
    if (!exactBindBody(request.body) || label === null || body.evidenceSubmission === undefined) {
      return reply.code(400).send({ code: 'INVALID_REQUEST', reason: 'device-evidence-required' });
    }
    let protectedEvidence: Readonly<{
      deviceDigest: string;
      evidence: ProtectedDeviceEvidence;
    }>;
    try {
      protectedEvidence = await dependencies.evidenceProtector.protect(
        actor.accountId,
        body.evidenceSubmission,
      );
    } catch {
      return reply.code(400).send({ code: 'INVALID_REQUEST', reason: 'device-evidence-rejected' });
    }
    return sendAuthorityResult(
      reply,
      await bindDevice(dependencies.authority, {
        commandId: body.command.commandId,
        actorAccountId: actor.accountId,
        accountId: body.command.accountId,
        expectedVersion: version,
        bindingId: body.command.deviceBindingId,
        deviceDigest: protectedEvidence.deviceDigest,
        deviceLabel: label,
        evidence: protectedEvidence.evidence,
        confirmedFriendlyIdentity: body.confirmedFriendlyIdentity === true,
        confirmedOnePcConsequences: body.confirmedOnePcConsequences === true,
        correlationId: body.command.correlationId,
      }),
    );
  });

  app.post('/v1/devices/revoke', async (request, reply) => {
    const context = await mutationContext(request, dependencies);
    if (context?.body.command.action !== 'revoke') {
      return reply.code(401).send({ code: 'UNAUTHORIZED', reason: 'request-denied' });
    }
    return sendAuthorityResult(
      reply,
      await transferDevice(dependencies.authority, {
        action: 'revoke',
        commandId: context.body.command.commandId,
        actorAccountId: context.actor.accountId,
        accountId: context.body.command.accountId,
        expectedVersion: context.version,
        correlationId: context.body.command.correlationId,
        reason: context.body.reason === 'theft' ? 'theft' : 'customer-request',
      }),
    );
  });

  app.get('/v1/devices/transfer-eligibility', async (request, reply) => {
    const actor = await dependencies.resolveSessionActor(request);
    if (!actor) return reply.code(401).send({ code: 'UNAUTHORIZED', reason: 'owner-required' });
    const current = await dependencies.project(actor.accountId, correlationId(request));
    if (!current) return reply.code(404).send({ code: 'NOT_FOUND', reason: 'binding-not-found' });
    return reply.code(200).send({
      deviceBindingId: current.deviceBindingId,
      state: current.state,
      replacementEligibleAt: current.replacementEligibleAt,
      aggregateVersion: current.aggregateVersion,
    });
  });

  const replace = async (request: FastifyRequest, reply: FastifyReply) => {
    const context = await mutationContext(request, dependencies);
    if (context?.body.command.action !== 'replace') {
      return reply.code(401).send({ code: 'UNAUTHORIZED', reason: 'request-denied' });
    }
    const { body, actor, version } = context;
    if (!body.deviceDigest || !body.deviceLabel || !body.evidence) {
      return reply.code(400).send({ code: 'INVALID_REQUEST', reason: 'device-evidence-required' });
    }
    return sendAuthorityResult(
      reply,
      await transferDevice(dependencies.authority, {
        action: 'transfer',
        commandId: body.command.commandId,
        actorAccountId: actor.accountId,
        accountId: body.command.accountId,
        expectedVersion: version,
        correlationId: body.command.correlationId,
        bindingId: body.command.deviceBindingId,
        deviceDigest: body.deviceDigest,
        deviceLabel: body.deviceLabel,
        evidence: body.evidence,
        reason: body.reason === 'theft' ? 'theft' : 'ordinary',
        confirmedByCustomer: body.confirmedByCustomer === true,
        ...(body.exceptionId ? { exceptionId: body.exceptionId } : {}),
      }),
    );
  };
  app.post('/v1/devices/replace', replace);
  app.post('/v1/devices/exceptions/redeem', replace);

  app.post('/v1/devices/revalidation', async (request, reply) => {
    const context = await mutationContext(request, dependencies);
    if (!context?.body.observedEvidence) {
      return reply.code(401).send({ code: 'UNAUTHORIZED', reason: 'request-denied' });
    }
    return sendAuthorityResult(
      reply,
      await transferDevice(dependencies.authority, {
        action: 'revalidate',
        commandId: context.body.command.commandId,
        actorAccountId: context.actor.accountId,
        accountId: context.body.command.accountId,
        expectedVersion: context.version,
        correlationId: context.body.command.correlationId,
        observedEvidence: context.body.observedEvidence,
      }),
    );
  });

  return Promise.resolve();
};
