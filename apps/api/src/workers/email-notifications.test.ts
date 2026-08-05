import type {
  EmailDelivery,
  EmailDeliveryResult,
  EmailNotification,
  EmailPort,
} from '@liiiraa/control-plane-application';
import { createSesSandboxEmailAdapter, type SesV2Transport } from '@liiiraa/control-plane-adapters';
import { describe, expect, it } from 'vitest';

import {
  EMAIL_NOTIFICATION_CLAIM_SQL,
  EMAIL_NOTIFICATION_TOPIC_CLASSES,
  EMAIL_RETRY_MAX_DELAY_MS,
  runEmailNotificationWorkerOnce,
  type EmailNotificationJob,
  type EmailNotificationRepository,
} from './email-notifications.js';
import { renderEmailNotification } from './email-templates.js';

const NOW = '2026-08-05T14:00:00.000Z';
const RECIPIENT = 'invited@example.test';

const notificationMatrix = [
  {
    class: 'identity.recovery-hold',
    values: { holdUntil: '2026-08-06T14:00:00.000Z', recoveryReference: 'recovery-01' },
  },
  {
    class: 'identity.recovery-contested',
    values: { recoveryReference: 'recovery-01' },
  },
  {
    class: 'commerce.grace-started',
    values: { graceEndsAt: '2026-08-12T14:00:00.000Z', subscriptionReference: 'subscription-01' },
  },
  {
    class: 'commerce.payment-retry',
    values: { nextAttemptAt: '2026-08-06T14:00:00.000Z', subscriptionReference: 'subscription-01' },
  },
  {
    class: 'commerce.pix-renewal-reminder',
    values: { renewalAt: '2026-09-05T14:00:00.000Z', subscriptionReference: 'subscription-01' },
  },
  {
    class: 'commerce.price-change',
    values: {
      currentPrice: 'R$ 29,90',
      effectiveAt: '2026-09-05T14:00:00.000Z',
      newPrice: 'R$ 32,90',
      subscriptionReference: 'subscription-01',
    },
  },
  {
    class: 'commerce.refund',
    values: { commerceReference: 'refund-01', status: 'confirmed' },
  },
  {
    class: 'commerce.dispute',
    values: { commerceReference: 'dispute-01', status: 'under-review' },
  },
  {
    class: 'identity.invitation',
    values: { expiresAt: '2026-08-12T14:00:00.000Z', invitationReference: 'invitation-01' },
  },
  {
    class: 'support.case',
    values: { caseReference: 'case-01', responseTarget: '24 business hours', status: 'open' },
  },
] as const satisfies readonly Pick<EmailNotification, 'class' | 'values'>[];

const notificationFor = (
  entry: (typeof notificationMatrix)[number],
  locale: EmailNotification['locale'] = 'en',
): EmailNotification => ({
  ...entry,
  locale,
  recipient: RECIPIENT,
});

class MemoryEmailRepository implements EmailNotificationRepository {
  readonly jobs: EmailNotificationJob[] = [];
  readonly deliveries: Readonly<{ jobId: string; receiptId: string; sentAt: string }>[] = [];
  readonly retries: Readonly<{
    errorCode: string;
    jobId: string;
    nextAttemptAt: string;
  }>[] = [];
  readonly failures: Readonly<{ errorCode: string; failedAt: string; jobId: string }>[] = [];
  private readonly claimed = new Set<string>();

  claim(input: Readonly<{ limit: number; workerId: string }>) {
    const jobs = this.jobs.filter((job) => !this.claimed.has(job.id)).slice(0, input.limit);
    jobs.forEach((job) => this.claimed.add(job.id));
    return Promise.resolve(jobs);
  }

  persistDelivery(
    jobId: string,
    receipt: Readonly<{ receiptId: string; sentAt: string }>,
  ): Promise<void> {
    this.deliveries.push({ jobId, ...receipt });
    return Promise.resolve();
  }

  retry(
    jobId: string,
    failure: Readonly<{ errorCode: string; nextAttemptAt: string }>,
  ): Promise<void> {
    this.retries.push({ jobId, ...failure });
    return Promise.resolve();
  }

  fail(jobId: string, failure: Readonly<{ errorCode: string; failedAt: string }>): Promise<void> {
    this.failures.push({ jobId, ...failure });
    return Promise.resolve();
  }
}

class MemoryEmailPort implements EmailPort {
  readonly deliveries: EmailDelivery[] = [];
  result: EmailDeliveryResult = { ok: true, receiptId: 'ses-message-redacted-01' };

  send(delivery: EmailDelivery): Promise<EmailDeliveryResult> {
    this.deliveries.push(delivery);
    return Promise.resolve(this.result);
  }
}

