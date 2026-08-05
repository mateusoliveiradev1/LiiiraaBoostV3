import {
  bindDevice,
  transferDevice,
  type DeviceAuthorityDependencies,
  type DeviceAuthorityResult,
  type DeviceBindingRecord,
  type DeviceBindingRepository,
  type DeviceBindingTransaction,
  type DeviceEntitlementRecord,
  type DeviceExceptionRecord,
} from '@liiiraa/control-plane-application';
import { describe, expect, it } from 'vitest';

const ACCOUNT_ID = 'account-player';
const ENTITLEMENT_ID = 'entitlement-premium';
const FIRST_BIND_AT = '2030-02-01T12:00:00.000Z';
const PRE_COOLDOWN_AT = '2030-02-15T12:00:00.000Z';

const evidence = (platformByte = 'a') => ({
  deviceClass: 'physical' as const,
  keyVersion: 1,
  components: [
    { componentClass: 'platform-trust' as const, protectedDigest: platformByte.repeat(64) },
    { componentClass: 'cpu' as const, protectedDigest: 'b'.repeat(64) },
    { componentClass: 'storage-controller' as const, protectedDigest: 'c'.repeat(64) },
    { componentClass: 'gpu' as const, protectedDigest: 'd'.repeat(64) },
    { componentClass: 'memory-topology' as const, protectedDigest: 'e'.repeat(64) },
  ],
});

interface AuditRecord {
  readonly auditReference: string;
  readonly accountId: string;
  readonly eventType: string;
  readonly reason: string;
  readonly aggregateVersion: bigint;
  readonly occurredAt: string;
}

interface OutboxRecord {
  readonly jobId: string;
  readonly topic: 'device-binding.changed';
  readonly entitlementId: string;
  readonly aggregateVersion: bigint;
  readonly bindingId: string;
  readonly outcome: string;
  readonly availableAt: string;
}

interface RepositoryState {
  entitlements: Map<string, DeviceEntitlementRecord>;
  bindings: Map<string, DeviceBindingRecord>;
  exceptions: Map<string, DeviceExceptionRecord>;
  commandResults: Map<string, DeviceAuthorityResult>;
  audits: AuditRecord[];
  outbox: OutboxRecord[];
}

class SerializableDeviceRepository implements DeviceBindingRepository {
  private state: RepositoryState = {
    entitlements: new Map([
      [
        ACCOUNT_ID,
        {
          entitlementId: ENTITLEMENT_ID,
          accountId: ACCOUNT_ID,
          status: 'active',
          version: 1n,
        },
      ],
    ]),
    bindings: new Map(),
    exceptions: new Map(),
    commandResults: new Map(),
    audits: [],
    outbox: [],
  };

  private tail: Promise<void> = Promise.resolve();

  transaction<T>(
    _accountId: string,
    operation: (transaction: DeviceBindingTransaction) => Promise<T>,
  ): Promise<T> {
    const previous = this.tail;
    let release = (): void => undefined;
    this.tail = new Promise<void>((resolve) => {
      release = resolve;
    });
    return previous.then(async () => {
      const snapshot = structuredClone(this.state);
      try {
        return await operation(this.transactionView());
      } catch (error) {
        this.state = snapshot;
        throw error;
      } finally {
        release();
      }
    });
  }

  addException(record: DeviceExceptionRecord): void {
    this.state.exceptions.set(record.exceptionId, record);
  }

  activeBindings(): readonly DeviceBindingRecord[] {
    return [...this.state.bindings.values()].filter((binding) => binding.revokedAt === null);
  }

  latestBinding(): DeviceBindingRecord | undefined {
    return [...this.state.bindings.values()].at(-1);
  }

  entitlementVersion(): bigint {
    return this.state.entitlements.get(ACCOUNT_ID)?.version ?? 0n;
  }

  auditRecords(): readonly AuditRecord[] {
    return this.state.audits;
  }

  outboxRecords(): readonly OutboxRecord[] {
    return this.state.outbox;
  }

  exception(exceptionId: string): DeviceExceptionRecord | undefined {
    return this.state.exceptions.get(exceptionId);
  }

