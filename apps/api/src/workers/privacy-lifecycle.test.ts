import type {
  AccountDeletionState,
  DeleteAccountDependencies,
  DeletionEvidence,
  PrivateObjectDeleteResult,
  PrivateObjectLifecyclePort,
  SupportLifecycleCommandResult,
  SupportLifecycleOutboxJob,
  SupportLifecycleRepository,
  SupportLifecycleTransaction,
} from '@liiiraa/control-plane-application';
import {
  createS3ObjectLifecycleAdapter,
  type S3ObjectLifecycleClient,
} from '@liiiraa/control-plane-adapters';
import { describe, expect, it } from 'vitest';

import {
  PRIVACY_LIFECYCLE_CLAIM_SQL,
  runPrivacyLifecycleWorkerOnce,
  type PrivacyLifecycleJob,
  type PrivacyLifecycleRepository,
} from './privacy-lifecycle.js';

const REQUESTED_AT = '2030-08-01T12:00:00.000Z';
const FINALIZE_AT = '2030-08-08T12:00:00.000Z';
const CHECKSUM = 'a'.repeat(64);

class MemoryJobRepository implements PrivacyLifecycleRepository {
  readonly jobs: PrivacyLifecycleJob[] = [];
  readonly completed: Readonly<{ evidence: unknown; jobId: string }>[] = [];
  readonly deleted: Readonly<{ jobId: string; objectId: string; receipt: unknown }>[] = [];
  readonly retries: Readonly<{ code: string; jobId: string; nextAttemptAt: string }>[] = [];
  readonly failures: Readonly<{ code: string; failedAt: string; jobId: string }>[] = [];
  readonly expiredRetention: string[] = [];
  readonly evidence = new Map<string, readonly DeletionEvidence[]>();
  private readonly claimed = new Set<string>();

  claim(input: Readonly<{ limit: number; workerId: string }>) {
    const jobs = this.jobs.filter((job) => !this.claimed.has(job.id)).slice(0, input.limit);
    jobs.forEach((job) => this.claimed.add(job.id));
    return Promise.resolve(jobs);
  }

  listRetentionEvidence(accountId: string) {
    return Promise.resolve(this.evidence.get(accountId) ?? []);
  }

  recordObjectDeletion(jobId: string, objectId: string, receipt: unknown) {
    if (!this.deleted.some((entry) => entry.jobId === jobId && entry.objectId === objectId)) {
      this.deleted.push({ jobId, objectId, receipt });
    }
    return Promise.resolve();
  }

  complete(jobId: string, evidence: unknown) {
    if (!this.completed.some((entry) => entry.jobId === jobId)) {
      this.completed.push({ evidence, jobId });
    }
    return Promise.resolve();
  }

  retry(jobId: string, failure: Readonly<{ code: string; nextAttemptAt: string }>) {
    this.retries.push({ jobId, ...failure });
    return Promise.resolve();
  }

  fail(jobId: string, failure: Readonly<{ code: string; failedAt: string }>) {
    this.failures.push({ jobId, ...failure });
    return Promise.resolve();
  }

  expireRetention(job: Extract<PrivacyLifecycleJob, { topic: 'account.retention-expiry' }>) {
    this.expiredRetention.push(`${job.payload.accountId}:${job.payload.evidenceClass}`);
    return Promise.resolve();
  }
}

class MemoryObjectPort implements PrivateObjectLifecyclePort {
  readonly requests: unknown[] = [];
  result: PrivateObjectDeleteResult = {
    ok: true,
    receipt: {
      alreadyAbsent: false,
      checksumSha256: CHECKSUM,
      deletedAt: FINALIZE_AT,
      providerReceipt: 'object-version-redacted-01',
    },
  };

  delete(input: Parameters<PrivateObjectLifecyclePort['delete']>[0]) {
    this.requests.push(input);
    return Promise.resolve(this.result);
  }

  head(): ReturnType<PrivateObjectLifecyclePort['head']> {
    return Promise.resolve({
      ok: true,
      object: { checksumSha256: CHECKSUM, providerReceipt: 'head-redacted-01' },
    });
  }
}

interface LifecycleState {
  deletion: AccountDeletionState;
  ordinaryEraseCount: number;
  outbox: SupportLifecycleOutboxJob[];
}

class LockedDeletionRepository implements SupportLifecycleRepository {
  readonly state: LifecycleState;
  private tail = Promise.resolve();

