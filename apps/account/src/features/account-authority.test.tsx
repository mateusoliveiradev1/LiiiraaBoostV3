import { readFileSync } from 'node:fs';

import { describe, expect, it, vi } from 'vitest';

import {
  createAccountAuthority,
  type AccountAuthorityProjection,
  type AccountAuthorityTransport,
} from '../account-authority';
import {
  advanceAccountMutationPhase,
  mapAccountAuthorityProjection,
} from '../account-runtime';

const projection = (
  overrides: Partial<AccountAuthorityProjection> = {},
): AccountAuthorityProjection => ({
  account: {
    schemaVersion: '1.0',
    aggregateVersion: '7',
    etag: 'account-account-01-v7',
    correlationId: 'account-test',
    provenance: 'postgres-authority',
    kind: 'account-projection',
    accountId: 'account-01',
    state: 'active',
    displayName: 'Astra Player',
    emailRedacted: 'a***@example.com',
    locale: 'en',
    createdAt: '2026-01-01T00:00:00.000Z',
    updatedAt: '2026-01-15T12:00:00.000Z',
  },
  provenance: 'online',
  securityMethods: [
    { factor: 'passkey', methodId: 'method-passkey', verifiedAt: '2026-01-15T10:00:00.000Z' },
    { factor: 'totp', methodId: 'method-mfa', verifiedAt: '2026-01-15T10:05:00.000Z' },
  ],
  sessions: [
    {
      schemaVersion: '1.0',
      aggregateVersion: '3',
      etag: 'session-session-01-v3',
      correlationId: 'account-test',
      provenance: 'postgres-authority',
      kind: 'session-projection',
      sessionId: 'session-01',
      accountId: 'account-01',
      state: 'active',
      authenticationStrength: 'passkey',
      scopes: ['session-web'],
      authenticatedAt: '2026-01-15T10:00:00.000Z',
      expiresAt: '2026-01-16T10:00:00.000Z',
      lastSeenAt: '2026-01-15T12:00:00.000Z',
    },
  ],
  subscription: {
    schemaVersion: '1.0',
    aggregateVersion: '4',
    etag: 'subscription-account-01-v4',
    correlationId: 'account-test',
    provenance: 'postgres-authority',
    kind: 'subscription-projection',
    subscriptionId: 'subscription-01',
    accountId: 'account-01',
    state: 'active',
    plan: 'premium',
    entitlements: ['premium-actions'],
    currentPeriodEndsAt: '2026-02-15T12:00:00.000Z',
    cancelAtPeriodEnd: false,
  },
  invoices: [
    {
      schemaVersion: '1.0',
      aggregateVersion: '2',
      etag: 'invoice-invoice-01-v2',
      correlationId: 'account-test',
      provenance: 'postgres-authority',
      kind: 'invoice-projection',
      invoiceId: 'invoice-01',
      accountId: 'account-01',
      subscriptionId: 'subscription-01',
      state: 'paid',
      currency: 'BRL',
      amountDueMinor: '4990',
      amountPaidMinor: '4990',
      issuedAt: '2026-01-15T11:00:00.000Z',
      settledAt: '2026-01-15T11:01:00.000Z',
    },
  ],
  supportCases: [
    {
      schemaVersion: '1.0',
      aggregateVersion: '1',
      etag: 'support-case-01-v1',
      correlationId: 'account-test',
      provenance: 'postgres-authority',
      kind: 'support-case-projection',
      supportCaseId: 'case-01',
      accountId: 'account-01',
      state: 'open',
      subjectRedacted: 'First access help',
      auditReference: 'support-audit-case-01',
      createdAt: '2026-01-15T11:10:00.000Z',
      updatedAt: '2026-01-15T11:10:00.000Z',
    },
  ],
  activeDevice: {
    schemaVersion: '1.0',
    aggregateVersion: '5',
    etag: 'device-binding-01-v5',
    correlationId: 'account-test',
    provenance: 'device-verified',
    kind: 'device-binding-projection',
    deviceBindingId: 'binding-01',
    accountId: 'account-01',
    state: 'active',
    deviceLabel: 'Astra-PC',
    evidenceVersion: '2',
    boundAt: '2026-01-10T12:00:00.000Z',
    replacementEligibleAt: '2026-02-09T12:00:00.000Z',
  },
  ...overrides,
});

