import {
  deleteAccount,
  type DeleteAccountDependencies,
  type DeletionEvidence,
  type PrivateObjectClass,
  type PrivateObjectDeleteReceipt,
  type PrivateObjectLifecyclePort,
  type RetainedEvidenceClass,
} from '@liiiraa/control-plane-application';

const privacyTopics = [
  'support.attachment-purge',
  'support.consent-copy-disposal',
  'account.deletion-finalize',
  'account.retention-expiry',
] as const;
const sqlTopics = privacyTopics.map((topic) => `'${topic}'`).join(', ');

export const PRIVACY_LIFECYCLE_CLAIM_SQL = `
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
RETURNING jobs.id, jobs.topic, jobs.aggregate_id, jobs.aggregate_version,
          jobs.attempt_count, jobs.available_at, jobs.payload
`.trim();

export const ACCOUNT_DELETION_LOCK_SQL = `
SELECT id, identity_id, status, scheduled_for, version
FROM deletion_requests
WHERE id = $1 AND identity_id = $2
FOR UPDATE
`.trim();

export interface PrivacyLifecycleObject {
  readonly bucketClass: PrivateObjectClass;
  readonly checksumSha256: string;
  readonly objectId: string;
  readonly objectKey: string;
}

interface JobBase {
  readonly id: string;
  readonly aggregateId: string;
  readonly aggregateVersion: string;
  readonly attemptCount: number;
  readonly scheduledAt: string;
}

type ObjectLifecycleJob<
  TTopic extends 'support.attachment-purge' | 'support.consent-copy-disposal',
> = JobBase &
  Readonly<{
    topic: TTopic;
    payload: Readonly<{ objects: readonly PrivacyLifecycleObject[] }>;
  }>;

export type PrivacyLifecycleJob =
  | ObjectLifecycleJob<'support.attachment-purge'>
  | ObjectLifecycleJob<'support.consent-copy-disposal'>
  | (JobBase &
      Readonly<{
        topic: 'account.deletion-finalize';
        payload: Readonly<{
          accountId: string;
          deletionVersion: string;
          requestId: string;
        }>;
      }>)
  | (JobBase &
      Readonly<{
        topic: 'account.retention-expiry';
        payload: Readonly<{
          accountId: string;
          evidenceClass: RetainedEvidenceClass;
          retainUntil: string;
          sourceAt: string;
        }>;
      }>);

export interface PrivacyLifecycleRepository {
  claim(
    input: Readonly<{ limit: number; workerId: string }>,
  ): Promise<readonly PrivacyLifecycleJob[]>;
  listRetentionEvidence(accountId: string): Promise<readonly DeletionEvidence[]>;
  recordObjectDeletion(
    jobId: string,
    objectId: string,
    receipt: PrivateObjectDeleteReceipt,
  ): Promise<void>;
  complete(jobId: string, evidence: Readonly<Record<string, unknown>>): Promise<void>;
  retry(jobId: string, failure: Readonly<{ code: string; nextAttemptAt: string }>): Promise<void>;
  fail(jobId: string, failure: Readonly<{ code: string; failedAt: string }>): Promise<void>;
  expireRetention(
    job: Extract<PrivacyLifecycleJob, { topic: 'account.retention-expiry' }>,
    expiredAt: string,
  ): Promise<void>;
}

export interface PrivacyLifecycleDependencies {
  readonly deletion: DeleteAccountDependencies;
  readonly objects: PrivateObjectLifecyclePort;
  readonly repository: PrivacyLifecycleRepository;
}

export interface PrivacyLifecycleWorkerInput {
  readonly batchSize?: number;
  readonly maxAttempts?: number;
  readonly now: string;
  readonly workerId: string;
}

export interface PrivacyLifecycleWorkerResult {
  readonly claimed: number;
  readonly completed: number;
  readonly failed: number;
  readonly retried: number;
}

const MAX_RETRY_DELAY_MS = 60_000;
const VERSION = /^(?:0|[1-9][0-9]*)$/u;
const retryDelay = (attemptCount: number): number =>
  Math.min(MAX_RETRY_DELAY_MS, 1_000 * 2 ** Math.max(0, attemptCount - 1));

const validTime = (value: string): boolean => {
  const parsed = new Date(value);
  return Number.isFinite(parsed.getTime()) && parsed.toISOString() === value;
};

const nextRetry = (job: PrivacyLifecycleJob, now: string): string =>
  new Date(Date.parse(now) + retryDelay(job.attemptCount)).toISOString();

