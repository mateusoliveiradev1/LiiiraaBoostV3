import { readFileSync } from 'node:fs';

import type {
  AdminInvitationProjectionJson,
  AdminGovernanceProjectionJson,
  AdminJobProjectionJson,
  AdminOperationReceiptJson,
} from '@liiiraa/contracts-ts';
import { describe, expect, it, vi } from 'vitest';

import {
  ADMIN_QUERY_FAMILIES,
  createAdminAuthority,
  type AdminAuthorityTransport,
} from './admin-authority';

const response = (
  body: unknown,
  status = 200,
  headers: Readonly<Record<string, string>> = {},
): Response =>
  new Response(typeof body === 'string' ? body : JSON.stringify(body), {
    headers: { 'cache-control': 'no-store, private', ...headers },
    status,
  });

const requestUrl = (value: RequestInfo | URL): string =>
  typeof value === 'string' ? value : value instanceof URL ? value.href : value.url;

const metadata = {
  schemaVersion: '1.0',
  aggregateVersion: '7',
  etag: 'admin-etag-0007',
  correlationId: 'admin-correlation-0007',
  provenance: 'postgres-authority',
  environment: {
    environmentId: 'staging-brasil',
    kind: 'staging',
    label: 'Staging Brasil',
  },
  freshness: {
    state: 'live',
    source: 'admin-api',
    sequence: '42',
    observedAt: '2026-08-06T20:00:00.000Z',
  },
} as const;

const job: AdminJobProjectionJson = {
  ...metadata,
  kind: 'admin-job-projection',
  jobId: 'job-0001',
  jobType: 'invitation-import',
  state: 'running',
  progressPercent: 40,
  totalItems: 25,
  completedItems: 10,
  failedItems: 0,
  ownerReference: 'administrator-0001',
  startedAt: '2026-08-06T19:59:00.000Z',
};

const receipt: AdminOperationReceiptJson = {
  ...metadata,
  kind: 'admin-operation-receipt',
  receiptId: 'receipt-0001',
  commandId: 'command-0001',
  outcome: 'applied',
  affectedReferences: ['job-0001'],
  approvalReferences: ['approval-0001'],
  auditReference: 'audit-0001',
  recordedAt: '2026-08-06T20:01:00.000Z',
};

const strongStepUp = {
  action: 'transition-job',
  authorizationContextId: 'step-up-0001',
  expiresAt: '2030-08-06T20:05:00.000Z',
  method: 'totp' as const,
  receipt: 'opaque-step-up-receipt-abcdefghijklmnopqrstuvwxyz0123456789',
  redactedTarget: 'job-0001',
  resource: 'governance',
  verifiedAt: '2030-08-06T20:00:00.000Z',
};

const governance: AdminGovernanceProjectionJson = {
  ...metadata,
  kind: 'admin-governance-projection',
  governanceRecordId: 'approval-0001',
  governanceKind: 'approval',
  state: 'pending',
  risk: 'critical',
  authorReference: 'administrator-0001',
  beneficiaryReference: 'identity-0002',
  eligibleApproverReferences: ['administrator-0003'],
  impactedReferences: ['session:revoke'],
  expiresAt: '2026-08-06T20:10:00.000Z',
};

const invitation: AdminInvitationProjectionJson = {
  ...metadata,
  kind: 'admin-invitation-projection',
  invitationId: 'invitation-0001',
  lifecycleState: 'active',
  recipientMasked: 'm••••@example.com',
  campaignReference: 'private-beta',
  locale: 'pt-BR',
  deliveryState: 'delivered',
  reminderCount: 0,
  ownerReference: 'administrator-0001',
  expiresAt: '2026-08-20T20:00:00.000Z',
  lastEventAt: '2026-08-06T20:00:00.000Z',
};

const createAuthority = (transport: AdminAuthorityTransport) =>
  createAdminAuthority({
    baseUrl: 'https://api.liiiraa.test',
    commandId: () => 'command-0001',
    correlationId: () => 'admin-correlation-0007',
    csrfToken: () => `csrf.${'a'.repeat(43)}`,
    reconnectDelayMs: 0,
    transport,
  });

