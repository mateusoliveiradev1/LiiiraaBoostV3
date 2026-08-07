import type {
  BetaInvitationState,
  InvitationBatchAction,
  InvitationBatchRisk,
  InvitationState,
} from '@liiiraa/control-plane-domain';

export type AdminInvitationCapability =
  | 'beta-invitations:preflight'
  | 'beta-invitations:issue'
  | 'beta-invitations:manage'
  | 'beta-invitations:batch';

export interface AdminInvitationAuthorizationPort {
  authorize(
    input: Readonly<{ actorId: string; capability: AdminInvitationCapability }>,
  ): Promise<boolean>;
}

export interface AdminInvitationRecipientPort {
  hash(recipient: string): string;
}

export interface AdminInvitationSecretPort {
  issue(): Readonly<{ plaintext: string; digest: string }>;
  digest(plaintext: string): string;
}

export interface InvitationDeliveryHandoff {
  readonly invitationId: string;
  readonly recipientKey: string;
  readonly plaintextSecret: string;
  readonly locale: 'en' | 'pt-BR';
  readonly campaign?: string;
  readonly idempotencyKey: string;
}

export interface AdminInvitationDeliveryPort {
  handoff(input: InvitationDeliveryHandoff): Promise<Readonly<{ deliveryReference: string }>>;
}

export interface InvitationLifecycleRecord {
  readonly invitationId: string;
  readonly version: bigint;
  readonly event: BetaInvitationState['events'][number];
}

export interface InvitationOutboxRecord {
  readonly outboxId: string;
  readonly topic:
    | 'admin.invitation-issued'
    | 'admin.invitation-transitioned'
    | 'admin.invitation-accepted'
    | 'admin.invitation-batch';
  readonly aggregateId: string;
  readonly commandId: string;
  readonly availableAt: string;
  readonly payload: Readonly<Record<string, string | number | boolean | readonly string[]>>;
}

export interface AdminInvitationAuditRecord {
  readonly actorId: string;
  readonly action: string;
  readonly commandId: string;
  readonly occurredAt: string;
  readonly redactedTarget: string;
}

export type InvitationBatchDisposition = 'issued' | 'queued' | 'skipped' | 'failed';

export interface InvitationBatchJob {
  readonly jobId: string;
  readonly commandId: string;
  readonly action: InvitationBatchAction;
  readonly status: 'queued' | 'completed-with-failures' | 'completed';
  readonly createdAt: string;
  readonly items: readonly Readonly<{
    invitationId: string;
    disposition: InvitationBatchDisposition;
  }>[];
}

export type InvitationOperationOutcome =
  | 'issued'
  | 'queued'
  | 'resent'
  | 'reminded'
  | 'revoked'
  | 'declined'
  | 'expired'
  | 'accepted'
  | 'batch-started';

export type InvitationBatchResults = Readonly<
  Record<InvitationBatchDisposition, readonly string[]>
>;

export type AdminInvitationCommandResult =
  | Readonly<{
      ok: true;
      outcome: InvitationOperationOutcome;
      receiptId: string;
      state?: BetaInvitationState;
      results?: InvitationBatchResults;
      jobId?: string;
    }>
  | Readonly<{
      ok: false;
      code: string;
    }>;

export interface AdminInvitationReceipt {
  readonly receiptId: string;
  readonly commandId: string;
  readonly idempotencyKey: string;
  readonly aggregateId: string;
  readonly outcome: InvitationOperationOutcome;
  readonly occurredAt: string;
  readonly results?: InvitationBatchResults;
}

export interface AdminInvitationTransaction {
  findCommandResult(commandKey: string): Promise<AdminInvitationCommandResult | null>;
  rememberCommandResult(commandKey: string, result: AdminInvitationCommandResult): Promise<void>;
  findActiveRecipient(recipientKey: string): Promise<InvitationState | null>;
  countActiveBetaInvitations(now: string): Promise<number>;
  nextQueuePosition(): Promise<number>;
  loadInvitation(invitationId: string): Promise<InvitationState | null>;
  saveInvitation(invitation: BetaInvitationState): Promise<void>;
  invalidateSecretDigest(invitationId: string): Promise<void>;
  saveSecretDigest(invitationId: string, digest: string): Promise<void>;
  verifySecretDigest(invitationId: string, digest: string): Promise<boolean>;
  appendLifecycleEvent(record: InvitationLifecycleRecord): Promise<void>;
  appendAudit(record: AdminInvitationAuditRecord): Promise<void>;
  enqueueOutbox(record: InvitationOutboxRecord): Promise<void>;
  saveJob(job: InvitationBatchJob): Promise<void>;
  saveReceipt(receipt: AdminInvitationReceipt): Promise<void>;
  consumeInvitationAndActivateAccount(
    input: Readonly<{
      invitationId: string;
      secretDigest: string;
      accountReference: string;
      activatedAt: string;
    }>,
  ): Promise<boolean>;
}

export interface AdminInvitationRepositoryPort {
  findActiveRecipientKeys(recipientKeys: readonly string[]): Promise<readonly string[]>;
  transaction<T>(operation: (transaction: AdminInvitationTransaction) => Promise<T>): Promise<T>;
}

export interface AdminInvitationDependencies {
  readonly authorization: AdminInvitationAuthorizationPort;
  readonly recipients: AdminInvitationRecipientPort;
  readonly secrets: AdminInvitationSecretPort;
  readonly delivery: AdminInvitationDeliveryPort;
  readonly repository: AdminInvitationRepositoryPort;
  readonly clock: Readonly<{ now(): Date }>;
  readonly ids: Readonly<{ next(): string }>;
}

export interface StartInvitationBatchInput {
  readonly actorId: string;
  readonly commandId: string;
  readonly idempotencyKey: string;
  readonly action: InvitationBatchAction;
  readonly impactReviewed: boolean;
  readonly reason: string;
  readonly risk: InvitationBatchRisk;
  readonly approvalGranted: boolean;
  readonly items: readonly Readonly<{ invitationId: string }>[];
}
