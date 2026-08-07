import type { ProviderEventJson } from '@liiiraa/contracts-ts';

export const COMMERCE_WORK_CLAIM_SQL = `
WITH claimed AS (
  SELECT id
  FROM outbox_jobs
  WHERE topic = 'commerce.reconcile-provider'
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
RETURNING jobs.id, jobs.attempt_count, jobs.payload
`.trim();

export interface CommerceWorkerJob {
  readonly id: string;
  readonly attemptCount: number;
  readonly providerEvent: ProviderEventJson;
}

export interface CommerceWorkerRepository {
  claim(
    input: Readonly<{ workerId: string; limit: number }>,
  ): Promise<readonly CommerceWorkerJob[]>;
  complete(jobId: string): Promise<void>;
  retry(jobId: string, delayMs: number): Promise<void>;
  fail(jobId: string): Promise<void>;
}

export interface CommerceWorkerOptions {
  readonly workerId: string;
  readonly batchSize?: number;
  readonly maxAttempts?: number;
}

export interface AdminControlPlaneWorkerDependencies {
  readonly invitations: (
    input: Readonly<{
      batchSize: number;
      now: string;
      workerId: string;
    }>,
  ) => Promise<Readonly<{ claimed: number }>>;
  readonly operations: Readonly<{
    claim(
      input: Readonly<{
        workerId: string;
        maximumItems: number;
        leaseUntil: string;
      }>,
    ): Promise<readonly unknown[]>;
  }>;
}

export interface AdminControlPlaneWorkerInput {
  readonly workerId: string;
  readonly batchSize?: number;
  readonly now: string;
  readonly leaseUntil: string;
}

export const runAdminControlPlaneWorkersOnce = async (
  dependencies: AdminControlPlaneWorkerDependencies,
  input: AdminControlPlaneWorkerInput,
): Promise<Readonly<{ invitationJobs: number; operationalItems: number }>> => {
  const batchSize = Math.min(50, Math.max(1, input.batchSize ?? 10));
  if (
    input.workerId.trim().length === 0 ||
    !Number.isFinite(Date.parse(input.now)) ||
    !Number.isFinite(Date.parse(input.leaseUntil)) ||
    Date.parse(input.leaseUntil) <= Date.parse(input.now)
  ) {
    throw new Error('ADMIN_CONTROL_PLANE_WORKER_INPUT_INVALID');
  }
  const [invitationResult, operationalItems] = await Promise.all([
    dependencies.invitations({ batchSize, now: input.now, workerId: input.workerId }),
    dependencies.operations.claim({
      workerId: input.workerId,
      maximumItems: batchSize,
      leaseUntil: input.leaseUntil,
    }),
  ]);
  return Object.freeze({
    invitationJobs: invitationResult.claimed,
    operationalItems: operationalItems.length,
  });
};

const retryDelay = (attemptCount: number): number =>
  Math.min(60_000, 1_000 * 2 ** Math.max(0, attemptCount));

export const runCommerceWorkerOnce = async (
  repository: CommerceWorkerRepository,
  reconcile: (providerEvent: ProviderEventJson) => Promise<boolean>,
  options: CommerceWorkerOptions,
): Promise<Readonly<{ claimed: number; completed: number; retried: number; failed: number }>> => {
  const batchSize = Math.min(50, Math.max(1, options.batchSize ?? 10));
  const maxAttempts = Math.min(10, Math.max(1, options.maxAttempts ?? 5));
  const jobs = await repository.claim({ workerId: options.workerId, limit: batchSize });
  let completed = 0;
  let retried = 0;
  let failed = 0;
  for (const job of jobs) {
    let reconciled = false;
    try {
      reconciled = await reconcile(job.providerEvent);
    } catch {
      reconciled = false;
    }
    if (reconciled) {
      await repository.complete(job.id);
      completed += 1;
    } else if (job.attemptCount + 1 >= maxAttempts) {
      await repository.fail(job.id);
      failed += 1;
    } else {
      await repository.retry(job.id, retryDelay(job.attemptCount));
      retried += 1;
    }
  }
  return { claimed: jobs.length, completed, retried, failed };
};
