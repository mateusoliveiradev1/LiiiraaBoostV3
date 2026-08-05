import type { RecoveryEvidence, RecoveryState } from '@liiiraa/control-plane-domain';

export interface RecoveryAggregate {
  readonly accountId: string;
  readonly email: string;
  readonly state: RecoveryState;
}

export interface RecoveryTransaction {
  load(accountId: string): Promise<RecoveryAggregate | null>;
  save(aggregate: RecoveryAggregate): Promise<void>;
  consumeRecoveryCode(accountId: string, digest: string, consumedAt: string): Promise<boolean>;
  revokeAffectedSessions(accountId: string, revokedAt: string): Promise<readonly string[]>;
  appendAudit(input: Readonly<{ accountId: string; action: string; occurredAt: string }>): Promise<void>;
  enqueueOutbox(input: Readonly<{
    jobId: string;
    topic: 'identity.recovery-notice' | 'identity.recovery-contested';
    accountId: string;
    sessionId: string;
    availableAt: string;
  }>): Promise<void>;
}

export interface RecoveryRepository {
  transaction<T>(accountId: string, operation: (transaction: RecoveryTransaction) => Promise<T>): Promise<T>;
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
  _dependencies: RecoveryDependencies,
  _input: RecoverAccountInput,
): Promise<RecoverAccountResult> => ({ ok: false, code: 'NOT_IMPLEMENTED' });
