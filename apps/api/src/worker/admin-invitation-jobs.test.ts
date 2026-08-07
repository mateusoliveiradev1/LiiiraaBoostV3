import type { BetaInvitationState } from '@liiiraa/control-plane-domain';
import { describe, expect, it } from 'vitest';

import {
  ADMIN_INVITATION_JOB_CLAIM_SQL,
  runAdminInvitationJobsOnce,
  type AdminInvitationBatchItemResult,
  type AdminInvitationJobRepository,
  type AdminInvitationWorkerJob,
  type InvitationDeliveryWorkerJob,
  type InvitationDeliveryPort,
  type InvitationReminderWorkerJob,
} from './admin-invitation-jobs.js';

const NOW = '2030-01-10T12:00:00.000Z';

const invitation = (
  invitationId: string,
  overrides: Partial<BetaInvitationState> = {},
): BetaInvitationState => ({
  kind: 'beta',
  invitationId,
  recipientKey: `digest-${invitationId}`,
  locale: 'pt-BR',
  version: 1n,
  status: 'pending',
  reminderCount: 0,
  reminderWindowStartedAt: '2030-01-01T00:00:00.000Z',
  expiresAt: '2030-01-15T00:00:00.000Z',
  createdAt: '2030-01-01T00:00:00.000Z',
  updatedAt: '2030-01-01T00:00:00.000Z',
  events: [{ kind: 'sent', at: '2030-01-01T00:00:00.000Z' }],
  ...overrides,
});

const queuedInvitation = (invitationId: string, queuePosition: number): BetaInvitationState => {
  const { expiresAt: _expiresAt, ...base } = invitation(invitationId);
  void _expiresAt;
  return { ...base, status: 'queued', queuePosition };
};

class MemoryDeliveryPort implements InvitationDeliveryPort {
  readonly calls: Parameters<InvitationDeliveryPort['send']>[0][] = [];
  private readonly receipts = new Map<string, string>();

  send(input: Parameters<InvitationDeliveryPort['send']>[0]) {
    this.calls.push(input);
    const receiptId = this.receipts.get(input.idempotencyKey) ?? `receipt-${input.idempotencyKey}`;
    this.receipts.set(input.idempotencyKey, receiptId);
    return Promise.resolve({ ok: true as const, receiptId });
  }
}

class MemoryRepository implements AdminInvitationJobRepository {
  readonly jobs: AdminInvitationWorkerJob[] = [];
  readonly invitations = new Map<string, BetaInvitationState>();
  readonly recorded = new Set<string>();
  readonly transitions: Readonly<{
    jobId: string;
    state: BetaInvitationState;
    enqueueDelivery: boolean;
  }>[] = [];
  readonly completed: Readonly<{ jobId: string; evidence: unknown }>[] = [];
  readonly retries: Readonly<{ jobId: string; code: string; nextAttemptAt: string }>[] = [];
  readonly failures: Readonly<{ jobId: string; code: string }>[] = [];
  readonly batchResults: AdminInvitationBatchItemResult[] = [];
  readonly batchReceipts: Readonly<{ jobId: string; receiptId: string }>[] = [];
  readonly pseudonymized: string[] = [];
  failNextCompletion = false;
  activeCountOverride: number | undefined;

  claim(input: Readonly<{ workerId: string; limit: number }>) {
    void input.workerId;
    return Promise.resolve(
      this.jobs
        .filter((job) => !this.completed.some((entry) => entry.jobId === job.id))
        .slice(0, input.limit),
    );
  }

  effectRecorded(jobId: string) {
    return Promise.resolve(this.recorded.has(jobId));
  }

  loadInvitation(invitationId: string) {
    return Promise.resolve(this.invitations.get(invitationId) ?? null);
  }

  persistTransition(input: Parameters<AdminInvitationJobRepository['persistTransition']>[0]) {
    if (this.recorded.has(input.jobId)) return Promise.resolve('replayed' as const);
    const current = this.invitations.get(input.state.invitationId);
    if (current?.version !== input.expectedVersion) return Promise.resolve('stale' as const);
    this.invitations.set(input.state.invitationId, input.state);
    this.recorded.add(input.jobId);
    this.transitions.push({
      jobId: input.jobId,
      state: input.state,
      enqueueDelivery: input.enqueueDelivery,
    });
    return Promise.resolve('applied' as const);
  }

  complete(jobId: string, evidence: unknown) {
    if (this.failNextCompletion) {
      this.failNextCompletion = false;
      return Promise.reject(new Error('synthetic-crash-after-effect'));
    }
    if (!this.completed.some((entry) => entry.jobId === jobId)) {
      this.completed.push({ jobId, evidence });
    }
    return Promise.resolve();
  }

  retry(jobId: string, failure: Readonly<{ code: string; nextAttemptAt: string }>) {
    this.retries.push({ jobId, ...failure });
    return Promise.resolve();
  }

  fail(jobId: string, failure: Readonly<{ code: string; failedAt: string }>) {
    void failure.failedAt;
    this.failures.push({ jobId, code: failure.code });
    return Promise.resolve();
  }