const response = (body: unknown, status = 200, headers: Record<string, string> = {}): Response =>
  new Response(JSON.stringify(body), {
    headers: { 'content-type': 'application/json', ...headers },
    status,
  });

describe('production account authority', () => {
  it('ships a real Stripe subscription surface with Liiiraa-only branding and webhook confirmation copy', () => {
    const subscriptionSource = readFileSync(
      new URL('./account-subscription-authority.tsx', import.meta.url),
      'utf8',
    );
    expect(subscriptionSource).toContain('data-account-commerce="stripe-live"');
    expect(subscriptionSource).toContain('createAccountCommerce');
    expect(subscriptionSource).toContain('Liiiraa Boost Premium');
    expect(subscriptionSource).toContain('Premium somente após o webhook');
    expect(subscriptionSource).toContain('Premium administrativo permanente');
    expect(subscriptionSource).toContain('Sem cobrança, renovação ou fatura');
    expect(subscriptionSource).toContain("billingKind === 'stripe'");
    expect(subscriptionSource).not.toMatch(/Frescari/iu);
  });

  it('loads the generated account projection with an authenticated same-origin request', async () => {
    const transport = vi
      .fn<AccountAuthorityTransport>()
      .mockResolvedValue(response(projection(), 200, { etag: '"account-account-01-v7"' }));
    const authority = createAccountAuthority({
      correlationId: () => 'account-read-01',
      csrfToken: () => 'csrf-account-01',
      transport,
    });

    await expect(authority.project()).resolves.toEqual({
      projection: projection(),
      status: 'online',
    });
    expect(transport).toHaveBeenCalledWith('/v1/account', {
      credentials: 'include',
      headers: {
        accept: 'application/json',
        'x-correlation-id': 'account-read-01',
        'x-csrf-token': 'csrf-account-01',
      },
      method: 'GET',
    });
  });

  it('binds PATCH to the returned ETag and expected aggregate version', async () => {
    const updated = projection({
      account: {
        ...projection().account,
        aggregateVersion: '8',
        displayName: 'Liiiraa Authority',
        etag: 'account-account-01-v8',
      },
    });
    const transport = vi.fn<AccountAuthorityTransport>().mockResolvedValue(response(updated));
    const authority = createAccountAuthority({
      clock: () => '2026-01-15T12:01:00.000Z',
      commandId: () => 'account-command-01',
      correlationId: () => 'account-write-01',
      csrfToken: () => 'csrf-account-01',
      transport,
    });

    await expect(
      authority.updateProfile({
        displayName: 'Liiiraa Authority',
        localDraftToken: 'draft-profile-01',
        locale: 'en',
        projection: projection(),
      }),
    ).resolves.toEqual({ projection: updated, status: 'complete' });

    const [, request] = transport.mock.calls[0] ?? [];
    expect(request?.headers).toMatchObject({
      'if-match': '"account-account-01-v7"',
      'x-csrf-token': 'csrf-account-01',
    });
    expect(typeof request?.body).toBe('string');
    const requestBody: unknown =
      typeof request?.body === 'string' ? JSON.parse(request.body) : undefined;
    expect(requestBody).toMatchObject({
      command: { action: 'update-profile', expectedVersion: '7' },
      localDraftToken: 'draft-profile-01',
      patch: { displayName: 'Liiiraa Authority', locale: 'en' },
    });
  });

  it('reconciles an ambiguous committed PATCH instead of reporting a false save failure', async () => {
    const updated = projection({
      account: {
        ...projection().account,
        aggregateVersion: '8',
        displayName: 'Mateus Oliveira',
        etag: 'account-account-01-v8',
      },
    });
    const transport = vi
      .fn<AccountAuthorityTransport>()
      .mockRejectedValueOnce(new TypeError('response lost after commit'))
      .mockResolvedValueOnce(response(updated));
    const authority = createAccountAuthority({
      correlationId: () => 'account-reconcile-01',
      csrfToken: () => 'csrf-account-01',
      transport,
    });

    await expect(
      authority.updateProfile({
        displayName: 'Mateus Oliveira',
        localDraftToken: 'draft-profile-01',
        locale: 'en',
        projection: projection(),
      }),
    ).resolves.toEqual({ projection: updated, status: 'complete' });
    expect(transport).toHaveBeenCalledTimes(2);
    expect(transport.mock.calls[1]?.[1]?.method).toBe('GET');
  });

  it('preserves server truth and a bounded safe draft on conflict', async () => {
    const remote = projection({
      account: {
        ...projection().account,
        aggregateVersion: '8',
        displayName: 'Remote Player',
        etag: 'account-account-01-v8',
      },
      provenance: 'conflict',
    });
    const transport = vi
      .fn<AccountAuthorityTransport>()
      .mockResolvedValue(
        response(
          { code: 'CONFLICT', localDraftToken: 'draft-profile-01', ok: false, projection: remote },
          409,
        ),
      );
    const authority = createAccountAuthority({
      correlationId: () => 'account-conflict-01',
      csrfToken: () => 'csrf-account-01',
      transport,
    });

    await expect(
      authority.updateProfile({
        displayName: 'Safe Local Draft',
        localDraftToken: 'draft-profile-01',
        locale: 'pt-BR',
        projection: projection(),
      }),
    ).resolves.toEqual({
      draft: { displayName: 'Safe Local Draft', locale: 'pt-BR', token: 'draft-profile-01' },
      projection: remote,
      status: 'conflict',
    });
  });

  it('retains last-known authority through pending, stale, and offline observations', async () => {
    const pending = projection({ provenance: 'pending' });
    const authority = createAccountAuthority({
      correlationId: () => 'account-state-01',
      csrfToken: () => 'csrf-account-01',
      transport: vi
        .fn<AccountAuthorityTransport>()
        .mockResolvedValueOnce(response(pending))
        .mockResolvedValueOnce(response({ code: 'STALE_AUTHORITY' }, 503))
        .mockRejectedValueOnce(new TypeError('network unavailable')),
    });

    await expect(authority.project()).resolves.toEqual({ projection: pending, status: 'pending' });
    await expect(authority.project()).resolves.toEqual({ projection: pending, status: 'stale' });
    await expect(authority.project()).resolves.toEqual({ projection: pending, status: 'offline' });
  });
});

