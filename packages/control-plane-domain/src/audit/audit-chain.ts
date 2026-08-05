import type { AuditEventJson } from '@liiiraa/contracts-ts';

export const AUDIT_GENESIS_HASH = '0'.repeat(64);

const SHA256_HEX = /^[0-9a-f]{64}$/u;
const BOUNDED_IDENTIFIER = /^[A-Za-z0-9._:-]{1,128}$/u;
const MAX_REDACTED_TEXT_LENGTH = 1_024;
const TEXT_ENCODER = new TextEncoder();

export type AuditVerificationCode =
  | 'AUDIT_ANCHOR_MISMATCH'
  | 'AUDIT_EVENT_HASH_MISMATCH'
  | 'AUDIT_FORK_DETECTED'
  | 'AUDIT_PREVIOUS_HASH_MISMATCH'
  | 'AUDIT_SEQUENCE_GAP'
  | 'AUDIT_STREAM_MISMATCH'
  | 'AUDIT_TRUNCATED';

export interface AuditChainHead {
  readonly streamId: string;
  readonly lastSequence: number;
  readonly lastHash: string;
}

export interface AuditChainEvent {
  readonly streamId: string;
  readonly sequenceNumber: number;
  readonly authenticationContext: string;
  readonly correctionOf?: string;
  readonly event: AuditEventJson;
}

export type AuditEventInput = Omit<
  AuditEventJson,
  'aggregateVersion' | 'eventHash' | 'previousEventHash'
>;

export interface AppendAuditEventInput {
  readonly streamId: string;
  readonly authenticationContext: string;
  readonly correctionOf?: string;
  readonly event: AuditEventInput;
}

export interface AuditAppendTransaction {
  readonly head: AuditChainHead;
  insert(event: AuditChainEvent): Promise<void>;
}

export interface AuditAppendRepository {
  withSerializedHead<TResult>(
    streamId: string,
    operation: (transaction: AuditAppendTransaction) => Promise<TResult>,
  ): Promise<TResult>;
}

export interface AuditVerificationResult {
  readonly codes: readonly AuditVerificationCode[];
  readonly healthy: boolean;
  readonly verifiedSequence: number;
}

const normalize = (value: string): string => value.normalize('NFC');

const assertBoundedIdentifier = (name: string, value: string): string => {
  const normalized = normalize(value);
  if (!BOUNDED_IDENTIFIER.test(normalized)) {
    throw new Error(`${name} must be a bounded redacted identifier`);
  }
  return normalized;
};

const assertRedactedText = (name: string, value: string): string => {
  const normalized = normalize(value);
  if (
    normalized.length > MAX_REDACTED_TEXT_LENGTH ||
    /[\u0000-\u0008\u000b\u000c\u000e-\u001f]/u.test(normalized)
  ) {
    throw new Error(`${name} must be bounded redacted text`);
  }
  return normalized;
};

const assertTimestamp = (value: string): string => {
  const timestamp = new Date(value);
  if (!Number.isFinite(timestamp.getTime()) || timestamp.toISOString() !== value) {
    throw new Error('occurredAt must be a canonical ISO-8601 timestamp');
  }
  return value;
};

const bytesToHex = (bytes: ArrayBuffer): string =>
  [...new Uint8Array(bytes)].map((byte) => byte.toString(16).padStart(2, '0')).join('');

const sha256 = async (bytes: Uint8Array): Promise<string> => {
  const digestInput = new Uint8Array(bytes.byteLength);
  digestInput.set(bytes);
  return bytesToHex(await globalThis.crypto.subtle.digest('SHA-256', digestInput.buffer));
};

const writeUint32 = (value: number): Uint8Array => {
  const bytes = new Uint8Array(4);
  new DataView(bytes.buffer).setUint32(0, value, false);
  return bytes;
};

const lengthPrefix = (value: string): Uint8Array => {
  const encoded = TEXT_ENCODER.encode(normalize(value));
  if (encoded.byteLength > 0xffff_ffff) throw new Error('audit canonical field is too large');
  const output = new Uint8Array(4 + encoded.byteLength);
  output.set(writeUint32(encoded.byteLength), 0);
  output.set(encoded, 4);
  return output;
};

const canonicalFields = (record: AuditChainEvent): readonly (readonly [string, string])[] => [
  ['schemaVersion', record.event.schemaVersion],
  ['kind', record.event.kind],
  ['streamId', record.streamId],
  ['sequenceNumber', String(record.sequenceNumber)],
  ['auditEventId', record.event.auditEventId],
  ['actorReference', record.event.actorReference],
  ['assumedRole', record.event.assumedRole ?? ''],
  ['authenticationContext', record.authenticationContext],
  ['action', record.event.action],
  ['redactedTarget', record.event.redactedTarget],
  ['reason', record.event.reason],
  ['result', record.event.result],
  ['aggregateVersion', record.event.aggregateVersion],
  ['correlationId', record.event.correlationId],
  ['previousEventHash', record.event.previousEventHash ?? ''],
  ['correctionOf', record.correctionOf ?? ''],
  ['occurredAt', record.event.occurredAt],
];

