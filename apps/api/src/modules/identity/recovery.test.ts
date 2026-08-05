import type {
  RecoveryAggregate,
  RecoveryDependencies,
  RecoveryRepository,
  RecoveryTransaction,
  SecurityMethodDependencies,
  SecurityMethodRecord,
  SecurityMethodRepository,
  SecurityMethodTransaction,
} from '@liiiraa/control-plane-application';
import type {
  IdentityProviderResult,
  IdentityStepUpReceipt,
} from '@liiiraa/control-plane-application';
import Fastify from 'fastify';
import { afterEach, describe, expect, it } from 'vitest';

import { registerSecurityRoutes } from './security-routes.js';

const ACCOUNT_ID = 'account-player';
const SESSION_ID = 'trusted-session-current';
const NOW = '2030-04-01T12:00:00.000Z';
const HOLD_UNTIL = '2030-04-02T12:00:00.000Z';

const success = <T>(value: T): IdentityProviderResult<T> => ({ ok: true, value });

class MemorySecurityMethods implements SecurityMethodRepository {
  readonly records = new Map<string, SecurityMethodRecord>();
  readonly audits: string[] = [];

  transaction<T>(
    _accountId: string,
    operation: (transaction: SecurityMethodTransaction) => Promise<T>,
  ): Promise<T> {
    return operation({
      insert: (record) => {
        this.records.set(record.methodId, record);
        return Promise.resolve();
      },
      revoke: (methodId, revokedAt) => {
        const record = this.records.get(methodId);
        if (!record) return Promise.resolve(false);
        this.records.set(methodId, { ...record, revokedAt, version: record.version + 1n });
        return Promise.resolve(true);
      },
      appendAudit: ({ action }) => {
        this.audits.push(action);
        return Promise.resolve();
      },
    });
  }
}

interface RecoveryMemoryState {
  aggregate: RecoveryAggregate;
  recoveryCodeDigests: Set<string>;
  activeSessions: Set<string>;
  audits: string[];
  outbox: Array<{ topic: string; sessionId: string }>;
  operations: string[];
}

class SerializableRecoveryRepository implements RecoveryRepository {
  readonly state: RecoveryMemoryState = {
    aggregate: {
      accountId: ACCOUNT_ID,
      email: 'player@example.test',
      state: { status: 'idle', version: 1n },
    },
    recoveryCodeDigests: new Set(['digest:one-use-code']),
    activeSessions: new Set([SESSION_ID, 'trusted-session-other']),
    audits: [],
    outbox: [],
    operations: [],
  };
  private tail: Promise<void> = Promise.resolve();

  transaction<T>(
    _accountId: string,
    operation: (transaction: RecoveryTransaction) => Promise<T>,
  ): Promise<T> {
    const previous = this.tail;
    let release = (): void => undefined;
    this.tail = new Promise<void>((resolve) => {
      release = resolve;
    });
    return previous.then(async () => {
      const snapshot = structuredClone(this.state);
      try {
        return await operation(this.view());
      } catch (error) {
        Object.assign(this.state, snapshot);
        throw error;
      } finally {
        release();
      }
    });
  }

  private view(): RecoveryTransaction {
    return {
      load: () => Promise.resolve(this.state.aggregate),
      save: (aggregate) => {
        this.state.operations.push(`save:${aggregate.state.status}`);
        this.state.aggregate = aggregate;
        return Promise.resolve();
      },
      consumeRecoveryCode: (_accountId, digest) => {
        const consumed = this.state.recoveryCodeDigests.delete(digest);
        this.state.operations.push(`recovery-code:${consumed ? 'consumed' : 'rejected'}`);
        return Promise.resolve(consumed);
      },
      trustedSessionIds: () => Promise.resolve([SESSION_ID, 'trusted-session-other']),
      revokeAffectedSessions: () => {
        const revoked = [...this.state.activeSessions];
        this.state.activeSessions.clear();
        this.state.operations.push('sessions:revoked');
        return Promise.resolve(revoked);
      },
      appendAudit: ({ action }) => {
        this.state.audits.push(action);
        this.state.operations.push(`audit:${action}`);
        return Promise.resolve();
      },
      enqueueOutbox: ({ topic, sessionId }) => {
        this.state.outbox.push({ topic, sessionId });
        this.state.operations.push(`outbox:${topic}:${sessionId}`);
        return Promise.resolve();
      },
    };
  }
}

