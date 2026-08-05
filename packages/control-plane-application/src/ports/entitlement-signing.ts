export interface EntitlementPublicVerificationKey {
  readonly keyId: string;
  readonly publicKeyBytes: string;
  readonly status: 'current';
  readonly notBefore: string;
  readonly notAfter: string;
  readonly notBeforeUnixSeconds: number;
  readonly notAfterUnixSeconds: number;
}

export interface EntitlementSignature {
  readonly algorithm: 'Ed25519';
  readonly keyId: string;
  readonly signature: string;
}

/** Signs caller-owned opaque bytes without exposing key-export operations. */
export interface EntitlementSigningPort {
  sign(payloadBytes: Uint8Array): Promise<EntitlementSignature>;
  publicVerificationData(): Promise<readonly EntitlementPublicVerificationKey[]>;
}