export const encodeAuditEvent = (record: AuditChainEvent): Uint8Array => {
  const encodedFields = canonicalFields(record).flatMap(([name, value]) => [
    lengthPrefix(name),
    lengthPrefix(value),
  ]);
  const byteLength = encodedFields.reduce((total, bytes) => total + bytes.byteLength, 0);
  const output = new Uint8Array(byteLength);
  let offset = 0;
  for (const bytes of encodedFields) {
    output.set(bytes, offset);
    offset += bytes.byteLength;
  }
  return output;
};

const sanitizeInput = (
  input: AppendAuditEventInput,
  head: AuditChainHead,
): Omit<AuditChainEvent, 'event'> & { readonly event: Omit<AuditEventJson, 'eventHash'> } => {
  if (head.streamId !== input.streamId) throw new Error('audit stream/head mismatch');
  if (!SHA256_HEX.test(head.lastHash)) throw new Error('audit head hash is invalid');
  if (!Number.isSafeInteger(head.lastSequence) || head.lastSequence < 0) {
    throw new Error('audit head sequence is invalid');
  }
  const sequenceNumber = head.lastSequence + 1;
  const correctionOf =
    input.correctionOf === undefined
      ? undefined
      : assertBoundedIdentifier('correctionOf', input.correctionOf);
  const event = input.event;
  return {
    streamId: assertBoundedIdentifier('streamId', input.streamId),
    sequenceNumber,
    authenticationContext: assertBoundedIdentifier(
      'authenticationContext',
      input.authenticationContext,
    ),
    ...(correctionOf === undefined ? {} : { correctionOf }),
    event: {
      schemaVersion: '1.0',
      kind: 'audit-event',
      auditEventId: assertBoundedIdentifier('auditEventId', event.auditEventId),
      actorReference: assertBoundedIdentifier('actorReference', event.actorReference),
      ...(event.assumedRole === undefined ? {} : { assumedRole: event.assumedRole }),
      action: assertBoundedIdentifier('action', event.action),
      redactedTarget: assertRedactedText('redactedTarget', event.redactedTarget),
      reason: assertRedactedText('reason', event.reason),
      result: event.result,
      aggregateVersion: String(sequenceNumber),
      correlationId: assertBoundedIdentifier('correlationId', event.correlationId),
      previousEventHash: head.lastHash,
      occurredAt: assertTimestamp(event.occurredAt),
    },
  };
};

export const appendAuditEvent = async (
  repository: AuditAppendRepository,
  input: AppendAuditEventInput,
): Promise<AuditChainEvent> =>
  repository.withSerializedHead(input.streamId, async (transaction) => {
    const material = sanitizeInput(input, transaction.head);
    const eventHash = await sha256(
      encodeAuditEvent({ ...material, event: { ...material.event, eventHash: '' } }),
    );
    const appended = Object.freeze({
      ...material,
      event: Object.freeze({ ...material.event, eventHash }),
    }) satisfies AuditChainEvent;
    await transaction.insert(appended);
    return appended;
  });

export const verifyAuditChain = async (
  events: readonly AuditChainEvent[],
  options: Readonly<{ expectedHead?: AuditChainHead }> = {},
): Promise<AuditVerificationResult> => {
  const codes = new Set<AuditVerificationCode>();
  const sequenceHashes = new Map<number, string>();
  const streamId = events[0]?.streamId ?? options.expectedHead?.streamId;
  let expectedSequence = 1;
  let expectedPreviousHash = AUDIT_GENESIS_HASH;

  for (const record of events) {
    if (streamId !== undefined && record.streamId !== streamId) codes.add('AUDIT_STREAM_MISMATCH');
    const priorHash = sequenceHashes.get(record.sequenceNumber);
    if (priorHash !== undefined && priorHash !== record.event.eventHash) {
      codes.add('AUDIT_FORK_DETECTED');
    }
    sequenceHashes.set(record.sequenceNumber, record.event.eventHash);
    if (record.sequenceNumber !== expectedSequence) codes.add('AUDIT_SEQUENCE_GAP');
    if (record.event.previousEventHash !== expectedPreviousHash) {
      codes.add('AUDIT_PREVIOUS_HASH_MISMATCH');
    }
    if (!SHA256_HEX.test(record.event.eventHash)) {
      codes.add('AUDIT_EVENT_HASH_MISMATCH');
    } else {
      const calculatedHash = await sha256(encodeAuditEvent(record));
      if (calculatedHash !== record.event.eventHash) codes.add('AUDIT_EVENT_HASH_MISMATCH');
    }
    expectedSequence = record.sequenceNumber + 1;
    expectedPreviousHash = record.event.eventHash;
  }

  const expectedHead = options.expectedHead;
  const verifiedSequence = events.at(-1)?.sequenceNumber ?? 0;
  if (expectedHead !== undefined) {
    if (expectedHead.streamId !== streamId && streamId !== undefined) {
      codes.add('AUDIT_STREAM_MISMATCH');
    }
    if (verifiedSequence < expectedHead.lastSequence) codes.add('AUDIT_TRUNCATED');
    if (
      verifiedSequence > expectedHead.lastSequence ||
      (verifiedSequence === expectedHead.lastSequence &&
        expectedPreviousHash !== expectedHead.lastHash)
    ) {
      codes.add('AUDIT_ANCHOR_MISMATCH');
    }
  }

  return Object.freeze({
    codes: Object.freeze([...codes]),
    healthy: codes.size === 0,
    verifiedSequence,
  });
};
