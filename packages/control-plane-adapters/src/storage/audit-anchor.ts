import { GetObjectCommand, PutObjectCommand } from '@aws-sdk/client-s3';
import type {
  AuditAnchor,
  AuditAnchorCheckpoint,
  AuditAnchorFailureCode,
  AuditAnchorResult,
  AuditAnchorSignerPort,
  AuditLegalHold,
} from '@liiiraa/control-plane-application';

export const AUDIT_ANCHOR_MAX_EVENTS = 1_000;
export const AUDIT_ANCHOR_MAX_AGE_MS = 15 * 60 * 1_000;

const SHA256_HEX = /^[0-9a-f]{64}$/u;
const BOUNDED_IDENTIFIER = /^[A-Za-z0-9._:-]{1,128}$/u;
const TEXT_ENCODER = new TextEncoder();
const TEXT_DECODER = new TextDecoder('utf-8', { fatal: true });

export interface AuditAnchorS3Client {
  send(command: GetObjectCommand | PutObjectCommand): Promise<unknown>;
}

interface WriteAuditAnchorInput {
  readonly bucket: string;
  readonly checkpoint: AuditAnchorCheckpoint;
  readonly client: AuditAnchorS3Client;
  readonly legalHold?: AuditLegalHold;
  readonly signer: AuditAnchorSignerPort;
  readonly storageKmsKeyId: string;
}

interface ReadAuditAnchorInput {
  readonly bucket: string;
  readonly client: AuditAnchorS3Client;
  readonly key: string;
  readonly signer: AuditAnchorSignerPort;
  readonly versionId?: string;
}

const failure = (code: AuditAnchorFailureCode, retryable = true): AuditAnchorResult =>
  Object.freeze({ code, ok: false, retryable });

const bytesToHex = (bytes: Uint8Array): string =>
  [...bytes].map((byte) => byte.toString(16).padStart(2, '0')).join('');

const bytesToBase64 = (bytes: Uint8Array): string => globalThis.btoa(String.fromCharCode(...bytes));

const sha256Bytes = async (bytes: Uint8Array): Promise<Uint8Array> => {
  const digestInput = new Uint8Array(bytes.byteLength);
  digestInput.set(bytes);
  return new Uint8Array(await globalThis.crypto.subtle.digest('SHA-256', digestInput.buffer));
};

const addCalendarYears = (timestamp: string, years: number): string => {
  const value = new Date(timestamp);
  value.setUTCFullYear(value.getUTCFullYear() + years);
  return value.toISOString();
};

const canonicalAnchorEvidence = (
  anchor: Pick<
    AuditAnchor,
    | 'anchoredAt'
    | 'eventCount'
    | 'eventHash'
    | 'legalHold'
    | 'retainUntil'
    | 'segmentId'
    | 'segmentStartedAt'
    | 'sequenceNumber'
    | 'streamId'
  >,
): Uint8Array =>
  TEXT_ENCODER.encode(
    JSON.stringify({
      schemaVersion: '1.0',
      kind: 'audit-anchor-evidence',
      streamId: anchor.streamId.normalize('NFC'),
      segmentId: anchor.segmentId.normalize('NFC'),
      sequenceNumber: anchor.sequenceNumber,
      eventHash: anchor.eventHash,
      segmentStartedAt: anchor.segmentStartedAt,
      anchoredAt: anchor.anchoredAt,
      eventCount: anchor.eventCount,
      retainUntil: anchor.retainUntil,
      ...(anchor.legalHold === undefined
        ? {}
        : {
            legalHold: {
              authorizedBy: anchor.legalHold.authorizedBy.normalize('NFC'),
              purpose: anchor.legalHold.purpose.normalize('NFC'),
              expiresAt: anchor.legalHold.expiresAt,
            },
          }),
    }),
  );

const isCanonicalTimestamp = (value: string): boolean => {
  const parsed = new Date(value);
  return Number.isFinite(parsed.getTime()) && parsed.toISOString() === value;
};

const validCheckpoint = (checkpoint: AuditAnchorCheckpoint): boolean =>
  BOUNDED_IDENTIFIER.test(checkpoint.streamId) &&
  BOUNDED_IDENTIFIER.test(checkpoint.segmentId) &&
  Number.isSafeInteger(checkpoint.sequenceNumber) &&
  checkpoint.sequenceNumber >= 1 &&
  Number.isSafeInteger(checkpoint.eventCount) &&
  checkpoint.eventCount >= 1 &&
  checkpoint.eventCount <= checkpoint.sequenceNumber &&
  SHA256_HEX.test(checkpoint.eventHash) &&
  isCanonicalTimestamp(checkpoint.segmentStartedAt) &&
  isCanonicalTimestamp(checkpoint.anchoredAt) &&
  Date.parse(checkpoint.segmentStartedAt) <= Date.parse(checkpoint.anchoredAt);