  listQueued(limit: number) {
    return Promise.resolve(
      [...this.invitations.values()].filter((state) => state.status === 'queued').slice(0, limit),
    );
  }

  countActive() {
    if (this.activeCountOverride !== undefined) {
      return Promise.resolve(this.activeCountOverride);
    }
    return Promise.resolve(
      [...this.invitations.values()].filter((state) => state.status === 'pending').length,
    );
  }

  recordBatchItem(result: AdminInvitationBatchItemResult) {
    if (!this.batchResults.some((entry) => entry.itemId === result.itemId)) {
      this.batchResults.push(result);
    }
    this.recorded.add(`batch-job:${result.itemId}`);
    return Promise.resolve();
  }

  listBatchResults(jobId: string) {
    return Promise.resolve(
      this.batchResults.filter((result) => this.recorded.has(`${jobId}:${result.itemId}`)),
    );
  }

  finalizeBatch(
    jobId: string,
    receipt: Readonly<{ receiptId: string; results: readonly AdminInvitationBatchItemResult[] }>,
  ) {
    if (!this.batchReceipts.some((entry) => entry.jobId === jobId)) {
      this.batchReceipts.push({ jobId, receiptId: receipt.receiptId });
    }
    return Promise.resolve();
  }

  pseudonymize(invitationId: string, pseudonymDigest: string, occurredAt: string) {
    void pseudonymDigest;
    void occurredAt;
    this.pseudonymized.push(invitationId);
    return Promise.resolve(true);
  }

  deletePersonalData(invitationId: string, occurredAt: string) {
    void occurredAt;
    this.pseudonymized.push(`deleted:${invitationId}`);
    return Promise.resolve(true);
  }
}

const deliveryJob = (
  overrides: Partial<Omit<InvitationDeliveryWorkerJob, 'kind'>> & {
    readonly kind?: 'delivery' | 'reminder';
  } = {},
): InvitationDeliveryWorkerJob | InvitationReminderWorkerJob => {
  const base = {
    id: 'job-delivery-one',
    attemptCount: 1,
    invitationId: 'invitation-one',
    expectedVersion: 1n,
    deliveryReference: 'opaque-delivery-one',
    locale: 'pt-BR' as const,
    campaignReference: 'private-beta-2030',
    ...overrides,
  };
  return overrides.kind === 'reminder'
    ? { ...base, kind: 'reminder' }
    : { ...base, kind: 'delivery' };
};

