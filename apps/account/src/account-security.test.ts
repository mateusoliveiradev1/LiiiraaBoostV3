import { describe, expect, it } from 'vitest';
import { NextRequest } from 'next/server';
import accountNextConfig from '../next.config';
import accountProxy, {
  accountContextFromUrl,
  accountHeaderContract,
  config as accountProxyConfig,
  createRequestNonce,
} from '../proxy';
import accountRuntimeProxy from './proxy';

describe('account security boundary', () => {
  it('leaves the real API authority path outside the page proxy', () => {
    expect(accountProxyConfig.matcher).toEqual([
      '/((?!api|v1|_next/static|_next/image|favicon.ico|.*\\..*).*)',
    ]);
  });

  it('builds the real API rewrite into the Next routing manifest', async () => {
    const rewrites = Reflect.get(accountNextConfig, 'rewrites') as
      | (() => Promise<readonly { destination: string; source: string }[]>)
      | undefined;

    expect(rewrites).toBeTypeOf('function');
    await expect(rewrites?.()).resolves.toEqual([
      {
        destination: 'https://liiiraa-api-staging.onrender.com/v1/:path*',
        source: '/v1/:path*',
      },
    ]);
  });

  it('creates a fresh cryptographically random nonce for every request', () => {
    const first = createRequestNonce();
    const second = createRequestNonce();

    expect(first).not.toBe(second);
    expect(first).toMatch(/^[A-Za-z0-9+/]+={0,2}$/u);
    expect(second).toMatch(/^[A-Za-z0-9+/]+={0,2}$/u);
    expect(first.length).toBeGreaterThanOrEqual(24);
  });

  it('applies an exact noindex, frame-closed, third-party-free header contract', () => {
    const nonce = 'dGVzdC1hY2NvdW50LW5vbmNl';
    const headers = Object.fromEntries(
      accountHeaderContract(nonce, 'production').map(({ key, value }) => [
        key.toLowerCase(),
        value,
      ]),
    );
    const csp = headers['content-security-policy'];

    expect(headers).toMatchObject({
      'cache-control': 'private, no-store, max-age=0',
      'cross-origin-opener-policy': 'same-origin',
      'cross-origin-resource-policy': 'same-origin',
      'permissions-policy': 'camera=(), geolocation=(), microphone=(), payment=(), usb=()',
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
    'keeps the $runtimeMode nonce policy isolated with development eval=$allowsEval',
    ({ allowsEval, runtimeMode }) => {
      const nonce = `dGVzdC1hY2NvdW50LW5vbmNl-${runtimeMode}`;
      const headers = Object.fromEntries(
        accountHeaderContract(nonce, runtimeMode).map(({ key, value }) => [
          key.toLowerCase(),
          value,
        ]),
      );
      const csp = headers['content-security-policy'];

      expect(csp).toBeDefined();
      if (csp === undefined) {
        throw new Error('Account CSP header is required in every runtime mode.');
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

  it('admits only the canonical web-core safe context keys', () => {
    const accepted = accountContextFromUrl(
      new URL(
        'https://account.liiiraa.com/en/account?destination=account-security&returnPath=public-plans',
      ),
    );
    const rejected = accountContextFromUrl(
      new URL(
        'https://account.liiiraa.com/en/account?destination=admin-role&returnPath=admin-audit&redirect=https://evil.example',
      ),
    );

    expect(accepted).toEqual({
      destination: 'account-security',
      locale: 'en',
      returnPath: 'public-plans',
    });
    expect(rejected).toEqual({ locale: 'en' });
  });

  it('never issues a session cookie or redirect from the proxy', () => {
    const first = accountProxy(
      new NextRequest('https://account.liiiraa.com/pt-BR/account?scenario=privileged'),
    );
    const second = accountProxy(
      new NextRequest('https://account.liiiraa.com/pt-BR/account?scenario=privileged'),
    );

    expect(first.headers.get('content-security-policy')).not.toBe(
      second.headers.get('content-security-policy'),
    );
    expect(first.headers.get('set-cookie')).toBeNull();
    expect(first.headers.get('location')).toBeNull();
    expect(first.status).toBe(200);
    expect(accountRuntimeProxy).toBe(accountProxy);
  });
});
