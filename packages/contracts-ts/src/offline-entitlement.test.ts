import { createHash, createPrivateKey, createPublicKey, sign } from 'node:crypto';
import { readFileSync } from 'node:fs';

import { describe, expect, it } from 'vitest';

import invalidFixture from './fixtures/offline-entitlement/invalid.json' with { type: 'json' };
import manifest from './fixtures/offline-entitlement/manifest.json' with { type: 'json' };
import validFixture from './fixtures/offline-entitlement/valid.json' with { type: 'json' };
import { controlPlaneDocumentValidator } from './generated/index.js';
import {
  decodeOfflineEntitlementPayload,
  OfflineEntitlementVerdict,
  encodeOfflineEntitlementPayload,
  type OfflineEntitlementSigningKey,
  type TrustedTimeStore,
  verifyOfflineEntitlementBytes,
} from './offline-entitlement.js';

type OfflineEntitlementExpectedVerdict = 'verified' | 'online-verification-required';

interface OfflineEntitlementFixture {
  id: string;
  expectedVerdict: OfflineEntitlementExpectedVerdict;
  signedBy: keyof typeof SIGNING_SEEDS;
  signaturePayload: 'self' | 'canonical';
  nowUnixSeconds: number;
  lastTrustedUnixSeconds: number;
  context: {
    accountId: string;
    deviceBinding: string;
    audience: string;
    entitlementVersion: number;
  };
  envelope: {
    payloadBytes: string;
    signature: string;
  };
}

const SIGNING_SEEDS = {
  'development-current-0001': '9d61b19deffd5a60ba844af492ec2cc44449c5697b326919703bac031cae7f60',
  'development-previous-0001': '4ccd089b28ff96da9db6c346ec114e0f5b8a319f35aba624da8cf6ed4fb8a6fb',
  'development-retired-0001': '000102030405060708090a0b0c0d0e0f101112131415161718191a1b1c1d1e1f',
} as const;

const offlineEntitlementCorpus = [validFixture, ...invalidFixture] as OfflineEntitlementFixture[];
const fixtureRoot = new URL('./fixtures/offline-entitlement/', import.meta.url);
const keyRing = manifest.keyRing.map((key): OfflineEntitlementSigningKey => ({
  keyId: key.keyId,
  publicKeyBytes: key.publicKeyBytes,
  status: key.status as OfflineEntitlementSigningKey['status'],
  notBeforeUnixSeconds: key.notBeforeUnixSeconds,
  notAfterUnixSeconds: key.notAfterUnixSeconds,
}));

class MemoryTrustedTimeStore implements TrustedTimeStore {
  public constructor(private lastTrustedUnixSeconds: number | undefined) {}

  public readLastTrustedUnixSeconds(): number | undefined {
    return this.lastTrustedUnixSeconds;
  }

  public writeLastTrustedUnixSeconds(value: number): void {
    this.lastTrustedUnixSeconds = value;
  }
}

const sha256Fixture = (fileName: string): string =>
  createHash('sha256')
    .update(readFileSync(new URL(fileName, fixtureRoot)))
    .digest('hex');

const signFixturePayload = (fixture: OfflineEntitlementFixture): string => {
  const seed = Buffer.from(SIGNING_SEEDS[fixture.signedBy], 'hex');
  const privateKey = createPrivateKey({
    key: Buffer.concat([Buffer.from('302e020100300506032b657004220420', 'hex'), seed]),
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

const fixturePublicKey = (fixture: OfflineEntitlementFixture): string => {
  const privateKey = createPrivateKey({
    key: Buffer.concat([
      Buffer.from('302e020100300506032b657004220420', 'hex'),
      Buffer.from(SIGNING_SEEDS[fixture.signedBy], 'hex'),
    ]),
    format: 'der',
    type: 'pkcs8',
  });
  const spki = createPublicKey(privateKey).export({ format: 'der', type: 'spki' });
  return spki.subarray(-32).toString('base64url');
};

const assertCorpusIntegrity = (): void => {
  expect(manifest.totalCases).toBe(14);
  expect(offlineEntitlementCorpus).toHaveLength(14);
  expect(sha256Fixture('valid.json')).toBe(manifest.files['valid.json']);
  expect(sha256Fixture('invalid.json')).toBe(manifest.files['invalid.json']);
  expect(new Set(offlineEntitlementCorpus.map(({ id }) => id)).size).toBe(14);
};

describe('offline-entitlement exact-byte cross-runtime corpus', () => {
  it.each(offlineEntitlementCorpus)('$id', (fixture) => {
    const trustedTimeStore = new MemoryTrustedTimeStore(fixture.lastTrustedUnixSeconds);

    assertCorpusIntegrity();
    expect(controlPlaneDocumentValidator(validFixture.envelope)).toBe(true);
    expect(signFixturePayload(fixture)).toBe(fixture.envelope.signature);
    expect(fixturePublicKey(fixture)).toBe(
      keyRing.find(({ keyId }) => keyId === fixture.signedBy)?.publicKeyBytes,
    );
    expect(
      verifyOfflineEntitlementBytes(
        fixture.envelope,
        keyRing,
        { ...fixture.context, nowUnixSeconds: fixture.nowUnixSeconds },
        trustedTimeStore,
      ),
    ).toBe(fixture.expectedVerdict);

    if (fixture.expectedVerdict === OfflineEntitlementVerdict.Verified) {
      expect(trustedTimeStore.readLastTrustedUnixSeconds()).toBe(fixture.nowUnixSeconds);
    } else {
      expect(trustedTimeStore.readLastTrustedUnixSeconds()).toBe(fixture.lastTrustedUnixSeconds);
    }

    if (fixture.id === 'previous key outside declared rotation window') {
      const previousKey = keyRing.find(({ status }) => status === 'previous');
      expect(previousKey).toBeDefined();
      const insideWindowStore = new MemoryTrustedTimeStore(fixture.lastTrustedUnixSeconds - 86_400);
      expect(
        verifyOfflineEntitlementBytes(
          fixture.envelope,
          keyRing,
          {
            ...fixture.context,
            nowUnixSeconds: previousKey?.notAfterUnixSeconds ?? Number.NaN,
          },
          insideWindowStore,
        ),
      ).toBe(OfflineEntitlementVerdict.Verified);
    }

    if (fixture.id === 'canonical exact bytes through issuedAt plus seven days') {
      const canonicalClaims = decodeOfflineEntitlementPayload(
        Buffer.from(fixture.envelope.payloadBytes, 'base64url'),
      );
      expect(canonicalClaims).toBeDefined();
      if (canonicalClaims === undefined) {
        throw new Error('Canonical offline entitlement claims must decode');
      }
      expect(encodeOfflineEntitlementPayload(canonicalClaims).toString('base64url')).toBe(
        fixture.envelope.payloadBytes,
      );
      const versionMismatchStore = new MemoryTrustedTimeStore(fixture.lastTrustedUnixSeconds);
      expect(
        verifyOfflineEntitlementBytes(
          fixture.envelope,
          keyRing,
          {
            ...fixture.context,
            entitlementVersion: fixture.context.entitlementVersion + 1,
            nowUnixSeconds: fixture.nowUnixSeconds,
          },
          versionMismatchStore,
        ),
      ).toBe(OfflineEntitlementVerdict.OnlineVerificationRequired);
    }
  });
});
