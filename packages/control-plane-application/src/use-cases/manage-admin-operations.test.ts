import { describe, expect, it, vi } from 'vitest';

import type { AdminConfigurationState, AdminJobState } from '@liiiraa/control-plane-domain';

import type {
  AdminOperationsAuthorizationPort,
  AdminOperationsCommandResult,
  AdminOperationsDependencies,
  AdminOperationsTransaction,
  AdminSearchQuery,
  AdminSearchRecord,
} from '../ports/admin-operations.js';
import {
  changeAdminConfiguration,
  executeAdminIncidentRecovery,
  executeAdminPrivacyCase,
  resolveAdminOperationalConflict,
  searchAdminOperations,
  startAdminSensitiveExport,
  stopAdminCapability,
  transitionAdminOperationalJob,
} from './manage-admin-operations.js';

const now = '2030-01-01T00:00:00.000Z';

const harness = () => {
  const records: AdminSearchRecord[] = [
    { recordId: 'visible', scope: 'support-cases', ownerId: 'operator', maskedTitle: 'Case •••1' },
    { recordId: 'hidden', scope: 'audit-events', ownerId: 'auditor', maskedTitle: 'Audit •••2' },
  ];
  const effects: string[] = [];
  const search = vi.fn((input: AdminSearchQuery) =>
    Promise.resolve(
      records.filter(
        (record) =>
          (input['allowedScopes'] as readonly string[]).includes(record.scope) &&
          (input['ownerId'] === undefined || record.ownerId === input['ownerId']),
      ),
    ),
  );
  const authorize = vi.fn<AdminOperationsAuthorizationPort['authorize']>(() =>
    Promise.resolve({
      allowed: true as const,
      allowedScopes: ['support-cases'] as const,
      ownerId: 'operator',
    }),
  );
  let transactionCount = 0;
  let id = 0;
  const commandResults = new Map<string, AdminOperationsCommandResult>();
  const jobs = new Map<string, AdminJobState>([
    [
      'job-1',
      {
        jobId: 'job-1',
        kind: 'import',
        status: 'running' as const,
        version: 1n,
        progress: 40,
        affectedItems: 10,
        idempotencyKey: 'idem-1',
        createdAt: now,
        updatedAt: now,
      },
    ],
  ]);
  const configurations = new Map<string, AdminConfigurationState>([
    [
      'config-1',
      {
        configurationId: 'config-1',
        version: 1n,
        status: 'draft' as const,
        environment: 'staging',
        cohort: 'internal',
        knownVersion: 'v1',
      },
    ],
  ]);
  const repository: AdminOperationsDependencies['repository'] = {
    search,
    transaction: async (_subjectId, operation) => {
      transactionCount += 1;
      const pending: (() => void)[] = [];
      const transaction: AdminOperationsTransaction = {
        findCommandResult: (commandId) => Promise.resolve(commandResults.get(commandId) ?? null),
        rememberCommandResult: (commandId, result) => {
          pending.push(() => commandResults.set(commandId, result));
          return Promise.resolve();
        },
        loadJob: (jobId) => Promise.resolve(jobs.get(jobId) ?? null),
        saveJob: (state) => {
          pending.push(() => jobs.set(state.jobId, state));
          return Promise.resolve();
        },
        loadConfiguration: (configurationId) =>
          Promise.resolve(configurations.get(configurationId) ?? null),
        saveConfiguration: (state) => {
          pending.push(() => configurations.set(state.configurationId, state));
          return Promise.resolve();
        },
        saveConflictDraft: () => {
          pending.push(() => effects.push('conflict'));
          return Promise.resolve();
        },
        saveIncident: () => {
          pending.push(() => effects.push('incident'));
          return Promise.resolve();
        },
        saveExport: () => {
          pending.push(() => effects.push('export'));
          return Promise.resolve();
        },
        savePrivacyCase: () => {
          pending.push(() => effects.push('privacy'));
          return Promise.resolve();
        },
        saveEmergencyStop: () => {
          pending.push(() => effects.push('emergency'));
          return Promise.resolve();
        },
        enqueueWork: () => {
          pending.push(() => effects.push('work'));
          return Promise.resolve();
        },
        appendAudit: () => {
          pending.push(() => effects.push('audit'));
          return Promise.resolve(`audit-${String(id + 1)}`);
        },
        enqueueOutbox: () => {
          pending.push(() => effects.push('outbox'));
          return Promise.resolve();
        },
        saveReceipt: () => {
          pending.push(() => effects.push('receipt'));
          return Promise.resolve();
        },
      };
      const result = await operation(transaction);
      for (const commit of pending) commit();
      return result;
    },
  };
  const alerts = { send: vi.fn(() => Promise.resolve()) };
  const dependencies: AdminOperationsDependencies = {
    authorization: { authorize },
    repository,
    alerts,
    clock: { now: () => new Date(now) },
    ids: { next: () => `id-${String(++id)}` },
    environment: 'staging',
    allowedProcedureVersions: ['recover-subscription:v1'],
    allowedEmergencyCapabilities: ['email-delivery', 'subscription-reconciliation'],
  };
  return {
    dependencies,
    authorize,
    search,
    jobs,
    configurations,
    effects,
    alerts,
    get transactionCount() {
      return transactionCount;
    },
  };
};

