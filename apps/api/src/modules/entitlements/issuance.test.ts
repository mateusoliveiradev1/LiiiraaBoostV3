import {
  createPrivateKey,
  createPublicKey,
  verify as verifySignature,
  type KeyObject,
} from 'node:crypto';
import { readFileSync } from 'node:fs';

import {
  OfflineEntitlementVerdict,
  verifyOfflineEntitlementBytes,
  type OfflineEntitlementEnvelopeJson,
  type OfflineEntitlementSigningKey,
  type OfflineEntitlementSignatureVerifier,
  type TrustedTimeStore,
} from '@liiiraa/contracts-ts';
import {
  issueOfflineEntitlement,
  revokeOfflineEntitlement,
  type EntitlementAuthorityRepository,
  type EntitlementAuthorityTransaction,
  type EntitlementDeviceRecord,
  type EntitlementRecord,
  type EntitlementSubscriptionRecord,
  type OfflineEntitlementCommandResult,
} from '@liiiraa/control-plane-application';
import { createStagingEntitlementSigner } from '@liiiraa/control-plane-adapters';
import Fastify from 'fastify';
import { describe, expect, it } from 'vitest';

import { registerEntitlementRoutes } from './routes.js';

interface EntitlementCorpusManifest {
  readonly keyRing: readonly (OfflineEntitlementSigningKey & {
    readonly notBefore: string;
    readonly notAfter: string;
  })[];
}

interface ValidEntitlementFixture {
  readonly context: {
    readonly accountId: string;
    readonly deviceBinding: string;
    readonly audience: string;
    readonly entitlementVersion: number;
  };
  readonly envelope: OfflineEntitlementEnvelopeJson;
  readonly nowUnixSeconds: number;
  readonly lastTrustedUnixSeconds: number;
}

const corpusRoot = new URL(
  '../../../../../packages/contracts-ts/src/fixtures/offline-entitlement/',
  import.meta.url,
);
const readCorpusJson = <T>(fileName: string): T =>
  JSON.parse(readFileSync(new URL(fileName, corpusRoot), 'utf8')) as T;
const manifest = readCorpusJson<EntitlementCorpusManifest>('manifest.json');
const validFixture = readCorpusJson<ValidEntitlementFixture>('valid.json');

const ACCOUNT_ID = 'synthetic-account-0001';
const DEVICE_BINDING = 'synthetic-device-binding';
const AUDIENCE = 'liiiraa-desktop';
const ISSUED_AT = '2026-08-04T12:00:00.000Z';
const RENEWED_AT = '2026-08-05T12:00:00.000Z';
const CURRENT_KEY_SEED = '9d61b19deffd5a60ba844af492ec2cc44449c5697b326919703bac031cae7f60';
const NEXT_KEY_SEED = '4ccd089b28ff96da9db6c346ec114e0f5b8a319f35aba624da8cf6ed4fb8a6fb';

const privateKeyHandle = (seed: string): KeyObject =>
  createPrivateKey({
    key: Buffer.concat([
      Buffer.from('302e020100300506032b657004220420', 'hex'),
      Buffer.from(seed, 'hex'),
    ]),
    format: 'der',
    type: 'pkcs8',
  });

const signingKey = (keyId = 'development-current-0001', seed = CURRENT_KEY_SEED) =>
  createStagingEntitlementSigner({
    keyId,
    privateKeyHandle: privateKeyHandle(seed),
    notBeforeUnixSeconds: 1_782_864_000,
    notAfterUnixSeconds: 1_798_761_600,
  });

class MemoryTrustedTimeStore implements TrustedTimeStore {
  public constructor(private value: number | undefined) {}

  public readLastTrustedUnixSeconds(): number | undefined {
    return this.value;
  }

  public writeLastTrustedUnixSeconds(value: number): void {
    this.value = value;
  }
}

const ED25519_SPKI_PREFIX = Buffer.from('302a300506032b6570032100', 'hex');
const verifyEd25519Signature: OfflineEntitlementSignatureVerifier = ({
  payloadBytes,
  signatureBytes,
  publicKeyBytes,
}) =>
  verifySignature(
    null,
    Buffer.from(payloadBytes),
    createPublicKey({
      key: Buffer.concat([ED25519_SPKI_PREFIX, Buffer.from(publicKeyBytes)]),
      format: 'der',
      type: 'spki',
    }),
    Buffer.from(signatureBytes),
  );

class MemoryEntitlementRepository implements EntitlementAuthorityRepository {
  public subscription: EntitlementSubscriptionRecord = {
    accountId: ACCOUNT_ID,
    subscriptionId: 'subscription-1',
    status: 'active',
    checkoutStatus: 'reconciled',
    allowNewPremiumActions: true,
    version: 4n,
  };

