import type {
  ConsentBoundStream,
  DiagnosticAccessAuditPort,
  DiagnosticAccessReceipt,
  DiagnosticConsentAuthorityPort,
  DiagnosticConsentRecord,
  DiagnosticContentInspectorPort,
  DiagnosticFieldClass,
  DiagnosticMimeType,
  DiagnosticStoragePort,
  DiagnosticStorageReader,
  DiagnosticStreamAbortReason,
  DiagnosticStreamReadResult,
  DiagnosticStreamRequest,
  OpenDiagnosticStreamResult,
  StoredDiagnosticFieldDescriptor,
} from '@liiiraa/control-plane-application';

export const DIAGNOSTIC_MANIFEST_VERSION = 'diagnostic.v1' as const;
export const MAX_DIAGNOSTIC_FIELD_BYTES = 5 * 1_024 * 1_024;
export const MAX_DIAGNOSTIC_CASE_BYTES = 25 * 1_024 * 1_024;

const MAX_CONSENT_MS = 72 * 60 * 60 * 1_000;
const MAX_IDENTIFIER_LENGTH = 128;
const MAX_PURPOSE_LENGTH = 1_024;
const ALLOWED_FIELD_CLASSES = Object.freeze([
  'hardware-summary',
  'application-log-redacted',
  'optimization-plan-receipt',
  'recovery-journal-excerpt',
  'crash-metadata',
] as const satisfies readonly DiagnosticFieldClass[]);
const ALLOWED_MIME_TYPES = Object.freeze([
  'application/json; charset=utf-8',
  'text/plain; charset=utf-8',
] as const satisfies readonly DiagnosticMimeType[]);
const SERVER_OBJECT_KEY =
  /^diagnostics\/[A-Za-z0-9][A-Za-z0-9._-]{0,127}\/[A-Za-z0-9][A-Za-z0-9._-]{0,127}$/u;

const PRIVATE_NO_STORE_HEADERS = Object.freeze({
  'cache-control': 'private, no-store',
  expires: '0',
  pragma: 'no-cache',
});

const denied = (code: Extract<OpenDiagnosticStreamResult, { ok: false }>['code']) =>
  Object.freeze({ code, ok: false as const });

const disposeReader = async (reader: DiagnosticStorageReader): Promise<void> => {
  try {
    await reader.dispose();
  } catch {
    // Provider disposal failure cannot restore bytes already cleared by this adapter.
  }
};

const isBoundedIdentifier = (value: string): boolean =>
  value.length >= 1 && value.length <= MAX_IDENTIFIER_LENGTH && /^[A-Za-z0-9._:-]+$/u.test(value);

const isFieldClass = (value: string): value is DiagnosticFieldClass =>
  (ALLOWED_FIELD_CLASSES as readonly string[]).includes(value);

const isMimeType = (value: string): value is DiagnosticMimeType =>
  (ALLOWED_MIME_TYPES as readonly string[]).includes(value);

const isManifestAdmitted = (
  descriptor: StoredDiagnosticFieldDescriptor,
  request: DiagnosticStreamRequest,
): descriptor is StoredDiagnosticFieldDescriptor & {
  readonly fieldClass: DiagnosticFieldClass;
  readonly mimeType: DiagnosticMimeType;
} =>
  isFieldClass(descriptor.fieldClass) &&
  descriptor.fieldClass === request.fieldClass &&
  isMimeType(descriptor.mimeType) &&
  Number.isSafeInteger(descriptor.byteLength) &&
  descriptor.byteLength >= 0 &&
  descriptor.byteLength <= MAX_DIAGNOSTIC_FIELD_BYTES &&
  Number.isSafeInteger(descriptor.caseByteLength) &&
  descriptor.caseByteLength >= descriptor.byteLength &&
  descriptor.caseByteLength <= MAX_DIAGNOSTIC_CASE_BYTES &&
  descriptor.archiveMembers.length === 0 &&
  SERVER_OBJECT_KEY.test(descriptor.objectKey) &&
  descriptor.objectKey.split('/')[1] === request.caseId;

type ConsentDecision =
  | Readonly<{ ok: true; record: DiagnosticConsentRecord }>
  | Readonly<{ ok: false; reason: 'consent-changed' | 'denied' | 'expired' | 'revoked' }>;

