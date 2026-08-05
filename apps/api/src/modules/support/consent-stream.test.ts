import type { DiagnosticConsentJson } from '@liiiraa/contracts-ts';
import type {
  DiagnosticConsentRecord,
  DiagnosticFieldClass,
} from '@liiiraa/control-plane-application';
import { describe, expect, it } from 'vitest';

const CONSENT_STREAM_RED_OWNER = '04-09-01';
const NOW = '2026-08-05T12:00:00.000Z';
const PURPOSE = 'investigate synthetic startup regression';
const FIELD_CLASS = 'application-log-redacted';

const projection = Object.freeze({
  schemaVersion: '1.0',
  aggregateVersion: '7',
  etag: 'consent-etag-7',
  correlationId: 'correlation-consent-1',
  provenance: 'postgres-authority',
  kind: 'diagnostic-consent',
  consentId: 'consent-synthetic-1',
  accountId: 'account-synthetic-1',
  state: 'active',
  scopes: ['support-diagnostics'],
  purpose: PURPOSE,
  grantedAt: '2026-08-04T18:00:00.000Z',
  expiresAt: '2026-08-07T18:00:00.000Z',
} as const satisfies DiagnosticConsentJson);

const activeConsent: DiagnosticConsentRecord = Object.freeze({
  caseId: 'case-synthetic-1',
  fieldClasses: Object.freeze([
    'hardware-summary',
    FIELD_CLASS,
    'optimization-plan-receipt',
  ] satisfies readonly DiagnosticFieldClass[]),
  projection,
});

const expectedConsentStreamRed = (id: string, behavior: string): never => {
  throw new Error(`EXPECTED_RED[${CONSENT_STREAM_RED_OWNER}][${id}]: ${behavior}`);
};

const loadAdapter = async () => {
  try {
    return await import('@liiiraa/control-plane-adapters');
  } catch (error) {
    if (error instanceof Error && error.message.includes('Cannot find')) {
      return expectedConsentStreamRed(
        'adapter-absent',
        'the owner must implement continuously revalidated consent-bound diagnostic streaming',
      );
    }
    throw error;
  }
};

class MemoryConsentAuthority {
  private record: DiagnosticConsentRecord | undefined;
  private readonly listeners = new Set<() => void>();

  constructor(record: DiagnosticConsentRecord | undefined = activeConsent) {
    this.record = record;
  }

  readonly readConsent = (): Promise<DiagnosticConsentRecord | undefined> =>
    Promise.resolve(this.record);

  readonly subscribe = (_consentId: string, listener: () => void): (() => void) => {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  };

  update(record: DiagnosticConsentRecord | undefined): void {
    this.record = record;
    for (const listener of this.listeners) listener();
  }
}

type StoredDescriptor = Readonly<{
  archiveMembers: readonly string[];
  byteLength: number;
  caseByteLength: number;
  fieldClass: string;
  mimeType: string;
  objectKey: string;
}>;

const descriptor = Object.freeze({
  archiveMembers: Object.freeze([]),
  byteLength: 36,
  caseByteLength: 1_024,
  fieldClass: FIELD_CLASS,
  mimeType: 'text/plain; charset=utf-8',
  objectKey: 'diagnostics/case-synthetic-1/field-synthetic-1',
} as const satisfies StoredDescriptor);

class MemoryDiagnosticStorage {
  readonly openedSignals: AbortSignal[] = [];
  readonly sourceBuffers: Uint8Array[] = [];
  disposed = false;
  openCount = 0;
  private readonly chunks: readonly Uint8Array[];
  private blockAfter: number | undefined;

  constructor(
    readonly storedDescriptor: StoredDescriptor = descriptor,
    chunks: readonly string[] = ['user=synthetic token=top-secret'],
  ) {
    this.chunks = chunks.map((chunk) => new TextEncoder().encode(chunk));
    this.sourceBuffers.push(...this.chunks);
  }