  private transactionView(): DeviceBindingTransaction {
    return {
      lockEntitlement: (accountId) =>
        Promise.resolve(this.state.entitlements.get(accountId) ?? null),
      findCommandResult: (commandId) =>
        Promise.resolve(this.state.commandResults.get(commandId) ?? null),
      getActiveBinding: (entitlementId) =>
        Promise.resolve(
          [...this.state.bindings.values()].find(
            (binding) => binding.entitlementId === entitlementId && binding.revokedAt === null,
          ) ?? null,
        ),
      getLatestBinding: (entitlementId) =>
        Promise.resolve(
          [...this.state.bindings.values()]
            .filter((binding) => binding.entitlementId === entitlementId)
            .at(-1) ?? null,
        ),
      lockException: (exceptionId) =>
        Promise.resolve(this.state.exceptions.get(exceptionId) ?? null),
      insertBinding: (record) => {
        const active = [...this.state.bindings.values()].find(
          (binding) => binding.entitlementId === record.entitlementId && binding.revokedAt === null,
        );
        if (active) throw new Error('uq_device_bindings_one_active_per_entitlement');
        this.state.bindings.set(record.bindingId, record);
        return Promise.resolve();
      },
      revokeBinding: (bindingId, revokedAt) => {
        const binding = this.state.bindings.get(bindingId);
        if (!binding) throw new Error('binding-not-found');
        this.state.bindings.set(bindingId, {
          ...binding,
          revokedAt,
          version: binding.version + 1n,
        });
        return Promise.resolve();
      },
      consumeException: (exceptionId, consumedAt, expectedVersion) => {
        const exception = this.state.exceptions.get(exceptionId);
        if (exception?.version !== expectedVersion || exception.consumedAt !== null) {
          throw new Error('device-exception-stale-or-consumed');
        }
        this.state.exceptions.set(exceptionId, {
          ...exception,
          consumedAt,
          version: exception.version + 1n,
        });
        return Promise.resolve();
      },
      incrementEntitlementVersion: (entitlementId, expectedVersion) => {
        const entitlement = [...this.state.entitlements.values()].find(
          (candidate) => candidate.entitlementId === entitlementId,
        );
        if (entitlement?.version !== expectedVersion) {
          throw new Error('premium-entitlement-stale');
        }
        const nextVersion = entitlement.version + 1n;
        this.state.entitlements.set(entitlement.accountId, {
          ...entitlement,
          version: nextVersion,
        });
        return Promise.resolve(nextVersion);
      },
      appendAudit: (record) => {
        this.state.audits.push(record);
        return Promise.resolve();
      },
      enqueueOutbox: (record) => {
        this.state.outbox.push(record);
        return Promise.resolve();
      },
      rememberCommandResult: (commandId, result) => {
        this.state.commandResults.set(commandId, result);
        return Promise.resolve();
      },
    };
  }
}

const dependencies = (
  repository: SerializableDeviceRepository,
  now: string,
): DeviceAuthorityDependencies => {
  let sequence = 0;
  return {
    repository,
    authorizer: {
      authorize: ({ actorAccountId, accountId }) => Promise.resolve(actorAccountId === accountId),
    },
    clock: { now: () => new Date(now) },
    ids: {
      next: () => {
        sequence += 1;
        return `device-authority-${String(sequence).padStart(4, '0')}`;
      },
    },
  };
};

const bindInput = (index: number) => ({
  commandId: `bind-command-${String(index).padStart(2, '0')}`,
  actorAccountId: ACCOUNT_ID,
  accountId: ACCOUNT_ID,
  expectedVersion: 1n,
  bindingId: `binding-${String(index).padStart(2, '0')}`,
  deviceDigest: index.toString(16).padStart(64, '0'),
  deviceLabel: `Player PC ${String(index).padStart(2, '0')}`,
  evidence: evidence(),
  confirmedFriendlyIdentity: true,
  confirmedOnePcConsequences: true,
  correlationId: `race-${String(index).padStart(2, '0')}`,
});