const evaluateConsent = (
  record: DiagnosticConsentRecord | undefined,
  request: DiagnosticStreamRequest,
  now: Date,
  expectedVersion?: string,
): ConsentDecision => {
  if (record === undefined) return Object.freeze({ ok: false, reason: 'denied' });
  const { projection } = record;
  if (projection.state === 'revoked') return Object.freeze({ ok: false, reason: 'revoked' });
  if (projection.state !== 'active') return Object.freeze({ ok: false, reason: 'expired' });

  const grantedAt = Date.parse(projection.grantedAt);
  const expiresAt = Date.parse(projection.expiresAt);
  const nowTime = now.getTime();
  if (
    !Number.isFinite(grantedAt) ||
    !Number.isFinite(expiresAt) ||
    grantedAt > nowTime ||
    expiresAt <= nowTime
  ) {
    return Object.freeze({ ok: false, reason: 'expired' });
  }
  if (expiresAt - grantedAt > MAX_CONSENT_MS) {
    return Object.freeze({ ok: false, reason: 'denied' });
  }
  if (expectedVersion !== undefined && projection.aggregateVersion !== expectedVersion) {
    return Object.freeze({ ok: false, reason: 'consent-changed' });
  }
  if (
    projection.consentId !== request.consentId ||
    record.caseId !== request.caseId ||
    projection.purpose !== request.purpose ||
    !projection.scopes.includes('support-diagnostics') ||
    !record.fieldClasses.includes(request.fieldClass) ||
    !isBoundedIdentifier(request.actorId) ||
    !isBoundedIdentifier(request.caseId) ||
    !isBoundedIdentifier(request.consentId) ||
    !isBoundedIdentifier(request.fieldId) ||
    request.purpose.length < 1 ||
    request.purpose.length > MAX_PURPOSE_LENGTH
  ) {
    return Object.freeze({ ok: false, reason: 'denied' });
  }
  return Object.freeze({ ok: true, record });
};

const validateUtf8Content = (bytes: Uint8Array, mimeType: DiagnosticMimeType): boolean => {
  let decoded: string;
  try {
    decoded = new TextDecoder('utf-8', { fatal: true }).decode(bytes);
  } catch {
    return false;
  }
  if (mimeType === 'text/plain; charset=utf-8') return true;
  try {
    JSON.parse(decoded);
    return true;
  } catch {
    return false;
  }
};

class AdapterConsentBoundStream implements ConsentBoundStream {
  readonly headers = PRIVATE_NO_STORE_HEADERS;
  private readonly deliveredBuffers = new Set<Uint8Array>();
  private readonly abortController = new AbortController();
  private closedReason: DiagnosticStreamAbortReason | 'complete' | undefined;
  private unsubscribe: (() => void) | undefined;
  private totalRead = 0;
  private disposal: Promise<void> | undefined;

  constructor(
    private readonly consentAuthority: DiagnosticConsentAuthorityPort,
    private readonly contentInspector: DiagnosticContentInspectorPort,
    private readonly expectedConsentVersion: string,
    private readonly mimeType: DiagnosticMimeType,
    private readonly now: () => Date,
    private readonly onClearData: (reason: DiagnosticStreamAbortReason) => void,
    private readonly reader: DiagnosticStorageReader,
    private readonly request: DiagnosticStreamRequest,
  ) {}

  start(): boolean {
    try {
      this.unsubscribe = this.consentAuthority.subscribe(this.request.consentId, () => {
        void this.revalidateNotification();
      });
      return true;
    } catch {
      return false;
    }
  }

  private async revalidate(): Promise<ConsentDecision> {
    try {
      const record = await this.consentAuthority.readConsent(this.request.consentId);
      return evaluateConsent(record, this.request, this.now(), this.expectedConsentVersion);
    } catch {
      return Object.freeze({ ok: false, reason: 'denied' });
    }
  }

  private async revalidateNotification(): Promise<void> {
    const decision = await this.revalidate();
    if (!decision.ok)
      await this.terminate(decision.reason === 'denied' ? 'consent-changed' : decision.reason);
  }

  private currentAbortReason(): DiagnosticStreamAbortReason | undefined {
    return this.closedReason === 'complete' ? undefined : this.closedReason;
  }

  private async terminate(reason: DiagnosticStreamAbortReason | 'complete'): Promise<void> {
    if (this.closedReason !== undefined) {
      await this.disposal;
      return;
    }
    this.closedReason = reason;
    this.abortController.abort(reason);
    for (const buffer of this.deliveredBuffers) buffer.fill(0);
    this.deliveredBuffers.clear();
    this.unsubscribe?.();
    this.unsubscribe = undefined;
    if (reason !== 'complete') {
      try {
        this.onClearData(reason);
      } catch {
        // Client callback failure cannot retain server-side storage or buffers.
      }
    }
    this.disposal = disposeReader(this.reader);
    await this.disposal;
  }