describe('transactional admin operations', () => {
  it('authorizes before search and injects server-owned scope, owner, and environment filters', async () => {
    const test = harness();
    test.authorize.mockResolvedValueOnce({ allowed: false as const, code: 'FORBIDDEN' });
    await expect(
      searchAdminOperations(test.dependencies, {
        actorId: 'operator',
        query: 'case',
        targetEnvironment: 'staging',
        view: { kind: 'official', viewId: 'support-open' },
      }),
    ).resolves.toEqual({ ok: false, code: 'FORBIDDEN' });
    expect(test.search).not.toHaveBeenCalled();

    await expect(
      searchAdminOperations(test.dependencies, {
        actorId: 'operator',
        query: 'case',
        targetEnvironment: 'staging',
        view: { kind: 'personal', viewId: 'mine' },
      }),
    ).resolves.toEqual({
      ok: true,
      freshness: 'current',
      records: [expect.objectContaining({ recordId: 'visible' })],
    });
    expect(test.search).toHaveBeenCalledWith(
      expect.objectContaining({
        allowedScopes: ['support-cases'],
        ownerId: 'operator',
        environment: 'staging',
      }),
    );
  });

  it('fails closed without secretly queueing a mutation when live authority is uncertain', async () => {
    const test = harness();
    await expect(
      transitionAdminOperationalJob(test.dependencies, {
        actorId: 'operator',
        commandId: 'job-command-1',
        correlationId: 'correlation-1',
        jobId: 'job-1',
        expectedVersion: 1n,
        idempotencyKey: 'idem-1',
        command: 'partial',
        progress: 60,
        receiptId: 'partial-receipt',
        connection: 'degraded',
        lastUpdatedAt: now,
        targetEnvironment: 'staging',
        reason: 'Provider returned partial results',
      }),
    ).resolves.toEqual({ ok: false, code: 'AUTHORITY_UNCERTAIN', secretlyQueued: false });
    expect(test.transactionCount).toBe(0);
    expect(test.effects).toEqual([]);
  });

  it('commits durable partial job progress with audit, outbox, receipt, and replay evidence', async () => {
    const test = harness();
    const input = {
      actorId: 'operator',
      commandId: 'job-command-2',
      correlationId: 'correlation-2',
      jobId: 'job-1',
      expectedVersion: 1n,
      idempotencyKey: 'idem-1',
      command: 'partial',
      progress: 60,
      receiptId: 'partial-receipt',
      connection: 'connected',
      lastUpdatedAt: now,
      targetEnvironment: 'staging',
      reason: 'Provider returned partial results',
    } as const;
    await expect(transitionAdminOperationalJob(test.dependencies, input)).resolves.toMatchObject({
      ok: true,
      outcome: 'job-transitioned',
      state: { status: 'partial', progress: 60 },
    });
    expect(test.jobs.get('job-1')).toMatchObject({ status: 'partial', version: 2n });
    expect(test.effects).toEqual(expect.arrayContaining(['audit', 'outbox', 'receipt']));
    const effectsAfterFirstCommit = [...test.effects];
    await expect(transitionAdminOperationalJob(test.dependencies, input)).resolves.toMatchObject({
      ok: true,
      outcome: 'job-transitioned',
    });
    expect(test.effects).toEqual(effectsAfterFirstCommit);
  });

  it('preserves incompatible local drafts and exposes an explicit conflict outcome', async () => {
    const test = harness();
    await expect(
      resolveAdminOperationalConflict(test.dependencies, {
        actorId: 'operator',
        commandId: 'conflict-1',
        idempotencyKey: 'conflict-idem',
        correlationId: 'conflict-correlation',
        subjectId: 'config-1',
        expectedVersion: 1n,
        actualVersion: 2n,
        base: { cohort: 'a' },
        local: { cohort: 'b' },
        remote: { cohort: 'c' },
        targetEnvironment: 'staging',
      }),
    ).resolves.toMatchObject({
      ok: false,
      code: 'CONFLICT_REVIEW_REQUIRED',
      localDraft: { cohort: 'b' },
      conflictingFields: ['cohort'],
    });
    expect(test.effects).toContain('conflict');
    expect(test.effects).toEqual(expect.arrayContaining(['audit', 'outbox', 'receipt']));
  });

  it('admits only allowlisted bounded recovery and emits payload-free external escalation', async () => {
    const test = harness();
    const base = {
      actorId: 'operator',
      commandId: 'recovery-1',
      correlationId: 'correlation-recovery',
      incidentId: 'incident-1',
      severity: 'critical',
      ownerId: 'owner',
      substituteId: 'substitute',
      ownerAvailable: false,
      deadline: now,
      procedureVersion: 'free-form-script:v1',
      boundedOperation: false,
      previewed: true,
      rehearsed: true,
      riskApproved: true,
      idempotencyKey: 'recovery-idem',
      validationDefined: true,
      compensationDefined: true,
      targetEnvironment: 'staging',
    } as const;
    await expect(executeAdminIncidentRecovery(test.dependencies, base)).resolves.toEqual({
      ok: false,
      code: 'FREE_FORM_RECOVERY_FORBIDDEN',
    });
    expect(test.transactionCount).toBe(0);

    await expect(
      executeAdminIncidentRecovery(test.dependencies, {
        ...base,
        commandId: 'recovery-2',
        procedureVersion: 'recover-subscription:v1',
        boundedOperation: true,
      }),
    ).resolves.toMatchObject({ ok: true, outcome: 'recovery-started' });
    expect(test.alerts.send).toHaveBeenCalledWith({
      incidentId: 'incident-1',
      severity: 'critical',
      ownerReference: 'substitute',
      correlationId: 'correlation-recovery',
    });
    expect(JSON.stringify(test.alerts.send.mock.calls)).not.toMatch(
      /diagnostic|token|secret|payload/iu,
    );
  });

  it('enforces minimum-scope encrypted exports and exact environment configuration', async () => {
    const test = harness();
    const exportInput = {
      actorId: 'auditor',
      commandId: 'export-1',
      idempotencyKey: 'export-idem',
      correlationId: 'export-correlation',
      purpose: 'Quarterly access review',
      fields: ['recordId', 'secret'],
      minimumFields: ['recordId', 'status'],
      previewed: true,
      masked: true,
      approved: true,
      encrypted: true,
      expiresAt: '2030-01-01T01:00:00.000Z',
      targetEnvironment: 'staging',
    } as const;
    await expect(startAdminSensitiveExport(test.dependencies, exportInput)).resolves.toEqual({
      ok: false,
      code: 'EXPORT_SCOPE_EXCESSIVE',
    });
    await expect(
      startAdminSensitiveExport(test.dependencies, {
        ...exportInput,
        commandId: 'export-2',
        fields: ['recordId'],
      }),
    ).resolves.toMatchObject({ ok: true, outcome: 'export-started' });

    await expect(
      changeAdminConfiguration(test.dependencies, {
        actorId: 'operator',
        commandId: 'config-command-1',
        idempotencyKey: 'config-idem',
        correlationId: 'config-correlation',
        configurationId: 'config-1',
        expectedVersion: 1n,
        command: 'publish',
        validated: true,
        impactReviewed: true,
        approved: true,
        sessionEnvironment: 'staging',
        targetEnvironment: 'production',
        integrationEnvironment: 'production',
        productionStrongAccess: false,
        reason: 'Publish internal configuration',
      }),
    ).resolves.toEqual({ ok: false, code: 'ENVIRONMENT_CROSSING_FORBIDDEN' });

    await expect(
      changeAdminConfiguration(test.dependencies, {
        actorId: 'operator',
        commandId: 'config-command-2',
        idempotencyKey: 'config-idem-2',
        correlationId: 'config-correlation-2',
        configurationId: 'config-1',
        expectedVersion: 1n,
        command: 'publish',
        validated: true,
        impactReviewed: true,
        approved: true,
        sessionEnvironment: 'staging',
        targetEnvironment: 'staging',
        integrationEnvironment: 'staging',
        productionStrongAccess: false,
        reason: 'Publish internal configuration',
      }),
    ).resolves.toMatchObject({ ok: true, state: { status: 'rolling-out', version: 2n } });
    await expect(
      changeAdminConfiguration(test.dependencies, {
        actorId: 'operator',
        commandId: 'config-command-3',
        idempotencyKey: 'config-idem-3',
        correlationId: 'config-correlation-3',
        configurationId: 'config-1',
        expectedVersion: 2n,
        command: 'rollback',
        rollbackVersion: 'v0',
        sessionEnvironment: 'staging',
        targetEnvironment: 'staging',
        integrationEnvironment: 'staging',
        productionStrongAccess: false,
        reason: 'Rollback internal configuration',
      }),
    ).resolves.toMatchObject({
      ok: true,
      state: { status: 'rolled-back', version: 3n, knownVersion: 'v0' },
    });
  });

  it('executes approved privacy work and rejects global or unknown emergency stops', async () => {
    const test = harness();
    await expect(
      executeAdminPrivacyCase(test.dependencies, {
        actorId: 'auditor',
        commandId: 'privacy-1',
        idempotencyKey: 'privacy-idem',
        correlationId: 'privacy-correlation',
        caseId: 'privacy-case-1',
        identityVerified: true,
        legalBasis: 'LGPD data subject request',
        dataDiscovered: true,
        mandatoryRetentionReviewed: true,
        impactReviewed: true,
        approved: true,
        executionDefined: true,
        finalReceiptRequired: true,
        targetEnvironment: 'staging',
      }),
    ).resolves.toMatchObject({ ok: true, outcome: 'privacy-case-started' });
    await expect(
      stopAdminCapability(test.dependencies, {
        actorId: 'security',
        commandId: 'stop-1',
        idempotencyKey: 'stop-idem-1',
        correlationId: 'stop-correlation',
        capability: '*',
        strongAuth: true,
        reason: 'Contain provider incident',
        expiresAt: '2030-01-01T00:30:00.000Z',
        safeRestorationDefined: true,
        targetEnvironment: 'staging',
      }),
    ).resolves.toEqual({ ok: false, code: 'GLOBAL_STOP_FORBIDDEN' });
    await expect(
      stopAdminCapability(test.dependencies, {
        actorId: 'security',
        commandId: 'stop-unknown',
        idempotencyKey: 'stop-idem-unknown',
        correlationId: 'stop-correlation',
        capability: 'unknown-capability',
        strongAuth: true,
        reason: 'Contain provider incident',
        expiresAt: '2030-01-01T00:30:00.000Z',
        safeRestorationDefined: true,
        targetEnvironment: 'staging',
      }),
    ).resolves.toEqual({ ok: false, code: 'CAPABILITY_NOT_ALLOWLISTED' });
    await expect(
      stopAdminCapability(test.dependencies, {
        actorId: 'security',
        commandId: 'stop-2',
        idempotencyKey: 'stop-idem-2',
        correlationId: 'stop-correlation',
        capability: 'email-delivery',
        strongAuth: true,
        reason: 'Contain provider incident',
        expiresAt: '2030-01-01T00:30:00.000Z',
        safeRestorationDefined: true,
        targetEnvironment: 'staging',
      }),
    ).resolves.toMatchObject({ ok: true, outcome: 'capability-paused', globalStop: false });
  });
});