describe('device concurrency transaction authority', () => {
  it('IDEN-04 serializes a 20-way bind race to exactly one active PC and remote conflicts', async () => {
    const repository = new SerializableDeviceRepository();
    const authority = dependencies(repository, FIRST_BIND_AT);
    const results = await Promise.all(
      Array.from({ length: 20 }, (_, index) => bindDevice(authority, bindInput(index + 1))),
    );

    const winners = results.filter((result) => result.ok);
    const losers = results.filter((result) => !result.ok);
    expect(winners).toHaveLength(1);
    expect(losers).toHaveLength(19);
    expect(
      losers.every(
        (result) =>
          result.code === 'STALE' &&
          result.reason === 'expected-version-mismatch' &&
          result.projection?.state === 'active',
      ),
    ).toBe(true);
    expect(repository.activeBindings()).toHaveLength(1);
    expect(repository.entitlementVersion()).toBe(2n);
    expect(repository.auditRecords()).toHaveLength(1);
    expect(repository.outboxRecords()).toHaveLength(1);

    const repeated = await bindDevice(authority, bindInput(1));
    expect(repeated).toEqual(winners[0]);
    expect(repository.activeBindings()).toHaveLength(1);
    expect(repository.auditRecords()).toHaveLength(1);
    expect(repository.outboxRecords()).toHaveLength(1);
  });

  it('WEB-05 keeps the current PC active during ordinary cooldown', async () => {
    const repository = new SerializableDeviceRepository();
    const first = await bindDevice(dependencies(repository, FIRST_BIND_AT), bindInput(1));
    expect(first.ok).toBe(true);

    const result = await transferDevice(dependencies(repository, PRE_COOLDOWN_AT), {
      action: 'transfer',
      commandId: 'ordinary-transfer',
      actorAccountId: ACCOUNT_ID,
      accountId: ACCOUNT_ID,
      expectedVersion: 2n,
      correlationId: 'ordinary-transfer',
      bindingId: 'binding-replacement',
      deviceDigest: 'f'.repeat(64),
      deviceLabel: 'Replacement PC',
      evidence: evidence('f'),
      reason: 'ordinary',
      confirmedByCustomer: true,
    });

    expect(result).toMatchObject({
      ok: false,
      code: 'POLICY_DENIED',
      reason: 'replacement-cooldown-active',
      projection: {
        state: 'replacement-cooldown',
        replacementEligibleAt: '2030-03-03T12:00:00.000Z',
      },
    });
    expect(repository.activeBindings()).toHaveLength(1);
    expect(repository.entitlementVersion()).toBe(2n);
  });

  it('revokes theft immediately then atomically redeems one reviewed 24-hour exception', async () => {
    const repository = new SerializableDeviceRepository();
    await bindDevice(dependencies(repository, FIRST_BIND_AT), bindInput(1));
    const revoked = await transferDevice(dependencies(repository, PRE_COOLDOWN_AT), {
      action: 'revoke',
      commandId: 'theft-revoke',
      actorAccountId: ACCOUNT_ID,
      accountId: ACCOUNT_ID,
      expectedVersion: 2n,
      correlationId: 'theft-revoke',
      reason: 'theft',
    });
    expect(revoked).toMatchObject({ ok: true, projection: { state: 'revoked' } });
    expect(repository.activeBindings()).toHaveLength(0);
    expect(repository.entitlementVersion()).toBe(3n);

    const exception: DeviceExceptionRecord = {
      exceptionId: 'exception-reviewed',
      accountId: ACCOUNT_ID,
      reviewed: true,
      issuedAt: '2030-02-15T12:00:00.000Z',
      expiresAt: '2030-02-16T12:00:00.000Z',
      consumedAt: null,
      strongAuthVerifiedAt: '2030-02-15T12:05:00.000Z',
      version: 1n,
    };
    repository.addException(exception);
    const replacementInput = {
      action: 'transfer' as const,
      commandId: 'exception-replacement',
      actorAccountId: ACCOUNT_ID,
      accountId: ACCOUNT_ID,
      expectedVersion: 3n,
      correlationId: 'exception-replacement',
      bindingId: 'binding-replacement',
      deviceDigest: 'f'.repeat(64),
      deviceLabel: 'Replacement PC',
      evidence: evidence('f'),
      reason: 'theft' as const,
      confirmedByCustomer: true,
      exceptionId: exception.exceptionId,
    };
    const [redeemed, raced] = await Promise.all([
      transferDevice(dependencies(repository, '2030-02-15T12:10:00.000Z'), replacementInput),
      transferDevice(dependencies(repository, '2030-02-15T12:10:00.000Z'), {
        ...replacementInput,
        commandId: 'exception-replacement-racer',
        bindingId: 'binding-racer',
      }),
    ]);

    expect([redeemed, raced].filter((result) => result.ok)).toHaveLength(1);
    expect([redeemed, raced].filter((result) => !result.ok)).toMatchObject([
      { ok: false, code: 'STALE', reason: 'expected-version-mismatch' },
    ]);
    expect(repository.activeBindings()).toHaveLength(1);
    expect(repository.latestBinding()?.bindingId).toBe('binding-replacement');
    expect(repository.exception(exception.exceptionId)).toMatchObject({
      consumedAt: '2030-02-15T12:10:00.000Z',
      version: 2n,
    });
    expect(repository.auditRecords().map(({ eventType }) => eventType)).toEqual([
      'device.bind',
      'device.revoke',
      'device.replace',
    ]);
    expect(repository.outboxRecords()).toHaveLength(3);
  });

  it('rejects non-owner mutation without entering the transaction', async () => {
    const repository = new SerializableDeviceRepository();
    const result = await bindDevice(dependencies(repository, FIRST_BIND_AT), {
      ...bindInput(1),
      actorAccountId: 'account-attacker',
    });

    expect(result).toEqual({ ok: false, code: 'UNAUTHORIZED', reason: 'owner-required' });
    expect(repository.activeBindings()).toHaveLength(0);
    expect(repository.auditRecords()).toHaveLength(0);
    expect(repository.outboxRecords()).toHaveLength(0);
  });
});
