import { createPublicKey, verify } from 'node:crypto';

import { controlPlaneDocumentValidator } from './generated/index.js';

export const OFFLINE_ENTITLEMENT_VALIDITY_SECONDS = 604_800 as const;

export const OfflineEntitlementVerdict = {
  Verified: 'verified',
  OnlineVerificationRequired: 'online-verification-required',
} as const;

export type OfflineEntitlementVerdict =
  (typeof OfflineEntitlementVerdict)[keyof typeof OfflineEntitlementVerdict];

export type OfflineEntitlementSigningKeyStatus = 'current' | 'previous' | 'retired';

export interface OfflineEntitlementSigningKey {
  readonly keyId: string;
  readonly publicKeyBytes: string;
  readonly status: OfflineEntitlementSigningKeyStatus;
  readonly notBeforeUnixSeconds: number;
  readonly notAfterUnixSeconds: number;
}

export interface OfflineEntitlementVerificationContext {
  readonly accountId: string;
  readonly deviceBinding: string;
  readonly audience: string;
  readonly entitlementVersion: number;
  readonly nowUnixSeconds: number;
}

export interface TrustedTimeStore {
  readLastTrustedUnixSeconds(): number | undefined;
  writeLastTrustedUnixSeconds(value: number): void;
}

interface EnvelopeView {
  readonly payloadBytes: string;
  readonly signature: string;
  readonly keyId: string;
  readonly audience: string;
  readonly deviceBinding: string;
  readonly issuedAt: string;
  readonly expiresAt: string;
}

export interface OfflineEntitlementClaims {
  readonly schemaVersion: '1.0';
  readonly accountId: string;
  readonly deviceBinding: string;
  readonly audience: string;
  readonly entitlementVersion: number;
  readonly issuedAt: string;
  readonly expiresAt: string;
  readonly validitySeconds: typeof OFFLINE_ENTITLEMENT_VALIDITY_SECONDS;
}

export const encodeOfflineEntitlementPayload = (claims: OfflineEntitlementClaims): Buffer =>
  Buffer.from(JSON.stringify(claims), 'utf8');

const ED25519_SPKI_PREFIX = Buffer.from('302a300506032b6570032100', 'hex');
const CANONICAL_UTC = /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2}):(\d{2})\.000Z$/u;
const BASE64URL = /^[A-Za-z0-9_-]+={0,2}$/u;

const asRecord = (value: unknown): Readonly<Record<string, unknown>> | undefined =>
  typeof value === 'object' && value !== null && !Array.isArray(value)
    ? (value as Readonly<Record<string, unknown>>)
    : undefined;

const stringProperty = (
  record: Readonly<Record<string, unknown>>,
  property: string,
): string | undefined => {
  const value = record[property];
  return typeof value === 'string' ? value : undefined;
};

const envelopeView = (value: unknown): EnvelopeView | undefined => {
  const record = asRecord(value);
  if (record === undefined) return undefined;

  const payloadBytes = stringProperty(record, 'payloadBytes');
  const signature = stringProperty(record, 'signature');
  const keyId = stringProperty(record, 'keyId');
  const audience = stringProperty(record, 'audience');
  const deviceBinding = stringProperty(record, 'deviceBinding');
  const issuedAt = stringProperty(record, 'issuedAt');
  const expiresAt = stringProperty(record, 'expiresAt');

  if (
    payloadBytes === undefined ||
    signature === undefined ||
    keyId === undefined ||
    audience === undefined ||
    deviceBinding === undefined ||
    issuedAt === undefined ||
    expiresAt === undefined
  ) {
    return undefined;
  }

  return { payloadBytes, signature, keyId, audience, deviceBinding, issuedAt, expiresAt };
};

const decodeBase64Url = (value: string): Buffer | undefined => {
  if (!BASE64URL.test(value) || value.length % 4 === 1) return undefined;

  const decoded = Buffer.from(value, 'base64url');
  if (decoded.toString('base64url') !== value.replace(/=+$/u, '')) return undefined;
  return decoded;
};

const parseCanonicalUtcSeconds = (value: string): number | undefined => {
  if (!CANONICAL_UTC.test(value)) return undefined;
  const milliseconds = Date.parse(value);
  if (!Number.isFinite(milliseconds) || new Date(milliseconds).toISOString() !== value) {
    return undefined;
  }
  return milliseconds / 1_000;
};

