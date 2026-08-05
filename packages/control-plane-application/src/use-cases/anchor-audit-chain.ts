import {
  verifyAuditChain,
  type AuditChainEvent,
  type AuditChainHead,
} from '@liiiraa/control-plane-domain';

import type {
  AuditAnchor,
  AuditAnchorCheckpoint,
  AuditAnchorPort,
  AuditAnchorResult,
} from '../ports/audit.js';

export const AUDIT_ANCHOR_MAX_AGE_MS = 15 * 60 * 1_000;
export const AUDIT_ANCHOR_MAX_EVENTS = 1_000;

export interface AuditAnchorJob {
  readonly claimId: string;
  readonly attemptCount: number;
  readonly streamId: string;
  readonly segmentId: string;
  readonly segmentStartedAt: string;
  readonly lastAnchoredAt: string;
  readonly lastAnchoredSequence: number;
  readonly eventsSinceAnchor: number;
  readonly head: AuditChainHead;
}

export interface AuditAnchorReceipt extends AuditAnchor {
  readonly objectVersion: string;
  readonly purpose: 'audit-chain-integrity';
  readonly verifiedAt: string;
}

export type AuditAnchorVerificationMode = 'complete-segment' | 'latest';

export interface AuditAnchorVerificationJob {
  readonly claimId: string;
  readonly mode: AuditAnchorVerificationMode;
  readonly attemptCount: number;
  readonly receipt: AuditAnchorReceipt;
  readonly databaseHead: AuditChainHead;
  readonly segmentEvents?: readonly AuditChainEvent[];
}

export interface AuditAnchorScheduleRepository {
  claimDue(
    input: Readonly<{
      limit: number;
      maxAgeMs: number;
      maxEvents: number;
      now: string;
      workerId: string;
    }>,
  ): Promise<readonly AuditAnchorJob[]>;
  persistReceipt(claimId: string, receipt: AuditAnchorReceipt): Promise<void>;
  recordAnchorFailure(
    claimId: string,
    failure: Readonly<{ code: string; terminal: boolean }>,
  ): Promise<void>;
  claimVerification(
    input: Readonly<{
      limit: number;
      mode: AuditAnchorVerificationMode;
      now: string;
      workerId: string;
    }>,
  ): Promise<readonly AuditAnchorVerificationJob[]>;
  recordVerification(
    claimId: string,
    result: Readonly<{ code?: string; healthy: boolean }>,
  ): Promise<void>;
}

export interface AuditAnchorDependencies {
  readonly port: AuditAnchorPort;
  readonly repository: AuditAnchorScheduleRepository;
}

export interface AnchorDueAuditHeadsInput {
  readonly limit: number;
  readonly maxAttempts: number;
  readonly now: string;
  readonly workerId: string;
}

export interface VerifyAuditAnchorsInput extends AnchorDueAuditHeadsInput {
  readonly mode: AuditAnchorVerificationMode;
}

export interface AuditAnchorRunResult {
  readonly anchored: number;
  readonly claimed: number;
  readonly failed: number;
  readonly retried: number;
}

export interface AuditAnchorVerificationRunResult {
  readonly claimed: number;
  readonly failed: number;
  readonly retried: number;
  readonly verified: number;
}

const boundedInteger = (value: number, fallback: number, maximum: number): number =>
  Number.isSafeInteger(value) && value >= 1 ? Math.min(value, maximum) : fallback;

const addCalendarYears = (timestamp: string, years: number): string => {
  const value = new Date(timestamp);
  value.setUTCFullYear(value.getUTCFullYear() + years);
  return value.toISOString();
};

const expectedObjectKey = (job: AuditAnchorJob): string =>
  `audit-anchors/${encodeURIComponent(job.streamId)}/${String(job.head.lastSequence).padStart(20, '0')}-${job.head.lastHash}.json`;

