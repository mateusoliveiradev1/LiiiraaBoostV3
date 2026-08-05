import { createPublicKey, sign, type KeyObject } from 'node:crypto';

import type {
  EntitlementPublicVerificationKey,
  EntitlementSigningPort,
} from '@liiiraa/control-plane-application';

export interface StagingEntitlementSignerOptions {
  readonly keyId: string;
  readonly privateKeyHandle: KeyObject;
  readonly notBeforeUnixSeconds: number;
  readonly notAfterUnixSeconds: number;
}

const canonicalUtc = (unixSeconds: number): string => new Date(unixSeconds * 1_000).toISOString();

export const createStagingEntitlementSigner = (
  options: StagingEntitlementSignerOptions,
): EntitlementSigningPort => {
  if (
    options.privateKeyHandle.type !== 'private' ||
    options.privateKeyHandle.asymmetricKeyType !== 'ed25519' ||
    !Number.isSafeInteger(options.notBeforeUnixSeconds) ||
    !Number.isSafeInteger(options.notAfterUnixSeconds) ||
    options.notAfterUnixSeconds <= options.notBeforeUnixSeconds
  ) {
    throw new Error('invalid-entitlement-signing-key-handle');
  }
  const publicDer = createPublicKey(options.privateKeyHandle).export({ format: 'der', type: 'spki' });
  const publicKeyBytes = publicDer.subarray(-32).toString('base64url');
  const verificationKey: EntitlementPublicVerificationKey = Object.freeze({
    keyId: options.keyId,
    publicKeyBytes,
    status: 'current',
    notBefore: canonicalUtc(options.notBeforeUnixSeconds),
    notAfter: canonicalUtc(options.notAfterUnixSeconds),
    notBeforeUnixSeconds: options.notBeforeUnixSeconds,
    notAfterUnixSeconds: options.notAfterUnixSeconds,
  });

  return Object.freeze({
    sign: (payloadBytes: Uint8Array) =>
      Promise.resolve({
        algorithm: 'Ed25519' as const,
        keyId: options.keyId,
        signature: sign(null, Buffer.from(payloadBytes), options.privateKeyHandle).toString(
          'base64url',
        ),
      }),
    publicVerificationData: () => Promise.resolve(Object.freeze([verificationKey])),
  });
};