describe('durable admin invitation worker', () => {
  it('claims only bounded due jobs with row locking and persisted attempt identity', () => {
    expect(ADMIN_INVITATION_JOB_CLAIM_SQL).toMatch(/FOR UPDATE SKIP LOCKED/iu);
    expect(ADMIN_INVITATION_JOB_CLAIM_SQL).toMatch(/available_at <= CURRENT_TIMESTAMP/iu);
    expect(ADMIN_INVITATION_JOB_CLAIM_SQL).toMatch(/attempt_count = attempt_count \+ 1/iu);
    expect(ADMIN_INVITATION_JOB_CLAIM_SQL).toMatch(/admin\.invitation/iu);
  });

  it('survives a crash after delivery without duplicating delivery or lifecycle events', async () => {
    const repository = new MemoryRepository();
    const delivery = new MemoryDeliveryPort();
    repository.jobs.push(deliveryJob());
    repository.invitations.set('invitation-one', invitation('invitation-one'));
    repository.failNextCompletion = true;

    await expect(
      runAdminInvitationJobsOnce(
        {
          batch: { execute: () => Promise.resolve({ outcome: 'completed' }) },
          delivery,
          repository,
        },
        { now: NOW, workerId: 'worker-one' },
      ),
    ).rejects.toThrow('synthetic-crash-after-effect');
    await expect(
      runAdminInvitationJobsOnce(
        {
          batch: { execute: () => Promise.resolve({ outcome: 'completed' }) },
          delivery,
          repository,
        },
        { now: NOW, workerId: 'worker-two' },
      ),
    ).resolves.toMatchObject({ completed: 1 });

    expect(delivery.calls).toHaveLength(1);
    expect(delivery.calls[0]).toMatchObject({
      idempotencyKey: 'job-delivery-one',
      locale: 'pt-BR',
      campaignReference: 'private-beta-2030',
    });
    expect(repository.transitions).toHaveLength(1);
    expect(
      repository.transitions[0]?.state.events.filter((event) => event.kind === 'delivered'),
    ).toHaveLength(1);
  });

  it('stops reminders for terminal states and enforces the domain maximum of two', async () => {
    const repository = new MemoryRepository();
    const delivery = new MemoryDeliveryPort();
    const stoppedStatuses = [
      'accepted',
      'expired',
      'declined',
      'revoked',
      'permanently-bounced',
    ] as const;
    for (const [index, status] of stoppedStatuses.entries()) {
      const invitationId = `stopped-${String(index)}`;
      repository.invitations.set(invitationId, invitation(invitationId, { status, closedAt: NOW }));
      repository.jobs.push({
        ...deliveryJob(),
        id: `reminder-${String(index)}`,
        kind: 'reminder',
        invitationId,
        deliveryReference: `opaque-${String(index)}`,
      });
    }
    repository.invitations.set(
      'reminder-limit',
      invitation('reminder-limit', { reminderCount: 2 }),
    );
    repository.jobs.push({
      ...deliveryJob(),
      id: 'reminder-limit-job',
      kind: 'reminder',
      invitationId: 'reminder-limit',
    });
    repository.invitations.set(
      'reminder-due',
      invitation('reminder-due', {
        reminderCount: 1,
        expiresAt: '2030-01-12T12:00:00.000Z',
      }),
    );
    repository.jobs.push({
      ...deliveryJob(),
      id: 'reminder-due-job',
      kind: 'reminder',
      invitationId: 'reminder-due',
    });

    await runAdminInvitationJobsOnce(
      { batch: { execute: () => Promise.resolve({ outcome: 'completed' }) }, delivery, repository },
      { now: NOW, workerId: 'reminder-worker' },
    );

    expect(delivery.calls).toHaveLength(1);
    expect(delivery.calls[0]?.idempotencyKey).toBe('reminder-due-job');
    expect(repository.invitations.get('reminder-due')?.reminderCount).toBe(2);
    expect(repository.invitations.get('reminder-limit')?.reminderCount).toBe(2);
  });

  it('promotes the oldest eligible queued invitation when capacity is released', async () => {
    const repository = new MemoryRepository();
    const delivery = new MemoryDeliveryPort();
    repository.activeCountOverride = 24;
    repository.invitations.set('queued-second', queuedInvitation('queued-second', 2));
    repository.invitations.set('queued-first', queuedInvitation('queued-first', 1));
    repository.jobs.push({ id: 'promotion-job', kind: 'promotion', attemptCount: 1 });

    await runAdminInvitationJobsOnce(
      { batch: { execute: () => Promise.resolve({ outcome: 'completed' }) }, delivery, repository },
      { now: NOW, workerId: 'promotion-worker' },
    );

    expect(repository.invitations.get('queued-first')).toMatchObject({
      status: 'pending',
      version: 2n,
    });
    expect(repository.invitations.get('queued-second')?.status).toBe('queued');
    expect(repository.transitions[0]).toMatchObject({
      jobId: 'promotion-job:queued-first',
      enqueueDelivery: true,
    });
  });

  it('preserves partial batch results and emits one final receipt on replay', async () => {
    const repository = new MemoryRepository();
    const delivery = new MemoryDeliveryPort();
    repository.jobs.push({
      id: 'batch-job',
      kind: 'batch',
      attemptCount: 1,
      action: 'revoke',
      items: [
        { itemId: 'item-one', invitationId: 'invitation-one' },
        { itemId: 'item-two', invitationId: 'invitation-two' },
      ],
    });
    const execute = (input: Readonly<{ itemId: string }>) =>
      Promise.resolve(
        input.itemId === 'item-one'
          ? ({ outcome: 'completed' } as const)
          : ({ outcome: 'failed', code: 'STALE' } as const),
      );

    repository.failNextCompletion = true;
    await expect(
      runAdminInvitationJobsOnce(
        { batch: { execute }, delivery, repository },
        { now: NOW, workerId: 'batch-worker-crash' },
      ),
    ).rejects.toThrow('synthetic-crash-after-effect');
    await runAdminInvitationJobsOnce(
      { batch: { execute }, delivery, repository },
      { now: NOW, workerId: 'batch-worker-replay' },
    );

    expect(repository.batchResults).toEqual([
      { itemId: 'item-one', invitationId: 'invitation-one', outcome: 'completed' },
      { itemId: 'item-two', invitationId: 'invitation-two', outcome: 'failed', code: 'STALE' },
    ]);
    expect(repository.batchReceipts).toEqual([
      { jobId: 'batch-job', receiptId: 'batch-job:receipt' },
    ]);
    expect(repository.completed).toHaveLength(1);
  });

  it('pseudonymizes closed invitations only after bounded retention is due', async () => {
    const repository = new MemoryRepository();
    const delivery = new MemoryDeliveryPort();
    repository.invitations.set(
      'closed-one',
      invitation('closed-one', { status: 'declined', closedAt: '2030-01-02T00:00:00.000Z' }),
    );
    repository.jobs.push({
      id: 'retention-job',
      kind: 'retention',
      attemptCount: 1,
      invitationId: 'closed-one',
      purposeRetentionUntil: '2030-01-05T00:00:00.000Z',
      afterRetention: 'pseudonymize-personal-data',
      pseudonymDigest: 'pseudonym-only-no-email',
    });

    await runAdminInvitationJobsOnce(
      { batch: { execute: () => Promise.resolve({ outcome: 'completed' }) }, delivery, repository },
      { now: NOW, workerId: 'retention-worker' },
    );

    expect(repository.pseudonymized).toEqual(['closed-one']);
    expect(JSON.stringify(repository.completed)).not.toMatch(/@|recipientKey|provider/iu);
  });
});