describe('complete typed Admin query authority', () => {
  it('publishes the complete server-owned query taxonomy', () => {
    expect(ADMIN_QUERY_FAMILIES).toEqual([
      'briefing',
      'search',
      'invitations',
      'team',
      'approvals',
      'jobs',
      'incidents',
      'exports',
      'configurations',
      'capacity',
      'environments',
      'audit',
      'alerts',
      'privacy',
      'emergency',
    ]);
  });

  it('routes every family through credentialed no-store HTTP and generated validation', async () => {
    const transport = vi
      .fn<AdminAuthorityTransport>()
      .mockImplementation(() =>
        Promise.resolve(
          response({ freshness: metadata.freshness, nextCursor: null, records: [job] }),
        ),
      );
    const authority = createAuthority(transport);

    for (const family of ADMIN_QUERY_FAMILIES) {
      await expect(
        authority.query(family, {
          environment: 'staging',
          limit: 25,
          ...(family === 'search' ? { query: 'invitation' } : {}),
        }),
      ).resolves.toMatchObject({ records: [job], status: 'online' });
    }

    expect(transport).toHaveBeenCalledTimes(ADMIN_QUERY_FAMILIES.length);
    for (const [, init] of transport.mock.calls) {
      expect(init).toMatchObject({ cache: 'no-store', credentials: 'include', method: 'GET' });
    }
    expect(transport.mock.calls.map(([url]) => requestUrl(url))).toEqual(
      expect.arrayContaining([
        expect.stringContaining('/v1/admin/operations/search?q=invitation'),
        expect.stringContaining('/v1/admin/invitations'),
        expect.stringContaining('/v1/admin/governance/team'),
        expect.stringContaining('/v1/admin/governance/approvals'),
        expect.stringContaining('/v1/admin/operations/jobs'),
      ]),
    );
  });

  it('rejects malformed projection bytes instead of rendering unvalidated server state', async () => {
    const authority = createAuthority(
      vi.fn<AdminAuthorityTransport>().mockResolvedValue(
        response({
          freshness: metadata.freshness,
          nextCursor: null,
          records: [{ ...job, kind: 'invented-admin-record' }],
        }),
      ),
    );

    await expect(authority.query('jobs', { environment: 'staging' })).resolves.toEqual({
      code: 'invalid-authority',
      records: [],
      status: 'error',
    });
  });

  it('loads a validated invitation detail with masked timeline and retention authority', async () => {
    const authority = createAuthority(
      vi.fn<AdminAuthorityTransport>().mockResolvedValue(
        response({
          document: invitation,
          retention: { action: 'retain', basis: 'operational' },
          timeline: [{ kind: 'delivered', at: metadata.freshness.observedAt }],
        }),
      ),
    );

    await expect(
      authority.loadInvitation({ invitationId: invitation.invitationId }),
    ).resolves.toEqual({
      invitation,
      retention: { action: 'retain', basis: 'operational' },
      status: 'online',
      timeline: [{ kind: 'delivered', at: metadata.freshness.observedAt }],
    });
  });
});