const checkpointFor = (job: AuditAnchorJob, anchoredAt: string): AuditAnchorCheckpoint =>
  Object.freeze({
    schemaVersion: '1.0',
    kind: 'audit-anchor-checkpoint',
    streamId: job.streamId,
    segmentId: job.segmentId,
    sequenceNumber: job.head.lastSequence,
    eventHash: job.head.lastHash,
    segmentStartedAt: job.segmentStartedAt,
    anchoredAt,
    eventCount: job.eventsSinceAnchor,
  });

const resultIsVerified = (result: AuditAnchorResult): boolean => {
  const candidate = result as unknown as Readonly<Record<string, unknown>>;
  return (
    candidate['ok'] === true &&
    candidate['verified'] === true &&
    typeof candidate['objectVersion'] === 'string' &&
    candidate['objectVersion'].length >= 1
  );
};

const anchorMatchesJob = (anchor: AuditAnchor, job: AuditAnchorJob): boolean =>
  anchor.streamId === job.streamId &&
  anchor.segmentId === job.segmentId &&
  anchor.sequenceNumber === job.head.lastSequence &&
  anchor.eventHash === job.head.lastHash &&
  anchor.segmentStartedAt === job.segmentStartedAt &&
  anchor.eventCount === job.eventsSinceAnchor &&
  anchor.objectKey === expectedObjectKey(job) &&
  anchor.retainUntil === addCalendarYears(anchor.anchoredAt, 5);

const receiptFor = (
  result: Extract<AuditAnchorResult, { readonly ok: true }>,
  verifiedAt: string,
): AuditAnchorReceipt =>
  Object.freeze({
    ...result.anchor,
    objectVersion: result.objectVersion,
    purpose: 'audit-chain-integrity',
    verifiedAt,
  });

const terminal = (attemptCount: number, maxAttempts: number): boolean =>
  attemptCount + 1 >= maxAttempts;

const recoverIdempotentWrite = async (
  port: AuditAnchorPort,
  job: AuditAnchorJob,
  writeResult: AuditAnchorResult,
): Promise<AuditAnchorResult> => {
  if (writeResult.ok || writeResult.code !== 'ANCHOR_WRITE_FAILED') return writeResult;
  const existing = await port.read(expectedObjectKey(job));
  return existing.ok ? existing : writeResult;
};

export const anchorDueAuditHeads = async (
  dependencies: AuditAnchorDependencies,
  input: AnchorDueAuditHeadsInput,
): Promise<AuditAnchorRunResult> => {
  const limit = boundedInteger(input.limit, 10, 50);
  const maxAttempts = boundedInteger(input.maxAttempts, 5, 10);
  const jobs = await dependencies.repository.claimDue({
    limit,
    maxAgeMs: AUDIT_ANCHOR_MAX_AGE_MS,
    maxEvents: AUDIT_ANCHOR_MAX_EVENTS,
    now: input.now,
    workerId: input.workerId,
  });
  let anchored = 0;
  let failed = 0;
  let retried = 0;

  for (const job of jobs) {
    let result: AuditAnchorResult;
    try {
      const writeResult = await dependencies.port.write(checkpointFor(job, input.now));
      result = await recoverIdempotentWrite(dependencies.port, job, writeResult);
    } catch {
      result = { ok: false, code: 'ANCHOR_WRITE_FAILED', retryable: true };
    }

    if (resultIsVerified(result)) {
      const verifiedResult = result as Extract<AuditAnchorResult, { readonly ok: true }>;
      if (!anchorMatchesJob(verifiedResult.anchor, job)) {
        await dependencies.repository.recordAnchorFailure(job.claimId, {
          code: 'ANCHOR_INVALID',
          terminal: true,
        });
        failed += 1;
        continue;
      }
      await dependencies.repository.persistReceipt(
        job.claimId,
        receiptFor(verifiedResult, input.now),
      );
      anchored += 1;
      continue;
    }

    const code = result.ok ? 'ANCHOR_INVALID' : result.code;
    const isTerminal = result.ok || !result.retryable || terminal(job.attemptCount, maxAttempts);
    await dependencies.repository.recordAnchorFailure(job.claimId, { code, terminal: isTerminal });
    if (isTerminal) failed += 1;
    else retried += 1;
  }

  return Object.freeze({ anchored, claimed: jobs.length, failed, retried });
};

