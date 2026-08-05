import { readFile } from 'node:fs/promises';

import { describe, expect, it } from 'vitest';

const migrationUrl = new URL(
  '../../../../../packages/control-plane-adapters/src/postgres/migrations/0001_control_plane.sql',
  import.meta.url,
);

const loadAnchorAdapter = async () => import('@liiiraa/control-plane-adapters');

interface StoredObject {
  readonly body: Uint8Array;
  readonly checksum: string;
  readonly retainUntil: Date;
  readonly versionId: string;
}

class MemoryObjectLockClient {
  readonly objects = new Map<string, StoredObject>();
  failRead = false;
  failWrite = false;
  corruptRead = false;
  shortenRetention = false;

  send(command: unknown): Promise<unknown> {
    const request = (command as { readonly input: Readonly<Record<string, unknown>> }).input;
    const key = String(request['Key']);
    if (
      (command as { readonly constructor: { readonly name: string } }).constructor.name ===
      'PutObjectCommand'
    ) {
      if (this.failWrite) return Promise.reject(new Error('provider-write-secret'));
      expect(request).toMatchObject({
        ChecksumAlgorithm: 'SHA256',
        ContentType: 'application/json',
        IfNoneMatch: '*',
        ObjectLockMode: 'COMPLIANCE',
      });
      const body = Uint8Array.from(request['Body'] as Uint8Array);
      const checksum = String(request['ChecksumSHA256']);
      const retainUntil = request['ObjectLockRetainUntilDate'] as Date;
      if (this.objects.has(key)) throw new Error('immutable-object-exists');
      const versionId = `version-${String(this.objects.size + 1)}`;
      this.objects.set(key, { body, checksum, retainUntil, versionId });
      return Promise.resolve({ ChecksumSHA256: checksum, VersionId: versionId });
    }
    if (
      (command as { readonly constructor: { readonly name: string } }).constructor.name ===
      'GetObjectCommand'
    ) {
      if (this.failRead) return Promise.reject(new Error('provider-read-secret'));
      const stored = this.objects.get(key);
      if (stored === undefined) return Promise.reject(new Error('object-not-found'));
      const body = Uint8Array.from(stored.body);
      if (this.corruptRead && body.length > 0) {
        const lastIndex = body.length - 1;
        body[lastIndex] = (body[lastIndex] ?? 0) ^ 1;
      }
      return Promise.resolve({
        Body: { transformToByteArray: () => Promise.resolve(body) },
        ChecksumSHA256: stored.checksum,
        ObjectLockMode: 'COMPLIANCE',
        ObjectLockRetainUntilDate: this.shortenRetention
          ? new Date('2027-01-01T00:00:00.000Z')
          : stored.retainUntil,
        VersionId: stored.versionId,
      });
    }
    return Promise.reject(new Error('unsupported command'));
  }
}

const signer = Object.freeze({
  algorithm: 'ECDSA_SHA_256' as const,
  keyId: 'kms-audit-asymmetric-key',
  sign: (digest: Uint8Array) => Promise.resolve(Buffer.from(digest).toString('base64')),
  verify: (digest: Uint8Array, signature: string) =>
    Promise.resolve(Buffer.from(digest).toString('base64') === signature),
});

const checkpoint = Object.freeze({
  schemaVersion: '1.0' as const,
  kind: 'audit-anchor-checkpoint' as const,
  streamId: 'admin-security',
  segmentId: '2026-08-05T12',
  sequenceNumber: 1_000,
  eventHash: 'a'.repeat(64),
  segmentStartedAt: '2026-08-05T12:00:00.000Z',
  anchoredAt: '2026-08-05T12:15:00.000Z',
  eventCount: 1_000,
});

describe('audit database privileges', () => {
  it('denies application mutation and truncation while requiring correction inserts', async () => {
    const migrationSql = await readFile(migrationUrl, 'utf8');

    expect(migrationSql).toMatch(
      /CREATE TRIGGER audit_events_insert_only[\s\S]*BEFORE UPDATE OR DELETE ON audit_events/iu,
    );
    expect(migrationSql).toMatch(
      /CREATE TRIGGER audit_events_reject_truncate[\s\S]*BEFORE TRUNCATE ON audit_events/iu,
    );
    expect(migrationSql).toMatch(/REVOKE UPDATE, DELETE, TRUNCATE ON audit_events FROM PUBLIC/iu);
    expect(migrationSql).toMatch(
      /correction_of UUID REFERENCES audit_events\(id\) ON DELETE RESTRICT/iu,
    );
    expect(migrationSql).toMatch(/SELECT \* INTO head[\s\S]*FOR UPDATE/iu);
    expect(migrationSql).toMatch(/NEW\.sequence_number <> head\.last_sequence \+ 1/iu);
    expect(migrationSql).toMatch(/NEW\.previous_hash <> head\.last_hash/iu);
  });
});

