import { describe, expect, it } from 'vitest';

const NOW = '2030-03-01T12:00:00.000Z';
type Decision = Readonly<Record<string, unknown>>;
type Operation = (input: Readonly<Record<string, unknown>>) => Decision;
type OperationsModule = Readonly<Record<string, Operation | undefined>>;

const loadOperations = async (): Promise<OperationsModule> =>
  import('./operations.js')
    .then((module) => module as unknown as OperationsModule)
    .catch((): OperationsModule => ({}));

const required = (module: OperationsModule, name: string): Operation => {
  const operation = module[name];
  if (operation === undefined) throw new Error(`EXPECTED_RED[04-44][${name}]`);
  return operation;
};

describe('D-99 through D-111 admin operational policy', () => {
  it('runs durable jobs through bounded transitions with safe cancellation and idempotent receipts', async () => {
    const decide = required(await loadOperations(), 'decideAdminJobTransition');
    const queued = {
      jobId: 'job-1',
      kind: 'export',
      status: 'queued',
      version: 1n,
      progress: 0,
      affectedItems: 20,
      idempotencyKey: 'idem-1',
      createdAt: NOW,
      updatedAt: NOW,
    };
    expect(decide({ state: queued, command: 'start', now: NOW })).toMatchObject({
      accepted: true,
      state: { status: 'running', version: 2n },
    });
    expect(
      decide({
        state: { ...queued, status: 'running', progress: 40 },
        command: 'cancel',
        now: NOW,
        safeCancellation: false,
      }),
    ).toEqual({ accepted: false, code: 'CANCELLATION_UNSAFE' });
    expect(
      decide({
        state: { ...queued, status: 'failed' },
        command: 'retry',
        now: NOW,
        idempotencyKey: 'idem-1',
      }),
    ).toMatchObject({ accepted: true, state: { status: 'queued' }, idempotent: true });
    expect(
      decide({
        state: { ...queued, status: 'running' },
        command: 'complete',
        now: NOW,
        progress: 100,
        receiptId: 'receipt-1',
      }),
    ).toMatchObject({ accepted: true, state: { status: 'completed', receiptId: 'receipt-1' } });
  });

  it('marks freshness honestly, blocks uncertain mutations and preserves incompatible drafts', async () => {
    const module = await loadOperations();
    const freshness = required(module, 'decideOperationalFreshness');
    const conflict = required(module, 'resolveAdminVersionConflict');
    expect(
      freshness({
        connection: 'disconnected',
        lastUpdatedAt: NOW,
        now: '2030-03-01T12:03:00.000Z',
        maximumAgeMs: 60_000,
        action: 'read',
      }),
    ).toEqual({ allowed: true, freshness: 'stale', manualRefreshRequired: true });
    expect(
      freshness({
        connection: 'degraded',
        lastUpdatedAt: NOW,
        now: NOW,
        maximumAgeMs: 60_000,
        action: 'critical-mutation',
      }),
    ).toEqual({ allowed: false, code: 'AUTHORITY_UNCERTAIN', secretlyQueued: false });
    expect(
      conflict({
        expectedVersion: 2n,
        actualVersion: 3n,
        base: { name: 'A', plan: 'free' },
        local: { name: 'B', plan: 'free' },
        remote: { name: 'A', plan: 'premium' },
      }),
    ).toMatchObject({ resolved: true, merged: { name: 'B', plan: 'premium' } });
    expect(
      conflict({
        expectedVersion: 2n,
        actualVersion: 3n,
        base: { name: 'A' },
        local: { name: 'B' },
        remote: { name: 'C' },
      }),
    ).toMatchObject({
      resolved: false,
      code: 'CONFLICT_REVIEW_REQUIRED',
      localDraft: { name: 'B' },
      remote: { name: 'C' },
    });
  });

  it('requires complete redacted audit evidence and risk-adaptive abuse controls', async () => {
    const module = await loadOperations();
    const audit = required(module, 'validateAdminOperationalAudit');
    const abuse = required(module, 'decideAdminAbuseControl');
    const record = {
      actorId: 'actor-1',
      activeFunction: 'security',
      scope: 'sessions',
      reason: 'contain incident',
      approvals: ['approver-1'],
      before: '[masked]',
      after: '[masked]',
      origin: 'admin.example',
      correlationId: 'corr-1',
      outcome: 'blocked',
    };
    expect(audit(record)).toEqual({
      valid: true,
      appendOnlyRequired: true,
      correctionMustLink: true,
    });
    expect(audit({ ...record, after: 'secret=abc' })).toEqual({
      valid: false,
      code: 'AUDIT_SECRET_FORBIDDEN',
    });
    expect(abuse({ riskScore: 95, stepUpSatisfied: false, override: false })).toEqual({
      action: 'temporary-block',
      securityAlertRequired: true,
      auditRequired: true,
    });
    expect(abuse({ riskScore: 60, stepUpSatisfied: false, override: false })).toEqual({
      action: 'require-step-up',
      securityAlertRequired: false,
      auditRequired: true,
    });
  });

  it('governs incident recovery and sensitive exports with preview, approval and compensation', async () => {
    const module = await loadOperations();
    const recovery = required(module, 'decideIncidentRecovery');
    const exportDecision = required(module, 'authorizeSensitiveExport');
    const baseRecovery = {
      incidentId: 'incident-1',
      severity: 'critical',
      ownerId: 'owner-1',
      procedureVersion: '3',
      boundedOperation: true,
      previewed: true,
      rehearsed: true,
      riskApproved: true,
      idempotencyKey: 'recover-1',
      validationDefined: true,
      compensationDefined: true,
    };
    expect(recovery(baseRecovery)).toEqual({
      allowed: true,
      incidentWorkspaceRequired: true,
      validationRequired: true,
      compensationRequired: true,
    });
    expect(recovery({ ...baseRecovery, boundedOperation: false })).toEqual({
      allowed: false,
      code: 'FREE_FORM_RECOVERY_FORBIDDEN',
    });
    const exportInput = {
      purpose: 'legal request',
      fields: ['account-id'],
      minimumFields: ['account-id'],
      previewed: true,
      masked: true,
      approved: true,
      encrypted: true,
      expiresAt: '2030-03-01T12:15:00.000Z',
      now: NOW,
    };
    expect(exportDecision(exportInput)).toEqual({
      allowed: true,
      auditRequired: true,
      downloadAuditRequired: true,
      expiryAuditRequired: true,
    });
    expect(exportDecision({ ...exportInput, masked: false })).toEqual({
      allowed: false,
      code: 'EXPORT_MASKING_REQUIRED',
    });
  });

  it('publishes product configuration only after governed rollout and forecasts every capacity authority', async () => {
    const module = await loadOperations();
    const configuration = required(module, 'decideAdminConfigurationTransition');
    const capacity = required(module, 'evaluateAdminCapacity');
    const draft = {
      configurationId: 'config-1',
      version: 1n,
      status: 'draft',
      environment: 'production',
      cohort: 'beta',
      knownVersion: 'v1',
    };
    expect(
      configuration({
        state: draft,
        command: 'publish',
        validated: true,
        impactReviewed: true,
        approved: true,
        now: NOW,
      }),
    ).toMatchObject({ accepted: true, state: { status: 'rolling-out', version: 2n } });
    expect(
      configuration({
        state: draft,
        command: 'publish',
        validated: true,
        impactReviewed: false,
        approved: true,
        now: NOW,
      }),
    ).toEqual({ accepted: false, code: 'IMPACT_REVIEW_REQUIRED' });
    expect(
      configuration({
        state: { ...draft, status: 'rolling-out', version: 2n },
        command: 'rollback',
        rollbackVersion: 'v1',
        now: NOW,
      }),
    ).toMatchObject({ accepted: true, state: { status: 'rolled-back', knownVersion: 'v1' } });
    expect(
      capacity({
        resource: 'database',
        currentUse: 80,
        safeLimit: 100,
        growthPerDay: 5,
        warningWindowDays: 7,
      }),
    ).toEqual({ level: 'warning', forecastExhaustionDays: 4, earlyActionRequired: true });
  });

  it('isolates environments and transfers urgent ownership with acknowledged external escalation', async () => {
    const module = await loadOperations();
    const environment = required(module, 'authorizeAdminEnvironment');
    const ownership = required(module, 'decideOperationalOwnership');
    expect(
      environment({
        sessionEnvironment: 'staging',
        targetEnvironment: 'production',
        productionStrongAccess: true,
        integrationEnvironment: 'production',
      }),
    ).toEqual({ allowed: false, code: 'ENVIRONMENT_CROSSING_FORBIDDEN' });
    expect(
      environment({
        sessionEnvironment: 'production',
        targetEnvironment: 'production',
        productionStrongAccess: true,
        integrationEnvironment: 'production',
      }),
    ).toEqual({ allowed: true, visualIdentityRequired: true });
    expect(
      ownership({
        priority: 'critical',
        ownerId: 'owner-1',
        substituteId: 'cover-1',
        ownerAvailable: false,
        deadline: '2030-03-01T12:05:00.000Z',
        now: NOW,
        externalChannelVerified: true,
        acknowledged: false,
        containsSensitivePayload: false,
      }),
    ).toEqual({
      action: 'escalate-to-substitute',
      externalAlertRequired: true,
      acknowledgementRequired: true,
    });
  });

  it('verifies privacy cases and scopes expiring emergency controls to only the harmful capability', async () => {
    const module = await loadOperations();
    const privacy = required(module, 'decidePrivacyCase');
    const emergency = required(module, 'decideEmergencyCapabilityStop');
    const base = {
      identityVerified: true,
      legalBasis: 'LGPD request',
      dataDiscovered: true,
      mandatoryRetentionReviewed: true,
      impactReviewed: true,
      approved: true,
      executionDefined: true,
      finalReceiptRequired: true,
    };
    expect(privacy(base)).toEqual({ allowed: true, finalReceiptRequired: true });
    expect(privacy({ ...base, identityVerified: false })).toEqual({
      allowed: false,
      code: 'PRIVACY_IDENTITY_REQUIRED',
    });
    const stop = {
      capability: 'email:send',
      strongAuth: true,
      reason: 'provider sending corrupted messages',
      requestedAt: NOW,
      expiresAt: '2030-03-01T12:15:00.000Z',
      safeRestorationDefined: true,
    };
    expect(emergency(stop)).toEqual({
      allowed: true,
      pausedCapability: 'email:send',
      globalStop: false,
      promptReviewRequired: true,
    });
    expect(emergency({ ...stop, capability: '*' })).toEqual({
      allowed: false,
      code: 'GLOBAL_STOP_FORBIDDEN',
    });
  });
});