  constructor(deletion: AccountDeletionState) {
    this.state = { deletion, ordinaryEraseCount: 0, outbox: [] };
  }

  transaction<T>(_accountId: string, operation: (tx: SupportLifecycleTransaction) => Promise<T>) {
    const previous = this.tail;
    let release = (): void => undefined;
    this.tail = new Promise<void>((resolve) => {
      release = resolve;
    });
    return previous.then(async () => {
      try {
        return await operation(this.view());
      } finally {
        release();
      }
    });
  }

  private view(): SupportLifecycleTransaction {
    const commandResults = new Map<string, SupportLifecycleCommandResult>();
    return {
      findCommandResult: (id) => Promise.resolve(commandResults.get(id) ?? null),
      rememberCommandResult: (id, result) => void commandResults.set(id, result) || Promise.resolve(),
      loadCase: () => Promise.resolve(null),
      saveCase: () => Promise.resolve(),
      loadConsent: () => Promise.resolve(null),
      saveConsent: () => Promise.resolve(),
      expireCaseConsents: () => Promise.resolve([]),
      loadDeletion: () => Promise.resolve(this.state.deletion),
      saveDeletion: (state) => {
        this.state.deletion = state;
        return Promise.resolve();
      },
      eraseOrdinaryAccountData: () => {
        this.state.ordinaryEraseCount += 1;
        return Promise.resolve();
      },
      appendAudit: () => Promise.resolve(),
      enqueueOutbox: (job) => {
        if (!this.state.outbox.some((entry) => entry.idempotencyKey === job.idempotencyKey)) {
          this.state.outbox.push(job);
        }
        return Promise.resolve();
      },
    };
  }
}

const pendingDeletion = (): AccountDeletionState => ({
  accountId: 'account-one',
  version: 1n,
  status: 'pending',
  retentionRecords: [],
  requestId: 'deletion-one',
  requestedAt: REQUESTED_AT,
  finalizeAt: FINALIZE_AT,
});

const deletionDependencies = (repository: LockedDeletionRepository): DeleteAccountDependencies => ({
  repository,
  clock: { now: () => new Date(FINALIZE_AT) },
  ids: { next: () => `outbox-${String(repository.state.outbox.length + 1)}` },
});

const objectJob = (
  topic: 'support.attachment-purge' | 'support.consent-copy-disposal',
): PrivacyLifecycleJob => ({
  id: `job-${topic}`,
  topic,
  aggregateId: topic === 'support.attachment-purge' ? 'case-one' : 'consent-one',
  aggregateVersion: '2',
  attemptCount: 1,
  scheduledAt: topic === 'support.attachment-purge' ? '2030-08-31T12:00:00.000Z' : REQUESTED_AT,
  payload: {
    objects: [
      {
        bucketClass: 'diagnostic-package',
        checksumSha256: CHECKSUM,
        objectId: 'object-one',
        objectKey: 'diagnostics/case-one/object-one',
      },
    ],
  },
});

const accountJob = (): PrivacyLifecycleJob => ({
  id: 'job-account-finalization',
  topic: 'account.deletion-finalize',
  aggregateId: 'account-one',
  aggregateVersion: '1',
  attemptCount: 1,
  scheduledAt: FINALIZE_AT,
  payload: { accountId: 'account-one', deletionVersion: '1', requestId: 'deletion-one' },
});