const ids = () => {
  let sequence = 0;
  return {
    next: () => {
      sequence += 1;
      return `security-${String(sequence).padStart(4, '0')}`;
    },
  };
};

const securityDependencies = (repository: MemorySecurityMethods): SecurityMethodDependencies => ({
  repository,
  clock: { now: () => new Date(NOW) },
  ids: ids(),
  provider: {
    enrollFactor: ({ factor }) => Promise.resolve(success({ factor })),
    stepUp: ({ sessionId, actionScope, factor }) =>
      Promise.resolve(
        success<IdentityStepUpReceipt>({
          sessionId,
          actionScope,
          factor,
          verifiedAt: NOW,
          expiresAt: new Date(Date.parse(NOW) + 5 * 60_000).toISOString(),
          auditReceiptId: 'provider-step-up-audit',
        }),
      ),
  },
});

const recoveryDependencies = (
  repository: SerializableRecoveryRepository,
): RecoveryDependencies => ({
  repository,
  hasher: { digest: (value) => Promise.resolve(`digest:${value}`) },
  clock: { now: () => new Date(NOW) },
  ids: ids(),
});

const apps: Array<ReturnType<typeof Fastify>> = [];

const harness = async () => {
  const securityRepository = new MemorySecurityMethods();
  const recoveryRepository = new SerializableRecoveryRepository();
  const app = Fastify();
  apps.push(app);
  await registerSecurityRoutes(app, {
    securityMethods: securityDependencies(securityRepository),
    recovery: recoveryDependencies(recoveryRepository),
    resolveSessionActor: () => Promise.resolve({ accountId: ACCOUNT_ID, sessionId: SESSION_ID }),
    resolveSecurityReviewer: () => Promise.resolve({ reviewerId: 'security-reviewer' }),
    verifyRecoveryEmailEvidence: ({ evidenceValue }) =>
      Promise.resolve(evidenceValue === 'verified-email-token'),
  });
  await app.ready();
  return { app, securityRepository, recoveryRepository };
};

const requestTotalLoss = async (app: ReturnType<typeof Fastify>) =>
  app.inject({
    method: 'POST',
    url: '/v1/identity/recoveries',
    payload: {
      accountId: ACCOUNT_ID,
      email: 'player@example.test',
      evidence: 'all-factors-lost',
    },
  });

const approveRecovery = async (app: ReturnType<typeof Fastify>) =>
  app.inject({
    method: 'POST',
    url: `/v1/identity/recoveries/${ACCOUNT_ID}/review`,
    payload: { reviewedBy: 'security-reviewer', approved: true },
  });

afterEach(async () => {
  await Promise.all(apps.splice(0).map((app) => app.close()));
});

