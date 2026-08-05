import type { ConsentCommandJson } from '@liiiraa/contracts-ts';
import {
  decideConsentTransition,
  type DiagnosticConsentState,
  type SupportDiagnosticFieldClass,
} from '@liiiraa/control-plane-domain';

import { scheduleLifecycleJob, type SupportLifecycleDependencies } from './manage-support-case.js';

export type { DiagnosticConsentState } from '@liiiraa/control-plane-domain';

export interface ManageConsentDependencies extends SupportLifecycleDependencies {
  readonly consentChanges: Readonly<{ publish(consentId: string): void }>;
}

export type ManageConsentAction =
  | Readonly<{
      kind: 'grant';
      caseId: string;
      purpose: string;
      fieldClasses: readonly SupportDiagnosticFieldClass[];
      expiresAt: string;
    }>
  | Readonly<{ kind: 'revoke' | 'expire' }>;

export interface ManageConsentInput {
  readonly command: ConsentCommandJson;
  readonly action: ManageConsentAction;
}

export type ManageConsentResult =
  Readonly<{ ok: true; state: DiagnosticConsentState }> | Readonly<{ ok: false; code: string }>;

const parseVersion = (value: string): bigint | null =>
  /^(?:0|[1-9][0-9]*)$/u.test(value) ? BigInt(value) : null;

export const manageConsent = async (
  dependencies: ManageConsentDependencies,
  input: ManageConsentInput,
): Promise<ManageConsentResult> => {
  const outcome = await dependencies.repository.transaction(
    input.command.accountId,
    async (transaction): Promise<Readonly<{ result: ManageConsentResult; notify: boolean }>> => {
      const replay = await transaction.findCommandResult(input.command.commandId);
      if (replay !== null) {
        return { result: replay as ManageConsentResult, notify: false };
      }
      const expectedVersion = parseVersion(input.command.expectedVersion);
      if (expectedVersion === null) {
        return { result: { ok: false, code: 'INVALID_VERSION' }, notify: false };
      }
      const current = await transaction.loadConsent(input.command.consentId);
      if ((current?.version ?? 0n) !== expectedVersion) {
        return { result: { ok: false, code: 'STALE' }, notify: false };
      }
      if (current !== null && current.accountId !== input.command.accountId) {
        return { result: { ok: false, code: 'UNAUTHORIZED' }, notify: false };
      }
      const now = dependencies.clock.now().toISOString();
      const decision = decideConsentTransition(
        current,
        input.action.kind === 'grant'
          ? {
              ...input.action,
              consentId: input.command.consentId,
              accountId: input.command.accountId,
              grantedAt: now,
            }
          : { kind: input.action.kind, now },
      );
      if (!decision.accepted) {
        return { result: { ok: false, code: decision.code }, notify: false };
      }
      await transaction.saveConsent(decision.state);
      const notify = decision.effects.some((effect) => effect.kind === 'notify-active-streams');
      await transaction.appendAudit({
        accountId: input.command.accountId,
        action: `support.consent.${input.action.kind}`,
        commandId: input.command.commandId,
        occurredAt: now,
        redactedTarget: input.command.consentId,
      });
      if (input.action.kind !== 'expire') {
        await scheduleLifecycleJob(transaction, dependencies.ids, {
          topic: 'support.consent-receipt',
          aggregateId: input.command.consentId,
          commandId: input.command.commandId,
          idempotencyKey: `${input.command.commandId}:support.consent-receipt`,
          availableAt: now,
          payload: {
            caseId: decision.state.caseId,
            consentId: decision.state.consentId,
            consentVersion: String(decision.state.version),
            status: decision.state.status,
          },
        });
      }
      const applied: ManageConsentResult = { ok: true, state: decision.state };
      await transaction.rememberCommandResult(input.command.commandId, applied);
      return { result: applied, notify };
    },
  );
  if (outcome.notify) dependencies.consentChanges.publish(input.command.consentId);
  return outcome.result;
};