describe('complete typed Admin mutation authority', () => {
  const mutation = {
    family: 'transition-job' as const,
    targetId: 'job-0001',
    payload: { transition: 'pause' },
    expectedVersion: '7',
    expectedEtag: 'admin-etag-0007',
    idempotencyKey: 'admin-operation-0001',
    reason: 'Pause the import while delivery health is reviewed.',
    stepUp: strongStepUp,
    approvalReferences: ['approval-0001'],
  };

  it('binds a sensitive function switch step-up to the current protected session', async () => {
    const transport = vi
      .fn<AdminAuthorityTransport>()
      .mockResolvedValueOnce(
        response({
          actorId: 'administrator-0001',
          assignedFunctions: ['operations', 'security'],
          expiresAt: '2030-08-06T20:00:00.000Z',
          role: 'operations',
          sessionId: 'admin-session-operations-0001',
        }),
      )
      .mockResolvedValueOnce(
        response({
          ok: true,
          expiresAt: '2030-08-06T20:05:00.000Z',
          method: 'totp',
          receipt: 'opaque-function-switch-receipt-abcdefghijklmnopqrstuvwxyz',
          verifiedAt: '2030-08-06T20:00:00.000Z',
        }),
      );
    const authority = createAuthority(transport);
    await authority.session();

    await expect(
      authority.verifyMutationStepUp({
        code: '123456',
        family: 'switch-function',
        idempotencyKey: 'switch-context-0001',
        payload: {
          authorizationContextId: 'switch-context-0001',
          targetFunction: 'security',
        },
        reason: 'Return to the assigned Security function.',
        targetId: 'admin-session-operations-0001',
      }),
    ).resolves.toMatchObject({
      action: 'admin.function.switch',
      redactedTarget: 'admin-session-operations-0001',
      resource: 'admin-session',
    });

    const [, init] = transport.mock.calls[1] ?? [];
    expect(JSON.parse(String(init?.body))).toMatchObject({
      action: 'admin.function.switch',
      redactedTarget: 'admin-session-operations-0001',
      resource: 'admin-session',
    });
  });

  it('attaches CSRF, idempotency, version, step-up, and approval evidence', async () => {
    const transport = vi.fn<AdminAuthorityTransport>().mockResolvedValue(response(receipt));
    const authority = createAuthority(transport);

    await expect(authority.mutate(mutation)).resolves.toEqual({
      document: receipt,
      status: 'complete',
    });
    const [url, init] = transport.mock.calls[0] ?? [];
    expect(url).toBeDefined();
    if (url === undefined) throw new Error('Expected mutation URL');
    expect(requestUrl(url)).toContain('/v1/admin/operations/jobs/job-0001/transitions');
    expect(init).toMatchObject({ cache: 'no-store', credentials: 'include', method: 'POST' });
    expect(init?.headers).toMatchObject({
      'if-match': 'admin-etag-0007',
      'x-expected-version': '7',
      'x-idempotency-key': 'admin-operation-0001',
      'x-liiiraa-admin-step-up': strongStepUp.receipt,
      'x-admin-authorization-context': strongStepUp.authorizationContextId,
      'x-admin-step-up-action': strongStepUp.action,
      'x-admin-step-up-resource': strongStepUp.resource,
      'x-admin-step-up-target': strongStepUp.redactedTarget,
    });
    const requestBody = init?.body;
    expect(typeof requestBody).toBe('string');
    if (typeof requestBody !== 'string') throw new Error('Expected JSON mutation body');
    expect(JSON.parse(requestBody)).toMatchObject({
      approvalReferences: ['approval-0001'],
      expectedEtag: 'admin-etag-0007',
      expectedVersion: '7',
      reason: mutation.reason,
      stepUpEvidence: {
        action: strongStepUp.action,
        authorizationContextId: strongStepUp.authorizationContextId,
        receipt: strongStepUp.receipt,
        redactedTarget: strongStepUp.redactedTarget,
        resource: strongStepUp.resource,
      },
      transition: 'pause',
    });
  });

  it('builds the generated governed command from the admitted active session', async () => {
    const transport = vi
      .fn<AdminAuthorityTransport>()
      .mockResolvedValueOnce(
        response({
          actorId: 'administrator-0001',
          role: 'security',
          expiresAt: '2030-08-06T20:00:00.000Z',
        }),
      )
      .mockResolvedValueOnce(response({ document: governance, ok: true }));
    const authority = createAuthority(transport);

    await expect(
      authority.mutate({
        family: 'approve-request',
        targetId: 'approval-0001',
        payload: {
          authorizationContextId: 'context-0001',
          capability: 'admin-permissions:manage',
          scopes: ['membership'],
        },
        expectedVersion: '7',
        expectedEtag: 'admin-approval-0001-v7',
        idempotencyKey: 'approval-command-0001',
        reason: 'Approve the independently reviewed access transition.',
        stepUp: { ...strongStepUp, authorizationContextId: 'context-0001' },
      }),
    ).resolves.toEqual({ document: governance, status: 'complete' });

    const [, init] = transport.mock.calls[1] ?? [];
    const body = init?.body;
    expect(typeof body).toBe('string');
    if (typeof body !== 'string') throw new Error('EXPECTED_SERIALIZED_ADMIN_COMMAND');
    expect(JSON.parse(body)).toMatchObject({
      command: {
        kind: 'admin-operation-command',
        actorId: 'administrator-0001',
        activeFunction: 'security',
        action: 'request-approval',
        targetReferences: ['approval-0001'],
        expectedVersion: '7',
      },
    });
  });

  it('targets the protected Admin session when switching the active function', async () => {
    const transport = vi
      .fn<AdminAuthorityTransport>()
      .mockResolvedValueOnce(
        response({
          actorId: 'administrator-0001',
          expiresAt: '2030-08-06T20:00:00.000Z',
          role: 'security',
          sessionId: 'admin-session-security-0001',
        }),
      )
      .mockResolvedValueOnce(response({ document: governance, ok: true }));
    const authority = createAuthority(transport);

    await expect(
      authority.mutate({
        expectedVersion: '7',
        family: 'switch-function',
        idempotencyKey: 'switch-function-command-0001',
        payload: {
          authorizationContextId: 'context-switch-0001',
          targetFunction: 'operations',
        },
        reason: 'Assume Operations for the reviewed delivery workflow.',
        stepUp: { ...strongStepUp, authorizationContextId: 'context-switch-0001' },
        targetId: 'administrator-0001',
      }),
    ).resolves.toEqual({ document: governance, status: 'complete' });

    const [, init] = transport.mock.calls[1] ?? [];
    const body = init?.body;
    expect(typeof body).toBe('string');
    if (typeof body !== 'string') throw new Error('EXPECTED_SERIALIZED_SWITCH_COMMAND');
    expect(JSON.parse(body)).toMatchObject({
      command: {
        action: 'update-access',
        actorId: 'administrator-0001',
        activeFunction: 'security',
        targetReferences: ['admin-session-security-0001'],
      },
      targetFunction: 'operations',
    });
  });

  it('builds and admits a consent-bounded sensitive export receipt', async () => {
    const transport = vi
      .fn<AdminAuthorityTransport>()
      .mockResolvedValueOnce(
        response({
          actorId: 'administrator-0001',
          role: 'support',
          expiresAt: '2030-08-06T20:00:00.000Z',
        }),
      )
      .mockResolvedValueOnce(
        response(
          {
            ok: true,
            outcome: 'export-started',
            auditReference: 'audit-export-0001',
            export: {
              exportId: 'export-0001',
              actorId: 'administrator-0001',
              purpose: 'Investigate the consented support escalation.',
              fields: ['case-reference', 'event-time'],
              encrypted: true,
              masked: true,
              environment: 'staging',
              expiresAt: '2030-08-06T19:15:00.000Z',
              createdAt: '2030-08-06T19:00:00.000Z',
            },
          },
          202,
        ),
      );
    const authority = createAuthority(transport);

    await expect(
      authority.mutate({
        approvalReferences: ['approval-export-0001'],
        expectedEtag: 'admin-support-case-0001-v5',
        expectedVersion: '5',
        family: 'export-data',
        idempotencyKey: 'export-command-0001',
        payload: {
          approved: true,
          encrypted: true,
          expiresAt: '2030-08-06T19:15:00.000Z',
          fields: ['case-reference', 'event-time'],
          masked: true,
          minimumFields: ['case-reference', 'event-time'],
          previewed: true,
          purpose: 'Investigate the consented support escalation.',
          targetEnvironment: 'staging',
        },
        reason: 'Investigate the consented support escalation.',
        stepUp: { ...strongStepUp, authorizationContextId: 'context-export-0001' },
        targetId: 'support-case-0001',
      }),
    ).resolves.toEqual({
      receipt: {
        auditReference: 'audit-export-0001',
        createdAt: '2030-08-06T19:00:00.000Z',
        encrypted: true,
        environment: 'staging',
        expiresAt: '2030-08-06T19:15:00.000Z',
        exportId: 'export-0001',
        fields: ['case-reference', 'event-time'],
        masked: true,
        outcome: 'export-started',
        purpose: 'Investigate the consented support escalation.',
      },
      status: 'complete',
    });

    const [, init] = transport.mock.calls[1] ?? [];
    const body = init?.body;
    expect(typeof body).toBe('string');
    if (typeof body !== 'string') throw new Error('EXPECTED_SERIALIZED_EXPORT_COMMAND');
    expect(JSON.parse(body)).toMatchObject({
      command: {
        action: 'export-sensitive-data',
        actorId: 'administrator-0001',
        activeFunction: 'support',
        kind: 'admin-operation-command',
        targetReferences: ['support-case-0001'],
      },
    });
  });

  it('preserves partial, conflict, rate-limit, degraded, and denied outcomes', async () => {
    const transport = vi
      .fn<AdminAuthorityTransport>()
      .mockResolvedValueOnce(response(receipt, 207))
      .mockResolvedValueOnce(response({ code: 'VERSION_CONFLICT' }, 409))
      .mockResolvedValueOnce(response({ code: 'RATE_LIMITED' }, 429))
      .mockResolvedValueOnce(response({ code: 'OPERATIONS_UNAVAILABLE' }, 503))
      .mockResolvedValueOnce(response({ code: 'NOT_FOUND' }, 404));
    const authority = createAuthority(transport);

    await expect(authority.mutate(mutation)).resolves.toMatchObject({ status: 'partial' });
    await expect(authority.mutate(mutation)).resolves.toEqual({
      code: 'conflict',
      status: 'conflict',
    });
    await expect(authority.mutate(mutation)).resolves.toEqual({
      code: 'rate-limit',
      status: 'error',
    });
    await expect(authority.mutate(mutation)).resolves.toEqual({
      code: 'degraded',
      status: 'error',
    });
    await expect(authority.mutate(mutation)).resolves.toEqual({
      code: 'unauthorized',
      status: 'denied',
    });
  });

  it('admits bounded invitation preflight rows without forcing them into an Admin document', async () => {
    const transport = vi.fn<AdminAuthorityTransport>().mockResolvedValue(
      response({
        ok: true,
        rows: [
          { rowId: 'row-1', classification: 'valid' },
          { rowId: 'row-2', classification: 'duplicate' },
        ],
      }),
    );
    const authority = createAuthority(transport);

    await expect(
      authority.mutate({
        family: 'preflight-invitations',
        idempotencyKey: 'preflight-0001',
        payload: {
          rows: [
            { rowId: 'row-1', recipient: 'first@example.com' },
            { rowId: 'row-2', recipient: 'first@example.com' },
          ],
        },
      }),
    ).resolves.toEqual({
      preflight: {
        kind: 'admin-invitation-preflight',
        rows: [
          { rowId: 'row-1', classification: 'valid' },
          { rowId: 'row-2', classification: 'duplicate' },
        ],
      },
      status: 'complete',
    });
  });
});