  public entitlement: EntitlementRecord = {
    entitlementId: 'entitlement-1',
    accountId: ACCOUNT_ID,
    subscriptionId: 'subscription-1',
    status: 'active',
    allowNewPremiumActions: true,
    version: 6n,
    offlineValidUntil: null,
    signingKeyId: null,
  };

  public device: EntitlementDeviceRecord = {
    bindingId: DEVICE_BINDING,
    entitlementId: 'entitlement-1',
    accountId: ACCOUNT_ID,
    state: 'active',
    version: 3n,
    revokedAt: null,
  };

  public readonly audits: unknown[] = [];
  public readonly outbox: unknown[] = [];
  public readonly commandResults = new Map<string, OfflineEntitlementCommandResult>();
  private serial = Promise.resolve();

  public async transaction<T>(
    accountId: string,
    operation: (transaction: EntitlementAuthorityTransaction) => Promise<T>,
  ): Promise<T> {
    let release!: () => void;
    const previous = this.serial;
    this.serial = new Promise<void>((resolve) => {
      release = resolve;
    });
    await previous;
    const staged = {
      subscription: { ...this.subscription },
      entitlement: { ...this.entitlement },
      device: { ...this.device },
      audits: [...this.audits],
      outbox: [...this.outbox],
      commandResults: new Map(this.commandResults),
    };
    const transaction: EntitlementAuthorityTransaction = {
      findCommandResult: (commandId) =>
        Promise.resolve(staged.commandResults.get(commandId) ?? null),
      lockSubscription: (requestedAccountId) =>
        Promise.resolve(
          requestedAccountId === accountId && staged.subscription.accountId === requestedAccountId
            ? staged.subscription
            : null,
        ),
      lockEntitlement: (requestedAccountId) =>
        Promise.resolve(
          requestedAccountId === accountId && staged.entitlement.accountId === requestedAccountId
            ? staged.entitlement
            : null,
        ),
      lockActiveDevice: (entitlementId) =>
        Promise.resolve(
          staged.device.entitlementId === entitlementId && staged.device.state !== 'revoked'
            ? staged.device
            : null,
        ),
      persistIssuance: (input) => {
        if (staged.entitlement.version !== input.expectedEntitlementVersion) {
          throw new Error('synthetic-stale-entitlement-write');
        }
        staged.entitlement = {
          ...staged.entitlement,
          version: input.nextEntitlementVersion,
          offlineValidUntil: input.expiresAt,
          signingKeyId: input.keyId,
        };
        return Promise.resolve();
      },
      revokeEntitlement: (input) => {
        if (staged.entitlement.version !== input.expectedEntitlementVersion) {
          throw new Error('synthetic-stale-entitlement-revoke');
        }
        staged.entitlement = {
          ...staged.entitlement,
          status: 'revoked',
          allowNewPremiumActions: false,
          version: input.nextEntitlementVersion,
          offlineValidUntil: null,
        };
        return Promise.resolve();
      },
      revokeDevice: (bindingId, expectedVersion, revokedAt) => {
        if (staged.device.bindingId !== bindingId || staged.device.version !== expectedVersion) {
          throw new Error('synthetic-stale-device-revoke');
        }
        staged.device = {
          ...staged.device,
          state: 'revoked',
          revokedAt,
          version: staged.device.version + 1n,
        };
        return Promise.resolve();
      },
      appendAudit: (record) => Promise.resolve(void staged.audits.push(record)),
      enqueueOutbox: (record) => Promise.resolve(void staged.outbox.push(record)),
      rememberCommandResult: (commandId, result) => {
        staged.commandResults.set(commandId, result);
        return Promise.resolve();
      },
    };
    try {
      const result = await operation(transaction);
      this.subscription = staged.subscription;
      this.entitlement = staged.entitlement;
      this.device = staged.device;
      this.audits.splice(0, this.audits.length, ...staged.audits);
      this.outbox.splice(0, this.outbox.length, ...staged.outbox);
      this.commandResults.clear();
      staged.commandResults.forEach((value, key) => this.commandResults.set(key, value));
      return result;
    } finally {
      release();
    }
  }
}

const issueInput = (commandId = 'issue-1') => ({
  operation: 'issue' as const,
  commandId,
  actorAccountId: ACCOUNT_ID,
  accountId: ACCOUNT_ID,
  deviceBinding: DEVICE_BINDING,
  audience: AUDIENCE,
  expectedEntitlementVersion: 6n,
  expectedDeviceVersion: 3n,
  correlationId: commandId,
});

