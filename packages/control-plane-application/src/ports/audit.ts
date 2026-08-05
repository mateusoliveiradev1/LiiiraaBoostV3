import type {
  AuditAppendRepository,
  AuditChainEvent,
  AuditChainHead,
} from '@liiiraa/control-plane-domain';

export interface AuditRepositoryPort extends AuditAppendRepository {
  readEvents(
    input: Readonly<{
      streamId: string;
      fromSequence: number;
      throughSequence: number;
    }>,
  ): Promise<readonly AuditChainEvent[]>;
  readHead(streamId: string): Promise<AuditChainHead | undefined>;
}

export interface AuditAnchorCheckpoint {
  readonly schemaVersion: '1.0';
  readonly kind: 'audit-anchor-checkpoint';
  readonly streamId: string;
  readonly segmentId: string;
  readonly sequenceNumber: number;
  readonly eventHash: string;
  readonly segmentStartedAt: string;
  readonly anchoredAt: string;
  readonly eventCount: number;
}

export interface AuditLegalHold {
  readonly authorizedBy: string;
  readonly purpose: string;
  readonly expiresAt: string;
}

export interface AuditAnchor {
  readonly schemaVersion: '1.0';
  readonly kind: 'audit-anchor';
  readonly streamId: string;
  readonly segmentId: string;
  readonly sequenceNumber: number;
  readonly eventHash: string;
  readonly segmentStartedAt: string;
  readonly anchoredAt: string;
  readonly eventCount: number;
  readonly checksum: string;
  readonly signature: string;
  readonly signatureAlgorithm: 'ECDSA_SHA_256';
  readonly signingKeyId: string;
  readonly objectKey: string;
  readonly retainUntil: string;
  readonly legalHold?: AuditLegalHold;
}

export interface AuditAnchorSignerPort {
  readonly algorithm: 'ECDSA_SHA_256';
  readonly keyId: string;
  sign(digest: Uint8Array): Promise<string>;
  verify(digest: Uint8Array, signature: string): Promise<boolean>;
}

export type AuditAnchorFailureCode =
  | 'ANCHOR_CHECKSUM_MISMATCH'
  | 'ANCHOR_INVALID'
  | 'ANCHOR_LEGAL_HOLD_INVALID'
  | 'ANCHOR_READ_FAILED'
  | 'ANCHOR_RETENTION_MISMATCH'
  | 'ANCHOR_SIGNATURE_MISMATCH'
  | 'ANCHOR_WRITE_FAILED';

export type AuditAnchorResult =
  | Readonly<{ ok: true; anchor: AuditAnchor; verified: true }>
  | Readonly<{
      code: AuditAnchorFailureCode;
      ok: false;
      retryable: boolean;
    }>;

export interface AuditAnchorPort {
  write(checkpoint: AuditAnchorCheckpoint, legalHold?: AuditLegalHold): Promise<AuditAnchorResult>;
  read(objectKey: string): Promise<AuditAnchorResult>;
}