describe('invalidation-only live authority', () => {
  it('reconnects by cursor and refetches canonical HTTP projections before admitting live state', async () => {
    const event = {
      cursor: 'cursor-0002',
      version: '8',
      updatedAt: '2026-08-06T20:02:00.000Z',
      resources: ['jobs', 'invitations'],
    };
    const transport = vi
      .fn<AdminAuthorityTransport>()
      .mockResolvedValueOnce(response({ code: 'OPERATIONS_UNAVAILABLE' }, 503))
      .mockResolvedValueOnce(
        response(
          `id: ${event.cursor}\nevent: invalidate\ndata: ${JSON.stringify(event)}\n\n`,
          200,
          {
            'content-type': 'text/event-stream; charset=utf-8',
          },
        ),
      );
    const controller = new AbortController();
    const states: string[] = [];
    const invalidations: unknown[] = [];
    const refetch = vi.fn(() => {
      controller.abort();
      return Promise.resolve();
    });
    const authority = createAuthority(transport);

    const lifecycle = authority.openFreshness({
      cursor: 'cursor-0001',
      environment: 'staging',
      onInvalidate: (next) => invalidations.push(next),
      onState: (state) => states.push(state),
      refetch,
      signal: controller.signal,
    });
    await lifecycle.settled;

    expect(states).toEqual(expect.arrayContaining(['reconnecting', 'degraded', 'live']));
    expect(invalidations).toEqual([event]);
    expect(refetch).toHaveBeenCalledWith(event.resources, expect.any(AbortSignal));
    expect(transport.mock.calls.map(([url]) => requestUrl(url))).toEqual([
      expect.stringContaining('cursor=cursor-0001'),
      expect.stringContaining('cursor=cursor-0001'),
    ]);
  });

  it('keeps live authority stable between successful bounded event polls', async () => {
    const event = {
      cursor: 'cursor-0003',
      version: '9',
      updatedAt: '2026-08-06T20:03:00.000Z',
      resources: ['invitations'],
    };
    const controller = new AbortController();
    const transport = vi
      .fn<AdminAuthorityTransport>()
      .mockResolvedValueOnce(
        response(
          `id: ${event.cursor}\nevent: invalidate\ndata: ${JSON.stringify(event)}\n\n`,
          200,
          { 'content-type': 'text/event-stream; charset=utf-8' },
        ),
      )
      .mockImplementationOnce(() => {
        controller.abort();
        return Promise.reject(new Error('bounded poll stopped'));
      });
    const states: string[] = [];
    const authority = createAuthority(transport);

    const lifecycle = authority.openFreshness({
      environment: 'staging',
      onInvalidate: () => undefined,
      onState: (state) => states.push(state),
      refetch: () => Promise.resolve(),
      signal: controller.signal,
    });
    await lifecycle.settled;

    expect(states).toEqual(['reconnecting', 'live']);
  });

  it('treats a repeated cursor as a heartbeat instead of refetching unchanged authority', async () => {
    const event = {
      cursor: 'cursor-0004',
      version: '10',
      updatedAt: '2026-08-06T20:04:00.000Z',
      resources: ['invitations'],
    };
    const controller = new AbortController();
    const eventResponse = () =>
      response(`id: ${event.cursor}\nevent: invalidate\ndata: ${JSON.stringify(event)}\n\n`, 200, {
        'content-type': 'text/event-stream; charset=utf-8',
      });
    const transport = vi
      .fn<AdminAuthorityTransport>()
      .mockResolvedValueOnce(eventResponse())
      .mockResolvedValueOnce(eventResponse())
      .mockImplementationOnce(() => {
        controller.abort();
        return Promise.reject(new Error('bounded poll stopped'));
      });
    const invalidations: unknown[] = [];
    const refetch = vi.fn(() => Promise.resolve());
    const authority = createAuthority(transport);

    const lifecycle = authority.openFreshness({
      environment: 'staging',
      onInvalidate: (next) => invalidations.push(next),
      onState: () => undefined,
      refetch,
      signal: controller.signal,
    });
    await lifecycle.settled;

    expect(invalidations).toEqual([event]);
    expect(refetch).toHaveBeenCalledTimes(1);
  });
});

describe('production fixture boundary', () => {
  it('rejects preview packages, testing fixtures, fallback authority, and hard-coded authority badges', () => {
    const productionSources = [
      './admin-authority.ts',
      './features/admin-authority.tsx',
      './admin-navigation.tsx',
      './app/[locale]/layout.tsx',
    ].map((path) => readFileSync(new URL(path, import.meta.url), 'utf8'));
    const productionArtifact = productionSources.join('\n');

    expect(productionArtifact).not.toContain('@liiiraa/web-preview');
    expect(productionArtifact).not.toMatch(/(?:src\/testing|admin-state-fixtures)/u);
    expect(productionArtifact).not.toContain('storybook-fixture');
    expect(productionArtifact).not.toContain('fixtureFallback');
    expect(productionArtifact).not.toContain('ADMIN CONTROL PLANE');
  });
});