export const decodeOfflineEntitlementPayload = (
  payloadBytes: Buffer,
): OfflineEntitlementClaims | undefined => {
  let value: unknown;
  try {
    value = JSON.parse(payloadBytes.toString('utf8')) as unknown;
  } catch {
    return undefined;
  }

  const record = asRecord(value);
  if (record === undefined || Object.keys(record).length !== 8) return undefined;

  const schemaVersion = stringProperty(record, 'schemaVersion');
  const accountId = stringProperty(record, 'accountId');
  const deviceBinding = stringProperty(record, 'deviceBinding');
  const audience = stringProperty(record, 'audience');
  const issuedAt = stringProperty(record, 'issuedAt');
  const expiresAt = stringProperty(record, 'expiresAt');
  const entitlementVersion = record['entitlementVersion'];
  const validitySeconds = record['validitySeconds'];

  if (
    schemaVersion === undefined ||
    accountId === undefined ||
    deviceBinding === undefined ||
    audience === undefined ||
    issuedAt === undefined ||
    expiresAt === undefined ||
    !Number.isSafeInteger(entitlementVersion) ||
    !Number.isSafeInteger(validitySeconds)
  ) {
    return undefined;
  }

  if (schemaVersion !== '1.0' || validitySeconds !== OFFLINE_ENTITLEMENT_VALIDITY_SECONDS) {
    return undefined;
  }

  return {
    schemaVersion,
    accountId,
    deviceBinding,
    audience,
    entitlementVersion: entitlementVersion as number,
    issuedAt,
    expiresAt,
    validitySeconds,
  };
};

const verificationRequired = (): OfflineEntitlementVerdict =>
  OfflineEntitlementVerdict.OnlineVerificationRequired;

const verifyCandidate = (
  input: unknown,
  keyRing: readonly OfflineEntitlementSigningKey[],
  context: OfflineEntitlementVerificationContext,
  trustedTimeStore: TrustedTimeStore,
): OfflineEntitlementVerdict => {
  const envelope = envelopeView(input);
  if (envelope === undefined) return verificationRequired();

  const signingKey = keyRing.find(({ keyId }) => keyId === envelope.keyId);
  if (signingKey === undefined || signingKey.status === 'retired') {
    return verificationRequired();
  }

  const payloadBytes = decodeBase64Url(envelope.payloadBytes);
  const signatureBytes = decodeBase64Url(envelope.signature);
  const publicKeyBytes = decodeBase64Url(signingKey.publicKeyBytes);
  if (
    payloadBytes === undefined ||
    signatureBytes?.length !== 64 ||
    publicKeyBytes?.length !== 32
  ) {
    return verificationRequired();
  }

  const publicKey = createPublicKey({
    key: Buffer.concat([ED25519_SPKI_PREFIX, publicKeyBytes]),
    format: 'der',
    type: 'spki',
  });
  if (!verify(null, payloadBytes, publicKey, signatureBytes)) {
    return verificationRequired();
  }

  if (!controlPlaneDocumentValidator(input)) return verificationRequired();

  const claims = decodeOfflineEntitlementPayload(payloadBytes);
  if (claims === undefined) return verificationRequired();

  const issuedAt = parseCanonicalUtcSeconds(claims.issuedAt);
  const expiresAt = parseCanonicalUtcSeconds(claims.expiresAt);
  const envelopeIssuedAt = parseCanonicalUtcSeconds(envelope.issuedAt);
  const envelopeExpiresAt = parseCanonicalUtcSeconds(envelope.expiresAt);
  if (
    issuedAt === undefined ||
    expiresAt === undefined ||
    envelopeIssuedAt === undefined ||
    envelopeExpiresAt === undefined
  ) {
    return verificationRequired();
  }

  const lastTrustedTime = trustedTimeStore.readLastTrustedUnixSeconds();
  if (
    !Number.isSafeInteger(context.nowUnixSeconds) ||
    (lastTrustedTime !== undefined &&
      (!Number.isSafeInteger(lastTrustedTime) || context.nowUnixSeconds < lastTrustedTime)) ||
    context.nowUnixSeconds < issuedAt ||
    context.nowUnixSeconds > expiresAt ||
    expiresAt - issuedAt !== OFFLINE_ENTITLEMENT_VALIDITY_SECONDS ||
    claims.validitySeconds !== OFFLINE_ENTITLEMENT_VALIDITY_SECONDS ||
    issuedAt !== envelopeIssuedAt ||
    expiresAt !== envelopeExpiresAt ||
    claims.schemaVersion !== '1.0' ||
    claims.accountId !== context.accountId ||
    claims.deviceBinding !== context.deviceBinding ||
    claims.deviceBinding !== envelope.deviceBinding ||
    claims.audience !== context.audience ||
    claims.audience !== envelope.audience ||
    claims.entitlementVersion !== context.entitlementVersion ||
    issuedAt < signingKey.notBeforeUnixSeconds ||
    issuedAt > signingKey.notAfterUnixSeconds ||
    context.nowUnixSeconds < signingKey.notBeforeUnixSeconds ||
    context.nowUnixSeconds > signingKey.notAfterUnixSeconds
  ) {
    return verificationRequired();
  }

  trustedTimeStore.writeLastTrustedUnixSeconds(context.nowUnixSeconds);
  return OfflineEntitlementVerdict.Verified;
};

export const verifyOfflineEntitlementBytes = (
  input: unknown,
  keyRing: readonly OfflineEntitlementSigningKey[],
  context: OfflineEntitlementVerificationContext,
  trustedTimeStore: TrustedTimeStore,
): OfflineEntitlementVerdict => {
  try {
    return verifyCandidate(input, keyRing, context, trustedTimeStore);
  } catch {
    return verificationRequired();
  }
};