  blockAfterChunk(index: number): void {
    this.blockAfter = index;
  }

  openField = () => {
    this.openCount += 1;
    let index = 0;
    return Promise.resolve({
      descriptor: this.storedDescriptor,
      dispose: () => {
        this.disposed = true;
        for (const buffer of this.sourceBuffers) buffer.fill(0);
        return Promise.resolve();
      },
      read: async (signal: AbortSignal): Promise<Uint8Array | null> => {
        this.openedSignals.push(signal);
        if (this.blockAfter === index) {
          return new Promise<Uint8Array | null>((_resolve, reject) => {
            const rejectAbort = () => {
              const error = new Error('storage read aborted');
              error.name = 'AbortError';
              reject(error);
            };
            if (signal.aborted) rejectAbort();
            else signal.addEventListener('abort', rejectAbort, { once: true });
          });
        }
        const chunk = this.chunks[index];
        index += 1;
        return chunk ?? null;
      },
    });
  };
}

class MemoryAudit {
  readonly receipts: unknown[] = [];

  readonly appendAccessReceipt = (receipt: unknown): Promise<void> => {
    this.receipts.push(receipt);
    return Promise.resolve();
  };
}

const contentInspector = Object.freeze({
  inspectAndRedact: (input: Readonly<{ bytes: Uint8Array }>) => {
    const decoded = new TextDecoder('utf-8', { fatal: true }).decode(input.bytes);
    if (decoded.includes('malware-signature')) {
      return Promise.resolve(Object.freeze({ code: 'CONTENT_REJECTED', ok: false as const }));
    }
    return Promise.resolve(
      Object.freeze({
        bytes: new TextEncoder().encode(decoded.replace(/token=[^\s]+/gu, 'token=[redacted]')),
        ok: true as const,
        redactionCount: decoded.includes('token=') ? 1 : 0,
        scanVerdict: 'clean' as const,
      }),
    );
  },
});

const request = Object.freeze({
  actorId: 'operator-security-1',
  caseId: 'case-synthetic-1',
  consentId: 'consent-synthetic-1',
  fieldClass: FIELD_CLASS,
  fieldId: 'field-synthetic-1',
  purpose: PURPOSE,
});

const openStream = async (
  overrides: Readonly<{
    authority?: MemoryConsentAuthority;
    audit?: MemoryAudit;
    now?: () => Date;
    onClearData?: (reason: string) => void;
    request?: typeof request;
    storage?: MemoryDiagnosticStorage;
  }> = {},
) => {
  const adapter = await loadAdapter();
  const authority = overrides.authority ?? new MemoryConsentAuthority();
  const audit = overrides.audit ?? new MemoryAudit();
  const storage = overrides.storage ?? new MemoryDiagnosticStorage();
  const result = await adapter.openConsentBoundDiagnosticStream({
    audit,
    consentAuthority: authority,
    contentInspector,
    now: overrides.now ?? (() => new Date(NOW)),
    onClearData: overrides.onClearData ?? (() => undefined),
    request: overrides.request ?? request,
    storage,
  });
  return { audit, authority, result, storage };
};

const revokedConsent = (): DiagnosticConsentRecord =>
  Object.freeze({
    ...activeConsent,
    projection: Object.freeze({
      ...projection,
      aggregateVersion: '8',
      etag: 'consent-etag-8',
      state: 'revoked',
      revokedAt: NOW,
    }),
  });