describe('immutable external audit anchors', () => {
  it('writes, reads, checksums, verifies signature, and enforces five-year retention', async () => {
    const { readAuditAnchor, writeAuditAnchor } = await loadAnchorAdapter();
    const client = new MemoryObjectLockClient();
    const writeResult = await writeAuditAnchor({
      bucket: 'synthetic-audit-object-lock',
      checkpoint,
      client,
      signer,
      storageKmsKeyId: 'kms-audit-storage-key',
    });

    expect(writeResult).toMatchObject({ ok: true, verified: true });
    if (!writeResult.ok) throw new Error('anchor write should pass');
    const readResult = await readAuditAnchor({
      bucket: 'synthetic-audit-object-lock',
      client,
      key: writeResult.anchor.objectKey,
      signer,
    });
    expect(readResult).toEqual({
      ok: true,
      anchor: writeResult.anchor,
      objectVersion: writeResult.objectVersion,
      verified: true,
    });
    expect(writeResult.anchor.retainUntil).toBe('2031-08-05T12:15:00.000Z');
    expect(writeResult.anchor.signingKeyId).toBe('kms-audit-asymmetric-key');
  });

  it('makes write, read, checksum, signature, and retention failures unhealthy and provider-neutral', async () => {
    const { writeAuditAnchor } = await loadAnchorAdapter();
    const scenarios = [
      ['ANCHOR_WRITE_FAILED', Object.assign(new MemoryObjectLockClient(), { failWrite: true })],
      ['ANCHOR_READ_FAILED', Object.assign(new MemoryObjectLockClient(), { failRead: true })],
      [
        'ANCHOR_CHECKSUM_MISMATCH',
        Object.assign(new MemoryObjectLockClient(), { corruptRead: true }),
      ],
      [
        'ANCHOR_RETENTION_MISMATCH',
        Object.assign(new MemoryObjectLockClient(), { shortenRetention: true }),
      ],
    ] as const;

    for (const [code, client] of scenarios) {
      const result = await writeAuditAnchor({
        bucket: 'synthetic-audit-object-lock',
        checkpoint,
        client,
        signer,
        storageKmsKeyId: 'kms-audit-storage-key',
      });
      expect(result).toEqual({ code, ok: false, retryable: true });
      expect(JSON.stringify(result)).not.toMatch(/provider-(write|read)-secret|stripe|stack/iu);
    }

    const signatureResult = await writeAuditAnchor({
      bucket: 'synthetic-audit-object-lock',
      checkpoint,
      client: new MemoryObjectLockClient(),
      signer: { ...signer, verify: () => Promise.resolve(false) },
      storageKmsKeyId: 'kms-audit-storage-key',
    });
    expect(signatureResult).toEqual({
      code: 'ANCHOR_SIGNATURE_MISMATCH',
      ok: false,
      retryable: true,
    });
  });

  it('anchors at 15 minutes or 1,000 events and rejects indefinite legal holds', async () => {
    const { isAuditAnchorDue, writeAuditAnchor } = await loadAnchorAdapter();
    expect(
      isAuditAnchorDue({
        elapsedMilliseconds: 14 * 60_000 + 59_999,
        eventsSinceAnchor: 999,
      }),
    ).toBe(false);
    expect(isAuditAnchorDue({ elapsedMilliseconds: 0, eventsSinceAnchor: 1_000 })).toBe(true);
    expect(isAuditAnchorDue({ elapsedMilliseconds: 15 * 60_000, eventsSinceAnchor: 1 })).toBe(true);

    await expect(
      writeAuditAnchor({
        bucket: 'synthetic-audit-object-lock',
        checkpoint,
        client: new MemoryObjectLockClient(),
        legalHold: { authorizedBy: 'audit-role', purpose: 'dispute-review' } as never,
        signer,
        storageKmsKeyId: 'kms-audit-storage-key',
      }),
    ).resolves.toEqual({ code: 'ANCHOR_LEGAL_HOLD_INVALID', ok: false, retryable: false });
  });
});
