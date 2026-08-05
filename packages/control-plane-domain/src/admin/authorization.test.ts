import type { AdminActionJson, AdminCommandJson, AdminRoleJson } from '@liiiraa/contracts-ts';
import { describe, expect, it } from 'vitest';

const OWNER = '04-16-01';
const NOW = '2030-02-01T12:00:00.000Z';

type ProjectionResource =
  'support-case' | 'device' | 'entitlement' | 'session' | 'diagnostic-metadata' | 'audit-event';

type AuthorizationModule = Readonly<{
  authorizeAdminProjection?: (
    session: Readonly<{ actorId: string; role: AdminRoleJson; expiresAt: string }>,
    request: Readonly<{ resource: ProjectionResource; action: 'list' | 'search' | 'detail' }>,
    now: string,
  ) => Readonly<{ allowed: boolean; code: string }>;
  authorizeAdminCommand?: (
    session: Readonly<{ actorId: string; role: AdminRoleJson; expiresAt: string }>,
    command: AdminCommandJson,
    context: Readonly<{
      now: string;
      impactReviewed: boolean;
      confirmed: boolean;
      stepUp?: Readonly<{
        method: 'passkey' | 'totp';
        verifiedAt: string;
        expiresAt: string;
        authorizationContextId: string;
        actorId: string;
        action: AdminActionJson;
        resource: ProjectionResource;
        redactedTarget: string;
      }>;
    }>,
  ) => Readonly<{ allowed: boolean; code: string; resource?: ProjectionResource }>;
  filterAdminProjection?: <RecordValue>(
    session: Readonly<{ actorId: string; role: AdminRoleJson; expiresAt: string }>,
    resource: ProjectionResource,
    records: readonly RecordValue[],
    now: string,
  ) => readonly RecordValue[];
  projectBreakGlassMetadata?: (
    input: Readonly<{
      session: Readonly<{ actorId: string; role: AdminRoleJson; expiresAt: string }>;
      now: string;
      reason: string;
      expiresAt: string;
      alerted: boolean;
      stepUp: Readonly<{
        method: 'passkey' | 'totp';
        verifiedAt: string;
        expiresAt: string;
        authorizationContextId: string;
        actorId: string;
        action: 'revoke-session';
        resource: 'session';
        redactedTarget: string;
      }>;
      source: Readonly<Record<string, unknown>>;
    }>,
  ) => Readonly<{ allowed: boolean; code: string; metadata?: Readonly<Record<string, unknown>> }>;
}>;

const AUTHORIZATION_MODULE_PATH = './authorization.ts';

const loadAuthorization = async (): Promise<AuthorizationModule> =>
  import(AUTHORIZATION_MODULE_PATH)
    .then((module) => module as AuthorizationModule)
    .catch((): AuthorizationModule => ({}));

const requireFunction = <T extends (...args: never[]) => unknown>(
  value: T | undefined,
  caseId: string,
): T => {
  if (typeof value !== 'function') {
    throw new Error(`EXPECTED_RED[${OWNER}][${caseId}]: admin authorization is not implemented`);
  }
  return value;
};

const session = (role: AdminRoleJson) => ({
  actorId: 'developer-001',
  role,
  expiresAt: '2030-02-01T13:00:00.000Z',
});

const command = (action: AdminActionJson, role: AdminRoleJson): AdminCommandJson => ({
  schemaVersion: '1.0',
  kind: 'admin-command',
  commandId: `command-${action}`,
  actorId: 'developer-001',
  assumedRole: role,
  action,
  redactedTarget: 'target:[redacted]-001',
  reason: 'reviewed administrative response',
  authorizationContextId: 'step-up-001',
  expectedVersion: '3',
  correlationId: `correlation-${action}`,
  requestedAt: NOW,
});

