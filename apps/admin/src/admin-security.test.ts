import { readFileSync, statSync } from 'node:fs';

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { NextRequest, NextResponse } from 'next/server';

import adminProxy, {
  AdminAccessBoundary,
  adminHeaderContract,
  config as adminProxyConfig,
  createAdminRequestNonce,
} from '../proxy';
import adminNextConfig, { ADMIN_RUNTIME_BOUNDARY, ADMIN_TEST_ORIGIN } from '../next.config';
import {
  ADMIN_BROWSER_AUTHORITY_BASE_URL,
  ADMIN_CANONICAL_ENTRY,
  ADMIN_LOCAL_ORIGIN,
  resolveAdminOrigin,
} from './admin-runtime';

describe('admin security boundary', () => {
  const originalPreviewMode = process.env['LIIIRAA_ADMIN_PREVIEW'];

  beforeEach(() => {
    process.env['LIIIRAA_ADMIN_PREVIEW'] = 'true';
  });

  afterEach(() => {
    if (originalPreviewMode === undefined) {
      delete process.env['LIIIRAA_ADMIN_PREVIEW'];
    } else {
      process.env['LIIIRAA_ADMIN_PREVIEW'] = originalPreviewMode;
    }
    vi.restoreAllMocks();
  });

  it('runs the real API authority path through the origin-sealing proxy', () => {
    expect(adminProxyConfig.matcher).toEqual([
      '/((?!api|_next/static|_next/image|favicon.ico|.*\\..*).*)',
    ]);
  });

  it.each([
    ['/', '/pt-BR/admin'],
    ['/pt-BR', '/pt-BR/admin'],
    ['/en', '/en/admin'],
  ])('redirects %s to the canonical administrative entry', (source, destination) => {
    const response = adminProxy(new NextRequest(`${ADMIN_LOCAL_ORIGIN}${source}`));

    expect(response.status).toBe(307);
    expect(response.headers.get('location')).toBe(`${ADMIN_LOCAL_ORIGIN}${destination}`);
  });

  it('builds the real API rewrite into the Next routing manifest', async () => {
    const rewrites = Reflect.get(adminNextConfig, 'rewrites') as
      (() => Promise<readonly { destination: string; source: string }[]>) | undefined;

    expect(rewrites).toBeTypeOf('function');
    await expect(rewrites?.()).resolves.toEqual([
      {
        destination: 'https://liiiraa-api-staging.onrender.com/v1/:path*',
        source: '/v1/:path*',
      },
    ]);
  });

  it('keeps administrative browser credentials on the isolated origin', () => {
    const page = readFileSync(
      new URL('./app/[locale]/[[...workspace]]/page.tsx', import.meta.url),
      'utf8',
    );

    expect(ADMIN_BROWSER_AUTHORITY_BASE_URL).toBe('');
    expect(page).toContain('authorityBaseUrl={ADMIN_BROWSER_AUTHORITY_BASE_URL}');
    expect(page).not.toContain('authorityBaseUrl={runtime.authorityBaseUrl}');
  });

  it('publishes the request nonce for React Aria and serves every declared local font', () => {
    const layout = readFileSync(new URL('./app/[locale]/layout.tsx', import.meta.url), 'utf8');

    expect(layout).toContain("const nonce = requestHeaders.get('x-nonce');");
    expect(layout).toContain('<meta content={nonce} property="csp-nonce" />');

    for (const file of [
      'manrope-variable.woff2',
      'jetbrains-mono-variable.woff2',
      'saira-semi-condensed-variable.woff2',
    ]) {
      expect(statSync(new URL(`../public/fonts/${file}`, import.meta.url)).size).toBeGreaterThan(0);
    }
  });

  it('uses the exact dedicated local origin and never claims connected authority', () => {
    const packageJson = JSON.parse(
      readFileSync(new URL('../package.json', import.meta.url), 'utf8'),
    ) as { readonly scripts: Readonly<Record<string, string>> };

    expect(packageJson.scripts['dev']).toBe(
      'next dev --webpack --hostname admin.localhost --port 3002',
    );
    expect(ADMIN_LOCAL_ORIGIN).toBe('http://admin.localhost:3002');
    expect(ADMIN_TEST_ORIGIN).toBe(ADMIN_LOCAL_ORIGIN);
    expect(ADMIN_RUNTIME_BOUNDARY).toEqual({
      authoritativeAccessConnected: false,
      cookiePolicy: 'reject-cross-surface',
      indexing: 'noindex',
      origin: ADMIN_LOCAL_ORIGIN,
    });
    expect(resolveAdminOrigin()).toBe(ADMIN_LOCAL_ORIGIN);
    expect(resolveAdminOrigin('http://admin.localhost:3102')).toBe('http://admin.localhost:3102');
    expect(() => resolveAdminOrigin('https://user@admin.localhost')).toThrow(
      'credential-free dedicated origin',
    );
    expect(() => resolveAdminOrigin('http://admin.example.com')).toThrow(
      'credential-free dedicated origin',
    );
  });

  it('publishes only the canonical localized admin entries', () => {
    expect(ADMIN_CANONICAL_ENTRY).toEqual({
      en: '/en/admin',
      'pt-BR': '/pt-BR/admin',
    });
    expect(Object.isFrozen(ADMIN_CANONICAL_ENTRY)).toBe(true);
    expect(Object.values(ADMIN_CANONICAL_ENTRY)).not.toContain('/en');
    expect(Object.values(ADMIN_CANONICAL_ENTRY)).not.toContain('/pt-BR');
  });

  it('requires an explicit exact production origin and rejects localhost lookalikes', () => {
    expect(resolveAdminOrigin('https://admin.liiiraa.com')).toBe('https://admin.liiiraa.com');
    expect(resolveAdminOrigin('https://liiiraa-boost-admin-staging.vercel.app')).toBe(
      'https://liiiraa-boost-admin-staging.vercel.app',
    );
    expect(() => resolveAdminOrigin('http://localhost:3002')).toThrow(
      'credential-free dedicated origin',
    );
    expect(() => resolveAdminOrigin('http://preview.admin.localhost:3002')).toThrow(
      'credential-free dedicated origin',
    );
    expect(() => resolveAdminOrigin('http://admin.localhost.example:3002')).toThrow(
      'credential-free dedicated origin',
    );
    expect(() => resolveAdminOrigin('https://*.liiiraa.com')).toThrow(
      'credential-free dedicated origin',
    );
  });

  it('rejects a generic localhost Host header even when Next normalizes the request URL origin', () => {
    const response = adminProxy(
      new NextRequest(`${ADMIN_LOCAL_ORIGIN}/pt-BR/admin`, {
        headers: {
          host: 'localhost:3002',
        },
      }),
    );

    expect(response.status).toBe(403);
    expect(response.headers.get('x-liiiraa-admin-role')).toBeNull();
  });

  it('creates a fresh cryptographically random nonce for every request', () => {
    const first = createAdminRequestNonce();
    const second = createAdminRequestNonce();

    expect(first).not.toBe(second);
    expect(first).toMatch(/^[A-Za-z0-9+/]+={0,2}$/u);
    expect(second).toMatch(/^[A-Za-z0-9+/]+={0,2}$/u);
    expect(first.length).toBeGreaterThanOrEqual(24);
  });

  it('applies the strictest noindex, frame-closed, external-free header contract', () => {
    const nonce = 'dGVzdC1hZG1pbi1ub25jZQ==';
    const headers = Object.fromEntries(
      adminHeaderContract(nonce, 'production').map(({ key, value }) => [key.toLowerCase(), value]),
    );
    const csp = headers['content-security-policy'];

    expect(headers).toMatchObject({
      'cache-control': 'private, no-store, max-age=0',
      'cross-origin-opener-policy': 'same-origin',
      'cross-origin-resource-policy': 'same-origin',
      'permissions-policy':
        'camera=(), display-capture=(), geolocation=(), microphone=(), payment=(), usb=()',
      'referrer-policy': 'no-referrer',
      'x-content-type-options': 'nosniff',
      'x-frame-options': 'DENY',
      'x-robots-tag': 'noindex,nofollow,noarchive',
    });
    expect(csp).toContain("default-src 'self'");
    expect(csp).toContain(`'nonce-${nonce}'`);
    expect(csp).toContain("'strict-dynamic'");
    expect(csp).toContain("base-uri 'none'");
    expect(csp).toContain("object-src 'none'");
    expect(csp).toContain("frame-ancestors 'none'");
    expect(csp).toContain("form-action 'self'");
    expect(csp).not.toMatch(/https?:/u);
    expect(Object.keys(headers)).not.toContain('set-cookie');
    expect(Object.keys(headers)).not.toContain('location');
  });

  it.each([
    { allowsEval: true, runtimeMode: 'development' },
    { allowsEval: false, runtimeMode: 'production' },
    { allowsEval: false, runtimeMode: 'test' },
  ] as const)(
    'keeps admitted $runtimeMode nonce policy isolated with development eval=$allowsEval',
    ({ allowsEval, runtimeMode }) => {
      const nonce = `dGVzdC1hZG1pbi1ub25jZQ-${runtimeMode}`;
      const headers = Object.fromEntries(
        adminHeaderContract(nonce, runtimeMode).map(({ key, value }) => [key.toLowerCase(), value]),
      );
      const csp = headers['content-security-policy'];

      expect(csp).toBeDefined();
      if (csp === undefined) {
        throw new Error('Admin CSP header is required in every runtime mode.');
      }

      expect(csp).toContain(`'nonce-${nonce}'`);
      expect(csp).toContain("'strict-dynamic'");
      expect(csp.includes("'unsafe-eval'")).toBe(allowsEval);
      expect(csp.match(/'unsafe-eval'/gu)?.length ?? 0).toBe(allowsEval ? 1 : 0);
      expect(csp).toContain("frame-ancestors 'none'");
      expect(csp).not.toMatch(/https?:/u);
      expect(headers).toMatchObject({
        'cache-control': 'private, no-store, max-age=0',
        'x-frame-options': 'DENY',
        'x-robots-tag': 'noindex,nofollow,noarchive',
      });
      expect(Object.keys(headers)).not.toContain('set-cookie');
      expect(Object.keys(headers)).not.toContain('location');
    },
  );

  it('stays distinct from public and account origins, cookies, and CSP policy', () => {
    const publicConfig = readFileSync(new URL('../../web/next.config.ts', import.meta.url), 'utf8');
    const accountConfig = readFileSync(
      new URL('../../account/next.config.ts', import.meta.url),
      'utf8',
    );
    const accountProxy = readFileSync(new URL('../../account/proxy.ts', import.meta.url), 'utf8');
    const adminCsp = Object.fromEntries(
      adminHeaderContract('comparison-nonce', 'production').map(({ key, value }) => [
        key.toLowerCase(),
        value,
      ]),
    )['content-security-policy'];

    expect(publicConfig).toContain("'unsafe-inline'");
    expect(accountConfig).toContain('https://account.liiiraa.com');
    expect(accountProxy).not.toContain('display-capture=()');
    expect(adminCsp).not.toContain("'unsafe-inline'");
    expect(adminCsp).toContain("'strict-dynamic'");
    expect(
      adminHeaderContract('comparison-nonce', 'production').find(
        ({ key }) => key === 'Permissions-Policy',
      )?.value,
    ).toContain('display-capture=()');
    expect(ADMIN_LOCAL_ORIGIN).not.toContain('account.');
    expect(ADMIN_LOCAL_ORIGIN).not.toBe('https://liiiraa.com');
  });

  it('admits only closed preview roles and rejects cross-surface state', () => {
    const defaultPreview = AdminAccessBoundary({
      cookieHeader: null,
      url: new URL(`${ADMIN_LOCAL_ORIGIN}/pt-BR/admin`),
    });
    const preview = AdminAccessBoundary({
      cookieHeader: null,
      url: new URL(`${ADMIN_LOCAL_ORIGIN}/en/admin?role=security`),
    });
    const foreignCookie = AdminAccessBoundary({
      cookieHeader: 'account_session=opaque',
      url: new URL(`${ADMIN_LOCAL_ORIGIN}/en/admin?role=audit`),
    });
    const arbitraryReturn = AdminAccessBoundary({
      cookieHeader: null,
      url: new URL(`${ADMIN_LOCAL_ORIGIN}/en/admin?role=operations&returnUrl=https://evil.example`),
    });
    const foreignOrigin = AdminAccessBoundary({
      cookieHeader: null,
      url: new URL('https://account.localhost/en/admin?role=support'),
    });

    expect(defaultPreview).toEqual({
      authoritativeAccessConnected: false,
      reason: 'deterministic-role-preview',
      role: 'support',
    });
    expect(preview).toEqual({
      authoritativeAccessConnected: false,
      reason: 'deterministic-role-preview',
      role: 'security',
    });
    expect(foreignCookie).toMatchObject({
      authoritativeAccessConnected: false,
      reason: 'cross-surface-cookie-rejected',
    });
    expect(arbitraryReturn).toMatchObject({
      authoritativeAccessConnected: false,
      reason: 'unsafe-context-rejected',
    });
    expect(foreignOrigin).toMatchObject({
      authoritativeAccessConnected: false,
      reason: 'origin-rejected',
    });
  });

  it('propagates only disconnected preview markers and blocks unsafe requests', () => {
    const safe = adminProxy(new NextRequest(`${ADMIN_LOCAL_ORIGIN}/pt-BR/admin?role=support`));
    const unsafe = adminProxy(
      new NextRequest(`${ADMIN_LOCAL_ORIGIN}/pt-BR/admin?returnPath=/account`, {
        headers: {
          cookie: 'public_session=opaque',
        },
      }),
    );

    expect(safe.status).toBe(200);
    expect(safe.headers.get('x-liiiraa-admin-role')).toBe('support');
    expect(safe.headers.get('x-liiiraa-preview-authority')).toBe('disconnected');
    expect(safe.headers.get('set-cookie')).toBeNull();
    expect(safe.headers.get('location')).toBeNull();
    expect(unsafe.status).toBe(403);
    expect(unsafe.headers.get('set-cookie')).toBeNull();
    expect(unsafe.headers.get('location')).toBeNull();
  });

  it('never injects a preview role or disconnected fixture marker in production', () => {
    process.env['LIIIRAA_ADMIN_PREVIEW'] = 'false';
    const response = adminProxy(new NextRequest(`${ADMIN_LOCAL_ORIGIN}/pt-BR/admin`));

    expect(response.status).toBe(200);
    expect(response.headers.get('x-liiiraa-admin-role')).toBeNull();
    expect(response.headers.get('x-liiiraa-preview-authority')).toBeNull();
    expect(response.headers.get('set-cookie')).toBeNull();
    expect(response.headers.get('location')).toBeNull();
  });

  it('seals the server-side admin API rewrite with the configured isolated origin', () => {
    process.env['LIIIRAA_ADMIN_PREVIEW'] = 'false';
    const response = adminProxy(
      new NextRequest(`${ADMIN_LOCAL_ORIGIN}/v1/admin/session`, {
        headers: { origin: 'https://untrusted.example' },
      }),
    );

    expect(response.status).toBe(200);
    expect(response.headers.get('x-middleware-request-origin')).toBe(ADMIN_LOCAL_ORIGIN);
    expect(response.headers.get('x-liiiraa-admin-role')).toBeNull();
  });

  it('rejects URL-selected roles when production authority is active', () => {
    process.env['LIIIRAA_ADMIN_PREVIEW'] = 'false';
    const response = adminProxy(new NextRequest(`${ADMIN_LOCAL_ORIGIN}/pt-BR/admin?role=support`));

    expect(response.status).toBe(403);
    expect(response.headers.get('x-liiiraa-admin-role')).toBeNull();
    expect(response.headers.get('x-liiiraa-preview-authority')).toBeNull();
  });

  it.each([
    {
      locale: 'pt-BR',
      title: 'Acesso administrativo não autorizado',
      recovery: 'Abrir entrada administrativa segura',
    },
    {
      locale: 'en',
      title: 'Administrative access not authorized',
      recovery: 'Open the secure admin entry',
    },
  ])(
    'returns an authored localized HTML denial for $locale document navigation',
    async ({ locale, recovery, title }) => {
      const response = adminProxy(
        new NextRequest(`https://account.localhost/${locale}/admin`, {
          headers: {
            accept: 'text/html,application/xhtml+xml',
            'sec-fetch-dest': 'document',
            'sec-fetch-mode': 'navigate',
            'x-request-id': 'request-42',
          },
        }),
      );
      const body = await response.text();

      expect(response.status).toBe(403);
      expect(response.headers.get('content-type')).toContain('text/html');
      expect(response.headers.get('content-security-policy')).not.toContain("'unsafe-eval'");
      expect(body).toContain(`lang="${locale}"`);
      expect(body).toContain(title);
      expect(body).toContain(recovery);
      expect(body).toContain(`href="${ADMIN_LOCAL_ORIGIN}/${locale}/admin"`);
      expect(body).toContain('request-42');
      expect(body).not.toMatch(/authoritativeAccessConnected|fixture|preview role/iu);
      expect(body).not.toContain('<script');
    },
  );

  it('keeps rejected non-document requests as bounded JSON with equivalent semantics', async () => {
    const response = adminProxy(
      new NextRequest('https://account.localhost/en/admin?role=security', {
        headers: {
          accept: 'text/html,application/xhtml+xml',
          'sec-fetch-dest': 'empty',
          'x-request-id': 'api-request-7',
        },
      }),
    );

    expect(response.status).toBe(403);
    expect(response.headers.get('content-type')).toContain('application/json');
    await expect(response.json()).resolves.toEqual({
      authoritativeAccessConnected: false,
      code: 'ADMIN_PREVIEW_ACCESS_DENIED',
      reason: 'origin-rejected',
      requestId: 'api-request-7',
    });
  });

  it('escapes or removes untrusted denial data and never forwards a rejected request', async () => {
    const nextSpy = vi.spyOn(NextResponse, 'next');
    const rejectedRequests = [
      new NextRequest(
        'https://account.localhost/pt-BR/admin?returnUrl=%3Cscript%3Ealert(1)%3C%2Fscript%3E',
        {
          headers: {
            accept: 'text/html',
            'sec-fetch-dest': 'document',
            'sec-fetch-mode': 'navigate',
            'x-request-id': '<img src=x onerror=alert(1)>',
          },
        },
      ),
      new NextRequest(`${ADMIN_LOCAL_ORIGIN}/en/admin`, {
        headers: { cookie: 'account_session=opaque' },
      }),
      new NextRequest(`${ADMIN_LOCAL_ORIGIN}/en/admin?returnPath=/account`),
      new NextRequest(`${ADMIN_LOCAL_ORIGIN}/en/admin?role=administrator`),
    ];
    const responses = rejectedRequests.map((request) => adminProxy(request));
    const body = await responses[0]?.text();

    expect(responses).toHaveLength(4);
    expect(responses.every((response) => response.status === 403)).toBe(true);
    expect(nextSpy).not.toHaveBeenCalled();
    expect(body).not.toContain('<img');
    expect(body).not.toContain('<script');
    expect(body).not.toContain('returnUrl');

    for (const response of responses) {
      expect(response.headers.get('cache-control')).toBe('private, no-store, max-age=0');
      expect(response.headers.get('content-security-policy')).toContain("default-src 'self'");
      expect(response.headers.get('content-security-policy')).not.toContain("'unsafe-eval'");
      expect(response.headers.get('x-frame-options')).toBe('DENY');
      expect(response.headers.get('x-content-type-options')).toBe('nosniff');
      expect(response.headers.get('set-cookie')).toBeNull();
      expect(response.headers.get('location')).toBeNull();
    }
  });
});