const dependencies = (
  repository: MemoryEntitlementRepository,
  now = ISSUED_AT,
  signer = signingKey(),
) => ({
  repository,
  signer,
  authorizer: {
    authorize: ({ actorAccountId, accountId }: { actorAccountId: string; accountId: string }) =>
      Promise.resolve(actorAccountId === accountId),
  },
  clock: { now: () => new Date(now) },
  ids: {
    next: (() => {
      let value = 0;
      return () => `entitlement-evidence-${String(++value)}`;
    })(),
  },
});

const verifiedEnvelope = (result: OfflineEntitlementCommandResult) => {
  expect(result.ok).toBe(true);
  if (!result.ok || result.outcome === 'revoked') throw new Error('issued-envelope-required');
  return result.envelope;
};

describe('entitlement-issuance exact-byte authority', () => {
  it('issues the exact Rust-corpus seven-day envelope from reconciled Premium and the active device', async () => {
    const repository = new MemoryEntitlementRepository();
    const result = await issueOfflineEntitlement(dependencies(repository), issueInput());
    const envelope = verifiedEnvelope(result);

    expect(envelope).toEqual(validFixture.envelope);
    expect(Date.parse(envelope.expiresAt) - Date.parse(envelope.issuedAt)).toBe(604_800_000);
    const keyRing = manifest.keyRing.map((key): OfflineEntitlementSigningKey => ({
      keyId: key.keyId,
      publicKeyBytes: key.publicKeyBytes,
      status: key.status as OfflineEntitlementSigningKey['status'],
      notBeforeUnixSeconds: key.notBeforeUnixSeconds,
      notAfterUnixSeconds: key.notAfterUnixSeconds,
    }));
    expect(
      verifyOfflineEntitlementBytes(
        envelope,
        keyRing,
        { ...validFixture.context, nowUnixSeconds: validFixture.nowUnixSeconds },
        new MemoryTrustedTimeStore(validFixture.lastTrustedUnixSeconds),
        verifyEd25519Signature,
      ),
    ).toBe(OfflineEntitlementVerdict.Verified);
    expect(repository.entitlement).toMatchObject({
      version: 7n,
      offlineValidUntil: validFixture.envelope.expiresAt,
      signingKeyId: validFixture.envelope.keyId,
    });
    expect(repository.audits).toHaveLength(1);
    expect(repository.outbox).toHaveLength(1);
  });

  it.each([
    ['pending checkout', { subscription: { checkoutStatus: 'pending' } }],
    ['expired subscription', { subscription: { status: 'expired' } }],
    ['disputed subscription', { subscription: { status: 'disputed' } }],
    ['revoked entitlement', { entitlement: { status: 'revoked' } }],
    ['revalidating device', { device: { state: 'revalidating' } }],
  ] as const)('returns no authority for %s', async (_label, mutation) => {
    const repository = new MemoryEntitlementRepository();
    if ('subscription' in mutation) {
      repository.subscription = { ...repository.subscription, ...mutation.subscription };
    }
    if ('entitlement' in mutation) {
      repository.entitlement = { ...repository.entitlement, ...mutation.entitlement };
    }
    if ('device' in mutation) {
      repository.device = { ...repository.device, ...mutation.device };
    }

    const result = await issueOfflineEntitlement(dependencies(repository), issueInput());

    expect(result).toMatchObject({ ok: false, code: 'AUTHORITY_DENIED' });
    expect(result).not.toHaveProperty('envelope');
    expect(repository.audits).toHaveLength(0);
    expect(repository.outbox).toHaveLength(0);
  });

  it('rejects wrong-device, stale-version, and custody failures without authority or partial writes', async () => {
    const wrongDeviceRepository = new MemoryEntitlementRepository();
    const wrongDevice = await issueOfflineEntitlement(dependencies(wrongDeviceRepository), {
      ...issueInput('wrong-device'),
      deviceBinding: 'different-device',
    });
    expect(wrongDevice).toMatchObject({ ok: false, code: 'AUTHORITY_DENIED' });

    const staleRepository = new MemoryEntitlementRepository();
    const stale = await issueOfflineEntitlement(dependencies(staleRepository), {
      ...issueInput('stale'),
      expectedEntitlementVersion: 5n,
    });
    expect(stale).toMatchObject({ ok: false, code: 'STALE' });

    const custodyRepository = new MemoryEntitlementRepository();
    const custodyFailure = await issueOfflineEntitlement(
      dependencies(custodyRepository, ISSUED_AT, {
        sign: () => Promise.reject(new Error('synthetic-custody-unavailable')),
        publicVerificationData: () => Promise.resolve([]),
      }),
      issueInput('custody-failure'),
    );
    expect(custodyFailure).toMatchObject({ ok: false, code: 'SIGNING_UNAVAILABLE' });
    expect(custodyFailure).not.toHaveProperty('envelope');
    expect(custodyRepository.entitlement.version).toBe(6n);
    expect(custodyRepository.audits).toHaveLength(0);
    expect(custodyRepository.outbox).toHaveLength(0);

    const outOfWindowRepository = new MemoryEntitlementRepository();
    const outOfWindow = await issueOfflineEntitlement(
      dependencies(
        outOfWindowRepository,
        ISSUED_AT,
        createStagingEntitlementSigner({
          keyId: 'future-key',
          privateKeyHandle: privateKeyHandle(NEXT_KEY_SEED),
          notBeforeUnixSeconds: validFixture.nowUnixSeconds,
          notAfterUnixSeconds: validFixture.nowUnixSeconds + 86_400,
        }),
      ),
      issueInput('future-key'),
    );
    expect(outOfWindow).toMatchObject({ ok: false, code: 'SIGNING_UNAVAILABLE' });
    expect(outOfWindow).not.toHaveProperty('envelope');
    expect(outOfWindowRepository.entitlement.version).toBe(6n);
  });

  it('renews idempotently and advances issuedAt, entitlement version, and signing key', async () => {
    const repository = new MemoryEntitlementRepository();
    const first = await issueOfflineEntitlement(dependencies(repository), issueInput());
    const repeated = await issueOfflineEntitlement(dependencies(repository), issueInput());
    expect(repeated).toEqual(first);
    expect(repository.audits).toHaveLength(1);
    expect(repository.outbox).toHaveLength(1);

    const rotatedSigner = signingKey('development-current-0002', NEXT_KEY_SEED);
    const renewed = await issueOfflineEntitlement(
      dependencies(repository, RENEWED_AT, rotatedSigner),
      {
        ...issueInput('renew-1'),
        operation: 'renew',
        expectedEntitlementVersion: 7n,
      },
    );
    const envelope = verifiedEnvelope(renewed);
    expect(envelope).toMatchObject({
      keyId: 'development-current-0002',
      issuedAt: RENEWED_AT,
      expiresAt: '2026-08-12T12:00:00.000Z',
    });
    expect(
      JSON.parse(Buffer.from(envelope.payloadBytes, 'base64url').toString('utf8')),
    ).toMatchObject({
      entitlementVersion: 8,
      issuedAt: RENEWED_AT,
    });
    expect(repository.entitlement.version).toBe(8n);
    expect(repository.audits).toHaveLength(2);
    expect(repository.outbox).toHaveLength(2);
  });

  it('revokes entitlement and device atomically so the next online renewal fails closed', async () => {
    const repository = new MemoryEntitlementRepository();
    await issueOfflineEntitlement(dependencies(repository), issueInput());
    const revoked = await revokeOfflineEntitlement(dependencies(repository, RENEWED_AT), {
      commandId: 'revoke-1',
      actorAccountId: ACCOUNT_ID,
      accountId: ACCOUNT_ID,
      deviceBinding: DEVICE_BINDING,
      expectedEntitlementVersion: 7n,
      expectedDeviceVersion: 3n,
      correlationId: 'revoke-1',
      reason: 'customer-request',
    });
    expect(revoked).toMatchObject({ ok: true, outcome: 'revoked', aggregateVersion: '8' });
    expect(repository.entitlement).toMatchObject({
      status: 'revoked',
      allowNewPremiumActions: false,
      version: 8n,
      offlineValidUntil: null,
    });
    expect(repository.device).toMatchObject({ state: 'revoked', version: 4n });

    const renewal = await issueOfflineEntitlement(dependencies(repository, RENEWED_AT), {
      ...issueInput('renew-after-revoke'),
      operation: 'renew',
      expectedEntitlementVersion: 8n,
      expectedDeviceVersion: 4n,
    });
    expect(renewal).toMatchObject({ ok: false, code: 'AUTHORITY_DENIED' });
    expect(renewal).not.toHaveProperty('envelope');
    expect(repository.audits).toHaveLength(2);
    expect(repository.outbox).toHaveLength(2);
  });

  it('keeps private key bytes outside signer results, DTOs, records, and public verification data', async () => {
    const repository = new MemoryEntitlementRepository();
    const signer = signingKey();
    const result = await issueOfflineEntitlement(
      dependencies(repository, ISSUED_AT, signer),
      issueInput(),
    );
    const publicData = await signer.publicVerificationData();
    const manifestCurrentKey = manifest.keyRing[0];
    if (manifestCurrentKey === undefined) throw new Error('current-corpus-key-required');
    const serialized = JSON.stringify({ result, publicData, repository }, (_key, value: unknown) =>
      typeof value === 'bigint' ? value.toString() : value,
    );

    expect(publicData).toEqual([manifestCurrentKey]);
    expect(serialized).not.toContain(CURRENT_KEY_SEED);
    expect(serialized).not.toMatch(/privateKey|private-key|pkcs8/iu);

    const rotated = createStagingEntitlementSigner({
      keyId: 'development-current-0002',
      privateKeyHandle: privateKeyHandle(NEXT_KEY_SEED),
      notBeforeUnixSeconds: 1_782_864_000,
      notAfterUnixSeconds: 1_798_761_600,
      additionalVerificationKeys: [
        {
          ...manifestCurrentKey,
          status: 'previous',
          notAfter: '2026-08-11T12:00:00.000Z',
          notAfterUnixSeconds: validFixture.nowUnixSeconds,
        },
      ],
    });
    expect(await rotated.publicVerificationData()).toMatchObject([
      { keyId: 'development-current-0002', status: 'current' },
      { keyId: 'development-current-0001', status: 'previous' },
    ]);
  });
});

