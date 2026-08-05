import type { SupportCommandJson } from '@liiiraa/contracts-ts';
import {
  decideSupportCaseTransition,
  type AccountDeletionState,
  type DiagnosticConsentState,
  type SupportAttachmentMetadata,
  type SupportCaseState,
  type SupportCategory,
  type SupportPlan,
} from '@liiiraa/control-plane-domain';

export type {
  SupportAttachmentMetadata,
  SupportCaseState,
  SupportCategory,
  SupportDiagnosticFieldClass,
  SupportPlan,
} from '@liiiraa/control-plane-domain';

export type SupportLifecycleTopic =
  | 'support.case-notice'
  | 'support.consent-receipt'
  | 'support.attachment-purge'
  | 'support.case-consent-expiry'
  | 'account.deletion-notice'
  | 'account.deletion-finalize'
  | 'account.deletion-cancel'
  | 'account.deletion-completed';

export interface SupportLifecycleOutboxJob {
  readonly jobId: string;
  readonly topic: SupportLifecycleTopic;
  readonly aggregateId: string;
  readonly commandId: string;
  readonly idempotencyKey: string;
  readonly availableAt: string;
  readonly payload: Readonly<Record<string, string | number | boolean | readonly string[]>>;
}

export type SupportLifecycleCommandResult = Readonly<{
  ok: boolean;
  code?: string;
  outcome?: string;
  state?: SupportCaseState | DiagnosticConsentState | AccountDeletionState;
}>;

export interface SupportLifecycleTransaction {
  findCommandResult(commandId: string): Promise<SupportLifecycleCommandResult | null>;
  rememberCommandResult(commandId: string, result: SupportLifecycleCommandResult): Promise<void>;
  loadCase(caseId: string): Promise<SupportCaseState | null>;
  saveCase(state: SupportCaseState): Promise<void>;
  loadConsent(consentId: string): Promise<DiagnosticConsentState | null>;
  saveConsent(state: DiagnosticConsentState): Promise<void>;
  expireCaseConsents(caseId: string, expiredAt: string): Promise<readonly string[]>;
  loadDeletion(accountId: string): Promise<AccountDeletionState | null>;
  saveDeletion(state: AccountDeletionState): Promise<void>;
  eraseOrdinaryAccountData(accountId: string, erasedAt: string): Promise<void>;
  appendAudit(
    record: Readonly<{
      accountId: string;
      action: string;
      commandId: string;
      occurredAt: string;
      redactedTarget: string;
    }>,
  ): Promise<void>;
  enqueueOutbox(job: SupportLifecycleOutboxJob): Promise<void>;
}

export interface SupportLifecycleRepository {
  transaction<T>(
    accountId: string,
    operation: (transaction: SupportLifecycleTransaction) => Promise<T>,
  ): Promise<T>;
}

export interface SupportLifecycleDependencies {
  readonly repository: SupportLifecycleRepository;
  readonly clock: Readonly<{ now(): Date }>;
  readonly ids: Readonly<{ next(): string }>;
}

export type ManageSupportCaseDependencies = SupportLifecycleDependencies;

export type ManageSupportCaseAction =
  | Readonly<{
      kind: 'create';
      plan: SupportPlan;
      category: SupportCategory;
      subjectRedacted: string;
      message: string;
    }>
  | Readonly<{ kind: 'reply'; author: 'customer' | 'support'; message: string }>
  | Readonly<{ kind: 'attach-metadata'; attachment: SupportAttachmentMetadata }>
  | Readonly<{ kind: 'close' }>
  | Readonly<{ kind: 'reopen'; relatedCaseId?: string }>;

export interface ManageSupportCaseInput {
  readonly command: SupportCommandJson;
  readonly action: ManageSupportCaseAction;
}

export type ManageSupportCaseResult =
  | Readonly<{
      ok: true;
      outcome: 'created' | 'updated' | 'closed' | 'reopened' | 'related-case-created';
      state: SupportCaseState;
    }>
  | Readonly<{ ok: false; code: string }>;

const expectedVersion = (value: string): bigint | null =>
  /^(?:0|[1-9][0-9]*)$/u.test(value) ? BigInt(value) : null;

export const manageSupportCase = async (
  dependencies: ManageSupportCaseDependencies,
  input: ManageSupportCaseInput,
): Promise<ManageSupportCaseResult> =>
  dependencies.repository.transaction(input.command.accountId, async (transaction) => {
    const replay = await transaction.findCommandResult(input.command.commandId);
    if (replay !== null) return replay as ManageSupportCaseResult;
    const version = expectedVersion(input.command.expectedVersion);
    if (version === null) return { ok: false, code: 'INVALID_VERSION' };
    const current = await transaction.loadCase(input.command.supportCaseId);
    if ((current?.version ?? 0n) !== version) return { ok: false, code: 'STALE' };
    if (current !== null && current.accountId !== input.command.accountId) {
      return { ok: false, code: 'UNAUTHORIZED' };
    }
    const now = dependencies.clock.now().toISOString();
    const domainCommand =
      input.action.kind === 'create'
        ? ({
            ...input.action,
            accountId: input.command.accountId,
            caseId: input.command.supportCaseId,
            messageId: dependencies.ids.next(),
            now,
          } as const)
        : input.action.kind === 'reply'
          ? ({ ...input.action, messageId: dependencies.ids.next(), now } as const)
          : input.action.kind === 'attach-metadata'
            ? ({ ...input.action, now } as const)
            : input.action.kind === 'reopen'
              ? ({ ...input.action, now } as const)
              : ({ kind: 'close', now } as const);
    const decision = decideSupportCaseTransition(current, domainCommand);
    if (!decision.accepted) return { ok: false, code: decision.code };
    await transaction.saveCase(decision.state);
    for (const effect of decision.effects) {
      if (effect.kind === 'schedule-attachment-purge') {
        await transaction.enqueueOutbox({
          jobId: dependencies.ids.next(),
          topic: 'support.attachment-purge',
          aggregateId: decision.state.caseId,
          commandId: input.command.commandId,
          idempotencyKey: `${decision.state.caseId}:attachments:purge:${String(version)}`,
          availableAt: effect.availableAt,
          payload: {
            caseId: decision.state.caseId,
            closedVersion: String(decision.state.version),
          },
        });
      } else {
        const expired = await transaction.expireCaseConsents(effect.caseId, now);
        await transaction.enqueueOutbox({
          jobId: dependencies.ids.next(),
          topic: 'support.case-consent-expiry',
          aggregateId: decision.state.caseId,
          commandId: input.command.commandId,
          idempotencyKey: `${input.command.commandId}:support.case-consent-expiry`,
          availableAt: now,
          payload: { caseId: effect.caseId, consentIds: expired },
        });
      }
    }
    await transaction.appendAudit({
      accountId: input.command.accountId,
      action: `support.case.${input.action.kind}`,
      commandId: input.command.commandId,
      occurredAt: now,
      redactedTarget: input.command.supportCaseId,
    });
    await transaction.enqueueOutbox({
      jobId: dependencies.ids.next(),
      topic: 'support.case-notice',
      aggregateId: decision.state.caseId,
      commandId: input.command.commandId,
      idempotencyKey: `${input.command.commandId}:support.case-notice`,
      availableAt: now,
      payload: { caseId: decision.state.caseId, status: decision.state.status },
    });
    const result: ManageSupportCaseResult = {
      ok: true,
      outcome: decision.outcome,
      state: decision.state,
    };
    await transaction.rememberCommandResult(input.command.commandId, result);
    return result;
  });