  async read(): Promise<DiagnosticStreamReadResult> {
    if (this.closedReason !== undefined) {
      return this.closedReason === 'complete'
        ? Object.freeze({ kind: 'end' })
        : Object.freeze({ kind: 'aborted', reason: this.closedReason });
    }

    const beforeRead = await this.revalidate();
    if (!beforeRead.ok) {
      const reason = beforeRead.reason === 'denied' ? 'consent-changed' : beforeRead.reason;
      await this.terminate(reason);
      return Object.freeze({ kind: 'aborted', reason });
    }

    let sourceBytes: Uint8Array | null;
    try {
      sourceBytes = await this.reader.read(this.abortController.signal);
    } catch (error) {
      const currentReason = this.currentAbortReason();
      if (currentReason !== undefined) {
        await this.disposal;
        return Object.freeze({ kind: 'aborted', reason: currentReason });
      }
      const reason: DiagnosticStreamAbortReason =
        error instanceof Error && error.name === 'AbortError' ? 'consent-changed' : 'storage-error';
      await this.terminate(reason);
      return Object.freeze({ kind: 'aborted', reason });
    }

    if (sourceBytes === null) {
      await this.terminate('complete');
      return Object.freeze({ kind: 'end' });
    }

    this.totalRead += sourceBytes.byteLength;
    if (
      this.totalRead > this.reader.descriptor.byteLength ||
      this.totalRead > MAX_DIAGNOSTIC_FIELD_BYTES ||
      !validateUtf8Content(sourceBytes, this.mimeType)
    ) {
      sourceBytes.fill(0);
      await this.terminate('content-rejected');
      return Object.freeze({ kind: 'aborted', reason: 'content-rejected' });
    }

    const inspectionInput = Uint8Array.from(sourceBytes);
    sourceBytes.fill(0);
    let inspection: Awaited<ReturnType<DiagnosticContentInspectorPort['inspectAndRedact']>>;
    try {
      inspection = await this.contentInspector.inspectAndRedact({
        bytes: inspectionInput,
        fieldClass: this.request.fieldClass,
        mimeType: this.mimeType,
      });
    } catch {
      inspectionInput.fill(0);
      await this.terminate('content-rejected');
      return Object.freeze({ kind: 'aborted', reason: 'content-rejected' });
    }
    inspectionInput.fill(0);
    if (!inspection.ok || !validateUtf8Content(inspection.bytes, this.mimeType)) {
      if (inspection.ok) inspection.bytes.fill(0);
      await this.terminate('content-rejected');
      return Object.freeze({ kind: 'aborted', reason: 'content-rejected' });
    }

    const afterInspection = await this.revalidate();
    if (!afterInspection.ok) {
      inspection.bytes.fill(0);
      const reason =
        afterInspection.reason === 'denied' ? 'consent-changed' : afterInspection.reason;
      await this.terminate(reason);
      return Object.freeze({ kind: 'aborted', reason });
    }

    const delivered = Uint8Array.from(inspection.bytes);
    inspection.bytes.fill(0);
    this.deliveredBuffers.add(delivered);
    return Object.freeze({ bytes: delivered, kind: 'chunk' });
  }

  async close(): Promise<void> {
    await this.terminate('complete');
  }
}

export const openConsentBoundDiagnosticStream = async (
  input: Readonly<{
    audit: DiagnosticAccessAuditPort;
    consentAuthority: DiagnosticConsentAuthorityPort;
    contentInspector: DiagnosticContentInspectorPort;
    now?: () => Date;
    onClearData: (reason: DiagnosticStreamAbortReason) => void;
    request: DiagnosticStreamRequest;
    storage: DiagnosticStoragePort;
  }>,
): Promise<OpenDiagnosticStreamResult> => {
  const now = input.now ?? (() => new Date());
  let initialRecord: DiagnosticConsentRecord | undefined;
  try {
    initialRecord = await input.consentAuthority.readConsent(input.request.consentId);
  } catch {
    return denied('CONSENT_UNAVAILABLE');
  }
  const initialConsent = evaluateConsent(initialRecord, input.request, now());
  if (!initialConsent.ok) {
    return initialConsent.reason === 'expired'
      ? denied('CONSENT_EXPIRED')
      : denied('CONSENT_DENIED');
  }

  let reader: DiagnosticStorageReader;
  try {
    reader = await input.storage.openField({
      caseId: input.request.caseId,
      fieldClass: input.request.fieldClass,
      fieldId: input.request.fieldId,
    });
  } catch {
    return denied('STORAGE_UNAVAILABLE');
  }

  if (!isManifestAdmitted(reader.descriptor, input.request)) {
    await disposeReader(reader);
    return denied('MANIFEST_REJECTED');
  }

  const stream = new AdapterConsentBoundStream(
    input.consentAuthority,
    input.contentInspector,
    initialConsent.record.projection.aggregateVersion,
    reader.descriptor.mimeType,
    now,
    input.onClearData,
    reader,
    input.request,
  );
  if (!stream.start()) {
    await disposeReader(reader);
    return denied('CONSENT_UNAVAILABLE');
  }

  const receipt: DiagnosticAccessReceipt = Object.freeze({
    actorId: input.request.actorId,
    caseId: input.request.caseId,
    consentId: input.request.consentId,
    consentVersion: initialConsent.record.projection.aggregateVersion,
    fieldClass: input.request.fieldClass,
    fieldId: input.request.fieldId,
    openedAt: now().toISOString(),
    purpose: input.request.purpose,
  });
  try {
    await input.audit.appendAccessReceipt(receipt);
  } catch {
    await stream.close();
    return denied('AUDIT_UNAVAILABLE');
  }
  return Object.freeze({ ok: true, stream });
};
