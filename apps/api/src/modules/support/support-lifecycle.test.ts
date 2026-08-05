import type {
  DeleteAccountDependencies,
  ManageConsentDependencies,
  ManageSupportCaseDependencies,
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
import type {
  AccountDeletionState,
  DiagnosticConsentState,
  SupportCaseState,
} from '@liiiraa/control-plane-domain';
import Fastify from 'fastify';
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
      findCommandResult: (commandId) => Promise.resolve(this.state.commandResults.get(commandId) ?? null),
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
      loadDeletion: (accountId) => Promise.resolve(this.state.deletions.get(accountId) ?? null),
      saveDeletion: (state) => {
        this.state.deletions.set(state.accountId, state);
        return Promise.resolve();
      },
      appendAudit: (record) => {
        this.state.audits.push(structuredClone(record));
        return Promise.resolve();
      },
      enqueueOutbox: (job) => {
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

const command = (action: 'create' | 'reply' | 'close', commandId: string, expectedVersion = '0') => ({
  schemaVersion: '1.0',
  kind: 'support-command',
  commandId,
  accountId: ACCOUNT_ID,
  supportCaseId: 'case-one',
  action,
  expectedVersion,
  correlationId: `correlation-${commandId}`,
  requestedAt: NOW,
} as const);

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

const apps: ReturnType<typeof Fastify>[] = [];

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

  it('revokes consent atomically, publishes the stream hook, and leaks no diagnostic bytes', async () => {
    const repository = new SerializableLifecycleRepository();
    const changes: string[] = [];
    const deps = dependencies(repository, changes);
    const grantCommand = {
      schemaVersion: '1.0', kind: 'consent-command', commandId: 'consent-grant',
      accountId: ACCOUNT_ID, consentId: 'consent-one', action: 'grant',
      scopes: ['support-diagnostics'], expectedVersion: '0', correlationId: 'correlation-consent-grant', requestedAt: NOW,
    } as const;
    const granted = await manageConsent(deps.consents, {
      command: grantCommand,
      action: {
        kind: 'grant', caseId: 'case-one', purpose: 'investigate invoice rendering',
        fieldClasses: ['application-log-redacted'], expiresAt: '2030-08-04T12:00:00.000Z',
      },
    });
    expect(granted).toMatchObject({ ok: true, state: { status: 'active' } });
    const revoked = await manageConsent(deps.consents, {
      command: { ...grantCommand, commandId: 'consent-revoke', action: 'revoke', expectedVersion: '1' },
      action: { kind: 'revoke' },
    });
    expect(revoked).toMatchObject({ ok: true, state: { status: 'revoked' } });
    expect(changes).toEqual(['consent-one']);
    expect(repository.state.outbox).toContainEqual(
      expect.objectContaining({ topic: 'support.consent-receipt', idempotencyKey: 'consent-revoke:support.consent-receipt' }),
    );
    expect(JSON.stringify({ audits: repository.state.audits, outbox: repository.state.outbox, consent: repository.state.consents.get('consent-one') }))
      .not.toMatch(/diagnosticBytes|tablePayload|top-secret/iu);
  });

  it('schedules, cancels, and finalizes deletion without duplicating lifecycle work', async () => {
    const repository = new SerializableLifecycleRepository();
    const changes: string[] = [];
    const deps = dependencies(repository, changes);
    const requestInput = {
      commandId: 'deletion-request', accountId: ACCOUNT_ID, expectedVersion: 0n,
      action: { kind: 'request' as const, requestId: 'deletion-one', strongAuthVerified: true },
    };
    const requested = await deleteAccount(deps.deletion, requestInput);
    const replayed = await deleteAccount(deps.deletion, requestInput);
    expect(requested).toEqual(replayed);
    expect(repository.state.outbox.filter((job) => job.topic === 'account.deletion-finalize')).toHaveLength(1);
    expect(repository.state.outbox).toContainEqual(expect.objectContaining({ availableAt: '2030-08-08T12:00:00.000Z' }));
    const canceled = await deleteAccount(deps.deletion, {
      commandId: 'deletion-cancel', accountId: ACCOUNT_ID, expectedVersion: 1n,
      action: { kind: 'cancel' },
    });
    expect(canceled).toMatchObject({ ok: true, state: { status: 'canceled' } });
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
      method: 'POST', url: '/v1/support/cases',
      payload: { command: command('create', 'route-create'), plan: 'free', category: 'general', subjectRedacted: 'Support request', message: 'A bounded support message.' },
    });
    expect(created.statusCode).toBe(201);
    expect((await app.inject({ method: 'GET', url: '/v1/support/cases' })).statusCode).toBe(200);
    const deletion = await app.inject({
      method: 'POST', url: '/v1/privacy/deletion',
      payload: { command: { schemaVersion: '1.0', kind: 'account-command', commandId: 'route-delete', accountId: ACCOUNT_ID, action: 'request-deletion', expectedVersion: '0', correlationId: 'correlation-delete', requestedAt: NOW } },
    });
    expect(deletion.statusCode).toBe(202);
    expect(deletion.json()).not.toHaveProperty('strongAuthVerified');
  });
});