describe('entitlement-issuance generated envelope routes', () => {
  it('exposes authenticated issue, renewal, revocation, and version projection routes', async () => {
    const repository = new MemoryEntitlementRepository();
    const app = Fastify();
    await registerEntitlementRoutes(app, {
      authority: dependencies(repository),
      resolveSessionActor: () => Promise.resolve({ accountId: ACCOUNT_ID }),
      projectVersion: () =>
        Promise.resolve({
          accountId: ACCOUNT_ID,
          entitlementVersion: repository.entitlement.version.toString(),
          deviceVersion: repository.device.version.toString(),
          revoked: repository.entitlement.status === 'revoked',
        }),
    });

    const body = {
      commandId: 'route-issue',
      accountId: ACCOUNT_ID,
      deviceBinding: DEVICE_BINDING,
      audience: AUDIENCE,
      expectedEntitlementVersion: '6',
      expectedDeviceVersion: '3',
      correlationId: 'route-issue',
    };
    const issued = await app.inject({
      method: 'POST',
      url: '/v1/entitlements/offline/issue',
      payload: body,
    });
    expect(issued.statusCode).toBe(200);
    expect(issued.json()).toMatchObject({
      kind: 'offline-entitlement-envelope',
      validitySeconds: 604800,
    });

    const version = await app.inject({ method: 'GET', url: '/v1/entitlements/offline/version' });
    expect(version.statusCode).toBe(200);
    expect(version.json()).toMatchObject({
      entitlementVersion: '7',
      deviceVersion: '3',
      revoked: false,
    });

    const renewed = await app.inject({
      method: 'POST',
      url: '/v1/entitlements/offline/renew',
      payload: { ...body, commandId: 'route-renew', expectedEntitlementVersion: '7' },
    });
    expect(renewed.statusCode).toBe(200);

    const revoked = await app.inject({
      method: 'POST',
      url: '/v1/entitlements/offline/revoke',
      payload: {
        ...body,
        commandId: 'route-revoke',
        expectedEntitlementVersion: '8',
        reason: 'customer-request',
      },
    });
    expect(revoked.statusCode).toBe(200);
    expect(revoked.json()).toMatchObject({ ok: true, outcome: 'revoked', aggregateVersion: '9' });
    await app.close();
  });

  it('returns 401 before processing an unauthenticated issuance request', async () => {
    const repository = new MemoryEntitlementRepository();
    const app = Fastify();
    await registerEntitlementRoutes(app, {
      authority: dependencies(repository),
      resolveSessionActor: () => Promise.resolve(null),
      projectVersion: () => Promise.resolve(null),
    });
    const response = await app.inject({
      method: 'POST',
      url: '/v1/entitlements/offline/issue',
      payload: {
        commandId: 'unauthenticated',
        accountId: ACCOUNT_ID,
        deviceBinding: DEVICE_BINDING,
        audience: AUDIENCE,
        expectedEntitlementVersion: '6',
        expectedDeviceVersion: '3',
        correlationId: 'unauthenticated',
      },
    });
    expect(response.statusCode).toBe(401);
    expect(repository.entitlement.version).toBe(6n);
    await app.close();
  });
});
