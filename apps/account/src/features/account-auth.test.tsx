import { readFileSync } from 'node:fs';

import { describe, expect, it, vi } from 'vitest';

import {
  admitInvitationToken,
  createAccountAuth,
  type AccountAuthTransport,
} from '../account-auth';

const actor = Object.freeze({
  accountId: '00000000-0000-4000-8000-000000000001',
  displayName: 'Real Tester',
  email: 'tester@example.com',
  locale: 'pt-BR' as const,
  role: 'tester' as const,
  sessionId: '00000000-0000-4000-8000-000000000002',
  sessionKind: 'web' as const,
  expiresAt: '2030-02-01T00:00:00.000Z',
});

const response = (body: unknown, status = 200): Response =>
  new Response(body === undefined ? undefined : JSON.stringify(body), {
    headers: { 'content-type': 'application/json' },
    status,
  });

describe('real account authentication client', () => {
  it('bootstraps in-memory CSRF and signs in without sending diagnostic data', async () => {
    const transport = vi
      .fn<AccountAuthTransport>()
      .mockResolvedValueOnce(response({ token: 'csrf-token-abcdefghijklmnopqrstuvwxyz0123456789' }))
      .mockResolvedValueOnce(response({ actor }, 201));
    const auth = createAccountAuth({
      correlationId: () => 'account-auth-01',
      transport,
    });

    await expect(
      auth.signIn({ email: 'tester@example.com', password: 'CorrectHorse1' }),
    ).resolves.toEqual({ actor, status: 'authenticated' });
    expect(transport).toHaveBeenNthCalledWith(1, '/v1/identity/csrf', {
      credentials: 'include',
      headers: { accept: 'application/json', 'x-correlation-id': 'account-auth-01' },
      method: 'GET',
    });
    const signInRequest = transport.mock.calls[1]?.[1];
    const signInBody = typeof signInRequest?.body === 'string' ? signInRequest.body : '';
    expect(signInRequest).toMatchObject({ credentials: 'include', method: 'POST' });
    expect(JSON.parse(signInBody)).toEqual({
      email: 'tester@example.com',
      password: 'CorrectHorse1',
    });
    expect(signInBody).not.toMatch(/diagnostic|device|hardware|telemetry/iu);
  });

  it('creates an invited account and restores the cookie session through a fresh client read', async () => {
    const invitationToken = 'i'.repeat(64);
    const signupTransport = vi
      .fn<AccountAuthTransport>()
      .mockResolvedValueOnce(response({ token: 'csrf-token-abcdefghijklmnopqrstuvwxyz0123456789' }))
      .mockResolvedValueOnce(response({ actor }, 201));
    const signup = createAccountAuth({
      correlationId: () => 'account-signup-01',
      transport: signupTransport,
    });
    await expect(
      signup.signUp({
        displayName: 'Real Tester',
        email: 'tester@example.com',
        invitationToken,
        locale: 'pt-BR',
        password: 'CorrectHorse1',
      }),
    ).resolves.toEqual({ actor, status: 'authenticated' });
    const signupBody = signupTransport.mock.calls[1]?.[1]?.body;
    expect(JSON.parse(typeof signupBody === 'string' ? signupBody : '')).toEqual({
      displayName: 'Real Tester',
      email: 'tester@example.com',
      invitationToken,
      locale: 'pt-BR',
      password: 'CorrectHorse1',
    });

    const restored = createAccountAuth({
      correlationId: () => 'account-session-01',
      transport: vi.fn<AccountAuthTransport>().mockResolvedValue(response({ actor })),
    });
    await expect(restored.session()).resolves.toEqual({ actor, status: 'authenticated' });
  });

  it('uses the same generic rejection for a used invitation and a bad password', async () => {
    const rejected = () =>
      createAccountAuth({
        correlationId: () => 'account-rejected-01',
        transport: vi
          .fn<AccountAuthTransport>()
          .mockResolvedValueOnce(
            response({ token: 'csrf-token-abcdefghijklmnopqrstuvwxyz0123456789' }),
          )
          .mockResolvedValueOnce(response({ code: 'AUTHENTICATION_FAILED' }, 401)),
      });
    await expect(
      rejected().signIn({ email: 'unknown@example.com', password: 'Incorrect1A' }),
    ).resolves.toEqual({ code: 'authentication-failed', status: 'error' });
    await expect(
      rejected().signUp({
        displayName: 'Real Tester',
        email: 'tester@example.com',
        invitationToken: 'i'.repeat(64),
        locale: 'pt-BR',
        password: 'CorrectHorse1',
      }),
    ).resolves.toEqual({ code: 'authentication-failed', status: 'error' });
  });

  it('revokes the cookie session and leaves the client signed out', async () => {
    const transport = vi
      .fn<AccountAuthTransport>()
      .mockResolvedValueOnce(response({ token: 'csrf-token-abcdefghijklmnopqrstuvwxyz0123456789' }))
      .mockResolvedValueOnce(response(undefined, 204))
      .mockResolvedValueOnce(response({ code: 'AUTHENTICATION_REQUIRED' }, 401));
    const auth = createAccountAuth({
      correlationId: () => 'account-signout-01',
      transport,
    });

    await expect(auth.signOut()).resolves.toEqual({ status: 'signed-out' });
    await expect(auth.session()).resolves.toEqual({ status: 'unauthenticated' });
    expect(transport.mock.calls[1]?.[1]).toMatchObject({
      credentials: 'include',
      method: 'POST',
    });
  });

  it('approves a desktop challenge with cookie CSRF and admits only the exact loopback callback', async () => {
    const state = 'state_0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZabcdef';
    const transport = vi
      .fn<AccountAuthTransport>()
      .mockResolvedValueOnce(response({ token: 'csrf-token-abcdefghijklmnopqrstuvwxyz0123456789' }))
      .mockResolvedValueOnce(
        response({
          callbackUrl: `http://127.0.0.1:43117/oauth/callback?code=one-shot-code&state=${state}`,
        }),
      );
    const auth = createAccountAuth({
      correlationId: () => 'account-desktop-approval-01',
      transport,
    });

    await expect(
      auth.approveDesktopAuthorization({ challengeId: 'challenge-01', state }),
    ).resolves.toEqual({
      callbackUrl: `http://127.0.0.1:43117/oauth/callback?code=one-shot-code&state=${state}`,
      status: 'approved',
    });
    expect(transport.mock.calls[1]?.[0]).toBe(
      '/v1/identity/desktop/authorizations/challenge-01/approve',
    );
    expect(transport.mock.calls[1]?.[1]).toMatchObject({
      credentials: 'include',
      method: 'POST',
    });
    const body = transport.mock.calls[1]?.[1]?.body;
    expect(JSON.parse(typeof body === 'string' ? body : '')).toEqual({ state });
  });

  it('admits only bounded base64url invitation tokens', () => {
    expect(admitInvitationToken('i'.repeat(64))).toBe('i'.repeat(64));
    expect(admitInvitationToken('used invitation')).toBeNull();
    expect(admitInvitationToken('short')).toBeNull();
  });
});

