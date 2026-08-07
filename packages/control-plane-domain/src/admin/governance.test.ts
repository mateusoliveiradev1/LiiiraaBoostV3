import { describe, expect, it } from 'vitest';

const OWNER = '04-43-01';
const NOW = '2030-02-01T12:00:00.000Z';

type Decision = Readonly<Record<string, unknown>>;
type GovernanceModule = Readonly<{
  decideAdminMembershipActivation?: (input: Readonly<Record<string, unknown>>) => Decision;
  decideAdminFunctionSwitch?: (
    membership: Readonly<Record<string, unknown>>,
    session: Readonly<Record<string, unknown>>,
    input: Readonly<Record<string, unknown>>,
  ) => Decision;
  authorizeAdminCapability?: (
    session: Readonly<Record<string, unknown>>,
    input: Readonly<Record<string, unknown>>,
  ) => Decision;
  decideAdminRiskAdmission?: (input: Readonly<Record<string, unknown>>) => Decision;
  decideBreakGlassAdmission?: (input: Readonly<Record<string, unknown>>) => Decision;
  decideAdminDelegation?: (input: Readonly<Record<string, unknown>>) => Decision;
  evaluateAdminDelegation?: (
    state: Readonly<Record<string, unknown>>,
    now: string,
  ) => Decision;
  decideAdminOffboarding?: (input: Readonly<Record<string, unknown>>) => Decision;
  evaluateAdminAccessGovernance?: (input: Readonly<Record<string, unknown>>) => Decision;
  decideAdminReactivation?: (input: Readonly<Record<string, unknown>>) => Decision;
  projectAdminFunctionSimulation?: (
    membership: Readonly<Record<string, unknown>>,
    targetFunction: string,
  ) => Decision;
  projectAdminAuditField?: (input: Readonly<Record<string, unknown>>) => Decision;
}>;

const loadGovernance = async (): Promise<GovernanceModule> =>
  import('./governance.js')
    .then((module) => module as unknown as GovernanceModule)
    .catch((): GovernanceModule => ({}));

const requireFunction = <T extends (...args: never[]) => unknown>(
  value: T | undefined,
  caseId: string,
): T => {
  if (typeof value !== 'function') {
    throw new Error(`EXPECTED_RED[${OWNER}][${caseId}]: admin governance is not implemented`);
  }
  return value;
};

const activateInput = (overrides: Readonly<Record<string, unknown>> = {}) => ({
  membershipId: 'membership-owner',
  identityId: 'identity-owner',
  administrativeInvitationKind: 'administrative-team',
  invitationVerified: true,
  emailVerified: true,
  strongFactor: 'passkey',
  sharedCredential: false,
  functions: ['support', 'operations', 'security', 'audit'],
  now: NOW,
  ...overrides,
});

const activatedMembership = async (): Promise<Readonly<Record<string, unknown>>> => {
  const module = await loadGovernance();
  const activate = requireFunction(
    module.decideAdminMembershipActivation,
    'membership-fixture',
  );
  const decision = activate(activateInput());
  if (decision['allowed'] !== true || typeof decision['state'] !== 'object') {
    throw new Error(`EXPECTED_RED[${OWNER}][membership-fixture]: membership did not activate`);
  }
  return decision['state'] as Readonly<Record<string, unknown>>;
};