describe('identity-recovery API and transaction witnesses', () => {
  it('IDEN-02 approved second factors accepts only TOTP, passkeys, and one-use recovery codes', async () => {
    for (const factor of ['totp', 'passkey', 'recovery-code']) {
      const { app } = await harness();
      const response = await app.inject({
        method: 'POST',
        url: '/v1/identity/security-methods/enroll',
        payload: {
          factor,
          credentialReference: `${factor}-credential`,
          stepUpFactor: 'passkey',
          stepUpProof: 'valid-passkey-proof',
        },
      });
      expect(response.statusCode).toBe(201);
      const methodId = response.json<{ method: { methodId: string } }>().method.methodId;
      const disabled = await app.inject({
        method: 'POST',
        url: `/v1/identity/security-methods/${methodId}/disable`,
        payload: { stepUpFactor: 'passkey', stepUpProof: 'valid-passkey-proof' },
      });
      expect(disabled.statusCode).toBe(200);
    }
    for (const factor of ['sms', 'email']) {
      const { app } = await harness();
      const response = await app.inject({
        method: 'POST',
        url: '/v1/identity/security-methods/enroll',
        payload: {
          factor,
          credentialReference: `${factor}-credential`,
          stepUpFactor: 'passkey',
          stepUpProof: 'valid-passkey-proof',
        },
      });
      expect(response.statusCode).toBe(422);
    }

    const { app } = await harness();
    const unverifiedEmail = await app.inject({
      method: 'POST',
      url: '/v1/identity/recoveries',
      payload: {
        accountId: ACCOUNT_ID,
        email: 'player@example.test',
        evidence: 'verified-email',
        verifiedEmail: true,
        evidenceValue: 'attacker-controlled-value',
      },
    });
    expect(unverifiedEmail.statusCode).toBe(422);
  });

  it('IDEN-02 reviewed recovery keeps total factor loss pending without takeover authority', async () => {
    const { app } = await harness();
    const response = await requestTotalLoss(app);
    expect(response.statusCode).toBe(202);
    expect(response.json()).toMatchObject({
      ok: true,
      basicAccess: false,
      state: { status: 'pending-review', route: 'security-review' },
    });
  });

  it('IDEN-02 critical-action hold preserves ordinary access and blocks protected actions', async () => {
    const { app } = await harness();
    await requestTotalLoss(app);
    const reviewed = await approveRecovery(app);
    expect(reviewed.statusCode).toBe(200);
    expect(reviewed.json()).toMatchObject({
      basicAccess: true,
      state: { status: 'active-hold', endsAt: HOLD_UNTIL },
    });

    const ordinary = await app.inject({
      method: 'POST',
      url: '/v1/identity/security/authorize',
      payload: { action: 'ordinary-access', recoveryHoldUntil: HOLD_UNTIL },
    });
    expect(ordinary.statusCode).toBe(200);

    for (const action of [
      'security-method-change',
      'device-transfer',
      'refund',
      'protected-data-access',
    ]) {
      const protectedResponse = await app.inject({
        method: 'POST',
        url: '/v1/identity/security/authorize',
        payload: {
          action,
          recoveryHoldUntil: HOLD_UNTIL,
          stepUp: {
            factor: 'passkey',
            action,
            verifiedAt: NOW,
            expiresAt: HOLD_UNTIL,
          },
        },
      });
      expect(protectedResponse.statusCode).toBe(403);
    }
  });

  it('IDEN-02 trusted-session contest extends the hold and records risk transition', async () => {
    const { app, recoveryRepository } = await harness();
    await requestTotalLoss(app);
    await approveRecovery(app);
    const extendedUntil = '2030-04-05T12:00:00.000Z';
    const response = await app.inject({
      method: 'POST',
      url: `/v1/identity/recoveries/${ACCOUNT_ID}/contest`,
      payload: { extendUntil: extendedUntil },
    });
    expect(response.statusCode).toBe(200);
    expect(response.json()).toMatchObject({
      state: { status: 'contested', endsAt: extendedUntil },
    });
    expect(recoveryRepository.state.audits).toContain('identity.recovery-contested');
    expect(recoveryRepository.state.outbox).toContainEqual({
      topic: 'identity.recovery-contested',
      sessionId: SESSION_ID,
    });

    const riskExtendedUntil = '2030-04-07T12:00:00.000Z';
    const riskExtension = await app.inject({
      method: 'POST',
      url: `/v1/identity/recoveries/${ACCOUNT_ID}/risk-extension`,
      payload: { extendUntil: riskExtendedUntil },
    });
    expect(riskExtension.statusCode).toBe(200);
    expect(riskExtension.json()).toMatchObject({
      state: { status: 'contested', endsAt: riskExtendedUntil },
    });
  });

  it('IDEN-02 session revocation is atomic, precedes authority, and recovery code redeems once', async () => {
    const { app } = await harness();
    const redemptionPayload = {
      accountId: ACCOUNT_ID,
      email: 'player@example.test',
      evidence: 'recovery-code',
      evidenceValue: 'one-use-code',
    };
    const redemptions = await Promise.all(
      Array.from({ length: 12 }, () =>
        app.inject({ method: 'POST', url: '/v1/identity/recoveries', payload: redemptionPayload }),
      ),
    );
    expect(redemptions.filter((response) => response.statusCode === 200)).toHaveLength(1);

    const resetHarness = await harness();
    await requestTotalLoss(resetHarness.app);
    const reviewed = await approveRecovery(resetHarness.app);
    expect(reviewed.statusCode).toBe(200);
    expect(resetHarness.recoveryRepository.state.activeSessions.size).toBe(0);
    const operations = resetHarness.recoveryRepository.state.operations;
    expect(operations.indexOf('sessions:revoked')).toBeGreaterThanOrEqual(0);
    expect(operations.indexOf('sessions:revoked')).toBeLessThan(
      operations.indexOf('save:active-hold'),
    );
    expect(reviewed.json()).toMatchObject({ basicAccess: true });
  });
});
