import { describe, expect, it } from 'vitest';

import {
  controlPlaneDocumentValidator,
  type OfflineEntitlementEnvelopeJson,
} from './generated/index.js';

const OFFLINE_ENTITLEMENT_RED_OWNER = '04-07-01';

const canonicalEnvelope = {
  schemaVersion: '1.0',
  kind: 'offline-entitlement-envelope',
  payloadBytes: 'eyJhY2NvdW50SWQiOiJzeW50aGV0aWMtYWNjb3VudC0wMDAxIn0=',
  signature:
    'AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA',
  algorithm: 'Ed25519',
  keyId: 'development-key-0001',
  audience: 'liiiraa-desktop',
  deviceBinding: 'synthetic-device-binding',
  issuedAt: '2026-08-04T12:00:00.000Z',
  expiresAt: '2026-08-11T12:00:00.000Z',
  validitySeconds: 604800,
} satisfies OfflineEntitlementEnvelopeJson;

type OfflineEntitlementExpectedVerdict = 'verified' | 'online-verification-required';

const offlineEntitlementCorpus = [
  {
    id: 'canonical exact bytes through issuedAt plus seven days',
    expectedVerdict: 'verified',
  },
  { id: 'one-byte payload tamper', expectedVerdict: 'online-verification-required' },
  {
    id: 'whitespace or JSON reserialization changes signed bytes',
    expectedVerdict: 'online-verification-required',
  },
  { id: 'unknown signing key', expectedVerdict: 'online-verification-required' },
  { id: 'wrong signing key', expectedVerdict: 'online-verification-required' },
  { id: 'retired signing key', expectedVerdict: 'online-verification-required' },
  {
    id: 'previous key outside declared rotation window',
    expectedVerdict: 'online-verification-required',
  },
  { id: 'wrong account binding', expectedVerdict: 'online-verification-required' },
  { id: 'wrong device binding', expectedVerdict: 'online-verification-required' },
  { id: 'wrong audience', expectedVerdict: 'online-verification-required' },
  { id: 'wrong schema version', expectedVerdict: 'online-verification-required' },
  { id: 'expired seven-day envelope', expectedVerdict: 'online-verification-required' },
  { id: 'future issuedAt', expectedVerdict: 'online-verification-required' },
  { id: 'trusted-clock rollback', expectedVerdict: 'online-verification-required' },
] as const satisfies ReadonlyArray<{
  id: string;
  expectedVerdict: OfflineEntitlementExpectedVerdict;
}>;

const expectedOfflineEntitlementRed = (
  id: string,
  expectedVerdict: OfflineEntitlementExpectedVerdict,
): never => {
  throw new Error(
    `EXPECTED_RED[${OFFLINE_ENTITLEMENT_RED_OWNER}][${id}]: exact-byte verifier must return ${expectedVerdict}`,
  );
};

describe('offline-entitlement exact-byte pre-implementation corpus', () => {
  it.each(offlineEntitlementCorpus)('$id', ({ id, expectedVerdict }) => {
    expect(controlPlaneDocumentValidator(canonicalEnvelope)).toBe(true);
    expectedOfflineEntitlementRed(id, expectedVerdict);
  });
});
