import { describe, expect, it } from 'vitest';

import {
  AUDIT_GENESIS_HASH,
  appendAuditEvent,
  encodeAuditEvent,
  verifyAuditChain,
  type AppendAuditEventInput,
  type AuditAppendRepository,
  type AuditAppendTransaction,
  type AuditChainEvent,
  type AuditChainHead,
} from './audit-chain.js';

const STREAM_ID = 'admin-security';

const auditInput = (
  index: number,
  overrides: Partial<AppendAuditEventInput> = {},
): AppendAuditEventInput => ({
  streamId: STREAM_ID,
  authenticationContext: 'mfa:recent:session-bound',
  event: {
    schemaVersion: '1.0',
    kind: 'audit-event',
    auditEventId: `audit-${index}`,
    actorReference: 'actor-redacted-001',
    assumedRole: 'security',
    action: 'revoke-session',
    redactedTarget: 'account:[redacted]',
    reason: 'verified-security-response',
    result: 'succeeded',
    correlationId: `correlation-${index}`,
    occurredAt: `2026-08-05T12:${String(index).padStart(2, '0')}:00.000Z`,
  },
  ...overrides,
});

class MemoryAuditRepository implements AuditAppendRepository {
  readonly events: AuditChainEvent[] = [];
  private head: AuditChainHead = Object.freeze({
    streamId: STREAM_ID,
    lastSequence: 0,
    lastHash: AUDIT_GENESIS_HASH,
  });
  private queue: Promise<void> = Promise.resolve();

  async withSerializedHead<TResult>(
    streamId: string,
    operation: (transaction: AuditAppendTransaction) => Promise<TResult>,
  ): Promise<TResult> {
    const previous = this.queue;
    let release = (): void => undefined;
    this.queue = new Promise<void>((resolve) => {
      release = resolve;
    });
    await previous;
    try {
      if (streamId !== this.head.streamId) throw new Error('unknown audit stream');
      const transaction: AuditAppendTransaction = {
        head: this.head,
        insert: (event) => {
          if (
            event.sequenceNumber !== this.head.lastSequence + 1 ||
            event.event.previousEventHash !== this.head.lastHash
          ) {
            return Promise.reject(new Error('non-contiguous audit append'));
          }
          this.events.push(event);
          this.head = Object.freeze({
            streamId,
            lastSequence: event.sequenceNumber,
            lastHash: event.event.eventHash,
          });
          return Promise.resolve();
        },
      };
      return await operation(transaction);
    } finally {
      release();
    }
  }

  currentHead(): AuditChainHead {
    return this.head;
  }
}