const jobFor = (
  notification: EmailNotification,
  overrides: Partial<EmailNotificationJob> = {},
): EmailNotificationJob => ({
  attemptCount: 1,
  id: `job-${notification.class}`,
  notification,
  topic:
    notification.class === 'identity.recovery-hold'
      ? 'identity.recovery-notice'
      : notification.class === 'identity.recovery-contested'
        ? 'identity.recovery-contested'
        : notification.class.startsWith('commerce.')
          ? 'commerce.lifecycle-notification'
          : notification.class === 'identity.invitation'
            ? 'identity.invitation-notice'
            : 'support.case-notice',
  ...overrides,
});

describe('bounded localized notification templates', () => {
  it.each(notificationMatrix)(
    'renders $class in English and PT-BR without reconstructing authority',
    (entry) => {
      for (const locale of ['en', 'pt-BR'] as const) {
        const rendered = renderEmailNotification(notificationFor(entry, locale));
        expect(rendered.ok).toBe(true);
        if (!rendered.ok) continue;
        expect(rendered.message.subject.length).toBeGreaterThan(0);
        expect(rendered.message.subject.length).toBeLessThanOrEqual(120);
        expect(rendered.message.text.length).toBeLessThanOrEqual(2_000);
        expect(rendered.message.text).toContain(Object.values(entry.values)[0]);
        expect(JSON.stringify(rendered)).not.toMatch(
          /token|factor|diagnostic|provider[_ -]?payload/iu,
        );
      }
    },
  );

  it('fails closed for unknown class, missing locale, extra values, and sensitive-looking values', () => {
    const supportEntry = notificationMatrix.at(-1);
    if (supportEntry === undefined) throw new Error('synthetic-support-entry-required');
    const valid = notificationFor(supportEntry);
    const invalid = [
      { ...valid, class: 'support.unknown' },
      { ...valid, locale: undefined },
      { ...valid, values: { ...valid.values, accessToken: 'secret-token' } },
      { ...valid, values: { ...valid.values, caseReference: 'Bearer secret-token' } },
    ];

    for (const notification of invalid) {
      expect(renderEmailNotification(notification)).toEqual({
        ok: false,
        code: 'EMAIL_CONTENT_REJECTED',
      });
    }
  });
});

describe('email notification outbox worker', () => {
  it('exhaustively maps every required producer topic to its closed notification classes', () => {
    expect(EMAIL_NOTIFICATION_TOPIC_CLASSES).toEqual({
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
    });
    expect(EMAIL_NOTIFICATION_CLAIM_SQL).toMatch(/FOR UPDATE SKIP LOCKED/iu);
    expect(EMAIL_NOTIFICATION_CLAIM_SQL).toMatch(/attempt_count = attempt_count \+ 1/iu);
  });

  it('uses the outbox job ID as the idempotency identity and does not resend a replayed claim', async () => {
    const repository = new MemoryEmailRepository();
    const port = new MemoryEmailPort();
    repository.jobs.push(jobFor(notificationFor(notificationMatrix[0])));

    const first = await runEmailNotificationWorkerOnce(
      { port, repository },
      { now: NOW, workerId: 'email-worker-a' },
    );
    const replay = await runEmailNotificationWorkerOnce(
      { port, repository },
      { now: NOW, workerId: 'email-worker-b' },
    );

    expect(first).toEqual({ claimed: 1, delivered: 1, failed: 0, retried: 0 });
    expect(replay).toEqual({ claimed: 0, delivered: 0, failed: 0, retried: 0 });
    expect(port.deliveries).toHaveLength(1);
    expect(port.deliveries[0]?.idempotencyKey).toBe(repository.jobs[0]?.id);
    expect(repository.deliveries).toEqual([
      { jobId: repository.jobs[0]?.id, receiptId: 'ses-message-redacted-01', sentAt: NOW },
    ]);
  });

  it('backs retryable provider failure off within a bound and records the final failure durably', async () => {
    const retryRepository = new MemoryEmailRepository();
    const retryPort = new MemoryEmailPort();
    retryPort.result = { ok: false, code: 'EMAIL_PROVIDER_UNAVAILABLE', retryable: true };
    retryRepository.jobs.push(
      jobFor(notificationFor(notificationMatrix[2]), { attemptCount: 1, id: 'job-retry' }),
    );

    await expect(
      runEmailNotificationWorkerOnce(
        { port: retryPort, repository: retryRepository },
        { maxAttempts: 5, now: NOW, workerId: 'email-worker-retry' },
      ),
    ).resolves.toEqual({ claimed: 1, delivered: 0, failed: 0, retried: 1 });
    const retry = retryRepository.retries[0];
    if (retry === undefined) throw new Error('retry-evidence-required');
    expect(Date.parse(retry.nextAttemptAt) - Date.parse(NOW)).toBeLessThanOrEqual(
      EMAIL_RETRY_MAX_DELAY_MS,
    );
    expect(retryRepository.retries[0]?.errorCode).toBe('EMAIL_PROVIDER_UNAVAILABLE');

    const terminalRepository = new MemoryEmailRepository();
    const terminalPort = new MemoryEmailPort();
    terminalPort.result = retryPort.result;
    terminalRepository.jobs.push(
      jobFor(notificationFor(notificationMatrix[2]), { attemptCount: 5, id: 'job-terminal' }),
    );
    await expect(
      runEmailNotificationWorkerOnce(
        { port: terminalPort, repository: terminalRepository },
        { maxAttempts: 5, now: NOW, workerId: 'email-worker-terminal' },
      ),
    ).resolves.toEqual({ claimed: 1, delivered: 0, failed: 1, retried: 0 });
    expect(terminalRepository.failures).toEqual([
      { errorCode: 'EMAIL_PROVIDER_UNAVAILABLE', failedAt: NOW, jobId: 'job-terminal' },
    ]);
  });

  it('records malformed content or a topic/class mismatch as terminal without calling SES', async () => {
    const repository = new MemoryEmailRepository();
    const port = new MemoryEmailPort();
    repository.jobs.push(
      jobFor({ ...notificationFor(notificationMatrix[9]), locale: undefined } as never, {
        id: 'job-missing-locale',
      }),
      jobFor(notificationFor(notificationMatrix[9]), {
        id: 'job-topic-mismatch',
        topic: 'identity.recovery-notice',
      }),
    );

    await expect(
      runEmailNotificationWorkerOnce(
        { port, repository },
        { now: NOW, workerId: 'email-worker-reject' },
      ),
    ).resolves.toEqual({ claimed: 2, delivered: 0, failed: 2, retried: 0 });
    expect(port.deliveries).toHaveLength(0);
    expect(repository.failures.map((failure) => failure.errorCode)).toEqual([
      'EMAIL_CONTENT_REJECTED',
      'EMAIL_CLASS_REJECTED',
    ]);
  });
});

