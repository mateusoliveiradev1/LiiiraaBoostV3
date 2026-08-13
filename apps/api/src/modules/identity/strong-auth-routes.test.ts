import { createHmac } from 'node:crypto';

import type { IdentityActor } from '@liiiraa/control-plane-adapters';
import Fastify from 'fastify';
import { describe, expect, it } from 'vitest';

import {
  createStagingStrongAuth,
  type StagingStrongAuthRepository,
  type StoredStrongFactor,
  type StoredStepUpReceipt,
} from '../../staging/strong-auth.js';
import { registerStrongAuthRoutes } from './strong-auth-routes.js';

const STARTED_AT = '2030-01-15T12:00:00.000Z';
const SECRET = 'plan-proof-strong-auth-secret-with-more-than-forty-three-characters';
const CSRF_SECRET = 'plan-proof-csrf-secret';
const ORIGIN = 'https://account.liiiraa.test';

const baseActor: IdentityActor = {
  accountId: '00000000-0000-4000-8000-000000000001',
  displayName: 'Owner',
  email: 'owner@example.com',
  locale: 'pt-BR',
  role: 'security',
  sessionId: '00000000-0000-4000-8000-000000000002',
  sessionKind: 'web',
  authenticationMethod: 'password',
  authenticatedAt: STARTED_AT,
  expiresAt: '2030-02-15T12:00:00.000Z',
  lastSeenAt: STARTED_AT,
  sessionVersion: 1n,
  identityVersion: 1n,
  createdAt: STARTED_AT,
  updatedAt: STARTED_AT,
};

const alphabet = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ234567';
const decodeBase32 = (value: string): Buffer => {
  let bits = '';
  for (const character of value) bits += alphabet.indexOf(character).toString(2).padStart(5, '0');
  const bytes: number[] = [];
  for (let offset = 0; offset + 8 <= bits.length; offset += 8)
    bytes.push(Number.parseInt(bits.slice(offset, offset + 8), 2));
  return Buffer.from(bytes);
};

const totp = (secret: string, at: string): string => {
  const counter = Math.floor(Date.parse(at) / 30_000);
  const message = Buffer.alloc(8);
  message.writeBigUInt64BE(BigInt(counter));
  const signature = createHmac('sha1', decodeBase32(secret)).update(message).digest();
  const offset = signature.at(-1)! & 0x0f;
  return String((signature.readUInt32BE(offset) & 0x7fff_ffff) % 1_000_000).padStart(6, '0');
};

class MemoryStrongAuthRepository implements StagingStrongAuthRepository {
  factor: StoredStrongFactor | null = null;
  receipts: StoredStepUpReceipt[] = [];

  loadTotpFactor(accountId: string): Promise<StoredStrongFactor | null> {
    return Promise.resolve(this.factor?.accountId === accountId ? this.factor : null);
  }

  storeTotpFactor(record: StoredStrongFactor): Promise<void> {
    this.factor = record;
    return Promise.resolve();
  }

  useTotpFactor(factorId: string, counterStartedAt: string, usedAt: string): Promise<boolean> {
    if (
      this.factor?.factorId !== factorId ||
      (this.factor.lastUsedAt !== null &&
        Date.parse(this.factor.lastUsedAt) >= Date.parse(counterStartedAt))
    )
      return Promise.resolve(false);
    this.factor = { ...this.factor, lastUsedAt: usedAt };
    return Promise.resolve(true);
  }

  storeStepUpReceipt(record: StoredStepUpReceipt): Promise<void> {
    this.receipts.push(record);
    return Promise.resolve();
  }

  consumeStepUpReceipt(input: {
    accountId: string;
    action: string;
    authorizationContextId: string;
    receiptDigest: string;
    redactedTarget: string;
    resource: string;
    sessionId: string;
    usedAt: string;
  }): Promise<StoredStepUpReceipt | null> {
    const index = this.receipts.findIndex(
      (receipt) =>
        receipt.usedAt === null &&
        receipt.receiptDigest === input.receiptDigest &&
        receipt.accountId === input.accountId &&
        receipt.sessionId === input.sessionId &&
        receipt.action === input.action &&
        receipt.resource === input.resource &&
        receipt.redactedTarget === input.redactedTarget &&
        receipt.authorizationContextId === input.authorizationContextId &&
        Date.parse(receipt.expiresAt) > Date.parse(input.usedAt),
    );
    if (index < 0) return Promise.resolve(null);
    const consumed = { ...this.receipts[index]!, usedAt: input.usedAt };
    this.receipts[index] = consumed;
    return Promise.resolve(consumed);
  }

  provisionStagingAdministrator(): Promise<void> {
    return Promise.resolve();
  }
}

const csrf = (): string => {
  const nonce = 'plan-proof-csrf-nonce';
  const signature = createHmac('sha256', CSRF_SECRET).update(nonce, 'utf8').digest('base64url');
  return `${nonce}.${signature}`;
};

const applyScope = {
  action: 'apply-transactional-plan',
  authorizationContextId: 'plan-review-0001',
  resource: 'desktop-plan',
  binding: {
    kind: 'transactional-plan',
    deviceId: 'device-0001',
    planFingerprint: 'plan-fingerprint-0001',
    operationVersions: [
      { operationId: 'managed-power-scheme', version: '3' },
      { operationId: 'restore-checkpoint', version: '2' },
    ],
  },
} as const;

const preferenceScope = (action: 'enable-advanced-preference' | 'revoke-advanced-preference') => ({
  action,
  authorizationContextId: 'advanced-preference-review-0001',
  resource: 'desktop-risk-preference',
  binding: {
    kind: 'advanced-preference',
    deviceId: 'device-0001',
    hardwareFingerprint: 'hardware-fingerprint-0001',
    securityPostureFingerprint: 'security-posture-0001',
  },
});