describe('diagnostic consent admission', () => {
  it.each([
    ['wrong-case', { ...request, caseId: 'case-synthetic-other' }],
    ['wrong-purpose', { ...request, purpose: 'unrelated purpose' }],
    ['wrong-field', { ...request, fieldClass: 'crash-metadata' }],
  ])('returns no bytes for %s', async (_id, deniedRequest) => {
    const { audit, result, storage } = await openStream({
      request: Object.freeze(deniedRequest) as typeof request,
    });

    expect(result).toMatchObject({ ok: false, code: 'CONSENT_DENIED' });
    expect(storage.openCount).toBe(0);
    expect(audit.receipts).toHaveLength(0);
  });

  it.each([
    ['revoked', revokedConsent()],
    [
      'expired',
      Object.freeze({
        ...activeConsent,
        projection: Object.freeze({ ...projection, expiresAt: '2026-08-05T11:59:59.999Z' }),
      }),
    ],
    [
      'over-72-hours',
      Object.freeze({
        ...activeConsent,
        projection: Object.freeze({ ...projection, expiresAt: '2026-08-07T18:00:00.001Z' }),
      }),
    ],
  ])('returns no bytes for %s consent', async (_id, consent) => {
    const authority = new MemoryConsentAuthority(consent);
    const { audit, result, storage } = await openStream({ authority });

    expect(result.ok).toBe(false);
    expect(storage.openCount).toBe(0);
    expect(audit.receipts).toHaveLength(0);
  });
});

describe('continuous consent and temporary-data lifecycle', () => {
  it('in-flight-revocation-abort', async () => {
    const cleared: string[] = [];
    const storage = new MemoryDiagnosticStorage();
    storage.blockAfterChunk(1);
    const { authority, audit, result } = await openStream({
      onClearData: (reason) => cleared.push(reason),
      storage,
    });
    expect(result.ok).toBe(true);
    if (!result.ok) return;

    const first = await result.stream.read();
    expect(first.kind).toBe('chunk');
    if (first.kind !== 'chunk') return;
    expect(new TextDecoder().decode(first.bytes)).toContain('token=[redacted]');
    const pending = result.stream.read();
    authority.update(revokedConsent());

    await expect(pending).resolves.toEqual({ kind: 'aborted', reason: 'revoked' });
    expect(storage.openedSignals.at(-1)?.aborted).toBe(true);
    expect([...first.bytes]).toEqual(new Array(first.bytes.byteLength).fill(0));
    expect(cleared).toEqual(['revoked']);
    expect(storage.disposed).toBe(true);
    expect(audit.receipts).toHaveLength(1);
  });

  it('in-flight-expiry-abort', async () => {
    let currentTime = new Date(NOW);
    const cleared: string[] = [];
    const authority = new MemoryConsentAuthority();
    const storage = new MemoryDiagnosticStorage();
    storage.blockAfterChunk(1);
    const { result } = await openStream({
      authority,
      now: () => currentTime,
      onClearData: (reason) => cleared.push(reason),
      storage,
    });
    expect(result.ok).toBe(true);
    if (!result.ok) return;

    const first = await result.stream.read();
    const pending = result.stream.read();
    currentTime = new Date(projection.expiresAt);
    authority.update(activeConsent);

    await expect(pending).resolves.toEqual({ kind: 'aborted', reason: 'expired' });
    expect(first.kind === 'chunk' ? [...first.bytes].every((byte) => byte === 0) : false).toBe(
      true,
    );
    expect(cleared).toEqual(['expired']);
    expect(storage.disposed).toBe(true);
  });

  it('revalidates at every chunk boundary before releasing another byte', async () => {
    const { authority, result } = await openStream({
      storage: new MemoryDiagnosticStorage(descriptor, ['first', 'second']),
    });
    expect(result.ok).toBe(true);
    if (!result.ok) return;

    expect((await result.stream.read()).kind).toBe('chunk');
    authority.update(revokedConsent());
    expect(await result.stream.read()).toEqual({ kind: 'aborted', reason: 'revoked' });
  });
});

