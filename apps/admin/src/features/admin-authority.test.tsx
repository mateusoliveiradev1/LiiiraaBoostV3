import { readFileSync } from 'node:fs';

import type { AuthorityReceiptJson, DiagnosticConsentJson } from '@liiiraa/contracts-ts';
import { describe, expect, it, vi } from 'vitest';

import {
  createAdminAuthority,
  type AdminAuthorityTransport,
  type AdminDiagnosticProjection,
} from '../admin-authority';
import { resolveAdminRuntimeConfig } from '../admin-runtime';

const response = (body: unknown, status = 200, headers: Record<string, string> = {}): Response =>
  new Response(JSON.stringify(body), {
    headers: { 'cache-control': 'no-store', 'content-type': 'application/json', ...headers },
    status,
  });

const requestUrl = (value: RequestInfo | URL): string =>
  typeof value === 'string' ? value : value instanceof URL ? value.href : value.url;

const consent = (state: 'active' | 'revoked' | 'expired' = 'active'): DiagnosticConsentJson => ({
  schemaVersion: '1.0',
  aggregateVersion: state === 'active' ? '4' : '5',
  etag: `consent-consent-015-${state}`,
  correlationId: 'admin-consent-test',
  provenance: 'postgres-authority',
  kind: 'diagnostic-consent',
  consentId: 'consent-015',
  accountId: 'account-015',
  state,
  scopes: ['support-diagnostics'],
  purpose: 'Review startup-state and application-version for case DIA-015',
  grantedAt: '2026-01-15T11:00:00.000Z',
  expiresAt: state === 'expired' ? '2026-01-15T11:59:59.000Z' : '2026-01-15T13:00:00.000Z',
  ...(state === 'revoked' ? { revokedAt: '2026-01-15T12:01:00.000Z' } : {}),
});

const diagnostic = (state: 'active' | 'revoked' = 'active'): AdminDiagnosticProjection => ({
  consent: consent(state),
  fields: state === 'active' ? { 'application-version': '1.0.0', 'startup-state': 'ready' } : {},
  auditEvents: [
    {
      schemaVersion: '1.0',
      kind: 'audit-event',
      auditEventId: state === 'active' ? 'audit-diagnostic-opened' : 'audit-diagnostic-revoked',
      actorReference: 'security-operator',
      assumedRole: 'security',
      action: state === 'active' ? 'diagnostic-access-opened' : 'diagnostic-access-revoked',
      redactedTarget: 'Diagnostic ••••-015',
      reason: state === 'active' ? 'Active bounded consent' : 'Account owner revoked consent',
      result: 'succeeded',
      aggregateVersion: state === 'active' ? '4' : '5',
      correlationId: 'admin-consent-test',
      eventHash: 'a'.repeat(64),
      occurredAt: state === 'active' ? '2026-01-15T12:00:00.000Z' : '2026-01-15T12:01:00.000Z',
    },
  ],
});

const receipt: AuthorityReceiptJson = {
  schemaVersion: '1.0',
  kind: 'authority-receipt',
  receiptId: 'receipt-admin-01',
  commandId: 'command-admin-01',
  aggregateId: 'release-017',
  aggregateVersion: '8',
  etag: 'release-release-017-v8',
  correlationId: 'admin-command-test',
  auditReference: 'audit-admin-command-01',
  outcome: 'applied',
  provenance: 'postgres-authority',
  recordedAt: '2026-01-15T12:02:00.000Z',
};

