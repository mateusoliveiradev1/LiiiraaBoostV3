import { describe, expect, it } from 'vitest';
import { NextRequest } from 'next/server';

import adminProxy, {
  AdminAccessBoundary,
  adminHeaderContract,
  createAdminRequestNonce,
} from '../proxy';
import {
  ADMIN_RUNTIME_BOUNDARY,
  ADMIN_TEST_ORIGIN,
} from '../next.config';

describe('admin security boundary', () => {
  it('uses a dedicated preview origin and never claims connected authority', () => {
    expect(ADMIN_TEST_ORIGIN).toBe('https://admin.localhost');
    expect(ADMIN_RUNTIME_BOUNDARY).toEqual({
      authoritativeAccessConnected: false,
      cookiePolicy: 'reject-cross-surface',
      indexing: 'noindex',
      origin: ADMIN_TEST_ORIGIN,
    });
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
      adminHeaderContract(nonce).map(({ key, value }) => [
        key.toLowerCase(),
        value,
      ]),
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

  it('admits only closed preview roles and rejects cross-surface state', () => {
    const preview = AdminAccessBoundary({
      cookieHeader: null,
      url: new URL('https://admin.localhost/en/admin?role=security'),
    });
    const foreignCookie = AdminAccessBoundary({
      cookieHeader: 'account_session=opaque',
      url: new URL('https://admin.localhost/en/admin?role=audit'),
    });
    const arbitraryReturn = AdminAccessBoundary({
      cookieHeader: null,
      url: new URL(
        'https://admin.localhost/en/admin?role=operations&returnUrl=https://evil.example',
      ),
    });
    const foreignOrigin = AdminAccessBoundary({
      cookieHeader: null,
      url: new URL('https://account.localhost/en/admin?role=support'),
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
    const safe = adminProxy(
      new NextRequest('https://admin.localhost/pt-BR/admin?role=support'),
    );
    const unsafe = adminProxy(
      new NextRequest('https://admin.localhost/pt-BR/admin?returnPath=/account', {
        headers: {
          cookie: 'public_session=opaque',
        },
      }),
    );

    expect(safe.status).toBe(200);
    expect(safe.headers.get('x-liiiraa-admin-role')).toBe('support');
    expect(safe.headers.get('x-liiiraa-preview-authority')).toBe(
      'disconnected',
    );
    expect(safe.headers.get('set-cookie')).toBeNull();
    expect(safe.headers.get('location')).toBeNull();
    expect(unsafe.status).toBe(403);
    expect(unsafe.headers.get('set-cookie')).toBeNull();
    expect(unsafe.headers.get('location')).toBeNull();
  });
});
