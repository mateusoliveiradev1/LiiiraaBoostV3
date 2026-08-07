import {
  decideBetaInvitationAdmission,
  decideBetaInvitationTransition,
  decideInvitationBatchAdmission,
  preflightBetaInvitationRows,
  type BetaInvitationCommand,
  type BetaInvitationState,
  type InvitationPreflightClassification,
} from '@liiiraa/control-plane-domain/admin/invitations';

import type {
  AdminInvitationCommandResult,
  AdminInvitationDependencies,
  AdminInvitationReceipt,
  AdminInvitationTransaction,
  InvitationBatchDisposition,
  InvitationBatchResults,
  InvitationOperationOutcome,
  StartInvitationBatchInput,
} from '../ports/admin-invitations.js';

const failure = (): AdminInvitationCommandResult => ({
  ok: false,
  code: 'INVITATION_OPERATION_FAILED',
});

const commandKey = (input: Readonly<{ commandId: string; idempotencyKey: string }>): string =>
  `${input.commandId}:${input.idempotencyKey}`;

const authorize = async (
  dependencies: AdminInvitationDependencies,
  actorId: string,
  capability: Parameters<
    AdminInvitationDependencies['authorization']['authorize']
  >[0]['capability'],
): Promise<boolean> => dependencies.authorization.authorize({ actorId, capability });

const appendNewEvents = async (
  transaction: AdminInvitationTransaction,
  state: BetaInvitationState,
  previousEventCount = 0,
): Promise<void> => {
  for (const event of state.events.slice(previousEventCount)) {
    await transaction.appendLifecycleEvent({
      invitationId: state.invitationId,
      version: state.version,
      event,
    });
  }
};

const durableResult = async (
  dependencies: AdminInvitationDependencies,
  transaction: AdminInvitationTransaction,
  input: Readonly<{
    actorId: string;
    commandId: string;
    idempotencyKey: string;
    aggregateId: string;
    outcome: InvitationOperationOutcome;
    occurredAt: string;
    topic: Parameters<AdminInvitationTransaction['enqueueOutbox']>[0]['topic'];
    state?: BetaInvitationState;
    payload?: Readonly<Record<string, string | number | boolean | readonly string[]>>;
    results?: InvitationBatchResults;
    jobId?: string;
  }>,
): Promise<AdminInvitationCommandResult> => {
  const receiptId = dependencies.ids.next();
  const receipt: AdminInvitationReceipt = {
    receiptId,
    commandId: input.commandId,
    idempotencyKey: input.idempotencyKey,
    aggregateId: input.aggregateId,
    outcome: input.outcome,
    occurredAt: input.occurredAt,
    ...(input.results === undefined ? {} : { results: input.results }),
  };
  await transaction.appendAudit({
    actorId: input.actorId,
    action: `admin.beta-invitation.${input.outcome}`,
    commandId: input.commandId,
    occurredAt: input.occurredAt,
    redactedTarget: input.aggregateId,
  });
  await transaction.enqueueOutbox({
    outboxId: dependencies.ids.next(),
    topic: input.topic,
    aggregateId: input.aggregateId,
    commandId: input.commandId,
    availableAt: input.occurredAt,
    payload: input.payload ?? { outcome: input.outcome },
  });
  await transaction.saveReceipt(receipt);
  const result: AdminInvitationCommandResult = {
    ok: true,
    outcome: input.outcome,
    receiptId,
    ...(input.state === undefined ? {} : { state: input.state }),
    ...(input.results === undefined ? {} : { results: input.results }),
    ...(input.jobId === undefined ? {} : { jobId: input.jobId }),
  };
  await transaction.rememberCommandResult(commandKey(input), result);
  return result;
};

export interface PreflightBetaInvitationsInput {
  readonly actorId: string;
  readonly rows: readonly Readonly<{
    rowId: string;
    recipient: string;
    emailValid: boolean;
    eligible: boolean;
  }>[];
}

export type PreflightBetaInvitationsResult =
  | Readonly<{
      ok: true;
      rows: readonly Readonly<{
        rowId: string;
        recipientKey: string;
        classification: InvitationPreflightClassification;
      }>[];
    }>
  | Readonly<{ ok: false; code: 'INVITATION_OPERATION_FAILED' }>;