describe('D-78 through D-87 administrative access governance', () => {
  it('activates only a separate verified admin invitation with an individual strong factor', async () => {
    const module = await loadGovernance();
    const activate = requireFunction(
      module.decideAdminMembershipActivation,
      'D-78-membership-activation',
    );

    expect(activate(activateInput())).toMatchObject({
      allowed: true,
      state: {
        status: 'active',
        functions: ['support', 'operations', 'security', 'audit'],
      },
    });
    expect(
      activate(activateInput({ administrativeInvitationKind: 'beta' })),
    ).toEqual({ allowed: false, code: 'ADMIN_INVITATION_REQUIRED' });
    expect(activate(activateInput({ invitationVerified: false }))).toEqual({
      allowed: false,
      code: 'VERIFIED_INVITATION_REQUIRED',
    });
    expect(activate(activateInput({ emailVerified: false }))).toEqual({
      allowed: false,
      code: 'VERIFIED_IDENTITY_REQUIRED',
    });
    expect(activate(activateInput({ strongFactor: 'password' }))).toEqual({
      allowed: false,
      code: 'STRONG_FACTOR_REQUIRED',
    });
    expect(activate(activateInput({ sharedCredential: true }))).toEqual({
      allowed: false,
      code: 'SHARED_CREDENTIAL_FORBIDDEN',
    });
  });

  it('keeps one active function per session and recomputes navigation, data, and actions immediately', async () => {
    const module = await loadGovernance();
    const switchFunction = requireFunction(
      module.decideAdminFunctionSwitch,
      'D-79-singular-function-switch',
    );
    const authorize = requireFunction(
      module.authorizeAdminCapability,
      'D-79-capability-scope',
    );
    const membership = await activatedMembership();
    const supportSession = {
      sessionId: 'session-one',
      actorId: 'identity-owner',
      activeFunction: 'support',
      simulation: false,
      version: 1n,
    };

    const switched = switchFunction(membership, supportSession, {
      targetFunction: 'security',
      reason: 'respond to active credential incident',
      reauthenticated: true,
      now: '2030-02-01T12:05:00.000Z',
    });
    expect(switched).toMatchObject({
      allowed: true,
      session: {
        activeFunction: 'security',
        navigation: ['security'],
        dataScopes: ['sessions', 'diagnostic-metadata'],
        capabilities: ['session:revoke', 'diagnostics:view', 'audit:reveal-sensitive'],
      },
    });
    expect(
      authorize(switched['session'] as Readonly<Record<string, unknown>>, {
        capability: 'support:reply',
        scope: 'support-cases',
      }),
    ).toEqual({ allowed: false, code: 'CAPABILITY_FORBIDDEN' });
    expect(
      switchFunction(membership, supportSession, {
        targetFunction: 'super-admin',
        reason: ' ',
        reauthenticated: true,
        now: NOW,
      }),
    ).toEqual({ allowed: false, code: 'FUNCTION_INVALID' });
  });

  it('enforces the complete routine, sensitive, critical, and irreversible risk table without self-approval', async () => {
    const module = await loadGovernance();
    const decideRisk = requireFunction(
      module.decideAdminRiskAdmission,
      'D-80-D-85-risk-and-approval',
    );
    const base = {
      actorId: 'identity-author',
      beneficiaryId: 'identity-beneficiary',
      capability: 'access:grant',
      scope: 'organization',
      reason: 'approved access change',
      reauthenticated: true,
      impactReviewed: true,
      now: NOW,
      approvalExpiresAt: '2030-02-01T12:10:00.000Z',
      massAction: false,
      approvers: [
        {
          actorId: 'identity-approver',
          capabilities: ['access:grant'],
          scopes: ['organization'],
          approvedAt: '2030-02-01T12:01:00.000Z',
        },
      ],
    };

    expect(decideRisk({ ...base, risk: 'routine', approvers: [] })).toEqual({
      allowed: true,
      auditRequired: true,
      independentApproverIds: [],
    });
    expect(
      decideRisk({ ...base, risk: 'sensitive', reason: ' ', approvers: [] }),
    ).toEqual({ allowed: false, code: 'REASON_REQUIRED' });
    expect(
      decideRisk({ ...base, risk: 'sensitive', reauthenticated: false, approvers: [] }),
    ).toEqual({ allowed: false, code: 'REAUTHENTICATION_REQUIRED' });
    expect(decideRisk({ ...base, risk: 'critical' })).toMatchObject({
      allowed: true,
      auditRequired: true,
      independentApproverIds: ['identity-approver'],
    });
    expect(
      decideRisk({
        ...base,
        risk: 'critical',
        approvers: [
          { ...base.approvers[0], actorId: 'identity-author' },
          { ...base.approvers[0], actorId: 'identity-beneficiary' },
        ],
      }),
    ).toEqual({ allowed: false, code: 'INDEPENDENT_APPROVER_REQUIRED' });
    expect(decideRisk({ ...base, risk: 'irreversible', massAction: true })).toMatchObject({
      allowed: true,
      twoPersonRequired: true,
      shortApprovalWindow: true,
    });
    expect(
      decideRisk({
        ...base,
        risk: 'critical',
        approvers: [{ ...base.approvers[0], scopes: ['another-scope'] }],
      }),
    ).toEqual({ allowed: false, code: 'INDEPENDENT_APPROVER_REQUIRED' });
  });

  it('permits no standing break-glass and never bypasses irreversible or mass segregation', async () => {
    const module = await loadGovernance();
    const decideBreakGlass = requireFunction(
      module.decideBreakGlassAdmission,
      'D-81-break-glass',
    );
    const base = {
      actorId: 'identity-owner',
      administratorCount: 1,
      risk: 'critical',
      massAction: false,
      strongFactor: 'passkey',
      reauthenticatedAt: '2030-02-01T11:59:00.000Z',
      reason: 'contain active credential theft',
      requestedAt: NOW,
      safetyDelayUntil: '2030-02-01T12:02:00.000Z',
      executeAt: '2030-02-01T12:02:00.000Z',
      expiresAt: '2030-02-01T12:10:00.000Z',
      alertsSent: true,
    };
    expect(decideBreakGlass(base)).toEqual({
      allowed: true,
      standingAuthority: false,
      enhancedAuditRequired: true,
    });
    expect(decideBreakGlass({ ...base, risk: 'irreversible' })).toEqual({
      allowed: false,
      code: 'BREAK_GLASS_PROHIBITED',
    });
    expect(decideBreakGlass({ ...base, massAction: true })).toEqual({
      allowed: false,
      code: 'BREAK_GLASS_PROHIBITED',
    });
    expect(decideBreakGlass({ ...base, executeAt: '2030-02-01T12:01:59.999Z' })).toEqual({
      allowed: false,
      code: 'SAFETY_DELAY_ACTIVE',
    });
    expect(decideBreakGlass({ ...base, alertsSent: false })).toEqual({
      allowed: false,
      code: 'ALERT_REQUIRED',
    });
  });

  it('expires delegation automatically and offboards every live authority immediately', async () => {
    const module = await loadGovernance();
    const delegate = requireFunction(module.decideAdminDelegation, 'D-82-delegation');
    const evaluate = requireFunction(module.evaluateAdminDelegation, 'D-82-auto-expiry');
    const offboard = requireFunction(module.decideAdminOffboarding, 'D-83-offboarding');
    const decision = delegate({
      delegationId: 'delegation-one',
      delegatorId: 'identity-owner',
      delegateId: 'identity-cover',
      capabilities: ['support:reply'],
      scopes: ['support-cases'],
      purpose: 'planned support coverage',
      risk: 'sensitive',
      approved: true,
      now: NOW,
      expiresAt: '2030-02-08T12:00:00.000Z',
    });
    expect(decision).toMatchObject({ allowed: true, state: { status: 'active' } });
    expect(
      evaluate(
        decision['state'] as Readonly<Record<string, unknown>>,
        '2030-02-08T12:00:00.000Z',
      ),
    ).toMatchObject({ active: false, state: { status: 'expired' } });
    expect(offboard({ identityId: 'identity-cover', now: NOW, reason: 'employment ended' })).toEqual({
      allowed: true,
      effects: [
        { kind: 'suspend-membership' },
        { kind: 'revoke-sessions' },
        { kind: 'revoke-delegations' },
        { kind: 'remove-future-approvals' },
        { kind: 'reassign-pending-work' },
        { kind: 'preserve-immutable-history' },
      ],
    });
  });

  it('applies monthly/quarterly reviews, 45/90-day inactivity suspension, and fresh reactivation', async () => {
    const module = await loadGovernance();
    const evaluate = requireFunction(
      module.evaluateAdminAccessGovernance,
      'D-84-recertification-inactivity',
    );
    const reactivate = requireFunction(module.decideAdminReactivation, 'D-84-reactivation');

    expect(
      evaluate({
        accessClass: 'critical',
        now: '2030-03-03T12:00:00.000Z',
        lastReviewedAt: NOW,
        lastActiveAt: '2030-01-17T12:00:00.000Z',
        deviationDetected: true,
      }),
    ).toEqual({
      reviewDue: true,
      inactivityAction: 'suspend',
      deviationAlertRequired: true,
    });
    expect(
      evaluate({
        accessClass: 'read-only',
        now: '2030-05-02T12:00:00.000Z',
        lastReviewedAt: '2030-02-01T12:00:00.000Z',
        lastActiveAt: '2030-02-01T12:00:00.000Z',
        deviationDetected: false,
      }),
    ).toEqual({
      reviewDue: true,
      inactivityAction: 'suspend',
      deviationAlertRequired: false,
    });
    expect(reactivate({ suspended: true, freshVerification: false })).toEqual({
      allowed: false,
      code: 'FRESH_VERIFICATION_REQUIRED',
    });
    expect(reactivate({ suspended: true, freshVerification: true })).toEqual({
      allowed: true,
    });
  });

  it('makes simulation read-only and masks audit fields unless scoped reveal is justified', async () => {
    const module = await loadGovernance();
    const simulate = requireFunction(
      module.projectAdminFunctionSimulation,
      'D-86-read-only-simulation',
    );
    const projectAudit = requireFunction(module.projectAdminAuditField, 'D-87-masked-audit');
    const membership = await activatedMembership();
    const simulation = simulate(membership, 'operations');
    expect(simulation).toMatchObject({
      allowed: true,
      session: { activeFunction: 'operations', simulation: true },
      canAuthorizeAction: false,
    });
    expect(projectAudit({ value: 'customer@example.com', reveal: false })).toEqual({
      allowed: true,
      value: '[masked]',
    });
    expect(
      projectAudit({
        value: 'customer@example.com',
        reveal: true,
        activeFunction: 'support',
        capabilities: ['support:reply'],
        reason: ' ',
      }),
    ).toEqual({ allowed: false, code: 'AUDIT_REVEAL_FORBIDDEN' });
    expect(
      projectAudit({
        value: 'customer@example.com',
        reveal: true,
        activeFunction: 'audit',
        capabilities: ['audit:reveal-sensitive'],
        reason: 'investigate authorized audit event',
      }),
    ).toEqual({ allowed: true, value: 'customer@example.com', auditRequired: true });
  });
});