const validLegalHold = (legalHold: AuditLegalHold | undefined, anchoredAt: string): boolean =>
  legalHold === undefined ||
  (BOUNDED_IDENTIFIER.test(legalHold.authorizedBy) &&
    legalHold.purpose.length >= 1 &&
    legalHold.purpose.length <= 1_024 &&
    isCanonicalTimestamp(legalHold.expiresAt) &&
    Date.parse(legalHold.expiresAt) > Date.parse(anchoredAt));

const isAuditAnchor = (value: unknown): value is AuditAnchor => {
  if (typeof value !== 'object' || value === null) return false;
  const record = value as Readonly<Record<string, unknown>>;
  return (
    record['schemaVersion'] === '1.0' &&
    record['kind'] === 'audit-anchor' &&
    typeof record['streamId'] === 'string' &&
    typeof record['segmentId'] === 'string' &&
    typeof record['sequenceNumber'] === 'number' &&
    typeof record['eventHash'] === 'string' &&
    typeof record['segmentStartedAt'] === 'string' &&
    typeof record['anchoredAt'] === 'string' &&
    typeof record['eventCount'] === 'number' &&
    typeof record['checksum'] === 'string' &&
    typeof record['signature'] === 'string' &&
    record['signatureAlgorithm'] === 'ECDSA_SHA_256' &&
    typeof record['signingKeyId'] === 'string' &&
    typeof record['objectKey'] === 'string' &&
    typeof record['retainUntil'] === 'string' &&
    (record['legalHold'] === undefined ||
      (typeof record['legalHold'] === 'object' && record['legalHold'] !== null))
  );
};

const readBody = async (body: unknown): Promise<Uint8Array> => {
  if (
    typeof body !== 'object' ||
    body === null ||
    !('transformToByteArray' in body) ||
    typeof body.transformToByteArray !== 'function'
  ) {
    throw new Error('anchor body unavailable');
  }
  const transformToByteArray = body.transformToByteArray as () => Promise<Uint8Array>;
  return Uint8Array.from(await transformToByteArray());
};

export const isAuditAnchorDue = (
  input: Readonly<{
    elapsedMilliseconds: number;
    eventsSinceAnchor: number;
  }>,
): boolean =>
  input.eventsSinceAnchor >= AUDIT_ANCHOR_MAX_EVENTS ||
  input.elapsedMilliseconds >= AUDIT_ANCHOR_MAX_AGE_MS;

export const readAuditAnchor = async ({
  bucket,
  client,
  key,
  signer,
  versionId,
}: ReadAuditAnchorInput): Promise<AuditAnchorResult> => {
  let response: Readonly<Record<string, unknown>>;
  let body: Uint8Array;
  try {
    response = (await client.send(
      new GetObjectCommand({
        Bucket: bucket,
        Key: key,
        ChecksumMode: 'ENABLED',
        ...(versionId === undefined ? {} : { VersionId: versionId }),
      }),
    )) as Readonly<Record<string, unknown>>;
    body = await readBody(response['Body']);
  } catch {
    return failure('ANCHOR_READ_FAILED');
  }

  const bodyChecksum = bytesToBase64(await sha256Bytes(body));
  if (response['ChecksumSHA256'] !== bodyChecksum) return failure('ANCHOR_CHECKSUM_MISMATCH');
  const objectVersion = response['VersionId'];
  if (
    typeof objectVersion !== 'string' ||
    objectVersion.length === 0 ||
    (versionId !== undefined && objectVersion !== versionId)
  ) {
    return failure('ANCHOR_INVALID', false);
  }

  let anchor: AuditAnchor;
  try {
    const parsed: unknown = JSON.parse(TEXT_DECODER.decode(body));
    if (!isAuditAnchor(parsed)) return failure('ANCHOR_INVALID', false);
    anchor = parsed;
  } catch {
    return failure('ANCHOR_INVALID', false);
  }

  if (anchor.objectKey !== key || !validLegalHold(anchor.legalHold, anchor.anchoredAt)) {
    return failure('ANCHOR_INVALID', false);
  }
  const objectRetainUntil = response['ObjectLockRetainUntilDate'];
  const retainedUntil =
    objectRetainUntil instanceof Date
      ? objectRetainUntil.getTime()
      : Date.parse(String(objectRetainUntil));
  if (
    response['ObjectLockMode'] !== 'COMPLIANCE' ||
    !Number.isFinite(retainedUntil) ||
    retainedUntil < Date.parse(anchor.retainUntil)
  ) {
    return failure('ANCHOR_RETENTION_MISMATCH');
  }

  const digest = await sha256Bytes(canonicalAnchorEvidence(anchor));
  if (bytesToHex(digest) !== anchor.checksum) return failure('ANCHOR_CHECKSUM_MISMATCH');
  if (anchor.signingKeyId !== signer.keyId || !(await signer.verify(digest, anchor.signature))) {
    return failure('ANCHOR_SIGNATURE_MISMATCH');
  }

  return Object.freeze({
    anchor: Object.freeze(anchor),
    objectVersion,
    ok: true,
    verified: true,
  });
};

