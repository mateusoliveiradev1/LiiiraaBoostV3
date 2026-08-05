import type {
  AuditAnchor,
  AuditAnchorCheckpoint,
  AuditAnchorFailureCode,
  AuditAnchorPort,
} from '@liiiraa/control-plane-application';
import {
  anchorDueAuditHeads,
  verifyAuditAnchors,
  type AuditAnchorJob,
  type AuditAnchorReceipt,
  type AuditAnchorScheduleRepository,
  type AuditAnchorVerificationJob,
} from '@liiiraa/control-plane-application';
import { describe, expect, it } from 'vitest';

import {
  AUDIT_ANCHOR_CLAIM_SQL,
  assertSeparatedAuditAnchorCustody,
  runAuditAnchorWorkerOnce,
  runAuditAnchorVerificationOnce,
} from './audit-anchors.js';

const NOW = '2026-08-05T12:15:00.000Z';
const HASH = 'a'.repeat(64);
const OBJECT_VERSION = 'immutable-version-0001';

const anchorFor = (checkpoint: AuditAnchorCheckpoint): AuditAnchor => ({
  schemaVersion: '1.0',
  kind: 'audit-anchor',
  ...checkpoint,
  checksum: 'b'.repeat(64),
  signature: 'synthetic-signature',
  signatureAlgorithm: 'ECDSA_SHA_256',
  signingKeyId: 'audit-signing-role-key',
  objectKey: `audit-anchors/${checkpoint.streamId}/${String(checkpoint.sequenceNumber).padStart(20, '0')}-${checkpoint.eventHash}.json`,
  objectVersion: OBJECT_VERSION,
  retainUntil: '2031-08-05T12:15:00.000Z',
});

class MemoryAnchorPort implements AuditAnchorPort {
  readonly writes: AuditAnchorCheckpoint[] = [];
  readonly anchors = new Map<string, AuditAnchor>();
  failure: AuditAnchorFailureCode | null = null;
  forgedHealthy = false;

  write(checkpoint: AuditAnchorCheckpoint) {
    this.writes.push(checkpoint);
    if (this.failure !== null) {
      return Promise.resolve({ ok: false as const, code: this.failure, retryable: true });
    }
    const anchor = anchorFor(checkpoint);
    this.anchors.set(anchor.objectKey, anchor);
    if (this.forgedHealthy) {
      return Promise.resolve({ ok: true, anchor, verified: false } as never);
    }
    return Promise.resolve({ ok: true as const, anchor, verified: true as const });
  }

  read(objectKey: string) {
    if (this.failure !== null) {
      return Promise.resolve({ ok: false as const, code: this.failure, retryable: true });
    }
    const anchor = this.anchors.get(objectKey);
    return anchor === undefined
      ? Promise.resolve({
          ok: false as const,
          code: 'ANCHOR_READ_FAILED' as const,
          retryable: true,
        })
      : Promise.resolve({ ok: true as const, anchor, verified: true as const });
  }
}

class MemoryScheduleRepository implements AuditAnchorScheduleRepository {
  readonly due: AuditAnchorJob[] = [];
  readonly verification: AuditAnchorVerificationJob[] = [];
  readonly receipts: AuditAnchorReceipt[] = [];
  readonly failures: { readonly code: string; readonly terminal: boolean }[] = [];
  readonly verificationModes: string[] = [];
  private readonly claimed = new Set<string>();

  claimDue(input: Parameters<AuditAnchorScheduleRepository['claimDue']>[0]) {
    const selected = this.due.filter((job) => {
      if (this.claimed.has(job.claimId)) return false;
      const age = Date.parse(input.now) - Date.parse(job.lastAnchoredAt);
      return job.eventsSinceAnchor >= input.maxEvents || age >= input.maxAgeMs;
    });
    selected.slice(0, input.limit).forEach((job) => this.claimed.add(job.claimId));
    return Promise.resolve(selected.slice(0, input.limit));
  }

