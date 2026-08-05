import type {
  DeleteAccountDependencies,
  ManageConsentDependencies,
  ManageSupportCaseDependencies,
  AccountDeletionState,
  DiagnosticConsentState,
  SupportCaseState,
  SupportLifecycleCommandResult,
  SupportLifecycleOutboxJob,
  SupportLifecycleRepository,
  SupportLifecycleTransaction,
} from '@liiiraa/control-plane-application';
import {
  deleteAccount,
  manageConsent,
  manageSupportCase,
} from '@liiiraa/control-plane-application';
import Fastify from 'fastify';
import type { FastifyInstance } from 'fastify';
import { afterEach, describe, expect, it } from 'vitest';

import { registerSupportRoutes } from './routes.js';

const NOW = '2030-08-01T12:00:00.000Z';
const ACCOUNT_ID = 'account-player';

interface MemoryState {
  readonly cases: Map<string, SupportCaseState>;
  readonly consents: Map<string, DiagnosticConsentState>;
  readonly deletions: Map<string, AccountDeletionState>;
  readonly commandResults: Map<string, SupportLifecycleCommandResult>;
  readonly audits: unknown[];
  readonly outbox: SupportLifecycleOutboxJob[];
}

class SerializableLifecycleRepository implements SupportLifecycleRepository {
  readonly state: MemoryState = {
    cases: new Map(),
    consents: new Map(),
    deletions: new Map(),
    commandResults: new Map(),
    audits: [],
    outbox: [],
  };
  private tail: Promise<void> = Promise.resolve();
  failTopic: SupportLifecycleOutboxJob['topic'] | null = null;

  transaction<T>(
    _accountId: string,
    operation: (transaction: SupportLifecycleTransaction) => Promise<T>,
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
        this.restore(snapshot);
        throw error;
      } finally {
        release();
      }
    });
  }

  private restore(snapshot: MemoryState): void {
    this.state.cases.clear();
    this.state.consents.clear();
    this.state.deletions.clear();
    this.state.commandResults.clear();
    for (const [key, value] of snapshot.cases) this.state.cases.set(key, value);
    for (const [key, value] of snapshot.consents) this.state.consents.set(key, value);
    for (const [key, value] of snapshot.deletions) this.state.deletions.set(key, value);
    for (const [key, value] of snapshot.commandResults) this.state.commandResults.set(key, value);
    this.state.audits.splice(0, this.state.audits.length, ...snapshot.audits);
    this.state.outbox.splice(0, this.state.outbox.length, ...snapshot.outbox);
  }

  private view(): SupportLifecycleTransaction {
    return {
      findCommandResult: (commandId) =>
        Promise.resolve(this.state.commandResults.get(commandId) ?? null),
      rememberCommandResult: (commandId, result) => {
        this.state.commandResults.set(commandId, result);
        return Promise.resolve();
      },
      loadCase: (caseId) => Promise.resolve(this.state.cases.get(caseId) ?? null),
      saveCase: (state) => {
        this.state.cases.set(state.caseId, state);
        return Promise.resolve();
      },
      loadConsent: (consentId) => Promise.resolve(this.state.consents.get(consentId) ?? null),
      saveConsent: (state) => {
        this.state.consents.set(state.consentId, state);
        return Promise.resolve();
      },
      expireCaseConsents: (caseId, expiredAt) => {
        const expired: string[] = [];
        for (const [consentId, consent] of this.state.consents) {
          if (consent.caseId === caseId && consent.status === 'active') {
            this.state.consents.set(consentId, {
              ...consent,
              status: 'expired',
              version: consent.version + 1n,
              expiresAt: expiredAt,
            });
            expired.push(consentId);
          }
        }
        return Promise.resolve(expired);
      },
      loadDeletion: (accountId) => Promise.resolve(this.state.deletions.get(accountId) ?? null),
      saveDeletion: (state) => {
        this.state.deletions.set(state.accountId, state);
        return Promise.resolve();
      },
      eraseOrdinaryAccountData: (accountId) => {
        for (const [caseId, supportCase] of this.state.cases) {
          if (supportCase.accountId === accountId) this.state.cases.delete(caseId);
        }
        for (const [consentId, consent] of this.state.consents) {
          if (consent.accountId === accountId) this.state.consents.delete(consentId);
        }
        return Promise.resolve();
      },
      appendAudit: (record) => {
        this.state.audits.push(structuredClone(record));
        return Promise.resolve();
      },
      enqueueOutbox: (job) => {
        if (job.topic === this.failTopic) throw new Error('synthetic-lifecycle-outbox-failure');
        if (!this.state.outbox.some((existing) => existing.idempotencyKey === job.idempotencyKey)) {
          this.state.outbox.push(structuredClone(job));
        }
        return Promise.resolve();
      },
    };
  }
}

