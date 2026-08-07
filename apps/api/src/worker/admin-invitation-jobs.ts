import {
  BETA_INVITATION_ACTIVE_LIMIT,
  decideBetaInvitationTransition,
  decideInvitationRetention,
  selectNextBetaInvitationPromotions,
  type BetaInvitationState,
  type InvitationBatchAction,
} from '@liiiraa/control-plane-domain';

const invitationJobTopics = [
  'admin.invitation-delivery',
  'admin.invitation-reminder',
  'admin.invitation-promotion',
  'admin.invitation-retention',
  'admin.invitation-batch',
] as const;
const sqlTopics = invitationJobTopics.map((topic) => `'${topic}'`).join(', ');

export const ADMIN_INVITATION_JOB_CLAIM_SQL = `
WITH claimed AS (
  SELECT id
  FROM outbox_jobs
  WHERE topic IN (${sqlTopics})
    AND completed_at IS NULL
    AND available_at <= CURRENT_TIMESTAMP
    AND (locked_at IS NULL OR locked_at < CURRENT_TIMESTAMP - INTERVAL '5 minutes')
  ORDER BY available_at, created_at
  FOR UPDATE SKIP LOCKED
  LIMIT $1
)
UPDATE outbox_jobs AS jobs
SET locked_at = CURRENT_TIMESTAMP,
    locked_by = $2,
    attempt_count = attempt_count + 1
FROM claimed
WHERE jobs.id = claimed.id
RETURNING jobs.id, jobs.topic, jobs.attempt_count, jobs.aggregate_id,
          jobs.aggregate_version, jobs.payload
`.trim();

interface JobBase {
  readonly id: string;
  readonly attemptCount: number;
}

interface InvitationDispatchJobBase extends JobBase {
  readonly invitationId: string;
  readonly expectedVersion: bigint;
  readonly deliveryReference: string;
  readonly locale: 'en' | 'pt-BR';
  readonly campaignReference?: string;
}

export interface InvitationDeliveryWorkerJob extends InvitationDispatchJobBase {
  readonly kind: 'delivery';
}

export interface InvitationReminderWorkerJob extends InvitationDispatchJobBase {
  readonly kind: 'reminder';
}

interface PromotionJob extends JobBase {
  readonly kind: 'promotion';
}

interface RetentionJob extends JobBase {
  readonly kind: 'retention';
  readonly invitationId: string;
  readonly purposeRetentionUntil: string;
  readonly legalHoldUntil?: string;
  readonly afterRetention: 'delete-personal-data' | 'pseudonymize-personal-data';
  readonly pseudonymDigest: string;
}

interface BatchJob extends JobBase {
  readonly kind: 'batch';
  readonly action: InvitationBatchAction;
  readonly items: readonly Readonly<{ itemId: string; invitationId: string }>[];
}

export type AdminInvitationWorkerJob =
  | InvitationDeliveryWorkerJob
  | InvitationReminderWorkerJob
  | PromotionJob
  | RetentionJob
  | BatchJob;

export type InvitationDeliveryResult =
  | Readonly<{ ok: true; receiptId: string }>
  | Readonly<{
      ok: false;
      code: 'DELIVERY_UNAVAILABLE' | 'DELIVERY_REJECTED' | 'PERMANENT_BOUNCE';
      retryable: boolean;
    }>;

export interface InvitationDeliveryPort {
  send(
    input: Readonly<{
      deliveryReference: string;
      idempotencyKey: string;
      invitationId: string;
      kind: 'invitation' | 'reminder';
      locale: 'en' | 'pt-BR';
      campaignReference?: string;
    }>,
  ): Promise<InvitationDeliveryResult>;
}

export interface AdminInvitationBatchItemResult {
  readonly itemId: string;
  readonly invitationId: string;
  readonly outcome: 'completed' | 'failed' | 'skipped';
  readonly code?: string;
}

export interface AdminInvitationBatchPort {
  execute(
    input: Readonly<{
      action: InvitationBatchAction;
      idempotencyKey: string;
      invitationId: string;
      itemId: string;
      jobId: string;
    }>,
  ): Promise<
    Readonly<{ outcome: 'completed' | 'skipped' }> | Readonly<{ outcome: 'failed'; code: string }>
  >;
}

