import { describe, expect, it } from 'vitest';

import {
  deriveAccessAuthorityState,
  eligibleGovernanceApprovers,
  maskGovernanceHistory,
  projectAccessReview,
  projectAdminOffboarding,
  projectDelegationWindow,
  projectFunctionSimulation,
  projectFunctionSwitch,
  projectPermissionImpact,
  reconcileGovernanceDraft,
  reviewBreakGlass,
  reviewGovernanceTransition,
} from './admin-access-model';

const now = '2026-08-07T12:00:00.000Z';

describe('admin access governance presentation policy', () => {
  it('recomputes the complete authority surface when the active function changes', () => {
    expect(
      projectFunctionSwitch({
        assignedFunctions: ['support', 'security'],
        currentFunction: 'support',
        targetFunction: 'security',
      }),
    ).toEqual({
      admitted: true,
      activeFunction: 'security',
      capabilities: ['session:revoke', 'diagnostics:view', 'audit:reveal-sensitive'],
      dataScopes: ['sessions', 'diagnostic-metadata'],
      focusTarget: 'admin-main',
      navigation: ['security'],
      reasonRequired: true,
      reauthenticationRequired: true,
    });
    expect(
      projectFunctionSwitch({
        assignedFunctions: ['support'],
        currentFunction: 'support',
        targetFunction: 'audit',
      }),
    ).toEqual({ admitted: false, code: 'FUNCTION_NOT_ASSIGNED' });
  });

  it('shows complete permission impact and immediate session effects', () => {
    const impact = projectPermissionImpact({
      before: {
        capabilities: ['support:view', 'support:reply'],
        functions: ['support'],
        scopes: ['support-cases'],
      },
      after: {
        capabilities: ['session:revoke', 'diagnostics:view'],
        functions: ['security'],
        scopes: ['sessions', 'diagnostic-metadata'],
      },
      conflicts: ['separation-of-duties:finance-security'],
      sessionReferences: ['session-001', 'session-002'],
    });
    expect(impact.gainedCapabilities).toEqual(['session:revoke', 'diagnostics:view']);
    expect(impact.lostCapabilities).toEqual(['support:view', 'support:reply']);
    expect(impact.affectedData).toEqual(['diagnostic-metadata', 'sessions', 'support-cases']);
    expect(impact.conflicts).toEqual(['separation-of-duties:finance-security']);
    expect(impact.sessionsToRevoke).toEqual(['session-001', 'session-002']);
    expect(impact.sessionRevocationRequired).toBe(true);
  });

  it('excludes the author, beneficiary, expired, and incompatible approvers', () => {
    expect(
      eligibleGovernanceApprovers({
        authorReference: 'admin-author',
        beneficiaryReference: 'admin-beneficiary',
        capability: 'admin-permissions:manage',
        now,
        scope: 'membership',
        candidates: [
          {
            actorReference: 'admin-author',
            capabilities: ['admin-permissions:manage'],
            scopes: ['membership'],
            state: 'active',
          },
          {
            actorReference: 'admin-beneficiary',
            capabilities: ['admin-permissions:manage'],
            scopes: ['membership'],
            state: 'active',
          },
          {
            actorReference: 'admin-expired',
            capabilities: ['admin-permissions:manage'],
            expiresAt: '2026-08-07T11:59:59.000Z',
            scopes: ['membership'],
            state: 'active',
          },
          {
            actorReference: 'admin-wrong-scope',
            capabilities: ['admin-permissions:manage'],
            scopes: ['support-cases'],
            state: 'active',
          },
          {
            actorReference: 'admin-independent',
            capabilities: ['admin-permissions:manage'],
            scopes: ['membership'],
            state: 'active',
          },
        ],
      }),
    ).toEqual(['admin-independent']);
  });

  it('enforces impact, step-up, approval expiry, and the two-person rule by risk', () => {
    expect(
      reviewGovernanceTransition({
        approvalExpiresAt: '2026-08-07T12:10:00.000Z',
        approvalReferences: [],
        authority: 'live',
        impactReviewed: true,
        massAction: false,
        now,
        reason: 'Rotate access after role change',
        reauthenticated: true,
        risk: 'critical',
      }),
    ).toEqual({ admitted: false, code: 'INDEPENDENT_APPROVER_REQUIRED' });
    expect(
      reviewGovernanceTransition({
        approvalExpiresAt: '2026-08-07T12:10:00.000Z',
        approvalReferences: ['approval-001'],
        authority: 'live',
        impactReviewed: true,
        massAction: true,
        now,
        reason: 'Rotate access after role change',
        reauthenticated: true,
        risk: 'high',
      }),
    ).toMatchObject({ admitted: true, twoPersonRequired: true });
    expect(
      reviewGovernanceTransition({
        approvalExpiresAt: '2026-08-07T12:16:00.000Z',
        approvalReferences: ['approval-001'],
        authority: 'live',
        impactReviewed: true,
        massAction: false,
        now,
        reason: 'Rotate access after role change',
        reauthenticated: true,
        risk: 'critical',
      }),
    ).toEqual({ admitted: false, code: 'APPROVAL_WINDOW_INVALID' });
  });

  it('projects delegation expiry and its exact revocation consequences', () => {
    expect(
      projectDelegationWindow({
        capabilities: ['support:view'],
        expiresAt: '2026-08-08T12:00:00.000Z',
        now,
        scopes: ['support-cases'],
        state: 'active',
      }),
    ).toMatchObject({ active: true, expiresInMinutes: 1440 });
    expect(
      projectDelegationWindow({
        capabilities: ['support:view'],
        expiresAt: '2026-08-07T11:00:00.000Z',
        now,
        scopes: ['support-cases'],
        state: 'active',
      }),
    ).toEqual({
      active: false,
      consequences: ['capabilities-revoked', 'scopes-revoked', 'sessions-revalidated'],
      expired: true,
      expiresInMinutes: 0,
    });
  });

  it('makes recertification, inactivity, and deviation alerts explicit at boundaries', () => {
    expect(
      projectAccessReview({
        accessClass: 'critical',
        deviationDetected: true,
        lastActiveAt: '2026-06-23T12:00:00.000Z',
        lastReviewedAt: '2026-07-08T12:00:00.000Z',
        now,
      }),
    ).toEqual({ deviationAlertRequired: true, inactivityAction: 'suspend', reviewDue: true });
  });

  it('offboards with redistribution, session revocation, and immutable history', () => {
    expect(projectAdminOffboarding({ identityReference: 'admin-001', reason: 'Employment ended' }))
      .toEqual({
        admitted: true,
        effects: [
          'suspend-membership',
          'revoke-sessions',
          'revoke-delegations',
          'remove-future-approvals',
          'reassign-pending-work',
          'preserve-immutable-history',
        ],
        irreversible: true,
      });
  });

  it('keeps target-function simulation read-only and secret-free', () => {
    expect(
      projectFunctionSimulation({
        assignedFunctions: ['support', 'audit'],
        targetFunction: 'audit',
      }),
    ).toEqual({
      admitted: true,
      activeFunction: 'audit',
      canAuthorizeAction: false,
      capabilities: ['audit:export', 'audit:reveal-sensitive'],
      dataScopes: ['audit-events'],
      navigation: ['security'],
      secretsInherited: false,
      simulation: true,
    });
  });

  it('never lets break-glass bypass irreversible or mass two-person authority', () => {
    const base = {
      administratorCount: 1,
      alertsSent: true,
      executeAt: '2026-08-07T12:05:00.000Z',
      expiresAt: '2026-08-07T12:15:00.000Z',
      massAction: false,
      now,
      reason: 'Restore access during owner lockout',
      reauthenticatedAt: '2026-08-07T11:58:00.000Z',
      safetyDelayUntil: '2026-08-07T12:05:00.000Z',
      strongFactor: 'passkey',
    } as const;
    expect(reviewBreakGlass({ ...base, risk: 'irreversible' })).toEqual({
      admitted: false,
      code: 'BREAK_GLASS_PROHIBITED',
    });
    expect(reviewBreakGlass({ ...base, massAction: true, risk: 'critical' })).toEqual({
      admitted: false,
      code: 'BREAK_GLASS_PROHIBITED',
    });
    expect(reviewBreakGlass({ ...base, risk: 'critical' })).toMatchObject({
      admitted: true,
      enhancedAuditRequired: true,
      standingAuthority: false,
    });
  });

  it('masks history and refuses sensitive reveal-shaped values', () => {
    expect(
      maskGovernanceHistory([
        { at: now, kind: 'permission-change', outcome: 'approved' },
        { at: now, kind: 'access-review', outcome: 'user@example.com' },
      ]),
    ).toEqual([
      { at: now, kind: 'permission-change', outcome: 'approved' },
      { at: now, kind: 'access-review', outcome: '[masked]' },
    ]);
  });

  it('invalidates stale authority and preserves conflicting drafts for review', () => {
    expect(deriveAccessAuthorityState({ freshness: 'live', invalidated: true })).toEqual({
      canMutate: false,
      requiresRefetch: true,
      state: 'stale',
    });
    expect(
      reconcileGovernanceDraft({
        base: { reason: 'Original reason', risk: 'high' },
        current: { reason: 'Server reason', risk: 'high' },
        currentVersion: '8',
        draft: { reason: 'Operator reason', risk: 'critical' },
        expectedVersion: '7',
      }),
    ).toMatchObject({
      preservedDraft: { reason: 'Operator reason' },
      status: 'review',
    });
  });
});