const ids = () => {
  let sequence = 0;
  return { next: () => `lifecycle-${String(++sequence).padStart(4, '0')}` };
};

const command = (action: 'create' | 'reply' | 'close', commandId: string, expectedVersion = '0') =>
  ({
    schemaVersion: '1.0',
    kind: 'support-command',
    commandId,
    accountId: ACCOUNT_ID,
    supportCaseId: 'case-one',
    action,
    expectedVersion,
    correlationId: `correlation-${commandId}`,
    requestedAt: NOW,
  }) as const;

const dependencies = (repository: SerializableLifecycleRepository, changes: string[]) => {
  const base = { repository, clock: { now: () => new Date(NOW) }, ids: ids() };
  return {
    cases: base satisfies ManageSupportCaseDependencies,
    consents: {
      ...base,
      consentChanges: { publish: (consentId: string) => void changes.push(consentId) },
    } satisfies ManageConsentDependencies,
    deletion: base satisfies DeleteAccountDependencies,
  };
};

const apps: FastifyInstance[] = [];

afterEach(async () => {
  await Promise.all(apps.splice(0).map((app) => app.close()));
});

describe('support, consent, retention and deletion transactions', () => {
  it('commits case, audit, notification and purge jobs exactly once', async () => {
    const repository = new SerializableLifecycleRepository();
    const changes: string[] = [];
    const deps = dependencies(repository, changes);
    const input = {
      command: command('create', 'command-create'),
      action: {
        kind: 'create' as const,
        plan: 'free' as const,
        category: 'billing' as const,
        subjectRedacted: 'Invoice question',
        message: 'The invoice total needs review.',
      },
    };
    const [first, replay] = await Promise.all([
      manageSupportCase(deps.cases, input),
      manageSupportCase(deps.cases, input),
    ]);
    expect(first).toEqual(replay);
    expect(first).toMatchObject({ ok: true, state: { priority: 'priority' } });
    expect(repository.state.cases).toHaveLength(1);
    expect(repository.state.audits).toHaveLength(1);
    expect(repository.state.outbox).toHaveLength(1);
    expect(repository.state.outbox[0]).toMatchObject({
      topic: 'support.case-notice',
      idempotencyKey: 'command-create:support.case-notice',
    });

    const closed = await manageSupportCase(deps.cases, {
      command: command('close', 'command-close', '1'),
      action: { kind: 'close' },
    });
    expect(closed).toMatchObject({ ok: true, state: { status: 'closed' } });
    expect(repository.state.outbox).toContainEqual(
      expect.objectContaining({
        topic: 'support.attachment-purge',
        idempotencyKey: 'case-one:attachments:purge:1',
      }),
    );
  });

  it('rolls back case, audit, and outbox together when a lifecycle enqueue fails', async () => {
    const repository = new SerializableLifecycleRepository();
    repository.failTopic = 'support.case-notice';
    const deps = dependencies(repository, []);
    await expect(
      manageSupportCase(deps.cases, {
        command: command('create', 'command-rollback'),
        action: {
          kind: 'create',
          plan: 'free',
          category: 'general',
          subjectRedacted: 'Rollback witness',
          message: 'This transaction must not partially persist.',
        },
      }),
    ).rejects.toThrow('synthetic-lifecycle-outbox-failure');
    expect(repository.state.cases).toHaveLength(0);
    expect(repository.state.audits).toHaveLength(0);
    expect(repository.state.outbox).toHaveLength(0);
  });

  it('revokes consent atomically, publishes the stream hook, and leaks no diagnostic bytes', async () => {
    const repository = new SerializableLifecycleRepository();
    const changes: string[] = [];
    const deps = dependencies(repository, changes);
    const grantCommand = {
      schemaVersion: '1.0',
      kind: 'consent-command',
      commandId: 'consent-grant',
      accountId: ACCOUNT_ID,
      consentId: 'consent-one',
      action: 'grant',
      scopes: ['support-diagnostics'] as ['support-diagnostics'],
      expectedVersion: '0',
      correlationId: 'correlation-consent-grant',
      requestedAt: NOW,
    } as const;
    const granted = await manageConsent(deps.consents, {
      command: grantCommand,
      action: {
        kind: 'grant',
        caseId: 'case-one',
        purpose: 'investigate invoice rendering',
        fieldClasses: ['application-log-redacted'],
        expiresAt: '2030-08-04T12:00:00.000Z',
      },
    });
    expect(granted).toMatchObject({ ok: true, state: { status: 'active' } });
    const revoked = await manageConsent(deps.consents, {
      command: {
        ...grantCommand,
        commandId: 'consent-revoke',
        action: 'revoke',
        expectedVersion: '1',
      },
      action: { kind: 'revoke' },
    });
    expect(revoked).toMatchObject({ ok: true, state: { status: 'revoked' } });
    expect(changes).toEqual(['consent-one']);
    expect(repository.state.outbox).toContainEqual(
      expect.objectContaining({
        topic: 'support.consent-receipt',
        idempotencyKey: 'consent-revoke:support.consent-receipt',
      }),
    );
    expect(
      JSON.stringify(
        {
          audits: repository.state.audits,
          outbox: repository.state.outbox,
          consent: repository.state.consents.get('consent-one'),
        },
        (_key, value: unknown) => (typeof value === 'bigint' ? String(value) : value),
      ),
    ).not.toMatch(/diagnosticBytes|tablePayload|top-secret/iu);
  });

  it('schedules, cancels, and finalizes deletion without duplicating lifecycle work', async () => {
    const repository = new SerializableLifecycleRepository();
    const changes: string[] = [];
    const deps = dependencies(repository, changes);
    const requestInput = {
      commandId: 'deletion-request',
      accountId: ACCOUNT_ID,
      expectedVersion: 0n,
      action: { kind: 'request' as const, requestId: 'deletion-one', strongAuthVerified: true },
    };
    const requested = await deleteAccount(deps.deletion, requestInput);
    const replayed = await deleteAccount(deps.deletion, requestInput);
    expect(requested).toEqual(replayed);
    expect(
      repository.state.outbox.filter((job) => job.topic === 'account.deletion-finalize'),
    ).toHaveLength(1);
    expect(repository.state.outbox).toContainEqual(
      expect.objectContaining({ availableAt: '2030-08-08T12:00:00.000Z' }),
    );
    const canceled = await deleteAccount(deps.deletion, {
      commandId: 'deletion-cancel',
      accountId: ACCOUNT_ID,
      expectedVersion: 1n,
      action: { kind: 'cancel' },
    });
    expect(canceled).toMatchObject({ ok: true, state: { status: 'canceled' } });
  });

  it('finalizes ordinary support and consent data while retaining only bounded evidence', async () => {
    const repository = new SerializableLifecycleRepository();
    const deps = dependencies(repository, []);
    repository.state.cases.set('case-one', {
      caseId: 'case-one',
      accountId: ACCOUNT_ID,
      version: 1n,
      status: 'open',
      plan: 'free',
      category: 'general',
      priority: 'normal',
      subjectRedacted: 'Synthetic case',
      responseTargetBusinessHours: 72,
      expectedResponseAt: '2030-08-06T12:00:00.000Z',
      history: [],
      attachments: [],
      createdAt: NOW,
      updatedAt: NOW,
    });
    repository.state.consents.set('consent-one', {
      consentId: 'consent-one',
      accountId: ACCOUNT_ID,
      caseId: 'case-one',
      purpose: 'synthetic diagnostic review',
      fieldClasses: ['hardware-summary'],
      grantedAt: NOW,
      expiresAt: '2030-08-04T12:00:00.000Z',
      status: 'active',
      version: 1n,
    });
    await deleteAccount(deps.deletion, {
      commandId: 'deletion-finalize-request',
      accountId: ACCOUNT_ID,
      expectedVersion: 0n,
      action: { kind: 'request', requestId: 'deletion-finalize-one', strongAuthVerified: true },
    });
    const finalized = await deleteAccount(
      { ...deps.deletion, clock: { now: () => new Date('2030-08-08T12:00:00.000Z') } },
      {
        commandId: 'deletion-finalize-run',
        accountId: ACCOUNT_ID,
        expectedVersion: 1n,
        action: {
          kind: 'finalize',
          evidence: [
            { evidenceClass: 'billing-invoice-tax', sourceAt: '2030-01-02T00:00:00.000Z' },
            { evidenceClass: 'security-recovery', sourceAt: '2030-03-04T00:00:00.000Z' },
          ],
        },
      },
    );
    expect(finalized).toMatchObject({ ok: true, state: { status: 'partially-retained' } });
    expect(repository.state.cases).toHaveLength(0);
    expect(repository.state.consents).toHaveLength(0);
    expect(repository.state.deletions.get(ACCOUNT_ID)?.retentionRecords).toEqual([
      expect.objectContaining({
        evidenceClass: 'billing-invoice-tax',
        retainUntil: '2035-01-02T00:00:00.000Z',
      }),
      expect.objectContaining({
        evidenceClass: 'security-recovery',
        retainUntil: '2032-03-04T00:00:00.000Z',
      }),
    ]);
    expect(repository.state.outbox).toContainEqual(
      expect.objectContaining({
        topic: 'account.deletion-completed',
        idempotencyKey: 'deletion-finalize-run:account.deletion-completed',
      }),
    );
  });

  it('registers owner-scoped generated HTTP operations and keeps strong auth server-owned', async () => {
    const repository = new SerializableLifecycleRepository();
    const changes: string[] = [];
    const deps = dependencies(repository, changes);
    const app = Fastify();
    apps.push(app);
    await registerSupportRoutes(app, {
      cases: deps.cases,
      consents: deps.consents,
      deletion: deps.deletion,
      resolveSessionActor: () => Promise.resolve({ accountId: ACCOUNT_ID }),
      verifyStrongReauthentication: (_request) => Promise.resolve(true),
      listCases: () => Promise.resolve([...repository.state.cases.values()]),
      listAttachmentMetadata: () => Promise.resolve([]),
      projectDeletion: () => Promise.resolve(repository.state.deletions.get(ACCOUNT_ID) ?? null),
    });
    await app.ready();

    const created = await app.inject({
      method: 'POST',
      url: '/v1/support/cases',
      payload: {
        command: command('create', 'route-create'),
        plan: 'free',
        category: 'general',
        subjectRedacted: 'Support request',
        message: 'A bounded support message.',
      },
    });
    expect(created.statusCode).toBe(201);
    expect((await app.inject({ method: 'GET', url: '/v1/support/cases' })).statusCode).toBe(200);
    const deletion = await app.inject({
      method: 'POST',
      url: '/v1/privacy/deletion',
      payload: {
        command: {
          schemaVersion: '1.0',
          kind: 'account-command',
          commandId: 'route-delete',
          accountId: ACCOUNT_ID,
          action: 'request-deletion',
          expectedVersion: '0',
          correlationId: 'correlation-delete',
          requestedAt: NOW,
        },
      },
    });
    expect(deletion.statusCode).toBe(202);
    expect(deletion.json()).not.toHaveProperty('strongAuthVerified');
  });
});