const receiptMatchesRead = (
  receipt: AuditAnchorReceipt,
  result: Extract<AuditAnchorResult, { readonly ok: true }>,
): boolean =>
  result.objectVersion === receipt.objectVersion &&
  result.anchor.streamId === receipt.streamId &&
  result.anchor.segmentId === receipt.segmentId &&
  result.anchor.sequenceNumber === receipt.sequenceNumber &&
  result.anchor.eventHash === receipt.eventHash &&
  result.anchor.checksum === receipt.checksum &&
  result.anchor.signature === receipt.signature &&
  result.anchor.signingKeyId === receipt.signingKeyId &&
  result.anchor.objectKey === receipt.objectKey &&
  result.anchor.retainUntil === receipt.retainUntil &&
  receipt.retainUntil === addCalendarYears(receipt.anchoredAt, 5);

const verifyDatabaseContinuity = async (
  job: AuditAnchorVerificationJob,
): Promise<Readonly<{ code?: string; healthy: boolean }>> => {
  if (job.databaseHead.streamId !== job.receipt.streamId) {
    return { code: 'AUDIT_STREAM_MISMATCH', healthy: false };
  }
  if (job.databaseHead.lastSequence < job.receipt.sequenceNumber) {
    return { code: 'AUDIT_TRUNCATED', healthy: false };
  }
  if (
    job.databaseHead.lastSequence === job.receipt.sequenceNumber &&
    job.databaseHead.lastHash !== job.receipt.eventHash
  ) {
    return { code: 'AUDIT_ANCHOR_MISMATCH', healthy: false };
  }
  if (job.mode === 'latest') return { healthy: true };

  const verification = await verifyAuditChain(job.segmentEvents ?? [], {
    expectedHead: {
      streamId: job.receipt.streamId,
      lastSequence: job.receipt.sequenceNumber,
      lastHash: job.receipt.eventHash,
    },
  });
  return verification.healthy
    ? { healthy: true }
    : { code: verification.codes[0] ?? 'AUDIT_ANCHOR_MISMATCH', healthy: false };
};

export const verifyAuditAnchors = async (
  dependencies: AuditAnchorDependencies,
  input: VerifyAuditAnchorsInput,
): Promise<AuditAnchorVerificationRunResult> => {
  const limit = boundedInteger(input.limit, 10, 50);
  const maxAttempts = boundedInteger(input.maxAttempts, 5, 10);
  const jobs = await dependencies.repository.claimVerification({
    limit,
    mode: input.mode,
    now: input.now,
    workerId: input.workerId,
  });
  let verified = 0;
  let failed = 0;
  let retried = 0;

  for (const job of jobs) {
    let outcome: Readonly<{ code?: string; healthy: boolean }>;
    try {
      const result = await dependencies.port.read(job.receipt.objectKey, job.receipt.objectVersion);
      if (!resultIsVerified(result)) {
        outcome = { code: result.ok ? 'ANCHOR_INVALID' : result.code, healthy: false };
      } else if (
        !receiptMatchesRead(
          job.receipt,
          result as Extract<AuditAnchorResult, { readonly ok: true }>,
        )
      ) {
        outcome = { code: 'AUDIT_ANCHOR_MISMATCH', healthy: false };
      } else {
        outcome = await verifyDatabaseContinuity(job);
      }
    } catch {
      outcome = { code: 'ANCHOR_READ_FAILED', healthy: false };
    }

    await dependencies.repository.recordVerification(job.claimId, outcome);
    if (outcome.healthy) {
      verified += 1;
    } else if (terminal(job.attemptCount, maxAttempts)) {
      failed += 1;
    } else {
      retried += 1;
    }
  }

  return Object.freeze({ claimed: jobs.length, failed, retried, verified });
};