export const preflightBetaInvitations = async (
  dependencies: AdminInvitationDependencies,
  input: PreflightBetaInvitationsInput,
): Promise<PreflightBetaInvitationsResult> => {
  try {
    if (!(await authorize(dependencies, input.actorId, 'beta-invitations:preflight'))) {
      return { ok: false, code: 'INVITATION_OPERATION_FAILED' };
    }
    const rows = input.rows.map((row) => ({
      rowId: row.rowId,
      recipientKey: dependencies.recipients.hash(row.recipient),
      emailValid: row.emailValid,
      eligible: row.eligible,
    }));
    const activeRecipientKeys = await dependencies.repository.findActiveRecipientKeys(
      rows.map((row) => row.recipientKey),
    );
    return { ok: true, rows: preflightBetaInvitationRows({ rows, activeRecipientKeys }) };
  } catch {
    return { ok: false, code: 'INVITATION_OPERATION_FAILED' };
  }
};

export interface IssueBetaInvitationInput {
  readonly actorId: string;
  readonly commandId: string;
  readonly idempotencyKey: string;
  readonly expectedVersion: bigint;
  readonly invitationId: string;
  readonly recipient: string;
  readonly locale: 'en' | 'pt-BR';
  readonly campaign?: string;
  readonly cohort?: string;
  readonly noteReference?: string;
}

export const issueBetaInvitation = async (
  dependencies: AdminInvitationDependencies,
  input: IssueBetaInvitationInput,
): Promise<AdminInvitationCommandResult> => {
  try {
    if (!(await authorize(dependencies, input.actorId, 'beta-invitations:issue'))) return failure();
    const recipientKey = dependencies.recipients.hash(input.recipient);
    return await dependencies.repository.transaction(async (transaction) => {
      const replay = await transaction.findCommandResult(commandKey(input));
      if (replay !== null) return replay;
      if (input.expectedVersion !== 0n) return { ok: false, code: 'STALE' };
      if ((await transaction.findActiveRecipient(recipientKey)) !== null) {
        return { ok: false, code: 'RECIPIENT_ACTIVE' };
      }
      const now = dependencies.clock.now().toISOString();
      const decision = decideBetaInvitationAdmission({
        invitationId: input.invitationId,
        recipientKey,
        locale: input.locale,
        now,
        activeCount: await transaction.countActiveBetaInvitations(now),
        queuePosition: await transaction.nextQueuePosition(),
        ...(input.campaign === undefined ? {} : { campaign: input.campaign }),
        ...(input.cohort === undefined ? {} : { cohort: input.cohort }),
        ...(input.noteReference === undefined ? {} : { noteReference: input.noteReference }),
      });
      if (!decision.accepted) return { ok: false, code: decision.code };

      await transaction.saveInvitation(decision.state);
      let deliveryReference: string | undefined;
      const issueSecret = decision.effects.some((effect) => effect.kind === 'issue-secret');
      if (issueSecret) {
        const secret = dependencies.secrets.issue();
        await transaction.saveSecretDigest(decision.state.invitationId, secret.digest);
        const handoff = await dependencies.delivery.handoff({
          invitationId: decision.state.invitationId,
          recipientKey,
          plaintextSecret: secret.plaintext,
          locale: input.locale,
          idempotencyKey: input.idempotencyKey,
          ...(input.campaign === undefined ? {} : { campaign: input.campaign }),
        });
        deliveryReference = handoff.deliveryReference;
      }
      await appendNewEvents(transaction, decision.state);
      return durableResult(dependencies, transaction, {
        actorId: input.actorId,
        commandId: input.commandId,
        idempotencyKey: input.idempotencyKey,
        aggregateId: input.invitationId,
        outcome: decision.state.status === 'queued' ? 'queued' : 'issued',
        occurredAt: now,
        topic: 'admin.invitation-issued',
        state: decision.state,
        payload: {
          status: decision.state.status,
          locale: decision.state.locale,
          ...(deliveryReference === undefined ? {} : { deliveryReference }),
        },
      });
    });
  } catch {
    return failure();
  }
};

type ManageBetaInvitationAction =
  | Readonly<{ kind: 'resend'; expiryMode: 'preserve' | 'restart'; justification: string }>
  | Readonly<{ kind: 'remind' }>
  | Readonly<{ kind: 'revoke'; reason: string }>
  | Readonly<{ kind: 'decline' }>
  | Readonly<{ kind: 'expire' }>;

