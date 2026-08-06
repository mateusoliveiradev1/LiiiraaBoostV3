import {
  decideDeletionTransition,
  initialDeletionState,
  type AccountDeletionState,
  type DeletionEvidence,
  type LegalHold,
} from '@liiiraa/control-plane-domain/runtime-control-plane';

import { scheduleLifecycleJob, type SupportLifecycleDependencies } from './manage-support-case.ts';

export type {
  AccountDeletionState,
  DeletionEvidence,
  RetainedEvidenceClass,
} from '@liiiraa/control-plane-domain/runtime-control-plane';

export type DeleteAccountDependencies = SupportLifecycleDependencies;

export type DeleteAccountAction =
  | Readonly<{ kind: 'request'; requestId: string; strongAuthVerified: boolean }>
  | Readonly<{ kind: 'cancel' }>
  | Readonly<{
      kind: 'finalize';
      evidence: readonly DeletionEvidence[];
      legalHolds?: readonly LegalHold[];
    }>;

export interface DeleteAccountInput {
  readonly commandId: string;
  readonly accountId: string;
  readonly expectedVersion: bigint;
  readonly action: DeleteAccountAction;
}

export type DeleteAccountResult =
  Readonly<{ ok: true; state: AccountDeletionState }> | Readonly<{ ok: false; code: string }>;

export const deleteAccount = async (
  dependencies: DeleteAccountDependencies,
  input: DeleteAccountInput,
): Promise<DeleteAccountResult> =>
  dependencies.repository.transaction(input.accountId, async (transaction) => {
    const replay = await transaction.findCommandResult(input.commandId);
    if (replay !== null) return replay as DeleteAccountResult;
    const current =
      (await transaction.loadDeletion(input.accountId)) ?? initialDeletionState(input.accountId);
    if (current.version !== input.expectedVersion) return { ok: false, code: 'STALE' };
    const now = dependencies.clock.now().toISOString();
    const decision = decideDeletionTransition(current, { ...input.action, now });
    if (!decision.accepted) return { ok: false, code: decision.code };
    if (decision.effects.some((effect) => effect.kind === 'erase-ordinary-account-data')) {
      await transaction.eraseOrdinaryAccountData(input.accountId, now);
    }
    await transaction.saveDeletion(decision.state);
    await transaction.appendAudit({
      accountId: input.accountId,
      action: `privacy.account-deletion.${input.action.kind}`,
      commandId: input.commandId,
      occurredAt: now,
      redactedTarget: input.accountId,
    });
    for (const effect of decision.effects) {
      const topic =
        effect.kind === 'schedule-account-finalization'
          ? 'account.deletion-finalize'
          : effect.kind === 'cancel-account-finalization'
            ? 'account.deletion-cancel'
            : 'account.deletion-completed';
      await scheduleLifecycleJob(transaction, dependencies.ids, {
        topic,
        aggregateId: input.accountId,
        commandId: input.commandId,
        idempotencyKey: `${input.commandId}:${topic}`,
        availableAt: effect.kind === 'schedule-account-finalization' ? effect.availableAt : now,
        payload: {
          accountId: input.accountId,
          requestId: decision.state.requestId ?? input.commandId,
          deletionVersion: String(decision.state.version),
        },
      });
    }
    if (input.action.kind === 'finalize') {
      for (const record of decision.state.retentionRecords) {
        await scheduleLifecycleJob(transaction, dependencies.ids, {
          topic: 'account.retention-expiry',
          aggregateId: input.accountId,
          commandId: input.commandId,
          idempotencyKey: `${input.commandId}:account.retention-expiry:${record.evidenceClass}:${record.sourceAt}`,
          availableAt: record.retainUntil,
          payload: {
            accountId: input.accountId,
            evidenceClass: record.evidenceClass,
            sourceAt: record.sourceAt,
            retainUntil: record.retainUntil,
          },
        });
      }
    }
    await scheduleLifecycleJob(transaction, dependencies.ids, {
      topic: 'account.deletion-notice',
      aggregateId: input.accountId,
      commandId: input.commandId,
      idempotencyKey: `${input.commandId}:account.deletion-notice`,
      availableAt: now,
      payload: { accountId: input.accountId, status: decision.state.status },
    });
    const result: DeleteAccountResult = { ok: true, state: decision.state };
    await transaction.rememberCommandResult(input.commandId, result);
    return result;
  });
