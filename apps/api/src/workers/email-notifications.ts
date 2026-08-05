import type {
  EmailNotification,
  EmailNotificationClass,
  EmailPort,
} from '@liiiraa/control-plane-application';

import { renderEmailNotification } from './email-templates.js';

export const EMAIL_NOTIFICATION_TOPIC_CLASSES = {
  'commerce.command-notice': ['commerce.price-change'],
  'commerce.lifecycle-notification': [
    'commerce.grace-started',
    'commerce.payment-retry',
    'commerce.pix-renewal-reminder',
    'commerce.refund',
    'commerce.dispute',
  ],
  'commerce.refund-review': ['commerce.refund'],
  'identity.invitation-notice': ['identity.invitation'],
  'identity.recovery-contested': ['identity.recovery-contested'],
  'identity.recovery-notice': ['identity.recovery-hold'],
  'support.case-notice': ['support.case'],
} as const satisfies Readonly<Record<string, readonly EmailNotificationClass[]>>;

export type EmailNotificationTopic = keyof typeof EMAIL_NOTIFICATION_TOPIC_CLASSES;

const notificationTopics = Object.keys(
  EMAIL_NOTIFICATION_TOPIC_CLASSES,
) as EmailNotificationTopic[];
const sqlTopics = notificationTopics.map((topic) => `'${topic}'`).join(', ');

export const EMAIL_NOTIFICATION_CLAIM_SQL = `
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
RETURNING jobs.id, jobs.topic, jobs.attempt_count, jobs.payload
`.trim();

export const EMAIL_RETRY_MAX_DELAY_MS = 60_000;

export interface EmailNotificationJob {
  readonly attemptCount: number;
  readonly id: string;
  readonly notification: EmailNotification;
  readonly topic: EmailNotificationTopic;
}

export interface EmailNotificationRepository {
  claim(
    input: Readonly<{ limit: number; workerId: string }>,
  ): Promise<readonly EmailNotificationJob[]>;
  persistDelivery(
    jobId: string,
    receipt: Readonly<{ receiptId: string; sentAt: string }>,
  ): Promise<void>;
  retry(
    jobId: string,
    failure: Readonly<{ errorCode: string; nextAttemptAt: string }>,
  ): Promise<void>;
  fail(jobId: string, failure: Readonly<{ errorCode: string; failedAt: string }>): Promise<void>;
}

export interface EmailNotificationWorkerDependencies {
  readonly port: EmailPort;
  readonly repository: EmailNotificationRepository;
}

export interface EmailNotificationWorkerInput {
  readonly batchSize?: number;
  readonly maxAttempts?: number;
  readonly now: string;
  readonly workerId: string;
}

export interface EmailNotificationWorkerResult {
  readonly claimed: number;
  readonly delivered: number;
  readonly failed: number;
  readonly retried: number;
}

const retryDelay = (attemptCount: number): number =>
  Math.min(EMAIL_RETRY_MAX_DELAY_MS, 1_000 * 2 ** Math.max(0, attemptCount - 1));

const classAllowedForTopic = (job: EmailNotificationJob): boolean => {
  const admitted = EMAIL_NOTIFICATION_TOPIC_CLASSES[job.topic] as
    readonly EmailNotificationClass[] | undefined;
  return admitted?.includes(job.notification.class) === true;
};

export const runEmailNotificationWorkerOnce = async (
  dependencies: EmailNotificationWorkerDependencies,
  input: EmailNotificationWorkerInput,
): Promise<EmailNotificationWorkerResult> => {
  const batchSize = Math.min(50, Math.max(1, input.batchSize ?? 10));
  const maxAttempts = Math.min(10, Math.max(1, input.maxAttempts ?? 5));
  const jobs = await dependencies.repository.claim({ limit: batchSize, workerId: input.workerId });
  let delivered = 0;
  let failed = 0;
  let retried = 0;

  for (const job of jobs) {
    const rendered = renderEmailNotification(job.notification);
    if (!rendered.ok || !classAllowedForTopic(job)) {
      await dependencies.repository.fail(job.id, {
        errorCode: rendered.ok ? 'EMAIL_CLASS_REJECTED' : rendered.code,
        failedAt: input.now,
      });
      failed += 1;
      continue;
    }

    let deliveryResult: Awaited<ReturnType<EmailPort['send']>>;
    try {
      deliveryResult = await dependencies.port.send({
        ...rendered.message,
        idempotencyKey: job.id,
        recipient: job.notification.recipient,
      });
    } catch {
      deliveryResult = { ok: false, code: 'EMAIL_PROVIDER_UNAVAILABLE', retryable: true };
    }

    if (deliveryResult.ok) {
      await dependencies.repository.persistDelivery(job.id, {
        receiptId: deliveryResult.receiptId,
        sentAt: input.now,
      });
      delivered += 1;
    } else if (deliveryResult.retryable && job.attemptCount < maxAttempts) {
      await dependencies.repository.retry(job.id, {
        errorCode: deliveryResult.code,
        nextAttemptAt: new Date(Date.parse(input.now) + retryDelay(job.attemptCount)).toISOString(),
      });
      retried += 1;
    } else {
      await dependencies.repository.fail(job.id, {
        errorCode: deliveryResult.code,
        failedAt: input.now,
      });
      failed += 1;
    }
  }

  return { claimed: jobs.length, delivered, failed, retried };
};