const createHarness = async () => {
  const repository = new MemoryStrongAuthRepository();
  let now = new Date(STARTED_AT);
  let actor = baseActor;
  let id = 10;
  const authority = createStagingStrongAuth({
    clock: { now: () => new Date(now) },
    encryptionSecret: SECRET,
    ids: { next: () => `00000000-0000-4000-8000-${String(id++).padStart(12, '0')}` },
    randomBytes: (size) => Buffer.alloc(size, id),
    repository,
  });
  const enrollment = authority.beginTotpEnrollment(actor);
  await authority.confirmTotpEnrollment(
    actor,
    enrollment.enrollmentToken,
    totp(enrollment.secret, now.toISOString()),
  );
  const app = Fastify();
  await registerStrongAuthRoutes(app, {
    allowedOrigins: [ORIGIN],
    authority,
    csrfSecret: CSRF_SECRET,
    resolveActor: () => Promise.resolve(actor),
  });
  await app.ready();
  return {
    app,
    code: () => totp(enrollment.secret, now.toISOString()),
    moveClock: (milliseconds: number) => {
      now = new Date(now.getTime() + milliseconds);
    },
    setActor: (next: IdentityActor) => {
      actor = next;
    },
  };
};

const post = (
  app: Awaited<ReturnType<typeof createHarness>>['app'],
  path: string,
  body: unknown,
) =>
  app.inject({
    method: 'POST',
    url: path,
    headers: { origin: ORIGIN, 'x-csrf-token': csrf() },
    payload: body,
  });

describe('transactional-plan strong-auth routes', () => {
  it.each([
    ['apply', applyScope],
    ['enable', preferenceScope('enable-advanced-preference')],
    ['revoke', preferenceScope('revoke-advanced-preference')],
  ] as const)('issues and consumes one exact %s proof once', async (_name, scope) => {
    const harness = await createHarness();
    const issued = await post(harness.app, '/v1/identity/strong-auth/step-up', {
      ...scope,
      code: harness.code(),
    });
    expect(issued.statusCode).toBe(200);
    const receipt = issued.json<{ receipt: string }>().receipt;

    const consumed = await post(harness.app, '/v1/identity/strong-auth/plan-proof/consume', {
      ...scope,
      receipt,
    });
    expect(consumed.statusCode).toBe(200);
    expect(consumed.json()).toMatchObject({
      ok: true,
      proof: { action: scope.action, resource: scope.resource },
    });
    expect(JSON.stringify(consumed.json())).not.toContain(receipt);

    const replay = await post(harness.app, '/v1/identity/strong-auth/plan-proof/consume', {
      ...scope,
      receipt,
    });
    expect(replay.statusCode).toBe(422);
    await harness.app.close();
  });

  it('rejects cross-action, device, fingerprint, operation-version, session, and expiry mismatch', async () => {
    const harness = await createHarness();
    const issued = await post(harness.app, '/v1/identity/strong-auth/step-up', {
      ...applyScope,
      code: harness.code(),
    });
    expect(issued.statusCode).toBe(200);
    const receipt = issued.json<{ receipt: string }>().receipt;

    const mismatches = [
      preferenceScope('enable-advanced-preference'),
      { ...applyScope, binding: { ...applyScope.binding, deviceId: 'device-0002' } },
      {
        ...applyScope,
        binding: { ...applyScope.binding, planFingerprint: 'plan-fingerprint-0002' },
      },
      {
        ...applyScope,
        binding: {
          ...applyScope.binding,
          operationVersions: [{ operationId: 'managed-power-scheme', version: '4' }],
        },
      },
    ];
    for (const mismatch of mismatches) {
      const response = await post(harness.app, '/v1/identity/strong-auth/plan-proof/consume', {
        ...mismatch,
        receipt,
      });
      expect(response.statusCode).toBe(422);
    }

    harness.setActor({ ...baseActor, sessionId: '00000000-0000-4000-8000-000000000099' });
    expect(
      (
        await post(harness.app, '/v1/identity/strong-auth/plan-proof/consume', {
          ...applyScope,
          receipt,
        })
      ).statusCode,
    ).toBe(422);
    harness.setActor(baseActor);
    harness.moveClock(5 * 60_000 + 1);
    expect(
      (
        await post(harness.app, '/v1/identity/strong-auth/plan-proof/consume', {
          ...applyScope,
          receipt,
        })
      ).statusCode,
    ).toBe(422);
    await harness.app.close();
  });

  it('admits exactly one of two concurrent consumers', async () => {
    const harness = await createHarness();
    const issued = await post(harness.app, '/v1/identity/strong-auth/step-up', {
      ...applyScope,
      code: harness.code(),
    });
    const receipt = issued.json<{ receipt: string }>().receipt;
    const results = await Promise.all([
      post(harness.app, '/v1/identity/strong-auth/plan-proof/consume', {
        ...applyScope,
        receipt,
      }),
      post(harness.app, '/v1/identity/strong-auth/plan-proof/consume', {
        ...applyScope,
        receipt,
      }),
    ]);
    expect(results.map(({ statusCode }) => statusCode).sort()).toEqual([200, 422]);
    await harness.app.close();
  });

  it('never accepts renderer-declared strong-auth state', async () => {
    const harness = await createHarness();
    const rendererClaim = { ['strong' + 'Auth']: true };
    const response = await post(harness.app, '/v1/identity/strong-auth/plan-proof/consume', {
      ...applyScope,
      ...rendererClaim,
    });
    expect(response.statusCode).toBe(422);
    await harness.app.close();
  });
});