export const runPrivacyLifecycleWorkerOnce = async (
  dependencies: PrivacyLifecycleDependencies,
  input: PrivacyLifecycleWorkerInput,
): Promise<PrivacyLifecycleWorkerResult> => {
  const batchSize = Math.min(50, Math.max(1, input.batchSize ?? 10));
  const maxAttempts = Math.min(10, Math.max(1, input.maxAttempts ?? 5));
  const jobs = await dependencies.repository.claim({ limit: batchSize, workerId: input.workerId });
  let completed = 0;
  let failed = 0;
  let retried = 0;

  const reject = async (job: PrivacyLifecycleJob, code: string, retryable: boolean) => {
    if (retryable && job.attemptCount < maxAttempts) {
      await dependencies.repository.retry(job.id, {
        code,
        nextAttemptAt: nextRetry(job, input.now),
      });
      retried += 1;
    } else {
      await dependencies.repository.fail(job.id, { code, failedAt: input.now });
      failed += 1;
    }
  };

  for (const job of jobs) {
    if (
      !validTime(input.now) ||
      !validTime(job.scheduledAt) ||
      !VERSION.test(job.aggregateVersion)
    ) {
      await reject(job, 'PRIVACY_JOB_INVALID', false);
      continue;
    }

    if (job.topic === 'support.attachment-purge' || job.topic === 'support.consent-copy-disposal') {
      let objectFailure = false;
      for (const object of job.payload.objects) {
        let result: Awaited<ReturnType<PrivateObjectLifecyclePort['delete']>>;
        try {
          result = await dependencies.objects.delete({
            bucketClass: object.bucketClass,
            checksumSha256: object.checksumSha256,
            idempotencyKey: `${job.id}:${object.objectId}`,
            objectKey: object.objectKey,
          });
        } catch {
          result = { ok: false, code: 'OBJECT_PROVIDER_UNAVAILABLE', retryable: true };
        }
        if (!result.ok) {
          await reject(job, result.code, result.retryable);
          objectFailure = true;
          break;
        }
        await dependencies.repository.recordObjectDeletion(job.id, object.objectId, result.receipt);
      }
      if (objectFailure) continue;
      await dependencies.repository.complete(job.id, {
        completedAt: input.now,
        objectCount: job.payload.objects.length,
        outcome:
          job.topic === 'support.attachment-purge'
            ? 'attachments-purged'
            : 'consent-copies-disposed',
      });
      completed += 1;
      continue;
    }

    if (job.topic === 'account.retention-expiry') {
      if (
        !validTime(job.payload.retainUntil) ||
        Date.parse(input.now) < Date.parse(job.payload.retainUntil)
      ) {
        await dependencies.repository.retry(job.id, {
          code: 'RETENTION_NOT_DUE',
          nextAttemptAt: job.payload.retainUntil,
        });
        retried += 1;
        continue;
      }
      await dependencies.repository.expireRetention(job, input.now);
      await dependencies.repository.complete(job.id, {
        completedAt: input.now,
        evidenceClass: job.payload.evidenceClass,
        outcome: 'retention-expired',
      });
      completed += 1;
      continue;
    }

    if (!VERSION.test(job.payload.deletionVersion) || job.payload.accountId !== job.aggregateId) {
      await reject(job, 'PRIVACY_JOB_INVALID', false);
      continue;
    }
    const evidence = await dependencies.repository.listRetentionEvidence(job.payload.accountId);
    const result = await deleteAccount(
      { ...dependencies.deletion, clock: { now: () => new Date(input.now) } },
      {
        accountId: job.payload.accountId,
        action: { evidence, kind: 'finalize' },
        commandId: `privacy-worker:${job.id}`,
        expectedVersion: BigInt(job.payload.deletionVersion),
      },
    );
    if (!result.ok && result.code === 'DELETION_WINDOW_ACTIVE') {
      await dependencies.repository.retry(job.id, {
        code: 'ACCOUNT_DELETION_NOT_DUE',
        nextAttemptAt: job.scheduledAt,
      });
      retried += 1;
      continue;
    }
    if (!result.ok && (result.code === 'STALE' || result.code === 'DELETION_NOT_PENDING')) {
      await dependencies.repository.complete(job.id, {
        completedAt: input.now,
        outcome: 'cancellation-won',
      });
      completed += 1;
      continue;
    }
    if (!result.ok) {
      await reject(job, result.code, false);
      continue;
    }
    await dependencies.repository.complete(job.id, {
      completedAt: input.now,
      outcome: 'account-finalized',
      status: result.state.status,
    });
    completed += 1;
  }

  return { claimed: jobs.length, completed, failed, retried };
};