describe('private response and immutable bounded receipt', () => {
  it('private-no-store-response exposes no bearer or browser persistence authority', async () => {
    const { result } = await openStream();
    expect(result.ok).toBe(true);
    if (!result.ok) return;

    expect(result.stream.headers).toEqual({
      'cache-control': 'private, no-store',
      expires: '0',
      pragma: 'no-cache',
    });
    expect('objectUrl' in result.stream).toBe(false);
    expect('downloadUrl' in result.stream).toBe(false);
    expect('export' in result.stream).toBe(false);
  });

  it('immutable-access-audit persists minimized access-window evidence after revocation', async () => {
    const { authority, audit, result } = await openStream();
    expect(result.ok).toBe(true);
    if (!result.ok) return;

    expect(audit.receipts).toHaveLength(1);
    expect(audit.receipts[0]).toEqual({
      actorId: request.actorId,
      caseId: request.caseId,
      consentId: request.consentId,
      consentVersion: projection.aggregateVersion,
      fieldClass: request.fieldClass,
      fieldId: request.fieldId,
      openedAt: NOW,
      purpose: request.purpose,
    });
    expect(Object.isFrozen(audit.receipts[0])).toBe(true);
    expect(JSON.stringify(audit.receipts[0])).not.toContain('top-secret');

    authority.update(revokedConsent());
    expect(audit.receipts).toHaveLength(1);
    expect(audit.receipts[0]).toMatchObject({ consentVersion: '7' });
  });
});

describe('diagnostic.v1 manifest admission', () => {
  it.each([
    ['unknown-mime', { ...descriptor, mimeType: 'application/octet-stream' }],
    ['unknown-field', { ...descriptor, fieldClass: 'registry-export' }],
    ['archive-member', { ...descriptor, archiveMembers: ['nested/log.txt'] }],
    ['oversize-field', { ...descriptor, byteLength: 5 * 1_024 * 1_024 + 1 }],
    ['oversize-case', { ...descriptor, caseByteLength: 25 * 1_024 * 1_024 + 1 }],
    ['path-traversal', { ...descriptor, objectKey: 'diagnostics/../credential.txt' }],
  ])('fails closed for %s', async (_id, rejectedDescriptor) => {
    const storage = new MemoryDiagnosticStorage(Object.freeze(rejectedDescriptor));
    const { audit, result } = await openStream({ storage });

    expect(result).toMatchObject({ ok: false, code: 'MANIFEST_REJECTED' });
    expect(storage.disposed).toBe(true);
    expect(audit.receipts).toHaveLength(0);
  });

  it('denies invalid UTF-8, malformed JSON, and scanning rejection', async () => {
    const adapter = await loadAdapter();
    for (const fixture of [
      {
        mimeType: 'text/plain; charset=utf-8',
        bytes: Uint8Array.of(0xc3, 0x28),
      },
      {
        mimeType: 'application/json; charset=utf-8',
        bytes: new TextEncoder().encode('{not-json'),
      },
      {
        mimeType: 'text/plain; charset=utf-8',
        bytes: new TextEncoder().encode('malware-signature'),
      },
    ]) {
      const storage = new MemoryDiagnosticStorage(
        Object.freeze({
          ...descriptor,
          byteLength: fixture.bytes.byteLength,
          mimeType: fixture.mimeType,
        }),
        [],
      );
      storage.sourceBuffers.push(fixture.bytes);
      storage.blockAfterChunk(1);
      let read = false;
      storage.openField = () =>
        Promise.resolve({
          descriptor: storage.storedDescriptor,
          dispose: () => {
            storage.disposed = true;
            fixture.bytes.fill(0);
            return Promise.resolve();
          },
          read: () => {
            if (read) return Promise.resolve(null);
            read = true;
            return Promise.resolve(fixture.bytes);
          },
        });
      const result = await adapter.openConsentBoundDiagnosticStream({
        audit: new MemoryAudit(),
        consentAuthority: new MemoryConsentAuthority(),
        contentInspector,
        now: () => new Date(NOW),
        onClearData: () => undefined,
        request,
        storage,
      });
      expect(result.ok).toBe(true);
      if (!result.ok) continue;
      expect(await result.stream.read()).toEqual({ kind: 'aborted', reason: 'content-rejected' });
      expect(storage.disposed).toBe(true);
    }
  });
});