  persistReceipt(_claimId: string, receipt: AuditAnchorReceipt) {
    this.receipts.push(receipt);
    return Promise.resolve();
  }

  recordAnchorFailure(
    _claimId: string,
    failure: Readonly<{ code: string; terminal: boolean }>,
  ) {
    this.failures.push(failure);
    return Promise.resolve();
  }

  claimVerification(input: Parameters<AuditAnchorScheduleRepository['claimVerification']>[0]) {
    this.verificationModes.push(input.mode);
    return Promise.resolve(this.verification.filter((job) => job.mode === input.mode));
  }

  recordVerification(
    _claimId: string,
    result: Readonly<{ code?: string; healthy: boolean }>,
  ) {
    if (!result.healthy) {
      this.failures.push({ code: result.code ?? 'ANCHOR_INVALID', terminal: false });
    }
    return Promise.resolve();
  }
}

const dueJob = (overrides: Partial<AuditAnchorJob> = {}): AuditAnchorJob => ({
  claimId: 'claim-admin-1000',
  attemptCount: 0,
  streamId: 'admin-security',
  segmentId: 'segment-2026-08-05-12',
  segmentStartedAt: '2026-08-05T12:00:00.000Z',
  lastAnchoredAt: '2026-08-05T12:00:00.000Z',
  lastAnchoredSequence: 0,
  eventsSinceAnchor: 1_000,
  head: { streamId: 'admin-security', lastSequence: 1_000, lastHash: HASH },
  ...overrides,
});