export interface ManageBetaInvitationInput {
  readonly actorId: string;
  readonly commandId: string;
  readonly idempotencyKey: string;
  readonly invitationId: string;
  readonly expectedVersion: bigint;
  readonly action: ManageBetaInvitationAction;
}

const transitionOutcome = (command: ManageBetaInvitationAction): InvitationOperationOutcome =>
  command.kind === 'resend'
    ? 'resent'
    : command.kind === 'remind'
      ? 'reminded'
      : command.kind === 'revoke'
        ? 'revoked'
        : command.kind === 'decline'
          ? 'declined'
          : 'expired';

export const manageBetaInvitation = async (
  dependencies: AdminInvitationDependencies,
  input: ManageBetaInvitationInput,
): Promise<AdminInvitationCommandResult> => {
  try {
    if (!(await authorize(dependencies, input.actorId, 'beta-invitations:manage')))
      return failure();
    return await dependencies.repository.transaction(async (transaction) => {
      const replay = await transaction.findCommandResult(commandKey(input));
      if (replay !== null) return replay;
      const current = await transaction.loadInvitation(input.invitationId);
      if (current === null) return { ok: false, code: 'INVITATION_UNAVAILABLE' };
      if (current.kind !== 'beta') return { ok: false, code: 'INVITATION_KIND_UNSUPPORTED' };
      if (current.version !== input.expectedVersion) return { ok: false, code: 'STALE' };
      const now = dependencies.clock.now().toISOString();
      const command: BetaInvitationCommand = { ...input.action, now };
      const decision = decideBetaInvitationTransition(current, command);
      if (!decision.accepted) return { ok: false, code: decision.code };

      let secret: Readonly<{ plaintext: string; digest: string }> | undefined;
      for (const effect of decision.effects) {
        if (effect.kind === 'invalidate-secret') {
          await transaction.invalidateSecretDigest(input.invitationId);
        } else if (effect.kind === 'issue-secret') {
          secret = dependencies.secrets.issue();
          await transaction.saveSecretDigest(input.invitationId, secret.digest);
        } else if (effect.kind === 'send-invitation' && secret !== undefined) {
          await dependencies.delivery.handoff({
            invitationId: input.invitationId,
            recipientKey: current.recipientKey,
            plaintextSecret: secret.plaintext,
            locale: effect.locale as 'en' | 'pt-BR',
            idempotencyKey: input.idempotencyKey,
            ...(current.campaign === undefined ? {} : { campaign: current.campaign }),
          });
        }
      }
      if (decision.state.status !== 'pending' && decision.state.status !== 'queued') {
        await transaction.invalidateSecretDigest(input.invitationId);
      }
      await transaction.saveInvitation(decision.state);
      await appendNewEvents(transaction, decision.state, current.events.length);
      return durableResult(dependencies, transaction, {
        actorId: input.actorId,
        commandId: input.commandId,
        idempotencyKey: input.idempotencyKey,
        aggregateId: input.invitationId,
        outcome: transitionOutcome(input.action),
        occurredAt: now,
        topic: 'admin.invitation-transitioned',
        state: decision.state,
        payload: { status: decision.state.status, action: input.action.kind },
      });
    });
  } catch {
    return failure();
  }
};

export interface AcceptBetaInvitationInput {
  readonly commandId: string;
  readonly idempotencyKey: string;
  readonly invitationId: string;
  readonly expectedVersion: bigint;
  readonly plaintextSecret: string;
  readonly recipientPossessionVerified: boolean;
  readonly possessionEvidenceExpiresAt?: string;
  readonly accountActivationCompleted: boolean;
  readonly essentialTermsAccepted: boolean;
  readonly accountReference: string;
}