describe('production account composition', () => {
  it('routes authentication to the real client and removes deterministic identity chrome', () => {
    const pageSource = readFileSync(
      new URL('../app/[locale]/[[...responsibility]]/page.tsx', import.meta.url),
      'utf8',
    );
    const layoutSource = readFileSync(
      new URL('../app/[locale]/layout.tsx', import.meta.url),
      'utf8',
    );
    const authSource = readFileSync(new URL('./account-auth.tsx', import.meta.url), 'utf8');

    expect(pageSource).toContain('AccountAuthPage');
    expect(pageSource).toContain('isAccountAuthRoute');
    expect(pageSource).not.toContain('searchParams');
    expect(authSource).toContain('useSearchParams');
    expect(authSource).not.toContain('@liiiraa/web-preview');
    expect(layoutSource).not.toContain('Astra Player');
    expect(layoutSource).not.toContain('astra.player@example.com');
    expect(layoutSource).not.toContain('Premium · Modo Competitivo');
    expect(layoutSource).not.toContain('Premium · Competitive Mode');
  });

  it('keeps closed beta registration gated and exposes administration only after account sign-in', () => {
    const authSource = readFileSync(new URL('./account-auth.tsx', import.meta.url), 'utf8');
    const layoutSource = readFileSync(
      new URL('../app/[locale]/layout.tsx', import.meta.url),
      'utf8',
    );

    expect(authSource).toContain('data-account-state="invitation-required"');
    expect(authSource).toContain('Beta fechado');
    expect(authSource).toContain('Receba um convite individual');
    expect(authSource).toContain('data-password-requirements');
    expect(authSource).toContain('Mostrar senha');
    expect(authSource).toContain('adminOrigin');
    expect(authSource).toContain('Abrir painel administrativo');
    expect(layoutSource).toContain('LIIIRAA_ADMIN_ORIGIN');
  });

  it('finishes authentication with a polished handoff and preserves desktop authorization through signup', () => {
    const authSource = readFileSync(new URL('./account-auth.tsx', import.meta.url), 'utf8');

    expect(authSource).toContain('const AuthSuccess');
    expect(authSource).toContain('data-account-state="authentication-success"');
    expect(authSource).toContain("const DESKTOP_ACCOUNT_DEEP_LINK = 'liiiraa-boost://goal/account'");
    expect(authSource).toContain('desktopAuthorization={desktopAuthorization}');
    expect(authSource).toContain("desktop_challenge");
    expect(authSource).toContain('approveDesktopAuthorization(desktopAuthorization)');
  });
});
