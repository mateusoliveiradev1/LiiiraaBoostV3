import { createHash, createPrivateKey, sign } from 'node:crypto';
import { readFileSync } from 'node:fs';

import { describe, expect, it } from 'vitest';

import invalidFixture from './fixtures/offline-entitlement/invalid.json' with { type: 'json' };
import manifest from './fixtures/offline-entitlement/manifest.json' with { type: 'json' };
import validFixture from './fixtures/offline-entitlement/valid.json' with { type: 'json' };
import { controlPlaneDocumentValidator } from './generated/index.js';

const OFFLINE_ENTITLEMENT_RED_OWNER = '04-07-01';

type OfflineEntitlementExpectedVerdict = 'verified' | 'online-verification-required';

interface OfflineEntitlementFixture {
  id: string;
  expectedVerdict: OfflineEntitlementExpectedVerdict;
  signedBy: keyof typeof SIGNING_SEEDS;
  signaturePayload: 'self' | 'canonical';
  envelope: {
    payloadBytes: string;
    signature: string;
  };
}

const SIGNING_SEEDS = {
  'development-current-0001':
    '9d61b19deffd5a60ba844af492ec2cc44449c5697b326919703bac031cae7f60',
  'development-previous-0001':
    '4ccd089b28ff96da9db6c346ec114e0f5b8a319f35aba624da8cf6ed4fb8a6fb',
  'development-retired-0001':
    '000102030405060708090a0b0c0d0e0f101112131415161718191a1b1c1d1e1f',
} as const;

const offlineEntitlementCorpus = [validFixture, ...invalidFixture] as OfflineEntitlementFixture[];
const fixtureRoot = new URL('./fixtures/offline-entitlement/', import.meta.url);

const sha256Fixture = (fileName: string): string =>
  createHash('sha256').update(readFileSync(new URL(fileName, fixtureRoot))).digest('hex');

const signFixturePayload = (fixture: OfflineEntitlementFixture): string => {
  const seed = Buffer.from(SIGNING_SEEDS[fixture.signedBy], 'hex');
  const privateKey = createPrivateKey({
    key: Buffer.concat([
      Buffer.from('302e020100300506032b657004220420', 'hex'),
      seed,
    ]),
    format: 'der',
    type: 'pkcs8',
  });
  const payloadBytes = Buffer.from(
    fixture.signaturePayload === 'canonical'
      ? validFixture.envelope.payloadBytes
      : fixture.envelope.payloadBytes,
    'base64',
  );

  return sign(null, payloadBytes, privateKey).toString('base64url');
};

const assertCorpusIntegrity = (): void => {
  expect(manifest.totalCases).toBe(14);
  expect(offlineEntitlementCorpus).toHaveLength(14);
  expect(sha256Fixture('valid.json')).toBe(manifest.files['valid.json']);
  expect(sha256Fixture('invalid.json')).toBe(manifest.files['invalid.json']);
  expect(new Set(offlineEntitlementCorpus.map(({ id }) => id)).size).toBe(14);
};

const expectedOfflineEntitlementRed = (
  id: string,
  expectedVerdict: OfflineEntitlementExpectedVerdict,
): never => {
  throw new Error(
    `EXPECTED_RED[${OFFLINE_ENTITLEMENT_RED_OWNER}][${id}]: exact-byte verifier must return ${expectedVerdict}`,
  );
};

describe('offline-entitlement exact-byte pre-implementation corpus', () => {
  it.each(offlineEntitlementCorpus)('$id', (fixture) => {
    const { id, expectedVerdict } = fixture;

    assertCorpusIntegrity();
    expect(controlPlaneDocumentValidator(validFixture.envelope)).toBe(true);
    expect(signFixturePayload(fixture)).toBe(fixture.envelope.signature);
    expectedOfflineEntitlementRed(id, expectedVerdict);
  });
});