const projectionCases = [
  ['support', 'support-case'],
  ['operations', 'device'],
  ['operations', 'entitlement'],
  ['security', 'session'],
  ['security', 'diagnostic-metadata'],
  ['audit', 'audit-event'],
] as const satisfies readonly (readonly [AdminRoleJson, ProjectionResource])[];

const commandCases = [
  ['security', 'view-support-diagnostics', 'diagnostic-metadata'],
  ['security', 'revoke-session', 'session'],
  ['security', 'revoke-device', 'device'],
  ['operations', 'correct-entitlement', 'entitlement'],
  ['audit', 'export-audit-reference', 'audit-event'],
] as const satisfies readonly (readonly [AdminRoleJson, AdminActionJson, ProjectionResource])[];

describe('least-privilege admin authorization policy', () => {
  it('enforces the role x resource x projection-action table without a super-admin path', async () => {
    const module = await loadAuthorization();
    const authorize = requireFunction(
      module.authorizeAdminProjection,
      'role-resource-action-table',
    );

    for (const [allowedRole, resource] of projectionCases) {
      for (const role of ['support', 'operations', 'security', 'audit'] as const) {
        for (const action of ['list', 'search', 'detail'] as const) {
          expect(authorize(session(role), { resource, action }, NOW).allowed).toBe(
            role === allowedRole,
          );
        }
      }
    }
    expect(
      authorize(
        {
          actorId: 'developer-001',
          role: 'super-admin' as AdminRoleJson,
          expiresAt: session('audit').expiresAt,
        },
        { resource: 'audit-event', action: 'detail' },
        NOW,
      ),
    ).toMatchObject({ allowed: false, code: 'ROLE_INVALID' });
  });

  it('filters denied records before search or detail projection can observe them', async () => {
    const module = await loadAuthorization();
    const filter = requireFunction(module.filterAdminProjection, 'filter-before-query');
    const deniedRecord = Object.freeze({ id: 'SEC-001', secret: 'must-not-be-observed' });
    const records = Object.freeze([deniedRecord]);

    expect(filter(session('support'), 'session', records, NOW)).toEqual([]);
    expect(filter(session('security'), 'session', records, NOW)).toEqual(records);
  });

  it('requires fresh action-scoped strong authentication, reason, review, and confirmation', async () => {
    const module = await loadAuthorization();
    const authorize = requireFunction(module.authorizeAdminCommand, 'critical-command-table');

    for (const [role, action, resource] of commandCases) {
      const candidate = command(action, role);
      const stepUp = {
        method: 'passkey' as const,
        verifiedAt: '2030-02-01T11:58:00.000Z',
        expiresAt: '2030-02-01T12:03:00.000Z',
        authorizationContextId: candidate.authorizationContextId,
        actorId: candidate.actorId,
        action,
        resource,
        redactedTarget: candidate.redactedTarget,
      };
      expect(
        authorize(session(role), candidate, {
          now: NOW,
          impactReviewed: true,
          confirmed: true,
          stepUp,
        }),
      ).toMatchObject({ allowed: true, resource });
      expect(
        authorize(session(role), candidate, { now: NOW, impactReviewed: true, confirmed: true }),
      ).toMatchObject({ allowed: false, code: 'STEP_UP_REQUIRED' });
      expect(
        authorize(
          session(role),
          { ...candidate, reason: ' ' },
          { now: NOW, impactReviewed: true, confirmed: true, stepUp },
        ),
      ).toMatchObject({ allowed: false, code: 'REASON_REQUIRED' });
      expect(
        authorize(session(role), candidate, {
          now: NOW,
          impactReviewed: false,
          confirmed: true,
          stepUp,
        }),
      ).toMatchObject({ allowed: false, code: 'IMPACT_REVIEW_REQUIRED' });
      expect(
        authorize(session(role), candidate, {
          now: NOW,
          impactReviewed: true,
          confirmed: false,
          stepUp,
        }),
      ).toMatchObject({ allowed: false, code: 'CONFIRMATION_REQUIRED' });
    }
  });

  it('rejects stale, wrong-action, wrong-target, and role-mismatched step-up evidence', async () => {
    const module = await loadAuthorization();
    const authorize = requireFunction(module.authorizeAdminCommand, 'scoped-step-up-rejection');
    const candidate = command('revoke-session', 'security');
    const validStepUp = {
      method: 'totp' as const,
      verifiedAt: '2030-02-01T11:58:00.000Z',
      expiresAt: '2030-02-01T12:03:00.000Z',
      authorizationContextId: candidate.authorizationContextId,
      actorId: candidate.actorId,
      action: candidate.action,
      resource: 'session' as const,
      redactedTarget: candidate.redactedTarget,
    };
    const context = { now: NOW, impactReviewed: true, confirmed: true };

    expect(
      authorize(session('security'), candidate, {
        ...context,
        stepUp: { ...validStepUp, verifiedAt: '2030-02-01T11:50:00.000Z' },
      }),
    ).toMatchObject({ allowed: false, code: 'STEP_UP_STALE' });
    expect(
      authorize(session('security'), candidate, {
        ...context,
        stepUp: { ...validStepUp, action: 'revoke-device' },
      }),
    ).toMatchObject({ allowed: false, code: 'STEP_UP_SCOPE_MISMATCH' });
    expect(
      authorize(session('security'), candidate, {
        ...context,
        stepUp: { ...validStepUp, redactedTarget: 'another:[redacted]' },
      }),
    ).toMatchObject({ allowed: false, code: 'STEP_UP_SCOPE_MISMATCH' });
    expect(
      authorize(session('operations'), candidate, { ...context, stepUp: validStepUp }),
    ).toMatchObject({ allowed: false, code: 'ROLE_MISMATCH' });
    expect(
      authorize(
        session('security'),
        { ...candidate, action: 'bulk-delete' as AdminActionJson },
        { ...context, stepUp: validStepUp },
      ),
    ).toMatchObject({ allowed: false, code: 'ACTION_UNAVAILABLE' });
  });

  it('projects break-glass metadata without diagnostic content and fails closed on weak bounds', async () => {
    const module = await loadAuthorization();
    const project = requireFunction(module.projectBreakGlassMetadata, 'break-glass-redaction');
    const input = {
      session: session('security'),
      now: NOW,
      reason: 'contain active credential abuse',
      expiresAt: '2030-02-01T12:10:00.000Z',
      alerted: true,
      stepUp: {
        method: 'passkey' as const,
        verifiedAt: '2030-02-01T11:58:00.000Z',
        expiresAt: '2030-02-01T12:03:00.000Z',
        authorizationContextId: 'step-up-001',
        actorId: 'developer-001',
        action: 'revoke-session' as const,
        resource: 'session' as const,
        redactedTarget: 'session:[redacted]-001',
      },
      source: {
        caseId: 'case-redacted-001',
        accountReference: 'account:[redacted]-001',
        sessionReference: 'session:[redacted]-001',
        riskClass: 'credential-abuse',
        diagnosticContent: 'raw-user-diagnostic',
        attachmentBytes: 'forbidden',
      },
    };
    const result = project(input);
    expect(result).toMatchObject({ allowed: true, code: 'AUTHORIZED' });
    expect(result.metadata).toEqual({
      caseId: 'case-redacted-001',
      accountReference: 'account:[redacted]-001',
      sessionReference: 'session:[redacted]-001',
      riskClass: 'credential-abuse',
    });
    expect(JSON.stringify(result)).not.toContain('raw-user-diagnostic');
    expect(JSON.stringify(result)).not.toContain('forbidden');
    expect(project({ ...input, alerted: false })).toMatchObject({
      allowed: false,
      code: 'ALERT_REQUIRED',
    });
    expect(project({ ...input, expiresAt: '2030-02-01T12:30:00.000Z' })).toMatchObject({
      allowed: false,
      code: 'BREAK_GLASS_EXPIRY_INVALID',
    });
  });
});