export interface AdminInvitationJobRepository {
  claim(
    input: Readonly<{ workerId: string; limit: number }>,
  ): Promise<readonly AdminInvitationWorkerJob[]>;
  effectRecorded(jobId: string): Promise<boolean>;
  loadInvitation(invitationId: string): Promise<BetaInvitationState | null>;
  persistTransition(
    input: Readonly<{
      jobId: string;
      expectedVersion: bigint;
      state: BetaInvitationState;
      enqueueDelivery: boolean;
      deliveryReceiptId?: string;
    }>,
  ): Promise<'applied' | 'replayed' | 'stale'>;
  complete(jobId: string, evidence: unknown): Promise<void>;
  retry(jobId: string, failure: Readonly<{ code: string; nextAttemptAt: string }>): Promise<void>;
  fail(jobId: string, failure: Readonly<{ code: string; failedAt: string }>): Promise<void>;
  listQueued(limit: number): Promise<readonly BetaInvitationState[]>;
  countActive(now: string): Promise<number>;
  recordBatchItem(result: AdminInvitationBatchItemResult): Promise<void>;
  listBatchResults(jobId: string): Promise<readonly AdminInvitationBatchItemResult[]>;
  finalizeBatch(
    jobId: string,
    receipt: Readonly<{
      receiptId: string;
      results: readonly AdminInvitationBatchItemResult[];
    }>,
  ): Promise<void>;
  pseudonymize(invitationId: string, pseudonymDigest: string, occurredAt: string): Promise<boolean>;
  deletePersonalData(invitationId: string, occurredAt: string): Promise<boolean>;
}

export interface AdminInvitationWorkerDependencies {
  readonly batch: AdminInvitationBatchPort;
  readonly delivery: InvitationDeliveryPort;
  readonly repository: AdminInvitationJobRepository;
}

export interface AdminInvitationWorkerInput {
  readonly batchSize?: number;
  readonly maxAttempts?: number;
  readonly now: string;
  readonly workerId: string;
}

export interface AdminInvitationWorkerResult {
  readonly claimed: number;
  readonly completed: number;
  readonly failed: number;
  readonly retried: number;
}

const validInstant = (value: string): boolean => Number.isFinite(Date.parse(value));

const retryDelay = (attemptCount: number): number =>
  Math.min(60_000, 1_000 * 2 ** Math.max(0, attemptCount - 1));

const nextAttemptAt = (now: string, attemptCount: number): string =>
  new Date(Date.parse(now) + retryDelay(attemptCount)).toISOString();

const deliveryInput = (job: InvitationDeliveryWorkerJob | InvitationReminderWorkerJob) => ({
  deliveryReference: job.deliveryReference,
  idempotencyKey: job.id,
  invitationId: job.invitationId,
  kind: job.kind === 'delivery' ? ('invitation' as const) : ('reminder' as const),
  locale: job.locale,
  ...(job.campaignReference === undefined ? {} : { campaignReference: job.campaignReference }),
});

const completedEvidence = (outcome: string): Readonly<{ outcome: string }> => ({ outcome });