describe('production admin authority', () => {
  it('preserves the server-issued CSRF token so administrative logout succeeds', async () => {
    const csrfToken = 'csrf.'.concat('z'.repeat(43));
    const transport = vi
      .fn<AdminAuthorityTransport>()
      .mockResolvedValueOnce(response({ token: csrfToken }))
      .mockResolvedValueOnce(
        response(
          {
            actor: {
              accountId: 'developer-01',
              displayName: 'Mateus Oliveira',
              email: 'owner@example.com',
              expiresAt: '2026-09-05T12:00:00.000Z',
              locale: 'pt-BR',
              role: 'security',
              sessionId: 'session-admin-01',
              sessionKind: 'admin',
            },
          },
          201,
        ),
      )
      .mockResolvedValueOnce(new Response(null, { status: 204 }));
    const authority = createAdminAuthority({
      correlationId: () => 'admin-logout-test',
      csrfToken: () => 'csrf-unavailable',
      transport,
    });

    await authority.signIn({ email: 'owner@example.com', password: 'CorrectHorse1' });
    await expect(authority.signOut()).resolves.toBe(true);

    expect(transport.mock.calls.map(([url]) => requestUrl(url))).toEqual([
      '/v1/identity/csrf',
      '/v1/identity/sign-in',
      '/v1/identity/sign-out',
    ]);
    expect(transport.mock.calls[2]?.[1]?.headers).toMatchObject({
      'x-csrf-token': csrfToken,
    });
  });

  it('creates a real administrative session on the isolated origin', async () => {
    const csrfToken = 'csrf.'.concat('a'.repeat(43));
    const transport = vi
      .fn<AdminAuthorityTransport>()
      .mockResolvedValueOnce(response({ token: csrfToken }))
      .mockResolvedValueOnce(
        response(
          {
            actor: {
              accountId: 'developer-01',
              displayName: 'Mateus Oliveira',
              email: 'owner@example.com',
              expiresAt: '2026-09-05T12:00:00.000Z',
              locale: 'pt-BR',
              role: 'security',
              sessionId: 'session-admin-01',
              sessionKind: 'admin',
            },
          },
          201,
        ),
      );
    const authority = createAdminAuthority({
      correlationId: () => 'admin-sign-in-test',
      csrfToken: () => 'unused-command-csrf',
      transport,
    });

    await expect(
      authority.signIn({ email: 'owner@example.com', password: 'CorrectHorse1' }),
    ).resolves.toEqual({
      actorId: 'developer-01',
      expiresAt: '2026-09-05T12:00:00.000Z',
      role: 'security',
    });
    expect(transport.mock.calls.map(([url]) => requestUrl(url))).toEqual([
      '/v1/identity/csrf',
      '/v1/identity/sign-in',
    ]);
    expect(transport.mock.calls[1]?.[1]).toMatchObject({ credentials: 'include', method: 'POST' });
  });

  it('rejects a public browser session at the administrative boundary', async () => {
    const csrfToken = 'csrf.'.concat('b'.repeat(43));
    const authority = createAdminAuthority({
      correlationId: () => 'admin-boundary-test',
      csrfToken: () => 'unused-command-csrf',
      transport: vi
        .fn<AdminAuthorityTransport>()
        .mockResolvedValueOnce(response({ token: csrfToken }))
        .mockResolvedValueOnce(
          response(
            {
              actor: {
                accountId: 'developer-01',
                displayName: 'Mateus Oliveira',
                email: 'owner@example.com',
                expiresAt: '2026-09-05T12:00:00.000Z',
                locale: 'pt-BR',
                role: 'security',
                sessionId: 'session-web-01',
                sessionKind: 'web',
              },
            },
            201,
          ),
        ),
    });

    await expect(
      authority.signIn({ email: 'owner@example.com', password: 'CorrectHorse1' }),
    ).resolves.toBeNull();
  });

  it('projects only the singular server-admitted role and never sends URL role authority', async () => {
    const transport = vi
      .fn<AdminAuthorityTransport>()
      .mockResolvedValueOnce(
        response({
          actorId: 'developer-01',
          expiresAt: '2026-01-15T13:00:00.000Z',
          role: 'security',
        }),
      )
      .mockResolvedValueOnce(
        response({ records: [{ id: 'DIA-015', redactedTarget: 'Diagnostic ••••-015' }] }),
      );
    const authority = createAdminAuthority({
      correlationId: () => 'admin-read-test',
      csrfToken: () => 'csrf-admin-test',
      transport,
    });

    await expect(authority.session()).resolves.toMatchObject({ role: 'security' });
    await expect(authority.list('diagnostic-metadata')).resolves.toMatchObject({
      records: [{ id: 'DIA-015' }],
      role: 'security',
      status: 'online',
    });
    expect(transport.mock.calls.map(([url]) => requestUrl(url))).toEqual([
      '/v1/admin/session',
      '/v1/admin/diagnostic-metadata',
    ]);
    expect(transport.mock.calls.map(([url]) => requestUrl(url)).join(' ')).not.toContain('role=');
  });

  it('fails closed before transport until step-up, reason, impact review, and confirmation exist', async () => {
    const transport = vi.fn<AdminAuthorityTransport>().mockResolvedValue(response(receipt));
    const authority = createAdminAuthority({
      clock: () => '2026-01-15T12:02:00.000Z',
      commandId: () => 'command-admin-01',
      correlationId: () => 'admin-command-test',
      csrfToken: () => 'csrf-admin-test',
      transport,
    });
    const base = {
      action: 'correct-entitlement' as const,
      actorId: 'developer-01',
      assumedRole: 'operations' as const,
      expectedVersion: '7',
      impactReviewed: true,
      confirmed: true,
      reason: 'Keep publication held while integrity is reviewed',
      redactedTarget: 'Release ••••-017',
    };

    await expect(authority.execute({ ...base, stepUp: null })).resolves.toEqual({
      code: 'step-up-required',
      status: 'denied',
    });
    expect(transport).not.toHaveBeenCalled();

    await expect(
      authority.execute({
        ...base,
        stepUp: {
          authorizationContextId: 'step-up-admin-01',
          verifiedAt: '2026-01-15T12:01:00.000Z',
        },
      }),
    ).resolves.toEqual({ receipt, status: 'complete' });
    const [, request] = transport.mock.calls[0] ?? [];
    expect(request?.headers).toMatchObject({ 'cache-control': 'no-store' });
    expect(JSON.parse(typeof request?.body === 'string' ? request.body : '')).toMatchObject({
      command: {
        action: 'correct-entitlement',
        authorizationContextId: 'step-up-admin-01',
        reason: base.reason,
      },
      confirmed: true,
      impactReviewed: true,
    });
  });

  it('aborts and clears diagnostic bytes on revoke while retaining immutable audit evidence', async () => {
    const controller = new AbortController();
    const cleared = vi.fn();
    const projected = vi.fn();
    let notify: (() => void) | undefined;
    const authority = createAdminAuthority({
      correlationId: () => 'admin-consent-test',
      csrfToken: () => 'csrf-admin-test',
      subscribeToConsent: (listener) => {
        notify = listener;
        return () => undefined;
      },
      transport: vi
        .fn<AdminAuthorityTransport>()
        .mockResolvedValueOnce(response(diagnostic()))
        .mockResolvedValueOnce(response(diagnostic('revoked'))),
    });

    const lifecycle = await authority.openDiagnostic({
      diagnosticId: 'DIA-015',
      onClear: cleared,
      onProjection: projected,
      signal: controller.signal,
    });
    expect(projected).toHaveBeenCalledWith(diagnostic());
    notify?.();
    await lifecycle.settled;
    expect(cleared).toHaveBeenCalledWith({
      auditEvents: diagnostic('revoked').auditEvents,
      reason: 'revoked',
    });
    expect(lifecycle.signal.aborted).toBe(true);
  });

  it('admits only the four redacted break-glass metadata fields', async () => {
    const transport = vi
      .fn<AdminAuthorityTransport>()
      .mockResolvedValueOnce(
        response({ accountReference: 'account-••••-015', rawDiagnostic: 'forbidden' }),
      )
      .mockResolvedValueOnce(
        response({
          accountReference: 'account-••••-015',
          caseId: 'case-015',
          riskClass: 'high',
          sessionReference: 'session-••••-083',
        }),
      );
    const authority = createAdminAuthority({
      correlationId: () => 'admin-break-glass-test',
      csrfToken: () => 'csrf-admin-test',
      transport,
    });
    const input = {
      expiresAt: '2026-01-15T12:10:00.000Z',
      reason: 'Contain the reviewed security incident',
      stepUp: {
        authorizationContextId: 'step-up-break-glass',
        verifiedAt: '2026-01-15T12:00:00.000Z',
      },
      targetReference: 'security-incident-083',
    } as const;

    await expect(authority.breakGlass(input)).resolves.toEqual({
      code: 'invalid-authority',
      status: 'error',
    });
    await expect(authority.breakGlass(input)).resolves.toEqual({
      metadata: {
        accountReference: 'account-••••-015',
        caseId: 'case-015',
        riskClass: 'high',
        sessionReference: 'session-••••-083',
      },
      status: 'complete',
    });
  });
});