describe('privacy lifecycle claim and object purge', () => {
  it('claims exact versioned due jobs under a row lock', () => {
    expect(PRIVACY_LIFECYCLE_CLAIM_SQL).toMatch(/FOR UPDATE SKIP LOCKED/iu);
    expect(PRIVACY_LIFECYCLE_CLAIM_SQL).toMatch(/aggregate_version/iu);
    expect(PRIVACY_LIFECYCLE_CLAIM_SQL).toMatch(/available_at <= CURRENT_TIMESTAMP/iu);
  });

  it.each(['support.attachment-purge', 'support.consent-copy-disposal'] as const)(
    'deletes %s bytes before persisting checksum/provider evidence and completes replays once',
    async (topic) => {
      const jobs = new MemoryJobRepository();
      const objects = new MemoryObjectPort();
      const deletion = new LockedDeletionRepository(pendingDeletion());
      jobs.jobs.push(objectJob(topic));

      const first = await runPrivacyLifecycleWorkerOnce(
        { deletion: deletionDependencies(deletion), objects, repository: jobs },
        { now: topic === 'support.attachment-purge' ? '2030-08-31T12:00:00.000Z' : REQUESTED_AT, workerId: 'privacy-a' },
      );
      const replay = await runPrivacyLifecycleWorkerOnce(
        { deletion: deletionDependencies(deletion), objects, repository: jobs },
        { now: FINALIZE_AT, workerId: 'privacy-b' },
      );

      expect(first).toEqual({ claimed: 1, completed: 1, failed: 0, retried: 0 });
      expect(replay).toEqual({ claimed: 0, completed: 0, failed: 0, retried: 0 });
      expect(objects.requests).toHaveLength(1);
      expect(jobs.deleted).toEqual([
        expect.objectContaining({
          objectId: 'object-one',
          receipt: expect.objectContaining({
            checksumSha256: CHECKSUM,
            providerReceipt: 'object-version-redacted-01',
          }),
        }),
      ]);
    },
  );

  it('retries provider failure without false deletion, then persists terminal health evidence', async () => {
    const retryJobs = new MemoryJobRepository();
    const objects = new MemoryObjectPort();
    const deletion = new LockedDeletionRepository(pendingDeletion());
    objects.result = { ok: false, code: 'OBJECT_PROVIDER_UNAVAILABLE', retryable: true };
    retryJobs.jobs.push(objectJob('support.attachment-purge'));

    await expect(
      runPrivacyLifecycleWorkerOnce(
        { deletion: deletionDependencies(deletion), objects, repository: retryJobs },
        { maxAttempts: 5, now: '2030-08-31T12:00:00.000Z', workerId: 'privacy-retry' },
      ),
    ).resolves.toEqual({ claimed: 1, completed: 0, failed: 0, retried: 1 });
    expect(retryJobs.deleted).toHaveLength(0);
    expect(retryJobs.retries[0]?.code).toBe('OBJECT_PROVIDER_UNAVAILABLE');

    const terminalJobs = new MemoryJobRepository();
    terminalJobs.jobs.push({ ...objectJob('support.attachment-purge'), attemptCount: 5 });
    await runPrivacyLifecycleWorkerOnce(
      { deletion: deletionDependencies(deletion), objects, repository: terminalJobs },
      { maxAttempts: 5, now: '2030-08-31T12:00:00.000Z', workerId: 'privacy-terminal' },
    );
    expect(terminalJobs.deleted).toHaveLength(0);
    expect(terminalJobs.failures).toEqual([
      {
        code: 'OBJECT_PROVIDER_UNAVAILABLE',
        failedAt: '2030-08-31T12:00:00.000Z',
        jobId: 'job-support.attachment-purge',
      },
    ]);
  });
});