export const runAdminInvitationJobsOnce = async (
  dependencies: AdminInvitationWorkerDependencies,
  input: AdminInvitationWorkerInput,
): Promise<AdminInvitationWorkerResult> => {
  if (!validInstant(input.now)) throw new Error('ADMIN_INVITATION_WORKER_TIME_INVALID');
  const batchSize = Math.min(50, Math.max(1, input.batchSize ?? 10));
  const maxAttempts = Math.min(10, Math.max(1, input.maxAttempts ?? 5));
  const jobs = await dependencies.repository.claim({
    workerId: input.workerId,
    limit: batchSize,
  });
  let completed = 0;
  let failed = 0;
  let retried = 0;

  const reject = async (job: AdminInvitationWorkerJob, code: string, retryable: boolean) => {
    if (retryable && job.attemptCount < maxAttempts) {
      await dependencies.repository.retry(job.id, {
        code,
        nextAttemptAt: nextAttemptAt(input.now, job.attemptCount),
      });
      retried += 1;
    } else {
      await dependencies.repository.fail(job.id, { code, failedAt: input.now });
      failed += 1;
    }
  };

  for (const job of jobs) {
    if (await dependencies.repository.effectRecorded(job.id)) {
      await dependencies.repository.complete(job.id, completedEvidence('replayed'));
      completed += 1;
      continue;
    }

    if (job.kind === 'delivery' || job.kind === 'reminder') {
      const current = await dependencies.repository.loadInvitation(job.invitationId);
      if (current?.status !== 'pending' || current.version !== job.expectedVersion) {
        await dependencies.repository.complete(job.id, completedEvidence('stopped'));
        completed += 1;
        continue;
      }

      const command =
        job.kind === 'reminder'
          ? ({ kind: 'remind', now: input.now } as const)
          : ({ kind: 'record-delivery', now: input.now, outcome: 'delivered' } as const);
      const reminderDecision =
        job.kind === 'reminder' ? decideBetaInvitationTransition(current, command) : null;
      if (reminderDecision !== null && !reminderDecision.accepted) {
        await dependencies.repository.complete(job.id, completedEvidence('stopped'));
        completed += 1;
        continue;
      }

      let deliveryResult: InvitationDeliveryResult;
      try {
        deliveryResult = await dependencies.delivery.send(deliveryInput(job));
      } catch {
        deliveryResult = { ok: false, code: 'DELIVERY_UNAVAILABLE', retryable: true };
      }
      if (!deliveryResult.ok && deliveryResult.retryable) {
        await reject(job, deliveryResult.code, true);
        continue;
      }

      const decision = deliveryResult.ok
        ? (reminderDecision ??
          decideBetaInvitationTransition(current, {
            kind: 'record-delivery',
            now: input.now,
            outcome: 'delivered',
          }))
        : decideBetaInvitationTransition(current, {
            kind: 'record-delivery',
            now: input.now,
            outcome: deliveryResult.code === 'PERMANENT_BOUNCE' ? 'permanently-bounced' : 'failed',
          });
      if (!decision.accepted) {
        await reject(job, decision.code, false);
        continue;
      }
      const persisted = await dependencies.repository.persistTransition({
        jobId: job.id,
        expectedVersion: current.version,
        state: decision.state,
        enqueueDelivery: false,
        ...(deliveryResult.ok ? { deliveryReceiptId: deliveryResult.receiptId } : {}),
      });
      if (persisted === 'stale') {
        await reject(job, 'INVITATION_VERSION_STALE', true);
        continue;
      }
      await dependencies.repository.complete(
        job.id,
        completedEvidence(deliveryResult.ok ? 'delivered' : 'delivery-failed'),
      );
      completed += 1;
      continue;
    }

    if (job.kind === 'promotion') {
      const active = await dependencies.repository.countActive(input.now);
      const availableSlots = Math.max(0, BETA_INVITATION_ACTIVE_LIMIT - active);
      const queued = await dependencies.repository.listQueued(BETA_INVITATION_ACTIVE_LIMIT);
      const invitationIds = selectNextBetaInvitationPromotions(queued, availableSlots);
      let promoted = 0;
      for (const invitationId of invitationIds) {
        const state = queued.find((candidate) => candidate.invitationId === invitationId);
        if (state === undefined) continue;
        const transitionId = `${job.id}:${invitationId}`;
        if (await dependencies.repository.effectRecorded(transitionId)) continue;
        const decision = decideBetaInvitationTransition(state, { kind: 'promote', now: input.now });
        if (!decision.accepted) continue;
        const persisted = await dependencies.repository.persistTransition({
          jobId: transitionId,
          expectedVersion: state.version,
          state: decision.state,
          enqueueDelivery: true,
        });
        if (persisted !== 'stale') promoted += 1;
      }
      await dependencies.repository.complete(job.id, { outcome: 'promotion-complete', promoted });
      completed += 1;
      continue;
    }

    if (job.kind === 'batch') {
      const results = [...(await dependencies.repository.listBatchResults(job.id))];
      for (const item of job.items) {
        const itemIdentity = `${job.id}:${item.itemId}`;
        if (await dependencies.repository.effectRecorded(itemIdentity)) continue;
        let result: Awaited<ReturnType<AdminInvitationBatchPort['execute']>>;
        try {
          result = await dependencies.batch.execute({
            action: job.action,
            idempotencyKey: itemIdentity,
            invitationId: item.invitationId,
            itemId: item.itemId,
            jobId: job.id,
          });
        } catch {
          result = { outcome: 'failed', code: 'BATCH_ITEM_UNAVAILABLE' };
        }
        const itemResult: AdminInvitationBatchItemResult = {
          itemId: item.itemId,
          invitationId: item.invitationId,
          outcome: result.outcome,
          ...(result.outcome === 'failed' ? { code: result.code } : {}),
        };
        await dependencies.repository.recordBatchItem(itemResult);
        results.push(itemResult);
      }
      await dependencies.repository.finalizeBatch(job.id, {
        receiptId: `${job.id}:receipt`,
        results,
      });
      await dependencies.repository.complete(job.id, {
        outcome: results.some((result) => result.outcome === 'failed')
          ? 'completed-with-failures'
          : 'completed',
        receiptId: `${job.id}:receipt`,
      });
      completed += 1;
      continue;
    }

    const state = await dependencies.repository.loadInvitation(job.invitationId);
    if (state === null) {
      await dependencies.repository.complete(job.id, completedEvidence('already-absent'));
      completed += 1;
      continue;
    }
    const retention = decideInvitationRetention(state, {
      now: input.now,
      purposeRetentionUntil: job.purposeRetentionUntil,
      ...(job.legalHoldUntil === undefined ? {} : { legalHoldUntil: job.legalHoldUntil }),
      afterRetention: job.afterRetention,
    });
    if (retention.action === 'retain') {
      const nextAt =
        retention.basis === 'legal-hold' && job.legalHoldUntil !== undefined
          ? job.legalHoldUntil
          : job.purposeRetentionUntil;
      await dependencies.repository.retry(job.id, {
        code: `RETENTION_${retention.basis.toUpperCase().replace('-', '_')}`,
        nextAttemptAt: nextAt,
      });
      retried += 1;
      continue;
    }
    const changed =
      retention.action === 'pseudonymize-personal-data'
        ? await dependencies.repository.pseudonymize(
            job.invitationId,
            job.pseudonymDigest,
            input.now,
          )
        : await dependencies.repository.deletePersonalData(job.invitationId, input.now);
    await dependencies.repository.complete(
      job.id,
      completedEvidence(changed ? retention.action : 'already-retained'),
    );
    completed += 1;
  }

  return { claimed: jobs.length, completed, failed, retried };
};
