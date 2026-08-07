import { createHmac, timingSafeEqual } from 'node:crypto';

import type { AdminInvitationDependencies } from '@liiiraa/control-plane-application';
import { acceptBetaInvitation } from '@liiiraa/control-plane-application/admin-invitations';
import type { FastifyInstance, FastifyReply, FastifyRequest } from 'fastify';

export interface InvitationInspection {
  readonly invitationId: string;
  readonly version: bigint;
  readonly locale: 'en' | 'pt-BR';
  readonly resumeId: string;
  readonly possessionChallengeId: string;
}

export interface InvitationAcceptanceProgress {
  readonly invitationId: string;
  readonly version: bigint;
  readonly locale: 'en' | 'pt-BR';
  readonly state: 'validated' | 'possession-verified';
  readonly possessionChallengeId: string;
  readonly possessionVerified: boolean;
  readonly possessionEvidenceExpiresAt?: string;
}

export interface InvitationAcceptanceRouteOperations {
  readonly accept: typeof acceptBetaInvitation;
}

export interface InvitationAcceptanceRouteDependencies {
  readonly accountOrigin: string;
  readonly csrfSecret: string;
  readonly invitations: AdminInvitationDependencies;
  readonly inspect: Readonly<{
    validate(
      input: Readonly<{
        invitationId: string;
        plaintextSecret: string;
      }>,
    ): Promise<InvitationInspection | null>;
  }>;
  readonly possession: Readonly<{
    verify(
      input: Readonly<{
        invitationId: string;
        challengeId: string;
        proof: string;
      }>,
    ): Promise<Readonly<{ verified: true; expiresAt: string }> | Readonly<{ verified: false }>>;
  }>;
  readonly progress: Readonly<{
    load(invitationId: string, resumeId: string): Promise<InvitationAcceptanceProgress | null>;
    save(
      invitationId: string,
      resumeId: string,
      state: InvitationAcceptanceProgress,
    ): Promise<void>;
  }>;
  readonly activateAccount: (
    input: Readonly<{
      invitationId: string;
      resumeId: string;
    }>,
  ) => Promise<
    Readonly<{ completed: true; accountReference: string }> | Readonly<{ completed: false }>
  >;
  readonly operations?: InvitationAcceptanceRouteOperations;
  readonly rateLimit: (key: string) => Promise<boolean>;
  readonly clock: Readonly<{ now(): Date }>;
}

const defaultOperations: InvitationAcceptanceRouteOperations = Object.freeze({
  accept: acceptBetaInvitation,
});

const isRecord = (value: unknown): value is Readonly<Record<string, unknown>> =>
  typeof value === 'object' && value !== null && !Array.isArray(value);

const stringValue = (record: Readonly<Record<string, unknown>>, key: string): string =>
  typeof record[key] === 'string' ? record[key] : '';

const noStore = (reply: FastifyReply): FastifyReply =>
  reply.header('cache-control', 'no-store, private');

const unavailable = (reply: FastifyReply) =>
  noStore(reply).code(404).send({ ok: false, code: 'INVITATION_UNAVAILABLE' });

const verifyCsrf = (secret: string, candidate: unknown): boolean => {
  if (typeof candidate !== 'string' || candidate.length > 256) return false;
  const [nonce, signature, extra] = candidate.split('.');
  if (!nonce || !signature || extra !== undefined) return false;
  const expected = Buffer.from(createHmac('sha256', secret).update(nonce).digest('base64url'));
  const actual = Buffer.from(signature);
  return expected.length === actual.length && timingSafeEqual(expected, actual);
};

const admitted = (
  request: FastifyRequest,
  dependencies: InvitationAcceptanceRouteDependencies,
  mutation: boolean,
): boolean =>
  request.headers.origin === dependencies.accountOrigin &&
  (!mutation || verifyCsrf(dependencies.csrfSecret, request.headers['x-csrf-token']));

const boundedIdentifier = (value: string): boolean =>
  /^[A-Za-z0-9][A-Za-z0-9._:-]{0,127}$/u.test(value);

const publicProgress = (state: InvitationAcceptanceProgress) => ({
  invitationId: state.invitationId,
  locale: state.locale,
  state: state.state,
  version: state.version.toString(),
  possessionVerified: state.possessionVerified,
  ...(state.possessionEvidenceExpiresAt === undefined
    ? {}
    : { possessionEvidenceExpiresAt: state.possessionEvidenceExpiresAt }),
});