describe('admin production composition', () => {
  it('defaults deployable runtime to production and isolates preview authority', () => {
    expect(
      resolveAdminRuntimeConfig({
        accountOrigin: 'https://account.liiiraa.test',
        authorityBaseUrl: 'https://api.liiiraa.test',
      }),
    ).toEqual({
      accountOrigin: 'https://account.liiiraa.test',
      authorityBaseUrl: 'https://api.liiiraa.test',
      kind: 'production',
    });
    expect(resolveAdminRuntimeConfig({ previewEnabled: true })).toEqual({ kind: 'preview' });
    expect(() =>
      resolveAdminRuntimeConfig({
        accountOrigin: 'https://account.liiiraa.test',
        authorityBaseUrl: 'http://api.liiiraa.test',
      }),
    ).toThrow('exact credential-free HTTPS origin');

    const authoritySource = readFileSync(new URL('../admin-authority.ts', import.meta.url), 'utf8');
    const runtimeSource = readFileSync(new URL('../admin-runtime.ts', import.meta.url), 'utf8');
    const productionView = readFileSync(new URL('./admin-authority.tsx', import.meta.url), 'utf8');
    const routeSource = readFileSync(
      new URL('../app/[locale]/[[...workspace]]/page.tsx', import.meta.url),
      'utf8',
    );
    const layoutSource = readFileSync(new URL('../app/[locale]/layout.tsx', import.meta.url), 'utf8');
    const previewView = readFileSync(new URL('./admin-preview.tsx', import.meta.url), 'utf8');
    expect(authoritySource).not.toContain('@liiiraa/web-preview');
    expect(runtimeSource).not.toContain('@liiiraa/web-preview');
    expect(productionView).not.toContain('@liiiraa/web-preview');
    expect(productionView).toContain('Active administrative role');
    expect(productionView).toContain('Verify critical operation');
    expect(productionView).toContain('Consented diagnostic view');
    expect(productionView).toContain('accountOrigin');
    expect(productionView).toContain('Entrar no painel administrativo');
    expect(productionView).toContain('type="password"');
    expect(productionView).toContain('className="admin-authority"');
    expect(productionView).toContain('className="admin-authority__role"');
    expect(productionView).toContain('className="admin-authority__navigation"');
    expect(productionView).toContain('No authorized records are currently available.');
    expect(productionView).toContain('className="admin-production-shell"');
    expect(productionView).toContain('className="admin-production-loading"');
    expect(productionView).toContain('AdminAuthorityProvider');
    expect(productionView).toContain('className="admin-production-nav"');
    expect(productionView).toContain("import Link from 'next/link'");
    expect(productionView).toContain('<Link href={routeHref(locale, suffix) as Route}');
    expect(productionView).toContain('formatAdminDateTime');
    expect(productionView).toContain('formatRecordReference');
    expect(productionView).toContain('variant="destructive"');
    expect(productionView).toContain('Sair do painel');
    expect(productionView).not.toContain('AdminPreviewRoute');
    expect(routeSource).toContain("await import('../../../features/admin-preview')");
    expect(routeSource).not.toContain('import { AdminPreviewPage }');
    expect(layoutSource).toContain('<AdminAuthorityProvider');
    expect(previewView).toContain('@liiiraa/web-preview');
  });
});
