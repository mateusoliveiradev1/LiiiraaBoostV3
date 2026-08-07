import { readFileSync } from 'node:fs';

import type { AdminJobProjectionJson, AdminOperationReceiptJson } from '@liiiraa/contracts-ts';
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
      'configurations',
      'capacity',
      'audit',
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
    stepUp: 'step-up-0001',
    approvalReferences: ['approval-0001'],
  };

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
      'x-liiiraa-admin-step-up': 'step-up-0001',
    });
    const requestBody = init?.body;
    expect(typeof requestBody).toBe('string');
    if (typeof requestBody !== 'string') throw new Error('Expected JSON mutation body');
    expect(JSON.parse(requestBody)).toMatchObject({
      approvalReferences: ['approval-0001'],
      expectedEtag: 'admin-etag-0007',
      expectedVersion: '7',
      reason: mutation.reason,
      transition: 'pause',
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