describe('seven-day account finalization and bounded retention', () => {
  it('does not finalize before the exact boundary and lets a locked cancellation win', async () => {
    const earlyJobs = new MemoryJobRepository();
    const earlyDeletion = new LockedDeletionRepository(pendingDeletion());
    earlyJobs.jobs.push(accountJob());
    await runPrivacyLifecycleWorkerOnce(
      { deletion: deletionDependencies(earlyDeletion), objects: new MemoryObjectPort(), repository: earlyJobs },
      { now: '2030-08-08T11:59:59.999Z', workerId: 'privacy-early' },
    );
    expect(earlyDeletion.state.ordinaryEraseCount).toBe(0);
    expect(earlyJobs.retries).toEqual([
      { code: 'ACCOUNT_DELETION_NOT_DUE', jobId: 'job-account-finalization', nextAttemptAt: FINALIZE_AT },
    ]);

    const canceledJobs = new MemoryJobRepository();
    const canceledDeletion = new LockedDeletionRepository({
      ...pendingDeletion(),
      status: 'canceled',
      version: 2n,
      canceledAt: '2030-08-08T11:59:59.999Z',
    });
    canceledJobs.jobs.push(accountJob());
    await runPrivacyLifecycleWorkerOnce(
      { deletion: deletionDependencies(canceledDeletion), objects: new MemoryObjectPort(), repository: canceledJobs },
      { now: FINALIZE_AT, workerId: 'privacy-canceled' },
    );
    expect(canceledDeletion.state.ordinaryEraseCount).toBe(0);
    expect(canceledJobs.completed[0]?.evidence).toMatchObject({ outcome: 'cancellation-won' });
  });

  it('erases ordinary data at day seven and schedules only exact bounded retention expiries', async () => {
    const jobs = new MemoryJobRepository();
    const deletion = new LockedDeletionRepository(pendingDeletion());
    jobs.jobs.push(accountJob());
    jobs.evidence.set('account-one', [
      { evidenceClass: 'billing-invoice-tax', sourceAt: '2030-01-02T00:00:00.000Z' },
      { evidenceClass: 'security-recovery', sourceAt: '2030-03-04T00:00:00.000Z' },
      { evidenceClass: 'administrative-audit', sourceAt: '2030-05-06T00:00:00.000Z' },
    ]);

    await expect(
      runPrivacyLifecycleWorkerOnce(
        { deletion: deletionDependencies(deletion), objects: new MemoryObjectPort(), repository: jobs },
        { now: FINALIZE_AT, workerId: 'privacy-finalize' },
      ),
    ).resolves.toEqual({ claimed: 1, completed: 1, failed: 0, retried: 0 });
    expect(deletion.state.ordinaryEraseCount).toBe(1);
    expect(deletion.state.deletion.status).toBe('partially-retained');
    expect(deletion.state.deletion.retentionRecords.map((record) => record.retainUntil)).toEqual([
      '2035-01-02T00:00:00.000Z',
      '2032-03-04T00:00:00.000Z',
      '2035-05-06T00:00:00.000Z',
    ]);
    expect(
      deletion.state.outbox.filter((job) => job.topic === 'account.retention-expiry'),
    ).toHaveLength(3);
  });

  it('expires each retained row through the same idempotent worker', async () => {
    const jobs = new MemoryJobRepository();
    const deletion = new LockedDeletionRepository(pendingDeletion());
    jobs.jobs.push({
      id: 'job-retention-expiry',
      topic: 'account.retention-expiry',
      aggregateId: 'account-one',
      aggregateVersion: '2',
      attemptCount: 1,
      scheduledAt: '2035-01-02T00:00:00.000Z',
      payload: {
        accountId: 'account-one',
        evidenceClass: 'billing-invoice-tax',
        sourceAt: '2030-01-02T00:00:00.000Z',
        retainUntil: '2035-01-02T00:00:00.000Z',
      },
    });
    await runPrivacyLifecycleWorkerOnce(
      { deletion: deletionDependencies(deletion), objects: new MemoryObjectPort(), repository: jobs },
      { now: '2035-01-02T00:00:00.000Z', workerId: 'privacy-retention' },
    );
    expect(jobs.expiredRetention).toEqual(['account-one:billing-invoice-tax']);
    expect(jobs.completed).toHaveLength(1);
  });
});

describe('S3 private-object lifecycle adapter', () => {
  it('heads checksum metadata, deletes the exact object, and returns bounded provider evidence', async () => {
    const commands: unknown[] = [];
    const client: S3ObjectLifecycleClient = {
      send: (command) => {
        commands.push(command);
        return Promise.resolve(
          commands.length === 1
            ? { Metadata: { 'content-digest': CHECKSUM }, VersionId: 'version-01' }
            : { VersionId: 'delete-marker-01' },
        );
      },
    };
    const adapter = createS3ObjectLifecycleAdapter({
      buckets: { 'diagnostic-package': 'diagnostics-private' },
      client,
      now: () => new Date(FINALIZE_AT),
    });

    await expect(
      adapter.delete({
        bucketClass: 'diagnostic-package',
        checksumSha256: CHECKSUM,
        idempotencyKey: 'job-object-one',
        objectKey: 'diagnostics/case-one/object-one',
      }),
    ).resolves.toEqual({
      ok: true,
      receipt: {
        alreadyAbsent: false,
        checksumSha256: CHECKSUM,
        deletedAt: FINALIZE_AT,
        providerReceipt: 'delete-marker-01',
      },
    });
    expect(commands).toHaveLength(2);
    expect(commands[0]).toMatchObject({ input: { Bucket: 'diagnostics-private', ChecksumMode: 'ENABLED' } });
    expect(commands[1]).toMatchObject({ input: { Bucket: 'diagnostics-private', Key: 'diagnostics/case-one/object-one', VersionId: 'version-01' } });
  });
});