describe('account runtime composition', () => {
  it('offers the restricted Internal installer without claiming public signing', () => {
    const markup = readFileSync(new URL('./account-authority.tsx', import.meta.url), 'utf8');

    expect(markup).toContain('data-internal-download="restricted"');
    expect(markup).toContain('href="/api/internal-download"');
    expect(markup).toContain('Build interno para testes convidados');
    expect(markup).toContain('não possui assinatura pública');
    expect(markup).toContain('O canal público estável continua indisponível');
    expect(markup).not.toMatch(/blob\.vercel-storage\.com|BLOB_READ_WRITE_TOKEN/iu);
  });

  it('preserves every interruption state until an explicit authority transition occurs', () => {
    expect(advanceAccountMutationPhase('idle', 'review')).toBe('reviewing');
    expect(advanceAccountMutationPhase('reviewing', 'require-reauth')).toBe('reauth');
    expect(advanceAccountMutationPhase('reauth', 'confirm')).toBe('confirming');
    expect(advanceAccountMutationPhase('confirming', 'issue')).toBe('issuing');
    expect(advanceAccountMutationPhase('issuing', 'pending')).toBe('pending');
    expect(advanceAccountMutationPhase('issuing', 'conflict')).toBe('conflict');
    expect(advanceAccountMutationPhase('issuing', 'offline')).toBe('offline');
    expect(advanceAccountMutationPhase('issuing', 'stale')).toBe('stale');
    expect(advanceAccountMutationPhase('issuing', 'error')).toBe('error');
    expect(advanceAccountMutationPhase('issuing', 'complete')).toBe('complete');
    expect(advanceAccountMutationPhase('conflict', 'review')).toBe('reviewing');
  });

  it('maps all authoritative account responsibilities without inventing fixture truth', () => {
    expect(mapAccountAuthorityProjection(projection(), '2026-01-15T12:00:00.000Z')).toMatchObject({
      authorityState: 'online',
      billing: { checkout: 'reconciled', invoiceCount: 1, plan: 'premium', state: 'active' },
      device: { isCurrent: true, label: 'Astra-PC', replacement: 'cooldown' },
      identity: { displayName: 'Astra Player', emailRedacted: 'a***@example.com', locale: 'en' },
      security: { mfa: true, passkey: true, sessionCount: 1 },
      support: { openCount: 1 },
    });
    expect(
      mapAccountAuthorityProjection(projection({ activeDevice: null }), '2026-01-15T12:00:00.000Z')
        .device,
    ).toEqual({
      isCurrent: false,
      replacement: 'eligible',
    });
  });

  it('exposes only production account authority from the deployable runtime', () => {
    const runtimeSource = readFileSync(new URL('../account-runtime.ts', import.meta.url), 'utf8');
    const compositionSource = readFileSync(
      new URL('../account-production-composition.ts', import.meta.url),
      'utf8',
    );

    expect(runtimeSource).not.toMatch(/preview|fixture|mock/iu);
    expect(compositionSource).toContain("runtimeClass: 'server-authority'");
    expect(compositionSource).toContain('authorityConnected: true');
  });

  it('keeps preview authority isolated from production modules', () => {
    const authoritySource = readFileSync(
      new URL('../account-authority.ts', import.meta.url),
      'utf8',
    );
    const runtimeSource = readFileSync(new URL('../account-runtime.ts', import.meta.url), 'utf8');
    const proxySource = readFileSync(new URL('../../proxy.ts', import.meta.url), 'utf8');
    const routeSource = readFileSync(
      new URL('../app/[locale]/[[...responsibility]]/page.tsx', import.meta.url),
      'utf8',
    );
    const layoutSource = readFileSync(
      new URL('../app/[locale]/layout.tsx', import.meta.url),
      'utf8',
    );
    const productionViewSource = readFileSync(
      new URL('./account-authority.tsx', import.meta.url),
      'utf8',
    );
    const previewSource = readFileSync(new URL('./account-preview.tsx', import.meta.url), 'utf8');

    expect(authoritySource).not.toContain('@liiiraa/web-preview');
    expect(runtimeSource).not.toContain('@liiiraa/web-preview');
    expect(proxySource).not.toContain('x-liiiraa-preview-authority');
    expect(routeSource).not.toContain('AccountPreviewPage');
    expect(routeSource).not.toContain('resolveAccountServerRuntimeConfig');
    expect(layoutSource).not.toContain('resolveAccountServerRuntimeConfig');
    expect(productionViewSource).not.toContain('@liiiraa/web-preview');
    expect(productionViewSource).toContain('Account authority status');
    expect(productionViewSource).toContain('Profile update receipt');
    expect(productionViewSource).toContain('Device replacement unavailable');
    expect(previewSource).toContain('@liiiraa/web-preview');
    expect(previewSource).toContain('remoteStateChanged: false');
  });
});
