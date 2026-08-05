import type { DiagnosticConsentJson } from '@liiiraa/contracts-ts';

export type DiagnosticFieldClass =
  | 'hardware-summary'
  | 'application-log-redacted'
  | 'optimization-plan-receipt'
  | 'recovery-journal-excerpt'
  | 'crash-metadata';

export type DiagnosticMimeType = 'application/json; charset=utf-8' | 'text/plain; charset=utf-8';

export interface DiagnosticConsentRecord {
  readonly caseId: string;
  readonly fieldClasses: readonly DiagnosticFieldClass[];
  readonly projection: DiagnosticConsentJson;
}

export interface DiagnosticConsentAuthorityPort {
  readConsent(consentId: string): Promise<DiagnosticConsentRecord | undefined>;
  subscribe(consentId: string, listener: () => void): () => void;
}

export interface StoredDiagnosticFieldDescriptor {
  readonly archiveMembers: readonly string[];
  readonly byteLength: number;
  readonly caseByteLength: number;
  readonly fieldClass: string;
  readonly mimeType: string;
  readonly objectKey: string;
}

export interface DiagnosticStorageReader {
  readonly descriptor: StoredDiagnosticFieldDescriptor;
  read(signal: AbortSignal): Promise<Uint8Array | null>;
  dispose(): Promise<void>;
}

export interface DiagnosticStoragePort {
  openField(
    input: Readonly<{
      caseId: string;
      fieldClass: DiagnosticFieldClass;
      fieldId: string;
    }>,
  ): Promise<DiagnosticStorageReader>;
}

export type DiagnosticInspectionResult =
  | Readonly<{
      bytes: Uint8Array;
      ok: true;
      redactionCount: number;
      scanVerdict: 'clean';
    }>
  | Readonly<{
      code: 'CONTENT_REJECTED' | 'INSPECTION_UNAVAILABLE';
      ok: false;
    }>;

export interface DiagnosticContentInspectorPort {
  inspectAndRedact(
    input: Readonly<{
      bytes: Uint8Array;
      fieldClass: DiagnosticFieldClass;
      mimeType: DiagnosticMimeType;
    }>,
  ): Promise<DiagnosticInspectionResult>;
}

export interface DiagnosticAccessReceipt {
  readonly actorId: string;
  readonly caseId: string;
  readonly consentId: string;
  readonly consentVersion: string;
  readonly fieldClass: DiagnosticFieldClass;
  readonly fieldId: string;
  readonly openedAt: string;
  readonly purpose: string;
}

export interface DiagnosticAccessAuditPort {
  appendAccessReceipt(receipt: DiagnosticAccessReceipt): Promise<void>;
}

export interface DiagnosticStreamRequest {
  readonly actorId: string;
  readonly caseId: string;
  readonly consentId: string;
  readonly fieldClass: DiagnosticFieldClass;
  readonly fieldId: string;
  readonly purpose: string;
}

export type DiagnosticStreamAbortReason =
  'consent-changed' | 'content-rejected' | 'expired' | 'revoked' | 'storage-error';

export type DiagnosticStreamReadResult =
  | Readonly<{ bytes: Uint8Array; kind: 'chunk' }>
  | Readonly<{ kind: 'end' }>
  | Readonly<{ kind: 'aborted'; reason: DiagnosticStreamAbortReason }>;

export interface ConsentBoundStream {
  readonly headers: Readonly<Record<'cache-control' | 'expires' | 'pragma', string>>;
  read(): Promise<DiagnosticStreamReadResult>;
  close(): Promise<void>;
}

export type OpenDiagnosticStreamResult =
  | Readonly<{ ok: true; stream: ConsentBoundStream }>
  | Readonly<{
      code:
        | 'AUDIT_UNAVAILABLE'
        | 'CONSENT_DENIED'
        | 'CONSENT_EXPIRED'
        | 'CONSENT_UNAVAILABLE'
        | 'MANIFEST_REJECTED'
        | 'STORAGE_UNAVAILABLE';
      ok: false;
    }>;
