import { createHmac } from 'node:crypto';

import type { IdentityActor } from '@liiiraa/control-plane-adapters';
import { describe, expect, it } from 'vitest';

import {
  createPostgresStagingStrongAuthRepository,
  createStagingStrongAuth,
  type StagingStrongAuthRepository,
  type StoredStrongFactor,
  type StoredStepUpReceipt,
} from './strong-auth.js';

const NOW = '2030-01-15T12:00:00.000Z';
const SECRET = 'staging-strong-auth-secret-with-more-than-forty-three-characters';

const actor: IdentityActor = {
  accountId: '00000000-0000-4000-8000-000000000001',
  displayName: 'Owner',
  email: 'owner@example.com',
  locale: 'pt-BR',
  role: 'security',
  sessionId: '00000000-0000-4000-8000-000000000002',
  sessionKind: 'admin',
  authenticationMethod: 'password',
  authenticatedAt: NOW,
  expiresAt: '2030-02-15T12:00:00.000Z',
  lastSeenAt: NOW,
  sessionVersion: 1n,
  identityVersion: 1n,
  createdAt: NOW,
  updatedAt: NOW,
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
  const digest = createHmac('sha1', decodeBase32(secret)).update(message).digest();
  const offset = digest.at(-1)! & 0x0f;
  const binary = (digest.readUInt32BE(offset) & 0x7fff_ffff) % 1_000_000;
  return String(binary).padStart(6, '0');
};

class MemoryStrongAuthRepository implements StagingStrongAuthRepository {
  factor: StoredStrongFactor | null = null;
  receipt: StoredStepUpReceipt | null = null;
  provisioned = false;

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
    this.receipt = record;
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
    const receipt = this.receipt;
    if (
      receipt === null ||
      receipt.usedAt !== null ||
      receipt.receiptDigest !== input.receiptDigest ||
      receipt.accountId !== input.accountId ||
      receipt.sessionId !== input.sessionId ||
      receipt.action !== input.action ||
      receipt.resource !== input.resource ||
      receipt.redactedTarget !== input.redactedTarget ||
      receipt.authorizationContextId !== input.authorizationContextId ||
      Date.parse(receipt.expiresAt) <= Date.parse(input.usedAt)
    )
      return Promise.resolve(null);
    this.receipt = { ...receipt, usedAt: input.usedAt };
    return Promise.resolve(this.receipt);
  }

  provisionStagingAdministrator(): Promise<void> {
    this.provisioned = true;
    return Promise.resolve();
  }
}

describe('real staging TOTP and action-scoped step-up', () => {
  it('provisions bounded Admin grants with a constant number of PostgreSQL round trips', async () => {
    const statements: { sql: string; values: readonly unknown[] }[] = [];
    const query = (sql: string, values: readonly unknown[] = []) => {
      statements.push({ sql, values });
      return Promise.resolve({ rowCount: 1, rows: [] });
    };
    const repository = createPostgresStagingStrongAuthRepository({
      query,
      transaction: (operation) => operation({ query }),
    });

    await repository.provisionStagingAdministrator(actor);

    expect(statements).toHaveLength(6);
    const capabilities = statements.find(({ sql }) =>
      sql.includes('INSERT INTO admin_membership_capabilities'),
    );
    const functions = statements.find(({ sql }) =>
      sql.includes('INSERT INTO admin_membership_functions'),
    );
    const scopes = statements.find(({ sql }) =>
      sql.includes('INSERT INTO admin_membership_scopes'),
    );
    expect(functions?.values[0]).toEqual(['security', 'operations']);
    expect(capabilities?.sql).toMatch(/unnest\(\$1::text\[\]\)/iu);
    expect(capabilities?.values[0]).toEqual(
      expect.arrayContaining([
        'beta-invitations:issue',
        'admin-membership:manage',
        'admin-approval:manage',
      ]),
    );
    expect(scopes?.sql).toMatch(/unnest\(\$1::text\[\]\)/iu);
    expect(scopes?.values[0]).toEqual(
      expect.arrayContaining(['team', 'history', 'delegations', 'reviews']),
    );
  });

  it('confirms a real TOTP before provisioning membership and never stores plaintext', async () => {
    const repository = new MemoryStrongAuthRepository();
    const authority = createStagingStrongAuth({
      clock: { now: () => new Date(NOW) },
      encryptionSecret: SECRET,
      ids: { next: () => '00000000-0000-4000-8000-000000000003' },
      randomBytes: (size) => Buffer.alloc(size, 7),
      repository,
    });

    const enrollment = authority.beginTotpEnrollment(actor);
    expect(new URL(enrollment.otpauthUri).searchParams.get('issuer')).toBe('Liiiraa Boost');
    expect(enrollment.enrollmentToken).not.toContain(enrollment.secret);
    expect(
      await authority.confirmTotpEnrollment(actor, enrollment.enrollmentToken, '000000'),
    ).toEqual({
      ok: false,
      code: 'INVALID_TOTP',
    });

    await expect(
      authority.confirmTotpEnrollment(
        actor,
        enrollment.enrollmentToken,
        totp(enrollment.secret, NOW),
      ),
    ).resolves.toMatchObject({ ok: true, factor: 'totp' });
    expect(repository.provisioned).toBe(true);
    expect(repository.factor?.encryptedSecret.toString('utf8')).not.toContain(enrollment.secret);
  });

  it('issues a one-use receipt bound to actor, session, context, action, resource and target', async () => {
    const repository = new MemoryStrongAuthRepository();
    const authority = createStagingStrongAuth({
      clock: { now: () => new Date(NOW) },
      encryptionSecret: SECRET,
      ids: { next: () => '00000000-0000-4000-8000-000000000003' },
      randomBytes: (size) => Buffer.alloc(size, 9),
      repository,
    });
    const enrollment = authority.beginTotpEnrollment(actor);
    const code = totp(enrollment.secret, NOW);
    await authority.confirmTotpEnrollment(actor, enrollment.enrollmentToken, code);
    const binding = {
      action: 'switch-function',
      authorizationContextId: 'context-one',
      redactedTarget: 'owner-membership',
      resource: 'governance',
    };
    const stepUp = await authority.verifyTotpStepUp(actor, { ...binding, code });
    expect(stepUp).toMatchObject({ ok: true, method: 'totp' });
    if (!stepUp.ok) throw new Error('expected real TOTP receipt');
    await expect(
      authority.consumeStepUpReceipt(actor, { ...binding, receipt: stepUp.receipt }),
    ).resolves.toMatchObject({ method: 'totp', action: binding.action });
    await expect(
      authority.consumeStepUpReceipt(actor, { ...binding, receipt: stepUp.receipt }),
    ).resolves.toBeNull();
    await expect(authority.verifyTotpStepUp(actor, { ...binding, code })).resolves.toEqual({
      ok: false,
      code: 'REPLAYED_TOTP',
    });
  });
});
