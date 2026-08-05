import type { ConsentCommandJson } from '@liiiraa/contracts-ts';
import {
  decideConsentTransition,
  type DiagnosticConsentState,
  type SupportDiagnosticFieldClass,
} from '@liiiraa/control-plane-domain';

import type { SupportLifecycleDependencies } from './manage-support-case.js';

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
  let notify = false;
  const result = await dependencies.repository.transaction(
    input.command.accountId,
    async (transaction): Promise<ManageConsentResult> => {
      const replay = await transaction.findCommandResult(input.command.commandId);
      if (replay !== null) return replay as ManageConsentResult;
      const expectedVersion = parseVersion(input.command.expectedVersion);
      if (expectedVersion === null) return { ok: false, code: 'INVALID_VERSION' };
      const current = await transaction.loadConsent(input.command.consentId);
      if ((current?.version ?? 0n) !== expectedVersion) return { ok: false, code: 'STALE' };
      if (current !== null && current.accountId !== input.command.accountId) {
        return { ok: false, code: 'UNAUTHORIZED' };
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
      if (!decision.accepted) return { ok: false, code: decision.code };
      await transaction.saveConsent(decision.state);
      notify = decision.effects.some((effect) => effect.kind === 'notify-active-streams');
      await transaction.appendAudit({
        accountId: input.command.accountId,
        action: `support.consent.${input.action.kind}`,
        commandId: input.command.commandId,
        occurredAt: now,
        redactedTarget: input.command.consentId,
      });
      if (input.action.kind !== 'expire') {
        await transaction.enqueueOutbox({
          jobId: dependencies.ids.next(),
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
      return applied;
    },
  );
  if (notify && result.ok) dependencies.consentChanges.publish(input.command.consentId);
  return result;
};