export const registerInvitationAcceptanceRoutes = (
  app: FastifyInstance,
  dependencies: InvitationAcceptanceRouteDependencies,
): Promise<void> => {
  if (dependencies.csrfSecret.length < 32) {
    throw new Error('INVITATION_ACCEPTANCE_CSRF_SECRET_REJECTED');
  }
  const operations = dependencies.operations ?? defaultOperations;

  app.post('/v1/identity/invitations/validate', async (request, reply) => {
    if (!admitted(request, dependencies, true) || !isRecord(request.body)) {
      return unavailable(reply);
    }
    if (!(await dependencies.rateLimit(`invitation-validate:${request.ip}`))) {
      return noStore(reply).code(429).send({ ok: false, code: 'RATE_LIMITED' });
    }
    const invitationId = stringValue(request.body, 'invitationId');
    const plaintextSecret = stringValue(request.body, 'plaintextSecret');
    if (
      !boundedIdentifier(invitationId) ||
      plaintextSecret.length < 32 ||
      plaintextSecret.length > 512
    ) {
      return unavailable(reply);
    }
    const inspection = await dependencies.inspect.validate({ invitationId, plaintextSecret });
    if (inspection?.invitationId !== invitationId) return unavailable(reply);
    const state: InvitationAcceptanceProgress = {
      invitationId,
      version: inspection.version,
      locale: inspection.locale,
      state: 'validated',
      possessionChallengeId: inspection.possessionChallengeId,
      possessionVerified: false,
    };
    await dependencies.progress.save(invitationId, inspection.resumeId, state);
    return noStore(reply).code(200).send({
      ok: true,
      invitationId,
      locale: inspection.locale,
      resumeId: inspection.resumeId,
      possessionChallengeId: inspection.possessionChallengeId,
      state: 'validated',
      version: inspection.version.toString(),
    });
  });

  app.get<{ Params: { invitationId: string }; Querystring: { resumeId?: string } }>(
    '/v1/identity/invitations/:invitationId/progress',
    async (request, reply) => {
      if (!admitted(request, dependencies, false)) return unavailable(reply);
      const resumeId = request.query.resumeId ?? '';
      if (!boundedIdentifier(request.params.invitationId) || !boundedIdentifier(resumeId)) {
        return unavailable(reply);
      }
      const state = await dependencies.progress.load(request.params.invitationId, resumeId);
      return state === null
        ? unavailable(reply)
        : noStore(reply).code(200).send(publicProgress(state));
    },
  );

  app.post<{ Params: { invitationId: string } }>(
    '/v1/identity/invitations/:invitationId/possession',
    async (request, reply) => {
      if (!admitted(request, dependencies, true) || !isRecord(request.body)) {
        return unavailable(reply);
      }
      const resumeId = stringValue(request.body, 'resumeId');
      const challengeId = stringValue(request.body, 'possessionChallengeId');
      const proof = stringValue(request.body, 'proof');
      if (
        !boundedIdentifier(request.params.invitationId) ||
        !boundedIdentifier(resumeId) ||
        !boundedIdentifier(challengeId) ||
        proof.length < 1 ||
        proof.length > 512
      ) {
        return unavailable(reply);
      }
      const state = await dependencies.progress.load(request.params.invitationId, resumeId);
      if (state?.possessionChallengeId !== challengeId) return unavailable(reply);
      const evidence = await dependencies.possession.verify({
        invitationId: request.params.invitationId,
        challengeId,
        proof,
      });
      if (
        !evidence.verified ||
        Date.parse(evidence.expiresAt) <= dependencies.clock.now().getTime()
      ) {
        return unavailable(reply);
      }
      const next: InvitationAcceptanceProgress = {
        ...state,
        state: 'possession-verified',
        possessionVerified: true,
        possessionEvidenceExpiresAt: evidence.expiresAt,
      };
      await dependencies.progress.save(request.params.invitationId, resumeId, next);
      return noStore(reply).code(200).send(publicProgress(next));
    },
  );

  app.post<{ Params: { invitationId: string } }>(
    '/v1/identity/invitations/:invitationId/activate',
    async (request, reply) => {
      if (!admitted(request, dependencies, true) || !isRecord(request.body)) {
        return unavailable(reply);
      }
      const resumeId = stringValue(request.body, 'resumeId');
      const commandId = stringValue(request.body, 'commandId');
      const idempotencyKey = stringValue(request.body, 'idempotencyKey');
      const plaintextSecret = stringValue(request.body, 'plaintextSecret');
      if (
        !boundedIdentifier(request.params.invitationId) ||
        !boundedIdentifier(resumeId) ||
        !boundedIdentifier(commandId) ||
        !/^[A-Za-z0-9_-]{1,128}$/u.test(idempotencyKey) ||
        plaintextSecret.length < 32 ||
        plaintextSecret.length > 512 ||
        request.body['essentialTermsAccepted'] !== true
      ) {
        return unavailable(reply);
      }
      const state = await dependencies.progress.load(request.params.invitationId, resumeId);
      if (
        state?.possessionVerified !== true ||
        state.possessionEvidenceExpiresAt === undefined ||
        Date.parse(state.possessionEvidenceExpiresAt) <= dependencies.clock.now().getTime()
      ) {
        return unavailable(reply);
      }
      const activation = await dependencies.activateAccount({
        invitationId: request.params.invitationId,
        resumeId,
      });
      if (!activation.completed) return unavailable(reply);
      const result = await operations.accept(dependencies.invitations, {
        commandId,
        idempotencyKey,
        invitationId: request.params.invitationId,
        expectedVersion: state.version,
        plaintextSecret,
        recipientPossessionVerified: true,
        possessionEvidenceExpiresAt: state.possessionEvidenceExpiresAt,
        accountActivationCompleted: true,
        essentialTermsAccepted: true,
        accountReference: activation.accountReference,
      });
      if (!result.ok) return unavailable(reply);
      return noStore(reply).code(200).send({
        ok: true,
        outcome: result.outcome,
        receiptId: result.receiptId,
      });
    },
  );
  return Promise.resolve();
};
