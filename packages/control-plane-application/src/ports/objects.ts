export type PrivateObjectClass = 'support-attachment' | 'diagnostic-package';

export interface PrivateObjectHeadRequest {
  readonly bucketClass: PrivateObjectClass;
  readonly objectKey: string;
}

export interface PrivateObjectDeleteRequest extends PrivateObjectHeadRequest {
  readonly checksumSha256: string;
  readonly idempotencyKey: string;
}

export interface PrivateObjectHeadEvidence {
  readonly checksumSha256: string;
  readonly providerReceipt: string;
}

export interface PrivateObjectDeleteReceipt {
  readonly alreadyAbsent: boolean;
  readonly checksumSha256: string;
  readonly deletedAt: string;
  readonly providerReceipt: string;
}

export type PrivateObjectFailureCode =
  'OBJECT_CHECKSUM_MISMATCH' | 'OBJECT_INVALID' | 'OBJECT_PROVIDER_UNAVAILABLE';

export type PrivateObjectHeadResult =
  | Readonly<{ ok: true; object: PrivateObjectHeadEvidence | null }>
  | Readonly<{ ok: false; code: PrivateObjectFailureCode; retryable: boolean }>;

export type PrivateObjectDeleteResult =
  | Readonly<{ ok: true; receipt: PrivateObjectDeleteReceipt }>
  | Readonly<{ ok: false; code: PrivateObjectFailureCode; retryable: boolean }>;

export interface PrivateObjectLifecyclePort {
  head(request: PrivateObjectHeadRequest): Promise<PrivateObjectHeadResult>;
  delete(request: PrivateObjectDeleteRequest): Promise<PrivateObjectDeleteResult>;
}