describe('tamper-evident audit chain', () => {
  it('serializes concurrent appends into one contiguous sequence and head', async () => {
    const repository = new MemoryAuditRepository();
    const appended = await Promise.all(
      Array.from({ length: 24 }, (_, index) => appendAuditEvent(repository, auditInput(index))),
    );

    expect(appended.map(({ sequenceNumber }) => sequenceNumber).sort((a, b) => a - b)).toEqual(
      Array.from({ length: 24 }, (_, index) => index + 1),
    );
    expect(repository.events.map(({ sequenceNumber }) => sequenceNumber)).toEqual(
      Array.from({ length: 24 }, (_, index) => index + 1),
    );
    expect(repository.currentHead()).toEqual({
      streamId: STREAM_ID,
      lastSequence: 24,
      lastHash: repository.events.at(-1)?.event.eventHash,
    });
    expect(verifyAuditChain(repository.events, { expectedHead: repository.currentHead() })).toEqual({
      codes: [],
      healthy: true,
      verifiedSequence: 24,
    });
  });

  it('records a correction as a new linked event without changing prior evidence', async () => {
    const repository = new MemoryAuditRepository();
    const original = await appendAuditEvent(repository, auditInput(1));
    const beforeCorrection = structuredClone(original);
    const correction = await appendAuditEvent(
      repository,
      auditInput(2, {
        correctionOf: original.event.auditEventId,
        event: {
          ...auditInput(2).event,
          action: 'correct-audit-reference',
          reason: 'operator-correction-with-review',
        },
      }),
    );

    expect(repository.events[0]).toEqual(beforeCorrection);
    expect(correction).toMatchObject({
      correctionOf: original.event.auditEventId,
      sequenceNumber: 2,
      event: { previousEventHash: original.event.eventHash },
    });
    expect(verifyAuditChain(repository.events).healthy).toBe(true);
  });

  it.each([
    {
      name: 'payload mutation',
      mutate: (events: readonly AuditChainEvent[]) => [
        events[0],
        { ...events[1], event: { ...events[1]?.event, reason: 'rewritten' } },
      ],
      code: 'AUDIT_EVENT_HASH_MISMATCH',
    },
    {
      name: 'sequence mutation',
      mutate: (events: readonly AuditChainEvent[]) => [
        events[0],
        { ...events[1], sequenceNumber: 7 },
      ],
      code: 'AUDIT_SEQUENCE_GAP',
    },
    {
      name: 'previous-hash mutation',
      mutate: (events: readonly AuditChainEvent[]) => [
        events[0],
        {
          ...events[1],
          event: { ...events[1]?.event, previousEventHash: 'f'.repeat(64) },
        },
      ],
      code: 'AUDIT_PREVIOUS_HASH_MISMATCH',
    },
  ] as const)('detects $name', async ({ mutate, code }) => {
    const repository = new MemoryAuditRepository();
    await appendAuditEvent(repository, auditInput(1));
    await appendAuditEvent(repository, auditInput(2));

    expect(verifyAuditChain(mutate(repository.events)).codes).toContain(code);
  });

  it('detects forks and truncation against a separately retained head', async () => {
    const repository = new MemoryAuditRepository();
    const first = await appendAuditEvent(repository, auditInput(1));
    const second = await appendAuditEvent(repository, auditInput(2));
    const alternateRepository = new MemoryAuditRepository();
    await appendAuditEvent(alternateRepository, auditInput(1));
    const alternateSecond = await appendAuditEvent(
      alternateRepository,
      auditInput(3, { event: { ...auditInput(3).event, action: 'alternate-fork' } }),
    );

    expect(verifyAuditChain([first, second, alternateSecond]).codes).toContain(
      'AUDIT_FORK_DETECTED',
    );
    expect(
      verifyAuditChain([first], {
        expectedHead: repository.currentHead(),
      }).codes,
    ).toContain('AUDIT_TRUNCATED');
  });

  it('uses unambiguous length-prefixed canonical Unicode and boundary-length encoding', async () => {
    const repository = new MemoryAuditRepository();
    const composed = await appendAuditEvent(
      repository,
      auditInput(1, {
        event: { ...auditInput(1).event, redactedTarget: 'conta:caf\u00e9', reason: '' },
      }),
    );
    const decomposed = {
      ...composed,
      event: { ...composed.event, redactedTarget: 'conta:cafe\u0301' },
    };
    const shiftedBoundary = {
      ...composed,
      event: {
        ...composed.event,
        redactedTarget: 'a'.repeat(65_535),
        reason: 'b',
      },
    };
    const ambiguousWithoutLengths = {
      ...shiftedBoundary,
      event: {
        ...shiftedBoundary.event,
        redactedTarget: `${'a'.repeat(65_535)}b`,
        reason: '',
      },
    };

    expect(encodeAuditEvent(composed)).toEqual(encodeAuditEvent(decomposed));
    expect(encodeAuditEvent(shiftedBoundary)).not.toEqual(encodeAuditEvent(ambiguousWithoutLengths));
  });

  it('copies only generated redacted audit fields and excludes payloads and provider errors', async () => {
    const repository = new MemoryAuditRepository();
    const unsafeRuntimeInput = {
      ...auditInput(1),
      event: {
        ...auditInput(1).event,
        rawPayload: 'card=4242424242424242',
        providerError: 'Stripe secret sk_live_forbidden',
      },
    } as AppendAuditEventInput;

    const appended = await appendAuditEvent(repository, unsafeRuntimeInput);
    const serialized = JSON.stringify(appended);
    expect(serialized).not.toContain('4242424242424242');
    expect(serialized).not.toContain('sk_live_forbidden');
    expect(serialized).not.toContain('providerError');
    expect(serialized).not.toContain('rawPayload');
  });
});