export const writeAuditAnchor = async ({
  bucket,
  checkpoint,
  client,
  legalHold,
  signer,
  storageKmsKeyId,
}: WriteAuditAnchorInput): Promise<AuditAnchorResult> => {
  if (
    bucket.length === 0 ||
    storageKmsKeyId.length === 0 ||
    !validCheckpoint(checkpoint) ||
    !BOUNDED_IDENTIFIER.test(signer.keyId)
  ) {
    return failure('ANCHOR_INVALID', false);
  }
  if (!validLegalHold(legalHold, checkpoint.anchoredAt)) {
    return failure('ANCHOR_LEGAL_HOLD_INVALID', false);
  }

  const retainUntil = addCalendarYears(checkpoint.anchoredAt, 5);
  const unsigned = {
    streamId: checkpoint.streamId,
    segmentId: checkpoint.segmentId,
    sequenceNumber: checkpoint.sequenceNumber,
    eventHash: checkpoint.eventHash,
    segmentStartedAt: checkpoint.segmentStartedAt,
    anchoredAt: checkpoint.anchoredAt,
    eventCount: checkpoint.eventCount,
    retainUntil,
    ...(legalHold === undefined ? {} : { legalHold }),
  };
  const digest = await sha256Bytes(canonicalAnchorEvidence(unsigned));
  let signature: string;
  try {
    signature = await signer.sign(digest);
  } catch {
    return failure('ANCHOR_WRITE_FAILED');
  }
  if (signature.length === 0) return failure('ANCHOR_WRITE_FAILED');

  const objectKey = `audit-anchors/${encodeURIComponent(checkpoint.streamId)}/${String(
    checkpoint.sequenceNumber,
  ).padStart(20, '0')}-${checkpoint.eventHash}.json`;
  const anchor: AuditAnchor = Object.freeze({
    schemaVersion: '1.0',
    kind: 'audit-anchor',
    ...unsigned,
    checksum: bytesToHex(digest),
    signature,
    signatureAlgorithm: signer.algorithm,
    signingKeyId: signer.keyId,
    objectKey,
  });
  const body = TEXT_ENCODER.encode(JSON.stringify(anchor));
  const bodyChecksum = bytesToBase64(await sha256Bytes(body));

  try {
    const response = (await client.send(
      new PutObjectCommand({
        Bucket: bucket,
        Key: objectKey,
        Body: body,
        ChecksumAlgorithm: 'SHA256',
        ChecksumSHA256: bodyChecksum,
        ContentType: 'application/json',
        IfNoneMatch: '*',
        ObjectLockMode: 'COMPLIANCE',
        ObjectLockRetainUntilDate: new Date(retainUntil),
        ServerSideEncryption: 'aws:kms',
        SSEKMSKeyId: storageKmsKeyId,
        Metadata: {
          'audit-anchor-checksum': anchor.checksum,
          'audit-signing-key-id': anchor.signingKeyId,
        },
        ...(legalHold === undefined ? {} : { ObjectLockLegalHoldStatus: 'ON' }),
      }),
    )) as Readonly<Record<string, unknown>>;
    if (response['ChecksumSHA256'] !== bodyChecksum) return failure('ANCHOR_CHECKSUM_MISMATCH');
    const objectVersion = response['VersionId'];
    if (typeof objectVersion !== 'string' || objectVersion.length === 0) {
      return failure('ANCHOR_INVALID', false);
    }
    return await readAuditAnchor({
      bucket,
      client,
      key: objectKey,
      signer,
      versionId: objectVersion,
    });
  } catch {
    return failure('ANCHOR_WRITE_FAILED');
  }
};