describe('SES sandbox adapter', () => {
  it('sends only to a verified invited recipient and tags the message with the outbox identity', async () => {
    const requests: unknown[] = [];
    const transport: SesV2Transport = {
      send: (command) => {
        requests.push(command.input);
        return Promise.resolve({ MessageId: 'ses-message-01' });
      },
    };
    const adapter = createSesSandboxEmailAdapter({
      sourceAddress: 'verified-sender@example.test',
      transport,
      verifiedInvitedRecipients: [RECIPIENT],
    });
    const rendered = renderEmailNotification(notificationFor(notificationMatrix[8]));
    if (!rendered.ok) throw new Error('synthetic-template-required');

    await expect(
      adapter.send({
        ...rendered.message,
        idempotencyKey: 'job-invitation-01',
        recipient: RECIPIENT,
      }),
    ).resolves.toEqual({ ok: true, receiptId: 'ses-message-01' });
    expect(requests).toHaveLength(1);
    expect(requests[0]).toMatchObject({
      Destination: { ToAddresses: [RECIPIENT] },
      EmailTags: [{ Name: 'outbox-job-id', Value: 'job-invitation-01' }],
      FromEmailAddress: 'verified-sender@example.test',
    });
  });

  it('rejects an unverified sandbox recipient and exposes no provider exception payload', async () => {
    let calls = 0;
    const transport: SesV2Transport = {
      send: () => {
        calls += 1;
        throw Object.assign(new Error('token=provider-secret'), {
          requestId: 'provider-request-secret',
        });
      },
    };
    const adapter = createSesSandboxEmailAdapter({
      sourceAddress: 'verified-sender@example.test',
      transport,
      verifiedInvitedRecipients: [RECIPIENT],
    });
    const rendered = renderEmailNotification(notificationFor(notificationMatrix[8]));
    if (!rendered.ok) throw new Error('synthetic-template-required');
    const delivery = {
      ...rendered.message,
      idempotencyKey: 'job-invitation-02',
      recipient: 'not-verified@example.test',
    };

    await expect(adapter.send(delivery)).resolves.toEqual({
      ok: false,
      code: 'EMAIL_RECIPIENT_NOT_VERIFIED',
      retryable: false,
    });
    expect(calls).toBe(0);

    await expect(
      adapter.send({ ...delivery, recipient: RECIPIENT, text: 'Bearer provider-secret' }),
    ).resolves.toEqual({
      ok: false,
      code: 'EMAIL_CONTENT_REJECTED',
      retryable: false,
    });
    expect(calls).toBe(0);

    const providerFailure = await adapter.send({ ...delivery, recipient: RECIPIENT });
    expect(providerFailure).toEqual({
      ok: false,
      code: 'EMAIL_PROVIDER_UNAVAILABLE',
      retryable: true,
    });
    expect(JSON.stringify(providerFailure)).not.toMatch(/provider-secret|request-secret/iu);
  });
});