export const acceptBetaInvitation = async (
  dependencies: AdminInvitationDependencies,
  input: AcceptBetaInvitationInput,
): Promise<AdminInvitationCommandResult> => {
  try {
    const secretDigest = dependencies.secrets.digest(input.plaintextSecret);
    return await dependencies.repository.transaction(async (transaction) => {
      const replay = await transaction.findCommandResult(commandKey(input));
      if (replay !== null) return replay;
      const current = await transaction.loadInvitation(input.invitationId);
      if (current?.kind !== 'beta') {
        return { ok: false, code: 'INVITATION_UNAVAILABLE' };
      }
      if (current.version !== input.expectedVersion) return { ok: false, code: 'STALE' };
      if (!(await transaction.verifySecretDigest(input.invitationId, secretDigest))) {
        return { ok: false, code: 'INVITATION_UNAVAILABLE' };
      }
      const now = dependencies.clock.now().toISOString();
      const decision = decideBetaInvitationTransition(current, {
        kind: 'complete-activation',
        now,
        recipientPossessionVerified: input.recipientPossessionVerified,
        ...(input.possessionEvidenceExpiresAt === undefined
          ? {}
          : { possessionEvidenceExpiresAt: input.possessionEvidenceExpiresAt }),
        accountActivationCompleted: input.accountActivationCompleted,
        essentialTermsAccepted: input.essentialTermsAccepted,
        accountReference: input.accountReference,
      });
      if (!decision.accepted) return { ok: false, code: decision.code };
      const consumed = await transaction.consumeInvitationAndActivateAccount({
        invitationId: input.invitationId,
        secretDigest,
        accountReference: input.accountReference,
        activatedAt: now,
      });
      if (!consumed) return { ok: false, code: 'INVITATION_UNAVAILABLE' };
      await transaction.saveInvitation(decision.state);
      await appendNewEvents(transaction, decision.state, current.events.length);
      return durableResult(dependencies, transaction, {
        actorId: 'invitation-recipient',
        commandId: input.commandId,
        idempotencyKey: input.idempotencyKey,
        aggregateId: input.invitationId,
        outcome: 'accepted',
        occurredAt: now,
        topic: 'admin.invitation-accepted',
        state: decision.state,
        payload: { accountReference: input.accountReference },
      });
    });
  } catch {
    return failure();
  }
};

const batchResults = (
  items: readonly Readonly<{
    invitationId: string;
    disposition: InvitationBatchDisposition;
  }>[],
): InvitationBatchResults => {
  const grouped: Record<InvitationBatchDisposition, string[]> = {
    issued: [],
    queued: [],
    skipped: [],
    failed: [],
  };
  for (const item of items) grouped[item.disposition].push(item.invitationId);
  return grouped;
};

export const startBetaInvitationBatch = async (
  dependencies: AdminInvitationDependencies,
  input: StartInvitationBatchInput,
): Promise<AdminInvitationCommandResult> => {
  try {
    if (!(await authorize(dependencies, input.actorId, 'beta-invitations:batch'))) return failure();
    const admission = decideInvitationBatchAdmission({
      action: input.action,
      targetCount: input.items.length,
      impactReviewed: input.impactReviewed,
      reason: input.reason,
      risk: input.risk,
      approvalGranted: input.approvalGranted,
    });
    if (!admission.accepted) return { ok: false, code: admission.code };
    return await dependencies.repository.transaction(async (transaction) => {
      const replay = await transaction.findCommandResult(commandKey(input));
      if (replay !== null) return replay;
      const now = dependencies.clock.now().toISOString();
      const classified: {
        invitationId: string;
        disposition: InvitationBatchDisposition;
      }[] = [];
      for (const item of input.items) {
        try {
          const invitation = await transaction.loadInvitation(item.invitationId);
          const disposition: InvitationBatchDisposition =
            invitation?.kind !== 'beta' ||
            (invitation.status !== 'pending' && invitation.status !== 'queued')
              ? 'skipped'
              : invitation.status === 'queued'
                ? 'queued'
                : 'issued';
          classified.push({ invitationId: item.invitationId, disposition });
        } catch {
          classified.push({ invitationId: item.invitationId, disposition: 'failed' });
        }
      }
      const results = batchResults(classified);
      const jobId = dependencies.ids.next();
      await transaction.saveJob({
        jobId,
        commandId: input.commandId,
        action: input.action,
        status: results.failed.length > 0 ? 'completed-with-failures' : 'queued',
        createdAt: now,
        items: classified,
      });
      return durableResult(dependencies, transaction, {
        actorId: input.actorId,
        commandId: input.commandId,
        idempotencyKey: input.idempotencyKey,
        aggregateId: jobId,
        outcome: 'batch-started',
        occurredAt: now,
        topic: 'admin.invitation-batch',
        results,
        jobId,
        payload: {
          jobId,
          issued: results.issued.length,
          queued: results.queued.length,
          skipped: results.skipped.length,
          failed: results.failed.length,
        },
      });
    });
  } catch {
    return failure();
  }
};
