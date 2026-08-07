import { describe, expect, it } from 'vitest';

import {
  projectCapacityAuthority,
  projectOperationalJob,
  reconcileOperationalDraft,
  reviewConfigurationTransition,
  reviewEmergencyCapabilityStop,
  reviewIncidentRecovery,
  reviewPrivacyCaseExecution,
} from './admin-operations-system-model';

describe('admin operations, security, and system presentation policy', () => {
  it('projects truthful job progress, valid transitions, partial failures, and durable receipts', () => {
    expect(
      projectOperationalJob({
        completedItems: 42,
        failedItems: 3,
        freshness: 'live',
        progressPercent: 45,
        receiptReference: 'receipt-job-0001',
        state: 'partial',
        totalItems: 100,
      }),
    ).toEqual({
      completedItems: 42,
      failedItems: 3,
      nextTransitions: ['retry', 'cancel'],
      pendingItems: 55,
      progressPercent: 45,
      receiptReference: 'receipt-job-0001',
      state: 'partial',
    });

    expect(
      projectOperationalJob({
        completedItems: 1,
        failedItems: 0,
        freshness: 'reconnecting',
        progressPercent: 10,
        state: 'running',
        totalItems: 10,
      }),
    ).toMatchObject({
      mutationsAllowed: false,
      nextTransitions: [],
      safeCode: 'AUTHORITATIVE_REFRESH_REQUIRED',
      secretlyQueued: false,
    });
  });

  it('admits only allowlisted, previewed, rehearsed, validated, and compensated recovery', () => {
    const base = {
      approved: true,
      boundedOperation: true,
      compensationDefined: true,
      ownerAvailable: false,
      ownerReference: 'administrator-operations-0001',
      previewed: true,
      procedureVersion: 'recover-webhook-delivery@2.1.0',
      rehearsed: true,
      severity: 'critical' as const,
      substituteReference: 'administrator-security-0001',
      validationDefined: true,
    };
    expect(
      reviewIncidentRecovery({
        ...base,
        allowedProcedureVersions: ['recover-webhook-delivery@2.1.0'],
      }),
    ).toEqual({
      admitted: true,
      compensationRequired: true,
      executionOwner: 'administrator-security-0001',
      procedureVersion: 'recover-webhook-delivery@2.1.0',
      validationRequired: true,
    });
    expect(
      reviewIncidentRecovery({
        ...base,
        allowedProcedureVersions: ['recover-webhook-delivery@2.1.0'],
        scriptText: 'powershell -Command arbitrary',
      }),
    ).toEqual({ admitted: false, code: 'ARBITRARY_EXECUTION_FORBIDDEN' });
    expect(
      reviewIncidentRecovery({
        ...base,
        allowedProcedureVersions: ['recover-account-lock@1.0.0'],
      }),
    ).toEqual({ admitted: false, code: 'PROCEDURE_NOT_ALLOWLISTED' });
  });

  it('keeps configuration rollout environment-bound, approved, versioned, and reversible', () => {
    const base = {
      approved: true,
      authority: 'live' as const,
      impactReviewed: true,
      integrationEnvironment: 'production' as const,
      knownVersion: '3.4.0',
      rollbackVersion: '3.3.2',
      sessionEnvironment: 'production' as const,
      strongAccess: true,
      targetEnvironment: 'production' as const,
      transition: 'publish' as const,
      validated: true,
    };
    expect(reviewConfigurationTransition(base)).toEqual({
      admitted: true,
      knownVersion: '3.4.0',
      rollbackVersion: '3.3.2',
      transition: 'publish',
    });
    expect(reviewConfigurationTransition({ ...base, strongAccess: false })).toEqual({
      admitted: false,
      code: 'PRODUCTION_STRONG_ACCESS_REQUIRED',
    });
    expect(reviewConfigurationTransition({ ...base, integrationEnvironment: 'staging' })).toEqual({
      admitted: false,
      code: 'ENVIRONMENT_CROSSING_FORBIDDEN',
    });
    const { rollbackVersion, ...withoutRollback } = base;
    expect(rollbackVersion).toBe('3.3.2');
    expect(reviewConfigurationTransition(withoutRollback)).toEqual({
      admitted: false,
      code: 'ROLLBACK_PATH_REQUIRED',
    });
  });

  it('projects capacity without inventing forecasts and distinguishes safe limit exhaustion', () => {
    expect(
      projectCapacityAuthority({
        currentUse: 820,
        forecastExhaustionAt: '2026-08-12T12:00:00.000Z',
        growthPerDay: 24,
        observedAt: '2026-08-07T12:00:00.000Z',
        safeLimit: 1_000,
      }),
    ).toEqual({
      currentUse: 820,
      forecastExhaustionAt: '2026-08-12T12:00:00.000Z',
      growthPerDay: 24,
      observedAt: '2026-08-07T12:00:00.000Z',
      recommendedAction: 'review-capacity',
      remaining: 180,
      safeLimit: 1_000,
      state: 'warning',
      utilizationPercent: 82,
    });
    expect(
      projectCapacityAuthority({
        currentUse: 820,
        observedAt: '2026-08-07T12:00:00.000Z',
        safeLimit: 1_000,
      }),
    ).toMatchObject({
      forecastState: 'unknown',
      recommendedAction: 'measure-growth',
      state: 'uncertain',
    });
  });

  it('requires verified legal, retention, impact, approval, execution, and final receipt evidence', () => {
    const complete = {
      approved: true,
      dataDiscovered: true,
      executionDefined: true,
      finalReceiptRequired: true,
      identityVerified: true,
      impactReviewed: true,
      legalBasis: 'LGPD data subject deletion request.',
      mandatoryRetentionReviewed: true,
    };
    expect(reviewPrivacyCaseExecution(complete)).toEqual({
      admitted: true,
      finalReceiptRequired: true,
      legalBasis: 'LGPD data subject deletion request.',
      nextState: 'executing',
    });
    expect(reviewPrivacyCaseExecution({ ...complete, mandatoryRetentionReviewed: false })).toEqual({
      admitted: false,
      code: 'RETENTION_REVIEW_REQUIRED',
    });
  });

  it('stops only an allowlisted harmful capability with strong auth, expiry, and restoration', () => {
    const base = {
      allowedCapabilities: ['billing-webhook-ingress', 'invitation-delivery'],
      capability: 'billing-webhook-ingress',
      expiresAt: '2026-08-07T12:30:00.000Z',
      now: '2026-08-07T12:00:00.000Z',
      reason: 'Contain duplicate provider delivery while reconciliation remains available.',
      safeRestorationDefined: true,
      strongAuth: true,
    };
    expect(reviewEmergencyCapabilityStop(base)).toEqual({
      admitted: true,
      capability: 'billing-webhook-ingress',
      expiresAt: '2026-08-07T12:30:00.000Z',
      globalStop: false,
      restorationRequired: true,
    });
    expect(reviewEmergencyCapabilityStop({ ...base, capability: '*' })).toEqual({
      admitted: false,
      code: 'CAPABILITY_NOT_ALLOWLISTED',
    });
    expect(
      reviewEmergencyCapabilityStop({
        ...base,
        expiresAt: '2026-08-08T12:00:00.000Z',
      }),
    ).toEqual({ admitted: false, code: 'EMERGENCY_EXPIRY_INVALID' });
  });

  it('merges independent operational edits and preserves conflicting local drafts', () => {
    const base = { ownerReference: 'operations-1', reason: 'Initial incident review' };
    expect(
      reconcileOperationalDraft({
        base,
        current: { ownerReference: 'operations-2', reason: base.reason },
        currentVersion: '9',
        draft: { ownerReference: base.ownerReference, reason: 'Validate recovery procedure' },
        expectedVersion: '8',
      }),
    ).toMatchObject({
      merged: { ownerReference: 'operations-2', reason: 'Validate recovery procedure' },
      status: 'merged',
    });
    expect(
      reconcileOperationalDraft({
        base,
        current: { ...base, reason: 'Remote containment decision' },
        currentVersion: '9',
        draft: { ...base, reason: 'Local recovery decision' },
        expectedVersion: '8',
      }),
    ).toMatchObject({
      preservedDraft: { reason: 'Local recovery decision' },
      status: 'review',
    });
  });
});
