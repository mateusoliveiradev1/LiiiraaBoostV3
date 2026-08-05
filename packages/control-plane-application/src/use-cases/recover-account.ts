import {
  RECOVERY_MINIMUM_HOLD_MS,
  decideRecoveryTransition,
  type RecoveryEvidence,
  type RecoveryState,
} from '@liiiraa/control-plane-domain';

export type { RecoveryState } from '@liiiraa/control-plane-domain';

export interface RecoveryAggregate {
  readonly accountId: string;
  readonly email: string;
  readonly state: RecoveryState;
}

export interface RecoveryTransaction {
  load(accountId: string): Promise<RecoveryAggregate | null>;
  save(aggregate: RecoveryAggregate): Promise<void>;
  consumeRecoveryCode(accountId: string, digest: string, consumedAt: string): Promise<boolean>;
  trustedSessionIds(accountId: string): Promise<readonly string[]>;
  revokeAffectedSessions(accountId: string, revokedAt: string): Promise<readonly string[]>;
  appendAudit(
    input: Readonly<{ accountId: string; action: string; occurredAt: string }>,
  ): Promise<void>;
  enqueueOutbox(
    input: Readonly<{
      jobId: string;
      topic: 'identity.recovery-notice' | 'identity.recovery-contested';
      accountId: string;
      sessionId: string;
      availableAt: string;
    }>,
  ): Promise<void>;
}

export interface RecoveryRepository {
  transaction<T>(
    accountId: string,
    operation: (transaction: RecoveryTransaction) => Promise<T>,
  ): Promise<T>;
}

export interface RecoveryDependencies {
  readonly repository: RecoveryRepository;
  readonly hasher: Readonly<{ digest(value: string): Promise<string> }>;
  readonly clock: Readonly<{ now(): Date }>;
  readonly ids: Readonly<{ next(): string }>;
}

export type RecoverAccountInput =
  | Readonly<{
      kind: 'request';
      accountId: string;
      email: string;
      evidence: RecoveryEvidence;
      evidenceValue?: string;
      verifiedEmail?: boolean;
    }>
  | Readonly<{
      kind: 'review';
      accountId: string;
      reviewedBy: string;
      approved: boolean;
    }>
  | Readonly<{
      kind: 'contest' | 'extend-risk';
      accountId: string;
      extendUntil: string;
    }>;

export type RecoverAccountResult =
  | Readonly<{
      ok: true;
      state: RecoveryState;
      basicAccess: boolean;
      revokedSessionIds: readonly string[];
    }>
  | Readonly<{ ok: false; code: string }>;

export const recoverAccount = async (
  dependencies: RecoveryDependencies,
  input: RecoverAccountInput,
): Promise<RecoverAccountResult> =>
  dependencies.repository.transaction(input.accountId, async (transaction) => {
    const aggregate = await transaction.load(input.accountId);
    if (!aggregate) return { ok: false, code: 'RECOVERY_NOT_FOUND' };
    const now = dependencies.clock.now().toISOString();

    if (input.kind === 'request') {
      if (aggregate.email !== input.email) return { ok: false, code: 'RECOVERY_EVIDENCE_INVALID' };
      if (input.evidence === 'verified-email' && input.verifiedEmail !== true) {
        return { ok: false, code: 'RECOVERY_EVIDENCE_INVALID' };
      }
      if (input.evidence === 'recovery-code') {
        if (!input.evidenceValue) return { ok: false, code: 'RECOVERY_EVIDENCE_INVALID' };
        const digest = await dependencies.hasher.digest(input.evidenceValue);
        if (!(await transaction.consumeRecoveryCode(input.accountId, digest, now))) {
          return { ok: false, code: 'RECOVERY_CODE_ALREADY_USED' };
        }
      }
      const transition = decideRecoveryTransition(aggregate.state, {
        kind: 'request',
        evidence: input.evidence,
        now,
      });
      if (!transition.accepted) return { ok: false, code: transition.code };
      await transaction.save({ ...aggregate, state: transition.state });
      await transaction.appendAudit({
        accountId: input.accountId,
        action:
          transition.state.status === 'pending-review'
            ? 'identity.recovery-review-requested'
            : 'identity.recovery-evidence-accepted',
        occurredAt: now,
      });
      return {
        ok: true,
        state: transition.state,
        basicAccess: transition.state.status === 'ready',
        revokedSessionIds: [],
      };
    }

    if (input.kind === 'review') {
      if (!input.approved) return { ok: false, code: 'RECOVERY_NOT_APPROVED' };
      const holdUntil = new Date(Date.parse(now) + RECOVERY_MINIMUM_HOLD_MS).toISOString();
      const transition = decideRecoveryTransition(aggregate.state, {
        kind: 'approve',
        reviewedBy: input.reviewedBy,
        now,
        holdUntil,
      });
      if (!transition.accepted) return { ok: false, code: transition.code };

      const revokedSessionIds = await transaction.revokeAffectedSessions(input.accountId, now);
      await transaction.save({ ...aggregate, state: transition.state });
      await transaction.appendAudit({
        accountId: input.accountId,
        action: 'identity.recovery-approved',
        occurredAt: now,
      });
      for (const sessionId of revokedSessionIds) {
        await transaction.enqueueOutbox({
          jobId: dependencies.ids.next(),
          topic: 'identity.recovery-notice',
          accountId: input.accountId,
          sessionId,
          availableAt: now,
        });
      }
      return {
        ok: true,
        state: transition.state,
        basicAccess: true,
        revokedSessionIds,
      };
    }

    const transition = decideRecoveryTransition(aggregate.state, {
      kind: input.kind,
      now,
      extendUntil: input.extendUntil,
    });
    if (!transition.accepted) return { ok: false, code: transition.code };
    const trustedSessionIds = await transaction.trustedSessionIds(input.accountId);
    await transaction.save({ ...aggregate, state: transition.state });
    const action =
      input.kind === 'contest' ? 'identity.recovery-contested' : 'identity.recovery-risk-extended';
    await transaction.appendAudit({ accountId: input.accountId, action, occurredAt: now });
    for (const sessionId of trustedSessionIds) {
      await transaction.enqueueOutbox({
        jobId: dependencies.ids.next(),
        topic:
          input.kind === 'contest' ? 'identity.recovery-contested' : 'identity.recovery-notice',
        accountId: input.accountId,
        sessionId,
        availableAt: now,
      });
    }
    return {
      ok: true,
      state: transition.state,
      basicAccess: true,
      revokedSessionIds: [],
    };
  });