describe('audit-anchor-worker durable schedule', () => {
  it('claims with SKIP LOCKED semantics and anchors at 15 minutes or 1,000 events exactly once', async () => {
    expect(AUDIT_ANCHOR_CLAIM_SQL).toMatch(/FOR UPDATE SKIP LOCKED/iu);
    expect(AUDIT_ANCHOR_CLAIM_SQL).toMatch(/1_?000|1000/iu);
    expect(AUDIT_ANCHOR_CLAIM_SQL).toMatch(/15 minutes/iu);

    const repository = new MemoryScheduleRepository();
    repository.due.push(
      dueJob(),
      dueJob({
        claimId: 'claim-time',
        eventsSinceAnchor: 1,
        head: { streamId: 'security', lastSequence: 1, lastHash: HASH },
        streamId: 'security',
      }),
      dueJob({
        claimId: 'claim-not-due',
        eventsSinceAnchor: 999,
        lastAnchoredAt: '2026-08-05T12:00:00.001Z',
      }),
    );
    const port = new MemoryAnchorPort();

    const results = await Promise.all([
      runAuditAnchorWorkerOnce({ repository, port }, { now: NOW, workerId: 'worker-a' }),
      runAuditAnchorWorkerOnce({ repository, port }, { now: NOW, workerId: 'worker-b' }),
    ]);

    expect(results.reduce((total, result) => total + result.anchored, 0)).toBe(2);
    expect(port.writes).toHaveLength(2);
    expect(repository.receipts).toHaveLength(2);
  });

  it('persists a verified five-year immutable receipt with exact head and object version', async () => {
    const repository = new MemoryScheduleRepository();
    repository.due.push(dueJob());
    const port = new MemoryAnchorPort();

    const result = await anchorDueAuditHeads(
      { repository, port },
      { limit: 10, maxAttempts: 3, now: NOW, workerId: 'worker-receipt' },
    );

    expect(result).toEqual({ anchored: 1, claimed: 1, failed: 0, retried: 0 });
    expect(repository.receipts[0]).toMatchObject({
      purpose: 'audit-chain-integrity',
      streamId: 'admin-security',
      segmentId: 'segment-2026-08-05-12',
      sequenceNumber: 1_000,
      eventHash: HASH,
      objectVersion: OBJECT_VERSION,
      retainUntil: '2031-08-05T12:15:00.000Z',
      verifiedAt: NOW,
    });
  });

  it.each([
    'ANCHOR_WRITE_FAILED',
    'ANCHOR_READ_FAILED',
    'ANCHOR_CHECKSUM_MISMATCH',
    'ANCHOR_RETENTION_MISMATCH',
  ] as const)('keeps %s visibly unhealthy and retryable within a bound', async (code) => {
    const repository = new MemoryScheduleRepository();
    repository.due.push(dueJob({ attemptCount: 1 }));
    const port = new MemoryAnchorPort();
    port.failure = code;

    const result = await anchorDueAuditHeads(
      { repository, port },
      { limit: 10, maxAttempts: 3, now: NOW, workerId: 'worker-failure' },
    );

    expect(result).toEqual({ anchored: 0, claimed: 1, failed: 0, retried: 1 });
    expect(repository.receipts).toHaveLength(0);
    expect(repository.failures).toEqual([{ code, terminal: false }]);
    expect(JSON.stringify(repository.failures)).not.toMatch(/provider|aws|kms|stack/iu);
  });

  it('runs daily latest-anchor verification and monthly complete-segment continuity drills', async () => {
    const repository = new MemoryScheduleRepository();
    const port = new MemoryAnchorPort();
    const checkpoint = {
      schemaVersion: '1.0' as const,
      kind: 'audit-anchor-checkpoint' as const,
      streamId: 'admin-security',
      segmentId: 'segment-2026-08-05-12',
      sequenceNumber: 1_000,
      eventHash: HASH,
      segmentStartedAt: '2026-08-05T12:00:00.000Z',
      anchoredAt: NOW,
      eventCount: 1_000,
    };
    const anchor = anchorFor(checkpoint);
    port.anchors.set(anchor.objectKey, anchor);
    repository.verification.push(
      {
        claimId: 'verify-daily',
        mode: 'latest',
        attemptCount: 0,
        receipt: {
          ...anchor,
          purpose: 'audit-chain-integrity',
          verifiedAt: NOW,
        },
        databaseHead: { streamId: 'admin-security', lastSequence: 1_000, lastHash: HASH },
      },
      {
        claimId: 'verify-monthly',
        mode: 'complete-segment',
        attemptCount: 0,
        receipt: {
          ...anchor,
          purpose: 'audit-chain-integrity',
          verifiedAt: NOW,
        },
        databaseHead: { streamId: 'admin-security', lastSequence: 1_000, lastHash: HASH },
        segmentEvents: [],
      },
    );

    await runAuditAnchorVerificationOnce(
      { repository, port },
      { mode: 'latest', now: NOW, workerId: 'daily-worker' },
    );
    const monthly = await verifyAuditAnchors(
      { repository, port },
      { limit: 10, maxAttempts: 3, mode: 'complete-segment', now: NOW, workerId: 'monthly-worker' },
    );

    expect(repository.verificationModes).toEqual(['latest', 'complete-segment']);
    expect(monthly).toEqual({ claimed: 1, failed: 1, retried: 1, verified: 0 });
    expect(repository.failures.at(-1)?.code).toBe('AUDIT_TRUNCATED');
  });
});

describe('audit anchor custody composition', () => {
  it('requires separate API, storage, and signing roles', () => {
    expect(() =>
      assertSeparatedAuditAnchorCustody({
        apiRole: 'ordinary-api-role',
        signingRole: 'ordinary-api-role',
        storageRole: 'audit-storage-role',
      }),
    ).toThrow(/separate/iu);
    expect(
      assertSeparatedAuditAnchorCustody({
        apiRole: 'ordinary-api-role',
        signingRole: 'audit-signing-role',
        storageRole: 'audit-storage-role',
      }),
    ).toEqual({
      apiRole: 'ordinary-api-role',
      signingRole: 'audit-signing-role',
      storageRole: 'audit-storage-role',
    });
  });
});
